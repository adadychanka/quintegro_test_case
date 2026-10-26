import { Address } from '../../domain/address';

export type PaymentStatus = 'authorized' | 'captured' | 'declined' | 'requires_action' | 'error';

export interface AuthorizeRequest {
  amountCents: number;
  currency: 'USD';
  // Opaque token from the provider's frontend component. Card data never reaches the backend.
  paymentToken: string;
  orderId: string;
  billingAddress: Address;
  // Passed to the provider so a retried request never charges twice.
  idempotencyKey: string;
  // true: authorize and capture in one call; false: authorize only (capture later).
  capture: boolean;
}

export interface AuthorizeResult {
  status: PaymentStatus;
  providerPaymentId?: string;
  declineCode?: string;
  paymentMethod?: { brand: string; last4: string };
  // Reserved for 3-D Secure or redirect flows (PayPal). The mock never returns it.
  nextAction?: { type: 'redirect' | 'client_challenge'; url?: string; data?: string };
}

// Provider-agnostic payment interface (spec D1): fits Stripe, Adyen, Braintree, PayPal.
export interface PaymentProvider {
  readonly name: string;
  authorize(req: AuthorizeRequest): Promise<AuthorizeResult>;
  capture(providerPaymentId: string, amountCents: number): Promise<AuthorizeResult>;
  void(providerPaymentId: string): Promise<void>;
  refund(providerPaymentId: string, amountCents: number): Promise<void>;
}
