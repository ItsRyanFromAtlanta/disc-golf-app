// PB rules.
// Regimen PB: a completed run whose total_score beat every earlier completed
// run of the same regimen (the first completed run on a regimen is a PB).
// Distance PB: a session's make % at a distance beat every earlier qualifying
// session at that distance, where qualifying means >= 10 attempts at that
// distance within the session (keeps small samples from minting PBs).
export const DISTANCE_PB_MIN_ATTEMPTS = 10

export function regimenPBRunIds(runs) {
  const sorted = [...runs]
    .filter((r) => r.completed)
    .sort((a, b) => new Date(a.at) - new Date(b.at))

  const bestByRegimen = new Map()
  const pbIds = new Set()
  for (const run of sorted) {
    const best = bestByRegimen.get(run.regimenId)
    if (best === undefined || run.totalScore > best) {
      pbIds.add(run.id)
      bestByRegimen.set(run.regimenId, run.totalScore)
    }
  }
  return pbIds
}

export function distancePBSessionIds(sessions) {
  const sorted = [...sessions].sort((a, b) => new Date(a.at) - new Date(b.at))

  const bestByDistance = new Map()
  const pbIds = new Set()
  for (const session of sorted) {
    const byDistance = new Map()
    for (const log of session.logs) {
      const bucket = byDistance.get(log.distanceFeet) ?? { makes: 0, attempts: 0 }
      bucket.makes += log.makes
      bucket.attempts += log.attempts
      byDistance.set(log.distanceFeet, bucket)
    }
    for (const [distance, { makes, attempts }] of byDistance) {
      if (attempts < DISTANCE_PB_MIN_ATTEMPTS) continue
      const pct = makes / attempts
      const best = bestByDistance.get(distance)
      if (best === undefined || pct > best) {
        pbIds.add(session.id)
        bestByDistance.set(distance, pct)
      }
    }
  }
  return pbIds
}
