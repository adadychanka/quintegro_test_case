import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { AddressField, AddressForm, US_STATES, validateAddressFields } from '@/lib/usAddress'
import AddressAutocomplete from './AddressAutocomplete'
import FormField, { fieldA11y } from './FormField'
import type { Address } from '@/types/order'

interface AddressFieldsProps {
  idPrefix: 'shipping' | 'billing'
  value: AddressForm
  onChange: (value: AddressForm) => void
  // Errors from the parent: submit attempt or server (S2, S8).
  errors?: Partial<Record<AddressField, string>>
  disabled?: boolean
  autocomplete?: boolean
}

const LABELS: Record<AddressField, string> = {
  fullName: 'Full name',
  phone: 'Phone (optional)',
  line1: 'Address line 1',
  line2: 'Apt, suite, unit (optional)',
  city: 'City',
  state: 'State',
  zip: 'ZIP code',
}

const AUTOCOMPLETE: Record<AddressField, string> = {
  fullName: 'name',
  phone: 'tel',
  line1: 'address-line1',
  line2: 'address-line2',
  city: 'address-level2',
  state: 'address-level1',
  zip: 'postal-code',
}

// US address fields in US order (spec R2). Errors appear on blur (A1).
const AddressFields: React.FC<AddressFieldsProps> = ({ idPrefix, value, onChange, errors = {}, disabled, autocomplete = false }) => {
  const [touched, setTouched] = useState<Partial<Record<AddressField, boolean>>>({})
  const local = validateAddressFields(value)

  const errorOf = (f: AddressField) => errors[f] ?? (touched[f] ? local[f] : undefined)
  const id = (f: AddressField) => `${idPrefix}-${f}`
  const set = (f: AddressField) => (v: string) => onChange({ ...value, [f]: v })
  const blur = (f: AddressField) => () => setTouched((t) => ({ ...t, [f]: true }))
  const common = (f: AddressField) => ({
    id: id(f),
    name: id(f),
    autoComplete: `${idPrefix} ${AUTOCOMPLETE[f]}`,
    disabled,
    onBlur: blur(f),
    ...fieldA11y(id(f), errorOf(f)),
  })

  const text = (f: AddressField, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <FormField id={id(f)} label={LABELS[f]} error={errorOf(f)}>
      <Input value={value[f]} onChange={(e) => set(f)(e.target.value)} {...common(f)} {...extra} />
    </FormField>
  )

  const fillFrom = (a: Address) =>
    onChange({ ...value, line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, zip: a.zip })

  return (
    <div className="space-y-6">
      {text('fullName')}
      {text('phone', { type: 'tel', inputMode: 'tel' })}
      {autocomplete ? (
        <FormField id={id('line1')} label={LABELS.line1} error={errorOf('line1')}>
          <AddressAutocomplete value={value.line1} onChange={set('line1')} onSelect={fillFrom} {...common('line1')} />
        </FormField>
      ) : (
        text('line1')
      )}
      {text('line2')}
      <div className="grid gap-6 sm:grid-cols-[1fr_180px_140px]">
        {text('city')}
        <FormField id={id('state')} label={LABELS.state} error={errorOf('state')}>
          <NativeSelect
            value={value.state}
            onChange={(e) => {
              set('state')(e.target.value)
              blur('state')()
            }}
            {...common('state')}
            className={cn(common('state').className)}
          >
            <option value="">Select a state</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {text('zip', { inputMode: 'numeric' })}
      </div>
    </div>
  )
}

export default AddressFields
