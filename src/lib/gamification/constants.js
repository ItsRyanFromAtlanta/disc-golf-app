// Gamification payout constants — the single source of truth for how XP is
// earned. Kept in one file (not scattered across call sites) so the economy is
// tunable in one place and the ledger's multiplier guide (Screen 12) can render
// straight from these values.
//
// Values adopted from MASTER_PROJECT_BLUEPRINT.md's Screen 12 ledger guide
// (+10 XP/Make, +50 XP/Clean Stage) and Screen 13 import spec (+10 XP per
// parsed career putt). Badge rewards scale by tier.

export const XP_PER_MAKE = 10
export const XP_PER_CLEAN_STAGE = 50
export const XP_PER_IMPORTED_PUTT = 10

// Screen 13 caps retroactive import XP so a huge UDisc backlog can't vault a
// user to the level ceiling in one import (mirrors the blueprint's bulk-reward
// intent while keeping progression meaningful). Applied by the ingestion path.
export const IMPORT_XP_CAP = 10000

// Flat XP granted when a badge unlocks, by tier. Gold is the headline reward
// the blueprint's "LAUNCH PURSUIT DRILL (+500 XP)" callout implies for the
// hardest pursuits; bronze/silver step down from there.
export const BADGE_XP_BY_TIER = Object.freeze({
  bronze: 100,
  silver: 300,
  gold: 1000,
})

// source_type values written to the xp_events ledger. Enumerated here so the
// service and any reader (ledger modal) agree on the vocabulary.
export const XP_SOURCE = Object.freeze({
  REGIMEN_RUN: 'regimen_run',
  FREEFORM_SESSION: 'session',
  BADGE: 'badge',
  IMPORT: 'import',
})

export function badgeXpForTier(tier) {
  return BADGE_XP_BY_TIER[tier] ?? 0
}
