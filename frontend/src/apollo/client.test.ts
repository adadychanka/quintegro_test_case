import { describe, expect, it } from 'vitest'
import { retryIf } from './client'

const op = (operationName: string) => ({ operationName }) as never

describe('retryIf', () => {
  it('retries retryable operations on 5xx and network errors', () => {
    expect(retryIf({ statusCode: 500 }, op('Checkout'))).toBe(true)
    expect(retryIf(new TypeError('Failed to fetch'), op('Cart'))).toBe(true)
  })

  it('does not retry other mutations or 4xx', () => {
    expect(retryIf({ statusCode: 500 }, op('UpdateItemAmount'))).toBe(false)
    expect(retryIf({ statusCode: 400 }, op('Checkout'))).toBe(false)
  })

  it('does not retry without an error', () => {
    expect(retryIf(undefined, op('Checkout'))).toBe(false)
  })
})
