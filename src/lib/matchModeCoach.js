import { distanceBand } from './insights/confidenceMap'

export const MATCH_MODE_MILESTONE_ATTEMPTS = 5
export const MATCH_MODE_PATTERN_MISSES = 3
export const MATCH_MODE_DROP_WINDOW = 5
export const MATCH_MODE_DROP_THRESHOLD = 0.30
export const MATCH_MODE_INTERVENTION_COOLDOWN = 5

function outcomeRate(events) {
  if (!events.length) return 0
  return events.filter((event) => event.outcome === 'make').length / events.length
}

function zoneSignature(event) {
  if (!event) return null
  const zone = event.miss_zone ?? event.missZone
  const distance = event.distance_ft ?? event.distanceFt
  if (!Number.isInteger(zone) || zone < 1 || zone > 9 || !Number.isFinite(distance)) return null
  return `${distanceBand(distance).label}:${zone}`
}

function zoneLabel(zone) {
  return ['high-left', 'high', 'high-right', 'left', 'center', 'right', 'low-left', 'low', 'low-right'][zone - 1]
}

export function evaluateMatchMode({ events = [], lastSpokenAttempt = 0, lastInterventionAttempt = null, ghostComparison = null }) {
  const attempt = events.length
  if (!attempt || attempt <= lastSpokenAttempt) return null
  const cooldownReady = lastInterventionAttempt == null
    || attempt - lastInterventionAttempt >= MATCH_MODE_INTERVENTION_COOLDOWN

  if (cooldownReady && attempt >= MATCH_MODE_PATTERN_MISSES) {
    const trailing = events.slice(-MATCH_MODE_PATTERN_MISSES)
    const signature = zoneSignature(trailing[0])
    const samePattern = signature && trailing.every((event) => event.outcome === 'miss' && zoneSignature(event) === signature)
    const priorSignature = zoneSignature(events[attempt - MATCH_MODE_PATTERN_MISSES - 1])
    if (samePattern && priorSignature !== signature) {
      const zone = trailing[0].miss_zone ?? trailing[0].missZone
      return {
        attempt,
        kind: 'miss_pattern',
        intervention: true,
        message: `Three misses ${zoneLabel(zone)}. Reset, breathe, and commit to your line.`,
      }
    }
  }

  if (cooldownReady && attempt >= MATCH_MODE_DROP_WINDOW * 2 && attempt % MATCH_MODE_DROP_WINDOW === 0) {
    const previous = events.slice(-MATCH_MODE_DROP_WINDOW * 2, -MATCH_MODE_DROP_WINDOW)
    const current = events.slice(-MATCH_MODE_DROP_WINDOW)
    if (outcomeRate(previous) - outcomeRate(current) >= MATCH_MODE_DROP_THRESHOLD) {
      return {
        attempt,
        kind: 'sustained_drop',
        intervention: true,
        message: 'Your last five attempts dropped off. Take one reset breath before the next putt.',
      }
    }
  }

  if (attempt % MATCH_MODE_MILESTONE_ATTEMPTS === 0) {
    const pct = Math.round(outcomeRate(events) * 100)
    let pace = ''
    if (ghostComparison?.ready && Number.isFinite(ghostComparison.makeDelta)) {
      pace = ghostComparison.makeDelta === 0
        ? ' Even with your best-run make pace.'
        : ` ${Math.abs(ghostComparison.makeDelta)} make${Math.abs(ghostComparison.makeDelta) === 1 ? '' : 's'} ${ghostComparison.makeDelta > 0 ? 'ahead of' : 'behind'} best-run pace.`
    }
    return { attempt, kind: 'milestone', intervention: false, message: `${pct} percent made through ${attempt} real-time putts.${pace}` }
  }

  return null
}
