import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createAppDatabase } from './dexieDb'

const databasesToDelete = []

afterEach(async () => {
  for (const database of databasesToDelete.splice(0)) await database.delete()
})

describe('AppDatabase v9 upgrade', () => {
  it('preserves v1 cache/outbox rows while adding lifecycle, audit, notification, and round stores', async () => {
    const name = `DexieUpgradeTest-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      discs: 'id, user_id, mold_id, status',
      bags: 'id, user_id',
      bagDiscs: 'id, bag_id, disc_id',
      regimens: 'id, user_id, difficulty',
      regimenRuns: 'id, user_id, regimen_id',
      puttSessions: 'id, user_id',
      profile: 'id',
      outbox: '++id, table, op, createdAt',
    })
    await legacy.open()
    await legacy.table('discs').add({ id: 'disc-1', user_id: 'user-1', status: 'in_locker' })
    await legacy.table('outbox').add({ table: 'discs', op: 'update', payload: { id: 'disc-1' }, createdAt: 1 })
    legacy.close()

    const upgraded = createAppDatabase(name)
    databasesToDelete.push(upgraded)
    await upgraded.open()

    expect(upgraded.verno).toBe(9)
    expect(await upgraded.discs.get('disc-1')).toMatchObject({ status: 'in_locker' })
    expect(await upgraded.outbox.toArray()).toEqual([
      expect.objectContaining({ table: 'discs', op: 'update', payload: { id: 'disc-1' } }),
    ])
    expect(upgraded.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'activities',
        'activityStateEvents',
        'auditEvents',
        'notifications',
        'rounds',
        'roundHoles',
        'catalogManufacturers',
        'catalogMolds',
        'catalogPlastics',
        'catalogMoldPlastics',
        'catalogRuns',
        'catalogStamps',
        'discStateEvents',
        'bagVersions',
        'bagVersionDiscs',
        'bagGhostSlots',
        'shotTags',
        'discShotTagAssignments',
        'discPhotos',
        'discPhotoUploads',
      ]),
    )
    expect(upgraded.outbox.schema.indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining(['dependencyKey', 'nextRetryAt', '[table+idempotencyKey]']),
    )
    expect(upgraded.outbox.schema.indexes.map((index) => index.name)).not.toContain('poison')
  })
})
