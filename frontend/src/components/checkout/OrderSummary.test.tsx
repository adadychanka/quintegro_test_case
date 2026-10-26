import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderSummary from './OrderSummary'
import { item, pricing } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const items = [item('product-2', 'Smartphone', 1, 899.99), item('product-4', 'Tablet', 1, 599.99)]

describe('OrderSummary', () => {
  it('Q1: no address yet', () => {
    renderWithProviders(
      <OrderSummary items={items} pricing={pricing({ taxCents: 0, totalCents: 134998, taxStatus: 'pending' })} state="pending-address" onRetry={() => {}} />
    )
    expect(screen.getByText('Calculated after you enter your address')).toBeInTheDocument()
    expect(screen.getByText('$1,349.98')).toBeInTheDocument()
  })

  it('Q2: loading shows spinners instead of amounts', () => {
    renderWithProviders(<OrderSummary items={items} state="loading" onRetry={() => {}} />)
    expect(screen.getAllByLabelText('Updating total').length).toBeGreaterThan(0)
  })

  it('Q3: error shows retry', async () => {
    const onRetry = vi.fn()
    renderWithProviders(<OrderSummary items={items} state="error" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't update your total.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('Q4: ready with discount, free shipping and estimated tax label', () => {
    renderWithProviders(<OrderSummary items={items} pricing={pricing({ taxStatus: 'estimated' })} state="ready" onRetry={() => {}} />)
    expect(screen.getByText('$1,499.98')).toBeInTheDocument()
    expect(screen.getByText('−$150.00')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Estimated tax')).toBeInTheDocument()
    expect(screen.getByText('$97.87')).toBeInTheDocument()
    expect(screen.getByText('$1,447.85')).toBeInTheDocument()
  })

  it('hides the discount row without a promo', () => {
    renderWithProviders(<OrderSummary items={items} pricing={pricing({ discountCents: 0, promoCode: null })} state="ready" onRetry={() => {}} />)
    expect(screen.queryByText(/Discount/)).toBeNull()
    expect(screen.getByText('Tax')).toBeInTheDocument()
  })
})
