import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddressFields from './AddressFields'
import { AddressForm, emptyAddress } from '@/lib/usAddress'
import { renderWithProviders } from '@/test/render'
import { ADDRESS_SUGGESTIONS } from '@/graphql/checkout'

function Harness({ autocomplete = false, errors = {}, mocksOnChange }: { autocomplete?: boolean; errors?: any; mocksOnChange?: (a: AddressForm) => void }) {
  const [value, setValue] = useState(emptyAddress())
  return (
    <AddressFields
      idPrefix="shipping"
      value={value}
      onChange={(a) => {
        setValue(a)
        mocksOnChange?.(a)
      }}
      errors={errors}
      autocomplete={autocomplete}
    />
  )
}

const suggestion = {
  __typename: 'AddressSuggestion',
  id: 's1',
  label: '600 CONGRESS AVE, AUSTIN, TX 78701-3234',
  address: { __typename: 'Address', fullName: '', phone: null, line1: '600 CONGRESS AVE', line2: null, city: 'AUSTIN', state: 'TX', zip: '78701-3234', country: 'US' },
}

const suggestMock = (query: string, result: any, delay = 0) => ({ request: { query: ADDRESS_SUGGESTIONS, variables: { query } }, result, delay })

describe('AddressFields', () => {
  it('every input has a label and an autocomplete attribute', () => {
    const { container } = renderWithProviders(<Harness />)
    const fields = container.querySelectorAll('input, select')
    expect(fields).toHaveLength(7)
    fields.forEach((el) => {
      expect((el as HTMLInputElement).labels!.length).toBeGreaterThan(0)
      expect(el.getAttribute('autocomplete')).toMatch(/^shipping /)
    })
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Apt, suite, unit (optional)')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'State' })).toBeInTheDocument()
  })

  it('A1: shows an inline error on blur', async () => {
    renderWithProviders(<Harness />)
    const zip = screen.getByLabelText('ZIP code')
    await userEvent.type(zip, '123')
    fireEvent.blur(zip)
    expect(await screen.findByText('Enter a 5-digit ZIP code.')).toBeInTheDocument()
    expect(zip).toHaveAttribute('aria-invalid', 'true')
    expect(zip.getAttribute('aria-describedby')).toBe('shipping-zip-error')
  })

  it('shows errors passed by the parent', () => {
    renderWithProviders(<Harness errors={{ city: 'Enter a city.' }} />)
    expect(screen.getByText('Enter a city.')).toBeInTheDocument()
  })
})

describe('AddressAutocomplete', () => {
  it('no request under 3 characters', async () => {
    renderWithProviders(<Harness autocomplete />, { mocks: [] })
    await userEvent.type(screen.getByRole('combobox', { name: 'Address line 1' }), 'ab')
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('A2 + A3: loading spinner, then suggestions; keyboard selection fills all fields', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Harness autocomplete mocksOnChange={onChange} />, {
      mocks: [suggestMock('600 c', { data: { addressSuggestions: [suggestion] } }, 30)],
    })
    const input = screen.getByRole('combobox', { name: 'Address line 1' })
    await userEvent.type(input, '600 c')
    expect(await screen.findByLabelText('Loading suggestions')).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: suggestion.label })).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input).toHaveValue('600 CONGRESS AVE')
    expect(screen.getByLabelText('City')).toHaveValue('AUSTIN')
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveValue('TX')
    expect(screen.getByLabelText('ZIP code')).toHaveValue('78701-3234')
  })

  it('A4: no matches message', async () => {
    renderWithProviders(<Harness autocomplete />, { mocks: [suggestMock('zzz', { data: { addressSuggestions: [] } })] })
    await userEvent.type(screen.getByRole('combobox', { name: 'Address line 1' }), 'zzz')
    expect(await screen.findByText('No matches. Keep typing or enter the address manually.')).toBeInTheDocument()
  })

  it('A5: errors hide the list and manual entry keeps working', async () => {
    renderWithProviders(<Harness autocomplete />, {
      mocks: [suggestMock('1 m', { errors: [{ message: 'slow down', extensions: { code: 'RATE_LIMITED' } }] })],
    })
    const input = screen.getByRole('combobox', { name: 'Address line 1' })
    await userEvent.type(input, '1 m')
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.type(input, 'ain')
    expect(input).toHaveValue('1 main')
  })

  it('Escape closes the list', async () => {
    renderWithProviders(<Harness autocomplete />, { mocks: [suggestMock('600 c', { data: { addressSuggestions: [suggestion] } })] })
    await userEvent.type(screen.getByRole('combobox', { name: 'Address line 1' }), '600 c')
    await screen.findByRole('listbox')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
