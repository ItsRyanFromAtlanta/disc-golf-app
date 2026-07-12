import { metricValue } from './metrics'
import { badgeXpForTier } from './constants'

// Pure badge evaluation. Given a stats snapshot, the badge definitions, and the
// user's current per-badge progress, compute what should change. Does NO I/O —
// the service persists the returned diffs. This separation is the whole point:
// every unlock rule is testable with plain objects.
//
// Inputs:
//   stats               PlayerStats snapshot (see metrics.js)
//   badges              [{ id, code, tier, criteria }]   (from the badges table)
//   progressByBadgeId   Map<badgeId, { progress, earned_at }>  current state
//   now                 ISO string for earned_at timestamps
//
// Returns:
//   progressUpdates  [{ badge_id, progress, earned_at }]  rows to upsert into
//                    badge_progress. earned_at is set only on the unlock tick and
//                    otherwise carried forward (never cleared — badges don't
//                    un-earn even if, say, a disc is later deleted).
//   newlyEarned      [{ id, code, tier }]  badges that unlocked THIS pass — drives
//                    the celebration overlay and the XP award below.
//   xpEvents         [{ amount, source_type: 'badge', source_ref: badgeId }]  the
//                    ledger rows for each new unlock (idempotency is enforced by
//                    the service, which won't re-insert an existing source_ref).
//   errors           [{ badgeId, code, error }]  badges whose criteria couldn't
//                    be evaluated (e.g. an unrecognized metric — a DB/catalog
//                    drift). Isolated per-badge so one malformed row can't halt
//                    evaluation for every other badge; the caller logs these.
export function evaluateBadges({ stats, badges, progressByBadgeId, now }) {
  const progressUpdates = []
  const newlyEarned = []
  const xpEvents = []
  const errors = []

  for (const badge of badges) {
    const current = progressByBadgeId.get(badge.id) ?? { progress: 0, earned_at: null }

    // Already earned: carry the row forward untouched. Progress stays at its
    // unlock value (clamped 1) and earned_at is preserved — re-evaluation is a
    // no-op for earned badges, so the pass is safe to run as often as we like.
    if (current.earned_at) continue

    let value
    try {
      value = metricValue(stats, badge.criteria)
    } catch (error) {
      // Isolated: a single bad criteria.metric (typo, renamed metric) must not
      // abort the loop for every other badge — see the collision this caused
      // before this fix (all evaluation silently stopped, forever, on one
      // malformed row, since callers wrap this in a swallowed .catch).
      errors.push({ badgeId: badge.id, code: badge.code, error })
      continue
    }

    const threshold = badge.criteria.threshold
    const progress = threshold > 0 ? Math.min(value / threshold, 1) : 0
    const earned = value >= threshold

    // Skip writing a row when nothing moved (progress unchanged and not earned)
    // — keeps badge_progress from filling with churn-free upserts.
    const unchanged = !earned && progress === current.progress
    if (unchanged) continue

    progressUpdates.push({
      badge_id: badge.id,
      progress,
      earned_at: earned ? now : null,
    })

    if (earned) {
      newlyEarned.push({ id: badge.id, code: badge.code, tier: badge.tier })
      const amount = badgeXpForTier(badge.tier)
      if (amount > 0) {
        xpEvents.push({ amount, source_type: 'badge', source_ref: badge.id })
      }
    }
  }

  return { progressUpdates, newlyEarned, xpEvents, errors }
}
