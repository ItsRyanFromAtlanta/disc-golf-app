import { wilsonInterval } from './wilson'

export const EXPERIMENT_MIN_SIDE_ATTEMPTS = 10

function validEvent(event) {
  return ['make', 'miss'].includes(event.outcome)
    && Number.isFinite(event.distance_ft)
    && event.distance_ft > 0
    && event.occurred_at
}

function totals(events) {
  const makes = events.filter((event) => event.outcome === 'make').length
  const attempts = events.length
  return {
    makes,
    attempts,
    pct: attempts ? makes / attempts : null,
    interval: wilsonInterval(makes, attempts),
  }
}

function markerTime(marker) {
  const value = new Date(marker.effective_at).getTime()
  return Number.isFinite(value) ? value : null
}

export function experimentComparison(markers = [], puttEvents = [], discs = [], minAttempts = EXPERIMENT_MIN_SIDE_ATTEMPTS) {
  const events = puttEvents.filter(validEvent)
  const attributedEvents = events.filter((event) => event.putter_disc_id)
  const discsById = new Map(discs.map((disc) => [disc.id, disc]))
  const orderedMarkers = markers
    .map((marker) => ({ ...marker, _time: markerTime(marker) }))
    .filter((marker) => marker._time !== null)
    .sort((left, right) => left._time - right._time || left.id.localeCompare(right.id))

  const experiments = orderedMarkers.map((marker, index) => {
    const nextTime = orderedMarkers[index + 1]?._time ?? Infinity
    const before = attributedEvents.filter((event) => new Date(event.occurred_at).getTime() < marker._time)
    const after = attributedEvents.filter((event) => {
      const occurredAt = new Date(event.occurred_at).getTime()
      return occurredAt >= marker._time
        && occurredAt < nextTime
        && event.putter_disc_id === marker.disc_id
    })
    const beforeTotals = totals(before)
    const afterTotals = totals(after)
    const ready = beforeTotals.attempts >= minAttempts && afterTotals.attempts >= minAttempts

    return {
      markerId: marker.id,
      markerType: marker.marker_type,
      label: marker.label,
      notes: marker.notes ?? null,
      effectiveAt: marker.effective_at,
      nextMarkerAt: Number.isFinite(nextTime) ? orderedMarkers[index + 1].effective_at : null,
      discId: marker.disc_id,
      disc: discsById.get(marker.disc_id) ?? null,
      before: beforeTotals,
      after: afterTotals,
      delta: ready ? afterTotals.pct - beforeTotals.pct : null,
      ready,
      minAttempts,
    }
  })

  return {
    totalRealTimeAttempts: events.length,
    attributedAttempts: attributedEvents.length,
    attributionCoverage: events.length ? attributedEvents.length / events.length : null,
    experiments: experiments.reverse(),
  }
}
