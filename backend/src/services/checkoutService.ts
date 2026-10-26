import { createHash } from 'crypto';
import { Address, AddressInput } from '../domain/address';
import { AppError, ErrorCode, isAppError } from '../domain/errors';
import { IOrderRepository, IPaymentRepository, IPromoRepository } from '../repositories/interfaces';
import { AddressVerification, OrderDTO, OrderRecord, PaymentRecord } from '../types/entities';
import { AuthorizeResult, PaymentProvider } from '../providers/payment/PaymentProvider';
import { AddressCheck, AddressService } from './addressService';
import { IdempotencyStore, StoredOutcome } from './checkout/IdempotencyStore';
import { OrderLockRegistry } from './checkout/OrderLockRegistry';
import { OrderService } from './orderService';
import { Pricing, PricingService } from './pricingService';
import { withTimeout } from './withTimeout';

export interface CheckoutInput {
  idempotencyKey: string;
  orderId: string;
  shippingAddress: AddressInput;
  addressChoice: 'suggested' | 'entered';
  billingSameAsShipping: boolean;
  billingAddress?: AddressInput | null;
  paymentToken: string;
  promoCode?: string | null;
  expectedTotalCents: number;
}

export const PAYMENT_TIMEOUT_MS = 15_000;

// The provider did not answer in time but may still charge. The attempt stays open
// (key in progress, order locked) until `settled` finishes it with the late result.
class PendingPayment extends Error {
  constructor(readonly settled: Promise<OrderDTO>) {
    super('Payment result pending');
  }
}

// Final business errors are replayed for the same key; retryable ones are not stored.
const STORED_ERRORS = new Set<ErrorCode>([
  'ORDER_NOT_FOUND',
  'ORDER_NOT_EDITABLE',
  'CART_EMPTY',
  'ADDRESS_INVALID',
  'PROMO_INVALID',
  'PROMO_EXPIRED',
  'PRICE_CHANGED',
  'PAYMENT_DECLINED',
  'VALIDATION_ERROR',
]);

const CARD_FIELDS = ['cardNumber', 'number', 'cvc', 'cvv', 'expiry'];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined && obj[k] !== null)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

function requestHash(input: CheckoutInput): string {
  const { idempotencyKey: _key, ...rest } = input;
  return createHash('sha256').update(stableStringify(rest)).digest('hex');
}

function verification(check: AddressCheck, choice: CheckoutInput['addressChoice']): AddressVerification {
  switch (check.verdict) {
    case 'verified':
      return 'verified';
    case 'corrected':
      return choice === 'suggested' ? 'corrected' : 'user_override';
    case 'undeliverable':
      return 'user_override';
    default:
      return 'unverified';
  }
}

interface Placement {
  userId: string;
  order: OrderRecord;
  payment: PaymentRecord;
  shipping: Address;
  billingAddress: Address;
  addressVerification: AddressVerification;
  quote: Pricing;
}

export interface CheckoutDeps {
  orders: IOrderRepository;
  payments: IPaymentRepository;
  promos: IPromoRepository;
  orderService: OrderService;
  pricing: PricingService;
  address: AddressService;
  paymentProvider: PaymentProvider;
  idempotency: IdempotencyStore;
  locks: OrderLockRegistry;
  now?: () => number;
  paymentTimeoutMs?: number;
}

// Places an order synchronously and idempotently (spec §7).
export class CheckoutService {
  private paymentCounter = 0;

  constructor(private deps: CheckoutDeps) {}

  async checkout(userId: string, input: CheckoutInput): Promise<OrderDTO> {
    const { idempotency } = this.deps;

    if (CARD_FIELDS.some((f) => f in (input as unknown as Record<string, unknown>))) {
      throw new AppError('VALIDATION_ERROR', 'Card data must not be sent to the server.');
    }

    const begin = idempotency.begin(userId, input.idempotencyKey, requestHash(input));
    if (begin.state === 'completed') return this.replay(begin.outcome);
    if (begin.state === 'mismatch') {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This checkout attempt was already used with different data.');
    }
    if (begin.state === 'in_progress') {
      throw new AppError('CHECKOUT_IN_PROGRESS', 'Checkout in progress.');
    }

    let lockedOrderId: string | undefined;
    let handedOff = false;
    try {
      const order = this.deps.orderService.getOwnedOrder(input.orderId, userId);
      if (order.status !== 'created') {
        throw new AppError('ORDER_NOT_EDITABLE', 'This order can no longer be changed.');
      }
      if (!this.deps.locks.tryAcquire(order.orderId)) {
        throw new AppError('CHECKOUT_IN_PROGRESS', 'Checkout in progress.');
      }
      lockedOrderId = order.orderId;

      const dto = await this.place(userId, order, input);
      idempotency.complete(userId, input.idempotencyKey, { ok: true, orderId: dto.orderId });
      this.log(input, 'ok');
      return dto;
    } catch (e) {
      if (e instanceof PendingPayment && lockedOrderId) {
        handedOff = true;
        const orderId = lockedOrderId;
        e.settled
          .then(
            (dto) => {
              idempotency.complete(userId, input.idempotencyKey, { ok: true, orderId: dto.orderId });
              this.log(input, 'ok (late)');
            },
            (late) => this.recordFailure(userId, input, late)
          )
          .finally(() => this.deps.locks.release(orderId));
        this.log(input, 'PAYMENT_PENDING');
        throw new AppError('PAYMENT_ERROR', 'Payment could not be processed.');
      }
      this.recordFailure(userId, input, e);
      throw e;
    } finally {
      if (lockedOrderId && !handedOff) this.deps.locks.release(lockedOrderId);
    }
  }

  private recordFailure(userId: string, input: CheckoutInput, e: unknown): void {
    const { idempotency } = this.deps;
    if (isAppError(e) && STORED_ERRORS.has(e.code)) {
      idempotency.complete(userId, input.idempotencyKey, { ok: false, code: e.code, message: e.message, details: e.details });
    } else {
      idempotency.abandon(userId, input.idempotencyKey);
    }
    this.log(input, isAppError(e) ? e.code : 'INTERNAL');
  }

  private async place(userId: string, order: OrderRecord, input: CheckoutInput): Promise<OrderDTO> {
    const { address, pricing, paymentProvider } = this.deps;
    const now = this.deps.now ?? Date.now;

    if (order.products.length === 0) {
      throw new AppError('CART_EMPTY', 'Your cart is empty.');
    }

    const entered = address.parse(input.shippingAddress);
    let billing: Address | undefined;
    if (!input.billingSameAsShipping) {
      if (!input.billingAddress) {
        throw new AppError('ADDRESS_INVALID', 'Please fix the highlighted fields.', {
          fieldErrors: [{ field: 'billing', message: 'Enter a billing address.' }],
        });
      }
      billing = address.parse(input.billingAddress, 'billing.');
    }

    const check = await address.check(entered);
    const addressVerification = verification(check, input.addressChoice);
    const shipping: Address =
      addressVerification === 'corrected' && check.suggested ? { ...check.suggested, fullName: entered.fullName, phone: entered.phone } : entered;
    if (!shipping.phone) delete shipping.phone;
    const billingAddress = billing ?? shipping;

    const quote = await pricing.quote(order, { promoCode: input.promoCode ?? undefined, address: shipping });
    if (quote.totalCents !== input.expectedTotalCents) {
      throw new AppError('PRICE_CHANGED', 'Your total has changed.', { pricing: quote });
    }

    const payment: PaymentRecord = {
      id: `pay-${++this.paymentCounter}-${now()}`,
      orderId: order.orderId,
      userId,
      provider: paymentProvider.name,
      amountCents: quote.totalCents,
      currency: 'USD',
      status: 'error',
      createdAt: now(),
    };

    const authorizing: Promise<AuthorizeResult> = paymentProvider
      .authorize({
        amountCents: quote.totalCents,
        currency: 'USD',
        paymentToken: input.paymentToken,
        orderId: order.orderId,
        billingAddress,
        idempotencyKey: `${userId}:${input.idempotencyKey}`,
        capture: true,
      })
      .catch((): AuthorizeResult => ({ status: 'error' }));

    const placement: Placement = { userId, order, payment, shipping, billingAddress, addressVerification, quote };
    let result: AuthorizeResult;
    try {
      result = await withTimeout(authorizing, this.deps.paymentTimeoutMs ?? PAYMENT_TIMEOUT_MS);
    } catch {
      // Timed out: the provider may still charge. Finish this attempt when it answers.
      throw new PendingPayment(authorizing.then((late) => this.finalize(placement, late)));
    }
    return this.finalize(placement, result);
  }

  // Records the payment result and, on success, saves the order snapshot.
  private async finalize(p: Placement, result: AuthorizeResult): Promise<OrderDTO> {
    const { paymentProvider } = this.deps;
    const now = this.deps.now ?? Date.now;
    const payment = { ...p.payment, status: result.status };
    if (result.providerPaymentId) payment.providerPaymentId = result.providerPaymentId;
    if (result.declineCode) payment.declineCode = result.declineCode;
    this.deps.payments.create(payment);

    if (result.status === 'declined') {
      throw new AppError('PAYMENT_DECLINED', 'Your card was declined.', { declineCode: result.declineCode ?? 'declined' });
    }
    if (result.status !== 'captured' && result.status !== 'authorized') {
      throw new AppError('PAYMENT_ERROR', 'Payment could not be processed.');
    }

    const promo = p.quote.promoCode ? this.deps.promos.findById(p.quote.promoCode) : undefined;
    const placed: OrderRecord = {
      ...p.order,
      status: 'submited',
      shippingAddress: p.shipping,
      billingAddress: p.billingAddress,
      addressVerification: p.addressVerification,
      pricing: p.quote,
      paymentId: payment.id,
      checkedOutAt: now(),
    };
    if (promo) placed.promo = promo;
    if (result.paymentMethod) placed.paymentMethod = result.paymentMethod;

    try {
      this.deps.orders.update(placed);
    } catch {
      // Money was taken but the order was not saved: give it back.
      if (payment.providerPaymentId) {
        await paymentProvider.void(payment.providerPaymentId).catch(() => undefined);
      }
      this.deps.payments.update({ ...payment, status: 'voided' });
      throw new AppError('PAYMENT_ERROR', 'Payment could not be processed.');
    }

    return this.deps.orderService.transformToDTO(placed);
  }

  private replay(outcome: StoredOutcome): OrderDTO {
    if (!outcome.ok) throw new AppError(outcome.code, outcome.message, outcome.details);
    const order = this.deps.orders.findById(outcome.orderId);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found');
    return this.deps.orderService.transformToDTO(order);
  }

  // Never log addresses, phone numbers or payment tokens (spec §9a).
  private log(input: CheckoutInput, result: string): void {
    console.log(`checkout order=${input.orderId} key=${input.idempotencyKey} result=${result}`);
  }
}
