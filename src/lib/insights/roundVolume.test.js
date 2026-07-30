import { describe, expect, it } from 'vitest'
import { roundStreak, roundVolumeLedger } from './roundVolume'

const holes = [
  { id: 'hole-1', par: 3 },
  { id: 'hole-2', par: 4 },
]

function scorecardRound(overrides = {}) {
  return {
    holes,
    round_holes: [
      { hole_id: 'hole-1', score: 3 },
      { hole_id: 'hole-2', score: 4 },
    ],
    ...overrides,
  }
}

function activityOnlyRound(overrides = {}) {
  return { scoring_mode: 'activity_only', ...overrides }
}

describe('roundVolumeLedger', () => {
  it('reports no coverage information at all for an empty history', () => {
    // null, not 0. Zero rounds is the absence of coverage information, and a
    // "0% scored" reading would be a claim about a history that does not exist.
    expect(roundVolumeLedger([])).toEqual({
      rounds: 0,
      scorecard: 0,
      activityOnly: 0,
      scored: 0,
      unscored: 0,
      completeScorecards: 0,
      scoringCoverage: null,
    })
  })

  it('counts activity-only rounds as rounds — the whole point of the feature', () => {
    const ledger = roundVolumeLedger([scorecardRound(), activityOnlyRound(), activityOnlyRound()])
    expect(ledger.rounds).toBe(3)
    expect(ledger.scorecard).toBe(1)
    expect(ledger.activityOnly).toBe(2)
  })

  it('counts a stated total as scored and reports the resulting coverage', () => {
    const ledger = roundVolumeLedger([
      scorecardRound(),
      activityOnlyRound({ total_score: 54 }),
      activityOnlyRound(),
    ])
    expect(ledger.scored).toBe(2)
    expect(ledger.unscored).toBe(1)
    expect(ledger.scoringCoverage).toBeCloseTo(2 / 3)
  })

  it('counts an empty scorecard as unscored, not as a zero', () => {
    const ledger = roundVolumeLedger([scorecardRound({ round_holes: [] })])
    expect(ledger.scored).toBe(0)
    expect(ledger.unscored).toBe(1)
    expect(ledger.completeScorecards).toBe(0)
    expect(ledger.scoringCoverage).toBe(0)
  })

  it('counts only fully-entered cards as complete', () => {
    const ledger = roundVolumeLedger([
      scorecardRound(),
      scorecardRound({ round_holes: [{ hole_id: 'hole-1', score: 3 }] }),
      // An activity-only round is never "complete" — there is no card to
      // complete — so it must not inflate this count even with a stated total.
      activityOnlyRound({ holes, total_score: 7 }),
    ])
    expect(ledger.completeScorecards).toBe(1)
    expect(ledger.rounds).toBe(3)
  })
})

describe('roundStreak', () => {
  const now = new Date(2026, 6, 30, 18, 0, 0)
  const day = (offset) => new Date(2026, 6, 30 - offset, 9, 0, 0).toISOString()

  it('counts consecutive days back from today', () => {
    const rounds = [{ played_at: day(0) }, { played_at: day(1) }, { played_at: day(2) }]
    expect(roundStreak(rounds, now)).toBe(3)
  })

  it('does not break a streak until a full day is missed', () => {
    // Nothing played today yet, but yesterday and the day before were — the
    // streak is alive at 2, exactly as `practiceStreak` treats practice.
    expect(roundStreak([{ played_at: day(1) }, { played_at: day(2) }], now)).toBe(2)
  })

  it('stops at the first gap', () => {
    expect(roundStreak([{ played_at: day(0) }, { played_at: day(2) }], now)).toBe(1)
  })

  it('counts two rounds on one day once', () => {
    expect(roundStreak([{ played_at: day(0) }, { played_at: day(0) }], now)).toBe(1)
  })

  it('keeps an activity-only round in the streak', () => {
    // History, streaks and volume are the reason a scoreless round is worth
    // recording at all. If it did not hold a streak the feature would be inert.
    expect(roundStreak([activityOnlyRound({ played_at: day(0) })], now)).toBe(1)
  })

  it('falls back to created_at and drops rounds that cannot be dated', () => {
    expect(roundStreak([{ created_at: day(0) }], now)).toBe(1)
    expect(roundStreak([{ played_at: null, created_at: null }], now)).toBe(0)
    expect(roundStreak([{ played_at: 'not a date' }], now)).toBe(0)
    expect(roundStreak([], now)).toBe(0)
  })
})
