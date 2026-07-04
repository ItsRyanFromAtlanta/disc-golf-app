import { describe, it, expect } from 'vitest'
import { fatigueCurve } from './fatigue'
import { pressureDifferential } from './pressure'
import { decayWeightedForm } from './form'
import { cadenceFingerprint } from './cadence'
import { wilsonInterval } from './wilson'
import { confidenceMap, distanceBand, classifyZone } from './confidenceMap'
import { regimenPBRunIds, distancePBSessionIds } from './pbs'
import { practiceStreak, volumeLedger } from './activity'
import { normalizeTag } from './tags'

describe('fatigueCurve', () => {
  it('aggregates make % by set order across runs, sorted', () => {
    const curve = fatigueCurve([
      { setOrder: 2, makes: 4, attempts: 10 },
      { setOrder: 1, makes: 9, attempts: 10 },
      { setOrder: 1, makes: 7, attempts: 10 },
      { setOrder: 2, makes: 6, attempts: 10 },
    ])
    expect(curve).toEqual([
      { setOrder: 1, makes: 16, attempts: 20, makePct: 0.8 },
      { setOrder: 2, makes: 10, attempts: 20, makePct: 0.5 },
    ])
  })

  it('skips zero-attempt and orderless sets', () => {
    expect(fatigueCurve([{ setOrder: 1, makes: 0, attempts: 0 }, { makes: 5, attempts: 10 }])).toEqual([])
  })
})

describe('pressureDifferential', () => {
  it('compares pressure putts against the remaining putts of the same sets', () => {
    const result = pressureDifferential([
      // 10 attempts, 9 makes incl. pressure putt → regular 8/9
      { makes: 9, attempts: 10, pressurePuttMade: true },
      // 10 attempts, 5 makes, pressure missed → regular 5/9
      { makes: 5, attempts: 10, pressurePuttMade: false },
    ])
    expect(result.pressurePct).toBeCloseTo(0.5)
    expect(result.regularPct).toBeCloseTo(13 / 18)
    expect(result.differential).toBeCloseTo(0.5 - 13 / 18)
    expect(result.pressureN).toBe(2)
    expect(result.regularN).toBe(18)
  })

  it('returns nulls with no data', () => {
    expect(pressureDifferential([]).differential).toBeNull()
  })
})

describe('decayWeightedForm', () => {
  const now = new Date('2026-07-03T12:00:00')

  it('halves a sample weight at exactly one half-life', () => {
    const { currentFormPct, lifetimePct } = decayWeightedForm(
      [
        { makes: 10, attempts: 10, at: '2026-07-03T12:00:00' },
        { makes: 0, attempts: 10, at: '2026-06-19T12:00:00' }, // exactly 14 days old
      ],
      now,
    )
    // weighted: (10*1 + 0*0.5) / (10*1 + 10*0.5) = 10/15
    expect(currentFormPct).toBeCloseTo(10 / 15)
    expect(lifetimePct).toBeCloseTo(0.5)
  })

  it('returns nulls with no samples', () => {
    expect(decayWeightedForm([], now).currentFormPct).toBeNull()
  })
})

describe('cadenceFingerprint', () => {
  it('buckets by local time of day', () => {
    const { byTimeOfDay } = cadenceFingerprint([
      { makes: 8, attempts: 10, at: '2026-07-01T09:00:00' },
      { makes: 5, attempts: 10, at: '2026-07-01T13:00:00' },
      { makes: 6, attempts: 10, at: '2026-07-01T19:00:00' },
      { makes: 2, attempts: 10, at: '2026-07-01T11:59:00' },
    ])
    expect(byTimeOfDay.morning).toEqual({ makes: 10, attempts: 20, makePct: 0.5 })
    expect(byTimeOfDay.afternoon.makePct).toBeCloseTo(0.5)
    expect(byTimeOfDay.evening.makePct).toBeCloseTo(0.6)
  })

  it('buckets by days since previous practice day, excluding the first day', () => {
    const { byGap } = cadenceFingerprint([
      { makes: 5, attempts: 10, at: '2026-06-01T10:00:00' }, // first day: no gap
      { makes: 8, attempts: 10, at: '2026-06-02T10:00:00' }, // gap 1
      { makes: 4, attempts: 10, at: '2026-06-05T10:00:00' }, // gap 3
      { makes: 9, attempts: 10, at: '2026-06-20T10:00:00' }, // gap 15
    ])
    expect(byGap['0-1']).toEqual({ makes: 8, attempts: 10, makePct: 0.8 })
    expect(byGap['2-3'].makePct).toBeCloseTo(0.4)
    expect(byGap['8+'].makePct).toBeCloseTo(0.9)
    expect(byGap['4-7']).toBeUndefined()
  })
})

describe('wilsonInterval', () => {
  it('matches the known interval for 5/10 at 95%', () => {
    const { lower, upper } = wilsonInterval(5, 10)
    expect(lower).toBeCloseTo(0.2366, 3)
    expect(upper).toBeCloseTo(0.7634, 3)
  })

  it('stays inside [0,1] at the extremes', () => {
    expect(wilsonInterval(10, 10).upper).toBeLessThanOrEqual(1)
    expect(wilsonInterval(0, 10).lower).toBeGreaterThanOrEqual(0)
  })

  it('returns null with no attempts', () => {
    expect(wilsonInterval(0, 0)).toBeNull()
  })
})

describe('regimenPBRunIds', () => {
  it('marks first completed run and strict improvements, per regimen', () => {
    const pbs = regimenPBRunIds([
      { id: 'a', regimenId: 'r1', totalScore: 30, completed: true, at: '2026-06-01' },
      { id: 'b', regimenId: 'r1', totalScore: 30, completed: true, at: '2026-06-02' }, // tie: not a PB
      { id: 'c', regimenId: 'r1', totalScore: 45, completed: true, at: '2026-06-03' },
      { id: 'd', regimenId: 'r2', totalScore: 5, completed: true, at: '2026-06-04' }, // first on r2
      { id: 'e', regimenId: 'r1', totalScore: 99, completed: false, at: '2026-06-05' }, // abandoned
    ])
    expect(pbs).toEqual(new Set(['a', 'c', 'd']))
  })
})

describe('distancePBSessionIds', () => {
  it('requires >= 10 attempts at the distance and a strict improvement', () => {
    const pbs = distancePBSessionIds([
      { id: 's1', at: '2026-06-01', logs: [{ distanceFeet: 20, makes: 7, attempts: 10 }] },
      { id: 's2', at: '2026-06-02', logs: [{ distanceFeet: 20, makes: 5, attempts: 5 }] }, // n too small
      { id: 's3', at: '2026-06-03', logs: [{ distanceFeet: 20, makes: 9, attempts: 10 }] },
      { id: 's4', at: '2026-06-04', logs: [{ distanceFeet: 20, makes: 8, attempts: 10 }] }, // worse
    ])
    expect(pbs).toEqual(new Set(['s1', 's3']))
  })

  it('aggregates multiple logs at the same distance within a session', () => {
    const pbs = distancePBSessionIds([
      {
        id: 's1',
        at: '2026-06-01',
        logs: [
          { distanceFeet: 25, makes: 3, attempts: 6 },
          { distanceFeet: 25, makes: 3, attempts: 6 }, // combined n = 12, qualifies
        ],
      },
    ])
    expect(pbs).toEqual(new Set(['s1']))
  })
})

describe('practiceStreak', () => {
  const now = new Date('2026-07-03T15:00:00')

  it('counts consecutive days back from today', () => {
    expect(practiceStreak(['2026-07-03T08:00:00', '2026-07-02T08:00:00', '2026-06-30T08:00:00'], now)).toBe(2)
  })

  it('survives when today has no entry yet', () => {
    expect(practiceStreak(['2026-07-02T08:00:00', '2026-07-01T08:00:00'], now)).toBe(2)
  })

  it('is zero after a missed full day', () => {
    expect(practiceStreak(['2026-07-01T08:00:00'], now)).toBe(0)
    expect(practiceStreak([], now)).toBe(0)
  })
})

describe('volumeLedger', () => {
  // 2026-07-03 is a Friday; the week starts Monday 2026-06-29.
  const now = new Date('2026-07-03T15:00:00')

  it('splits attempts into week / month / lifetime', () => {
    const { week, month, lifetime } = volumeLedger(
      [
        { attempts: 10, at: '2026-07-02T10:00:00' }, // this week + month
        { attempts: 20, at: '2026-06-30T10:00:00' }, // this week, prior month
        { attempts: 40, at: '2026-06-10T10:00:00' }, // prior week + month
      ],
      now,
    )
    expect(week).toBe(30)
    expect(month).toBe(10)
    expect(lifetime).toBe(70)
  })
})

describe('distanceBand', () => {
  it('buckets into fixed-width bands starting at a multiple of the width', () => {
    expect(distanceBand(23, 10)).toEqual({ start: 20, end: 30, label: '20-30ft' })
    expect(distanceBand(20, 10)).toEqual({ start: 20, end: 30, label: '20-30ft' })
    expect(distanceBand(9, 10)).toEqual({ start: 0, end: 10, label: '0-10ft' })
  })
})

describe('classifyZone', () => {
  it('is lock-in when the pessimistic bound clears the threshold', () => {
    expect(classifyZone(0.75, 0.95)).toBe('lock-in')
  })

  it('is coin-flip when the interval straddles 50%', () => {
    expect(classifyZone(0.4, 0.6)).toBe('coin-flip')
  })

  it('is developing when trending above 50% but not yet settled', () => {
    expect(classifyZone(0.55, 0.85)).toBe('developing')
  })
})

describe('confidenceMap', () => {
  it('classifies bands using known Wilson-interval cases', () => {
    const map = confidenceMap([
      { distanceFeet: 12, makes: 5, attempts: 10 }, // 50%, wide interval -> coin-flip
      { distanceFeet: 22, makes: 15, attempts: 20 }, // 75%, lower bound ~0.53 -> developing
      { distanceFeet: 32, makes: 27, attempts: 30 }, // 90%, lower bound ~0.74 -> lock-in
    ])
    expect(map.map((b) => [b.label, b.zone])).toEqual([
      ['10-20ft', 'coin-flip'],
      ['20-30ft', 'developing'],
      ['30-40ft', 'lock-in'],
    ])
  })

  it('aggregates multiple samples within the same band before classifying', () => {
    const map = confidenceMap([
      { distanceFeet: 21, makes: 8, attempts: 10 },
      { distanceFeet: 25, makes: 7, attempts: 10 },
    ])
    expect(map).toHaveLength(1)
    expect(map[0]).toMatchObject({ start: 20, makes: 15, attempts: 20 })
  })

  it('skips zero-attempt and distance-less samples, and sorts by distance', () => {
    const map = confidenceMap([
      { distanceFeet: 35, makes: 5, attempts: 5 },
      { distanceFeet: 15, makes: 5, attempts: 5 },
      { distanceFeet: 25, makes: 0, attempts: 0 },
      { makes: 1, attempts: 1 },
    ])
    expect(map.map((b) => b.start)).toEqual([10, 30])
  })
})

describe('normalizeTag', () => {
  it('normalizes to lowercase-kebab', () => {
    expect(normalizeTag('  New Putter ')).toBe('new-putter')
    expect(normalizeTag('PRE_TOURNAMENT!')).toBe('pre-tournament')
    expect(normalizeTag('windy')).toBe('windy')
  })
})
