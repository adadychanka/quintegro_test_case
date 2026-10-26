import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PromoCodeField from './PromoCodeField'
import { renderWithProviders } from '@/test/render'

describe('PromoCodeField', () => {
  it('M1: Apply shows a spinner while applying', async () => {
    let finish!: () => void
    const onApply = vi.fn(() => new Promise<void>((r) => (finish = r)))
    renderWithProviders(<PromoCodeField onApply={onApply} onRemove={() => {}} />)
    await userEvent.type(screen.getByLabelText('Promo code'), 'save10')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith('SAVE10')
    expect(screen.getByRole('button', { name: /Apply/ })).toBeDisabled()
    expect(screen.getByLabelText('Applying promo code')).toBeInTheDocument()
    finish()
  })

  it('M2: applied promo shows a badge and Remove', async () => {
    const onRemove = vi.fn()
    renderWithProviders(<PromoCodeField applied={{ code: 'SAVE10', percent: 10 }} onApply={async () => {}} onRemove={onRemove} />)
    expect(screen.getByText('SAVE10 · 10% off')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalled()
  })

  it('M3 + M4: error messages', () => {
    const { rerender } = renderWithProviders(<PromoCodeField error="PROMO_INVALID" onApply={async () => {}} onRemove={() => {}} />)
    expect(screen.getByText("This promo code doesn't exist.")).toBeInTheDocument()
    rerender(<PromoCodeField error="PROMO_EXPIRED" onApply={async () => {}} onRemove={() => {}} />)
    expect(screen.getByText('This promo code has expired.')).toBeInTheDocument()
    rerender(<PromoCodeField error="PROMO_FAILED" onApply={async () => {}} onRemove={() => {}} />)
    expect(screen.getByText("Couldn't apply the promo code. Try again.")).toBeInTheDocument()
  })

  it('does not apply an empty code', async () => {
    const onApply = vi.fn(async () => {})
    renderWithProviders(<PromoCodeField onApply={onApply} onRemove={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).not.toHaveBeenCalled()
  })
})
