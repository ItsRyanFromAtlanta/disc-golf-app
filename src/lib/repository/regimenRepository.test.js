import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import { createRegimenRepository } from './regimenRepository'

const databases = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const database of databases.splice(0)) await database.delete()
})

function database() {
  const value = createAppDatabase(`RegimenRepository-${crypto.randomUUID()}`)
  databases.push(value)
  return value
}

describe('regimenRepository', () => {
  it('caches remote regimen metadata and ordered sets for offline use', async () => {
    const local = database()
    const snapshot = {
      regimens: [{ id: 'level-1', user_id: null, difficulty: 1, name: 'Level 1' }],
      sets: [
        { id: 'set-2', regimen_id: 'level-1', set_order: 2 },
        { id: 'set-1', regimen_id: 'level-1', set_order: 1 },
      ],
    }
    const online = createRegimenRepository({
      database: local,
      fetchListRemote: vi.fn().mockResolvedValue(snapshot),
      fetchOneRemote: vi.fn().mockResolvedValue({ regimen: snapshot.regimens[0], sets: snapshot.sets }),
    })
    await online.list('user-1')

    const offline = createRegimenRepository({
      database: local,
      fetchListRemote: vi.fn().mockRejectedValue(new Error('offline')),
      fetchOneRemote: vi.fn().mockRejectedValue(new Error('offline')),
    })
    expect(await offline.list('user-1')).toEqual(snapshot.regimens)
    expect((await offline.getWithSets('level-1', 'user-1')).sets.map((set) => set.id)).toEqual(['set-1', 'set-2'])
  })

  it('does not expose another user’s cached custom routine', async () => {
    const local = database()
    await local.regimens.bulkPut([
      { id: 'system', user_id: null, difficulty: 1 },
      { id: 'mine', user_id: 'user-1', difficulty: 2 },
      { id: 'theirs', user_id: 'user-2', difficulty: 3 },
    ])
    const repository = createRegimenRepository({
      database: local,
      fetchListRemote: vi.fn().mockRejectedValue(new Error('offline')),
    })
    expect((await repository.list('user-1')).map((regimen) => regimen.id)).toEqual(['system', 'mine'])
  })

  it('prunes stale scoped routines and their cached sets after a successful refresh', async () => {
    const local = database()
    await local.regimens.put({ id: 'stale', user_id: 'user-1', difficulty: 2 })
    await local.regimenSets.put({ id: 'stale-set', regimen_id: 'stale', set_order: 1 })
    const repository = createRegimenRepository({
      database: local,
      fetchListRemote: vi.fn().mockResolvedValue({
        regimens: [{ id: 'level-1', user_id: null, difficulty: 1 }],
        sets: [{ id: 'level-set', regimen_id: 'level-1', set_order: 1 }],
      }),
    })
    await repository.list('user-1')
    expect(await local.regimens.get('stale')).toBeUndefined()
    expect(await local.regimenSets.get('stale-set')).toBeUndefined()
  })
})
