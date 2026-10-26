import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import CurrentOrder from './CurrentOrder'
import { CART } from '@/graphql/cart'
import { order } from '@/test/fixtures'
import { renderWithProviders, signIn } from '@/test/render'

describe('CurrentOrder badge', () => {
  it('H1: no badge when signed out', () => {
    renderWithProviders(<CurrentOrder />)
    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument()
  })

  it('H2: shows the sum of item amounts', async () => {
    signIn()
    renderWithProviders(<CurrentOrder />, { mocks: [{ request: { query: CART }, result: { data: { cart: order() } } }] })
    expect(await screen.findByRole('button', { name: 'Cart, 2 items' })).toHaveTextContent('2')
  })

  it('H1: no badge for an empty cart', async () => {
    signIn()
    renderWithProviders(<CurrentOrder />, { mocks: [{ request: { query: CART }, result: { data: { cart: order({ products: [] }) } } }] })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument()
  })
})
