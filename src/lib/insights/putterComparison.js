import { distanceBand, DISTANCE_BAND_WIDTH_FT } from './confidenceMap'
import { wilsonInterval } from './wilson'

export const PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS = 10

function validEvent(event) {
  return ['make', 'miss'].includes(event.outcome)
    && Number.isFinite(event.distance_ft)
    && event.distance_ft > 0
}

function totals(bucket) {
  const pct = bucket.attempts ? bucket.makes / bucket.attempts : null
  return { makes: bucket.makes, attempts: bucket.attempts, pct, interval: wilsonInterval(bucket.makes, bucket.attempts) }
}

export function putterComparison(puttEvents = [], discs = [], width = DISTANCE_BAND_WIDTH_FT) {
  const eligibleEvents = puttEvents.filter(validEvent)
  const attributedEvents = eligibleEvents.filter((event) => event.putter_disc_id)
  const byPutter = new Map()
  const pooledBands = new Map()

  for (const event of attributedEvents) {
    const { start, end, label } = distanceBand(event.distance_ft, width)
    const putter = byPutter.get(event.putter_disc_id) ?? {
      putterDiscId: event.putter_disc_id, makes: 0, attempts: 0, bands: new Map(),
    }
    putter.attempts += 1
    if (event.outcome === 'make') putter.makes += 1
    const putterBand = putter.bands.get(start) ?? { start, end, label, makes: 0, attempts: 0 }
    putterBand.attempts += 1
    if (event.outcome === 'make') putterBand.makes += 1
    putter.bands.set(start, putterBand)
    byPutter.set(event.putter_disc_id, putter)

    const pooled = pooledBands.get(start) ?? { makes: 0, attempts: 0, putterIds: new Set() }
    pooled.attempts += 1
    if (event.outcome === 'make') pooled.makes += 1
    pooled.putterIds.add(event.putter_disc_id)
    pooledBands.set(start, pooled)
  }

  const discsById = new Map(discs.map((disc) => [disc.id, disc]))
  const rows = [...byPutter.values()].map((putter) => {
    let sharedMakes = 0
    let sharedAttempts = 0
    let expectedMakes = 0
    const bands = [...putter.bands.values()].sort((left, right) => left.start - right.start).map((band) => {
      const pooled = pooledBands.get(band.start)
      const shared = pooled.putterIds.size >= 2
      if (shared) {
        sharedMakes += band.makes
        sharedAttempts += band.attempts
        expectedMakes += band.attempts * (pooled.makes / pooled.attempts)
      }
      return { ...band, ...totals(band), shared }
    })
    return {
      putterDiscId: putter.putterDiscId,
      disc: discsById.get(putter.putterDiscId) ?? null,
      ...totals(putter),
      bands,
      sharedBandAttempts: sharedAttempts,
      distanceAdjustedDelta: sharedAttempts >= PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS
        ? (sharedMakes - expectedMakes) / sharedAttempts
        : null,
    }
  }).sort((left, right) => right.attempts - left.attempts || left.putterDiscId.localeCompare(right.putterDiscId))

  return {
    totalRealTimeAttempts: eligibleEvents.length,
    attributedAttempts: attributedEvents.length,
    attributionCoverage: eligibleEvents.length ? attributedEvents.length / eligibleEvents.length : null,
    comparisonReady: rows.length >= 2,
    rows,
  }
}
