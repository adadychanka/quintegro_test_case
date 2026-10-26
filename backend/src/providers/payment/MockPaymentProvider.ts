import { AuthorizeRequest, AuthorizeResult, PaymentProvider } from './PaymentProvider';

const TOKEN_RE = /^mock_tok_([a-z]+)_(\d{4})_[a-z0-9]+$/;

type MockState = 'authorized' | 'captured' | 'voided' | 'refunded';

// Outcome by the card's last 4 digits (common provider test cards):
// 0002 card_declined, 9995 insufficient_funds, 0119 processing error, anything else succeeds.
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private byKey = new Map<string, AuthorizeResult>();
  private payments = new Map<string, MockState>();
  private counter = 0;

  async authorize(req: AuthorizeRequest): Promise<AuthorizeResult> {
    const previous = this.byKey.get(req.idempotencyKey);
    if (previous) return previous;

    const result = this.decide(req);
    this.byKey.set(req.idempotencyKey, result);
    return result;
  }

  async capture(providerPaymentId: string): Promise<AuthorizeResult> {
    if (this.payments.get(providerPaymentId) !== 'authorized') {
      return { status: 'error', providerPaymentId };
    }
    this.payments.set(providerPaymentId, 'captured');
    return { status: 'captured', providerPaymentId };
  }

  async void(providerPaymentId: string): Promise<void> {
    this.payments.set(providerPaymentId, 'voided');
  }

  async refund(providerPaymentId: string): Promise<void> {
    this.payments.set(providerPaymentId, 'refunded');
  }

  chargeCount(): number {
    return this.payments.size;
  }

  statusOf(providerPaymentId: string): MockState | undefined {
    return this.payments.get(providerPaymentId);
  }

  reset(): void {
    this.byKey.clear();
    this.payments.clear();
  }

  private decide(req: AuthorizeRequest): AuthorizeResult {
    const match = TOKEN_RE.exec(req.paymentToken);
    if (!match) return { status: 'declined', declineCode: 'invalid_token' };

    const [, brand, last4] = match;
    if (last4 === '0002') return { status: 'declined', declineCode: 'card_declined' };
    if (last4 === '9995') return { status: 'declined', declineCode: 'insufficient_funds' };
    if (last4 === '0119') return { status: 'error' };

    const providerPaymentId = `mock_pay_${++this.counter}`;
    const status = req.capture ? 'captured' : 'authorized';
    this.payments.set(providerPaymentId, status);
    return { status, providerPaymentId, paymentMethod: { brand, last4 } };
  }
}
