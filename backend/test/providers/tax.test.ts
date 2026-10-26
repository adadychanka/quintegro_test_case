import { describe, expect, it } from 'vitest';
import { MockTaxProvider } from '../../src/providers/tax/MockTaxProvider';
import { taxFromTable } from '../../src/providers/tax/stateRates';
import { Address } from '../../src/domain/address';

const at = (state: Address['state']): Address => ({ fullName: 'A', line1: '1 A ST', city: 'X', state, zip: '12345', country: 'US' });

describe('MockTaxProvider', () => {
  const provider = new MockTaxProvider();

  it('charges no tax in DE, MT, NH, OR', async () => {
    for (const s of ['DE', 'MT', 'NH', 'OR'] as const) {
      expect(await provider.calculate({ taxableCents: 10000, address: at(s) })).toEqual({ taxCents: 0, rateBps: 0 });
    }
  });

  it('uses state rates with half-up rounding', async () => {
    expect(await provider.calculate({ taxableCents: 10000, address: at('CA') })).toEqual({ taxCents: 725, rateBps: 725 });
    expect(await provider.calculate({ taxableCents: 134998, address: at('CA') })).toEqual({ taxCents: 9787, rateBps: 725 });
    expect(await provider.calculate({ taxableCents: 10000, address: at('NV') })).toEqual({ taxCents: 500, rateBps: 500 });
  });

  it('table helper matches provider', () => {
    expect(taxFromTable(134998, 'CA')).toEqual({ taxCents: 9787, rateBps: 725 });
  });
});
