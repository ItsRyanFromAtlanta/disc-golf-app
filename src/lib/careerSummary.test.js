import { describe, expect, it } from 'vitest'
import { buildCareerSummary } from './careerSummary'

describe('buildCareerSummary', () => {
  it('builds honest career axes and selects the putter with the strongest attributed evidence', () => {
    const summary = buildCareerSummary({
      sessions: [{ wind_mph: 18, putt_distance_logs: [{ distance_feet: 20, makes: 8, attempts: 10 }] }],
      runs: [{ wind_mph: 5, putting_regimen_run_sets: [{ makes: 2, attempts: 5, putting_regimen_sets: { distance_feet_min: 40, distance_feet_max: 50 } }] }],
      discs: [
        { id: 'a', role: 'primary_putter', total_chain_hits: 100 },
        { id: 'b', role: 'backup_putter', total_chain_hits: 300 },
      ],
      puttEvents: [
        { putter_disc_id: 'a', outcome: 'make' }, { putter_disc_id: 'a', outcome: 'make' },
        { putter_disc_id: 'b', outcome: 'make' }, { putter_disc_id: 'b', outcome: 'miss' },
      ],
    })
    expect(summary.lifetime).toMatchObject({ makes: 10, attempts: 15 })
    expect(summary.axes.find((axis) => axis.key === 'wind')).toMatchObject({ sampleSize: 10, score: 80 })
    expect(summary.trustedPutter.id).toBe('b')
  })

  it('uses null for unsupported axes and never crowns a putter without attributed attempts', () => {
    const summary = buildCareerSummary({ discs: [{ id: 'a', role: 'primary_putter', total_chain_hits: 500 }] })
    expect(summary.axes.every((axis) => axis.score == null || axis.key === 'bag')).toBe(true)
    expect(summary.trustedPutter).toBeNull()
  })
})
