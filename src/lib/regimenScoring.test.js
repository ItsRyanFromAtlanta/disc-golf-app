import { describe, it, expect } from 'vitest'
import { inferPressurePuttMade } from './regimenScoring'

describe('inferPressurePuttMade', () => {
  it('is made when the set was clean (all attempts made)', () => {
    expect(inferPressurePuttMade(10, 10)).toBe(true)
  })

  it('is missed when every attempt missed', () => {
    expect(inferPressurePuttMade(0, 10)).toBe(false)
  })

  it('conservatively assumes missed in an ambiguous mixed result', () => {
    expect(inferPressurePuttMade(6, 10)).toBe(false)
  })

  it('is missed with zero attempts', () => {
    expect(inferPressurePuttMade(0, 0)).toBe(false)
  })
})
