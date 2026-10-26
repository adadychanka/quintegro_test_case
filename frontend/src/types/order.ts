// Shared client types; mirror the GraphQL schema (backend/src/graphql/schema.ts).

export interface Product {
  id: string
  title: string
  description: string
  image: string
}

export interface OrderItem {
  product: Product
  amount: number
  // Dollars (kept for API compatibility).
  price: number
}

export type OrderStatus = 'created' | 'submited' | 'finished'

export interface Address {
  fullName: string
  phone?: string | null
  line1: string
  line2?: string | null
  city: string
  state: string
  zip: string
  country?: string
}

export type TaxStatus = 'calculated' | 'estimated' | 'pending'

// All amounts in integer cents.
export interface Pricing {
  subtotalCents: number
  discountCents: number
  taxCents: number
  shippingCents: number
  totalCents: number
  currency: string
  promoCode?: string | null
  promoPercent?: number | null
  taxStatus: TaxStatus
}

export interface PaymentMethodSummary {
  brand: string
  last4: string
}

export type AddressVerification = 'verified' | 'corrected' | 'unverified' | 'user_override'

export interface Order {
  orderId: string
  status: OrderStatus
  createAt: number
  itemCount: number
  subtotalCents: number
  products: OrderItem[]
  promo?: { id: string; discount: number; dueDate: number } | null
  shippingAddress?: Address | null
  billingAddress?: Address | null
  addressVerification?: AddressVerification | null
  pricing?: Pricing | null
  paymentMethod?: PaymentMethodSummary | null
  checkedOutAt?: number | null
}

export interface AddressSuggestion {
  id: string
  label: string
  address: Address
}

export type AddressVerdict = 'verified' | 'corrected' | 'undeliverable' | 'unavailable'
