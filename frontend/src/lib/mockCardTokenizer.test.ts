import { describe, expect, it } from 'vitest'
import { tokenizeCard, validateCard } from './mockCardTokenizer'

const now = new Date('2026-10-26T00:00:00Z')

describe('mockCardTokenizer', () => {
  it('validates with Luhn, future expiry and 3-digit CVC', () => {
    expect(validateCard({ number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' }, now)).toEqual({})
    expect(validateCard({ number: '4242424242424241', expiry: '01/20', cvc: '12' }, now)).toEqual({
      number: 'Enter a valid card number.',
      expiry: 'Enter a valid expiration date.',
      cvc: 'Enter the 3-digit security code.',
    })
  })

  it('accepts the current month as not expired', () => {
    expect(validateCard({ number: '4242424242424242', expiry: '10/26', cvc: '123' }, now)).toEqual({})
  })

  it('produces a token without the card number', () => {
    const t = tokenizeCard({ number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' })
    expect(t.token).toMatch(/^mock_tok_visa_4242_[a-z0-9]+$/)
    expect(t.token).not.toContain('42424242')
    expect(t).toMatchObject({ brand: 'visa', last4: '4242' })
  })

  it('derives the brand from the first digit', () => {
    expect(tokenizeCard({ number: '5555555555554444', expiry: '12/30', cvc: '123' }).brand).toBe('mastercard')
  })
})
