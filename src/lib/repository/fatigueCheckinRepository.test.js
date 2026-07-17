import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import { createFatigueCheckinRepository } from './fatigueCheckinRepository'

const databases = []
afterEach(async () => {
  await Promise.all(databases.map((database) => database.delete()))
  databases.length = 0
})
describe('fatigueCheckinRepository', () => {
  it('keeps an immutable check-in locally when remote insert is unavailable', async () => {
    const database = createAppDatabase(`fatigue-${crypto.randomUUID()}`)
    databases.push(database)
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({
      database,
      client: { from: () => ({ insert }) },
    })
    const row = {
      id: 'check-1', user_id: 'user-1', putt_session_id: null, regimen_run_id: 'run-1',
      stage_index: 1, trigger_reason: 'trailing_misses', fatigue_rating: 4,
      skipped: false, recorded_at: '2026-07-16T20:00:00Z', idempotency_key: 'fatigue:run-1:1',
    }

    expect(await repository.record(row)).toMatchObject({ sync_state: 'pending' })
    expect(await database.practiceFatigueCheckins.get('check-1')).toEqual(row)
  })
})
