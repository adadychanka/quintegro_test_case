import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddressVerificationPanel from './AddressVerificationPanel'
import { address } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const entered = address({ line1: '1 market street', city: 'San Francisco', zip: '94105' })
const suggested = address()

describe('AddressVerificationPanel', () => {
  it('A6: corrected address offers both, suggested by default', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(<AddressVerificationPanel verdict="corrected" entered={entered} suggested={suggested} onConfirm={onConfirm} />)
    expect(screen.getByLabelText(/Suggested: 1 MARKET ST/)).toBeChecked()
    await userEvent.click(screen.getByLabelText(/As entered: 1 market street/))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onConfirm).toHaveBeenCalledWith('entered')
  })

  it('A7: undeliverable warns and lets the user continue', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(<AddressVerificationPanel verdict="undeliverable" entered={entered} onConfirm={onConfirm} />)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't verify this address. Check it, or use it anyway.")
    await userEvent.click(screen.getByRole('button', { name: 'Use this address' }))
    expect(onConfirm).toHaveBeenCalledWith('entered')
  })
})
