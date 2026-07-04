import { supabase } from './supabaseClient'

// Single fetch powering the history feed, header strip, and insights panel.
// Client-side merge of the two entry types is fine at current volume; a
// Postgres UNION view is the upgrade path if it ever gets slow (see CLAUDE.md).
export async function fetchHistory(userId) {
  const [sessionsResult, runsResult] = await Promise.all([
    supabase
      .from('putt_sessions')
      .select(
        'id, session_date, notes, tags, created_at, putt_distance_logs(id, distance_feet, makes, attempts, zone, created_at)',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('putting_regimen_runs')
      .select(
        'id, regimen_id, started_at, completed_at, completed, total_score, notes, tags, putting_regimens(name), putting_regimen_run_sets(id, makes, attempts, longest_streak, clean_set, pressure_putt_made, points_earned, created_at, putting_regimen_sets(set_order, distance_feet_min, distance_feet_max, reps_required, pressure_multiplier))',
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false }),
  ])

  if (sessionsResult.error) throw sessionsResult.error
  if (runsResult.error) throw runsResult.error
  return { sessions: sessionsResult.data, runs: runsResult.data }
}

export function sessionAggregate(session) {
  const logs = session.putt_distance_logs ?? []
  const makes = logs.reduce((sum, l) => sum + l.makes, 0)
  const attempts = logs.reduce((sum, l) => sum + l.attempts, 0)
  const distances = logs.map((l) => l.distance_feet)
  return {
    makes,
    attempts,
    minDistance: distances.length ? Math.min(...distances) : null,
    maxDistance: distances.length ? Math.max(...distances) : null,
  }
}

// Flat {makes, attempts, at} samples from both entry types, for insights.
export function allPuttSamples({ sessions, runs }) {
  return [
    ...sessions.flatMap((s) => s.putt_distance_logs ?? []),
    ...runs.flatMap((r) => r.putting_regimen_run_sets ?? []),
  ].map((row) => ({ makes: row.makes, attempts: row.attempts, at: row.created_at }))
}

// Flat {distanceFeet, makes, attempts} samples for the confidence map.
// Freeform logs have an exact distance; regimen sets only have a range, so
// the range midpoint stands in as their representative distance.
export function distanceSamples({ sessions, runs }) {
  const freeform = sessions.flatMap((s) => s.putt_distance_logs ?? []).map((log) => ({
    distanceFeet: log.distance_feet,
    makes: log.makes,
    attempts: log.attempts,
  }))

  const regimen = runs
    .flatMap((r) => r.putting_regimen_run_sets ?? [])
    .filter((set) => set.putting_regimen_sets)
    .map((set) => ({
      distanceFeet: (set.putting_regimen_sets.distance_feet_min + set.putting_regimen_sets.distance_feet_max) / 2,
      makes: set.makes,
      attempts: set.attempts,
    }))

  return [...freeform, ...regimen]
}
