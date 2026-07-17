import { describe, expect, it } from 'vitest'
import { buildHistoricalGhostProfile, compareGhostPace } from './ghostPacing'

function events(runId, outcomes, spacingMs = 1000, startMs = Date.parse('2026-07-01T12:00:00Z')) {
  return outcomes.map((outcome, index) => ({
    id: `${runId}-${index}`, regimen_run_id: runId, outcome, sequence: index + 1,
    occurred_at: new Date(startMs + index * spacingMs).toISOString(), set_order: index < 3 ? 1 : 2,
  }))
}

describe('ghost pacing', () => {
  it('selects the highest-scoring eligible run and freezes normalized points', () => {
    const profile = buildHistoricalGhostProfile([
      { id: 'lower', total_score: 80, completed_at: '2026-07-02T00:00:00Z' },
      { id: 'best', total_score: 100, completed_at: '2026-07-01T00:00:00Z' },
    ], [...events('lower', ['make', 'miss', 'make', 'miss', 'make']), ...events('best', ['make', 'make', 'make', 'miss', 'make'], 2000)])

    expect(profile).toMatchObject({ sourceRunId: 'best', sourceScore: 100, eventCount: 5, durationMs: 8000 })
    expect(profile.points.at(-1)).toMatchObject({ attempt: 5, cumulativeMakes: 4, setOrder: 2 })
  })

  it('uses the newest completion as the deterministic score tie-break', () => {
    const profile = buildHistoricalGhostProfile([
      { id: 'old', total_score: 100, completed_at: '2026-07-01T00:00:00Z' },
      { id: 'new', total_score: 100, completed_at: '2026-07-02T00:00:00Z' },
    ], [...events('old', ['make', 'make', 'make', 'make', 'make']), ...events('new', ['miss', 'miss', 'miss', 'miss', 'miss'])])
    expect(profile.sourceRunId).toBe('new')
  })

  it('withholds comparison until three current real-time events', () => {
    const profile = buildHistoricalGhostProfile(
      [{ id: 'ghost', total_score: 50 }], events('ghost', ['make', 'make', 'miss', 'make', 'miss'], 1000),
    )
    expect(compareGhostPace(events('current', ['make', 'miss']), profile)).toEqual({
      ready: false, currentAttempts: 2, attemptsNeeded: 1,
    })
  })

  it('reports attempt, time, and make deltas at comparable progress', () => {
    const profile = buildHistoricalGhostProfile(
      [{ id: 'ghost', total_score: 50 }], events('ghost', ['make', 'miss', 'make', 'miss', 'make'], 2000),
    )
    const result = compareGhostPace(events('current', ['make', 'make', 'make'], 1000), profile)
    expect(result).toMatchObject({ ready: true, currentAttempts: 3, attemptDelta: 1, timeDeltaMs: -2000, makeDelta: 1 })
  })

  it('rejects historical runs without five timed real-time events', () => {
    expect(buildHistoricalGhostProfile(
      [{ id: 'short', total_score: 999 }], events('short', ['make', 'make', 'make', 'make']),
    )).toBeNull()
  })
})
