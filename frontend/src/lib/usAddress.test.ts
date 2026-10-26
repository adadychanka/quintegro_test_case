import { describe, expect, it } from 'vitest'
import { US_STATES, emptyAddress, formatPhoneDisplay, isAddressComplete, normalizeAddress, validateAddressFields } from './usAddress'

const valid = { fullName: 'John Doe', phone: '', line1: '1 Main St', line2: '', city: 'Austin', state: 'TX', zip: '78701' }

describe('usAddress', () => {
  it('lists 50 states and DC sorted by name', () => {
    expect(US_STATES).toHaveLength(51)
    expect(US_STATES[0]).toEqual({ code: 'AL', name: 'Alabama' })
    expect(US_STATES.map((s) => s.code)).toContain('DC')
  })

  it('uses the same messages as the backend', () => {
    expect(validateAddressFields({ ...emptyAddress() })).toEqual({
      fullName: "Enter the recipient's full name.",
      line1: 'Enter a street address.',
      city: 'Enter a city.',
      state: 'Select a state.',
      zip: 'Enter a 5-digit ZIP code.',
    })
    expect(validateAddressFields({ ...valid, line1: 'x'.repeat(36) })).toEqual({ line1: 'Use 35 characters or fewer.' })
    expect(validateAddressFields({ ...valid, phone: '123' })).toEqual({ phone: 'Enter a 10-digit US phone number.' })
  })

  it('accepts a valid address with optional phone empty', () => {
    expect(validateAddressFields(valid)).toEqual({})
  })

  it('normalizes pasted values', () => {
    expect(normalizeAddress({ ...valid, state: 'tx', zip: ' 78701 ', phone: '+1 (555) 123-4567' })).toMatchObject({
      state: 'TX',
      zip: '78701',
      phone: '+15551234567',
    })
  })

  it('formats phone for display', () => {
    expect(formatPhoneDisplay('+15551234567')).toBe('(555) 123-4567')
  })

  it('knows when an address is complete enough to price', () => {
    expect(isAddressComplete(valid)).toBe(true)
    expect(isAddressComplete({ ...valid, zip: '787' })).toBe(false)
  })
})
