import { supabase } from './supabaseClient'

// Custom-routine data layer (Screen 7). Thin wrappers over Supabase in the same
// style as discLocker.js. A custom routine is a putting_regimens row (user_id set)
// plus putting_regimen_sets rows; both are RLS-scoped to the owner.

// Insert the parent regimen, then its set rows. Postgres has no client-side
// transaction here, so if the sets insert fails we archive the just-created
// parent (RLS has no DELETE policy — soft-archive is the available cleanup) to
// avoid leaving an empty, unrunnable orphan routine in the user's CUSTOM tab.
export async function createCustomRegimen(userId, { regimen, sets }) {
  const { data: created, error: regimenError } = await supabase
    .from('putting_regimens')
    .insert({ ...regimen, user_id: userId })
    .select()
    .single()
  if (regimenError) throw regimenError

  const setsPayload = sets.map((s) => ({ ...s, regimen_id: created.id }))
  const { error: setsError } = await supabase.from('putting_regimen_sets').insert(setsPayload)
  if (setsError) {
    await supabase.from('putting_regimens').update({ archived: true }).eq('id', created.id)
    // The DB-side 100-putt trigger raises a check_violation; the app-side
    // canAddStage guard should prevent ever reaching it, so surface a clear
    // message rather than the raw Postgres text if it somehow slips through.
    if (setsError.code === '23514' || /100-putt ceiling/i.test(setsError.message)) {
      throw new Error('This routine exceeds the 100-putt ceiling.')
    }
    throw setsError
  }

  return created.id
}

// The Screen 4 CUSTOM tab currently filters a shared all-regimens query
// client-side; this fetch is the dedicated equivalent (own, non-archived) for
// callers that only want custom routines.
export async function fetchCustomRegimens(userId) {
  const { data, error } = await supabase
    .from('putting_regimens')
    .select('*')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Clone & Tweak source: a regimen plus its ordered sets, to prefill the builder.
export async function fetchRegimenWithSets(regimenId) {
  const [{ data: regimen, error: regimenError }, { data: sets, error: setsError }] = await Promise.all([
    supabase.from('putting_regimens').select('*').eq('id', regimenId).single(),
    supabase
      .from('putting_regimen_sets')
      .select('*')
      .eq('regimen_id', regimenId)
      .order('set_order', { ascending: true }),
  ])
  if (regimenError) throw regimenError
  if (setsError) throw setsError
  return { regimen, sets }
}
