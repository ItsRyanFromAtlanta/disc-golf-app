import { relativeToPar } from '../rounds'
import { ROUND_WEATHER_CONDITIONS, readRoundWeather } from '../roundWeather'

// Does weather actually cost this player strokes?
//
// The honest version of that question is much narrower than it sounds, and both
// functions here are shaped by what the data can and cannot support.
//
// A raw "average score in rain vs clear" across a player's whole history is
// meaningless: it mostly measures which courses they happened to play in the
// rain. So the split below never compares across layouts. It groups rounds by
// the exact layout they were played on and only reports a layout where two or
// more conditions each cleared the sample floor — which is a comparison of the
// same holes at the same pars, and the only one worth printing.
//
// The floor is three rounds per condition, the same "never off a single event,
// require a pattern of at least three" threshold AGENTS.md applies to coaching
// interventions. Below it there is a ledger instead: a count of what has been
// recorded, which is a fact, rather than an average, which would be a claim.
export const CONDITION_SPLIT_MIN_ROUNDS = 3

// A single condition's average is not a split. Two are the minimum that says
// anything, and printing one alone invites reading it as a comparison against
// nothing.
export const CONDITION_SPLIT_MIN_CONDITIONS = 2

/**
 * What has been recorded, with its coverage — never a comparison.
 *
 * `unrecorded` is reported rather than quietly dropped: weather is optional and
 * always will be, so a reader has to be able to see that a "3 rounds in rain"
 * ledger sits beside 40 rounds where nobody logged anything.
 */
export function conditionLedger(rounds = []) {
  const counts = new Map()
  let recorded = 0
  let unrecorded = 0

  for (const round of rounds) {
    const { condition } = readRoundWeather(round)
    if (condition == null) {
      unrecorded += 1
      continue
    }
    recorded += 1
    counts.set(condition, (counts.get(condition) ?? 0) + 1)
  }

  return {
    conditions: ROUND_WEATHER_CONDITIONS.filter((condition) => counts.has(condition)).map((condition) => ({
      condition,
      rounds: counts.get(condition),
    })),
    recorded,
    unrecorded,
  }
}

// Only a round that is finished AND has a score on every hole of its layout is
// comparable to another round on that layout. A completed round with three of
// eighteen holes filled in would otherwise contribute a relative-to-par of
// roughly -12 and drag its condition's average into fiction — `relativeToPar` is
// deliberately a running position, not a projection, so it is the caller's job
// to only average complete ones.
function comparableRelativeToPar(round) {
  if (round?.status !== 'completed') return null
  const holes = round.holes ?? []
  if (holes.length === 0) return null

  const scoreByHoleId = new Map(
    (round.round_holes ?? []).map((row) => [row.hole_id, row.score]),
  )
  for (const hole of holes) {
    const score = scoreByHoleId.get(hole.id)
    if (score == null || score === '') return null
  }
  return relativeToPar(round.round_holes ?? [], holes)
}

/**
 * Per-layout scoring by weather condition, withheld until it means something.
 *
 * Takes hydrated rounds — the shape `loadRound` returns, carrying `round_holes`
 * and `holes` — and returns one entry per layout that cleared the thresholds,
 * or an empty array. An empty array is the expected result for most players for
 * a long time, and callers should render nothing rather than an empty heading.
 */
export function conditionSplits(rounds = [], { minRounds = CONDITION_SPLIT_MIN_ROUNDS } = {}) {
  const layouts = new Map()

  for (const round of rounds) {
    if (!round?.layout_id) continue
    const { condition } = readRoundWeather(round)
    if (condition == null) continue
    const relative = comparableRelativeToPar(round)
    if (relative == null) continue

    const layout = layouts.get(round.layout_id) ?? {
      layoutId: round.layout_id,
      layoutName: round.layout?.name ?? null,
      courseName: round.course?.name ?? null,
      byCondition: new Map(),
    }
    // A later round may carry names an earlier cached one lacked.
    layout.layoutName = layout.layoutName ?? round.layout?.name ?? null
    layout.courseName = layout.courseName ?? round.course?.name ?? null

    const bucket = layout.byCondition.get(condition) ?? { rounds: 0, total: 0 }
    bucket.rounds += 1
    bucket.total += relative
    layout.byCondition.set(condition, bucket)
    layouts.set(round.layout_id, layout)
  }

  return [...layouts.values()]
    .map((layout) => ({
      layoutId: layout.layoutId,
      layoutName: layout.layoutName,
      courseName: layout.courseName,
      conditions: ROUND_WEATHER_CONDITIONS.filter(
        (condition) => (layout.byCondition.get(condition)?.rounds ?? 0) >= minRounds,
      ).map((condition) => {
        const bucket = layout.byCondition.get(condition)
        return {
          condition,
          rounds: bucket.rounds,
          averageRelativeToPar: bucket.total / bucket.rounds,
        }
      }),
    }))
    .filter((layout) => layout.conditions.length >= CONDITION_SPLIT_MIN_CONDITIONS)
    .sort((left, right) => String(left.courseName ?? '').localeCompare(String(right.courseName ?? '')))
}
