import { describe, expect, it } from 'vitest'
import {
  buildDiscComparison,
  COMPARE_MAX,
  COMPARE_MIN,
  findNearIdenticalDiscPairs,
  NEAR_IDENTICAL_AXIS_DELTA,
} from './discCompare'

const baseMold = { manufacturer: 'MVP', mold_name: 'Photon', speed: 11, glide: 5, turn: -1, fade: 2 }

function disc(id, overrides = {}, mold = baseMold) {
  return { id, moldInfo: mold, ...overrides }
}

describe('disc comparison rules', () => {
  it('keeps the approved selection bounds and explicit near-identical threshold', () => {
    expect(COMPARE_MIN).toBe(2)
    expect(COMPARE_MAX).toBe(4)
    expect(NEAR_IDENTICAL_AXIS_DELTA).toBe(1)
  })

  it('derives per-axis min and max values from effective numbers, including ties', () => {
    const discs = [
      disc('a', { override_speed: 9, override_turn: -2 }),
      disc('b', { override_speed: 9, override_turn: 0 }),
      disc('c', { override_speed: 12, override_turn: 1 }),
    ]

    const comparison = buildDiscComparison(discs)

    expect(comparison.extremes.speed).toEqual({
      min: 9,
      max: 12,
      minIds: ['a', 'b'],
      maxIds: ['c'],
    })
    expect(comparison.extremes.turn).toEqual({
      min: -2,
      max: 1,
      minIds: ['a'],
      maxIds: ['c'],
    })
  })

  it('flags a pair only when all four effective axes are within the threshold', () => {
    const close = disc('close', { override_speed: 11.5, override_glide: 5.5, override_turn: -0.5, override_fade: 2.5 })
    const far = disc('far', { override_speed: 11, override_glide: 5, override_turn: -1, override_fade: 4 })

    expect(findNearIdenticalDiscPairs([disc('base'), close])).toEqual([
      {
        discIds: ['base', 'close'],
        deltas: { speed: 0.5, glide: 0.5, turn: 0.5, fade: 0.5 },
        maxDelta: 0.5,
      },
    ])
    expect(findNearIdenticalDiscPairs([disc('base'), far])).toEqual([])
  })

  it('does not invent a near-identical relationship when an axis is missing', () => {
    const sparseMold = { manufacturer: 'MVP', mold_name: 'Sparse', speed: 5, glide: 4, turn: -1, fade: null }
    expect(findNearIdenticalDiscPairs([disc('a', {}, sparseMold), disc('b', {}, sparseMold)])).toEqual([])
  })
})
