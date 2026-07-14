import { supabase } from './supabaseClient'

// Screen 10 equipment-milestone markers: every moment a disc's role became
// PRIMARY_PUTTER, drawn as a ★ on the trend chart at that exact timestamp.
// Reads disc_role_history (the append-only, trigger-populated mirror of
// discs.role — see layer5_disc_role_history_schema.sql), joined to the disc for
// a display name. RLS on disc_role_history already scopes rows to the caller's
// own discs, so no explicit user filter is needed here.
//
// NOTE: backfilled rows carry an honest "as of backfill time" changed_at, not a
// true historical transition (documented in the schema file). They still render
// as markers; that's the best available signal for roles set before history
// tracking existed.
export function discDisplayName(disc) {
  if (!disc) return 'Putter'
  return disc.nickname || disc.moldInfo?.mold_name || disc.mold || 'Putter'
}

export async function fetchPrimaryPutterMilestones(userId) {
  const { data, error } = await supabase
    .from('disc_role_history')
    .select('id, changed_at, discs!inner(user_id, nickname, mold, moldInfo:disc_molds(mold_name))')
    .eq('role', 'primary_putter')
    .eq('discs.user_id', userId)
    .order('changed_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    changedAt: row.changed_at,
    at: new Date(row.changed_at).getTime(),
    discName: discDisplayName(row.discs),
  }))
}
