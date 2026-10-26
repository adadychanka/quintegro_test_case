import { describe, expect, it } from 'vitest';
import { MockAddressProvider } from '../../src/providers/address/MockAddressProvider';
import { Address } from '../../src/domain/address';

const provider = new MockAddressProvider();

const typed: Address = {
  fullName: 'John Doe',
  line1: '1 main street',
  city: 'austin',
  state: 'TX',
  zip: '78701',
  country: 'US',
};

describe('MockAddressProvider.suggest', () => {
  it('returns at most 5 matches, case-insensitive', async () => {
    const all = await provider.suggest('St');
    expect(all.length).toBeLessThanOrEqual(5);
    expect(all.length).toBeGreaterThan(0);
    const one = await provider.suggest('pennsylvania');
    expect(one).toHaveLength(1);
    expect(one[0].address).toMatchObject({ city: 'WASHINGTON', state: 'DC', country: 'US' });
    expect(one[0].label).toContain('1600 PENNSYLVANIA AVE NW');
  });

  it('returns nothing for an unknown query', async () => {
    expect(await provider.suggest('zzzzzz')).toEqual([]);
  });

  it('suggestions validate as verified', async () => {
    const [s] = await provider.suggest('congress');
    expect((await provider.validate({ ...s.address, fullName: 'John Doe' })).verdict).toBe('verified');
  });
});

describe('MockAddressProvider.validate', () => {
  it('corrects a hand-typed address USPS style', async () => {
    const r = await provider.validate(typed);
    expect(r.verdict).toBe('corrected');
    expect(r.suggested).toMatchObject({ line1: '1 MAIN ST', city: 'AUSTIN', zip: '78701-0001', fullName: 'John Doe' });
  });

  it('treats case and ZIP+4 only differences as verified', async () => {
    const r = await provider.validate({ ...typed, line1: '1 Main St', city: 'Austin' });
    expect(r.verdict).toBe('verified');
    expect(r.suggested?.zip).toBe('78701-0001');
  });

  it('marks ZIP 00000 as undeliverable', async () => {
    expect((await provider.validate({ ...typed, zip: '00000' })).verdict).toBe('undeliverable');
  });

  it('never resolves for TIMEOUT addresses', async () => {
    const result = await Promise.race([
      provider.validate({ ...typed, line1: '1 TIMEOUT RD' }).then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('pending'), 50)),
    ]);
    expect(result).toBe('pending');
  });
});
