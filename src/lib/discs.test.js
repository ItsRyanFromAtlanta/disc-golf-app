import { describe, it, expect } from 'vitest'
import { effectiveFlightNumbers } from './discs'

const mold = { speed: 9, glide: 5, turn: -1, fade: 2 }

describe('effectiveFlightNumbers', () => {
  it('falls back to the mold stock number when no override is set', () => {
    const disc = { override_speed: null, override_glide: null, override_turn: null, override_fade: null }
    expect(effectiveFlightNumbers(disc, mold)).toEqual({ speed: 9, glide: 5, turn: -1, fade: 2 })
  })

  it('uses the override on each axis where present', () => {
    const disc = { override_speed: 9, override_glide: 4, override_turn: -3, override_fade: 3 }
    expect(effectiveFlightNumbers(disc, mold)).toEqual({ speed: 9, glide: 4, turn: -3, fade: 3 })
  })

  it('mixes overrides and stock per axis', () => {
    const disc = { override_turn: -2 } // only turn overridden (beat in)
    expect(effectiveFlightNumbers(disc, mold)).toEqual({ speed: 9, glide: 5, turn: -2, fade: 2 })
  })

  it('respects an override of 0 (0 is a valid turn/fade, not "missing")', () => {
    const disc = { override_turn: 0, override_fade: 0 }
    expect(effectiveFlightNumbers(disc, mold)).toEqual({ speed: 9, glide: 5, turn: 0, fade: 0 })
  })

  it('returns null on an axis where neither override nor stock exists', () => {
    const disc = { override_speed: 12 }
    const sparseMold = { speed: null, glide: null, turn: null, fade: null }
    expect(effectiveFlightNumbers(disc, sparseMold)).toEqual({ speed: 12, glide: null, turn: null, fade: null })
  })

  it('handles a missing mold (unlinked disc) without throwing', () => {
    expect(effectiveFlightNumbers({ override_speed: 7 }, null)).toEqual({
      speed: 7,
      glide: null,
      turn: null,
      fade: null,
    })
  })
})
