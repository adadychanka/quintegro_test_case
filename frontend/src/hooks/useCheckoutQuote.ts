import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import { CHECKOUT_QUOTE } from '@/graphql/checkout'
import { errorCode } from '@/lib/graphqlErrors'
import { AddressForm, isAddressComplete, toAddressInput } from '@/lib/usAddress'
import type { Pricing } from '@/types/order'
import type { SummaryState } from '@/components/checkout/OrderSummary'

export const QUOTE_DEBOUNCE_MS = 500

// Server price preview. The address is sent only when complete; address edits are
// debounced. Apollo drops responses for outdated variables, so `pricing` always
// matches the latest address and promo (no false PRICE_CHANGED).
export function useCheckoutQuote({ address, promoCode, skip = false }: { address: AddressForm; promoCode?: string; skip?: boolean }) {
  const shippingAddress = useMemo(() => (isAddressComplete(address) ? toAddressInput(address) : undefined), [address])
  const addressKey = JSON.stringify(shippingAddress ?? null)
  const [debouncedKey, setDebouncedKey] = useState(addressKey)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKey(addressKey), QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [addressKey])

  const variables = useMemo(
    () => ({ promoCode: promoCode || undefined, shippingAddress: JSON.parse(debouncedKey) ?? undefined }),
    [promoCode, debouncedKey]
  )

  const { data, loading, error, refetch } = useQuery<{ checkoutQuote: Pricing }>(CHECKOUT_QUOTE, {
    variables,
    skip,
    fetchPolicy: 'network-only',
    errorPolicy: 'none',
    notifyOnNetworkStatusChange: true,
  })

  const settling = debouncedKey !== addressKey
  const pricing = loading || settling ? undefined : data?.checkoutQuote

  let state: SummaryState
  if (loading || settling || (!data && !error)) state = 'loading'
  else if (error) state = 'error'
  else if (!shippingAddress) state = 'pending-address'
  else state = 'ready'

  return { pricing, state, errorCode: error ? errorCode(error) : undefined, refetch: () => void refetch() }
}
