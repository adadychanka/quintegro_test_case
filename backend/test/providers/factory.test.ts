import { describe, expect, it } from 'vitest';
import { createProviders } from '../../src/providers';

describe('createProviders', () => {
  it('builds mocks by default', () => {
    const p = createProviders({});
    expect(p.payment.name).toBe('mock');
  });

  it('throws on an unknown provider', () => {
    expect(() => createProviders({ PAYMENT_PROVIDER: 'stripe' })).toThrow('Unknown PAYMENT_PROVIDER: stripe');
  });
});
