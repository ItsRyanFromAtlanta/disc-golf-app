import { effectiveFlightNumbers } from './discs'

// Bags enforce "one default per user" via a partial unique index
// (bags_one_default_per_user), so setting a new default requires unsetting
// the old one first — the DB will reject two is_default=true rows for the
// same user otherwise. This is pure: given the user's current bags and the
// id being promoted, it returns which OTHER bags must be flipped off first.
// The caller does that update, then sets the target bag's is_default=true.
export function bagIdsToUnsetForNewDefault(bags, targetBagId) {
  return bags.filter((b) => b.is_default && b.id !== targetBagId).map((b) => b.id)
}

// Bag views (the default bag, the bag switcher) only ever show discs that
// are actually in rotation. Lost/retired/sold discs stay members of their
// bags (memberships are preserved, per spec) but drop out of this view —
// they reappear if the disc's status is set back to in_locker.
export function isVisibleInBagView(disc) {
  return disc.status === 'in_locker'
}

export function bagViewDiscs(discs) {
  return discs.filter(isVisibleInBagView)
}

// Flight chart point: speed on x, turn+fade ("stability") on y, computed
// from EFFECTIVE numbers (override wins over mold stock) via
// effectiveFlightNumbers — so a re-worked/beat-in copy plots where it
// actually flies, not where the stock mold does. Discs missing enough data
// to place a point (no speed, or no turn/fade on either axis) are excluded
// rather than plotted at a misleading default.
export function flightChartPoint(disc, mold) {
  const { speed, turn, fade } = effectiveFlightNumbers(disc, mold)
  if (speed == null || turn == null || fade == null) return null
  return { x: speed, y: turn + fade, disc, mold }
}

export function flightChartPoints(discsWithMolds) {
  return discsWithMolds
    .map(({ disc, mold }) => flightChartPoint(disc, mold))
    .filter((point) => point !== null)
}

// 35-disc capacity interlock (blueprint Screen 5): blue/ok below the last 5
// slots, sunburst-orange/warn for those, deep-rust/full at the hard cap --
// [+ Add to Bag] disables at 'full'. Thresholds scale off `cap` so a bag with
// a lower custom capacity still gets a 5-slot warning band.
export function capacityTier(discCount, cap = 35) {
  const warnAt = Math.max(0, cap - 5)
  if (discCount >= cap) return 'full'
  if (discCount >= warnAt) return 'warn'
  return 'ok'
}
