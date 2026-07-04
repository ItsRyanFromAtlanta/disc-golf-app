import { supabase } from './supabaseClient'

// select('*') is safe here only because this fetch is always scoped to the
// signed-in user's own profile (RLS-enforced). Any future shared/social
// profile view must select an explicit column list that excludes
// injury_notes — it is private and never shown to other users.
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertProfileFields(userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...fields }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

function isUnset(confidence) {
  return confidence == null || confidence === 'none'
}

export function isThrowingProfileEmpty(profile) {
  if (!profile) return true
  return (
    isUnset(profile.bh_confidence) &&
    isUnset(profile.fh_confidence) &&
    !profile.bh_max_distance_ft &&
    !profile.fh_max_distance_ft
  )
}
