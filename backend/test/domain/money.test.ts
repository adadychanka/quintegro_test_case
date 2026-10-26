import { describe, expect, it } from 'vitest';
import { formatUsd, percentOfCents, toCents } from '../../src/domain/money';

describe('money', () => {
  it('converts dollars to cents without float drift', () => {
    expect(toCents(1299.99)).toBe(129999);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('rounds percent half-up to the cent', () => {
    expect(percentOfCents(150001, 10)).toBe(15000);
    expect(percentOfCents(150005, 10)).toBe(15001);
    expect(percentOfCents(149998, 10)).toBe(15000);
  });

  it('formats cents as USD', () => {
    expect(formatUsd(123456)).toBe('$1,234.56');
    expect(formatUsd(0)).toBe('$0.00');
  });
});
