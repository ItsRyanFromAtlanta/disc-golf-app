// Time-series windowing for the Analytics trend chart (Screen 10). Buckets the
// flat {makes, attempts, at} putt samples (see history.allPuttSamples) into one
// point per UTC calendar day that actually has attempts, within a trailing
// window. Empty days are left as gaps rather than fabricated 0% points — a rest
// day is not a miss, and the line simply connects the days that were practiced.
//
// UTC-day bucketing (not local) is deliberate: it keeps the function pure and
// deterministic under this repo's vitest setup (no timezone dependence in
// tests), and the trend chart's x-axis is a continuous time axis anyway, so the
// exact day boundary only affects which bucket a late-night putt lands in, never
// the overall shape.
export const TIME_RANGE_DAYS = [7, 30, 90]
export const DEFAULT_TIME_RANGE_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

function utcDayStart(ms) {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY
}

// samples: [{ makes, attempts, at }]  (at = ISO timestamp string)
// opts.now: reference "end" of the window (ms or Date), defaults to now.
export function makePercentTimeSeries(samples, { now = Date.now(), windowDays = DEFAULT_TIME_RANGE_DAYS } = {}) {
  const end = new Date(now).getTime()
  const start = end - windowDays * MS_PER_DAY

  const byDay = new Map()
  for (const s of samples) {
    if (!s.attempts) continue
    const t = new Date(s.at).getTime()
    if (Number.isNaN(t) || t < start || t > end) continue
    const key = utcDayStart(t)
    const bucket = byDay.get(key) ?? { periodStart: key, makes: 0, attempts: 0 }
    bucket.makes += s.makes
    bucket.attempts += s.attempts
    byDay.set(key, bucket)
  }

  const points = [...byDay.values()]
    .sort((a, b) => a.periodStart - b.periodStart)
    .map((b) => ({ ...b, makePct: b.makes / b.attempts }))

  const totalMakes = points.reduce((sum, p) => sum + p.makes, 0)
  const totalAttempts = points.reduce((sum, p) => sum + p.attempts, 0)

  return {
    windowDays,
    start,
    end,
    points,
    totalMakes,
    totalAttempts,
    makePct: totalAttempts > 0 ? totalMakes / totalAttempts : null,
  }
}
