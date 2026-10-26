import { describe, expect, it } from 'vitest';
import { createTestApp, gql, login } from '../helpers/app';

const address = { fullName: 'John Doe', line1: '1 main street', city: 'San Francisco', state: 'ca', zip: '94105' };

describe('quote and address queries', () => {
  it('checkoutQuote prices the caller cart', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(
      app,
      'query CheckoutQuote($a: AddressInput, $p: String) { checkoutQuote(shippingAddress: $a, promoCode: $p) { subtotalCents discountCents taxCents totalCents taxStatus promoCode promoPercent } }',
      { a: address, p: 'save10' },
      token
    );
    expect(res.body.data.checkoutQuote).toEqual({
      subtotalCents: 149998,
      discountCents: 15000,
      taxCents: 9787,
      totalCents: 144785,
      taxStatus: 'calculated',
      promoCode: 'SAVE10',
      promoPercent: 10,
    });
  });

  it('checkoutQuote treats an incomplete address as no address', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(
      app,
      'query ($a: AddressInput) { checkoutQuote(shippingAddress: $a) { taxStatus totalCents } }',
      { a: { ...address, zip: '94' } },
      token
    );
    expect(res.body.data.checkoutQuote).toEqual({ taxStatus: 'pending', totalCents: 149998 });
  });

  it('checkoutQuote reports PROMO_EXPIRED', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, '{ checkoutQuote(promoCode: "SAVE5") { totalCents } }', {}, token);
    expect(res.body.errors[0].extensions.code).toBe('PROMO_EXPIRED');
  });

  it('addressSuggestions returns [] under 3 characters', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, '{ addressSuggestions(query: "ab") { id } }', {}, token);
    expect(res.body.data.addressSuggestions).toEqual([]);
  });

  it('addressSuggestions returns suggestions', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, '{ addressSuggestions(query: "congress") { label address { line1 city state zip } } }', {}, token);
    expect(res.body.data.addressSuggestions[0].address).toEqual({ line1: '600 CONGRESS AVE', city: 'AUSTIN', state: 'TX', zip: '78701-3234' });
  });

  it('addressSuggestions requires auth and is rate-limited', async () => {
    const { app } = await createTestApp();
    const anon = await gql(app, '{ addressSuggestions(query: "congress") { id } }');
    expect(anon.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');

    const token = await login(app);
    let last: any;
    for (let i = 0; i < 31; i++) {
      last = await gql(app, '{ addressSuggestions(query: "congress") { id } }', {}, token);
    }
    expect(last.body.errors[0].extensions.code).toBe('RATE_LIMITED');
  });

  it('validateAddress returns corrected with a suggestion', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(
      app,
      'query ($a: AddressInput!) { validateAddress(address: $a) { verdict suggested { line1 zip } } }',
      { a: address },
      token
    );
    expect(res.body.data.validateAddress).toEqual({ verdict: 'corrected', suggested: { line1: '1 MAIN ST', zip: '94105-0001' } });
  });

  it('validateAddress reports field errors', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const res = await gql(app, 'query ($a: AddressInput!) { validateAddress(address: $a) { verdict } }', { a: { ...address, zip: '123' } }, token);
    expect(res.body.errors[0].extensions).toMatchObject({
      code: 'ADDRESS_INVALID',
      fieldErrors: [{ field: 'zip', message: 'Enter a 5-digit ZIP code.' }],
    });
  });

  it('validateAddress fails open on provider timeout', async () => {
    const { app } = await createTestApp();
    const token = await login(app);
    const started = Date.now();
    const res = await gql(
      app,
      'query ($a: AddressInput!) { validateAddress(address: $a) { verdict suggested { line1 } } }',
      { a: { ...address, line1: '1 TIMEOUT RD' } },
      token
    );
    expect(res.body.data.validateAddress).toEqual({ verdict: 'unavailable', suggested: null });
    expect(Date.now() - started).toBeLessThan(2500);
  });
});
