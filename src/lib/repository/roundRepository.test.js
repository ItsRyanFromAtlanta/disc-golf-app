import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../roundLog', () => ({
  createRound: vi.fn(),
  fetchRound: vi.fn(),
  fetchRounds: vi.fn(),
  updateRound: vi.fn(),
  upsertRoundHole: vi.fn(),
}))

vi.mock('./activitySync', () => ({
  createActivitySyncAdapter: () => ({ flush: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('./activityRepository', () => ({
  activityRepository: {
    getById: vi.fn().mockResolvedValue(null),
    getActive: vi.fn().mockResolvedValue(null),
    createDraft: vi.fn(async ({ id }) => ({ activity: { id, state: 'active', version: 1 } })),
    start: vi.fn(async (id) => ({ activity: { id, state: 'active', version: 1 } })),
    finalize: vi.fn(async (id) => ({ activity: { id, state: 'finalized', version: 2 } })),
  },
}))

vi.mock('../instantLaunch/installationId', () => ({ getInstallationId: () => 'installation-test' }))

import { db } from '../db/dexieDb'
import { createRound, fetchRound, upsertRoundHole } from '../roundLog'
import { activityRepository } from './activityRepository'
import { flushRoundOutbox, loadRound, saveRoundHole } from './roundRepository'
import { roundTotal } from '../rounds'

const USER_ID = 'user-1'

async function queuedRoundEntries() {
  return (await db.outbox.toArray()).filter((entry) => entry.table === 'rounds' || entry.table === 'round_holes')
}

describe('roundRepository', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    activityRepository.getById.mockResolvedValue(null)
    activityRepository.getActive.mockResolvedValue(null)
    await db.open()
    await Promise.all([db.rounds.clear(), db.roundHoles.clear(), db.outbox.clear()])
  })

  // The server owns the row identity for a hole: `round_holes` is uniquely
  // keyed on (round_id, hole_id), so a hole first written on another device
  // comes back under that device's id. Keeping both rows would count the hole's
  // strokes twice everywhere the cache is read.
  it('collapses the optimistic row when the server returns a different hole id', async () => {
    await db.rounds.put({ id: 'round-1', user_id: USER_ID, round_holes: [] })
    upsertRoundHole.mockResolvedValue({
      id: 'stored-row',
      round_id: 'round-1',
      hole_id: 'hole-1',
      score: 4,
      disc_id: null,
      notes: null,
    })

    await saveRoundHole({ id: 'optimistic-row', roundId: 'round-1', holeId: 'hole-1', score: 4 })

    const cached = await db.roundHoles.where('round_id').equals('round-1').toArray()
    expect(cached.map((row) => row.id)).toEqual(['stored-row'])
    expect(roundTotal(cached)).toBe(4)

    const round = await db.rounds.get('round-1')
    expect(round.round_holes).toHaveLength(1)
    expect(round.round_holes[0]).toMatchObject({ id: 'stored-row', score: 4 })
    expect(await queuedRoundEntries()).toHaveLength(0)
  })

  it('repairs a cache that already holds two rows for one hole', async () => {
    await db.rounds.put({ id: 'round-1', user_id: USER_ID, round_holes: [] })
    await db.roundHoles.bulkPut([
      { id: 'duplicate-a', round_id: 'round-1', hole_id: 'hole-1', score: 4 },
      { id: 'duplicate-b', round_id: 'round-1', hole_id: 'hole-1', score: 4 },
    ])
    upsertRoundHole.mockResolvedValue({ id: 'duplicate-a', round_id: 'round-1', hole_id: 'hole-1', score: 4 })

    await saveRoundHole({ id: 'duplicate-a', roundId: 'round-1', holeId: 'hole-1', score: 4 })

    const cached = await db.roundHoles.where('round_id').equals('round-1').toArray()
    expect(cached.map((row) => row.id)).toEqual(['duplicate-a'])
    expect(roundTotal(cached)).toBe(4)
  })

  it('keeps the optimistic row and the queued write when the hole save fails', async () => {
    upsertRoundHole.mockRejectedValue(new Error('offline'))

    await expect(saveRoundHole({ id: 'optimistic-row', roundId: 'round-1', holeId: 'hole-1', score: 3 })).rejects.toThrow(
      /offline/,
    )

    expect(await db.roundHoles.get('optimistic-row')).toMatchObject({ hole_id: 'hole-1', score: 3 })
    const queued = await queuedRoundEntries()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ table: 'round_holes', op: 'upsert' })
  })

  it('replays a queued round for its owner and clears the entry', async () => {
    const payload = { id: 'round-9', user_id: USER_ID, course_id: 'course-1', layout_id: 'layout-1' }
    await db.outbox.add({ table: 'rounds', op: 'create', payload, createdAt: Date.now() })
    createRound.mockResolvedValue({ ...payload, round_holes: [] })

    await flushRoundOutbox(USER_ID)

    expect(createRound).toHaveBeenCalledWith(USER_ID, payload)
    expect(await queuedRoundEntries()).toHaveLength(0)
    expect(await db.rounds.get('round-9')).toMatchObject({ id: 'round-9', user_id: USER_ID })
  })

  // Two accounts can share a device. Replaying a queued round under whoever is
  // signed in now would re-home the other account's round onto this session,
  // because `createRound` stamps the caller's id onto the row.
  it('leaves another account\'s queued round untouched', async () => {
    const payload = { id: 'round-9', user_id: 'user-2', course_id: 'course-1', layout_id: 'layout-1' }
    await db.outbox.add({ table: 'rounds', op: 'create', payload, createdAt: Date.now() })

    await flushRoundOutbox(USER_ID)

    expect(createRound).not.toHaveBeenCalled()
    expect(activityRepository.createDraft).not.toHaveBeenCalled()
    expect(await queuedRoundEntries()).toHaveLength(1)
  })

  it('retains a queued entry whose replay fails', async () => {
    const payload = { id: 'round-9', user_id: USER_ID, course_id: 'course-1' }
    await db.outbox.add({ table: 'rounds', op: 'create', payload, createdAt: Date.now() })
    createRound.mockRejectedValue(new Error('still offline'))

    await expect(flushRoundOutbox(USER_ID)).resolves.toBeUndefined()

    expect(await queuedRoundEntries()).toHaveLength(1)
  })

  it('reads the cached round and its holes when the remote read fails', async () => {
    await db.rounds.put({ id: 'round-1', user_id: USER_ID, course_id: 'course-1' })
    await db.roundHoles.bulkPut([
      { id: 'rh-1', round_id: 'round-1', hole_id: 'hole-1', score: 3 },
      { id: 'rh-2', round_id: 'round-1', hole_id: 'hole-2', score: 4 },
    ])
    fetchRound.mockRejectedValue(new Error('offline'))

    const round = await loadRound('round-1', USER_ID)

    expect(round.round_holes).toHaveLength(2)
    expect(roundTotal(round.round_holes)).toBe(7)
  })

  it('refuses a cached round that belongs to another account', async () => {
    await db.rounds.put({ id: 'round-1', user_id: 'user-2', course_id: 'course-1' })
    fetchRound.mockRejectedValue(new Error('offline'))

    await expect(loadRound('round-1', USER_ID)).rejects.toThrow(/offline/)
  })
})
