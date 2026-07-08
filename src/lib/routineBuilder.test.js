import { describe, it, expect } from 'vitest'
import {
  blankStage,
  totalPutts,
  canAddStage,
  estimateDifficulty,
  buildRegimenPayload,
  maxScorePreview,
  MAX_STAGES,
} from './routineBuilder'
import { computeSetScore, computeCompletionBonus } from './regimenScoring'

describe('totalPutts / blankStage', () => {
  it('sums putts across stages', () => {
    expect(totalPutts([{ putts: 10 }, { putts: 5 }])).toBe(15)
    expect(totalPutts([])).toBe(0)
  })

  it('blankStage seeds the blueprint smart default (20ft / 10 putts)', () => {
    expect(blankStage()).toEqual({ distanceFt: 20, putts: 10, pressure: false })
  })
})

describe('canAddStage (100-putt interlock, app side)', () => {
  it('always allows adding to an empty routine', () => {
    expect(canAddStage([])).toBe(true)
  })

  it('allows a duplicate stage that lands exactly on 100', () => {
    const nine = Array.from({ length: 9 }, () => ({ putts: 10 })) // 90 total, last=10 -> 100
    expect(canAddStage(nine)).toBe(true)
  })

  it('blocks a duplicate stage that would exceed 100', () => {
    const ten = Array.from({ length: 10 }, () => ({ putts: 10 })) // 100 total, +10 -> 110
    expect(canAddStage(ten)).toBe(false)
  })

  it('blocks once the 20-stage ceiling is reached', () => {
    const twenty = Array.from({ length: MAX_STAGES }, () => ({ putts: 1 }))
    expect(canAddStage(twenty)).toBe(false)
  })
})

describe('estimateDifficulty', () => {
  it('defaults to 1 for an empty routine', () => {
    expect(estimateDifficulty([])).toBe(1)
  })

  it('bands 1-4 by weighted average distance', () => {
    expect(estimateDifficulty([{ distanceFt: 15, putts: 10, pressure: false }])).toBe(1)
    expect(estimateDifficulty([{ distanceFt: 20, putts: 10, pressure: false }])).toBe(2)
    expect(estimateDifficulty([{ distanceFt: 25, putts: 10, pressure: false }])).toBe(3)
    expect(estimateDifficulty([{ distanceFt: 33, putts: 10, pressure: false }])).toBe(4)
  })

  it('bumps for a pressure stage', () => {
    expect(estimateDifficulty([{ distanceFt: 15, putts: 10, pressure: true }])).toBe(2)
  })

  it('bumps for sustained volume (>= 60 putts)', () => {
    const highVolume = [
      { distanceFt: 20, putts: 20, pressure: false },
      { distanceFt: 20, putts: 20, pressure: false },
      { distanceFt: 20, putts: 20, pressure: false },
    ]
    expect(estimateDifficulty(highVolume)).toBe(3) // band 2 + volume bump
  })

  it('clamps to 5 when bumps stack past the ceiling', () => {
    const brutal = [
      { distanceFt: 33, putts: 30, pressure: true },
      { distanceFt: 33, putts: 30, pressure: true },
    ] // band 4 + volume + pressure = 6 -> clamp 5
    expect(estimateDifficulty(brutal)).toBe(5)
  })
})

describe('buildRegimenPayload', () => {
  it('maps builder state onto typed columns and set rows', () => {
    const { regimen, sets } = buildRegimenPayload('u1', {
      name: '  My Routine  ',
      stages: [
        { distanceFt: 20, putts: 10, pressure: true },
        { distanceFt: 25, putts: 5, pressure: false },
      ],
      bonuses: { streak: true, clean: false, completion: true },
    })

    expect(regimen.user_id).toBe('u1')
    expect(regimen.name).toBe('My Routine') // trimmed
    expect(regimen.drill_type).toBe('custom')
    expect(regimen.streak_step).toBe(0.1) // streak on
    expect(regimen.no_miss_bonus_pct).toBe(0) // clean off
    expect(regimen.completion_bonus).toBe(50) // completion on
    expect(regimen.archived).toBe(false)
    expect(regimen.rules_config).toEqual({
      version: 1,
      stages: [
        { distanceFt: 20, putts: 10, pressure: true },
        { distanceFt: 25, putts: 5, pressure: false },
      ],
    })

    expect(sets).toEqual([
      { set_order: 1, distance_feet_min: 20, distance_feet_max: 20, reps_required: 10, pressure_multiplier: 2 },
      { set_order: 2, distance_feet_min: 25, distance_feet_max: 25, reps_required: 5, pressure_multiplier: 1 },
    ])
  })
})

describe('maxScorePreview', () => {
  it('returns 0 for an empty routine', () => {
    expect(maxScorePreview({ stages: [], bonuses: { streak: false, clean: false, completion: false } })).toBe(0)
  })

  it('equals a perfect-run scored by the shipped engine (all bonuses on)', () => {
    const stages = [{ distanceFt: 20, putts: 10, pressure: true }]
    const bonuses = { streak: true, clean: true, completion: true }

    // Independent hand-check against the same engine the run page uses.
    const { regimen, sets } = buildRegimenPayload(null, { name: '', stages, bonuses })
    const { points } = computeSetScore(regimen, sets[0], {
      makes: 10,
      attempts: 10,
      longestStreak: 10,
      pressurePuttMade: true,
    })
    const expected = points + computeCompletionBonus(regimen, true)

    expect(maxScorePreview({ stages, bonuses })).toBe(expected)
    expect(expected).toBe(221) // 171 set points + 50 completion
  })

  it('scores a bonus-free routine as plain base points per putt', () => {
    const stages = [{ distanceFt: 15, putts: 5, pressure: false }]
    const bonuses = { streak: false, clean: false, completion: false }
    expect(maxScorePreview({ stages, bonuses })).toBe(50) // 5 makes * 10 base
  })
})
