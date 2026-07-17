import { describe, expect, it, vi } from 'vitest'
import { createWeeklyReportRepository } from './weeklyReportRepository'

function result(value) {
  return { data: value, error: null }
}

function query(resolveValue, capture) {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), in: vi.fn(() => builder),
    is: vi.fn(() => builder), gte: vi.fn(() => builder), lt: vi.fn(() => builder),
    order: vi.fn(() => builder), limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolveValue)), maybeSingle: vi.fn(() => Promise.resolve(resolveValue)),
    insert: vi.fn((row) => { capture?.(row); return builder }),
    then: (resolve) => Promise.resolve(resolveValue).then(resolve),
  }
  return builder
}

describe('weeklyReportRepository', () => {
  it('creates a new immutable version that supersedes the latest snapshot', async () => {
    const inserted = []
    const previous = { id: 'report-1', user_id: 'user-1', week_start: '2026-03-02', version: 1 }
    const created = { ...previous, id: 'report-2', version: 2, generation_reason: 'correction_regeneration' }
    const tableCalls = new Map()
    const responses = {
      profiles: [result({ timezone: 'America/New_York' })],
      activities: [result([{ id: 'session-1' }, { id: 'round-1' }])],
      putt_sessions: [result([{ id: 'session-1', created_at: '2026-03-04T15:00:00Z', putt_distance_logs: [{ makes: 8, attempts: 10 }] }])],
      putting_regimen_runs: [result([])],
      rounds: [result([{ id: 'round-1', played_at: '2026-03-05T18:00:00Z', status: 'completed' }])],
      weekly_report_snapshots: [result(previous), result(created)],
    }
    const client = { from: vi.fn((table) => {
      const index = tableCalls.get(table) ?? 0
      tableCalls.set(table, index + 1)
      return query(responses[table][index], table === 'weekly_report_snapshots' && index === 1 ? (row) => inserted.push(row) : null)
    }) }
    const database = { weeklyReportSnapshots: { put: vi.fn() } }

    const repository = createWeeklyReportRepository({ client, database })
    await repository.generate('user-1', { now: new Date('2026-03-09T14:00:00Z') })

    expect(inserted[0]).toMatchObject({
      user_id: 'user-1', week_start: '2026-03-02', window_start: '2026-03-02T05:00:00.000Z',
      window_end: '2026-03-09T04:00:00.000Z', version: 2, supersedes_id: 'report-1',
      generation_reason: 'correction_regeneration', metrics: { makes: 8, attempts: 10, makePct: 0.8, completedRounds: 1 },
    })
    expect(database.weeklyReportSnapshots.put).toHaveBeenCalledWith(created)
  })
})
