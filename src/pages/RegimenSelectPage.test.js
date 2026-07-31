import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppDatabase } from '../lib/db/dexieDb'
import { createRegimenRepository } from '../lib/repository/regimenRepository'
import { selectableRegimens } from '../lib/regimens'

// D-20 regression: RegimenSelectPage renders selectableRegimens(regimens)
// instead of the raw regimenRepository.list() result, so an archived routine
// disappears from the select screen. The fetch/cache layer must NOT filter
// it out itself — regimenRepository.cacheList bulk-deletes any cached
// routine absent from the remote snapshot, so filtering there would silently
// purge archived routines from the offline mirror that the builder's clone
// and edit paths read. This test guards both halves of that trade-off.
describe('RegimenSelectPage / D-20 archived routine handling', () => {
  const databases = []

  afterEach(async () => {
    vi.restoreAllMocks()
    for (const database of databases.splice(0)) await database.delete()
  })

  function database() {
    const value = createAppDatabase(`RegimenSelectPage-${crypto.randomUUID()}`)
    databases.push(value)
    return value
  }

  it('drops an archived routine from the select list while the Dexie cache still holds it', async () => {
    const local = database()
    const snapshot = {
      regimens: [
        { id: 'level-1', user_id: null, difficulty: 1, name: 'Level 1' },
        { id: 'custom-archived', user_id: 'user-1', difficulty: 2, name: 'Retired routine', archived: true },
      ],
      sets: [],
    }
    const repository = createRegimenRepository({
      database: local,
      fetchListRemote: vi.fn().mockResolvedValue(snapshot),
      fetchOneRemote: vi.fn().mockRejectedValue(new Error('unused')),
    })

    const fetched = await repository.list('user-1')

    // The fetch/cache layer (what the page calls) returns the archived
    // routine untouched.
    expect(fetched.map((regimen) => regimen.id).sort()).toEqual(['custom-archived', 'level-1'])

    // What the page actually renders excludes it.
    expect(selectableRegimens(fetched).map((regimen) => regimen.id)).toEqual(['level-1'])

    // And the Dexie cache still holds it afterwards — the trap this defect
    // warns against is filtering at the query and letting cacheList's
    // bulk-delete-on-refresh purge it from the offline mirror.
    await expect(local.regimens.get('custom-archived')).resolves.toMatchObject({ id: 'custom-archived', archived: true })
  })
})
