import { describe, expect, it } from 'vitest'
import { buildWeeklyReportSnapshot, latestCompletedWeekWindow, zonedMidnightUtc } from './weeklyReport'

describe('weekly report snapshot', () => {
  it('uses an immutable Monday-Sunday window and deterministic metrics', () => {
    const report = buildWeeklyReportSnapshot({
      weekStart: '2026-07-13', timezone: 'UTC', windowStart: '2026-07-13T00:00:00Z',
      windowEnd: '2026-07-20T00:00:00Z', sourceCutoff: '2026-07-20T00:00:00Z',
      sessions: [{ created_at: '2026-07-13T12:00:00Z', putt_distance_logs: [{ makes: 7, attempts: 10 }] }],
      runs: [{ started_at: '2026-07-19T23:59:59Z', putting_regimen_run_sets: [{ makes: 4, attempts: 5 }] }],
      rounds: [{ played_at: '2026-07-15T12:00:00Z', status: 'completed' }],
    })
    expect(report.sample_counts).toEqual({ practiceSessions: 2, putts: 15, rounds: 1 })
    expect(report.metrics).toMatchObject({ makes: 11, attempts: 15, completedRounds: 1 })
    expect(report.highlights.map((item) => item.key)).toEqual(['putting_accuracy', 'practice_sessions', 'rounds_completed'])
  })

  it('excludes the next Monday and rejects non-Monday starts', () => {
    expect(buildWeeklyReportSnapshot({
      weekStart: '2026-07-13', timezone: 'UTC', windowStart: '2026-07-13T00:00:00Z',
      windowEnd: '2026-07-20T00:00:00Z', sourceCutoff: '2026-07-20T00:00:00Z',
      sessions: [{ created_at: '2026-07-20T00:00:00Z', putt_distance_logs: [{ makes: 1, attempts: 1 }] }],
    }).sample_counts.putts).toBe(0)
    expect(() => buildWeeklyReportSnapshot({ weekStart: '2026-07-14' })).toThrow('week_start_must_be_monday')
  })

  it('derives the latest completed local week across a DST boundary', () => {
    expect(latestCompletedWeekWindow({
      now: new Date('2026-03-09T14:00:00Z'), timezone: 'America/New_York',
    })).toEqual({
      weekStart: '2026-03-02', weekEnd: '2026-03-08', timezone: 'America/New_York',
      windowStart: '2026-03-02T05:00:00.000Z', windowEnd: '2026-03-09T04:00:00.000Z',
    })
  })

  it('converts local midnight for positive-offset zones', () => {
    expect(zonedMidnightUtc('2026-07-13', 'Pacific/Auckland')).toBe('2026-07-12T12:00:00.000Z')
  })
})
