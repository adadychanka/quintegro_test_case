import { createContainer } from '../../src/container';
import { CheckoutInput } from '../../src/services/checkoutService';

export const caAddress = { fullName: 'John Doe', line1: '1 Market St', city: 'San Francisco', state: 'CA', zip: '94105' };

export function checkoutInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: 'key-1',
    orderId: 'order-2',
    shippingAddress: caAddress,
    addressChoice: 'entered',
    billingSameAsShipping: true,
    paymentToken: 'mock_tok_visa_4242_abc',
    promoCode: 'SAVE10',
    expectedTotalCents: 144785,
    ...overrides,
  };
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

export function containerWith(env: Record<string, string> = {}) {
  return createContainer({ FAULT_INJECTION: 'off', ...env });
}
