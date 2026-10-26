import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type Product {
    id: ID!
    title: String!
    description: String!
    image: String!
  }

  type OrderItem {
    product: Product!
    amount: Int!
    price: Float!
  }

  type Promo {
    id: ID!
    discount: Int!
    dueDate: Float!
  }

  type Order {
    orderId: ID!
    status: OrderStatus!
    createAt: Float!
    "Sum of item amounts."
    itemCount: Int!
    subtotalCents: Int!
    products: [OrderItem!]!
    promo: Promo
    shippingAddress: Address
    billingAddress: Address
    addressVerification: AddressVerification
    pricing: Pricing
    paymentMethod: PaymentMethodSummary
    checkedOutAt: Float
  }

  enum AddressVerification {
    verified
    corrected
    unverified
    user_override
  }

  type PaymentMethodSummary {
    brand: String!
    last4: String!
  }

  enum AddressChoice {
    suggested
    entered
  }

  input CheckoutInput {
    "UUID for one checkout attempt; reused on retries of the same attempt."
    idempotencyKey: ID!
    orderId: ID!
    shippingAddress: AddressInput!
    addressChoice: AddressChoice!
    billingSameAsShipping: Boolean!
    billingAddress: AddressInput
    "Opaque token from the payment provider's frontend component. Never card data."
    paymentToken: String!
    promoCode: String
    expectedTotalCents: Int!
  }

  enum OrderStatus {
    created
    submited
    finished
  }

  input ProductInput {
    id: ID!
    amount: Int!
    price: Float!
  }

  type Address {
    fullName: String!
    phone: String
    line1: String!
    line2: String
    city: String!
    state: String!
    zip: String!
    country: String!
  }

  input AddressInput {
    fullName: String!
    phone: String
    line1: String!
    line2: String
    city: String!
    state: String!
    zip: String!
  }

  enum TaxStatus {
    calculated
    estimated
    pending
  }

  "All amounts in integer cents, USD."
  type Pricing {
    subtotalCents: Int!
    discountCents: Int!
    taxCents: Int!
    shippingCents: Int!
    totalCents: Int!
    currency: String!
    promoCode: String
    promoPercent: Int
    taxStatus: TaxStatus!
  }

  type AddressSuggestion {
    id: ID!
    label: String!
    address: Address!
  }

  enum AddressVerdict {
    verified
    corrected
    undeliverable
    unavailable
  }

  type AddressValidation {
    verdict: AddressVerdict!
    suggested: Address
  }

  input LoginInput {
    login: String!
    password: String!
  }

  type LoginResponse {
    token: String!
  }

  type Query {
    orders: [Order!]!
    order(orderId: ID!): Order
    "The user's cart (order in status created). Created empty on first access."
    cart: Order!
    orderSum(orderId: ID!, products: [ProductInput!], promo: String): Float! @deprecated(reason: "Use checkoutQuote. Client prices are ignored.")
    promo(promoId: ID!): Promo
    "Stateless price preview for the caller's cart. Stores nothing."
    checkoutQuote(promoCode: String, shippingAddress: AddressInput): Pricing!
    addressSuggestions(query: String!): [AddressSuggestion!]!
    validateAddress(address: AddressInput!): AddressValidation!
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!): Boolean! @deprecated(reason: "Use checkout. Always returns USE_CHECKOUT.")
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order!
    updateItemAmount(orderId: ID!, productId: ID!, amount: Int!): Order!
    "Places the order: address, tax and payment in one idempotent call."
    checkout(input: CheckoutInput!): Order!
  }
`;
