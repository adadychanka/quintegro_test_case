import { Address } from '../../domain/address';

export interface TaxRequest {
  taxableCents: number;
  address: Address;
}

export interface TaxResult {
  taxCents: number;
  rateBps: number;
}

// US sales tax by delivery address (spec D6). Real candidates: Avalara, TaxJar, Stripe Tax.
export interface TaxProvider {
  calculate(req: TaxRequest): Promise<TaxResult>;
}
