import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { CardField, CardForm, formatCardNumber, validateCard } from '@/lib/mockCardTokenizer'
import { AddressField, AddressForm } from '@/lib/usAddress'
import AddressFields from './AddressFields'
import FormField, { fieldA11y } from './FormField'
import { messageFor } from './errorMessages'

interface PaymentSectionProps {
  card: CardForm
  onCardChange: (card: CardForm) => void
  billingSame: boolean
  onBillingSameChange: (same: boolean) => void
  billing: AddressForm
  onBillingChange: (billing: AddressForm) => void
  cardErrors?: Partial<Record<CardField, string>>
  billingErrors?: Partial<Record<AddressField, string>>
  declined?: boolean
  disabled?: boolean
}

// Mock card form standing in for the provider's component (spec D1). States P1–P4.
const PaymentSection: React.FC<PaymentSectionProps> = ({
  card,
  onCardChange,
  billingSame,
  onBillingSameChange,
  billing,
  onBillingChange,
  cardErrors = {},
  billingErrors = {},
  declined = false,
  disabled,
}) => {
  const [touched, setTouched] = useState<Partial<Record<CardField, boolean>>>({})
  const numberRef = useRef<HTMLInputElement>(null)
  const local = validateCard(card)
  const errorOf = (f: CardField) => cardErrors[f] ?? (touched[f] ? local[f] : undefined)
  const blur = (f: CardField) => () => setTouched((t) => ({ ...t, [f]: true }))

  useEffect(() => {
    if (declined) numberRef.current?.focus()
  }, [declined])

  return (
    <div className="space-y-6">
      {declined && <Alert variant="error">{messageFor('PAYMENT_DECLINED')}</Alert>}
      <p className="text-sm text-gray-600">Test mode: use card 4242 4242 4242 4242, any future date and any 3 digits.</p>
      <FormField id="card-number" label="Card number" error={errorOf('number')}>
        <Input
          ref={numberRef}
          id="card-number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 1234 1234 1234"
          value={card.number}
          disabled={disabled}
          onChange={(e) => onCardChange({ ...card, number: formatCardNumber(e.target.value) })}
          onBlur={blur('number')}
          {...fieldA11y('card-number', errorOf('number'))}
        />
      </FormField>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id="card-expiry" label="Expiration (MM/YY)" error={errorOf('expiry')}>
          <Input
            id="card-expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={card.expiry}
            disabled={disabled}
            onChange={(e) => onCardChange({ ...card, expiry: e.target.value })}
            onBlur={blur('expiry')}
            {...fieldA11y('card-expiry', errorOf('expiry'))}
          />
        </FormField>
        <FormField id="card-cvc" label="Security code" error={errorOf('cvc')}>
          <Input
            id="card-cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC"
            value={card.cvc}
            disabled={disabled}
            onChange={(e) => onCardChange({ ...card, cvc: e.target.value })}
            onBlur={blur('cvc')}
            {...fieldA11y('card-cvc', errorOf('cvc'))}
          />
        </FormField>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="billing-same"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
          checked={billingSame}
          disabled={disabled}
          onChange={(e) => onBillingSameChange(e.target.checked)}
        />
        <label htmlFor="billing-same" className="text-sm font-medium text-gray-700">
          Billing address same as shipping
        </label>
      </div>
      {!billingSame && (
        <fieldset role="group" aria-labelledby="billing-legend" className="space-y-4">
          <legend id="billing-legend" className="text-base font-semibold text-gray-900">
            Billing address
          </legend>
          <AddressFields idPrefix="billing" value={billing} onChange={onBillingChange} errors={billingErrors} disabled={disabled} />
        </fieldset>
      )}
    </div>
  )
}

export default PaymentSection
