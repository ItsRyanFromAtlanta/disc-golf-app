import { supabase } from '../supabaseClient'
import { buildPlayerStats } from './playerStats'
import { evaluateBadges } from './evaluateBadges'
import { levelForXp } from './xp'
import { XP_PER_MAKE, XP_PER_CLEAN_STAGE } from './constants'

// BadgeEvaluatorService — the only impure member of lib/gamification. It fetches
// a user's full practice + inventory picture, hands a pure snapshot to
// evaluateBadges, and persists the diffs (badge_progress, xp_events, profile
// cache) through the append_xp_event/upsert_badge_progress/set_profile_level
// RPCs (layer5_gamification_hardening.sql) — the client has no direct write
// access to these tables/columns, so amount bounds, source_type, and the
// (user_id, source_type, source_ref) uniqueness are enforced by the DB, not
// re-implemented app-side. Designed to be run post-scoring / post-inventory /
// post-ingestion and to be safely RE-runnable: append_xp_event's ON CONFLICT DO
// NOTHING makes a retry after a partial failure (or a stale offline finish
// syncing late) converge rather than double-count.

// Mirrors fetchHistory's nested shape (so history.js's distanceSamples works
// unchanged) but adds the weather columns badges need on both session parents,
// and discs.role (so putter-scoped metrics can filter to putter discs).
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
    supabase.from('discs').select('role, total_chain_hits').eq('user_id', userId),
  ])
  if (sessionsResult.error) throw sessionsResult.error
  if (runsResult.error) throw runsResult.error
  if (discsResult.error) throw discsResult.error
  return { sessions: sessionsResult.data, runs: runsResult.data, discs: discsResult.data }
}

// Append one xp_events row via the append_xp_event RPC (the only insert path —
// see layer5_gamification_hardening.sql). Returns the fresh lifetime xp total;
// the RPC itself resolves idempotency via its unique constraint, so a retried
// call for the same source_ref is a no-op that still returns the current total.
async function appendXpEvent(amount, sourceType, sourceRef) {
  const { data, error } = await supabase.rpc('append_xp_event', {
    p_amount: amount,
    p_source_type: sourceType,
    p_source_ref: sourceRef,
  })
  if (error) throw error
  return data
}

async function currentProfileXp(userId) {
  const { data, error } = await supabase.from('profiles').select('xp').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.xp ?? 0
}

// Run the badge pass against the user's current data and persist everything
// (progress, badge XP, and the profile XP/level cache) through the hardened
// RPCs. Returns { newlyEarned, xpAfter } so the caller can drive the
// celebration overlay and detect level-ups. Self-consistent for standalone
// callers (post-inventory / post-ingestion) as well as awardPostSession below,
// and for the Trophy Room's own on-load reconciliation.
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

  const { progressUpdates, newlyEarned, xpEvents, errors } = evaluateBadges({
    stats,
    badges: badgesResult.data,
    progressByBadgeId,
    now: now.toISOString(),
  })

  // Surfaced, not swallowed: a malformed badge is isolated (evaluateBadges
  // skips just that one row) but still needs to be visible somewhere, since
  // both call sites wrap this whole function in a non-critical .catch(()=>{}).
  for (const e of errors) {
    console.error(`Badge evaluation failed for "${e.code}" (${e.badgeId}):`, e.error)
  }

  await Promise.all(
    progressUpdates.map(async (u) => {
      const { error } = await supabase.rpc('upsert_badge_progress', {
        p_badge_id: u.badge_id,
        p_progress: u.progress,
        p_earned: u.earned_at != null,
      })
      if (error) throw error
    }),
  )

  // Badge XP events must append sequentially (each RPC call reads-then-writes
  // profiles.xp), but there are at most a couple per pass, so this isn't the
  // full-table scan the old recompute-from-ledger approach was.
  let xpAfter = null
  for (const event of xpEvents) {
    xpAfter = await appendXpEvent(event.amount, event.source_type, event.source_ref)
  }
  if (xpAfter == null) {
    xpAfter = await currentProfileXp(userId)
  }

  const { error: levelError } = await supabase.rpc('set_profile_level', { p_level: levelForXp(xpAfter) })
  if (levelError) throw levelError

  return { newlyEarned, xpAfter }
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
  const xpBefore = await currentProfileXp(userId)

  const sessionXp = makes * XP_PER_MAKE + cleanStages * XP_PER_CLEAN_STAGE
  if (sessionXp > 0) {
    await appendXpEvent(sessionXp, sourceType, sourceRef)
  }

  // evaluateAndPersistBadges recomputes and returns the fresh XP total (it owns
  // the profile-cache refresh), so no separate recompute is needed here.
  const { newlyEarned, xpAfter } = await evaluateAndPersistBadges(userId, now)

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
