import { confidenceMap } from './confidenceMap'
import { decayWeightedForm } from './form'

// Sensible starting distance when there's no history at all yet.
export const DEFAULT_STARTING_DISTANCE_FT = 10

// runs: the raw fetchHistory().runs shape (putting_regimen_runs rows with
// snake_case Supabase columns) — no transform needed, callers already have
// this from fetchHistory.
export function mostRecentRegimenId(runs) {
  if (!runs || runs.length === 0) return null
  const mostRecent = runs.reduce((latest, run) =>
    new Date(run.started_at) > new Date(latest.started_at) ? run : latest,
  )
  return mostRecent.regimen_id ?? null
}

// bands: confidenceMap() output. Prefers the nearest 'developing' band (most
// actionable/motivating — "almost there"), falls back to the nearest
// 'coin-flip' band, then to extending past the farthest 'lock-in' band as a
// progression step. Returns null only when there are no bands at all (no
// history yet) — suggestNextSession applies the "never practiced" default.
export function suggestWarmupDistance(bands) {
  if (!bands || bands.length === 0) return null

  const nearest = (zone) => {
    const inZone = bands.filter((b) => b.zone === zone)
    if (inZone.length === 0) return null
    return inZone.reduce((min, b) => (b.start < min.start ? b : min))
  }

  const developing = nearest('developing')
  if (developing) return developing.start

  const coinFlip = nearest('coin-flip')
  if (coinFlip) return coinFlip.start

  const lockIn = bands.filter((b) => b.zone === 'lock-in')
  if (lockIn.length > 0) {
    const farthest = lockIn.reduce((max, b) => (b.end > max.end ? b : max))
    return farthest.end
  }

  return null
}

// Composes the existing confidenceMap/decayWeightedForm machinery — zero new
// queries, zero new fetch shape. distanceSamplesInput/allSamplesInput are the
// existing distanceSamples()/allPuttSamples() outputs from lib/history.js.
export function suggestNextSession(runs, distanceSamplesInput, allSamplesInput, now) {
  const bands = confidenceMap(distanceSamplesInput)
  const form = decayWeightedForm(allSamplesInput, now)

  return {
    lastRegimenId: mostRecentRegimenId(runs),
    suggestedDistanceFt: suggestWarmupDistance(bands) ?? DEFAULT_STARTING_DISTANCE_FT,
    currentFormPct: form.currentFormPct,
    computedAt: now.toISOString(),
  }
}
