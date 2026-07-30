import { isActivityOnlyRound, roundScoreSummary } from '../roundScoring'

// Round volume, streak, and scoring coverage.
//
// This module exists because activity-only rounds are pointless unless
// *something* counts them. The whole argument for logging a round you did not
// score is that it happened: it belongs in your history, it keeps a streak
// alive, and it is one more round of volume. So the rule that runs through
// here is the mirror of the one in `roundConditions.js`:
//
//   Anything that counts ROUNDS counts activity-only rounds.
//   Anything that averages STROKES excludes them.
//
// Getting that backwards in either direction is a real defect. Excluding them
// from volume makes the feature a no-op; including them in a scoring average
// makes every average wrong by however many blanks it swallowed.

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function playedAt(round) {
  // `played_at` is the round's own date and the one a player would name.
  // `created_at` is the fallback for an imported or hand-written row that never
  // got one; a round with neither cannot be placed on a calendar at all and is
  // dropped rather than dated to today.
  const value = round?.played_at ?? round?.created_at ?? null
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * What has been logged, split by how it was captured — a ledger, not a verdict.
 *
 * `scoringCoverage` is the fraction of rounds that carry a usable score, and it
 * is reported rather than hidden for the same reason `conditionLedger` reports
 * `unrecorded`: a reader looking at a scoring average has to be able to see how
 * much of their history it actually covers. It is `null`, not 0, when there are
 * no rounds — zero rounds is no coverage information, not zero coverage.
 */
export function roundVolumeLedger(rounds = []) {
  let activityOnly = 0
  let scorecard = 0
  let scored = 0
  let complete = 0

  for (const round of rounds) {
    const summary = roundScoreSummary(round)
    if (isActivityOnlyRound(round)) {
      activityOnly += 1
      // A stated total is a score. It is not a scorecard, and nothing derived
      // from holes may use it, but it answers "how did you shoot?" — so it
      // counts here and is deliberately labelled by its source elsewhere.
      if (summary.total != null) scored += 1
      continue
    }
    scorecard += 1
    if (summary.total != null) scored += 1
    if (summary.complete) complete += 1
  }

  const total = activityOnly + scorecard
  return {
    rounds: total,
    scorecard,
    activityOnly,
    scored,
    unscored: total - scored,
    completeScorecards: complete,
    scoringCoverage: total === 0 ? null : scored / total,
  }
}

/**
 * Consecutive days with at least one round, counting back from today — or from
 * yesterday when today has none, because a live streak is not broken until a
 * full day is missed.
 *
 * Deliberately the same rule as `practiceStreak`, deliberately a separate
 * counter. Rounds and practice sessions are different commitments and a player
 * who practised on Tuesday did not play a round on Tuesday; merging them would
 * quietly inflate both. If a combined "played or practised" streak is ever
 * wanted it should be its own named function with its own definition.
 */
export function roundStreak(rounds = [], now = new Date()) {
  const days = new Set()
  for (const round of rounds) {
    const date = playedAt(round)
    if (date) days.add(startOfDay(date).getTime())
  }

  const today = startOfDay(now).getTime()
  let cursor = days.has(today) ? today : today - MS_PER_DAY
  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor -= MS_PER_DAY
  }
  return streak
}
