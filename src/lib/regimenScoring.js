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
