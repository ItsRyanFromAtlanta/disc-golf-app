import { effectiveFlightNumbers } from './discs'

export const FLIGHT_AXES = Object.freeze(['speed', 'glide', 'turn', 'fade'])
export const COMPARE_MIN = 2
export const COMPARE_MAX = 4
export const NEAR_IDENTICAL_AXIS_DELTA = 1

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizedFlightNumbers(disc) {
  const effective = effectiveFlightNumbers(disc, disc.moldInfo)
  return Object.fromEntries(FLIGHT_AXES.map((axis) => [axis, finiteNumber(effective[axis])]))
}

function comparisonRows(discs) {
  return discs.map((disc) => ({
    disc,
    discId: disc.id,
    numbers: normalizedFlightNumbers(disc),
  }))
}

function axisExtremes(rows, axis) {
  const populated = rows.filter((row) => row.numbers[axis] !== null)
  if (populated.length === 0) {
    return { min: null, max: null, minIds: [], maxIds: [] }
  }

  const values = populated.map((row) => row.numbers[axis])
  const min = Math.min(...values)
  const max = Math.max(...values)

  return {
    min,
    max,
    minIds: populated.filter((row) => row.numbers[axis] === min).map((row) => row.discId),
    maxIds: populated.filter((row) => row.numbers[axis] === max).map((row) => row.discId),
  }
}

function nearIdenticalPair(left, right, threshold) {
  const deltas = {}
  for (const axis of FLIGHT_AXES) {
    const leftValue = left.numbers[axis]
    const rightValue = right.numbers[axis]
    if (leftValue === null || rightValue === null) return null
    deltas[axis] = Math.abs(leftValue - rightValue)
    if (deltas[axis] > threshold) return null
  }

  return {
    discIds: [left.discId, right.discId],
    deltas,
    maxDelta: Math.max(...Object.values(deltas)),
  }
}

export function findNearIdenticalDiscPairs(discs, threshold = NEAR_IDENTICAL_AXIS_DELTA) {
  const rows = comparisonRows(discs)
  const pairs = []

  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const pair = nearIdenticalPair(rows[leftIndex], rows[rightIndex], threshold)
      if (pair) pairs.push(pair)
    }
  }

  return pairs
}

export function buildDiscComparison(discs) {
  const rows = comparisonRows(discs)
  const extremes = Object.fromEntries(FLIGHT_AXES.map((axis) => [axis, axisExtremes(rows, axis)]))

  return {
    rows,
    extremes,
    nearIdenticalPairs: findNearIdenticalDiscPairs(discs),
  }
}
