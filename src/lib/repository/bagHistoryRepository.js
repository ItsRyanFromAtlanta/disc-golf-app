import { supabase } from '../supabaseClient'
import { db } from '../db/dexieDb'

const VERSION_SELECT = '*, bag_version_discs(*)'

export async function fetchBagVersions(bagId) {
  const { data, error } = await supabase
    .from('bag_versions')
    .select(VERSION_SELECT)
    .eq('bag_id', bagId)
    .order('version', { ascending: false })
  if (error) throw error
  await db.transaction('rw', db.bagVersions, db.bagVersionDiscs, async () => {
    for (const version of data) {
      await db.bagVersions.put(version)
      const rows = version.bag_version_discs ?? []
      if (rows.length) await db.bagVersionDiscs.bulkPut(rows)
    }
  })
  return data
}

export async function loadBagVersions(bagId) {
  try {
    return await fetchBagVersions(bagId)
  } catch (error) {
    const versions = await db.bagVersions.where('bag_id').equals(bagId).reverse().sortBy('version')
    if (!versions.length) throw error
    return Promise.all(versions.map(async (version) => ({
      ...version,
      bag_version_discs: await db.bagVersionDiscs.where('bag_version_id').equals(version.id).toArray(),
    })))
  }
}

export async function captureBagVersion(bagId, { reason = 'grouped_save', idempotencyKey = crypto.randomUUID() } = {}) {
  const { data, error } = await supabase.rpc('capture_bag_version', {
    p_bag_id: bagId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw error
  await fetchBagVersions(bagId)
  return data
}

export async function restoreBagVersion(version, { idempotencyKey = crypto.randomUUID() } = {}) {
  const { data, error } = await supabase.rpc('restore_bag_version', {
    p_source_version_id: version.id,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw error
  await fetchBagVersions(version.bag_id)
  return data
}
