import { describe, expect, it } from 'vitest'
import { formatUsd } from './money'

describe('formatUsd', () => {
  it('formats cents as US dollars', () => {
    expect(formatUsd(144785)).toBe('$1,447.85')
    expect(formatUsd(0)).toBe('$0.00')
  })
})
