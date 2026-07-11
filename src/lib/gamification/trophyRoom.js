import { supabase } from '../supabaseClient'
import { BADGE_ICONS } from './badgeCatalog'

// Trophy Room (Screen 12) read layer: an impure fetch plus pure view-model
// helpers. The pure helpers turn raw badge + progress rows into the UI's shape
// (status, sorted pursuits, filter counts) and are unit-tested; the page just
// renders what they return.

export const TROPHY_FILTERS = ['all', 'unlocked', 'in_progress', 'locked']
const PURSUIT_COUNT = 3
const LEDGER_WINDOW_DAYS = 30

// Merge the badge catalog rows (from the DB) with the user's per-badge progress
// into view models the wall renders directly. A badge with no progress row yet
// is locked at 0. status: earned -> 'unlocked'; any progress -> 'in_progress';
// else 'locked'.
export function buildBadgeViewModels(badges, progressRows) {
  const byBadgeId = new Map(progressRows.map((r) => [r.badge_id, r]))
  return badges.map((badge) => {
    const p = byBadgeId.get(badge.id)
    const progress = p ? Number(p.progress) : 0
    const earnedAt = p?.earned_at ?? null
    const status = earnedAt ? 'unlocked' : progress > 0 ? 'in_progress' : 'locked'
    return {
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      tier: badge.tier,
      icon: BADGE_ICONS[badge.code] ?? '🏅',
      criteria: badge.criteria,
      progress,
      earnedAt,
      status,
    }
  })
}

// The Active Pursuits carousel: the in-progress badges closest to unlocking,
// most-complete first. Ties broken by name for a stable order.
export function activePursuits(viewModels, count = PURSUIT_COUNT) {
  return viewModels
    .filter((b) => b.status === 'in_progress')
    .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name))
    .slice(0, count)
}

// Counts for the 4-way filter bar chips.
export function filterCounts(viewModels) {
  return {
    all: viewModels.length,
    unlocked: viewModels.filter((b) => b.status === 'unlocked').length,
    in_progress: viewModels.filter((b) => b.status === 'in_progress').length,
    locked: viewModels.filter((b) => b.status === 'locked').length,
  }
}

export function applyFilter(viewModels, filter) {
  if (filter === 'all') return viewModels
  return viewModels.filter((b) => b.status === filter)
}

// A sensible practice distance to preconfigure the pursuit drill with, derived
// from the badge's own criteria. Null means "no meaningful distance" (e.g. a
// streak or inventory badge) — the drill launches at the freeform default.
// Zone midpoints mirror the C1/C2 bounds used everywhere else (<=33 / <=66).
export function pursuitDistanceFor(criteria) {
  const { metric, threshold, params } = criteria
  if (metric === 'makes_beyond_ft') return params?.min_ft ?? null
  if (metric === 'longest_made_distance') return threshold
  if (metric === 'makes_in_zone') {
    if (params?.zone === 'C1') return 25
    if (params?.zone === 'C2') return 50
    if (params?.zone === 'Beyond C2') return 70
  }
  return null
}

// Impure: everything the Trophy Room page needs in one shot — the profile XP/
// level, all badge definitions, the user's progress, and the recent XP ledger.
export async function fetchTrophyRoomData(userId) {
  const sinceIso = new Date(Date.now() - LEDGER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [profileResult, badgesResult, progressResult, ledgerResult] = await Promise.all([
    supabase.from('profiles').select('xp, level').eq('id', userId).maybeSingle(),
    supabase.from('badges').select('id, code, name, description, tier, criteria'),
    supabase.from('badge_progress').select('badge_id, progress, earned_at').eq('user_id', userId),
    supabase
      .from('xp_events')
      .select('id, amount, source_type, source_ref, created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false }),
  ])
  if (profileResult.error) throw profileResult.error
  if (badgesResult.error) throw badgesResult.error
  if (progressResult.error) throw progressResult.error
  if (ledgerResult.error) throw ledgerResult.error
  return {
    profile: profileResult.data ?? { xp: 0, level: 1 },
    badges: badgesResult.data,
    progressRows: progressResult.data,
    ledger: ledgerResult.data,
  }
}
