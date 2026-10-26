import { US_STATE_CODES, UsStateCode } from '../../domain/address';
import { TaxResult } from './TaxProvider';

// Flat mock rates in basis points (1 bps = 0.01%). Also the fallback when the provider fails (spec Q2).
const DEFAULT_BPS = 500;
const OVERRIDES: Partial<Record<UsStateCode, number>> = {
  DE: 0,
  MT: 0,
  NH: 0,
  OR: 0,
  CA: 725,
  NY: 400,
  TX: 625,
  FL: 600,
  WA: 650,
};

export const STATE_TAX_RATE_BPS: Record<UsStateCode, number> = Object.fromEntries(
  US_STATE_CODES.map((s) => [s, OVERRIDES[s] ?? DEFAULT_BPS])
) as Record<UsStateCode, number>;

export function taxFromTable(taxableCents: number, state: UsStateCode): TaxResult {
  const rateBps = STATE_TAX_RATE_BPS[state];
  // Half-up, once per order.
  const taxCents = Math.floor((taxableCents * rateBps + 5000) / 10000);
  return { taxCents, rateBps };
}
