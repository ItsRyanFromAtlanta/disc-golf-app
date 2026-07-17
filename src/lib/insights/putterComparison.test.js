import { describe, expect, it } from 'vitest'
import { putterComparison } from './putterComparison'

const events = (putterId, distance, outcomes) => outcomes.map((outcome) => ({
  putter_disc_id: putterId, distance_ft: distance, outcome,
}))

describe('putterComparison', () => {
  it('compares exact physical discs and adjusts only across shared distance bands', () => {
    const report = putterComparison([
      ...events('p1', 22, [...Array(8).fill('make'), ...Array(2).fill('miss')]),
      ...events('p2', 25, [...Array(4).fill('make'), ...Array(6).fill('miss')]),
      ...events('p1', 35, [...Array(9).fill('make'), 'miss']),
    ], [{ id: 'p1', nickname: 'Blue' }, { id: 'p2', nickname: 'Red' }])

    expect(report).toMatchObject({ totalRealTimeAttempts: 30, attributedAttempts: 30, attributionCoverage: 1, comparisonReady: true })
    expect(report.rows[0]).toMatchObject({
      putterDiscId: 'p1', makes: 17, attempts: 20, sharedBandAttempts: 10, distanceAdjustedDelta: 0.2,
      disc: { nickname: 'Blue' },
    })
    expect(report.rows[0].bands.map((band) => [band.label, band.shared])).toEqual([
      ['20-30ft', true], ['30-40ft', false],
    ])
    expect(report.rows[1]).toMatchObject({ putterDiscId: 'p2', makes: 4, attempts: 10, distanceAdjustedDelta: -0.2 })
  })

  it('reports attribution coverage and withholds adjustment below ten shared attempts', () => {
    const report = putterComparison([
      ...events('p1', 20, ['make', 'miss', 'make', 'miss']),
      ...events('p2', 20, ['make', 'miss', 'miss', 'miss']),
      { putter_disc_id: null, distance_ft: 20, outcome: 'make' },
    ])
    expect(report).toMatchObject({ totalRealTimeAttempts: 9, attributedAttempts: 8, attributionCoverage: 8 / 9 })
    expect(report.rows.every((row) => row.distanceAdjustedDelta == null)).toBe(true)
  })

  it('does not claim a comparison with fewer than two attributed physical discs', () => {
    const report = putterComparison(events('p1', 20, ['make', 'miss']))
    expect(report.comparisonReady).toBe(false)
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0].interval).not.toBeNull()
  })
})
