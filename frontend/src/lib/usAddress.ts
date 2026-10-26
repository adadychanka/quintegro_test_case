// US-only address helpers. Rules and messages match backend/src/domain/address.ts.

export const US_STATES: { code: string; name: string }[] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

const STATE_CODES = new Set(US_STATES.map((s) => s.code))

// Form state: every field is a string ('' when empty).
export interface AddressForm {
  fullName: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
}

export type AddressField = keyof AddressForm

export const ADDRESS_FIELDS: AddressField[] = ['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'zip']

export const ADDRESS_MESSAGES = {
  fullName: "Enter the recipient's full name.",
  fullNameTooLong: 'Use 70 characters or fewer.',
  line1: 'Enter a street address.',
  tooLong: 'Use 35 characters or fewer.',
  city: 'Enter a city.',
  state: 'Select a state.',
  zip: 'Enter a 5-digit ZIP code.',
  phone: 'Enter a 10-digit US phone number.',
} as const

const ZIP_RE = /^\d{5}(-\d{4})?$/

export function emptyAddress(): AddressForm {
  return { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '' }
}

function clean(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ')
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw
}

export function normalizeAddress(a: AddressForm): AddressForm {
  const phone = clean(a.phone)
  return {
    fullName: clean(a.fullName),
    phone: phone ? normalizePhone(phone) : '',
    line1: clean(a.line1),
    line2: clean(a.line2),
    city: clean(a.city),
    state: clean(a.state).toUpperCase(),
    zip: clean(a.zip),
  }
}

export function validateAddressFields(input: AddressForm): Partial<Record<AddressField, string>> {
  const a = normalizeAddress(input)
  const e: Partial<Record<AddressField, string>> = {}
  if (!a.fullName) e.fullName = ADDRESS_MESSAGES.fullName
  else if (a.fullName.length > 70) e.fullName = ADDRESS_MESSAGES.fullNameTooLong
  if (a.phone && !/^\+1\d{10}$/.test(a.phone)) e.phone = ADDRESS_MESSAGES.phone
  if (!a.line1) e.line1 = ADDRESS_MESSAGES.line1
  else if (a.line1.length > 35) e.line1 = ADDRESS_MESSAGES.tooLong
  if (a.line2.length > 35) e.line2 = ADDRESS_MESSAGES.tooLong
  if (!a.city) e.city = ADDRESS_MESSAGES.city
  else if (a.city.length > 35) e.city = ADDRESS_MESSAGES.tooLong
  if (!STATE_CODES.has(a.state)) e.state = ADDRESS_MESSAGES.state
  if (!ZIP_RE.test(a.zip)) e.zip = ADDRESS_MESSAGES.zip
  return e
}

export function isAddressComplete(a: AddressForm): boolean {
  return Object.keys(validateAddressFields(a)).length === 0
}

// GraphQL AddressInput: optional fields are omitted when empty.
export function toAddressInput(form: AddressForm) {
  const a = normalizeAddress(form)
  return {
    fullName: a.fullName,
    phone: a.phone || undefined,
    line1: a.line1,
    line2: a.line2 || undefined,
    city: a.city,
    state: a.state,
    zip: a.zip,
  }
}

export function formatPhoneDisplay(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

export function formatAddressLines(a: { line1: string; line2?: string | null; city: string; state: string; zip: string }): string[] {
  return [a.line1, a.line2 ?? '', `${a.city}, ${a.state} ${a.zip}`].filter(Boolean)
}
