import { describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutPage from './CheckoutPage'
import { CART } from '@/graphql/cart'
import { GET_ORDERS } from '@/graphql/queries'
import { ADDRESS_SUGGESTIONS, CHECKOUT, CHECKOUT_QUOTE, VALIDATE_ADDRESS } from '@/graphql/checkout'
import { address, gqlError, order, placedOrder, pricing } from '@/test/fixtures'
import { renderWithProviders, signIn } from '@/test/render'
import { loadDraft, saveDraft } from '@/lib/checkoutDraft'
import { emptyAddress } from '@/lib/usAddress'
import { retryIf } from '@/apollo/client'

const ANY = { variableMatcher: () => true, maxUsageCount: Number.POSITIVE_INFINITY }

// Quote: tax only when a full address is sent; SAVE10 gives 10% off.
function quote(vars: any) {
  const promo = vars.promoCode === 'SAVE10'
  const withAddress = !!vars.shippingAddress
  const discount = promo ? 15000 : 0
  const tax = withAddress ? (promo ? 9787 : 10875) : 0
  const total = 149998 - discount + tax
  return pricing({
    discountCents: discount,
    taxCents: tax,
    totalCents: total,
    promoCode: promo ? 'SAVE10' : null,
    promoPercent: promo ? 10 : null,
    taxStatus: withAddress ? 'calculated' : 'pending',
  })
}

interface Setup {
  checkoutDelay?: number
  networkError?: boolean
  cart?: any
  checkout?: (input: any, call: number) => any
  verdict?: any
  quoteResult?: (vars: any) => any
}

function setup({ cart = order(), checkout, verdict, quoteResult, networkError, checkoutDelay = 20 }: Setup = {}) {
  signIn()
  const inputs: any[] = []
  const mocks: any[] = [
    { request: { query: CART }, result: { data: { cart } }, maxUsageCount: Number.POSITIVE_INFINITY },
    { request: { query: GET_ORDERS }, result: { data: { orders: [] } }, maxUsageCount: Number.POSITIVE_INFINITY },
    { request: { query: ADDRESS_SUGGESTIONS }, ...ANY, result: { data: { addressSuggestions: [] } } },
    {
      request: { query: CHECKOUT_QUOTE },
      ...ANY,
      result: (vars: any) => (quoteResult ? quoteResult(vars) : { data: { checkoutQuote: quote(vars) } }),
    },
    {
      request: { query: VALIDATE_ADDRESS },
      ...ANY,
      result: () => ({ data: { validateAddress: verdict ?? { __typename: 'AddressValidation', verdict: 'verified', suggested: null } } }),
    },
    networkError && { request: { query: CHECKOUT }, ...ANY, error: new Error('Failed to fetch') },
    {
      request: { query: CHECKOUT },
      ...ANY,
      delay: checkoutDelay,
      result: (vars: any) => {
        inputs.push(vars.input)
        return checkout ? checkout(vars.input, inputs.length) : { data: { checkout: placedOrder() } }
      },
    },
  ]
  const utils = renderWithProviders(<CheckoutPage />, { mocks: mocks.filter(Boolean), route: '/checkout', path: '/checkout' })
  return { ...utils, inputs }
}

async function fillForm({ line1 = '1 Market St', card = '4242424242424242' } = {}) {
  const user = userEvent.setup()
  await screen.findByRole('heading', { name: 'Checkout' })
  await user.type(screen.getByLabelText('Full name'), 'John Doe')
  await user.type(screen.getByRole('combobox', { name: 'Address line 1' }), line1)
  await user.type(screen.getByLabelText('City'), 'San Francisco')
  await user.selectOptions(screen.getByRole('combobox', { name: 'State' }), 'CA')
  await user.type(screen.getByLabelText('ZIP code'), '94105')
  await user.type(screen.getByLabelText('Card number'), card)
  await user.type(screen.getByLabelText('Expiration (MM/YY)'), '12/30')
  await user.type(screen.getByLabelText('Security code'), '123')
  return user
}

const placeButton = () => screen.getByRole('button', { name: /Place order|Checking address|Placing order/ })

async function readyToPlace(total = '$1,608.73') {
  await waitFor(() => expect(screen.getByRole('button', { name: `Place order · ${total}` })).toBeEnabled(), { timeout: 3000 })
}

describe('CheckoutPage: cart states', () => {
  it('C1: shows a spinner while the cart loads', () => {
    setup()
    expect(screen.getByText('Loading your cart...')).toBeInTheDocument()
  })

  it('C2: cart load error offers retry', async () => {
    signIn()
    renderWithProviders(<CheckoutPage />, {
      mocks: [{ request: { query: CART }, error: new Error('down') }],
      route: '/checkout',
      path: '/checkout',
    })
    expect(await screen.findByText("We couldn't load your cart.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('C3 / back after success shows empty cart', async () => {
    const { location } = setup({ cart: order({ orderId: 'order-3', products: [] }) })
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to orders' }))
    expect(location.current?.pathname).toBe('/order')
  })
})

describe('CheckoutPage: summary', () => {
  it('Q1: tax waits for the address', async () => {
    setup()
    expect(await screen.findByText('Calculated after you enter your address')).toBeInTheDocument()
  })

  it('Q3: quote failure disables Place order', async () => {
    setup({ quoteResult: () => ({ errors: [gqlError('INTERNAL')] }) })
    expect(await screen.findByText("We couldn't update your total.")).toBeInTheDocument()
    expect(placeButton()).toBeDisabled()
  })

  it('M3: unknown promo code', async () => {
    setup({ quoteResult: (vars) => (vars.promoCode ? { errors: [gqlError('PROMO_INVALID')] } : { data: { checkoutQuote: quote(vars) } }) })
    await screen.findByRole('heading', { name: 'Checkout' })
    await userEvent.type(screen.getByLabelText('Promo code'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText("This promo code doesn't exist.")).toBeInTheDocument()
  })

  it('M2: applied promo updates the total', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Checkout' })
    await userEvent.type(screen.getByLabelText('Promo code'), 'save10')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('SAVE10 · 10% off')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Place order · $1,349.98' })).toBeEnabled())
  })
})

describe('CheckoutPage: submit flow', () => {
  it('S10: places the order and opens the confirmation', async () => {
    const { inputs, location } = setup()
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    await waitFor(() => expect(location.current?.pathname).toBe('/checkout/confirmation/order-2'))
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({
      orderId: 'order-2',
      addressChoice: 'entered',
      billingSameAsShipping: true,
      expectedTotalCents: 160873,
      shippingAddress: { fullName: 'John Doe', line1: '1 Market St', city: 'San Francisco', state: 'CA', zip: '94105' },
    })
    expect(inputs[0].paymentToken).toMatch(/^mock_tok_visa_4242_/)
    expect(JSON.stringify(inputs[0])).not.toContain('4242424242424242')
    expect(loadDraft()).toBeNull()
  })

  it('sends one checkout on double submit', async () => {
    const { inputs, location } = setup()
    const user = await fillForm()
    await readyToPlace()
    await user.dblClick(placeButton())
    await user.click(placeButton())
    await waitFor(() => expect(location.current?.pathname).toBe('/checkout/confirmation/order-2'))
    expect(inputs).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('S2: client validation shows a focused summary', async () => {
    const { inputs } = setup()
    await screen.findByRole('heading', { name: 'Checkout' })
    await waitFor(() => expect(placeButton()).toBeEnabled())
    await userEvent.click(placeButton())
    const summary = await screen.findByRole('alert', { name: 'Please fix the highlighted fields.' })
    expect(summary).toHaveFocus()
    expect(within(summary).getByRole('link', { name: "Enter the recipient's full name." })).toHaveAttribute('href', '#shipping-fullName')
    expect(screen.getAllByText('Enter a 5-digit ZIP code.').length).toBeGreaterThan(0)
    expect(inputs).toHaveLength(0)
  })

  it('A6: corrected address asks, then sends the choice', async () => {
    const { inputs } = setup({
      verdict: { __typename: 'AddressValidation', verdict: 'corrected', suggested: address({ zip: '94105-0001' }) },
    })
    const user = await fillForm({ line1: '1 market street' })
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByText('We found a more precise address')).toBeInTheDocument()
    expect(inputs).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(inputs).toHaveLength(1))
    expect(inputs[0].addressChoice).toBe('suggested')
  })

  it('A7: undeliverable address can be used anyway', async () => {
    const { inputs } = setup({ verdict: { __typename: 'AddressValidation', verdict: 'undeliverable', suggested: null } })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    await user.click(await screen.findByRole('button', { name: 'Use this address' }))
    await waitFor(() => expect(inputs).toHaveLength(1))
    expect(inputs[0].addressChoice).toBe('entered')
  })

  it('P4: PAYMENT_DECLINED then retry uses a new key', async () => {
    const { inputs } = setup({
      checkout: (_input, call) => (call === 1 ? { errors: [gqlError('PAYMENT_DECLINED', 'declined', { declineCode: 'card_declined' })] } : { data: { checkout: placedOrder() } }),
    })
    const user = await fillForm({ card: '4000000000000002' })
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByText('Your card was declined. Try another card.')).toBeInTheDocument()
    expect(screen.getByLabelText('Security code')).toHaveValue('')
    expect(screen.getByLabelText('Card number')).toHaveFocus()
    expect(screen.getByLabelText('Full name')).toHaveValue('John Doe')

    await user.clear(screen.getByLabelText('Card number'))
    await user.type(screen.getByLabelText('Card number'), '4242424242424242')
    await user.type(screen.getByLabelText('Security code'), '123')
    await user.click(placeButton())
    await waitFor(() => expect(inputs).toHaveLength(2))
    expect(inputs[1].idempotencyKey).not.toBe(inputs[0].idempotencyKey)
  })

  it('P5: PAYMENT_ERROR then Try again reuses the key', async () => {
    const { inputs } = setup({
      checkout: (_input, call) => (call === 1 ? { errors: [gqlError('PAYMENT_ERROR')] } : { data: { checkout: placedOrder() } }),
    })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    const alert = await screen.findByText('Payment could not be processed. Try again.')
    await user.click(within(alert.closest('[role=alert]') as HTMLElement).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(inputs).toHaveLength(2))
    expect(inputs[1].idempotencyKey).toBe(inputs[0].idempotencyKey)
  })

  it('Q5: PRICE_CHANGED shows the new total and uses a new key next time', async () => {
    const { inputs } = setup({
      checkout: (_input, call) =>
        call === 1
          ? { errors: [gqlError('PRICE_CHANGED', 'changed', { pricing: { ...pricing(), totalCents: 170000 } })] }
          : { data: { checkout: placedOrder() } },
    })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByText('Your total changed to $1,700.00. Review and place order again.')).toBeInTheDocument()
    await readyToPlace()
    await user.click(placeButton())
    await waitFor(() => expect(inputs).toHaveLength(2))
    expect(inputs[1].idempotencyKey).not.toBe(inputs[0].idempotencyKey)
  })

  it('S7: cart changed blocks the form', async () => {
    setup({ checkout: () => ({ errors: [gqlError('ORDER_NOT_EDITABLE')] }) })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByText('Your cart has changed. Return to your orders to review it.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to orders' })).toBeInTheDocument()
    expect(placeButton()).toBeDisabled()
  })

  it('S8: server address errors show inline', async () => {
    setup({
      checkout: () => ({ errors: [gqlError('ADDRESS_INVALID', 'fix', { fieldErrors: [{ field: 'zip', message: 'Enter a 5-digit ZIP code.' }] })] }),
    })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByRole('alert', { name: 'Please fix the highlighted fields.' })).toBeInTheDocument()
    expect(screen.getByLabelText('ZIP code')).toHaveAttribute('aria-invalid', 'true')
  })

  it('S9 + S6: checkout in progress twice ends with the network message', async () => {
    const { inputs } = setup({ checkout: () => ({ errors: [gqlError('CHECKOUT_IN_PROGRESS')] }) })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByText(/Placing order/)).toBeInTheDocument()
    expect(
      await screen.findByText("We couldn't reach the server. Try again — you won't be charged twice.", {}, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(inputs).toHaveLength(2)
    expect(inputs[1].idempotencyKey).toBe(inputs[0].idempotencyKey)
  })

  it('S6: network failure offers retry', async () => {
    setup({ networkError: true })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    expect(await screen.findByText("We couldn't reach the server. Try again — you won't be charged twice.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('S5: shows the retry caption while Apollo retries', async () => {
    const { location } = setup({ checkoutDelay: 600 })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    await screen.findByText(/Placing order/)
    act(() => {
      retryIf({ statusCode: 500 }, { operationName: 'Checkout' } as never)
    })
    expect(screen.getByText("Still working... Please don't close this page.")).toBeInTheDocument()
    await waitFor(() => expect(location.current?.pathname).toBe('/checkout/confirmation/order-2'))
  })

  it('R1: UNAUTHENTICATED saves the draft and goes to login', async () => {
    const { location } = setup({ checkout: () => ({ errors: [gqlError('UNAUTHENTICATED')] }) })
    const user = await fillForm()
    await readyToPlace()
    await user.click(placeButton())
    await waitFor(() => expect(location.current?.pathname).toBe('/login'))
    expect(location.current?.search).toBe('?redirect=%2Fcheckout')
    expect(loadDraft()?.shipping.fullName).toBe('John Doe')
  })

  it('restores draft after re-login', async () => {
    saveDraft({ shipping: { ...emptyAddress(), fullName: 'Jane Roe', zip: '94105' }, billingSameAsShipping: false, billing: emptyAddress(), promoCode: '' })
    setup()
    await screen.findByRole('heading', { name: 'Checkout' })
    expect(screen.getByLabelText('Full name', { selector: '#shipping-fullName' })).toHaveValue('Jane Roe')
    expect(screen.getByLabelText('Billing address same as shipping')).not.toBeChecked()
  })

  it('uses latest quote for expected total', async () => {
    const seen: any[] = []
    const { inputs } = setup({
      quoteResult: (vars) => {
        seen.push(vars)
        const p = quote(vars)
        // NY address priced differently from CA.
        if (vars.shippingAddress?.state === 'NY') return { data: { checkoutQuote: { ...p, taxCents: 6000, totalCents: 155998 } } }
        return { data: { checkoutQuote: p } }
      },
    })
    const user = await fillForm()
    await readyToPlace()
    await user.selectOptions(screen.getByRole('combobox', { name: 'State' }), 'NY')
    await readyToPlace('$1,559.98')
    await user.click(placeButton())
    await waitFor(() => expect(inputs).toHaveLength(1))
    expect(inputs[0].expectedTotalCents).toBe(155998)
    vi.restoreAllMocks()
  })
})
