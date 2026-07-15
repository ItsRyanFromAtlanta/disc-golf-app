import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import { filterCatalogMolds, readCatalog } from './catalogRepository'

const databases = []

function fixture() {
  return {
    catalogManufacturers: [{ id: 'manufacturer-1', name: 'Example Discs', status: 'active' }],
    catalogMolds: [
      { id: 'mold-1', manufacturer_id: 'manufacturer-1', manufacturer: 'Example Discs', mold_name: 'Beacon', category: 'putter', catalog_status: 'approved' },
      { id: 'mold-2', manufacturer_id: 'manufacturer-1', manufacturer: 'Example Discs', mold_name: 'Retired One', category: 'putter', catalog_status: 'retired' },
    ],
    catalogPlastics: [{ id: 'plastic-1', manufacturer_id: 'manufacturer-1', name: 'Durable', catalog_status: 'approved' }],
    catalogMoldPlastics: [{ id: 'mold-plastic-1', manufacturer_id: 'manufacturer-1', mold_id: 'mold-1', plastic_id: 'plastic-1', availability_status: 'current' }],
    catalogRuns: [{ id: 'run-1', mold_plastic_id: 'mold-plastic-1', run_name: 'First Run', catalog_status: 'approved' }],
    catalogStamps: [{ id: 'stamp-1', run_id: 'run-1', stamp_name: 'Launch', catalog_status: 'approved' }],
  }
}

afterEach(async () => {
  for (const database of databases.splice(0)) await database.delete()
})

describe('catalogRepository', () => {
  it('normalizes a remote snapshot and hydrates plastic, run, and stamp relationships', async () => {
    const database = createAppDatabase(`CatalogRepository-${crypto.randomUUID()}`)
    databases.push(database)
    const catalog = await readCatalog({ database, fetchRemote: async () => fixture() })

    expect(catalog.molds[0].plastics).toEqual([
      expect.objectContaining({ id: 'plastic-1', name: 'Durable', availability_status: 'current' }),
    ])
    expect(catalog.molds[0].runs[0]).toEqual(
      expect.objectContaining({ id: 'run-1', stamps: [expect.objectContaining({ id: 'stamp-1' })] }),
    )
    expect(await database.catalogMolds.count()).toBe(2)
  })

  it('falls back to the last complete local snapshot when the remote read fails', async () => {
    const database = createAppDatabase(`CatalogOffline-${crypto.randomUUID()}`)
    databases.push(database)
    await readCatalog({ database, fetchRemote: async () => fixture() })

    const catalog = await readCatalog({
      database,
      fetchRemote: async () => { throw new Error('offline') },
    })

    expect(catalog.molds.map((mold) => mold.mold_name)).toEqual(['Beacon', 'Retired One'])
  })

  it('searches approved molds deterministically by brand, name, and category', () => {
    const catalog = { ...fixture(), molds: fixture().catalogMolds }
    expect(filterCatalogMolds(catalog, { query: 'example beacon' }).map((mold) => mold.id)).toEqual(['mold-1'])
    expect(filterCatalogMolds(catalog, { manufacturer: 'Example Discs', category: 'putter' }).map((mold) => mold.id)).toEqual(['mold-1'])
  })
})
