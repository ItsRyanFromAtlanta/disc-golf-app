import { supabase } from './supabaseClient'
import { activityRepository } from './repository/activityRepository'

export const HISTORY_VISIBILITY = Object.freeze({
  VISIBLE: 'visible',
  HIDDEN: 'hidden',
  ALL: 'all',
})

export const RECENTLY_DELETED_DAYS = 30

// Single fetch powering the history feed, header strip, and insights panel.
// Client-side merge of the two entry types is fine at current volume; a
// Postgres UNION view is the upgrade path if it ever gets slow (see CLAUDE.md).
export async function fetchHistory(userId, { visibility = HISTORY_VISIBILITY.VISIBLE, now = new Date() } = {}) {
  const [activitiesResult, sessionsResult, runsResult] = await Promise.all([
    supabase
      .from('activities')
      .select(
        'id, user_id, type, state, version, has_meaningful_fact, needs_review, hidden_at, metadata, created_at, updated_at, create_idempotency_key, last_lifecycle_idempotency_key',
      )
      .eq('user_id', userId)
      .in('state', ['completed', 'incomplete'])
      .order('updated_at', { ascending: false }),
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

  if (activitiesResult.error) throw activitiesResult.error
  if (sessionsResult.error) throw sessionsResult.error
  if (runsResult.error) throw runsResult.error

  let activities = (activitiesResult.data ?? []).map((activity) => ({ ...activity, sync_state: 'synced' }))
  try {
    await activityRepository.hydrateActivities(activitiesResult.data ?? [])
    activities = await activityRepository.listHistoryWithSync(userId, { includeHidden: true })
  } catch {
    // History is already network-backed; an unavailable IndexedDB mirror
    // should degrade to remote rows rather than blanking a valid feed.
  }

  const cutoff = now.getTime() - RECENTLY_DELETED_DAYS * 24 * 60 * 60 * 1000
  const selectedActivities = activities.filter((activity) => {
    if (visibility === HISTORY_VISIBILITY.ALL) return true
    if (visibility === HISTORY_VISIBILITY.HIDDEN) {
      return activity.hidden_at && new Date(activity.hidden_at).getTime() >= cutoff
    }
    return !activity.hidden_at
  })
  const selectedIds = new Set(selectedActivities.map((activity) => activity.id))

  return {
    activities: selectedActivities,
    sessions: (sessionsResult.data ?? []).filter((session) => selectedIds.has(session.id)),
    runs: (runsResult.data ?? []).filter((run) => selectedIds.has(run.id)),
  }
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

// Regimen-run counterpart to sessionAggregate — Session Summary's hero
// scoreboard needs the same {makes, attempts} shape plus streak peak and
// clean-set count, which only regimen runs track (freeform's putt_distance_logs
// has no per-row streak column, so freeform has no equivalent streak stat).
export function regimenRunAggregate(run) {
  const sets = run.putting_regimen_run_sets ?? []
  const makes = sets.reduce((sum, s) => sum + s.makes, 0)
  const attempts = sets.reduce((sum, s) => sum + s.attempts, 0)
  const cleanSets = sets.filter((s) => s.clean_set).length
  const longestStreak = sets.reduce((max, s) => Math.max(max, s.longest_streak ?? 0), 0)
  return { makes, attempts, cleanSets, totalSets: sets.length, longestStreak }
}

export function activityHistoryEntries({ activities = [], sessions = [], runs = [] }) {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const runsById = new Map(runs.map((run) => [run.id, run]))

  return activities
    .filter((activity) => ['putting_freeform', 'putting_regimen'].includes(activity.type))
    .map((activity) => {
      if (activity.type === 'putting_freeform') {
        const session = sessionsById.get(activity.id) ?? null
        return {
          type: 'freeform',
          id: activity.id,
          at: session?.created_at ?? activity.created_at,
          activity,
          session,
          aggregate: sessionAggregate(session ?? {}),
        }
      }

      const run = runsById.get(activity.id) ?? null
      return {
        type: 'regimen',
        id: activity.id,
        at: run?.started_at ?? activity.created_at,
        activity,
        run,
        aggregate: regimenRunAggregate(run ?? {}),
      }
    })
    .sort((a, b) => new Date(b.at) - new Date(a.at))
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
