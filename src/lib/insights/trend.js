import { wilsonInterval } from './wilson'

// Make-% trend over time.
//
// Re-derived from the superseded `insights/timeSeries` (commit 775543c,
// 2026-07-14). Two ideas survive from it: bucket the flat {makes, attempts, at}
// samples that `allPuttSamples` already produces, and leave unpractised periods
// as gaps rather than fabricating 0% points — a rest day is not a miss, and the
// line simply connects the periods that were actually practised.
//
// Everything else is rebuilt against the metric policy this repo settled on
// afterwards:
//
// - That version bucketed by UTC calendar day at every range, so a 90-day view
//   plotted ~90 points of 5-15 putts each. Each point was a point estimate with
//   no interval, which is exactly the "confident-looking chart from 3 putts"
//   the policy forbids. Buckets here widen with the window (see TREND_WINDOWS)
//   so a point carries enough attempts to mean something, every point carries a
//   Wilson interval, and thin points are flagged `sparse` for the UI to draw
//   differently rather than silently.
// - That version drew a line and left the reader to infer a direction. This one
//   states the direction, but only when the evidence supports it: the earlier
//   and later halves of the window are compared by Wilson interval overlap, and
//   any overlap reports `no-clear-change`. The test is deliberately
//   conservative — non-overlapping 95% intervals is a stricter bar than a
//   two-proportion test, so "improving" under-claims rather than over-claims.
//   It is a stated comparison with both halves shown, not a composite score.
// - Milestone markers came from `disc_role_history` there. That table is no
//   longer how equipment changes are recorded for metrics; `trendMilestones`
//   reads the append-only `practice_experiment_markers` that D4 checkpoint 3
//   established as the successor.

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Bucket widths divide their window exactly, so every bucket covers the same
// span and none straddles the window edge. Anything else makes the oldest
// bucket look like a volume dip that is really just a shorter bucket.
export const TREND_WINDOWS = Object.freeze([
  Object.freeze({ days: 7, bucketDays: 1, label: '7d', bucketLabel: 'day' }),
  Object.freeze({ days: 30, bucketDays: 5, label: '30d', bucketLabel: '5 days' }),
  Object.freeze({ days: 90, bucketDays: 15, label: '90d', bucketLabel: '15 days' }),
])

export const DEFAULT_TREND_WINDOW_DAYS = 30

// A bucket below this is plotted, because hiding practice that happened would
// be its own kind of lie, but it is marked `sparse` so the UI can draw it as
// provisional instead of as a confident vertex.
export const TREND_MIN_BUCKET_ATTEMPTS = 10

// Neither half of the window may claim a direction below this. Matches the
// 10-attempt floor the rest of `insights/` uses for a single split, doubled
// because a direction claim needs two splits to both be worth comparing.
export const TREND_MIN_HALF_ATTEMPTS = 20

export function trendWindow(days = DEFAULT_TREND_WINDOW_DAYS) {
  return (
    TREND_WINDOWS.find((option) => option.days === days)
    ?? TREND_WINDOWS.find((option) => option.days === DEFAULT_TREND_WINDOW_DAYS)
  )
}

function totals(makes, attempts) {
  return {
    makes,
    attempts,
    makePct: attempts ? makes / attempts : null,
    interval: wilsonInterval(makes, attempts),
  }
}

// samples: [{ makes, attempts, at }] — `allPuttSamples` shape (lib/history.js).
// The window is half-open, (start, end], so a sample landing exactly on the
// oldest boundary belongs to the previous window rather than to a bucket that
// would extend past the chart.
export function makePercentTrend(samples = [], { now = Date.now(), windowDays = DEFAULT_TREND_WINDOW_DAYS } = {}) {
  const window = trendWindow(windowDays)
  const end = new Date(now).getTime()
  const start = end - window.days * MS_PER_DAY
  const bucketMs = window.bucketDays * MS_PER_DAY
  const midpoint = end - (window.days / 2) * MS_PER_DAY

  const buckets = new Map()
  let earlierMakes = 0
  let earlierAttempts = 0
  let laterMakes = 0
  let laterAttempts = 0

  for (const sample of samples) {
    if (!sample?.attempts) continue
    const at = new Date(sample.at).getTime()
    if (!Number.isFinite(at) || at <= start || at > end) continue

    const index = Math.floor((end - at) / bucketMs)
    const bucketEnd = end - index * bucketMs
    const bucket = buckets.get(index) ?? { start: bucketEnd - bucketMs, end: bucketEnd, makes: 0, attempts: 0 }
    bucket.makes += sample.makes
    bucket.attempts += sample.attempts
    buckets.set(index, bucket)

    if (at <= midpoint) {
      earlierMakes += sample.makes
      earlierAttempts += sample.attempts
    } else {
      laterMakes += sample.makes
      laterAttempts += sample.attempts
    }
  }

  const points = [...buckets.values()]
    .sort((left, right) => left.start - right.start)
    .map((bucket) => ({
      ...bucket,
      ...totals(bucket.makes, bucket.attempts),
      sparse: bucket.attempts < TREND_MIN_BUCKET_ATTEMPTS,
    }))

  const earlier = totals(earlierMakes, earlierAttempts)
  const later = totals(laterMakes, laterAttempts)
  const comparable = earlier.attempts >= TREND_MIN_HALF_ATTEMPTS && later.attempts >= TREND_MIN_HALF_ATTEMPTS

  let verdict = 'insufficient-evidence'
  if (comparable) {
    if (later.interval.lower > earlier.interval.upper) verdict = 'improving'
    else if (later.interval.upper < earlier.interval.lower) verdict = 'declining'
    else verdict = 'no-clear-change'
  }

  return {
    windowDays: window.days,
    bucketDays: window.bucketDays,
    bucketLabel: window.bucketLabel,
    start,
    end,
    midpoint,
    points,
    sparsePointCount: points.filter((point) => point.sparse).length,
    totals: totals(
      points.reduce((sum, point) => sum + point.makes, 0),
      points.reduce((sum, point) => sum + point.attempts, 0),
    ),
    direction: {
      verdict,
      earlier,
      later,
      deltaPct: comparable ? later.makePct - earlier.makePct : null,
      minHalfAttempts: TREND_MIN_HALF_ATTEMPTS,
    },
  }
}

function discLabel(disc) {
  if (!disc) return null
  const mold = disc.moldInfo?.mold_name || disc.mold || null
  if (disc.nickname && mold) return `${disc.nickname} · ${mold}`
  return disc.nickname || mold
}

// Equipment milestones to overlay on the trend, from the append-only
// `practice_experiment_markers` rows `fetchPracticeInsights` already loads.
// A marker with an unparseable or out-of-window `effective_at` is dropped
// rather than clamped to an edge, which would put a ★ on a date nothing
// happened.
export function trendMilestones(markers = [], discs = [], { start, end } = {}) {
  const discsById = new Map(discs.map((disc) => [disc.id, disc]))
  return markers
    .map((marker) => ({
      id: marker.id,
      at: new Date(marker.effective_at).getTime(),
      effectiveAt: marker.effective_at,
      markerType: marker.marker_type,
      label: marker.label || discLabel(discsById.get(marker.disc_id)) || 'Equipment change',
    }))
    .filter((marker) => Number.isFinite(marker.at) && marker.at > start && marker.at <= end)
    .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id))
}
