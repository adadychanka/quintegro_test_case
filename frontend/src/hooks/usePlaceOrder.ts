import { useCallback, useEffect, useRef, useState } from 'react'
import { ApolloError, useMutation } from '@apollo/client'
import { CHECKOUT } from '@/graphql/checkout'
import { retryEvents } from '@/apollo/client'
import { errorCode, errorDetails } from '@/lib/graphqlErrors'
import { newIdempotencyKey } from '@/lib/idempotency'
import type { Order } from '@/types/order'

export interface PlaceOrderInput {
  orderId: string
  shippingAddress: Record<string, unknown>
  addressChoice: 'suggested' | 'entered'
  billingSameAsShipping: boolean
  billingAddress?: Record<string, unknown>
  paymentToken: string
  promoCode?: string
  expectedTotalCents: number
}

export type PlaceOrderResult = { ok: true; order: Order } | { ok: false; code: string; details?: Record<string, unknown> }

export type PlaceOrderStatus = 'idle' | 'submitting' | 'retrying'

// Retrying with the same key is safe for these outcomes (spec D3).
const SAME_KEY_RETRY = new Set(['PAYMENT_ERROR', 'NETWORK', 'CHECKOUT_IN_PROGRESS', 'INTERNAL'])
export const IN_PROGRESS_RETRY_MS = 2000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function usePlaceOrder() {
  const [mutate] = useMutation<{ checkout: Order }>(CHECKOUT, { errorPolicy: 'none' })
  const [status, setStatus] = useState<PlaceOrderStatus>('idle')
  const keyRef = useRef<{ key: string; hash: string; reusable: boolean } | null>(null)
  const pendingRef = useRef<Promise<PlaceOrderResult> | null>(null)

  // S5: Apollo's RetryLink reports retries of the Checkout operation.
  useEffect(
    () =>
      retryEvents.subscribe((name) => {
        if (name === 'Checkout' && pendingRef.current) setStatus('retrying')
      }),
    []
  )

  const keyFor = (input: PlaceOrderInput) => {
    const hash = JSON.stringify(input)
    const current = keyRef.current
    if (current && current.hash === hash && current.reusable) return current.key
    const key = newIdempotencyKey()
    keyRef.current = { key, hash, reusable: false }
    return key
  }

  const attempt = useCallback(
    async (input: PlaceOrderInput, idempotencyKey: string): Promise<PlaceOrderResult> => {
      try {
        const res = await mutate({ variables: { input: { ...input, idempotencyKey } } })
        if (!res.data) return { ok: false, code: 'INTERNAL' }
        return { ok: true, order: res.data.checkout }
      } catch (e) {
        const code = errorCode(e) ?? (e instanceof ApolloError ? 'INTERNAL' : 'NETWORK')
        return { ok: false, code, details: errorDetails(e) }
      }
    },
    [mutate]
  )

  const placeOrder = useCallback(
    (input: PlaceOrderInput): Promise<PlaceOrderResult> => {
      // In-flight guard: a second click returns the same pending promise (S4).
      if (pendingRef.current) return pendingRef.current

      const run = async () => {
        setStatus('submitting')
        const key = keyFor(input)
        let result = await attempt(input, key)
        // S9: another request with this key is still running: wait once, same key.
        if (!result.ok && result.code === 'CHECKOUT_IN_PROGRESS') {
          await sleep(IN_PROGRESS_RETRY_MS)
          result = await attempt(input, key)
        }
        if (result.ok) keyRef.current = null
        else if (keyRef.current) keyRef.current.reusable = SAME_KEY_RETRY.has(result.code)
        return result
      }

      const promise = run().finally(() => {
        pendingRef.current = null
        setStatus('idle')
      })
      pendingRef.current = promise
      return promise
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt]
  )

  return { placeOrder, status }
}
