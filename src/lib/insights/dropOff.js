import { distanceBand, DISTANCE_BAND_WIDTH_FT } from './confidenceMap'

// Session Summary's distance drop-off matrix (Screen 9): flags a distance
// where today's make % dips more than 10 percentage points below the
// rolling baseline — the blueprint's ⚠️ warning badge.
export const DROP_OFF_WARN_THRESHOLD_PCT = 10

function bandTotals(samples, width) {
  const bands = new Map()
  for (const s of samples) {
    if (!s.attempts || s.distanceFeet == null) continue
    const { start, label } = distanceBand(s.distanceFeet, width)
    const bucket = bands.get(start) ?? { start, label, makes: 0, attempts: 0 }
    bucket.makes += s.makes
    bucket.attempts += s.attempts
    bands.set(start, bucket)
  }
  return bands
}

// todaySamples/baselineSamples: distanceSamples()-shaped [{distanceFeet, makes, attempts}]
// (see lib/history.js). Only reports bands actually played today, matching the
// blueprint's matrix — it shows today's distances, not every band ever
// practiced. A band with no baseline history yet reports baselinePct: null
// and never warns (nothing to compare against).
export function distanceDropOff(todaySamples, baselineSamples, width = DISTANCE_BAND_WIDTH_FT) {
  const today = bandTotals(todaySamples, width)
  const baseline = bandTotals(baselineSamples, width)

  return [...today.values()]
    .sort((a, b) => a.start - b.start)
    .map((t) => {
      const todayPct = t.makes / t.attempts
      const b = baseline.get(t.start)
      const baselinePct = b ? b.makes / b.attempts : null
      const dropPct = baselinePct == null ? null : (baselinePct - todayPct) * 100
      return {
        label: t.label,
        todayMakes: t.makes,
        todayAttempts: t.attempts,
        todayPct,
        baselinePct,
        dropPct,
        warn: dropPct != null && dropPct > DROP_OFF_WARN_THRESHOLD_PCT,
      }
    })
}
