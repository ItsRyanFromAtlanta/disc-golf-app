import { describe, it, expect } from 'vitest'
import {
  calculateXpForLevel,
  cumulativeXpForLevel,
  levelForXp,
  xpProgressInLevel,
  MAX_LEVEL,
} from './xp'
import { metricValue, METRICS } from './metrics'
import { evaluateBadges } from './evaluateBadges'
import { badgeXpForTier } from './constants'
import { BADGE_CATALOG, BADGE_ICONS } from './badgeCatalog'
import { buildPlayerStats } from './playerStats'
import { celebrationEventsFor } from './celebration'
import {
  buildBadgeViewModels,
  activePursuits,
  filterCounts,
  applyFilter,
  pursuitDistanceFor,
} from './trophyRoom'

describe('xp leveling math', () => {
  it('calculateXpForLevel follows 1000 * 1.15^(n-1)', () => {
    expect(calculateXpForLevel(1)).toBe(1000)
    expect(calculateXpForLevel(2)).toBe(1150)
    // 1.15 is slightly under 1.15 in IEEE-754, so 1000*1.15^2 ≈ 1322.4999 -> 1322.
    expect(calculateXpForLevel(3)).toBe(1322)
  })

  it('cumulativeXpForLevel sums the rungs below a level', () => {
    expect(cumulativeXpForLevel(1)).toBe(0)
    expect(cumulativeXpForLevel(2)).toBe(calculateXpForLevel(1))
    expect(cumulativeXpForLevel(3)).toBe(calculateXpForLevel(1) + calculateXpForLevel(2))
  })

  it('levelForXp is the inverse of the cumulative curve', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(999)).toBe(1)
    expect(levelForXp(1000)).toBe(2)
    expect(levelForXp(2149)).toBe(2) // 1000 + 1150 = 2150 needed for L3
    expect(levelForXp(2150)).toBe(3)
  })

  it('negative XP clamps to level 1', () => {
    expect(levelForXp(-500)).toBe(1)
  })

  it('caps at MAX_LEVEL no matter how much XP', () => {
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL)
  })

  it('xpProgressInLevel reports a 0..1 bar fill within a level', () => {
    const p = xpProgressInLevel(1000 + 575) // halfway through level 2 (span 1150)
    expect(p.level).toBe(2)
    expect(p.intoLevel).toBe(575)
    expect(p.levelSpan).toBe(1150)
    expect(p.toNext).toBe(575)
    expect(p.pct).toBeCloseTo(0.5, 5)
  })

  it('xpProgressInLevel reads full at the cap', () => {
    const p = xpProgressInLevel(Number.MAX_SAFE_INTEGER)
    expect(p.level).toBe(MAX_LEVEL)
    expect(p.pct).toBe(1)
    expect(p.toNext).toBe(0)
  })
})

// A minimal stats snapshot; individual tests override the fields they exercise.
function makeStats(overrides = {}) {
  return {
    totalMakes: 0,
    totalAttempts: 0,
    totalSessions: 0,
    practiceDayStreak: 0,
    distanceSamples: [],
    weatherBuckets: [],
    longestPuttStreak: 0,
    cleanStages: 0,
    noMissRegimenRuns: 0,
    pressurePuttsMade: 0,
    regimenRunsCompleted: 0,
    regimenPbsSet: 0,
    discsOwned: 0,
    putterChainHitsMax: 0,
    ...overrides,
  }
}

describe('metrics', () => {
  it('makes_in_zone buckets by the DB zone bounds (<=33 C1, <=66 C2)', () => {
    const stats = makeStats({
      distanceSamples: [
        { distanceFeet: 20, makes: 5, attempts: 6 }, // C1
        { distanceFeet: 33, makes: 3, attempts: 4 }, // C1 (edge)
        { distanceFeet: 50, makes: 2, attempts: 8 }, // C2
        { distanceFeet: 70, makes: 1, attempts: 9 }, // Beyond
      ],
    })
    expect(metricValue(stats, { metric: 'makes_in_zone', params: { zone: 'C1' } })).toBe(8)
    expect(metricValue(stats, { metric: 'makes_in_zone', params: { zone: 'C2' } })).toBe(2)
    expect(metricValue(stats, { metric: 'makes_in_zone', params: { zone: 'Beyond C2' } })).toBe(1)
  })

  it('longest_made_distance ignores distances with zero makes', () => {
    const stats = makeStats({
      distanceSamples: [
        { distanceFeet: 70, makes: 0, attempts: 5 }, // attempted but never made
        { distanceFeet: 45, makes: 2, attempts: 5 },
      ],
    })
    expect(METRICS.longest_made_distance(stats)).toBe(45)
  })

  it('makes_beyond_ft is inclusive of the boundary', () => {
    const stats = makeStats({
      distanceSamples: [
        { distanceFeet: 40, makes: 3, attempts: 5 },
        { distanceFeet: 39, makes: 4, attempts: 5 },
      ],
    })
    expect(metricValue(stats, { metric: 'makes_beyond_ft', params: { min_ft: 40 } })).toBe(3)
  })

  it('high_wind_makes counts only buckets at/above the wind floor, ignoring null wind', () => {
    const stats = makeStats({
      weatherBuckets: [
        { windMph: 20, condition: 'headwind', makes: 10 },
        { windMph: 15, condition: 'crosswind', makes: 5 },
        { windMph: 8, condition: 'headwind', makes: 100 },
        { windMph: null, condition: 'clear', makes: 100 },
      ],
    })
    expect(metricValue(stats, { metric: 'high_wind_makes', params: { min_wind_mph: 15 } })).toBe(15)
  })

  it('wind_makes with floor 0 is any recorded wind above zero (exclusive)', () => {
    const stats = makeStats({
      weatherBuckets: [
        { windMph: 1, condition: 'headwind', makes: 4 },
        { windMph: 0, condition: 'clear', makes: 50 }, // dead calm doesn't count
        { windMph: null, condition: null, makes: 50 },
      ],
    })
    expect(metricValue(stats, { metric: 'wind_makes', params: { min_wind_mph: 0 } })).toBe(4)
  })

  it('rain_sessions counts rain-tagged parents', () => {
    const stats = makeStats({
      weatherBuckets: [
        { windMph: 3, condition: 'rain', makes: 2 },
        { windMph: null, condition: 'rain', makes: 0 },
        { windMph: 5, condition: 'clear', makes: 9 },
      ],
    })
    expect(METRICS.rain_sessions(stats)).toBe(2)
  })

  it('metricValue throws on an unknown metric (catches catalog typos)', () => {
    expect(() => metricValue(makeStats(), { metric: 'nope' })).toThrow(/Unknown badge metric/)
  })
})

describe('evaluateBadges', () => {
  const badges = [
    { id: 'b1', code: 'first_makes', tier: 'bronze', criteria: { metric: 'total_makes', threshold: 10 } },
    { id: 'b2', code: 'makes_500', tier: 'silver', criteria: { metric: 'total_makes', threshold: 500 } },
  ]

  it('unlocks a badge when the threshold is crossed and emits its XP event', () => {
    const { progressUpdates, newlyEarned, xpEvents } = evaluateBadges({
      stats: makeStats({ totalMakes: 12 }),
      badges,
      progressByBadgeId: new Map(),
      now: '2026-07-11T00:00:00Z',
    })
    const b1 = progressUpdates.find((u) => u.badge_id === 'b1')
    expect(b1).toMatchObject({ progress: 1, earned_at: '2026-07-11T00:00:00Z' })
    expect(newlyEarned).toEqual([{ id: 'b1', code: 'first_makes', tier: 'bronze' }])
    expect(xpEvents).toEqual([{ amount: badgeXpForTier('bronze'), source_type: 'badge', source_ref: 'b1' }])
    // b2 (500) is partway, not earned: progress recorded, no XP, not in newlyEarned.
    const b2 = progressUpdates.find((u) => u.badge_id === 'b2')
    expect(b2).toMatchObject({ progress: 12 / 500, earned_at: null })
  })

  it('is idempotent: an already-earned badge is left untouched (no re-award)', () => {
    const { progressUpdates, newlyEarned, xpEvents } = evaluateBadges({
      stats: makeStats({ totalMakes: 9999 }),
      badges,
      progressByBadgeId: new Map([['b1', { progress: 1, earned_at: '2026-07-01T00:00:00Z' }]]),
      now: '2026-07-11T00:00:00Z',
    })
    // b1 already earned -> not re-emitted; only b2 newly unlocks.
    expect(newlyEarned).toEqual([{ id: 'b2', code: 'makes_500', tier: 'silver' }])
    expect(xpEvents).toEqual([{ amount: badgeXpForTier('silver'), source_type: 'badge', source_ref: 'b2' }])
    expect(progressUpdates.find((u) => u.badge_id === 'b1')).toBeUndefined()
  })

  it('skips churn-free rows (progress unchanged, not earned)', () => {
    const { progressUpdates } = evaluateBadges({
      stats: makeStats({ totalMakes: 5 }),
      badges: [badges[0]],
      progressByBadgeId: new Map([['b1', { progress: 0.5, earned_at: null }]]),
      now: '2026-07-11T00:00:00Z',
    })
    expect(progressUpdates).toEqual([])
  })
})

describe('buildPlayerStats', () => {
  // A run started "now" and a session logged today, so the streak is 1.
  const now = new Date('2026-07-11T18:00:00Z')

  it('aggregates makes/attempts and weather across freeform + regimen parents', () => {
    const data = {
      sessions: [
        {
          id: 's1',
          created_at: '2026-07-11T10:00:00Z',
          weather_condition: 'rain',
          wind_mph: 18,
          putt_distance_logs: [
            { distance_feet: 20, makes: 6, attempts: 10 },
            { distance_feet: 50, makes: 2, attempts: 10 },
          ],
        },
      ],
      runs: [
        {
          id: 'r1',
          regimen_id: 'reg1',
          started_at: '2026-07-11T09:00:00Z',
          completed: true,
          total_score: 40,
          weather_condition: 'clear',
          wind_mph: 0,
          putting_regimen_run_sets: [
            {
              makes: 5,
              attempts: 5,
              longest_streak: 5,
              clean_set: true,
              pressure_putt_made: true,
              putting_regimen_sets: { distance_feet_min: 15, distance_feet_max: 15 },
            },
          ],
        },
      ],
      discs: [
        { role: 'primary_putter', total_chain_hits: 1200 },
        { role: 'standard', total_chain_hits: 300 },
      ],
    }
    const stats = buildPlayerStats(data, now)
    expect(stats.totalMakes).toBe(13) // 6+2+5
    expect(stats.totalAttempts).toBe(25) // 10+10+5
    expect(stats.totalSessions).toBe(2) // 1 session + 1 run
    expect(stats.practiceDayStreak).toBe(1)
    expect(stats.cleanStages).toBe(1)
    expect(stats.pressurePuttsMade).toBe(1)
    expect(stats.longestPuttStreak).toBe(5)
    expect(stats.regimenRunsCompleted).toBe(1)
    expect(stats.noMissRegimenRuns).toBe(1) // 5/5 completed run
    expect(stats.discsOwned).toBe(2)
    expect(stats.putterChainHitsMax).toBe(1200)
    // Weather buckets: the rainy 18mph session (8 makes) + the calm run (5 makes).
    expect(stats.weatherBuckets).toEqual([
      { windMph: 18, condition: 'rain', makes: 8 },
      { windMph: 0, condition: 'clear', makes: 5 },
    ])
  })

  it('does not count an abandoned run as flawless even with no misses', () => {
    const data = {
      sessions: [],
      runs: [
        {
          id: 'r1', regimen_id: 'reg1', started_at: '2026-07-11T09:00:00Z',
          completed: false, total_score: 10, weather_condition: null, wind_mph: null,
          putting_regimen_run_sets: [
            { makes: 3, attempts: 3, longest_streak: 3, clean_set: true, pressure_putt_made: true,
              putting_regimen_sets: { distance_feet_min: 10, distance_feet_max: 10 } },
          ],
        },
      ],
      discs: [],
    }
    const stats = buildPlayerStats(data, now)
    expect(stats.noMissRegimenRuns).toBe(0)
    expect(stats.regimenRunsCompleted).toBe(0)
  })

  it('putterChainHitsMax ignores non-putter discs even if they have more chain hits', () => {
    const data = {
      sessions: [],
      runs: [],
      discs: [
        { role: 'standard', total_chain_hits: 5000 }, // a driver, not a putter — must not win
        { role: 'primary_putter', total_chain_hits: 200 },
        { role: null, total_chain_hits: 9999 }, // no role assigned yet — also excluded
      ],
    }
    expect(buildPlayerStats(data, now).putterChainHitsMax).toBe(200)
  })
})

describe('celebrationEventsFor', () => {
  it('leads with the level-up, then one banner per new badge with its name', () => {
    const events = celebrationEventsFor({
      leveledUp: true,
      newLevel: 5,
      newlyEarned: [{ id: 'b1', code: 'first_makes', tier: 'bronze' }],
    })
    expect(events).toHaveLength(2)
    expect(events[0].message).toContain('Level 5')
    expect(events[1].message).toContain('First Steps')
  })

  it('returns nothing to celebrate when neither a level nor a badge changed', () => {
    expect(celebrationEventsFor({ leveledUp: false, newLevel: 3, newlyEarned: [] })).toEqual([])
  })
})

describe('trophyRoom view models', () => {
  const badges = [
    { id: 'b1', code: 'first_makes', name: 'First Steps', description: 'x', tier: 'bronze', criteria: { metric: 'total_makes', threshold: 10 } },
    { id: 'b2', code: 'c1_100', name: 'C1 Automatic', description: 'x', tier: 'bronze', criteria: { metric: 'makes_in_zone', threshold: 100, params: { zone: 'C1' } } },
    { id: 'b3', code: 'sniper', name: 'Sniper Rifle', description: 'x', tier: 'gold', criteria: { metric: 'longest_made_distance', threshold: 66 } },
  ]

  it('classifies each badge as unlocked / in_progress / locked', () => {
    const vms = buildBadgeViewModels(badges, [
      { badge_id: 'b1', progress: 1, earned_at: '2026-07-01T00:00:00Z' },
      { badge_id: 'b2', progress: 0.4, earned_at: null },
    ])
    expect(vms.find((v) => v.id === 'b1').status).toBe('unlocked')
    expect(vms.find((v) => v.id === 'b2').status).toBe('in_progress')
    expect(vms.find((v) => v.id === 'b3').status).toBe('locked') // no progress row
  })

  it('activePursuits returns in-progress badges, most complete first', () => {
    const vms = buildBadgeViewModels(badges, [
      { badge_id: 'b1', progress: 1, earned_at: '2026-07-01T00:00:00Z' }, // unlocked — excluded
      { badge_id: 'b2', progress: 0.4, earned_at: null },
      { badge_id: 'b3', progress: 0.8, earned_at: null },
    ])
    expect(activePursuits(vms).map((b) => b.id)).toEqual(['b3', 'b2'])
  })

  it('filterCounts and applyFilter agree', () => {
    const vms = buildBadgeViewModels(badges, [
      { badge_id: 'b1', progress: 1, earned_at: '2026-07-01T00:00:00Z' },
      { badge_id: 'b2', progress: 0.4, earned_at: null },
    ])
    const counts = filterCounts(vms)
    expect(counts).toEqual({ all: 3, unlocked: 1, in_progress: 1, locked: 1 })
    expect(applyFilter(vms, 'locked').map((b) => b.id)).toEqual(['b3'])
    expect(applyFilter(vms, 'all')).toHaveLength(3)
  })

  it('pursuitDistanceFor derives a distance only for distance-shaped criteria', () => {
    expect(pursuitDistanceFor({ metric: 'makes_beyond_ft', threshold: 25, params: { min_ft: 40 } })).toBe(40)
    expect(pursuitDistanceFor({ metric: 'longest_made_distance', threshold: 66 })).toBe(66)
    expect(pursuitDistanceFor({ metric: 'makes_in_zone', threshold: 100, params: { zone: 'C2' } })).toBe(50)
    expect(pursuitDistanceFor({ metric: 'total_makes', threshold: 10 })).toBeNull()
    expect(pursuitDistanceFor({ metric: 'practice_day_streak', threshold: 7 })).toBeNull()
  })
})

describe('badge catalog integrity', () => {
  it('has exactly 25 badges with unique codes', () => {
    expect(BADGE_CATALOG).toHaveLength(25)
    const codes = new Set(BADGE_CATALOG.map((b) => b.code))
    expect(codes.size).toBe(25)
  })

  it('every badge criteria references a real metric and a positive threshold', () => {
    for (const badge of BADGE_CATALOG) {
      expect(METRICS[badge.criteria.metric], `metric for ${badge.code}`).toBeTypeOf('function')
      expect(badge.criteria.threshold).toBeGreaterThan(0)
    }
  })

  it('every badge has a known tier with a defined XP payout and an icon', () => {
    for (const badge of BADGE_CATALOG) {
      expect(badgeXpForTier(badge.tier), `xp for ${badge.code}`).toBeGreaterThan(0)
      expect(BADGE_ICONS[badge.code]).toBeTruthy()
    }
  })
})
