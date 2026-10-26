import { gql } from '@apollo/client';
import { ORDER_FIELDS } from './cart';

// Query to get all orders for the authenticated user
export const GET_ORDERS = gql`
  query GetOrders {
    orders { ${ORDER_FIELDS} }
  }
`;

// Query to get a specific order
export const GET_ORDER = gql`
  query GetOrder($orderId: ID!) {
    order(orderId: $orderId) { ${ORDER_FIELDS} }
  }
`;

// Query to validate promo code
export const GET_PROMO = gql`
  query GetPromo($promoId: ID!) {
    promo(promoId: $promoId) {
      id
      discount
      dueDate
    }
  }
`;
