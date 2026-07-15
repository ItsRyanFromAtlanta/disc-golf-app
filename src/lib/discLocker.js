import { supabase } from './supabaseClient'
import { bagIdsToUnsetForNewDefault } from './bags'
import { discIdsToUnsetForNewPrimary, situationalRoleCount, SITUATIONAL_ROLE_CAP } from './discs'
import { captureBagVersion } from './repository/bagHistoryRepository'

// `discs.mold` is a legacy text column (kept as a human label after
// migration); the joined disc_molds record must be aliased to something
// else, or the two "mold" keys collide in the returned row.
const DISC_WITH_MOLD = '*, moldInfo:disc_molds(*)'

export async function fetchUserDiscs(userId) {
  const { data, error } = await supabase
    .from('discs')
    .select(DISC_WITH_MOLD)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchDisc(discId) {
  const { data, error } = await supabase.from('discs').select(DISC_WITH_MOLD).eq('id', discId).single()
  if (error) throw error
  return data
}

// Universe tab -> DiscFormPage handoff (Screen 5): resolve the mold picked
// from the catalog accordion into MoldPicker's selectedMold shape.
export async function upsertDisc(userId, discId, fields) {
  const payload = { ...fields, user_id: userId }
  let query
  if (discId) {
    query = supabase.from('discs').update(payload).eq('id', discId)
  } else if (payload.id) {
    // Client-generated id (offline-first create retries — see
    // src/lib/repository/createRepository.js): upsert on the primary key so
    // a duplicate replay (a manual retry, or two concurrent outbox flushes
    // racing the same queued entry) re-applies the same values instead of
    // erroring or inserting a second row for the same logical create.
    query = supabase.from('discs').upsert(payload, { onConflict: 'id' })
  } else {
    query = supabase.from('discs').insert(payload)
  }
  const { data, error } = await query.select(DISC_WITH_MOLD).single()
  if (error) throw error
  return data
}

// Mirrors setDefaultBag's one-default pattern: discs.role enforces a single
// primary_putter per user via a partial unique index, so promoting a new
// primary requires unsetting the old one first (see discIdsToUnsetForNewPrimary).
// situational_weather has no DB constraint -- capped app-side at
// SITUATIONAL_ROLE_CAP, since the swimlane limit is a UI/blueprint rule, not
// a data-integrity one.
export async function updateDiscRole(discs, discId, role) {
  if (role === 'situational_weather' && situationalRoleCount(discs, discId) >= SITUATIONAL_ROLE_CAP) {
    throw new Error(`Only ${SITUATIONAL_ROLE_CAP} situational putters allowed`)
  }
  if (role === 'primary_putter') {
    const idsToUnset = discIdsToUnsetForNewPrimary(discs, discId)
    if (idsToUnset.length > 0) {
      const { error } = await supabase.from('discs').update({ role: 'standard' }).in('id', idsToUnset)
      if (error) throw error
    }
  }
  const { data, error } = await supabase
    .from('discs')
    .update({ role })
    .eq('id', discId)
    .select(DISC_WITH_MOLD)
    .single()
  if (error) throw error
  return data
}

export async function updateDiscWear(discId, wearScore) {
  const { data, error } = await supabase
    .from('discs')
    .update({ wear_score: wearScore })
    .eq('id', discId)
    .select(DISC_WITH_MOLD)
    .single()
  if (error) throw error
  return data
}

export async function fetchBags(userId) {
  const { data, error } = await supabase.from('bags').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data
}

export async function createBag(userId, fields) {
  const { data, error } = await supabase
    .from('bags')
    .insert({ ...fields, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBag(bagId, fields) {
  const { data, error } = await supabase.from('bags').update(fields).eq('id', bagId).select().single()
  if (error) throw error
  return data
}

export async function deleteBag(bagId) {
  const { error } = await supabase.from('bags').delete().eq('id', bagId)
  if (error) throw error
}

// Enforces the one-default-per-user rule client-side: unset any other
// default(s) first (required by the partial unique index), then promote
// the target. See bagIdsToUnsetForNewDefault for the pure selection logic.
export async function setDefaultBag(bags, targetBagId) {
  const idsToUnset = bagIdsToUnsetForNewDefault(bags, targetBagId)
  if (idsToUnset.length > 0) {
    const { error } = await supabase.from('bags').update({ is_default: false }).in('id', idsToUnset)
    if (error) throw error
  }
  const { error } = await supabase.from('bags').update({ is_default: true }).eq('id', targetBagId)
  if (error) throw error
}

export async function fetchBagDiscs(bagId) {
  const { data, error } = await supabase
    .from('bag_discs')
    .select(`id, disc:discs(${DISC_WITH_MOLD})`)
    .eq('bag_id', bagId)
  if (error) throw error
  return data.map((row) => ({ membershipId: row.id, ...row.disc }))
}

// Which of the user's bags currently contain this disc — RLS already scopes
// bag_discs to bags the caller owns, so no extra user_id filter is needed.
export async function fetchDiscBagIds(discId) {
  const { data, error } = await supabase.from('bag_discs').select('bag_id').eq('disc_id', discId)
  if (error) throw error
  return data.map((row) => row.bag_id)
}

export async function addDiscToBag(bagId, discId) {
  const { error } = await supabase.from('bag_discs').insert({ bag_id: bagId, disc_id: discId })
  if (error) throw error
  await captureBagVersion(bagId)
}

export async function removeDiscFromBag(bagId, discId) {
  const { error } = await supabase.from('bag_discs').delete().eq('bag_id', bagId).eq('disc_id', discId)
  if (error) throw error
  await captureBagVersion(bagId)
}
