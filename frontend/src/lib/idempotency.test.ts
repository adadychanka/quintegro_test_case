import { afterEach, describe, expect, it, vi } from 'vitest'
import { newIdempotencyKey } from './idempotency'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newIdempotencyKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a different UUID each time', () => {
    const a = newIdempotencyKey()
    expect(a).toMatch(UUID_V4)
    expect(newIdempotencyKey()).not.toBe(a)
  })

  it('works without crypto.randomUUID (plain HTTP on a non-localhost host)', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    const a = newIdempotencyKey()
    expect(a).toMatch(UUID_V4)
    expect(newIdempotencyKey()).not.toBe(a)
  })
})
