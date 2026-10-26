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
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse!
    submitOrder(orderId: ID!): Boolean! @deprecated(reason: "Use checkout. Always returns USE_CHECKOUT.")
    deleteProductFromOrder(orderId: ID!, productId: ID!): Order!
    updateItemAmount(orderId: ID!, productId: ID!, amount: Int!): Order!
  }
`;
