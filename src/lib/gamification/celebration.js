import { BADGE_BY_CODE } from './badgeCatalog'

// Pure: turn an awardPostSession result into the celebration banners the
// SessionReport / CelebrationOverlay renders (each an { message } — the overlay
// contract). Level-up first (the headline), then one banner per newly unlocked
// badge with its icon + name. Empty array when nothing to celebrate, which makes
// the overlay render nothing.
export function celebrationEventsFor({ leveledUp, newLevel, newlyEarned = [] }) {
  const events = []
  if (leveledUp) {
    events.push({ message: `⬆️ Level up! You reached Level ${newLevel}` })
  }
  for (const badge of newlyEarned) {
    const def = BADGE_BY_CODE[badge.code]
    const icon = def?.icon ?? '🏅'
    const name = def?.name ?? badge.code
    events.push({ message: `${icon} Badge unlocked: ${name}` })
  }
  return events
}
