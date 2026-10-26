import { OrderRecord } from '../types/entities';
import { IPromoRepository } from '../repositories/interfaces';
import { Address } from '../domain/address';
import { AppError } from '../domain/errors';
import { percentOfCents } from '../domain/money';
import { TaxProvider } from '../providers/tax/TaxProvider';
import { taxFromTable } from '../providers/tax/stateRates';

export type TaxStatus = 'calculated' | 'estimated' | 'pending';

export interface Pricing {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: 0;
  totalCents: number;
  currency: 'USD';
  promoCode?: string;
  promoPercent?: number;
  taxStatus: TaxStatus;
}

// Server-side pricing (spec §4). All amounts in integer cents.
export class PricingService {
  constructor(
    private promoRepository: IPromoRepository,
    private taxProvider: TaxProvider,
    private now: () => number = Date.now
  ) {}

  async quote(order: OrderRecord, opts: { promoCode?: string; address?: Address }): Promise<Pricing> {
    const subtotalCents = order.products.reduce((sum, line) => sum + line.amount * line.priceCents, 0);

    const promo = this.resolvePromo(opts.promoCode);
    const discountCents = promo ? percentOfCents(subtotalCents, promo.discount) : 0;
    const taxableCents = subtotalCents - discountCents;

    let taxCents = 0;
    let taxStatus: TaxStatus = 'pending';
    if (opts.address) {
      try {
        taxCents = (await this.taxProvider.calculate({ taxableCents, address: opts.address })).taxCents;
        taxStatus = 'calculated';
      } catch {
        // Spec Q2: never block checkout on the tax provider; use the table rate and flag it.
        taxCents = taxFromTable(taxableCents, opts.address.state).taxCents;
        taxStatus = 'estimated';
      }
    }

    const pricing: Pricing = {
      subtotalCents,
      discountCents,
      taxCents,
      shippingCents: 0,
      totalCents: taxableCents + taxCents,
      currency: 'USD',
      taxStatus,
    };
    if (promo) {
      pricing.promoCode = promo.id;
      pricing.promoPercent = promo.discount;
    }
    return pricing;
  }

  private resolvePromo(raw?: string) {
    const code = raw?.trim().toUpperCase();
    if (!code) return undefined;
    const promo = this.promoRepository.findById(code);
    if (!promo) throw new AppError('PROMO_INVALID', "This promo code doesn't exist.");
    if (this.now() > promo.dueDate) throw new AppError('PROMO_EXPIRED', 'This promo code has expired.');
    return promo;
  }
}
