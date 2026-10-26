import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrderList from './OrderList'
import { CART, UPDATE_ITEM_AMOUNT } from '@/graphql/cart'
import { GET_ORDERS } from '@/graphql/queries'
import { gqlError, item, order, placedOrder } from '@/test/fixtures'
import { renderWithProviders, signIn } from '@/test/render'

const finished = placedOrder({ orderId: 'order-1', status: 'finished', products: [item('product-1', 'Laptop', 1, 1299.99)] })

function mocks(cart = order(), extra: any[] = []) {
  return [
    { request: { query: CART }, result: { data: { cart } } },
    { request: { query: GET_ORDERS }, result: { data: { orders: [finished, cart] } } },
    ...extra,
  ]
}

function amountMock(amount: number, result: any, delay = 0) {
  return { request: { query: UPDATE_ITEM_AMOUNT, variables: { orderId: 'order-2', productId: 'product-2', amount } }, result, delay }
}

describe('OrderList', () => {
  it('O1: cart with items shows subtotal and checkout button', async () => {
    signIn()
    const { location } = renderWithProviders(<OrderList />, { mocks: mocks(), route: '/order' })
    const cart = await screen.findByRole('region', { name: 'Your cart' })
    expect(within(cart).getByText('$1,499.98')).toBeInTheDocument()
    await userEvent.click(within(cart).getByRole('button', { name: 'Proceed to checkout' }))
    expect(location.current?.pathname).toBe('/checkout')
  })

  it('O2: empty cart shows the empty state and disables checkout', async () => {
    signIn()
    renderWithProviders(<OrderList />, { mocks: mocks(order({ products: [] })) })
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled()
  })

  it('O3: item controls are disabled while the update runs', async () => {
    signIn()
    const updated = order({ products: [item('product-2', 'Smartphone', 2, 899.99), item('product-4', 'Tablet', 1, 599.99)] })
    renderWithProviders(<OrderList />, { mocks: mocks(order(), [amountMock(2, { data: { updateItemAmount: updated } }, 50)]) })
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Smartphone' }))
    expect(screen.getByRole('button', { name: 'Remove Smartphone' })).toBeDisabled()
    await waitFor(() => expect(screen.getByLabelText('Quantity of Smartphone')).toHaveValue(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Smartphone' })).toBeEnabled())
  })

  it('O4: failed update shows an error and reverts the amount', async () => {
    signIn()
    renderWithProviders(<OrderList />, { mocks: mocks(order(), [amountMock(2, { errors: [gqlError('INTERNAL')] })]) })
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Smartphone' }))
    expect(await screen.findByText("Couldn't update this item. Try again.")).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity of Smartphone')).toHaveValue(1)
  })

  it('O5: checkout in progress shows an info message', async () => {
    signIn()
    renderWithProviders(<OrderList />, { mocks: mocks(order(), [amountMock(2, { errors: [gqlError('CHECKOUT_IN_PROGRESS')] })]) })
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Smartphone' }))
    expect(await screen.findByText('Checkout in progress. Try again in a moment.')).toBeInTheDocument()
  })

  it('O6: history orders are read-only with status and total', async () => {
    signIn()
    renderWithProviders(<OrderList />, { mocks: mocks() })
    const history = await screen.findByRole('region', { name: 'Order history' })
    const card = await within(history).findByRole('article', { name: 'Order #order-1' })
    expect(within(card).getByText('Finished')).toBeInTheDocument()
    expect(within(card).getByText('$1,447.85')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Increase quantity/ })).toBeNull()
    expect(within(card).getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/checkout/confirmation/order-1')
  })

  it('shows a page error when the cart cannot load', async () => {
    signIn()
    renderWithProviders(<OrderList />, {
      mocks: [
        { request: { query: CART }, error: new Error('Network down') },
        { request: { query: GET_ORDERS }, result: { data: { orders: [] } } },
      ],
    })
    expect(await screen.findByText("We couldn't load your orders.")).toBeInTheDocument()
  })
})
