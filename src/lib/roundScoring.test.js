import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROUND_SCORING_MODE,
  ROUND_SCORING_MODES,
  expectsScorecard,
  isActivityOnlyRound,
  roundScoreSummary,
  roundScoringMode,
  roundScoringModeFields,
  scoringModeLabel,
} from './roundScoring'

const holes = [
  { id: 'hole-1', par: 3 },
  { id: 'hole-2', par: 4 },
  { id: 'hole-3', par: 3 },
]

describe('roundScoringMode', () => {
  it('defaults to hole_by_hole for a round that predates the column', () => {
    // The deploy window this has to survive: the client is live, the migration
    // is not, and every row it reads back has no `scoring_mode` at all.
    expect(roundScoringMode({})).toBe('hole_by_hole')
    expect(roundScoringMode({ scoring_mode: null })).toBe('hole_by_hole')
    expect(roundScoringMode(undefined)).toBe('hole_by_hole')
    expect(roundScoringMode(null)).toBe(DEFAULT_ROUND_SCORING_MODE)
  })

  it('reads a recorded mode, case- and whitespace-insensitively', () => {
    expect(roundScoringMode({ scoring_mode: 'activity_only' })).toBe('activity_only')
    expect(roundScoringMode({ scoring_mode: ' ACTIVITY_ONLY ' })).toBe('activity_only')
  })

  it('treats an unknown value as the default rather than propagating it', () => {
    // A value outside the CHECK cannot exist server-side, but a stale local
    // mirror or a future mode read by an older client can produce one. Falling
    // back to the scorecard mode is the safe direction: it shows the card.
    expect(roundScoringMode({ scoring_mode: 'freeform' })).toBe('hole_by_hole')
    expect(roundScoringMode({ scoring_mode: 42 })).toBe('hole_by_hole')
  })

  it('exposes the vocabulary and its predicates', () => {
    expect(ROUND_SCORING_MODES).toEqual(['hole_by_hole', 'activity_only'])
    expect(isActivityOnlyRound({ scoring_mode: 'activity_only' })).toBe(true)
    expect(isActivityOnlyRound({})).toBe(false)
    expect(expectsScorecard({})).toBe(true)
    expect(expectsScorecard({ scoring_mode: 'activity_only' })).toBe(false)
    expect(scoringModeLabel('activity_only')).toBe('No scorecard')
    expect(scoringModeLabel('hole_by_hole')).toBe('Scorecard')
  })
})

describe('roundScoringModeFields', () => {
  it('writes nothing at all for the default mode', () => {
    // This is the deploy-window narrowing, not tidiness: an ordinary scorecard
    // round must send the exact payload it sent before this feature existed, so
    // it keeps working while the migration is in flight.
    expect(roundScoringModeFields('hole_by_hole')).toEqual({})
    expect(roundScoringModeFields(null)).toEqual({})
    expect(roundScoringModeFields(undefined)).toEqual({})
    expect(roundScoringModeFields('nonsense')).toEqual({})
  })

  it('writes the column only for an activity-only round', () => {
    expect(roundScoringModeFields('activity_only')).toEqual({ scoring_mode: 'activity_only' })
    expect(roundScoringModeFields(' Activity_Only ')).toEqual({ scoring_mode: 'activity_only' })
  })
})

describe('roundScoreSummary — scorecard rounds', () => {
  it('derives total and relative-to-par from entered holes', () => {
    const summary = roundScoreSummary({
      holes,
      round_holes: [
        { hole_id: 'hole-1', score: 4 },
        { hole_id: 'hole-2', score: 4 },
        { hole_id: 'hole-3', score: 2 },
      ],
    })
    expect(summary.total).toBe(10)
    expect(summary.totalSource).toBe('scorecard')
    expect(summary.relativeToPar).toBe(0)
    expect(summary.relativeToParSource).toBe('scorecard')
    expect(summary.complete).toBe(true)
  })

  it('reports a sparse card as a running position, not a projection', () => {
    const summary = roundScoreSummary({
      holes,
      round_holes: [{ hole_id: 'hole-1', score: 4 }],
    })
    expect(summary.total).toBe(4)
    expect(summary.relativeToPar).toBe(1)
    expect(summary.scoredHoles).toBe(1)
    expect(summary.totalHoles).toBe(3)
    expect(summary.complete).toBe(false)
  })

  it('returns null rather than an even-par claim on an unscored card', () => {
    // The defect this function exists to close. `relativeToPar([], holes)` is
    // 0, which `formatRelativeToPar` renders as "E" — so a round with nothing
    // entered would announce itself as even par. Three screens each guarded
    // against that separately; the guarantee lives here now.
    const summary = roundScoreSummary({ holes, round_holes: [] })
    expect(summary.total).toBeNull()
    expect(summary.totalSource).toBeNull()
    expect(summary.relativeToPar).toBeNull()
    expect(summary.relativeToParSource).toBeNull()
    expect(summary.complete).toBe(false)
  })

  it('does not count an orphan hole row towards completeness', () => {
    // A card can hold a row for a hole the layout no longer has. Counting rows
    // instead of layout holes would let a three-hole layout look complete on
    // two holes plus the orphan.
    const summary = roundScoreSummary({
      holes,
      round_holes: [
        { hole_id: 'hole-1', score: 3 },
        { hole_id: 'hole-2', score: 4 },
        { hole_id: 'hole-retired', score: 5 },
      ],
    })
    expect(summary.scoredHoles).toBe(3)
    expect(summary.complete).toBe(false)
  })

  it('tolerates a round with no holes and no rows at all', () => {
    const summary = roundScoreSummary({})
    expect(summary.total).toBeNull()
    expect(summary.relativeToPar).toBeNull()
    expect(summary.totalHoles).toBe(0)
    expect(summary.complete).toBe(false)
  })
})

describe('roundScoreSummary — activity-only rounds', () => {
  const activityOnly = { scoring_mode: 'activity_only' }

  it('reports nothing when no total was stated', () => {
    const summary = roundScoreSummary({ ...activityOnly, holes })
    expect(summary.mode).toBe('activity_only')
    expect(summary.total).toBeNull()
    expect(summary.totalSource).toBeNull()
    expect(summary.relativeToPar).toBeNull()
  })

  it('labels a stated total as stated, never as a scorecard', () => {
    const summary = roundScoreSummary({ ...activityOnly, holes, total_score: 12 })
    expect(summary.total).toBe(12)
    expect(summary.totalSource).toBe('stated')
    expect(summary.relativeToPar).toBe(2)
    expect(summary.relativeToParSource).toBe('stated_vs_par')
  })

  it('withholds relative-to-par when no layout par is known', () => {
    // Without a layout there is nothing to be relative to. Reporting the raw
    // total as a score to par is the failure mode being prevented.
    const noLayout = roundScoreSummary({ ...activityOnly, total_score: 54 })
    expect(noLayout.total).toBe(54)
    expect(noLayout.relativeToPar).toBeNull()

    const parlessHoles = roundScoreSummary({
      ...activityOnly,
      total_score: 54,
      holes: [{ id: 'a', par: null }, { id: 'b', par: null }],
    })
    expect(parlessHoles.relativeToPar).toBeNull()
  })

  it('ignores hole rows that survive a mode change', () => {
    // Scores entered before a round became activity-only are not deleted — the
    // project rule is that corrections preserve previous values — but they must
    // not silently become the total either.
    const summary = roundScoreSummary({
      ...activityOnly,
      holes,
      round_holes: [{ hole_id: 'hole-1', score: 3 }],
      total_score: null,
    })
    expect(summary.total).toBeNull()
    expect(summary.scoredHoles).toBe(1)
    expect(summary.complete).toBeNull()
  })

  it('treats a blank or unparseable stated total as not recorded', () => {
    expect(roundScoreSummary({ ...activityOnly, total_score: '' }).total).toBeNull()
    expect(roundScoreSummary({ ...activityOnly, total_score: 'fifty' }).total).toBeNull()
    expect(roundScoreSummary({ ...activityOnly, total_score: '54' }).total).toBe(54)
  })
})
