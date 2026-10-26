import type { Order, OrderItem, Pricing } from '@/types/order'

type WithTypename<T> = T & { __typename: string }

export function item(id: string, title: string, amount: number, price: number): WithTypename<OrderItem> {
  return {
    __typename: 'OrderItem',
    amount,
    price,
    product: { __typename: 'Product', id, title, description: `${title} description`, image: `/productImg/${id}.svg` } as never,
  }
}

export function pricing(overrides: Partial<Pricing> = {}): WithTypename<Pricing> {
  return {
    __typename: 'Pricing',
    subtotalCents: 149998,
    discountCents: 15000,
    taxCents: 9787,
    shippingCents: 0,
    totalCents: 144785,
    currency: 'USD',
    promoCode: 'SAVE10',
    promoPercent: 10,
    taxStatus: 'calculated',
    ...overrides,
  }
}

// Matches ORDER_FIELDS in src/graphql/cart.ts: every field present.
export function order(overrides: Partial<Order> = {}): WithTypename<Order> {
  const products = overrides.products ?? [item('product-2', 'Smartphone', 1, 899.99), item('product-4', 'Tablet', 1, 599.99)]
  return {
    __typename: 'Order',
    orderId: 'order-2',
    status: 'created',
    createAt: 1700000000000,
    itemCount: products.reduce((n, p) => n + p.amount, 0),
    subtotalCents: Math.round(products.reduce((n, p) => n + p.amount * p.price * 100, 0)),
    promo: null,
    shippingAddress: null,
    billingAddress: null,
    addressVerification: null,
    pricing: null,
    paymentMethod: null,
    checkedOutAt: null,
    ...overrides,
    products,
  }
}

export function address(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'Address',
    fullName: 'John Doe',
    phone: '+15551234567',
    line1: '1 MARKET ST',
    line2: null,
    city: 'SAN FRANCISCO',
    state: 'CA',
    zip: '94105-0001',
    country: 'US',
    ...overrides,
  }
}

export function placedOrder(overrides: Partial<Order> = {}) {
  return order({
    status: 'submited',
    promo: { __typename: 'Promo', id: 'SAVE10', discount: 10, dueDate: 1800000000000 } as never,
    shippingAddress: address() as never,
    billingAddress: address() as never,
    addressVerification: 'verified',
    pricing: pricing(),
    paymentMethod: { __typename: 'PaymentMethodSummary', brand: 'visa', last4: '4242' } as never,
    checkedOutAt: 1700000100000,
    ...overrides,
  })
}

export function gqlError(code: string, message = 'error', extensions: Record<string, unknown> = {}) {
  return { message, extensions: { code, ...extensions } }
}
