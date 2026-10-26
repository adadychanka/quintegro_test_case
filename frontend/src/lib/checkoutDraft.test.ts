import { describe, expect, it, vi } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './checkoutDraft'
import { emptyAddress } from './usAddress'

describe('checkoutDraft', () => {
  it('round-trips the draft and drops card fields', () => {
    const draft = { shipping: { ...emptyAddress(), city: 'Austin' }, billingSameAsShipping: true, billing: emptyAddress(), promoCode: 'SAVE10' }
    saveDraft({ ...draft, card: { number: '4242424242424242' } } as never)
    const loaded = loadDraft()
    expect(loaded).toEqual(draft)
    expect(JSON.stringify(sessionStorage)).not.toContain('4242')
    clearDraft()
    expect(loadDraft()).toBeNull()
  })

  it('returns null when sessionStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadDraft()).toBeNull()
    spy.mockRestore()
  })
})
