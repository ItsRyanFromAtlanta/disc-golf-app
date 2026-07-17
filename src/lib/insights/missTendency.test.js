import { describe, expect, it } from 'vitest'
import { missTendency } from './missTendency'

describe('missTendency', () => {
  it('groups real-time misses by distance and zone while reporting capture coverage', () => {
    const report = missTendency([
      { outcome: 'miss', distance_ft: 22, miss_zone: 7 },
      { outcome: 'miss', distance_ft: 25, miss_zone: 7 },
      { outcome: 'miss', distance_ft: 29, miss_zone: 7 },
      { outcome: 'miss', distance_ft: 25, miss_zone: 8 },
      { outcome: 'miss', distance_ft: 25, miss_zone: null },
      { outcome: 'make', distance_ft: 25, miss_zone: null },
      { outcome: 'miss', distance_ft: 35, miss_zone: 1 },
    ])

    expect(report).toMatchObject({ totalMisses: 6, zonedMisses: 5, captureCoverage: 5 / 6 })
    expect(report.bands.map((band) => band.label)).toEqual(['20-30ft', '30-40ft'])
    expect(report.bands[0]).toMatchObject({ totalMisses: 5, zonedMisses: 4, captureCoverage: 0.8 })
    expect(report.bands[0].zones.find((zone) => zone.id === 7)).toMatchObject({ count: 3, share: 0.75 })
    expect(report.bands[0].dominantZones.map((zone) => zone.label)).toEqual(['low-left'])
  })

  it('does not claim a pattern from fewer than three same-vector misses', () => {
    const report = missTendency([
      { outcome: 'miss', distance_ft: 20, miss_zone: 1 },
      { outcome: 'miss', distance_ft: 20, miss_zone: 1 },
      { outcome: 'miss', distance_ft: 20, miss_zone: 2 },
    ])
    expect(report.bands[0].dominantZones).toEqual([])
  })

  it('returns an honest empty report when no real-time misses exist', () => {
    expect(missTendency([{ outcome: 'make', distance_ft: 20, miss_zone: null }])).toEqual({
      totalMisses: 0, zonedMisses: 0, captureCoverage: null, bands: [],
    })
  })
})
