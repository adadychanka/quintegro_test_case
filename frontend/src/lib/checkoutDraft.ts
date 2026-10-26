import { AddressForm } from './usAddress'

// Unsent checkout form data (spec Q5). Never contains card fields.
export interface CheckoutDraft {
  shipping: AddressForm
  billingSameAsShipping: boolean
  billing: AddressForm
  promoCode: string
}

const KEY = 'checkout:draft:v1'

export function loadDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null
  } catch {
    return null
  }
}

export function saveDraft(draft: CheckoutDraft): void {
  const { shipping, billingSameAsShipping, billing, promoCode } = draft
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ shipping, billingSameAsShipping, billing, promoCode }))
  } catch {
    // Storage blocked: the form still works, the draft is just not kept.
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
