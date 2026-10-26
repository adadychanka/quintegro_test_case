import React, { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatAddressLines } from '@/lib/usAddress'
import type { Address } from '@/types/order'

interface AddressVerificationPanelProps {
  verdict: 'corrected' | 'undeliverable'
  entered: Address
  suggested?: Address | null
  onConfirm: (choice: 'suggested' | 'entered') => void
  disabled?: boolean
}

const oneLine = (a: Address) => formatAddressLines(a).join(', ')

// Never blocks checkout (spec D5.2). States A6–A7.
const AddressVerificationPanel: React.FC<AddressVerificationPanelProps> = ({ verdict, entered, suggested, onConfirm, disabled }) => {
  const [choice, setChoice] = useState<'suggested' | 'entered'>('suggested')

  if (verdict === 'undeliverable' || !suggested) {
    return (
      <Alert
        variant="warning"
        action={
          <Button variant="outline" className="h-9 border-gray-300" onClick={() => onConfirm('entered')} disabled={disabled}>
            Use this address
          </Button>
        }
      >
        We couldn't verify this address. Check it, or use it anyway.
      </Alert>
    )
  }

  return (
    <Alert
      variant="info"
      title="We found a more precise address"
      action={
        <Button className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium" onClick={() => onConfirm(choice)} disabled={disabled}>
          Continue
        </Button>
      }
    >
      <fieldset className="mt-2 space-y-2">
        <legend className="sr-only">Choose a shipping address</legend>
        {(['suggested', 'entered'] as const).map((value) => (
          <div key={value} className="flex items-start gap-2">
            <input
              id={`address-choice-${value}`}
              type="radio"
              name="address-choice"
              className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600"
              checked={choice === value}
              onChange={() => setChoice(value)}
              disabled={disabled}
            />
            <label htmlFor={`address-choice-${value}`} className="text-gray-900">
              {value === 'suggested' ? `Suggested: ${oneLine(suggested)}` : `As entered: ${oneLine(entered)}`}
            </label>
          </div>
        ))}
      </fieldset>
    </Alert>
  )
}

export default AddressVerificationPanel
