import { Address } from '../../domain/address';

export interface AddressSuggestion {
  id: string;
  label: string;
  // `fullName` and `phone` are empty: suggestions fill address fields only.
  address: Address;
}

export type AddressVerdict = 'verified' | 'corrected' | 'undeliverable';

export interface AddressValidationResult {
  verdict: AddressVerdict;
  // Standardized address (USPS style) when the provider has one.
  suggested?: Address;
}

// External address autocomplete + verification (spec D5). Real candidates:
// USPS Addresses API, Smarty, Google Address Validation.
export interface AddressProvider {
  suggest(query: string): Promise<AddressSuggestion[]>;
  validate(address: Address): Promise<AddressValidationResult>;
}
