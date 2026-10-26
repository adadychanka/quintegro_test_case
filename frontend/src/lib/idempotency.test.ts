import { describe, expect, it } from 'vitest'
import { newIdempotencyKey } from './idempotency'

describe('newIdempotencyKey', () => {
  it('returns a different UUID each time', () => {
    const a = newIdempotencyKey()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(newIdempotencyKey()).not.toBe(a)
  })
})
