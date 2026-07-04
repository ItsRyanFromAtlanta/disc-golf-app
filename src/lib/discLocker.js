import { supabase } from './supabaseClient'
import { bagIdsToUnsetForNewDefault } from './bags'

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

export async function searchMolds(query) {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('disc_molds')
    .select('*')
    .or(`manufacturer.ilike.%${query}%,mold_name.ilike.%${query}%`)
    .order('manufacturer')
    .limit(20)
  if (error) throw error
  return data
}

export async function createMold(fields) {
  const { data, error } = await supabase.from('disc_molds').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function upsertDisc(userId, discId, fields) {
  const payload = { ...fields, user_id: userId }
  const query = discId
    ? supabase.from('discs').update(payload).eq('id', discId)
    : supabase.from('discs').insert(payload)
  const { data, error } = await query.select(DISC_WITH_MOLD).single()
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

export async function addDiscToBag(bagId, discId) {
  const { error } = await supabase.from('bag_discs').insert({ bag_id: bagId, disc_id: discId })
  if (error) throw error
}

export async function removeDiscFromBag(bagId, discId) {
  const { error } = await supabase.from('bag_discs').delete().eq('bag_id', bagId).eq('disc_id', discId)
  if (error) throw error
}
