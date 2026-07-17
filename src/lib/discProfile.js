import { wilsonInterval } from './insights/wilson'

export function buildDiscPerformance({ puttEvents = [], roundHoles = [] } = {}) {
  const attempts = puttEvents.length
  const makes = puttEvents.filter((event) => event.outcome === 'make').length
  const scoredHoles = roundHoles.filter((row) => row.score != null)
  const scores = scoredHoles.map((row) => Number(row.score)).filter(Number.isFinite)
  const relative = scoredHoles
    .map((row) => Number(row.score) - Number(row.hole?.par))
    .filter(Number.isFinite)
  const dates = roundHoles.map((row) => row.round?.played_at).filter(Boolean).sort()
  return {
    putting: {
      makes,
      attempts,
      pct: attempts ? makes / attempts : null,
      interval: attempts > 0 && attempts < 30 ? wilsonInterval(makes, attempts) : null,
    },
    rounds: {
      holesPlayed: scoredHoles.length,
      averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
      averageToPar: relative.length ? relative.reduce((sum, score) => sum + score, 0) / relative.length : null,
      lastUsedAt: dates.at(-1) ?? null,
    },
  }
}

export function buildDiscHistory({ stateEvents = [], odometerEvents = [], lostFoundUpdates = [], photos = [] } = {}) {
  return [
    ...stateEvents.map((row) => ({ id: `state:${row.id}`, type: 'state', at: row.occurred_at, title: row.event_type.replaceAll('_', ' '), detail: row.reason || null })),
    ...odometerEvents.map((row) => ({ id: `odometer:${row.id}`, type: 'odometer', at: row.occurred_at, title: `${row.metric.replaceAll('_', ' ')} ${row.delta > 0 ? '+' : ''}${row.delta}`, detail: row.reason || row.source })),
    ...lostFoundUpdates.map((row) => ({ id: `lost:${row.id}`, type: 'lost_found', at: row.occurred_at, title: row.event_type.replaceAll('_', ' '), detail: row.area_text || row.notes || null })),
    ...photos.map((row) => ({ id: `photo:${row.id}`, type: 'photo', at: row.deleted_at || row.superseded_at || row.created_at, title: `${row.slot} photo ${row.deleted_at ? 'removed' : row.superseded_at ? 'replaced' : 'added'}`, detail: null })),
  ].filter((row) => row.at).sort((a, b) => new Date(b.at) - new Date(a.at))
}
