import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchRoundPlayers = vi.fn()
const upsertRoundPlayer = vi.fn()
const deleteRoundPlayer = vi.fn()

// An isolated real Dexie database standing in for the module-level singleton,
// so the cache-convergence assertions below run against IndexedDB rather than a
// hand-written double that could agree with a broken implementation. Built
// inside the factory because `vi.mock` is hoisted above every top-level
// binding.
vi.mock('../db/dexieDb', async () => {
  const actual = await vi.importActual('../db/dexieDb')
  return { ...actual, db: actual.createAppDatabase(`RoundPlayerRepository-${crypto.randomUUID()}`) }
})

vi.mock('../roundLog', () => ({
  fetchRoundPlayers: (...args) => fetchRoundPlayers(...args),
  upsertRoundPlayer: (...args) => upsertRoundPlayer(...args),
  deleteRoundPlayer: (...args) => deleteRoundPlayer(...args),
}))

const { db: database } = await import('../db/dexieDb')
const {
  cacheRoundPlayer,
  loadRoundPlayers,
  removeCachedRoundPlayer,
  removeRoundPlayer,
  replayRoundPlayerEntry,
  saveRoundPlayer,
} = await import('./roundPlayerRepository')

const ROUND_ID = 'round-1'
const USER_ID = 'user-1'

// The two shapes PostgREST and Postgres use for "that table is not deployed".
const MISSING_TABLE_POSTGREST = Object.assign(new Error('Could not find the table'), { code: 'PGRST205' })
const MISSING_TABLE_POSTGRES = Object.assign(new Error('relation does not exist'), { code: '42P01' })
const NETWORK_ERROR = new TypeError('Failed to fetch')
const RLS_DENIAL = Object.assign(new Error('permission denied'), { code: '42501', status: 403 })

function serverRow(position, overrides = {}) {
  return {
    id: `server-${position}`,
    round_id: ROUND_ID,
    user_id: USER_ID,
    position,
    display_name: `Player ${position}`,
    total_score: null,
    created_at: '2026-07-30T12:00:00.000Z',
    updated_at: '2026-07-30T12:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  fetchRoundPlayers.mockReset()
  upsertRoundPlayer.mockReset()
  deleteRoundPlayer.mockReset()
  if (!database.isOpen()) await database.open()
  await database.roundPlayers.clear()
  await database.outbox.clear()
})

afterAll(async () => database.delete())

describe('loadRoundPlayers', () => {
  it('returns nothing, available, for a round that does not exist yet', async () => {
    await expect(loadRoundPlayers(null, USER_ID)).resolves.toEqual({
      players: [],
      available: true,
      fromCache: false,
    })
    expect(fetchRoundPlayers).not.toHaveBeenCalled()
  })

  it('returns an empty roster for a round with no companions', async () => {
    fetchRoundPlayers.mockResolvedValue([])
    await expect(loadRoundPlayers(ROUND_ID, USER_ID)).resolves.toEqual({
      players: [],
      available: true,
      fromCache: false,
    })
  })

  it('reads the roster remotely and mirrors it', async () => {
    fetchRoundPlayers.mockResolvedValue([serverRow(2), serverRow(1)])

    const result = await loadRoundPlayers(ROUND_ID, USER_ID)

    expect(result.available).toBe(true)
    expect(result.players.map((row) => row.position)).toEqual([1, 2])
    expect(await database.roundPlayers.count()).toBe(2)
  })

  it('drops mirrored rows the server no longer has', async () => {
    await database.roundPlayers.put(serverRow(3))
    fetchRoundPlayers.mockResolvedValue([serverRow(1)])

    await loadRoundPlayers(ROUND_ID, USER_ID)

    expect((await database.roundPlayers.toArray()).map((row) => row.position)).toEqual([1])
  })

  // Pre-deployment review finding #2. A companion whose write is still queued
  // is absent from the remote read by definition — that used to read as "the
  // server no longer has this row" and get swept, even though the outbox still
  // held it and the write would land on the next drain. The panel visibly lost
  // a companion for the length of that window. Same bug, same shape, as
  // `readRoundList` (`git show 5ace5fe`).
  it('keeps a companion whose add is still queued instead of evicting it', async () => {
    await cacheRoundPlayer({ id: 'local-1', round_id: ROUND_ID, user_id: USER_ID, position: 2, display_name: 'Dave' })
    await database.outbox.add({
      table: 'round_players',
      op: 'upsert',
      payload: { round_id: ROUND_ID, user_id: USER_ID, position: 2, display_name: 'Dave', total_score: null },
      createdAt: Date.now(),
      idempotencyKey: null,
      dependencyKey: `round-outbox:${ROUND_ID}:create`,
      attemptCount: 0,
      lastErrorClass: null,
      nextRetryAt: null,
      poison: false,
    })
    fetchRoundPlayers.mockResolvedValue([serverRow(1)])

    const result = await loadRoundPlayers(ROUND_ID, USER_ID)

    expect(result.players.map((row) => row.position)).toEqual([1, 2])
    expect(await database.roundPlayers.get('local-1')).toBeTruthy()
  })

  // The exemption is scoped to queued seats, not every unmatched row — an
  // over-broad exemption would leave a companion removed on another device
  // lingering in the mirror forever. This is the same round, the same read,
  // with no matching outbox entry for seat 3.
  it('still evicts a companion that is genuinely gone, even with an unrelated queue entry pending', async () => {
    await database.roundPlayers.put(serverRow(3))
    await database.outbox.add({
      table: 'round_players',
      op: 'upsert',
      payload: { round_id: ROUND_ID, user_id: USER_ID, position: 5, display_name: 'Someone Else', total_score: null },
      createdAt: Date.now(),
      idempotencyKey: null,
      dependencyKey: `round-outbox:${ROUND_ID}:create`,
      attemptCount: 0,
      lastErrorClass: null,
      nextRetryAt: null,
      poison: false,
    })
    fetchRoundPlayers.mockResolvedValue([serverRow(1)])

    const result = await loadRoundPlayers(ROUND_ID, USER_ID)

    expect(result.players.map((row) => row.position)).toEqual([1])
    expect(await database.roundPlayers.get('server-3')).toBeUndefined()
  })

  // The distinction the whole read exists for. "Not deployed" is a claim about
  // the product; "unreachable" is a claim about the network. Reporting the
  // first when the second is true tells a player standing in a field that a
  // shipped feature does not exist.
  it.each([
    ['PGRST205', MISSING_TABLE_POSTGREST],
    ['42P01', MISSING_TABLE_POSTGRES],
  ])('reports available: false when the table is not deployed (%s)', async (_code, error) => {
    fetchRoundPlayers.mockRejectedValue(error)

    await expect(loadRoundPlayers(ROUND_ID, USER_ID)).resolves.toEqual({
      players: [],
      available: false,
      fromCache: false,
    })
  })

  it('does not serve the mirror when the table is not deployed', async () => {
    await database.roundPlayers.put(serverRow(1))
    fetchRoundPlayers.mockRejectedValue(MISSING_TABLE_POSTGREST)

    const result = await loadRoundPlayers(ROUND_ID, USER_ID)

    expect(result.players).toEqual([])
    expect(result.available).toBe(false)
  })

  it('falls back to the mirror, still available, when the network is gone', async () => {
    await database.roundPlayers.put(serverRow(1))
    fetchRoundPlayers.mockRejectedValue(NETWORK_ERROR)

    const result = await loadRoundPlayers(ROUND_ID, USER_ID)

    expect(result).toMatchObject({ available: true, fromCache: true })
    expect(result.players.map((row) => row.position)).toEqual([1])
  })

  it('falls back to the mirror on an RLS denial rather than claiming the feature is absent', async () => {
    fetchRoundPlayers.mockRejectedValue(RLS_DENIAL)

    await expect(loadRoundPlayers(ROUND_ID, USER_ID)).resolves.toMatchObject({
      available: true,
      fromCache: true,
    })
  })

  it('never surfaces another account\'s rows even if the server returned them', async () => {
    fetchRoundPlayers.mockResolvedValue([serverRow(1), serverRow(2, { user_id: 'someone-else' })])

    const result = await loadRoundPlayers(ROUND_ID, USER_ID)

    expect(result.players.map((row) => row.position)).toEqual([1])
  })
})

describe('cacheRoundPlayer', () => {
  it('replaces the optimistic row when the server owns a different id for the seat', async () => {
    await cacheRoundPlayer({ id: 'local-1', round_id: ROUND_ID, user_id: USER_ID, position: 1, display_name: 'Dave' })
    await cacheRoundPlayer(serverRow(1, { display_name: 'Dave' }), { replacesId: 'local-1' })

    const rows = await database.roundPlayers.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('server-1')
  })

  // Convergence on the seat, not the id. Without this the mirror shows one more
  // player than the round has, which is the same defect class audit finding 1
  // fixed for round holes.
  it('clears any other local row holding the same seat', async () => {
    await database.roundPlayers.put(serverRow(1, { id: 'stale', display_name: 'Typo' }))
    await cacheRoundPlayer(serverRow(1, { display_name: 'Dave' }))

    const rows = await database.roundPlayers.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].display_name).toBe('Dave')
  })

  it('leaves other seats alone', async () => {
    await cacheRoundPlayer(serverRow(1))
    await cacheRoundPlayer(serverRow(2))
    expect(await database.roundPlayers.count()).toBe(2)
  })
})

describe('removeCachedRoundPlayer', () => {
  it('removes by seat and reports how many rows it cleared', async () => {
    await cacheRoundPlayer(serverRow(1))
    await expect(removeCachedRoundPlayer({ roundId: ROUND_ID, position: 1 })).resolves.toBe(1)
    expect(await database.roundPlayers.count()).toBe(0)
  })

  it('is a no-op for a seat that holds nobody', async () => {
    await expect(removeCachedRoundPlayer({ roundId: ROUND_ID, position: 4 })).resolves.toBe(0)
  })
})

describe('saveRoundPlayer', () => {
  it('queues, writes locally, sends, and clears the entry on success', async () => {
    upsertRoundPlayer.mockImplementation(async (payload) => ({ ...payload, id: 'server-1' }))

    const result = await saveRoundPlayer({
      roundId: ROUND_ID,
      userId: USER_ID,
      position: 1,
      displayName: 'Dave',
      totalScore: '54',
    })

    expect(result).toMatchObject({ id: 'server-1', display_name: 'Dave', total_score: 54 })
    expect(await database.outbox.count()).toBe(0)
    expect((await database.roundPlayers.toArray())[0].id).toBe('server-1')
  })

  it('never sends the primary key, so a conflict cannot rewrite it', async () => {
    upsertRoundPlayer.mockImplementation(async (payload) => ({ ...payload, id: 'server-1' }))

    await saveRoundPlayer({ roundId: ROUND_ID, userId: USER_ID, position: 1, displayName: 'Dave' })

    expect(upsertRoundPlayer.mock.calls[0][0]).not.toHaveProperty('id')
  })

  it('leaves a replayable entry and a local row behind when the network fails', async () => {
    upsertRoundPlayer.mockRejectedValue(NETWORK_ERROR)

    await expect(
      saveRoundPlayer({ roundId: ROUND_ID, userId: USER_ID, position: 1, displayName: 'Dave' }),
    ).rejects.toThrow('Failed to fetch')

    const queued = await database.outbox.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ table: 'round_players', op: 'upsert' })
    expect(queued[0].dependencyKey).toBe(`round-outbox:${ROUND_ID}:create`)
    expect(await database.roundPlayers.count()).toBe(1)
  })

  // Refused before the queue, not by the server: a 23514 arriving at the outbox
  // classifies as permanent and would poison the round because somebody typed a
  // space.
  it.each([
    ['a blank name', { displayName: '   ' }],
    ['a seat below the cap range', { position: 0 }],
    ['a seat above the cap range', { position: 99 }],
  ])('refuses %s without queuing anything', async (_label, overrides) => {
    await expect(
      saveRoundPlayer({ roundId: ROUND_ID, userId: USER_ID, position: 1, displayName: 'Dave', ...overrides }),
    ).rejects.toThrow(/name and an open seat/)

    expect(await database.outbox.count()).toBe(0)
    expect(await database.roundPlayers.count()).toBe(0)
    expect(upsertRoundPlayer).not.toHaveBeenCalled()
  })
})

describe('removeRoundPlayer', () => {
  it('removes locally and remotely, keyed on the seat rather than the row id', async () => {
    await cacheRoundPlayer(serverRow(1))
    deleteRoundPlayer.mockResolvedValue({ round_id: ROUND_ID, position: 1 })

    await removeRoundPlayer({ roundId: ROUND_ID, position: 1 })

    expect(deleteRoundPlayer).toHaveBeenCalledWith({ roundId: ROUND_ID, position: 1 })
    expect(await database.roundPlayers.count()).toBe(0)
    expect(await database.outbox.count()).toBe(0)
  })

  it('keeps the delete queued when the network fails, with the local row already gone', async () => {
    await cacheRoundPlayer(serverRow(1))
    deleteRoundPlayer.mockRejectedValue(NETWORK_ERROR)

    await expect(removeRoundPlayer({ roundId: ROUND_ID, position: 1 })).rejects.toThrow('Failed to fetch')

    expect(await database.roundPlayers.count()).toBe(0)
    const queued = await database.outbox.toArray()
    expect(queued[0]).toMatchObject({ table: 'round_players', op: 'delete', payload: { position: 1 } })
  })
})

describe('replayRoundPlayerEntry', () => {
  it('replays an upsert and caches the authoritative row', async () => {
    const api = { upsertRoundPlayer: vi.fn(async (payload) => ({ ...payload, id: 'server-1' })) }

    await replayRoundPlayerEntry(
      { table: 'round_players', op: 'upsert', payload: serverRow(1, { id: undefined }) },
      { database, api },
    )

    expect((await database.roundPlayers.toArray())[0].id).toBe('server-1')
  })

  it('replays a delete', async () => {
    await cacheRoundPlayer(serverRow(1))
    const api = { deleteRoundPlayer: vi.fn(async () => ({})) }

    await replayRoundPlayerEntry(
      { table: 'round_players', op: 'delete', payload: { roundId: ROUND_ID, position: 1 } },
      { database, api },
    )

    expect(await database.roundPlayers.count()).toBe(0)
  })

  it('rethrows so the caller can classify the failure rather than swallowing it', async () => {
    const api = { upsertRoundPlayer: vi.fn(async () => { throw RLS_DENIAL }) }
    await expect(
      replayRoundPlayerEntry(
        { table: 'round_players', op: 'upsert', payload: serverRow(1) },
        { database, api },
      ),
    ).rejects.toBe(RLS_DENIAL)
  })
})
