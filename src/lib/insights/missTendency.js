import { MISS_ZONES } from '../gestureEngine/missZones'
import { distanceBand, DISTANCE_BAND_WIDTH_FT } from './confidenceMap'
import { wilsonInterval } from './wilson'

export const MISS_TENDENCY_MIN_PATTERN_MISSES = 3

function validZone(value) {
  return Number.isInteger(value) && value >= 1 && value <= 9
}

export function missTendency(puttEvents = [], width = DISTANCE_BAND_WIDTH_FT) {
  const misses = puttEvents.filter(
    (event) => event.outcome === 'miss' && Number.isFinite(event.distance_ft) && event.distance_ft > 0,
  )
  const bands = new Map()

  for (const event of misses) {
    const { start, end, label } = distanceBand(event.distance_ft, width)
    const band = bands.get(start) ?? { start, end, label, totalMisses: 0, zonedMisses: 0, counts: new Map() }
    band.totalMisses += 1
    if (validZone(event.miss_zone)) {
      band.zonedMisses += 1
      band.counts.set(event.miss_zone, (band.counts.get(event.miss_zone) ?? 0) + 1)
    }
    bands.set(start, band)
  }

  const rows = [...bands.values()].sort((left, right) => left.start - right.start).map((band) => {
    const zones = MISS_ZONES.map((zone) => {
      const count = band.counts.get(zone.id) ?? 0
      return {
        ...zone,
        count,
        share: band.zonedMisses ? count / band.zonedMisses : 0,
        interval: band.zonedMisses ? wilsonInterval(count, band.zonedMisses) : null,
      }
    })
    const highestCount = Math.max(0, ...zones.map((zone) => zone.count))
    const dominantZones = highestCount >= MISS_TENDENCY_MIN_PATTERN_MISSES
      ? zones.filter((zone) => zone.count === highestCount)
      : []
    return {
      start: band.start,
      end: band.end,
      label: band.label,
      totalMisses: band.totalMisses,
      zonedMisses: band.zonedMisses,
      captureCoverage: band.totalMisses ? band.zonedMisses / band.totalMisses : null,
      zones,
      dominantZones,
    }
  })

  const zonedMisses = rows.reduce((sum, band) => sum + band.zonedMisses, 0)
  return {
    totalMisses: misses.length,
    zonedMisses,
    captureCoverage: misses.length ? zonedMisses / misses.length : null,
    bands: rows,
  }
}
