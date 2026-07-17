import { speedClass, stabilityClass } from './discFilters'
import { discSpectrumPoint } from './flightSpectrum'
import { activeGhostSlots } from './discTaxonomy'

export const RESONANCE_PRESETS = Object.freeze({
  balanced: { id: 'balanced', label: 'Balanced', coverage: 0.5, speedLadder: 0.25, separation: 0.25 },
  coverage: { id: 'coverage', label: 'Coverage-first', coverage: 0.65, speedLadder: 0.25, separation: 0.1 },
  minimal: { id: 'minimal', label: 'Minimal redundancy', coverage: 0.35, speedLadder: 0.2, separation: 0.45 },
})

const SPEED_CLASSES = ['putter', 'midrange', 'fairway', 'distance']
const STABILITY_CLASSES = ['understable', 'stable', 'overstable']

function scorePercent(value) {
  return Math.round(Math.max(0, Math.min(100, value * 100)))
}

function validPoints(discs) {
  return discs.map((disc) => discSpectrumPoint(disc)).filter(Boolean).map((point) => ({
    ...point,
    speedClass: speedClass(point.x),
    stabilityClass: stabilityClass(point.y),
  })).filter((point) => point.speedClass && point.stabilityClass)
}

function overlapPairs(points) {
  let count = 0
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (Math.abs(points[left].x - points[right].x) <= 1 && Math.abs(points[left].y - points[right].y) <= 1) count += 1
    }
  }
  return count
}

export function resonanceComponents(discs = []) {
  const points = validPoints(discs)
  const occupiedCells = new Set(points.map((point) => `${point.speedClass}/${point.stabilityClass}`))
  const occupiedSpeeds = new Set(points.map((point) => point.speedClass))
  const possibleCells = occupiedSpeeds.size * STABILITY_CLASSES.length
  const maxPairs = (points.length * (points.length - 1)) / 2
  const overlaps = overlapPairs(points)
  return {
    coverage: scorePercent(possibleCells ? occupiedCells.size / possibleCells : 0),
    speedLadder: scorePercent(occupiedSpeeds.size / SPEED_CLASSES.length),
    separation: scorePercent(maxPairs ? 1 - overlaps / maxPairs : 1),
    validDiscCount: points.length,
    missingDiscCount: discs.length - points.length,
    occupiedCells: [...occupiedCells].sort(),
    occupiedSpeedClasses: [...occupiedSpeeds].sort((left, right) => SPEED_CLASSES.indexOf(left) - SPEED_CLASSES.indexOf(right)),
    overlapPairs: overlaps,
  }
}

export function buildBagResonance(discs = [], ghostSlots = [], presetId = 'balanced', capacity = 35) {
  const preset = RESONANCE_PRESETS[presetId] ?? RESONANCE_PRESETS.balanced
  const components = resonanceComponents(discs)
  const overall = Math.round(
    components.coverage * preset.coverage
    + components.speedLadder * preset.speedLadder
    + components.separation * preset.separation,
  )
  const activeGaps = activeGhostSlots(ghostSlots)
  return {
    preset,
    components,
    overall,
    discCount: discs.length,
    capacity,
    headroom: Math.max(0, capacity - discs.length),
    activeGapCount: activeGaps.length,
    // Ghost slots describe desired coverage; they never become physical discs.
    ghostGapLabels: activeGaps.map((slot) => `${slot.stability_class} ${slot.speed_class}`),
  }
}
