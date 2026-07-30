import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import { createFatigueCheckinRepository, FATIGUE_CHECKIN_TABLE } from './fatigueCheckinRepository'

const databases = []
afterEach(async () => {
  await Promise.all(databases.map((database) => database.delete()))
  databases.length = 0
})

function freshDatabase() {
  const database = createAppDatabase(`fatigue-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

function checkinRow(overrides = {}) {
  return {
    id: 'check-1', user_id: 'user-1', putt_session_id: null, regimen_run_id: 'run-1',
    stage_index: 1, trigger_reason: 'trailing_misses', fatigue_rating: 4,
    skipped: false, recorded_at: '2026-07-16T20:00:00Z', idempotency_key: 'fatigue:run-1:1',
    ...overrides,
  }
}

// A client whose insert fails and whose select returns whatever the test hands
// it, so the offline write path and the later remote read can be driven
// independently — which is the pair that lost the check-in.
function fakeClient({ insert, select }) {
  return {
    from: () => ({
      insert,
      select: () => ({
        eq: () => ({ order: async () => (select ? select() : { data: null, error: new Error('offline') }) }),
      }),
    }),
  }
}

async function outboxFor(database) {
  return (await database.outbox.toArray()).filter((entry) => entry.table === FATIGUE_CHECKIN_TABLE)
}

describe('fatigueCheckinRepository.record', () => {
  it('keeps an immutable check-in locally when remote insert is unavailable', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })
    const row = checkinRow()

    expect(await repository.record(row)).toMatchObject({ sync_state: 'pending' })
    expect(await database.practiceFatigueCheckins.get('check-1')).toEqual(row)
  })

  // The defect: this was the only durable write in the repository layer with no
  // outbox entry, so a failed insert was never retried by anything.
  it('queues a failed check-in in the outbox so it can be retried', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })

    await repository.record(checkinRow())

    const queued = await outboxFor(database)
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ op: 'create', payload: { id: 'check-1' } })
  })

  it('queues before the remote attempt, so a request that dies in flight is still recoverable', async () => {
    const database = freshDatabase()
    let queuedDuringInsert = null
    const insert = vi.fn().mockImplementation(async () => {
      queuedDuringInsert = await outboxFor(database)
      throw new Error('connection reset')
    })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })

    expect(await repository.record(checkinRow())).toMatchObject({ sync_state: 'pending' })
    expect(queuedDuringInsert).toHaveLength(1)
    expect(await outboxFor(database)).toHaveLength(1)
  })

  it('clears the queue entry and reports synced when the insert lands', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: null })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })

    expect(await repository.record(checkinRow())).toMatchObject({ sync_state: 'synced' })
    expect(await outboxFor(database)).toHaveLength(0)
  })
})

describe('fatigueCheckinRepository.flushPending', () => {
  it('replays a queued check-in on reconnect and drains the outbox', async () => {
    const database = freshDatabase()
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: new Error('offline') })
      .mockResolvedValueOnce({ error: null })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })

    await repository.record(checkinRow())
    expect(await outboxFor(database)).toHaveLength(1)

    await repository.flushPending()

    expect(insert).toHaveBeenCalledTimes(2)
    expect(await outboxFor(database)).toHaveLength(0)
  })

  it('leaves the entry queued when the replay is still offline', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })

    await repository.record(checkinRow())
    await repository.flushPending()

    expect(await outboxFor(database)).toHaveLength(1)
  })

  // E2 audit findings 1 and 2: a replay of a write that actually landed must not
  // poison the queue. `practice_fatigue_checkins` grants insert only, so the
  // duplicate is classified here rather than upserted away server-side.
  it('treats a duplicate-key replay as done rather than retrying it forever', async () => {
    const database = freshDatabase()
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: new Error('offline') })
      .mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })

    await repository.record(checkinRow())
    await repository.flushPending()

    expect(await outboxFor(database)).toHaveLength(0)
  })
})

describe('fatigueCheckinRepository.listForParent', () => {
  // The exact `data ?? local` case. A successful remote read returning [] is not
  // nullish, so the empty array used to win and the queued check-in vanished
  // from the UI as well as from the server.
  it('does not let a successful but EMPTY remote read hide a queued local row', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({
      database,
      client: fakeClient({ insert, select: () => ({ data: [], error: null }) }),
    })
    await repository.record(checkinRow())

    const rows = await repository.listForParent({ regimenRunId: 'run-1' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'check-1', fatigue_rating: 4, sync_state: 'pending' })
  })

  it('unions a queued row into a non-empty remote read instead of dropping it', async () => {
    const database = freshDatabase()
    const remote = checkinRow({ id: 'check-0', stage_index: 1, recorded_at: '2026-07-16T19:00:00Z', idempotency_key: 'fatigue:run-1:0' })
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({
      database,
      client: fakeClient({ insert, select: () => ({ data: [remote], error: null }) }),
    })
    await repository.record(checkinRow({ id: 'check-1', stage_index: 2, recorded_at: '2026-07-16T20:00:00Z', idempotency_key: 'fatigue:run-1:2' }))

    const rows = await repository.listForParent({ regimenRunId: 'run-1' })

    expect(rows.map((row) => row.id)).toEqual(['check-0', 'check-1'])
    expect(rows.map((row) => row.sync_state)).toEqual(['synced', 'pending'])
  })

  it('falls back to the local mirror when the remote read itself fails', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({ database, client: fakeClient({ insert }) })
    await repository.record(checkinRow())

    const rows = await repository.listForParent({ regimenRunId: 'run-1' })

    expect(rows).toMatchObject([{ id: 'check-1', sync_state: 'pending' }])
  })

  it('reports a check-in as synced once the remote read confirms it', async () => {
    const database = freshDatabase()
    const row = checkinRow()
    const insert = vi.fn().mockResolvedValue({ error: null })
    const repository = createFatigueCheckinRepository({
      database,
      client: fakeClient({ insert, select: () => ({ data: [row], error: null }) }),
    })
    await repository.record(row)

    const rows = await repository.listForParent({ regimenRunId: 'run-1' })

    expect(rows).toMatchObject([{ id: 'check-1', sync_state: 'synced' }])
  })

  // A freeform session reads by putt_session_id; the parent is exclusive, so a
  // regimen run's queued check-in must not leak into it.
  it('scopes the merge to the requested parent', async () => {
    const database = freshDatabase()
    const insert = vi.fn().mockResolvedValue({ error: new Error('offline') })
    const repository = createFatigueCheckinRepository({
      database,
      client: fakeClient({ insert, select: () => ({ data: [], error: null }) }),
    })
    await repository.record(checkinRow())
    await repository.record(checkinRow({
      id: 'check-2', putt_session_id: 'session-9', regimen_run_id: null, idempotency_key: 'fatigue:session-9:1',
    }))

    expect(await repository.listForParent({ regimenRunId: 'run-1' })).toMatchObject([{ id: 'check-1' }])
    expect(await repository.listForParent({ puttSessionId: 'session-9' })).toMatchObject([{ id: 'check-2' }])
  })
})
