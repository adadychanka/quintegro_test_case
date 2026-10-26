// UI copy for backend error codes (spec §8, plan UI State Matrix).
const MESSAGES: Record<string, string> = {
  PAYMENT_DECLINED: 'Your card was declined. Try another card.',
  PAYMENT_ERROR: 'Payment could not be processed. Try again.',
  PROMO_INVALID: "This promo code doesn't exist.",
  PROMO_EXPIRED: 'This promo code has expired.',
  PROMO_FAILED: "Couldn't apply the promo code. Try again.",
  NETWORK: "We couldn't reach the server. Try again — you won't be charged twice.",
  CART_EMPTY: 'Your cart has changed. Return to your orders to review it.',
  ORDER_NOT_EDITABLE: 'Your cart has changed. Return to your orders to review it.',
  ORDER_NOT_FOUND: 'Your cart has changed. Return to your orders to review it.',
  ADDRESS_INVALID: 'Please fix the highlighted fields.',
  CHECKOUT_IN_PROGRESS: 'Checkout in progress. Try again in a moment.',
}

export const GENERIC_ERROR = 'Something went wrong. Try again.'

export function messageFor(code: string | undefined): string {
  return (code && MESSAGES[code]) || GENERIC_ERROR
}
