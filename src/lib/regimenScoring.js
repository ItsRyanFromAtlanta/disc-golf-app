export function isCleanSet(makes, attempts) {
  return attempts > 0 && makes === attempts
}

// The run-through UI only captures aggregate stats per set (makes, attempts,
// longest streak, whether the pressure putt landed) rather than the full
// make/miss sequence, so the streak formula is applied to a single
// best-streak run of that length; makes outside that streak score at the
// base rate. The pressure putt (last attempt) is always pulled out of the
// streak calculation and scored via pressure_multiplier instead, per CLAUDE.md.
export function computeSetScore(regimen, regimenSet, { makes, attempts, longestStreak, pressurePuttMade }) {
  const base = regimen.base_points_per_make
  const streakStep = regimen.streak_step
  const noMissBonusPct = regimen.no_miss_bonus_pct
  const pressureMultiplier = regimenSet.pressure_multiplier ?? 1

  const nonPressureMakes = makes - (pressurePuttMade ? 1 : 0)
  const streak = Math.max(0, Math.min(longestStreak, nonPressureMakes))

  let streakScore = 0
  for (let position = 1; position <= streak; position++) {
    streakScore += base * (1 + streakStep * (position - 1))
  }

  const flatMakes = nonPressureMakes - streak
  const flatScore = flatMakes * base

  const pressureScore = pressurePuttMade ? base * pressureMultiplier : 0

  const clean = isCleanSet(makes, attempts)
  const cleanBonus = clean ? noMissBonusPct * (attempts * base) : 0

  const points = Math.round((streakScore + flatScore + pressureScore + cleanBonus) * 100) / 100

  return { points, cleanSet: clean }
}

export function computeCompletionBonus(regimen, allSetsCompleted) {
  return allSetsCompleted ? regimen.completion_bonus : 0
}

// The scoring canvas only knows per-putt outcomes for gesture-captured
// attempts — a stage finished (fully or partially) via the batch ribbon has
// no per-attempt breakdown, so whether the specific final attempt (the
// pressure putt) landed isn't always knowable. Unambiguous in the same two
// cases the old manual-entry form auto-locked: a clean set (pressure putt
// necessarily made) or a total whiff (necessarily missed). Any other mix
// conservatively assumes missed — a documented simplification, not a bug;
// revisit with an explicit confirmation prompt in the batch ribbon if this
// ever matters in practice.
export function inferPressurePuttMade(makes, attempts) {
  if (attempts <= 0) return false
  if (makes === attempts) return true
  if (makes === 0) return false
  return false
}
