import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaymentSection from './PaymentSection'
import { emptyCard } from '@/lib/mockCardTokenizer'
import { emptyAddress } from '@/lib/usAddress'
import { renderWithProviders } from '@/test/render'

function Harness({ declined = false }: { declined?: boolean }) {
  const [card, setCard] = useState(emptyCard())
  const [same, setSame] = useState(true)
  const [billing, setBilling] = useState(emptyAddress())
  return (
    <PaymentSection
      card={card}
      onCardChange={setCard}
      billingSame={same}
      onBillingSameChange={setSame}
      billing={billing}
      onBillingChange={setBilling}
      cardErrors={{}}
      billingErrors={{}}
      declined={declined}
    />
  )
}

describe('PaymentSection', () => {
  it('P1: card fields validate on blur', async () => {
    renderWithProviders(<Harness />)
    const number = screen.getByLabelText('Card number')
    await userEvent.type(number, '4242424242424241')
    fireEvent.blur(number)
    expect(await screen.findByText('Enter a valid card number.')).toBeInTheDocument()
    fireEvent.blur(screen.getByLabelText('Expiration (MM/YY)'))
    expect(await screen.findByText('Enter a valid expiration date.')).toBeInTheDocument()
    fireEvent.blur(screen.getByLabelText('Security code'))
    expect(await screen.findByText('Enter the 3-digit security code.')).toBeInTheDocument()
  })

  it('groups the card number while typing', async () => {
    renderWithProviders(<Harness />)
    await userEvent.type(screen.getByLabelText('Card number'), '4242424242424242')
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242')
    expect(screen.getByLabelText('Card number')).toHaveAttribute('autocomplete', 'cc-number')
  })

  it('P2 + P3: billing fields show only when the checkbox is off', async () => {
    renderWithProviders(<Harness />)
    const box = screen.getByLabelText('Billing address same as shipping')
    expect(box).toBeChecked()
    expect(screen.queryByLabelText('Billing full name')).toBeNull()
    await userEvent.click(box)
    expect(screen.getByRole('group', { name: 'Billing address' })).toBeInTheDocument()
    expect(screen.getByLabelText('Full name', { selector: '#billing-fullName' })).toHaveAttribute('autocomplete', 'billing name')
  })

  it('P4: declined shows the alert and focuses the card number', () => {
    renderWithProviders(<Harness declined />)
    expect(screen.getByRole('alert')).toHaveTextContent('Your card was declined. Try another card.')
    expect(screen.getByLabelText('Card number')).toHaveFocus()
  })
})
