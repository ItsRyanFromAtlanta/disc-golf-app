function finiteNumber(value) {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function scoreFor(roundHole) {
  return finiteNumber(roundHole?.score)
}

function parFor(roundHole, holesById) {
  return finiteNumber(roundHole?.hole?.par ?? holesById.get(roundHole?.hole_id)?.par)
}

/** Sum only entered scores; unplayed holes do not contribute. */
export function roundTotal(roundHoles = []) {
  return roundHoles.reduce((total, roundHole) => total + (scoreFor(roundHole) ?? 0), 0)
}

/** Sum the par values for a course/layout's complete hole list. */
export function parTotal(holes = []) {
  return holes.reduce((total, hole) => total + (finiteNumber(hole?.par) ?? 0), 0)
}

/**
 * Calculate score relative to par for the holes that have been played.
 * Sparse scorecards therefore report the current position, not a projected
 * full-round score.
 */
export function relativeToPar(roundHoles = [], holes = []) {
  const holesById = new Map(holes.map((hole) => [hole.id, hole]))
  return roundHoles.reduce((total, roundHole) => {
    const score = scoreFor(roundHole)
    const par = parFor(roundHole, holesById)
    return score == null || par == null ? total : total + score - par
  }, 0)
}

export function formatRelativeToPar(value) {
  const number = finiteNumber(value)
  if (number == null) return '—'
  if (number === 0) return 'E'
  return number > 0 ? `+${number}` : `${number}`
}
