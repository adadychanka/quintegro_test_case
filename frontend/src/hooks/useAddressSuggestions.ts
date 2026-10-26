import { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { ADDRESS_SUGGESTIONS } from '@/graphql/checkout'
import type { AddressSuggestion } from '@/types/order'

export const SUGGEST_DEBOUNCE_MS = 300
export const SUGGEST_MIN_CHARS = 3

// Debounced autocomplete. Errors (including RATE_LIMITED) only hide the list (A5).
export function useAddressSuggestions(query: string, enabled = true) {
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const active = enabled && debounced.trim().length >= SUGGEST_MIN_CHARS && debounced === query
  const { data, loading, error } = useQuery<{ addressSuggestions: AddressSuggestion[] }>(ADDRESS_SUGGESTIONS, {
    variables: { query: debounced.trim() },
    skip: !active,
    fetchPolicy: 'cache-first',
    errorPolicy: 'none',
  })

  return {
    active,
    suggestions: active && !error ? data?.addressSuggestions ?? [] : [],
    loading: active && loading,
    failed: active && !!error,
  }
}
