import { TaxProvider, TaxRequest, TaxResult } from './TaxProvider';
import { taxFromTable } from './stateRates';

export class MockTaxProvider implements TaxProvider {
  async calculate(req: TaxRequest): Promise<TaxResult> {
    return taxFromTable(req.taxableCents, req.address.state);
  }
}
