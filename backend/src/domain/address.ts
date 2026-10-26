// US-only delivery addresses (spec R2, D5.3): 50 states + DC.

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export type UsStateCode = (typeof US_STATE_CODES)[number];

export interface Address {
  fullName: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state: UsStateCode;
  zip: string;
  country: 'US';
}

export type AddressInput = Omit<Address, 'country' | 'state'> & { state: string };

export type AddressField = keyof AddressInput;

export interface FieldError {
  field: AddressField;
  message: string;
}

// Shared with the frontend (frontend/src/lib/usAddress.ts): keep in sync.
export const ADDRESS_MESSAGES = {
  fullName: "Enter the recipient's full name.",
  line1: 'Enter a street address.',
  tooLong: 'Use 35 characters or fewer.',
  city: 'Enter a city.',
  state: 'Select a state.',
  zip: 'Enter a 5-digit ZIP code.',
  phone: 'Enter a 10-digit US phone number.',
} as const;

const ZIP_RE = /^\d{5}(-\d{4})?$/;
const LINE_MAX = 35;
const NAME_MAX = 70;

function clean(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return raw.trim();
}

export function normalizeAddress(input: AddressInput): AddressInput {
  const phone = clean(input.phone);
  const line2 = clean(input.line2);
  return {
    fullName: clean(input.fullName),
    phone: phone ? normalizePhone(phone) : undefined,
    line1: clean(input.line1),
    line2: line2 || undefined,
    city: clean(input.city),
    state: clean(input.state).toUpperCase(),
    zip: clean(input.zip),
  };
}

export function isUsStateCode(value: string): value is UsStateCode {
  return (US_STATE_CODES as readonly string[]).includes(value);
}

export function validateAddressInput(
  input: AddressInput
): { ok: true; address: Address } | { ok: false; fieldErrors: FieldError[] } {
  const a = normalizeAddress(input);
  const errors: FieldError[] = [];

  if (!a.fullName) errors.push({ field: 'fullName', message: ADDRESS_MESSAGES.fullName });
  else if (a.fullName.length > NAME_MAX) errors.push({ field: 'fullName', message: 'Use 70 characters or fewer.' });

  if (a.phone !== undefined && !/^\+1\d{10}$/.test(a.phone)) {
    errors.push({ field: 'phone', message: ADDRESS_MESSAGES.phone });
  }

  if (!a.line1) errors.push({ field: 'line1', message: ADDRESS_MESSAGES.line1 });
  else if (a.line1.length > LINE_MAX) errors.push({ field: 'line1', message: ADDRESS_MESSAGES.tooLong });

  if (a.line2 && a.line2.length > LINE_MAX) errors.push({ field: 'line2', message: ADDRESS_MESSAGES.tooLong });

  if (!a.city) errors.push({ field: 'city', message: ADDRESS_MESSAGES.city });
  else if (a.city.length > LINE_MAX) errors.push({ field: 'city', message: ADDRESS_MESSAGES.tooLong });

  if (!isUsStateCode(a.state)) errors.push({ field: 'state', message: ADDRESS_MESSAGES.state });

  if (!ZIP_RE.test(a.zip)) errors.push({ field: 'zip', message: ADDRESS_MESSAGES.zip });

  if (errors.length > 0) return { ok: false, fieldErrors: errors };

  const address: Address = {
    fullName: a.fullName,
    line1: a.line1,
    city: a.city,
    state: a.state as UsStateCode,
    zip: a.zip,
    country: 'US',
  };
  if (a.phone) address.phone = a.phone;
  if (a.line2) address.line2 = a.line2;
  return { ok: true, address };
}
