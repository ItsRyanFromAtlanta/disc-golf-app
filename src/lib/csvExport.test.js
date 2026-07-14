import { describe, it, expect } from 'vitest'
import { toCsv, buildFreeformCsv, buildRegimenCsv } from './csvExport'

describe('toCsv', () => {
  it('escapes cells containing commas, quotes, and newlines', () => {
    const csv = toCsv(['a', 'b'], [['plain', 'has,comma'], ['has"quote', 'line\nbreak']])
    expect(csv).toBe('a,b\nplain,"has,comma"\n"has""quote","line\nbreak"')
  })

  it('renders null/undefined cells as empty', () => {
    expect(toCsv(['x'], [[null], [undefined]])).toBe('x\n\n')
  })
})

describe('buildFreeformCsv', () => {
  it('emits one row per distance log with parent session context and make %', () => {
    const csv = buildFreeformCsv({
      sessions: [
        {
          session_date: '2026-07-10',
          notes: 'windy',
          tags: ['outdoor', 'windy'],
          putt_distance_logs: [
            { distance_feet: 20, zone: 'C1', makes: 8, attempts: 10 },
            { distance_feet: 40, zone: 'C2', makes: 2, attempts: 5 },
          ],
        },
      ],
    })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('session_date,distance_feet,zone,makes,attempts,make_pct,tags,notes')
    expect(lines[1]).toBe('2026-07-10,20,C1,8,10,0.8000,outdoor|windy,windy')
    expect(lines[2]).toBe('2026-07-10,40,C2,2,5,0.4000,outdoor|windy,windy')
  })

  it('handles empty input as a header-only file', () => {
    expect(buildFreeformCsv({ sessions: [] }).split('\n')).toHaveLength(1)
    expect(buildFreeformCsv().split('\n')).toHaveLength(1)
  })
})

describe('buildRegimenCsv', () => {
  it('emits one row per run set with regimen name and set definition', () => {
    const csv = buildRegimenCsv({
      runs: [
        {
          started_at: '2026-07-08T12:00:00Z',
          completed_at: '2026-07-08T12:20:00Z',
          completed: true,
          total_score: 1930,
          tags: [],
          notes: '',
          putting_regimens: { name: 'Foundation' },
          putting_regimen_run_sets: [
            {
              makes: 9,
              attempts: 10,
              longest_streak: 7,
              clean_set: false,
              pressure_putt_made: true,
              points_earned: 120,
              putting_regimen_sets: { set_order: 1, distance_feet_min: 10, distance_feet_max: 15 },
            },
          ],
        },
      ],
    })
    const lines = csv.split('\n')
    expect(lines[1]).toBe(
      '2026-07-08T12:00:00Z,2026-07-08T12:20:00Z,Foundation,true,1930,1,10,15,9,10,0.9000,7,false,true,120,,',
    )
  })
})
