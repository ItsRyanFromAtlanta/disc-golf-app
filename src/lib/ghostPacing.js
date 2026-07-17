export const MIN_GHOST_PROFILE_EVENTS = 5
export const MIN_CURRENT_GHOST_EVENTS = 3

function eventTime(event) {
  const value = new Date(event.occurred_at ?? event.occurredAt).getTime()
  return Number.isFinite(value) ? value : null
}

function validEvent(event) {
  return ['make', 'miss'].includes(event.outcome) && eventTime(event) !== null
}

function normalizedPoints(events) {
  const ordered = events.filter(validEvent).sort((left, right) => {
    const timeDelta = eventTime(left) - eventTime(right)
    if (timeDelta) return timeDelta
    return (left.sequence ?? 0) - (right.sequence ?? 0)
  })
  if (!ordered.length) return []
  const startedAt = eventTime(ordered[0])
  let cumulativeMakes = 0
  return ordered.map((event, index) => {
    if (event.outcome === 'make') cumulativeMakes += 1
    return {
      attempt: index + 1,
      elapsedMs: eventTime(event) - startedAt,
      outcome: event.outcome,
      cumulativeMakes,
      setOrder: event.set_order ?? event.setOrder ?? null,
    }
  })
}

export function buildHistoricalGhostProfile(runs = [], events = [], minEvents = MIN_GHOST_PROFILE_EVENTS) {
  const eventsByRun = new Map()
  for (const event of events) {
    if (!event.regimen_run_id) continue
    const bucket = eventsByRun.get(event.regimen_run_id) ?? []
    bucket.push(event)
    eventsByRun.set(event.regimen_run_id, bucket)
  }

  const candidates = runs.map((run) => {
    const points = normalizedPoints(eventsByRun.get(run.id) ?? [])
    return { run, points }
  }).filter(({ run, points }) => Number.isFinite(Number(run.total_score)) && points.length >= minEvents)
    .sort((left, right) => {
      const scoreDelta = Number(right.run.total_score) - Number(left.run.total_score)
      if (scoreDelta) return scoreDelta
      const timeDelta = new Date(right.run.completed_at ?? right.run.started_at).getTime()
        - new Date(left.run.completed_at ?? left.run.started_at).getTime()
      if (Number.isFinite(timeDelta) && timeDelta) return timeDelta
      return left.run.id.localeCompare(right.run.id)
    })

  if (!candidates.length) return null
  const selected = candidates[0]
  return {
    sourceRunId: selected.run.id,
    sourceScore: Number(selected.run.total_score),
    sourceCompletedAt: selected.run.completed_at ?? selected.run.started_at ?? null,
    eventCount: selected.points.length,
    durationMs: selected.points.at(-1).elapsedMs,
    points: selected.points,
  }
}

export function compareGhostPace(currentEvents = [], profile, minCurrentEvents = MIN_CURRENT_GHOST_EVENTS) {
  if (!profile?.points?.length) return null
  const current = normalizedPoints(currentEvents)
  if (current.length < minCurrentEvents) {
    return { ready: false, currentAttempts: current.length, attemptsNeeded: minCurrentEvents - current.length }
  }

  const latest = current.at(-1)
  const ghostAttemptsAtElapsed = profile.points.filter((point) => point.elapsedMs <= latest.elapsedMs).length
  const sameAttemptGhost = profile.points[current.length - 1] ?? null
  return {
    ready: true,
    currentAttempts: current.length,
    currentElapsedMs: latest.elapsedMs,
    attemptDelta: current.length - ghostAttemptsAtElapsed,
    timeDeltaMs: sameAttemptGhost ? latest.elapsedMs - sameAttemptGhost.elapsedMs : null,
    makeDelta: sameAttemptGhost ? latest.cumulativeMakes - sameAttemptGhost.cumulativeMakes : null,
    ghostEventCount: profile.eventCount,
    sourceScore: profile.sourceScore,
  }
}
