import { distanceBand, DISTANCE_BAND_WIDTH_FT, LOCK_IN_LOWER_BOUND } from './confidenceMap'
import { wilsonInterval } from './wilson'

// Distance heat profile: practice volume vs weakness by distance.
//
// The point of this view is the *mismatch*, not the volume. A bar chart of
// where the putts went answers "what did I do", which the volume ledger already
// answers; the question worth asking is whether effort is going where the skill
// isn't. So every band is classified on two independent axes that are computed
// and displayed separately — how much of the practice it took, and how good the
// evidence says you are — and the named gap is the disagreement between them.
//
// Deliberately not a single "priority score". Two axes stay legible: a reader
// can check the volume share and the interval themselves and see why a band was
// called a blind spot. Collapsing them into one number would be the opaque
// composite the metric policy rejects.
//
// Strength reuses the confidence map's LOCK_IN_LOWER_BOUND rather than a new
// threshold, so "owned" means the same thing on both surfaces. It is read off
// the Wilson interval, not the point estimate:
//   owned      — even the pessimistic bound clears the lock-in standard
//   weak       — even the optimistic bound falls short of it
//   unresolved — the interval straddles it; the honest answer is "don't know"
// Below DISTANCE_PROFILE_MIN_BAND_ATTEMPTS the band is `unproven` and never
// receives a verdict at all, because at n=4 the interval straddles nearly
// everything and "unresolved" would overstate what was measured.

export const DISTANCE_PROFILE_MIN_BAND_ATTEMPTS = 10

// Volume share is compared against an even split across the bands actually
// practised, so the thresholds mean "half the reps a band would get if you
// spread practice evenly" and "half again more". Absolute shares would depend
// on how many bands a player happens to use.
export const OVER_INVESTED_RATIO = 1.5
export const UNDER_INVESTED_RATIO = 0.5

// A mismatch is a statement about how practice is *allocated*, which needs at
// least two bands with real evidence to compare. One band cannot be
// over- or under-practised relative to anything.
export const DISTANCE_PROFILE_MIN_QUALIFIED_BANDS = 2

function strengthOf(attempts, interval, minAttempts) {
  if (attempts < minAttempts) return 'unproven'
  if (interval.lower >= LOCK_IN_LOWER_BOUND) return 'owned'
  if (interval.upper < LOCK_IN_LOWER_BOUND) return 'weak'
  return 'unresolved'
}

function volumeLevelOf(ratio) {
  if (ratio >= OVER_INVESTED_RATIO) return 'over'
  if (ratio <= UNDER_INVESTED_RATIO) return 'under'
  return 'even'
}

// The 2x2 the whole view exists for.
//   blind-spot  — weak and barely practised: the one you are avoiding
//   grinding    — weak and heavily practised: the reps are not converting
//   over-drilled— already owned and heavily practised: reps spent on a solved
//                 distance, which is where a blind spot's reps went
//   aligned     — effort and evidence agree; nothing to say
//   untested    — not enough attempts to claim anything either way
function gapOf(strength, volumeLevel) {
  if (strength === 'unproven') return 'untested'
  if (strength === 'weak' && volumeLevel === 'under') return 'blind-spot'
  if (strength === 'weak' && volumeLevel === 'over') return 'grinding'
  if (strength === 'owned' && volumeLevel === 'over') return 'over-drilled'
  return 'aligned'
}

// Most confidently weak first (lowest optimistic bound), then least practised,
// then nearest the basket — a stable order that never depends on map insertion.
const byWeakestThenThinnest = (left, right) =>
  left.interval.upper - right.interval.upper
  || left.volumeShare - right.volumeShare
  || left.start - right.start

const byHeaviestVolume = (left, right) =>
  right.volumeShare - left.volumeShare || left.start - right.start

// Distances inside the range you already practise that have no attempts at all.
// Not a weakness — there is no evidence either way — but it is the other shape
// of blind spot, and it is invisible on any chart drawn only from bands that
// have data.
function coverageGapsBetween(bands, width) {
  if (bands.length < 2) return []
  const present = new Set(bands.map((band) => band.start))
  const gaps = []
  for (let start = bands[0].start + width; start < bands[bands.length - 1].start; start += width) {
    if (!present.has(start)) gaps.push({ start, end: start + width, label: `${start}-${start + width}ft` })
  }
  return gaps
}

// samples: [{ distanceFeet, makes, attempts }] — `distanceSamples` shape
// (lib/history.js), which already resolves a regimen set's range to its
// midpoint.
export function distanceProfile(samples = [], width = DISTANCE_BAND_WIDTH_FT, minAttempts = DISTANCE_PROFILE_MIN_BAND_ATTEMPTS) {
  const totals = new Map()
  for (const sample of samples) {
    if (!sample?.attempts || sample.distanceFeet == null || !Number.isFinite(sample.distanceFeet)) continue
    const { start, end, label } = distanceBand(sample.distanceFeet, width)
    const band = totals.get(start) ?? { start, end, label, makes: 0, attempts: 0 }
    band.makes += sample.makes
    band.attempts += sample.attempts
    totals.set(start, band)
  }

  const ordered = [...totals.values()].sort((left, right) => left.start - right.start)
  const totalMakes = ordered.reduce((sum, band) => sum + band.makes, 0)
  const totalAttempts = ordered.reduce((sum, band) => sum + band.attempts, 0)
  // Every band with attempts counts toward the even split, including unproven
  // ones: a thin band still consumed practice, and pretending it did not would
  // inflate everything else's share.
  const evenShare = ordered.length ? 1 / ordered.length : null

  const bands = ordered.map((band) => {
    const interval = wilsonInterval(band.makes, band.attempts)
    const volumeShare = band.attempts / totalAttempts
    const volumeRatio = volumeShare / evenShare
    const strength = strengthOf(band.attempts, interval, minAttempts)
    const volumeLevel = volumeLevelOf(volumeRatio)
    return {
      ...band,
      makePct: band.makes / band.attempts,
      interval,
      volumeShare,
      volumeRatio,
      volumeLevel,
      strength,
      gap: gapOf(strength, volumeLevel),
    }
  })

  const qualified = bands.filter((band) => band.strength !== 'unproven')
  const ready = qualified.length >= DISTANCE_PROFILE_MIN_QUALIFIED_BANDS

  let takeaway = null
  if (ready) {
    const blindSpots = bands.filter((band) => band.gap === 'blind-spot').sort(byWeakestThenThinnest)
    const grinding = bands.filter((band) => band.gap === 'grinding').sort(byWeakestThenThinnest)
    const overDrilled = bands.filter((band) => band.gap === 'over-drilled').sort(byHeaviestVolume)
    if (blindSpots.length) takeaway = { kind: 'blind-spot', band: blindSpots[0] }
    else if (grinding.length) takeaway = { kind: 'grinding', band: grinding[0] }
    else if (overDrilled.length) takeaway = { kind: 'over-drilled', band: overDrilled[0] }
    else takeaway = { kind: 'aligned', band: null }
  }

  return {
    bandWidthFt: width,
    minBandAttempts: minAttempts,
    minQualifiedBands: DISTANCE_PROFILE_MIN_QUALIFIED_BANDS,
    totalMakes,
    totalAttempts,
    evenShare,
    bands,
    qualifiedBandCount: qualified.length,
    coverageGaps: coverageGapsBetween(ordered, width),
    ready,
    takeaway,
  }
}
