import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutConfirmationPage from './CheckoutConfirmationPage'
import { GET_ORDER } from '@/graphql/queries'
import { gqlError, order, placedOrder, pricing } from '@/test/fixtures'
import { renderWithProviders, signIn } from '@/test/render'

function setup(result: any) {
  signIn()
  return renderWithProviders(<CheckoutConfirmationPage />, {
    mocks: [{ request: { query: GET_ORDER, variables: { orderId: 'order-2' } }, ...result }],
    route: '/checkout/confirmation/order-2',
    path: '/checkout/confirmation/:orderId',
  })
}

describe('CheckoutConfirmationPage', () => {
  it('K1: loading', () => {
    setup({ result: { data: { order: placedOrder() } } })
    expect(screen.getByText('Loading your order...')).toBeInTheDocument()
  })

  it('K2: load error offers retry', async () => {
    setup({ error: new Error('down') })
    expect(await screen.findByText("We couldn't load your order.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('K3: not found', async () => {
    const { location } = setup({ result: { errors: [gqlError('ORDER_NOT_FOUND')] } })
    expect(await screen.findByText('Order not found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to orders' }))
    expect(location.current?.pathname).toBe('/order')
  })

  it('K4: a cart order redirects to checkout', async () => {
    const { location } = setup({ result: { data: { order: order() } } })
    await waitFor(() => expect(location.current?.pathname).toBe('/checkout'))
  })

  it('K5: shows the placed order', async () => {
    setup({ result: { data: { order: placedOrder({ pricing: pricing({ taxStatus: 'estimated' }) }) } } })
    expect(await screen.findByRole('heading', { name: 'Thank you! Your order is placed.' })).toBeInTheDocument()
    expect(screen.getByText('Order #order-2')).toBeInTheDocument()
    expect(screen.getByText('Visa •••• 4242')).toBeInTheDocument()
    expect(screen.getByText('Estimated tax')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('$1,447.85')).toBeInTheDocument()
    expect(screen.getByText('1 MARKET ST')).toBeInTheDocument()
    expect(screen.getByText('SAN FRANCISCO, CA 94105-0001')).toBeInTheDocument()
    expect(screen.getByText('(555) 123-4567')).toBeInTheDocument()
    expect(screen.getByText('Smartphone')).toBeInTheDocument()
  })
})
