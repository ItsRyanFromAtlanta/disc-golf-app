import { effectiveFlightNumbers } from './discs'
import { speedClass, stabilityClass } from './discFilters'

// Representative flight numbers per (speed class, stability class) — used to
// caption a ghost-slot suggestion, not to recommend a specific mold.
const EXAMPLES = {
  putter: {
    understable: { speed: 2, glide: 3, turn: 1, fade: 0 },
    stable: { speed: 3, glide: 3, turn: 0, fade: 1 },
    overstable: { speed: 3, glide: 2, turn: 0, fade: 3 },
  },
  midrange: {
    understable: { speed: 4, glide: 5, turn: -2, fade: 1 },
    stable: { speed: 5, glide: 5, turn: 0, fade: 2 },
    overstable: { speed: 5, glide: 4, turn: 0, fade: 3 },
  },
  fairway: {
    understable: { speed: 7, glide: 5, turn: -3, fade: 1 },
    stable: { speed: 7, glide: 5, turn: -1, fade: 2 },
    overstable: { speed: 8, glide: 4, turn: 0, fade: 4 },
  },
  distance: {
    understable: { speed: 11, glide: 5, turn: -4, fade: 1 },
    stable: { speed: 12, glide: 5, turn: -1, fade: 2 },
    overstable: { speed: 13, glide: 5, turn: 0, fade: 4 },
  },
}

const STABILITY_ORDER = ['understable', 'stable', 'overstable']

// Ghost-slot wishlist (Screen 5 Universe tab): pure gap detection over owned
// discs' effective flight numbers -- for each speed class the player already
// carries, flag stability classes they have zero coverage in. Zero dependency
// on retail data; [FIND] is parked separately per SCREEN_SPECS.md.
export function stabilityGaps(discs, { limit = 3 } = {}) {
  const bySpeedClass = {}
  for (const disc of discs) {
    if (disc.status !== 'in_locker') continue
    const { speed, turn, fade } = effectiveFlightNumbers(disc, disc.moldInfo)
    const sClass = speedClass(speed)
    if (!sClass) continue
    const stab = turn == null || fade == null ? null : stabilityClass(turn + fade)
    if (!stab) continue
    bySpeedClass[sClass] ??= new Set()
    bySpeedClass[sClass].add(stab)
  }

  const gaps = []
  for (const [sClass, present] of Object.entries(bySpeedClass)) {
    for (const stab of STABILITY_ORDER) {
      if (present.has(stab)) continue
      gaps.push({ speedClass: sClass, stabilityClass: stab, exampleFlightNumbers: EXAMPLES[sClass][stab] })
    }
  }
  return gaps.slice(0, limit)
}
