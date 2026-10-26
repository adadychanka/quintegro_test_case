import { gql } from '@apollo/client'

const ADDRESS_FIELDS = 'fullName phone line1 line2 city state zip country'

// Every query and mutation that returns an Order selects the same fields, so the
// Apollo cache keeps one consistent copy per orderId.
export const ORDER_FIELDS = `
  orderId
  status
  createAt
  itemCount
  subtotalCents
  products {
    amount
    price
    product { id title description image }
  }
  promo { id discount dueDate }
  shippingAddress { ${ADDRESS_FIELDS} }
  billingAddress { ${ADDRESS_FIELDS} }
  addressVerification
  pricing { subtotalCents discountCents taxCents shippingCents totalCents currency promoCode promoPercent taxStatus }
  paymentMethod { brand last4 }
  checkedOutAt
`

export const CART = gql`
  query Cart {
    cart { ${ORDER_FIELDS} }
  }
`

export const UPDATE_ITEM_AMOUNT = gql`
  mutation UpdateItemAmount($orderId: ID!, $productId: ID!, $amount: Int!) {
    updateItemAmount(orderId: $orderId, productId: $productId, amount: $amount) { ${ORDER_FIELDS} }
  }
`

export const DELETE_PRODUCT_FROM_ORDER = gql`
  mutation DeleteProductFromOrder($orderId: ID!, $productId: ID!) {
    deleteProductFromOrder(orderId: $orderId, productId: $productId) { ${ORDER_FIELDS} }
  }
`
