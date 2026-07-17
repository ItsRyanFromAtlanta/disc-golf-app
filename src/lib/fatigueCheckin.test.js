import { describe, expect, it } from 'vitest'
import { fatigueCheckinTrigger } from './fatigueCheckin'

describe('fatigueCheckinTrigger', () => {
  it('requires three trailing misses', () => {
    expect(fatigueCheckinTrigger({ outcomes: ['make', 'miss', 'miss'] })).toBeNull()
    expect(fatigueCheckinTrigger({ outcomes: ['make', 'miss', 'miss', 'miss'] })).toBe('trailing_misses')
  })

  it('detects a sampled twenty-point stage drop', () => {
    expect(fatigueCheckinTrigger({
      outcomes: [], stage: { makes: 3, attempts: 10 }, previousStages: [{ makes: 8, attempts: 10 }],
    })).toBe('stage_drop')
  })

  it('ignores under-sampled stages', () => {
    expect(fatigueCheckinTrigger({
      outcomes: [], stage: { makes: 0, attempts: 4 }, previousStages: [{ makes: 5, attempts: 5 }],
    })).toBeNull()
  })
})
