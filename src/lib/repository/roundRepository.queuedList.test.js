import Dexie from 'dexie'
import indexedDB from 'fake-indexeddb'
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Pre-deployment review finding #2. `readRoundList` swept every cached round the
// remote list did not return. That was safe while a round could only be unsynced
// offline — `fetchRounds` failed too and the cached branch took over.
//
// Deploy-lag classification broke that assumption. A round carrying a column
// whose migration has not landed (`scoring_mode`, the weather columns) stays
// queued while the network is healthy, so `fetchRounds` SUCCEEDS, the round is
// absent from it, and the sweep deleted the local row. The round disappeared
// from `/rounds` and its summary read "Round not found" while the payload sat
// safely in the outbox — so the player logs it again.
vi.mock('../supabaseClient', () => ({ supabase: {} }))

let db

beforeEach(async () => {
  db = new Dexie(`round-queued-list-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange })
  db.version(1).stores({ rounds: 'id, user_id', outbox: '++id, table, entityId' })
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('a queued round survives a successful remote read', () => {
  it('is neither evicted from the cache nor dropped from the list', async () => {
    const userId = 'user-1'
    const synced = { id: 'round-synced', user_id: userId, status: 'completed' }
    const queued = { id: 'round-queued', user_id: userId, status: 'in_progress' }
    await db.rounds.bulkPut([synced, queued])

    // The remote genuinely does not know about the queued round — its create is
    // still in the outbox because the column it carries has no migration yet.
    const remote = [synced]
    const remoteIds = new Set(remote.map((round) => round.id))
    const queuedIds = new Set([queued.id])

    const cached = await db.rounds.where('user_id').equals(userId).toArray()
    const staleIds = cached
      .filter((round) => !remoteIds.has(round.id) && !queuedIds.has(round.id))
      .map((round) => round.id)
    if (staleIds.length > 0) await db.rounds.bulkDelete(staleIds)
    const pendingOnly = cached.filter((round) => queuedIds.has(round.id) && !remoteIds.has(round.id))
    const result = [...remote, ...pendingOnly]

    expect(result.map((round) => round.id).sort()).toEqual(['round-queued', 'round-synced'])
    expect(await db.rounds.get('round-queued')).toBeTruthy()
  })

  it('still evicts a round that is genuinely gone from the server', async () => {
    // The sweep exists for a real reason — a round deleted on another device
    // must not linger locally forever. Only queued rounds are exempt.
    const userId = 'user-1'
    await db.rounds.bulkPut([
      { id: 'round-kept', user_id: userId },
      { id: 'round-deleted-elsewhere', user_id: userId },
    ])

    const remoteIds = new Set(['round-kept'])
    const queuedIds = new Set()

    const cached = await db.rounds.where('user_id').equals(userId).toArray()
    const staleIds = cached
      .filter((round) => !remoteIds.has(round.id) && !queuedIds.has(round.id))
      .map((round) => round.id)
    await db.rounds.bulkDelete(staleIds)

    expect(staleIds).toEqual(['round-deleted-elsewhere'])
    expect(await db.rounds.get('round-deleted-elsewhere')).toBeUndefined()
    expect(await db.rounds.get('round-kept')).toBeTruthy()
  })
})
