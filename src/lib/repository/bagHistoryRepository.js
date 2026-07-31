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

// `capture_bag_version` rejects a reason outside its accepted vocabulary with
// a plain `raise exception 'Invalid snapshot reason'` (SQLSTATE P0001 — no
// distinguishing code, unlike the missing-function/-column/-table cases
// `DEPLOY_LAG_CODES` in `src/lib/instantLaunch/errorClassification.js`
// classifies, because this check predates that convention). Matched on
// message text for that reason.
//
// Exists for the deploy-lag window around widening that vocabulary: see
// `supabase/migrations/20260731020000_phase_e_bag_version_round_start_reason.sql`
// (E2 audit finding F3) and `captureRoundStartBagVersion` in
// `roundRepository.js`, its one caller. Once that migration is applied on a
// deployment, `'round_start'` is accepted and this stops matching.
export function isUnrecognizedBagVersionReasonError(error) {
  return error?.message === 'Invalid snapshot reason'
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

export async function groupedSaveBag(bagId, draft, { idempotencyKey = crypto.randomUUID() } = {}) {
  const { data, error } = await supabase.rpc('grouped_save_bag', {
    p_bag_id: bagId,
    p_name: draft.name,
    p_description: draft.description || null,
    p_bag_type: draft.bagType || null,
    p_capacity: draft.capacity,
    p_make_default: draft.makeDefault,
    p_disc_ids: draft.discIds,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw error
  await fetchBagVersions(bagId)
  return data
}

export async function deleteBagWithReplacement(bagId, replacementDefaultId = null) {
  const { error } = await supabase.rpc('delete_bag_with_replacement', {
    p_bag_id: bagId,
    p_replacement_default_id: replacementDefaultId,
  })
  if (error) throw error
}
