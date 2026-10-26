import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { messageFor } from './errorMessages'
import { fieldA11y } from './FormField'

interface PromoCodeFieldProps {
  applied?: { code: string; percent: number }
  onApply: (code: string) => Promise<void>
  onRemove: () => void
  error?: 'PROMO_INVALID' | 'PROMO_EXPIRED'
  disabled?: boolean
}

// States M1–M4.
const PromoCodeField: React.FC<PromoCodeFieldProps> = ({ applied, onApply, onRemove, error, disabled }) => {
  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)

  if (applied) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-sm">
          {applied.code} · {applied.percent}% off
        </Badge>
        <Button variant="link" className="h-auto p-0 text-blue-600" onClick={onRemove} disabled={disabled}>
          Remove
        </Button>
      </div>
    )
  }

  const apply = async () => {
    const value = code.trim().toUpperCase()
    if (!value) return
    setApplying(true)
    try {
      await onApply(value)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="promo-code" className="text-sm font-medium text-gray-700">
        Promo code
      </label>
      <div className="flex gap-2">
        <Input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void apply()
            }
          }}
          disabled={disabled || applying}
          autoComplete="off"
          {...fieldA11y('promo-code', error ? messageFor(error) : undefined)}
        />
        <Button type="button" variant="outline" className="h-11 border-gray-300" onClick={() => void apply()} disabled={disabled || applying}>
          {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" aria-label="Applying promo code" />}
          Apply
        </Button>
      </div>
      {error && (
        <p id="promo-code-error" className="text-sm text-red-600">
          {messageFor(error)}
        </p>
      )}
    </div>
  )
}

export default PromoCodeField
