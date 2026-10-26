import { Address } from '../domain/address';
import type { Pricing } from '../services/pricingService';
import type { PaymentStatus } from '../providers/payment/PaymentProvider';

export interface UserRecord {
  id: string;
  name: string;
}

export interface AuthRecord {
  userId: string;
  login: string;
  password: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createAt: number;
  products: OrderLine[];
  promo?: PromoEntity;
  // Checkout snapshot (spec §5): set once when the order is placed, never changed after.
  shippingAddress?: Address;
  billingAddress?: Address;
  addressVerification?: AddressVerification;
  pricing?: Pricing;
  paymentId?: string;
  paymentMethod?: PaymentMethodSummary;
  checkedOutAt?: number;
}

export type AddressVerification = 'verified' | 'corrected' | 'unverified' | 'user_override';

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  provider: string;
  providerPaymentId?: string;
  amountCents: number;
  currency: 'USD';
  status: PaymentStatus | 'voided';
  declineCode?: string;
  createdAt: number;
}

export interface OrderLine {
  id: string;
  amount: number;
  priceCents: number;
}

export type OrderStatus = 'created' | 'submited' | 'finished';

export interface OrderDTO {
  orderId: string;
  status: OrderStatus;
  createAt: number;
  itemCount: number;
  subtotalCents: number;
  products: Array<{
    product: ProductRecord;
    amount: number;
    // Dollars, kept for API compatibility (spec Q4).
    price: number;
  }>;
  promo?: PromoEntity;
  shippingAddress?: Address;
  billingAddress?: Address;
  addressVerification?: AddressVerification;
  pricing?: Pricing;
  paymentMethod?: PaymentMethodSummary;
  checkedOutAt?: number;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}
