import { describe, it, expect } from 'vitest'
import { nextBackoffDelayMs } from './backoff'

describe('nextBackoffDelayMs', () => {
  it('doubles each attempt starting at 2s', () => {
    expect(nextBackoffDelayMs(0)).toBe(2000)
    expect(nextBackoffDelayMs(1)).toBe(4000)
    expect(nextBackoffDelayMs(2)).toBe(8000)
    expect(nextBackoffDelayMs(3)).toBe(16000)
    expect(nextBackoffDelayMs(4)).toBe(32000)
  })

  it('caps at 60s', () => {
    expect(nextBackoffDelayMs(5)).toBe(60000)
    expect(nextBackoffDelayMs(20)).toBe(60000)
  })

  it('respects custom base/cap', () => {
    expect(nextBackoffDelayMs(0, { baseMs: 1000, capMs: 5000 })).toBe(1000)
    expect(nextBackoffDelayMs(3, { baseMs: 1000, capMs: 5000 })).toBe(5000)
  })
})
