import { effectiveFlightNumbers } from './discs'
import { wearAdjustedFlightNumbers } from './flightCurve'
import { activeGhostSlots } from './discTaxonomy'

export const FLIGHT_SPECTRUM_MODES = Object.freeze({ CURRENT: 'current', OFFICIAL: 'official' })
export const SPECTRUM_CLUSTER_THRESHOLD = Object.freeze({ speed: 0.75, stability: 0.75 })

const AXES = ['speed', 'glide', 'turn', 'fade']

function finite(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function spectrumFlightNumbers(disc, mode = FLIGHT_SPECTRUM_MODES.CURRENT) {
  if (mode === FLIGHT_SPECTRUM_MODES.OFFICIAL) {
    return Object.fromEntries(AXES.map((axis) => [axis, finite(disc.moldInfo?.[axis])]))
  }
  const effective = effectiveFlightNumbers(disc, disc.moldInfo)
  const adjusted = wearAdjustedFlightNumbers(effective, disc.wear_score)
  return Object.fromEntries(AXES.map((axis) => [axis, finite(adjusted[axis])]))
}

export function discSpectrumPoint(disc, mode = FLIGHT_SPECTRUM_MODES.CURRENT) {
  const numbers = spectrumFlightNumbers(disc, mode)
  if (numbers.speed === null || numbers.turn === null || numbers.fade === null) return null
  const overriddenAxes = AXES.filter((axis) => disc[`override_${axis}`] != null)
  return {
    id: disc.id,
    type: 'disc',
    x: numbers.speed,
    y: numbers.turn + numbers.fade,
    numbers,
    disc,
    label: disc.nickname || disc.moldInfo?.mold_name || disc.mold || 'Unnamed disc',
    overriddenAxes,
    wearAdjusted: mode === FLIGHT_SPECTRUM_MODES.CURRENT && finite(disc.wear_score) > 1,
  }
}

export function ghostSpectrumPoint(slot) {
  const speed = finite(slot.target_speed)
  const turn = finite(slot.target_turn)
  const fade = finite(slot.target_fade)
  if (speed === null || turn === null || fade === null) return null
  return {
    id: slot.id,
    type: 'ghost',
    x: speed,
    y: turn + fade,
    label: `${slot.stability_class} ${slot.speed_class} desired slot`,
    slot,
  }
}

export function clusterSpectrumPoints(points, threshold = SPECTRUM_CLUSTER_THRESHOLD) {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y || String(left.id).localeCompare(String(right.id)))
  const clusters = []
  for (const point of sorted) {
    const cluster = clusters.find((candidate) => (
      Math.abs(candidate.x - point.x) <= threshold.speed
      && Math.abs(candidate.y - point.y) <= threshold.stability
    ))
    if (!cluster) {
      clusters.push({ id: `cluster-${point.id}`, x: point.x, y: point.y, members: [point] })
      continue
    }
    cluster.members.push(point)
    cluster.x = cluster.members.reduce((sum, member) => sum + member.x, 0) / cluster.members.length
    cluster.y = cluster.members.reduce((sum, member) => sum + member.y, 0) / cluster.members.length
  }
  return clusters
}

export function buildFlightSpectrum(discs = [], ghostSlots = [], mode = FLIGHT_SPECTRUM_MODES.CURRENT) {
  const discPoints = discs.map((disc) => discSpectrumPoint(disc, mode)).filter(Boolean)
  const ghostPoints = activeGhostSlots(ghostSlots).map(ghostSpectrumPoint).filter(Boolean)
  return {
    mode,
    clusters: clusterSpectrumPoints(discPoints),
    ghostPoints,
    missingDiscCount: discs.length - discPoints.length,
    capacityCount: discs.length,
  }
}
