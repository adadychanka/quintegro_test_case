import { Address, UsStateCode } from '../../domain/address';
import { AddressProvider, AddressSuggestion, AddressValidationResult } from './AddressProvider';

const KNOWN: Array<Omit<Address, 'fullName' | 'country'>> = [
  { line1: '1600 PENNSYLVANIA AVE NW', city: 'WASHINGTON', state: 'DC', zip: '20500-0003' },
  { line1: '350 5TH AVE', city: 'NEW YORK', state: 'NY', zip: '10118-0110' },
  { line1: '1 APPLE PARK WAY', city: 'CUPERTINO', state: 'CA', zip: '95014-0642' },
  { line1: '233 S WACKER DR', city: 'CHICAGO', state: 'IL', zip: '60606-6306' },
  { line1: '600 CONGRESS AVE', city: 'AUSTIN', state: 'TX', zip: '78701-3234' },
  { line1: '1000 N WEST ST', city: 'WILMINGTON', state: 'DE', zip: '19801-1058' },
  { line1: 'PO BOX 1234', city: 'PORTLAND', state: 'OR', zip: '97208-1234' },
  { line1: '400 BROAD ST', city: 'SEATTLE', state: 'WA', zip: '98109-4607' },
];

const WORDS: Record<string, string> = {
  STREET: 'ST',
  AVENUE: 'AVE',
  ROAD: 'RD',
  BOULEVARD: 'BLVD',
  APARTMENT: 'APT',
  SUITE: 'STE',
};

function standardizeLine(value: string): string {
  return value
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join(' ');
}

function zip5(zip: string): string {
  return zip.slice(0, 5);
}

function sameIgnoringCase(a: Address, b: Address): boolean {
  const eq = (x?: string, y?: string) => (x ?? '').toUpperCase() === (y ?? '').toUpperCase();
  return eq(a.line1, b.line1) && eq(a.line2, b.line2) && eq(a.city, b.city) && a.state === b.state && zip5(a.zip) === zip5(b.zip);
}

// Mimics USPS standardization so a real provider fits the same contract (spec D5.4).
// Test hooks: ZIP `00000` → undeliverable; line 1 containing `TIMEOUT` → never resolves.
export class MockAddressProvider implements AddressProvider {
  async suggest(query: string): Promise<AddressSuggestion[]> {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return KNOWN.filter((a) => `${a.line1} ${a.city} ${a.state} ${a.zip}`.includes(q))
      .slice(0, 5)
      .map((a, i) => ({
        id: `mock-${i}-${a.zip}`,
        label: `${a.line1}, ${a.city}, ${a.state} ${a.zip}`,
        address: { fullName: '', ...a, state: a.state as UsStateCode, country: 'US' },
      }));
  }

  async validate(address: Address): Promise<AddressValidationResult> {
    if (address.line1.toUpperCase().includes('TIMEOUT')) {
      return new Promise<AddressValidationResult>(() => undefined);
    }
    if (zip5(address.zip) === '00000') {
      return { verdict: 'undeliverable' };
    }

    const suggested: Address = {
      ...address,
      line1: standardizeLine(address.line1),
      city: address.city.toUpperCase(),
      zip: address.zip.length === 5 ? `${address.zip}-0001` : address.zip,
    };
    if (address.line2) suggested.line2 = standardizeLine(address.line2);

    // Case and ZIP+4 differences alone are not worth asking the user about.
    return { verdict: sameIgnoringCase(address, suggested) ? 'verified' : 'corrected', suggested };
  }
}
