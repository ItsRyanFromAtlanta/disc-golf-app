import { supabase } from '../supabaseClient'

export async function fetchCareerData(userId) {
  const [profile, sessions, runs, discs, events] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('putt_sessions').select('id, created_at, wind_mph, putt_distance_logs(distance_feet, makes, attempts)').eq('user_id', userId),
    supabase.from('putting_regimen_runs').select('id, started_at, wind_mph, putting_regimen_run_sets(makes, attempts, putting_regimen_sets(distance_feet_min, distance_feet_max))').eq('user_id', userId),
    supabase.from('discs').select('id, nickname, manufacturer, mold, plastic, weight_grams, role, status, total_chain_hits, moldInfo:disc_molds(mold_name, manufacturer)').eq('user_id', userId),
    supabase.from('putt_events').select('outcome, putter_disc_id').eq('user_id', userId).not('putter_disc_id', 'is', null),
  ])
  for (const result of [profile, sessions, runs, discs, events]) if (result.error) throw result.error
  return { profile: profile.data ?? {}, sessions: sessions.data ?? [], runs: runs.data ?? [], discs: discs.data ?? [], puttEvents: events.data ?? [] }
}
