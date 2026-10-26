// Stands in for a payment provider's frontend component (Stripe Elements, Braintree Drop-in, ...).
// Card data stays in the browser; only an opaque token goes to the backend.

export interface CardForm {
  number: string
  expiry: string
  cvc: string
}

export type CardField = keyof CardForm

export const CARD_MESSAGES = {
  number: 'Enter a valid card number.',
  expiry: 'Enter a valid expiration date.',
  cvc: 'Enter the 3-digit security code.',
} as const

export function emptyCard(): CardForm {
  return { number: '', expiry: '', cvc: '' }
}

const digitsOf = (s: string) => s.replace(/\D/g, '')

function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function validateCard(card: CardForm, now: Date = new Date()): Partial<Record<CardField, string>> {
  const e: Partial<Record<CardField, string>> = {}
  const number = digitsOf(card.number)
  if (number.length < 13 || number.length > 19 || !luhn(number)) e.number = CARD_MESSAGES.number

  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim())
  const month = m ? Number(m[1]) : 0
  const year = m ? 2000 + Number(m[2]) : 0
  const thisMonth = now.getUTCFullYear() * 12 + now.getUTCMonth()
  if (!m || month < 1 || month > 12 || year * 12 + (month - 1) < thisMonth) e.expiry = CARD_MESSAGES.expiry

  if (!/^\d{3}$/.test(card.cvc.trim())) e.cvc = CARD_MESSAGES.cvc
  return e
}

function brandOf(number: string): string {
  switch (number[0]) {
    case '4':
      return 'visa'
    case '5':
      return 'mastercard'
    case '3':
      return 'amex'
    default:
      return 'card'
  }
}

export function tokenizeCard(card: CardForm): { token: string; brand: string; last4: string } {
  const number = digitsOf(card.number)
  const brand = brandOf(number)
  const last4 = number.slice(-4)
  const nonce = Math.random().toString(36).slice(2, 12).replace(/[^a-z0-9]/g, '') || 'x'
  return { token: `mock_tok_${brand}_${last4}_${nonce}`, brand, last4 }
}

// "4242424242424242" → "4242 4242 4242 4242" while typing.
export function formatCardNumber(value: string): string {
  return digitsOf(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function brandLabel(brand: string): string {
  const labels: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }
  return labels[brand] ?? 'Card'
}
