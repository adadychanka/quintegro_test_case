import { describe, expect, it } from 'vitest';
import { PricingService } from '../../src/services/pricingService';
import { InMemoryOrderRepository, InMemoryPromoRepository } from '../../src/repositories/implementations';
import { MockTaxProvider } from '../../src/providers/tax/MockTaxProvider';
import { TaxProvider } from '../../src/providers/tax/TaxProvider';
import { Address } from '../../src/domain/address';
import { FixedWindowRateLimiter } from '../../src/services/rateLimiter';

const ca: Address = { fullName: 'A', line1: '1 MARKET ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94105', country: 'US' };
const de: Address = { ...ca, state: 'DE', zip: '19801' };
const cart = () => new InMemoryOrderRepository().findById('order-2')!;

async function codeOf(p: Promise<unknown>) {
  try { await p; } catch (e: any) { return e.code; }
  return undefined;
}

describe('PricingService', () => {
  const pricing = new PricingService(new InMemoryPromoRepository(), new MockTaxProvider());

  it('subtotal from stored lines', async () => {
    expect((await pricing.quote(cart(), {})).subtotalCents).toBe(149998);
  });

  it('no address → taxStatus pending, tax 0', async () => {
    expect(await pricing.quote(cart(), {})).toEqual({
      subtotalCents: 149998,
      discountCents: 0,
      taxCents: 0,
      shippingCents: 0,
      totalCents: 149998,
      currency: 'USD',
      taxStatus: 'pending',
    });
  });

  it('SAVE10 in CA: discount, tax on discounted subtotal, total', async () => {
    expect(await pricing.quote(cart(), { promoCode: 'SAVE10', address: ca })).toEqual({
      subtotalCents: 149998,
      discountCents: 15000,
      taxCents: 9787,
      shippingCents: 0,
      totalCents: 144785,
      currency: 'USD',
      promoCode: 'SAVE10',
      promoPercent: 10,
      taxStatus: 'calculated',
    });
  });

  it('DE has no tax', async () => {
    expect((await pricing.quote(cart(), { address: de })).taxCents).toBe(0);
  });

  it('promo code is case-insensitive', async () => {
    expect((await pricing.quote(cart(), { promoCode: ' save10 ' })).promoCode).toBe('SAVE10');
  });

  it('expired and unknown promo codes', async () => {
    expect(await codeOf(pricing.quote(cart(), { promoCode: 'SAVE5' }))).toBe('PROMO_EXPIRED');
    expect(await codeOf(pricing.quote(cart(), { promoCode: 'NOPE' }))).toBe('PROMO_INVALID');
  });

  it('blank promo code is ignored', async () => {
    expect((await pricing.quote(cart(), { promoCode: '  ' })).discountCents).toBe(0);
  });

  it('tax provider failure → estimated', async () => {
    const failing: TaxProvider = { calculate: async () => { throw new Error('down'); } };
    const q = await new PricingService(new InMemoryPromoRepository(), failing).quote(cart(), { promoCode: 'SAVE10', address: ca });
    expect(q).toMatchObject({ taxCents: 9787, totalCents: 144785, taxStatus: 'estimated' });
  });
});

describe('FixedWindowRateLimiter', () => {
  it('allows 30, blocks 31st, resets after window', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(30, 60000, () => now);
    for (let i = 0; i < 30; i++) expect(limiter.hit('u1')).toBe(true);
    expect(limiter.hit('u1')).toBe(false);
    expect(limiter.hit('u2')).toBe(true);
    now = 60000;
    expect(limiter.hit('u1')).toBe(true);
  });
});
