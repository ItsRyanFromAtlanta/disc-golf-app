import { describe, expect, it } from 'vitest'
import { highestUnlockedTier, nextCosmeticMilestone, validateOdometerInput } from './discOdometer'

describe('disc odometer rules', () => {
  it('selects the highest permanently unlocked tier regardless of row order', () => {
    expect(highestUnlockedTier([{ tier: 'epic' }, { tier: 'rare' }])).toBe('epic')
    expect(highestUnlockedTier(['legendary', 'rare'])).toBe('legendary')
    expect(highestUnlockedTier([])).toBe('common')
  })

  it('finds the next fixed chain-hit milestone', () => {
    expect(nextCosmeticMilestone(250, [])).toEqual({ tier: 'rare', threshold: 300, remaining: 50 })
    expect(nextCosmeticMilestone(650, [{ tier: 'rare' }])).toEqual({ tier: 'epic', threshold: 1000, remaining: 350 })
    expect(nextCosmeticMilestone(6000, [{ tier: 'rare' }, { tier: 'epic' }, { tier: 'legendary' }])).toBeNull()
  })

  it('accepts bounded whole-number increments', () => {
    expect(validateOdometerInput({ metric: 'throws', delta: '25' })).toMatchObject({
      metric: 'throws', delta: 25, source: 'manual_entry', reason: null,
    })
  })

  it('requires a reason and correction source for negative deltas', () => {
    expect(() => validateOdometerInput({ metric: 'chain_hits', delta: -1 })).toThrow('corrections')
    expect(() => validateOdometerInput({ metric: 'chain_hits', delta: -1, source: 'manual_correction' })).toThrow('reason')
    expect(validateOdometerInput({ metric: 'chain_hits', delta: -1, source: 'manual_correction', reason: 'Duplicate' })).toMatchObject({ delta: -1, reason: 'Duplicate' })
  })

  it('rejects invalid metrics, fractions, zero, and oversized changes', () => {
    expect(() => validateOdometerInput({ metric: 'aces', delta: 1 })).toThrow('metric')
    expect(() => validateOdometerInput({ metric: 'throws', delta: 1.5 })).toThrow('whole number')
    expect(() => validateOdometerInput({ metric: 'throws', delta: 0 })).toThrow('whole number')
    expect(() => validateOdometerInput({ metric: 'throws', delta: 10001 })).toThrow('whole number')
  })
})
