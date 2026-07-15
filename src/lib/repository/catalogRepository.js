import { useQuery } from '@tanstack/react-query'
import { db } from '../db/dexieDb'
import { supabase } from '../supabaseClient'

export const CATALOG_QUERY_KEY = ['catalog', 'snapshot']

const TABLES = [
  ['manufacturers', 'catalogManufacturers', 'id, name, official_url, status, updated_at'],
  ['disc_molds', 'catalogMolds', 'id, manufacturer_id, manufacturer, mold_name, category, speed, glide, turn, fade, catalog_status, updated_at'],
  ['disc_plastics', 'catalogPlastics', 'id, manufacturer_id, name, description, firmness, durability, catalog_status, updated_at'],
  ['disc_mold_plastics', 'catalogMoldPlastics', 'id, manufacturer_id, mold_id, plastic_id, availability_status, speed_adjustment, glide_adjustment, turn_adjustment, fade_adjustment, updated_at'],
  ['disc_runs', 'catalogRuns', 'id, mold_plastic_id, run_name, production_year, batch_code, tooling, facility, catalog_status, updated_at'],
  ['disc_stamps', 'catalogStamps', 'id, run_id, stamp_name, artwork_reference_url, catalog_status, updated_at'],
]

async function fetchTable(table, columns) {
  const { data, error } = await supabase.from(table).select(columns)
  if (error) throw error
  return data
}

export async function fetchCatalogRemote() {
  const rows = await Promise.all(TABLES.map(([table, , columns]) => fetchTable(table, columns)))
  return Object.fromEntries(TABLES.map(([, cache], index) => [cache, rows[index]]))
}

async function replaceTable(table, rows) {
  await table.clear()
  if (rows.length) await table.bulkPut(rows)
}

export async function cacheCatalogSnapshot(database, snapshot) {
  await database.transaction('rw', TABLES.map(([, cache]) => database[cache]), async () => {
    await Promise.all(TABLES.map(([, cache]) => replaceTable(database[cache], snapshot[cache] ?? [])))
  })
}

export async function readCachedCatalog(database) {
  const entries = await Promise.all(
    TABLES.map(async ([, cache]) => [cache, await database[cache].toArray()]),
  )
  return Object.fromEntries(entries)
}

export function hydrateCatalog(snapshot) {
  const plasticsById = new Map(snapshot.catalogPlastics.map((row) => [row.id, row]))
  const plasticLinksByMold = new Map()
  for (const link of snapshot.catalogMoldPlastics) {
    const plastic = plasticsById.get(link.plastic_id)
    if (!plastic) continue
    const list = plasticLinksByMold.get(link.mold_id) ?? []
    list.push({ ...plastic, availability_status: link.availability_status })
    plasticLinksByMold.set(link.mold_id, list)
  }
  const runsByMold = new Map()
  const moldIdByMoldPlastic = new Map(snapshot.catalogMoldPlastics.map((link) => [link.id, link.mold_id]))
  for (const run of snapshot.catalogRuns) {
    const moldId = moldIdByMoldPlastic.get(run.mold_plastic_id)
    if (!moldId) continue
    const list = runsByMold.get(moldId) ?? []
    list.push({ ...run, stamps: snapshot.catalogStamps.filter((stamp) => stamp.run_id === run.id) })
    runsByMold.set(moldId, list)
  }
  return {
    ...snapshot,
    molds: snapshot.catalogMolds.map((mold) => ({
      ...mold,
      plastics: plasticLinksByMold.get(mold.id) ?? [],
      runs: runsByMold.get(mold.id) ?? [],
    })),
  }
}

export async function readCatalog({ database = db, fetchRemote = fetchCatalogRemote } = {}) {
  try {
    const remote = await fetchRemote()
    await cacheCatalogSnapshot(database, remote)
    return hydrateCatalog(remote)
  } catch (error) {
    const cached = await readCachedCatalog(database)
    if (cached.catalogMolds.length || cached.catalogManufacturers.length) return hydrateCatalog(cached)
    throw error
  }
}

export function filterCatalogMolds(catalog, { query = '', manufacturer, category } = {}) {
  const needles = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return catalog.molds
    .filter((mold) => !mold.catalog_status || mold.catalog_status === 'approved')
    .filter((mold) => !manufacturer || mold.manufacturer === manufacturer)
    .filter((mold) => !category || mold.category === category)
    .filter((mold) => {
      const haystack = `${mold.manufacturer} ${mold.mold_name}`.toLocaleLowerCase()
      return needles.every((needle) => haystack.includes(needle))
    })
    .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.mold_name.localeCompare(b.mold_name))
    .slice(0, 20)
}

export function useCatalog() {
  return useQuery({ queryKey: CATALOG_QUERY_KEY, queryFn: () => readCatalog(), networkMode: 'offlineFirst' })
}
