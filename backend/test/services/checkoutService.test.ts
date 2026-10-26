import { describe, expect, it, vi } from 'vitest';
import { caAddress, checkoutInput, containerWith, deferred } from '../helpers/checkout';
import { AuthorizeResult } from '../../src/providers/payment/PaymentProvider';
import { MockPaymentProvider } from '../../src/providers/payment/MockPaymentProvider';

async function errorOf(p: Promise<unknown>): Promise<any> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected rejection');
}

describe('CheckoutService', () => {
  it('happy path places the order with a snapshot', async () => {
    const c = containerWith();
    const order = await c.services.checkout.checkout('user-1', checkoutInput());
    expect(order).toMatchObject({
      orderId: 'order-2',
      status: 'submited',
      addressVerification: 'verified',
      shippingAddress: { fullName: 'John Doe', line1: '1 Market St', state: 'CA', zip: '94105', country: 'US' },
      billingAddress: { line1: '1 Market St' },
      paymentMethod: { brand: 'visa', last4: '4242' },
      promo: { id: 'SAVE10', discount: 10 },
      pricing: { subtotalCents: 149998, discountCents: 15000, taxCents: 9787, totalCents: 144785, taxStatus: 'calculated' },
    });
    expect(order.checkedOutAt).toBeTypeOf('number');
    const payments = c.repositories.payments.findByOrderId('order-2');
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'captured', amountCents: 144785, provider: 'mock' });
  });

  it('retry after success returns stored order', async () => {
    const c = containerWith();
    const first = await c.services.checkout.checkout('user-1', checkoutInput());
    const again = await c.services.checkout.checkout('user-1', checkoutInput());
    expect(again.orderId).toBe(first.orderId);
    expect(c.repositories.payments.findByOrderId('order-2')).toHaveLength(1);
  });

  it('same key with a different body is rejected', async () => {
    const c = containerWith();
    await c.services.checkout.checkout('user-1', checkoutInput());
    const e = await errorOf(c.services.checkout.checkout('user-1', checkoutInput({ promoCode: undefined })));
    expect(e.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('parallel checkouts: one succeeds, one is in progress', async () => {
    const c = containerWith();
    const results = await Promise.allSettled([
      c.services.checkout.checkout('user-1', checkoutInput({ idempotencyKey: 'a' })),
      c.services.checkout.checkout('user-1', checkoutInput({ idempotencyKey: 'b' })),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed[0].reason.code).toBe('CHECKOUT_IN_PROGRESS');
    expect(c.repositories.payments.findByOrderId('order-2')).toHaveLength(1);
  });

  it('cart edit during checkout is rejected', async () => {
    const c = containerWith();
    const gate = deferred<AuthorizeResult>();
    vi.spyOn(c.providers.payment, 'authorize').mockReturnValueOnce(gate.promise);
    const running = c.services.checkout.checkout('user-1', checkoutInput());
    await new Promise((r) => setTimeout(r, 10));
    const e = await errorOf(c.services.orders.updateItemAmount('order-2', 'product-2', 2, 'user-1'));
    expect(e.code).toBe('CHECKOUT_IN_PROGRESS');
    gate.resolve({ status: 'captured', providerPaymentId: 'p1', paymentMethod: { brand: 'visa', last4: '4242' } });
    await running;
    // Lock released after checkout.
    expect(c.services.locks.isLocked('order-2')).toBe(false);
  });

  it('declined card keeps the order and replays the same error', async () => {
    const c = containerWith();
    const input = checkoutInput({ paymentToken: 'mock_tok_visa_0002_abc' });
    const e = await errorOf(c.services.checkout.checkout('user-1', input));
    expect(e.code).toBe('PAYMENT_DECLINED');
    expect(e.details).toEqual({ declineCode: 'card_declined' });
    expect(c.repositories.orders.findById('order-2')!.status).toBe('created');
    const again = await errorOf(c.services.checkout.checkout('user-1', input));
    expect(again.code).toBe('PAYMENT_DECLINED');
    expect(c.repositories.payments.findByOrderId('order-2')).toHaveLength(1);
  });

  it('declined then a new key with a good card succeeds', async () => {
    const c = containerWith();
    await errorOf(c.services.checkout.checkout('user-1', checkoutInput({ paymentToken: 'mock_tok_visa_0002_abc' })));
    const order = await c.services.checkout.checkout('user-1', checkoutInput({ idempotencyKey: 'key-2' }));
    expect(order.status).toBe('submited');
  });

  it('processing error is retryable with the same key', async () => {
    const c = containerWith();
    const input = checkoutInput({ paymentToken: 'mock_tok_visa_0119_abc' });
    expect((await errorOf(c.services.checkout.checkout('user-1', input))).code).toBe('PAYMENT_ERROR');
    const spy = vi.spyOn(c.providers.payment, 'authorize');
    expect((await errorOf(c.services.checkout.checkout('user-1', input))).code).toBe('PAYMENT_ERROR');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('price changed: no payment, new pricing in details', async () => {
    const c = containerWith();
    const spy = vi.spyOn(c.providers.payment, 'authorize');
    const e = await errorOf(c.services.checkout.checkout('user-1', checkoutInput({ expectedTotalCents: 1 })));
    expect(e.code).toBe('PRICE_CHANGED');
    expect(e.details.pricing.totalCents).toBe(144785);
    expect(spy).not.toHaveBeenCalled();
  });

  it('empty cart is rejected', async () => {
    const c = containerWith();
    await c.services.orders.deleteProductFromOrder('order-2', 'product-2', 'user-1');
    await c.services.orders.deleteProductFromOrder('order-2', 'product-4', 'user-1');
    expect((await errorOf(c.services.checkout.checkout('user-1', checkoutInput()))).code).toBe('CART_EMPTY');
  });

  it('invalid shipping and missing billing addresses', async () => {
    const c = containerWith();
    const e = await errorOf(c.services.checkout.checkout('user-1', checkoutInput({ shippingAddress: { ...caAddress, zip: '123' } })));
    expect(e.code).toBe('ADDRESS_INVALID');
    expect(e.details.fieldErrors).toEqual([{ field: 'zip', message: 'Enter a 5-digit ZIP code.' }]);

    const b = await errorOf(
      c.services.checkout.checkout(
        'user-1',
        checkoutInput({ idempotencyKey: 'k2', billingSameAsShipping: false, billingAddress: { ...caAddress, city: '' } })
      )
    );
    expect(b.details.fieldErrors).toEqual([{ field: 'billing.city', message: 'Enter a city.' }]);
  });

  it('suggested address choice stores the corrected address', async () => {
    const c = containerWith();
    const order = await c.services.checkout.checkout(
      'user-1',
      checkoutInput({ addressChoice: 'suggested', shippingAddress: { ...caAddress, line1: '1 market street' } })
    );
    expect(order.addressVerification).toBe('corrected');
    expect(order.shippingAddress).toMatchObject({ line1: '1 MARKET ST', zip: '94105-0001' });
  });

  it('keeping the entered address over a correction is a user override', async () => {
    const c = containerWith();
    const order = await c.services.checkout.checkout(
      'user-1',
      checkoutInput({ shippingAddress: { ...caAddress, line1: '1 market street' } })
    );
    expect(order.addressVerification).toBe('user_override');
    expect(order.shippingAddress!.line1).toBe('1 market street');
  });

  it('undeliverable address does not block checkout', async () => {
    const c = containerWith();
    const order = await c.services.checkout.checkout('user-1', checkoutInput({ shippingAddress: { ...caAddress, zip: '00000' } }));
    expect(order.addressVerification).toBe('user_override');
  });

  it('address provider timeout: order placed as unverified', async () => {
    const c = containerWith();
    const started = Date.now();
    const order = await c.services.checkout.checkout('user-1', checkoutInput({ shippingAddress: { ...caAddress, line1: '1 TIMEOUT RD' } }));
    expect(order.addressVerification).toBe('unverified');
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('persist failure after charge voids the payment', async () => {
    const c = containerWith();
    const orig = c.repositories.orders.update.bind(c.repositories.orders);
    vi.spyOn(c.repositories.orders, 'update').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const e = await errorOf(c.services.checkout.checkout('user-1', checkoutInput()));
    expect(e.code).toBe('PAYMENT_ERROR');
    const provider = c.providers.payment as MockPaymentProvider;
    const [payment] = c.repositories.payments.findByOrderId('order-2');
    expect(provider.statusOf(payment.providerPaymentId!)).toBe('voided');
    expect(payment.status).toBe('voided');
    expect(c.repositories.orders.findById('order-2')!.status).toBe('created');
    void orig;
  });

  it('lock expires after 60 s', () => {
    let now = 0;
    const c = containerWith();
    const locks = new (c.services.locks.constructor as any)(() => now);
    expect(locks.tryAcquire('order-2')).toBe(true);
    expect(locks.tryAcquire('order-2')).toBe(false);
    now = 60_000;
    expect(locks.isLocked('order-2')).toBe(false);
    expect(locks.tryAcquire('order-2')).toBe(true);
  });

  it('rejects raw card fields in the input', async () => {
    const c = containerWith();
    const e = await errorOf(c.services.checkout.checkout('user-1', { ...checkoutInput(), cardNumber: '4242424242424242' } as any));
    expect(e.code).toBe('VALIDATION_ERROR');
  });

  it('another user cannot check out the cart', async () => {
    const c = containerWith();
    expect((await errorOf(c.services.checkout.checkout('user-2', checkoutInput()))).code).toBe('ORDER_NOT_FOUND');
  });
});
