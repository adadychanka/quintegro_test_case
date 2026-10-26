import React, { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAddressSuggestions } from '@/hooks/useAddressSuggestions'
import type { Address } from '@/types/order'

interface AddressAutocompleteProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSelect' | 'value'> {
  id: string
  value: string
  onChange: (value: string) => void
  onSelect: (address: Address) => void
}

// WAI-ARIA combobox with a listbox of address suggestions (states A2–A5).
const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ id, value, onChange, onSelect, className, onBlur, ...inputProps }) => {
  const listId = useId()
  const [typed, setTyped] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const { suggestions, loading, failed, active: querying } = useAddressSuggestions(value, typed)

  const showList = open && typed && querying && !loading && !failed
  const optionId = (i: number) => `${listId}-option-${i}`

  const choose = (address: Address) => {
    onSelect(address)
    setTyped(false)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(suggestions[active].address)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setTyped(true)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Let a click on an option land before closing.
          setTimeout(() => setOpen(false), 150)
          onBlur?.(e)
        }}
        className={cn('pr-10', className)}
        {...inputProps}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-blue-600" aria-label="Loading suggestions" />
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li role="option" aria-disabled="true" aria-selected="false" className="px-3 py-2 text-sm text-gray-600">
              No matches. Keep typing or enter the address manually.
            </li>
          ) : (
            suggestions.slice(0, 5).map((s, i) => (
              <li
                key={s.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(s.address)
                }}
                className={cn('cursor-pointer px-3 py-2 text-sm text-gray-900 hover:bg-blue-50', i === active && 'bg-blue-50')}
              >
                {s.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default AddressAutocomplete
