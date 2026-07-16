import { describe, expect, it } from 'vitest'
import { buildDiscHistory, buildDiscPerformance } from './discProfile'

describe('disc profile context', () => {
  it('uses only physically attributed events supplied for one disc', () => {
    const result = buildDiscPerformance({
      puttEvents: [{ outcome: 'make' }, { outcome: 'miss' }, { outcome: 'make' }],
      roundHoles: [
        { score: 3, round: { played_at: '2026-07-01' }, hole: { par: 3 } },
        { score: 5, round: { played_at: '2026-07-03' }, hole: { par: 4 } },
        { score: null, round: { played_at: '2026-07-04' }, hole: { par: 3 } },
      ],
    })
    expect(result.putting).toMatchObject({ makes: 2, attempts: 3, pct: 2 / 3 })
    expect(result.putting.interval).not.toBeNull()
    expect(result.rounds).toMatchObject({ holesPlayed: 2, averageScore: 4, averageToPar: 0.5, lastUsedAt: '2026-07-04' })
  })

  it('returns honest insufficient-data nulls', () => {
    expect(buildDiscPerformance()).toMatchObject({
      putting: { makes: 0, attempts: 0, pct: null, interval: null },
      rounds: { holesPlayed: 0, averageScore: null, averageToPar: null, lastUsedAt: null },
    })
  })

  it('merges lifecycle sources in reverse chronology', () => {
    const rows = buildDiscHistory({
      stateEvents: [{ id: 's', event_type: 'status_changed', occurred_at: '2026-07-01T00:00:00Z' }],
      odometerEvents: [{ id: 'o', metric: 'throws', delta: 10, source: 'manual_entry', occurred_at: '2026-07-03T00:00:00Z' }],
      lostFoundUpdates: [{ id: 'l', event_type: 'recovered', occurred_at: '2026-07-02T00:00:00Z' }],
      photos: [{ id: 'p', slot: 'front', created_at: '2026-07-04T00:00:00Z' }],
    })
    expect(rows.map((row) => row.id)).toEqual(['photo:p', 'odometer:o', 'lost:l', 'state:s'])
  })
})
