import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from '../../src/providers/payment/MockPaymentProvider';
import { AuthorizeRequest } from '../../src/providers/payment/PaymentProvider';

const base: AuthorizeRequest = {
  amountCents: 144785,
  currency: 'USD',
  paymentToken: 'mock_tok_visa_4242_abc123',
  orderId: 'order-2',
  billingAddress: { fullName: 'A', line1: '1 A ST', city: 'X', state: 'CA', zip: '94105', country: 'US' },
  idempotencyKey: 'k1',
  capture: true,
};

describe('MockPaymentProvider', () => {
  it('captures a 4242 card', async () => {
    const p = new MockPaymentProvider();
    const r = await p.authorize(base);
    expect(r.status).toBe('captured');
    expect(r.providerPaymentId).toMatch(/^mock_pay_\d+$/);
    expect(r.paymentMethod).toEqual({ brand: 'visa', last4: '4242' });
  });

  it('only authorizes when capture is false', async () => {
    const r = await new MockPaymentProvider().authorize({ ...base, capture: false });
    expect(r.status).toBe('authorized');
  });

  it.each([
    ['0002', 'card_declined'],
    ['9995', 'insufficient_funds'],
  ])('declines last4 %s with %s', async (last4, code) => {
    const r = await new MockPaymentProvider().authorize({ ...base, paymentToken: `mock_tok_visa_${last4}_x1` });
    expect(r).toMatchObject({ status: 'declined', declineCode: code });
  });

  it('returns error for 0119', async () => {
    const r = await new MockPaymentProvider().authorize({ ...base, paymentToken: 'mock_tok_visa_0119_x1' });
    expect(r.status).toBe('error');
  });

  it('declines malformed tokens', async () => {
    const r = await new MockPaymentProvider().authorize({ ...base, paymentToken: '4242424242424242' });
    expect(r).toMatchObject({ status: 'declined', declineCode: 'invalid_token' });
  });

  it('is idempotent by key', async () => {
    const p = new MockPaymentProvider();
    const a = await p.authorize(base);
    const b = await p.authorize(base);
    expect(b.providerPaymentId).toBe(a.providerPaymentId);
    expect(p.chargeCount()).toBe(1);
  });

  it('voids a payment', async () => {
    const p = new MockPaymentProvider();
    const a = await p.authorize(base);
    await p.void(a.providerPaymentId!);
    expect(p.statusOf(a.providerPaymentId!)).toBe('voided');
  });
});
