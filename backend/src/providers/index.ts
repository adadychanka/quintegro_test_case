import { AddressProvider } from './address/AddressProvider';
import { MockAddressProvider } from './address/MockAddressProvider';
import { TaxProvider } from './tax/TaxProvider';
import { MockTaxProvider } from './tax/MockTaxProvider';
import { PaymentProvider } from './payment/PaymentProvider';
import { MockPaymentProvider } from './payment/MockPaymentProvider';

export interface Providers {
  address: AddressProvider;
  tax: TaxProvider;
  payment: PaymentProvider;
}

function pick<T>(name: string, value: string | undefined, options: Record<string, () => T>): T {
  const key = value ?? 'mock';
  const factory = options[key];
  if (!factory) throw new Error(`Unknown ${name}: ${key}`);
  return factory();
}

// Each provider is chosen by env config; services depend only on the interfaces.
export function createProviders(env: Record<string, string | undefined>): Providers {
  return {
    address: pick('ADDRESS_PROVIDER', env.ADDRESS_PROVIDER, { mock: () => new MockAddressProvider() }),
    tax: pick('TAX_PROVIDER', env.TAX_PROVIDER, { mock: () => new MockTaxProvider() }),
    payment: pick('PAYMENT_PROVIDER', env.PAYMENT_PROVIDER, { mock: () => new MockPaymentProvider() }),
  };
}
