import { wilsonInterval } from './wilson'

// Distance-band width for the confidence map. Wider bands trade granularity
// for statistical power (more attempts per band -> tighter Wilson intervals).
export const DISTANCE_BAND_WIDTH_FT = 10

export function distanceBand(distanceFeet, width = DISTANCE_BAND_WIDTH_FT) {
  const start = Math.floor(distanceFeet / width) * width
  return { start, end: start + width, label: `${start}-${start + width}ft` }
}

// Zone classification from the Wilson interval itself, not the point
// estimate — the whole point of this view is to distinguish "confidently
// good" from "looks good but n is too small to trust":
// - lock-in: even the pessimistic (lower) bound clears LOCK_IN_LOWER_BOUND
// - coin-flip: the interval straddles 50% — genuinely unresolved
// - developing: trending above 50% but not yet a settled lock-in
export const LOCK_IN_LOWER_BOUND = 0.7

export function classifyZone(lower, upper) {
  if (lower >= LOCK_IN_LOWER_BOUND) return 'lock-in'
  if (lower <= 0.5 && upper >= 0.5) return 'coin-flip'
  return 'developing'
}

// samples: [{ distanceFeet, makes, attempts }]. Regimen sets only have a
// distance range, so callers pass the range midpoint as distanceFeet.
export function confidenceMap(samples, width = DISTANCE_BAND_WIDTH_FT) {
  const bands = new Map()
  for (const s of samples) {
    if (!s.attempts || s.distanceFeet == null) continue
    const { start, end, label } = distanceBand(s.distanceFeet, width)
    const bucket = bands.get(start) ?? { start, end, label, makes: 0, attempts: 0 }
    bucket.makes += s.makes
    bucket.attempts += s.attempts
    bands.set(start, bucket)
  }

  return [...bands.values()]
    .sort((a, b) => a.start - b.start)
    .map((b) => {
      const makePct = b.makes / b.attempts
      const interval = wilsonInterval(b.makes, b.attempts)
      return { ...b, makePct, interval, zone: classifyZone(interval.lower, interval.upper) }
    })
}
