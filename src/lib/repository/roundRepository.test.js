import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import {
  createRoundSyncAdapter,
  roundCreateKey,
  roundIdForOutboxEntry,
} from './roundRepository'

const USER_ID = 'user-1'
const ROUND_ID = 'round-1'
const NOW = Date.parse('2026-07-29T12:00:00.000Z')

// PostgREST/PostgREST-shaped failures, matching what `roundLog.js` rethrows.
const NETWORK_ERROR = Object.assign(new TypeError('Failed to fetch'), {})
const UNIQUE_VIOLATION = Object.assign(new Error('duplicate key value'), { code: '23505' })
const FOREIGN_KEY_VIOLATION = Object.assign(new Error('violates foreign key'), { code: '23503' })

function roundRow(overrides = {}) {
  return {
    id: ROUND_ID,
    user_id: USER_ID,
    course_id: 'course-1',
    layout_id: 'layout-1',
    status: 'in_progress',
    ...overrides,
  }
}

describe('roundRepository round outbox', () => {
  let database
  let api
  let activitySync
  let ensureActivity

  function adapter() {
    return createRoundSyncAdapter({ database, api, activitySync, ensureActivity })
  }

  async function queueCreate(payload = roundRow()) {
    return database.outbox.add({
      table: 'rounds',
      op: 'create',
      payload,
      createdAt: NOW,
      idempotencyKey: roundCreateKey(payload.id),
      dependencyKey: null,
      attemptCount: 0,
      lastErrorClass: null,
      nextRetryAt: null,
      poison: false,
    })
  }

  async function queueHole(overrides = {}) {
    const payload = {
      id: 'local-hole-1',
      round_id: ROUND_ID,
      hole_id: 'hole-1',
      score: 4,
      disc_id: null,
      notes: null,
      ...overrides,
    }
    return database.outbox.add({
      table: 'round_holes',
      op: 'upsert',
      payload,
      createdAt: NOW + 1,
      idempotencyKey: null,
      dependencyKey: roundCreateKey(payload.round_id),
      attemptCount: 0,
      lastErrorClass: null,
      nextRetryAt: null,
      poison: false,
    })
  }

  beforeEach(async () => {
    database = createAppDatabase(`RoundRepository-${crypto.randomUUID()}`)
    await database.open()
    api = {
      createRound: vi.fn(async (_userId, payload) => ({ ...payload, round_holes: [] })),
      updateRound: vi.fn(async (roundId, fields) => ({ id: roundId, user_id: USER_ID, ...fields })),
      upsertRoundHole: vi.fn(async (payload) => ({ ...payload, id: 'server-hole-1' })),
    }
    activitySync = { flush: vi.fn(async () => ({ hasPending: false, error: null, permanentFailureIds: [] })) }
    ensureActivity = vi.fn(async () => ({ id: ROUND_ID }))
  })

  afterEach(async () => database.delete())

  it('clears the entry and caches the result when a queued round create succeeds', async () => {
    await queueCreate()

    const result = await adapter().flush(USER_ID, NOW)

    expect(api.createRound).toHaveBeenCalledTimes(1)
    expect(await database.outbox.count()).toBe(0)
    expect(await database.rounds.get(ROUND_ID)).toMatchObject({ id: ROUND_ID, user_id: USER_ID })
    expect(result).toMatchObject({ hasPending: false, error: null, permanentFailureIds: [] })
  })

  it('clears a queued round-hole upsert and replaces the optimistic local row', async () => {
    await database.rounds.put({ ...roundRow(), round_holes: [] })
    await database.roundHoles.put({ id: 'local-hole-1', round_id: ROUND_ID, hole_id: 'hole-1', score: null })
    await queueHole()

    await expect(adapter().flush(USER_ID, NOW)).resolves.toMatchObject({ hasPending: false, error: null })

    expect(await database.outbox.count()).toBe(0)
    const holes = await database.roundHoles.toArray()
    expect(holes).toHaveLength(1)
    expect(holes[0]).toMatchObject({ id: 'server-hole-1', hole_id: 'hole-1', score: 4 })
  })

  it('increments the attempt count and stays queued when the failure is transient', async () => {
    api.createRound.mockRejectedValue(NETWORK_ERROR)
    await queueCreate()

    const first = await adapter().flush(USER_ID, NOW)

    expect(first).toMatchObject({ hasPending: true, error: { permanent: false }, permanentFailureIds: [] })
    const afterFirst = await database.outbox.toArray()
    expect(afterFirst).toHaveLength(1)
    expect(afterFirst[0]).toMatchObject({
      attemptCount: 1,
      lastErrorClass: 'transient',
      poison: false,
      nextRetryAt: NOW + 2000, // shared backoff curve: 2s, 4s, 8s ... capped at 60s
    })

    // Still inside the backoff window: nothing is retried.
    await adapter().flush(USER_ID, NOW + 1000)
    expect(api.createRound).toHaveBeenCalledTimes(1)
    expect((await database.outbox.toArray())[0]).toMatchObject({ attemptCount: 1 })

    // Backoff elapsed: retried, and the attempt count keeps climbing.
    await adapter().flush(USER_ID, NOW + 2000)
    expect(api.createRound).toHaveBeenCalledTimes(2)
    expect((await database.outbox.toArray())[0]).toMatchObject({
      attemptCount: 2,
      lastErrorClass: 'transient',
      poison: false,
      nextRetryAt: NOW + 2000 + 4000,
    })
  })

  it('poisons a permanently failing entry instead of retrying it forever', async () => {
    api.upsertRoundHole.mockRejectedValue(UNIQUE_VIOLATION)
    await database.rounds.put({ ...roundRow(), round_holes: [] })
    await queueHole()

    const result = await adapter().flush(USER_ID, NOW)

    const [row] = await database.outbox.toArray()
    expect(row).toMatchObject({
      attemptCount: 1,
      lastErrorClass: 'permanent',
      poison: true,
      nextRetryAt: null,
    })
    expect(result).toMatchObject({ hasPending: false, error: { permanent: true } })
    expect(result.permanentFailureIds).toEqual([row.id])

    // The whole point of poison: no further automatic attempts, however many
    // reconnects or app loads follow.
    await adapter().flush(USER_ID, NOW + 60_000)
    await adapter().flush(USER_ID, NOW + 600_000)
    expect(api.upsertRoundHole).toHaveBeenCalledTimes(1)
    expect((await database.outbox.toArray())[0]).toMatchObject({ attemptCount: 1, poison: true })
  })

  it('classifies a 4xx as permanent and a 5xx as transient, via the shared classifier', async () => {
    api.updateRound.mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }))
    await database.outbox.add({
      table: 'rounds',
      op: 'update',
      payload: { roundId: ROUND_ID, fields: { status: 'completed' } },
      createdAt: NOW,
      dependencyKey: roundCreateKey(ROUND_ID),
      attemptCount: 0,
      poison: false,
      nextRetryAt: null,
    })
    await adapter().flush(USER_ID, NOW)
    expect((await database.outbox.toArray())[0]).toMatchObject({ poison: true, lastErrorClass: 'permanent' })

    await database.outbox.clear()
    api.updateRound.mockRejectedValue(Object.assign(new Error('bad gateway'), { status: 502 }))
    await database.outbox.add({
      table: 'rounds',
      op: 'update',
      payload: { roundId: ROUND_ID, fields: { status: 'completed' } },
      createdAt: NOW,
      dependencyKey: roundCreateKey(ROUND_ID),
      attemptCount: 0,
      poison: false,
      nextRetryAt: null,
    })
    await adapter().flush(USER_ID, NOW)
    expect((await database.outbox.toArray())[0]).toMatchObject({ poison: false, lastErrorClass: 'transient' })
  })

  it('holds scorecard writes behind their round create, then drains both in one pass', async () => {
    await queueCreate()
    await queueHole()

    // While the create is failing, the dependent hole must not be attempted —
    // it would hit a foreign-key violation and be poisoned for a fault that is
    // not its own.
    api.createRound.mockRejectedValueOnce(NETWORK_ERROR)
    api.upsertRoundHole.mockRejectedValue(FOREIGN_KEY_VIOLATION)
    await adapter().flush(USER_ID, NOW)
    expect(api.upsertRoundHole).not.toHaveBeenCalled()
    expect((await database.outbox.where('table').equals('round_holes').toArray())[0]).toMatchObject({
      attemptCount: 0,
      poison: false,
    })

    // Once the create lands, the dependent write is released in the same pass.
    api.upsertRoundHole.mockImplementation(async (payload) => ({ ...payload, id: 'server-hole-1' }))
    await adapter().flush(USER_ID, NOW + 2000)
    expect(api.createRound).toHaveBeenCalledTimes(2)
    expect(api.upsertRoundHole).toHaveBeenCalledTimes(1)
    expect(await database.outbox.count()).toBe(0)
  })

  it('surfaces poisoned entries by round and lets an explicit retry requeue them', async () => {
    api.upsertRoundHole.mockRejectedValue(UNIQUE_VIOLATION)
    await database.rounds.put({ ...roundRow(), round_holes: [] })
    await queueHole()
    const sync = adapter()
    await sync.flush(USER_ID, NOW)

    const poisoned = await sync.listPoisoned()
    expect(poisoned).toHaveLength(1)
    expect(poisoned.map(roundIdForOutboxEntry)).toEqual([ROUND_ID])

    expect(await sync.retryPoisoned()).toBe(1)
    expect((await database.outbox.toArray())[0]).toMatchObject({
      poison: false,
      nextRetryAt: null,
      lastErrorClass: null,
      attemptCount: 1, // history is kept; only the retry gate is cleared
    })

    api.upsertRoundHole.mockImplementation(async (payload) => ({ ...payload, id: 'server-hole-1' }))
    await expect(sync.flush(USER_ID, NOW + 1000)).resolves.toMatchObject({ hasPending: false, error: null })
    expect(await database.outbox.count()).toBe(0)
  })

  it('leaves outbox rows belonging to other queues untouched', async () => {
    await database.outbox.add({
      table: 'activity_lifecycle',
      op: 'create_draft',
      payload: {},
      createdAt: NOW,
      poison: false,
    })
    api.createRound.mockRejectedValue(NETWORK_ERROR)
    await queueCreate()

    await adapter().flush(USER_ID, NOW)

    const lifecycle = await database.outbox.where('table').equals('activity_lifecycle').first()
    expect(lifecycle).not.toHaveProperty('attemptCount')
    expect(lifecycle).not.toHaveProperty('lastErrorClass')
    expect(lifecycle.poison).toBe(false)
  })

  it('reports rounds blocked by a permanently failed lifecycle parent as needing attention', async () => {
    activitySync.flush.mockResolvedValue({
      hasPending: true,
      error: { permanent: true },
      permanentFailureIds: ['activity-row'],
    })
    api.createRound.mockRejectedValue(NETWORK_ERROR)
    await queueCreate()

    await expect(adapter().flush(USER_ID, NOW)).resolves.toMatchObject({
      hasPending: true,
      error: { permanent: true },
    })
  })

  it('maps every queued entry shape back to the round the user would recognise', () => {
    expect(roundIdForOutboxEntry({ table: 'rounds', op: 'create', payload: { id: ROUND_ID } })).toBe(ROUND_ID)
    expect(roundIdForOutboxEntry({ table: 'rounds', op: 'update', payload: { roundId: ROUND_ID } })).toBe(ROUND_ID)
    expect(roundIdForOutboxEntry({ table: 'round_holes', op: 'upsert', payload: { round_id: ROUND_ID } })).toBe(ROUND_ID)
    expect(roundIdForOutboxEntry({ table: 'activity_lifecycle', payload: {} })).toBeNull()
  })
})
