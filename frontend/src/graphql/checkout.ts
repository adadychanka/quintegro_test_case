import { gql } from '@apollo/client'
import { ORDER_FIELDS } from './cart'

const ADDRESS_FIELDS = 'fullName phone line1 line2 city state zip country'
export const PRICING_FIELDS = 'subtotalCents discountCents taxCents shippingCents totalCents currency promoCode promoPercent taxStatus'

export const CHECKOUT_QUOTE = gql`
  query CheckoutQuote($promoCode: String, $shippingAddress: AddressInput) {
    checkoutQuote(promoCode: $promoCode, shippingAddress: $shippingAddress) { ${PRICING_FIELDS} }
  }
`

// Operation name `AddressSuggestions` skips the backend's artificial delay and error injection.
export const ADDRESS_SUGGESTIONS = gql`
  query AddressSuggestions($query: String!) {
    addressSuggestions(query: $query) {
      id
      label
      address { ${ADDRESS_FIELDS} }
    }
  }
`

export const VALIDATE_ADDRESS = gql`
  query ValidateAddress($address: AddressInput!) {
    validateAddress(address: $address) {
      verdict
      suggested { ${ADDRESS_FIELDS} }
    }
  }
`

export const CHECKOUT = gql`
  mutation Checkout($input: CheckoutInput!) {
    checkout(input: $input) { ${ORDER_FIELDS} }
  }
`
