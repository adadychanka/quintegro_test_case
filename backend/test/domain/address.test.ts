import { describe, expect, it } from 'vitest';
import { AddressInput, US_STATE_CODES, normalizeAddress, validateAddressInput } from '../../src/domain/address';

const valid: AddressInput = {
  fullName: 'John Doe',
  phone: '+15551234567',
  line1: '1 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
};

describe('US_STATE_CODES', () => {
  it('has 50 states plus DC and no territories', () => {
    expect(US_STATE_CODES).toHaveLength(51);
    expect(US_STATE_CODES).toContain('DC');
    expect(US_STATE_CODES).not.toContain('PR');
  });
});

describe('normalizeAddress', () => {
  it('normalizes pasted address input', () => {
    const n = normalizeAddress({
      fullName: ' John  Doe ',
      phone: '+1 (555) 123-4567',
      line1: '1 Main St',
      city: 'Austin',
      state: 'tx',
      zip: ' 78701 ',
    });
    expect(n).toMatchObject({ fullName: 'John Doe', phone: '+15551234567', state: 'TX', zip: '78701' });
  });

  it('accepts a 10-digit phone without country code', () => {
    expect(normalizeAddress({ ...valid, phone: '555.123.4567' }).phone).toBe('+15551234567');
  });

  it('turns empty optional fields into undefined', () => {
    const n = normalizeAddress({ ...valid, phone: '  ', line2: '' });
    expect(n.phone).toBeUndefined();
    expect(n.line2).toBeUndefined();
  });
});

describe('validateAddressInput', () => {
  it('accepts a valid address and sets country US', () => {
    const r = validateAddressInput(valid);
    expect(r).toEqual({ ok: true, address: { ...valid, country: 'US' } });
  });

  it('rejects a short ZIP with the exact message', () => {
    expect(validateAddressInput({ ...valid, zip: '7870' })).toEqual({
      ok: false,
      fieldErrors: [{ field: 'zip', message: 'Enter a 5-digit ZIP code.' }],
    });
  });

  it('accepts ZIP+4', () => {
    expect(validateAddressInput({ ...valid, zip: '78701-1234' }).ok).toBe(true);
  });

  it('rejects territories and accepts DC', () => {
    expect(validateAddressInput({ ...valid, state: 'PR' })).toEqual({
      ok: false,
      fieldErrors: [{ field: 'state', message: 'Select a state.' }],
    });
    expect(validateAddressInput({ ...valid, state: 'DC' }).ok).toBe(true);
  });

  it('rejects line 1 longer than 35 characters', () => {
    expect(validateAddressInput({ ...valid, line1: 'x'.repeat(36) })).toEqual({
      ok: false,
      fieldErrors: [{ field: 'line1', message: 'Use 35 characters or fewer.' }],
    });
  });

  it('treats phone as optional but validates it when present', () => {
    expect(validateAddressInput({ ...valid, phone: undefined }).ok).toBe(true);
    expect(validateAddressInput({ ...valid, phone: '12345' })).toEqual({
      ok: false,
      fieldErrors: [{ field: 'phone', message: 'Enter a 10-digit US phone number.' }],
    });
  });

  it('allows PO Boxes', () => {
    expect(validateAddressInput({ ...valid, line1: 'PO Box 123' }).ok).toBe(true);
  });

  it('reports every missing required field', () => {
    const r = validateAddressInput({ fullName: '', line1: '', city: '', state: '', zip: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors).toEqual([
        { field: 'fullName', message: "Enter the recipient's full name." },
        { field: 'line1', message: 'Enter a street address.' },
        { field: 'city', message: 'Enter a city.' },
        { field: 'state', message: 'Select a state.' },
        { field: 'zip', message: 'Enter a 5-digit ZIP code.' },
      ]);
    }
  });

  it('rejects a full name longer than 70 characters', () => {
    expect(validateAddressInput({ ...valid, fullName: 'a'.repeat(71) }).ok).toBe(false);
  });
});
