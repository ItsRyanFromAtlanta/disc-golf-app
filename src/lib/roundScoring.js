import { parTotal, relativeToPar, roundTotal } from './rounds'

// Activity-only rounds — the round-side answer to "I played, I am not filling
// in a scorecard."
//
// The model, and why it is a recorded column rather than an inference.
//
// A round's UUID *is* its activity UUID: `rounds(id, user_id)` references
// `activities(id, user_id)` (`20260712193922_phase_a_activity_lifecycle.sql`).
// A round is therefore already an activity, and "activity-only" is not a new
// activity type — it is still a `disc_golf_round`, played on a course, on a
// date, in some weather. What differs is the level of detail captured, not the
// kind of thing that happened. Adding an eighth `activities.type` for it would
// split one concept across two types and break every round query.
//
// The tempting alternative is to infer it: a round with no `round_holes` and a
// `completed` status was obviously logged without a scorecard. That is wrong,
// and it is wrong in the way this repository keeps writing down — absence is
// ambiguous. A round with zero scored holes is any of:
//
//   * a scorecard round on the first tee, nothing entered yet;
//   * a scorecard round abandoned after the walk to hole 1;
//   * a round deliberately logged without per-hole scoring.
//
// Only the third is activity-only, and the difference between them is the
// player's *intent*, which is a fact nobody can recover later. So it is
// recorded at creation, exactly like every other fact here.
export const ROUND_SCORING_MODES = ['hole_by_hole', 'activity_only']

export const DEFAULT_ROUND_SCORING_MODE = 'hole_by_hole'

const MODES = new Set(ROUND_SCORING_MODES)

/**
 * Reads the mode off a round row, tolerating a row that has never heard of the
 * column.
 *
 * `main` auto-deploys and a migration cannot ride in the same step as the
 * client that reads it, so for a window this app runs against a `rounds` table
 * with no `scoring_mode`. Every row written before the column existed came
 * through the scorecard path, so absent/null reads as `hole_by_hole` — which is
 * both the database default and the historically true answer, not a guess.
 */
export function roundScoringMode(round) {
  const value = typeof round?.scoring_mode === 'string' ? round.scoring_mode.trim().toLowerCase() : null
  return value && MODES.has(value) ? value : DEFAULT_ROUND_SCORING_MODE
}

export function isActivityOnlyRound(round) {
  return roundScoringMode(round) === 'activity_only'
}

/**
 * The write-side normalizer, and the deploy-window narrowing that matters.
 *
 * It returns `{}` — no column at all — for the default mode. That is not
 * tidiness: the database default is `hole_by_hole`, so omitting the column
 * writes exactly the same row, and it means an ordinary scorecard round keeps
 * working unchanged during the window between this client landing and its
 * migration arriving. Only an activity-only round sends the column, so only the
 * new feature waits for the new schema.
 *
 * When it does send it and the column is not there yet, PostgREST answers
 * `PGRST204`, which `DEPLOY_LAG_CODES` in
 * `src/lib/instantLaunch/errorClassification.js` keeps *transient* on purpose:
 * the queued round waits for its migration instead of poisoning the outbox.
 */
export function roundScoringModeFields(mode) {
  const value = typeof mode === 'string' ? mode.trim().toLowerCase() : null
  if (!value || !MODES.has(value) || value === DEFAULT_ROUND_SCORING_MODE) return {}
  return { scoring_mode: value }
}

const MODE_LABELS = {
  hole_by_hole: 'Scorecard',
  activity_only: 'No scorecard',
}

export function scoringModeLabel(mode) {
  return MODE_LABELS[roundScoringMode({ scoring_mode: mode })]
}

/**
 * Whether a round's per-hole scorecard should exist at all.
 *
 * Kept as a named predicate rather than inlined, because three screens ask the
 * question and one of them (`RoundScorecardPage`) has to answer it before it
 * renders anything.
 */
export function expectsScorecard(round) {
  return !isActivityOnlyRound(round)
}

function finiteNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * What a round's total and relative-to-par mean, given how it was captured.
 *
 * This exists because the two modes produce numbers that look identical and are
 * not the same kind of fact, and every screen that prints one has to know
 * which:
 *
 *   * A scorecard round's total is **derived** — the sum of holes the player
 *     actually entered. `relativeToPar` is deliberately a running position
 *     rather than a projection, so on a sparse card it is the score *so far*.
 *   * An activity-only round's total is **stated** — a number the player typed,
 *     which no per-hole fact backs and no recalculation will ever change.
 *
 * Callers get an explicit source alongside each number so they can label it,
 * and `null` rather than a number whenever there is nothing honest to say.
 *
 * The `null`s are the point. `relativeToPar([], holes)` returns 0, which
 * `formatRelativeToPar` renders as **"E"** — so a round with no scores at all
 * would claim to be even par. Three screens guarded against that individually
 * with a `hasScore` flag, which is the same "the guarantee lives in the
 * consumer" shape E2 audit finding 6 fixed in `fetchRound`. It lives here now.
 */
export function roundScoreSummary(round) {
  const holes = round?.holes ?? []
  const roundHoles = round?.round_holes ?? []
  const scoredHoleIds = new Set(
    roundHoles.filter((row) => finiteNumber(row?.score) != null).map((row) => row?.hole_id),
  )
  const scoredHoles = roundHoles.filter((row) => finiteNumber(row?.score) != null).length

  if (isActivityOnlyRound(round)) {
    const stated = finiteNumber(round?.total_score)
    const par = parTotal(holes)
    return {
      mode: 'activity_only',
      total: stated,
      totalSource: stated == null ? null : 'stated',
      // Only derivable when a layout was chosen and its holes actually carry
      // pars. A layout whose pars are all null totals 0, and `stated - 0` is
      // the raw score wearing a "+54" costume — worse than showing nothing.
      relativeToPar: stated != null && par > 0 ? stated - par : null,
      relativeToParSource: stated != null && par > 0 ? 'stated_vs_par' : null,
      scoredHoles,
      totalHoles: holes.length,
      complete: null,
    }
  }

  return {
    mode: 'hole_by_hole',
    total: scoredHoles > 0 ? roundTotal(roundHoles) : null,
    totalSource: scoredHoles > 0 ? 'scorecard' : null,
    relativeToPar: scoredHoles > 0 ? relativeToPar(roundHoles, holes) : null,
    relativeToParSource: scoredHoles > 0 ? 'scorecard' : null,
    scoredHoles,
    totalHoles: holes.length,
    // Every hole *of the layout* carries a score — not merely "as many scores
    // as holes". A card can hold a row for a hole the layout no longer has
    // (`fetchRound` resolves those and sorts them last), and counting it would
    // let an 18-hole layout look complete on 17 holes plus an orphan.
    complete: holes.length > 0 && holes.every((hole) => scoredHoleIds.has(hole?.id)),
  }
}
