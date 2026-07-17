import { describe, expect, it } from 'vitest'
import {
  buildBagComparison,
  buildDiscComparison,
  resolveCommunityCohort,
} from './discCompare'

const disc = (id, overrides = {}) => ({
  id,
  moldInfo: { speed: 7, glide: 5, turn: -1, fade: 2 },
  ...overrides,
})

describe('disc comparison cohorts', () => {
  it('separates personal effective numbers from official catalog numbers', () => {
    const selected = [disc('worn', { override_turn: 1 })]
    expect(buildDiscComparison(selected).rows[0].numbers.turn).toBe(1)
    expect(buildDiscComparison(selected, { source: 'official' }).rows[0].numbers.turn).toBe(-1)
  })

  it('requires an attributed minimum sample before showing community data', () => {
    expect(resolveCommunityCohort([{ id: 'small', sampleSize: 9 }]).status).toBe('unavailable')
    expect(resolveCommunityCohort([
      { id: 'small', sampleSize: 12 },
      { id: 'large', sampleSize: 30 },
    ]).candidate.id).toBe('large')
  })

  it('summarizes a bag without turning it into an opaque score', () => {
    const summary = buildBagComparison([
      disc('a'),
      disc('b', { moldInfo: { speed: 3, glide: 3, turn: 0, fade: 1 } }),
    ], 10)
    expect(summary).toMatchObject({ discCount: 2, capacity: 10, headroom: 8, missingFlightProfiles: 0 })
    expect(summary.speedClasses).toEqual(['putter', 'fairway'])
    expect(summary.nearIdenticalPairs).toHaveLength(0)
  })
})
