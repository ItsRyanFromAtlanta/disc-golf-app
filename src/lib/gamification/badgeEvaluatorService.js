import { supabase } from '../supabaseClient'
import { buildPlayerStats } from './playerStats'
import { evaluateBadges } from './evaluateBadges'
import { levelForXp } from './xp'
import { XP_PER_MAKE, XP_PER_CLEAN_STAGE } from './constants'

// BadgeEvaluatorService — the only impure member of lib/gamification. It fetches
// a user's full practice + inventory picture, hands a pure snapshot to
// evaluateBadges, and persists the diffs (badge_progress, xp_events, profile
// cache). Designed to be run post-scoring / post-inventory / post-ingestion and
// to be safely RE-runnable: every write is idempotent, so a retry after a
// partial failure (or a stale offline finish syncing late) converges rather than
// double-counts.

// Mirrors fetchHistory's nested shape (so history.js's distanceSamples works
// unchanged) but adds the weather columns badges need on both session parents.
export async function fetchGamificationData(userId) {
  const [sessionsResult, runsResult, discsResult] = await Promise.all([
    supabase
      .from('putt_sessions')
      .select(
        'id, created_at, weather_condition, wind_mph, putt_distance_logs(distance_feet, makes, attempts)',
      )
      .eq('user_id', userId),
    supabase
      .from('putting_regimen_runs')
      .select(
        'id, regimen_id, started_at, completed, total_score, weather_condition, wind_mph, putting_regimen_run_sets(makes, attempts, longest_streak, clean_set, pressure_putt_made, putting_regimen_sets(distance_feet_min, distance_feet_max))',
      )
      .eq('user_id', userId),
    supabase.from('discs').select('total_chain_hits').eq('user_id', userId),
  ])
  if (sessionsResult.error) throw sessionsResult.error
  if (runsResult.error) throw runsResult.error
  if (discsResult.error) throw discsResult.error
  return { sessions: sessionsResult.data, runs: runsResult.data, discs: discsResult.data }
}

// Append xp_events rows that don't already exist for their (source_type,
// source_ref) — the idempotency guard that makes the whole service retry-safe.
// Rows without a source_ref (shouldn't happen here) are always inserted.
async function appendXpEventsIdempotent(userId, events) {
  if (events.length === 0) return
  const refs = events.map((e) => e.source_ref).filter(Boolean)
  const existing = new Set()
  if (refs.length > 0) {
    const { data, error } = await supabase
      .from('xp_events')
      .select('source_type, source_ref')
      .eq('user_id', userId)
      .in('source_ref', refs)
    if (error) throw error
    for (const row of data) existing.add(`${row.source_type}:${row.source_ref}`)
  }
  const toInsert = events
    .filter((e) => !existing.has(`${e.source_type}:${e.source_ref}`))
    .map((e) => ({ user_id: userId, amount: e.amount, source_type: e.source_type, source_ref: e.source_ref }))
  if (toInsert.length === 0) return
  const { error } = await supabase.from('xp_events').insert(toInsert)
  if (error) throw error
}

// Recompute profiles.xp/level from the ledger (source of truth) rather than
// incrementing a possibly-stale cache. Returns the fresh total.
async function recomputeProfileXp(userId) {
  const { data, error } = await supabase.from('xp_events').select('amount').eq('user_id', userId)
  if (error) throw error
  const total = data.reduce((sum, e) => sum + e.amount, 0)
  const level = levelForXp(total)
  const { error: updateError } = await supabase.from('profiles').update({ xp: total, level }).eq('id', userId)
  if (updateError) throw updateError
  return total
}

// Run the badge pass against the user's current data and persist everything.
// Returns { newlyEarned } so the caller can drive the celebration overlay.
// Safe to call standalone (post-inventory / post-ingestion) or from
// awardPostSession below.
export async function evaluateAndPersistBadges(userId, now = new Date()) {
  const [data, badgesResult, progressResult] = await Promise.all([
    fetchGamificationData(userId),
    supabase.from('badges').select('id, code, tier, criteria'),
    supabase.from('badge_progress').select('badge_id, progress, earned_at').eq('user_id', userId),
  ])
  if (badgesResult.error) throw badgesResult.error
  if (progressResult.error) throw progressResult.error

  const stats = buildPlayerStats(data, now)
  const progressByBadgeId = new Map(
    progressResult.data.map((r) => [r.badge_id, { progress: Number(r.progress), earned_at: r.earned_at }]),
  )

  const { progressUpdates, newlyEarned, xpEvents } = evaluateBadges({
    stats,
    badges: badgesResult.data,
    progressByBadgeId,
    now: now.toISOString(),
  })

  if (progressUpdates.length > 0) {
    const rows = progressUpdates.map((u) => ({
      user_id: userId,
      badge_id: u.badge_id,
      progress: u.progress,
      earned_at: u.earned_at,
      updated_at: now.toISOString(),
    }))
    const { error } = await supabase.from('badge_progress').upsert(rows, { onConflict: 'user_id,badge_id' })
    if (error) throw error
  }

  await appendXpEventsIdempotent(userId, xpEvents)
  return { newlyEarned }
}

// The single call the save paths make when a session ends. Awards the session's
// scoring XP (idempotent by source_ref = the session/run id), runs the badge
// pass, refreshes the profile cache, and reports whether this action leveled the
// user up or unlocked badges — the celebration payload.
//
//   sourceType : XP_SOURCE.REGIMEN_RUN | XP_SOURCE.FREEFORM_SESSION
//   sourceRef  : the run/session id (dedupe key)
//   makes      : total makes this session   (-> XP_PER_MAKE each)
//   cleanStages: clean stages this session   (-> XP_PER_CLEAN_STAGE each)
export async function awardPostSession({ userId, sourceType, sourceRef, makes, cleanStages, now = new Date() }) {
  const beforeResult = await supabase.from('xp_events').select('amount').eq('user_id', userId)
  if (beforeResult.error) throw beforeResult.error
  const xpBefore = beforeResult.data.reduce((sum, e) => sum + e.amount, 0)

  const sessionXp = makes * XP_PER_MAKE + cleanStages * XP_PER_CLEAN_STAGE
  if (sessionXp > 0) {
    await appendXpEventsIdempotent(userId, [
      { amount: sessionXp, source_type: sourceType, source_ref: sourceRef },
    ])
  }

  const { newlyEarned } = await evaluateAndPersistBadges(userId, now)
  const xpAfter = await recomputeProfileXp(userId)

  const previousLevel = levelForXp(xpBefore)
  const newLevel = levelForXp(xpAfter)
  return {
    newlyEarned,
    previousLevel,
    newLevel,
    leveledUp: newLevel > previousLevel,
    xpAfter,
  }
}
