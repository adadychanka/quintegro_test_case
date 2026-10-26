// Money is kept in integer cents. Rounding is half-up to the cent.

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function percentOfCents(cents: number, percent: number): number {
  // Integer math: cents * percent is exact; half-up on the /100 step.
  return Math.floor((cents * percent + 50) / 100);
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}
