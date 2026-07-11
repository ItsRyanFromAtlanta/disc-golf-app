// RPG leveling math. Pure, no I/O.
//
// The per-level cost curve is fixed by CLAUDE.md: the XP required to advance
// FROM level n TO level n+1 is 1000 × 1.15^(n-1). It compounds steeply on
// purpose — Level 50 alone costs ~1.08M XP, so the high levels are a long-tail
// aspiration, not a weekend grind. Everything else here derives from this one
// formula so there is a single source of truth for the economy.

export const XP_LEVEL_BASE = 1000
export const XP_LEVEL_GROWTH = 1.15

// The blueprint frames progression as Level 1–50. We cap here so levelForXp
// never runs away for an absurd (e.g. imported) XP total; XP beyond the cap
// still accrues in the ledger, it just stops minting levels.
export const MAX_LEVEL = 50

// Cost to go from `level` to `level + 1`. Level must be >= 1.
export function calculateXpForLevel(level) {
  return Math.round(XP_LEVEL_BASE * XP_LEVEL_GROWTH ** (level - 1))
}

// Cumulative XP required to REACH `level` from scratch (level 1 = 0 XP).
// Sum of each rung's cost below it.
export function cumulativeXpForLevel(level) {
  let total = 0
  for (let n = 1; n < level; n++) {
    total += calculateXpForLevel(n)
  }
  return total
}

// Which level a given lifetime XP total lands on. Walks the rungs until the
// next one is unaffordable or the cap is hit.
export function levelForXp(totalXp) {
  const xp = Math.max(0, totalXp)
  let level = 1
  let spent = 0
  while (level < MAX_LEVEL) {
    const cost = calculateXpForLevel(level)
    if (spent + cost > xp) break
    spent += cost
    level += 1
  }
  return level
}

// Everything the XP bar needs in one call: current level, XP earned into the
// current level, the span of the current level, remaining to next, and a 0..1
// fraction for the bar fill. At MAX_LEVEL the bar reads full and remaining 0.
export function xpProgressInLevel(totalXp) {
  const xp = Math.max(0, totalXp)
  const level = levelForXp(xp)
  const floor = cumulativeXpForLevel(level)
  if (level >= MAX_LEVEL) {
    return { level, intoLevel: xp - floor, levelSpan: 0, toNext: 0, pct: 1 }
  }
  const levelSpan = calculateXpForLevel(level)
  const intoLevel = xp - floor
  return {
    level,
    intoLevel,
    levelSpan,
    toNext: levelSpan - intoLevel,
    pct: levelSpan === 0 ? 1 : intoLevel / levelSpan,
  }
}
