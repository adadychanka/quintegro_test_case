import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as idempotency from '@/lib/idempotency'
import { act, renderHook } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import { usePlaceOrder, PlaceOrderInput } from './usePlaceOrder'
import { CHECKOUT } from '@/graphql/checkout'
import { createCache } from '@/apollo/client'
import { gqlError, placedOrder } from '@/test/fixtures'

const input: PlaceOrderInput = {
  orderId: 'order-2',
  shippingAddress: { fullName: 'A', line1: '1 A St', city: 'X', state: 'CA', zip: '94105' },
  addressChoice: 'entered',
  billingSameAsShipping: true,
  paymentToken: 'mock_tok_visa_4242_a',
  expectedTotalCents: 100,
}

function setup(responses: Array<(i: any) => any>) {
  const keys: string[] = []
  const mocks = [
    {
      request: { query: CHECKOUT },
      variableMatcher: () => true,
      maxUsageCount: Number.POSITIVE_INFINITY,
      result: (vars: any) => {
        keys.push(vars.input.idempotencyKey)
        return responses[Math.min(keys.length - 1, responses.length - 1)](vars.input)
      },
    },
  ]
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks} cache={createCache()}>
      {children}
    </MockedProvider>
  )
  const { result } = renderHook(() => usePlaceOrder(), { wrapper })
  return { result, keys }
}

const ok = () => ({ data: { checkout: placedOrder() } })
const fail = (code: string) => () => ({ errors: [gqlError(code)] })

describe('usePlaceOrder', () => {
  it('reuses the key after a retryable error with the same input', async () => {
    const { result, keys } = setup([fail('PAYMENT_ERROR'), ok])
    await act(() => result.current.placeOrder(input))
    const second = await act(() => result.current.placeOrder(input))
    expect(second).toMatchObject({ ok: true })
    expect(keys[1]).toBe(keys[0])
  })

  it('uses a new key after a decline', async () => {
    const { result, keys } = setup([fail('PAYMENT_DECLINED'), ok])
    await act(() => result.current.placeOrder(input))
    await act(() => result.current.placeOrder(input))
    expect(keys[1]).not.toBe(keys[0])
  })

  it('uses a new key when the input changes', async () => {
    const { result, keys } = setup([fail('PAYMENT_ERROR'), ok])
    await act(() => result.current.placeOrder(input))
    await act(() => result.current.placeOrder({ ...input, paymentToken: 'mock_tok_visa_4242_b' }))
    expect(keys[1]).not.toBe(keys[0])
  })

  it('returns the pending promise for a second call', async () => {
    const { result, keys } = setup([ok])
    await act(async () => {
      const a = result.current.placeOrder(input)
      const b = result.current.placeOrder(input)
      expect(b).toBe(a)
      await a
    })
    expect(keys).toHaveLength(1)
  })

  it('maps network errors to NETWORK', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MockedProvider
        mocks={[{ request: { query: CHECKOUT }, variableMatcher: () => true, error: new Error('Failed to fetch') }]}
        cache={createCache()}
      >
        {children}
      </MockedProvider>
    )
    const { result } = renderHook(() => usePlaceOrder(), { wrapper })
    const r = await act(() => result.current.placeOrder(input))
    expect(r).toEqual({ ok: false, code: 'NETWORK', details: {} })
  })

  it('turns an unexpected exception into an error result', async () => {
    const spy = vi.spyOn(idempotency, 'newIdempotencyKey').mockImplementation(() => {
      throw new TypeError('crypto.randomUUID is not a function')
    })
    const { result } = setup([ok])
    const r = await act(() => result.current.placeOrder(input))
    expect(r).toEqual({ ok: false, code: 'INTERNAL' })
    expect(result.current.status).toBe('idle')
    spy.mockRestore()
  })
})
