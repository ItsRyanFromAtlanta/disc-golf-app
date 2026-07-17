import { distanceSamples } from './history'
import { putterBreakdown } from './insights/putterBreakdown'

const PUTTER_ROLES = new Set(['primary_putter', 'backup_putter'])

function ratio(makes, attempts) {
  return attempts ? makes / attempts : null
}
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildCareerSummary({ sessions = [], runs = [], discs = [], puttEvents = [] }) {
  const samples = distanceSamples({ sessions, runs })
  const lifetime = samples.reduce(
    (total, sample) => ({ makes: total.makes + sample.makes, attempts: total.attempts + sample.attempts }),
    { makes: 0, attempts: 0 },
  )
  const zone = (predicate) => samples.filter((sample) => predicate(sample.distanceFeet)).reduce(
    (total, sample) => ({ makes: total.makes + sample.makes, attempts: total.attempts + sample.attempts }),
    { makes: 0, attempts: 0 },
  )
  const c1 = zone((distance) => distance <= 33)
  const c2 = zone((distance) => distance > 33 && distance <= 66)
  const parents = [...sessions, ...runs]
  const windyParents = parents.filter((parent) => parent.wind_mph != null && parent.wind_mph >= 15)
  const windy = windyParents.flatMap((parent) => parent.putt_distance_logs ?? parent.putting_regimen_run_sets ?? [])
    .reduce((total, row) => ({ makes: total.makes + row.makes, attempts: total.attempts + row.attempts }), { makes: 0, attempts: 0 })
  const activeRoles = new Set(discs.filter((disc) => disc.status !== 'retired' && disc.status !== 'sold').map((disc) => disc.role).filter(Boolean))

  const accuracyByPutter = new Map(putterBreakdown(puttEvents).map((row) => [row.putterDiscId, row]))
  const trustedPutter = discs
    .filter((disc) => PUTTER_ROLES.has(disc.role))
    .map((disc) => {
      const accuracy = accuracyByPutter.get(disc.id) ?? null
      return { ...disc, accuracy, trustScore: (disc.total_chain_hits ?? 0) * (accuracy?.pct ?? 0) }
    })
    .filter((disc) => disc.accuracy?.attempts > 0)
    .sort((a, b) => b.trustScore - a.trustScore || b.accuracy.attempts - a.accuracy.attempts)[0] ?? null

  return {
    lifetime: { ...lifetime, accuracy: ratio(lifetime.makes, lifetime.attempts) },
    sessionCount: parents.length,
    axes: [
      { key: 'c1', label: 'C1 accuracy', value: ratio(c1.makes, c1.attempts), sampleSize: c1.attempts, score: c1.attempts ? clampScore(100 * c1.makes / c1.attempts) : null },
      { key: 'c2', label: 'C2 putting', value: ratio(c2.makes, c2.attempts), sampleSize: c2.attempts, score: c2.attempts ? clampScore(100 * c2.makes / c2.attempts) : null },
      { key: 'endurance', label: 'Endurance', value: parents.length ? lifetime.attempts / parents.length : null, sampleSize: parents.length, score: parents.length ? clampScore(lifetime.attempts / parents.length) : null },
      { key: 'wind', label: 'Wind mastery', value: ratio(windy.makes, windy.attempts), sampleSize: windy.attempts, score: windy.attempts ? clampScore(100 * windy.makes / windy.attempts) : null },
      { key: 'bag', label: 'Bag balance', value: activeRoles.size, sampleSize: discs.length, score: discs.length ? clampScore(activeRoles.size / 4 * 100) : null },
    ],
    trustedPutter,
  }
}
