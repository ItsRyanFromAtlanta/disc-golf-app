import { describe, expect, it } from 'vitest'
import {
  makePercentTrend,
  trendMilestones,
  trendWindow,
  DEFAULT_TREND_WINDOW_DAYS,
  TREND_MIN_BUCKET_ATTEMPTS,
  TREND_MIN_HALF_ATTEMPTS,
} from './trend'

const NOW = new Date('2026-07-30T12:00:00Z').getTime()
const MS_PER_DAY = 24 * 60 * 60 * 1000
const daysAgo = (days) => new Date(NOW - days * MS_PER_DAY).toISOString()

// n samples of `makes` out of `attempts`, all landing `days` before NOW.
const sample = (days, makes, attempts) => ({ makes, attempts, at: daysAgo(days) })

describe('trendWindow', () => {
  it('exposes bucket widths that divide their window exactly', () => {
    for (const days of [7, 30, 90]) {
      const window = trendWindow(days)
      expect(window.days % window.bucketDays).toBe(0)
    }
  })

  it('falls back to the default window for an unknown range', () => {
    expect(trendWindow(365).days).toBe(DEFAULT_TREND_WINDOW_DAYS)
  })
})

describe('makePercentTrend', () => {
  it('buckets samples by period and leaves unpractised periods as gaps', () => {
    const trend = makePercentTrend(
      [sample(1, 8, 10), sample(2, 4, 10), sample(28, 5, 10)],
      { now: NOW, windowDays: 30 },
    )

    // 5-day buckets: days 1 and 2 share the newest bucket, day 28 sits in the
    // oldest. The four unpractised buckets between them are absent, not zero.
    expect(trend.bucketDays).toBe(5)
    expect(trend.points).toHaveLength(2)
    expect(trend.points[0]).toMatchObject({ makes: 5, attempts: 10, makePct: 0.5 })
    expect(trend.points[1]).toMatchObject({ makes: 12, attempts: 20, makePct: 0.6 })
    expect(trend.points[0].start).toBeLessThan(trend.points[1].start)
    expect(trend.totals).toMatchObject({ makes: 17, attempts: 30 })
  })

  it('excludes samples outside the half-open window', () => {
    const trend = makePercentTrend(
      [sample(0, 1, 1), sample(7, 9, 10), sample(8, 9, 10), { makes: 1, attempts: 1, at: 'not-a-date' }],
      { now: NOW, windowDays: 7 },
    )
    // The day-7 sample lands exactly on the older boundary and belongs to the
    // previous window; day 8 is plainly outside; the unparseable date is dropped.
    expect(trend.totals.attempts).toBe(1)
    expect(trend.points).toHaveLength(1)
  })

  it('flags thin buckets as sparse and still carries an interval on every point', () => {
    const trend = makePercentTrend([sample(1, 2, 3), sample(20, 30, 40)], { now: NOW, windowDays: 30 })
    const [old, recent] = trend.points
    expect(recent.attempts).toBeLessThan(TREND_MIN_BUCKET_ATTEMPTS)
    expect(recent.sparse).toBe(true)
    expect(old.sparse).toBe(false)
    expect(trend.sparsePointCount).toBe(1)
    for (const point of trend.points) {
      expect(point.interval.lower).toBeLessThanOrEqual(point.makePct)
      expect(point.interval.upper).toBeGreaterThanOrEqual(point.makePct)
    }
    // A 2/3 bucket must not read as a confident 67%.
    expect(recent.interval.upper - recent.interval.lower).toBeGreaterThan(0.5)
  })

  it('calls a direction only when the two halves have non-overlapping intervals', () => {
    const trend = makePercentTrend(
      [sample(25, 10, 60), sample(5, 55, 60)],
      { now: NOW, windowDays: 30 },
    )
    expect(trend.direction.verdict).toBe('improving')
    expect(trend.direction.deltaPct).toBeCloseTo(55 / 60 - 10 / 60)
    expect(trend.direction.later.interval.lower).toBeGreaterThan(trend.direction.earlier.interval.upper)
  })

  it('reports a decline the same way, and only on separated intervals', () => {
    const declining = makePercentTrend(
      [sample(25, 55, 60), sample(5, 10, 60)],
      { now: NOW, windowDays: 30 },
    )
    expect(declining.direction.verdict).toBe('declining')

    // Same sample sizes, a real but small point-estimate gap: the intervals
    // still overlap, so no direction is claimed.
    const noisy = makePercentTrend(
      [sample(25, 30, 60), sample(5, 36, 60)],
      { now: NOW, windowDays: 30 },
    )
    expect(noisy.direction.verdict).toBe('no-clear-change')
    expect(noisy.direction.deltaPct).toBeCloseTo(0.1)
  })

  it('withholds a direction when either half is below the attempt floor', () => {
    const trend = makePercentTrend(
      [sample(25, 60, 60), sample(5, 0, TREND_MIN_HALF_ATTEMPTS - 1)],
      { now: NOW, windowDays: 30 },
    )
    expect(trend.direction.verdict).toBe('insufficient-evidence')
    expect(trend.direction.deltaPct).toBeNull()
    // The evidence is still exposed so the UI can say how far off it is.
    expect(trend.direction.later.attempts).toBe(TREND_MIN_HALF_ATTEMPTS - 1)
  })

  it('degrades honestly on a single thin session rather than drawing a trend', () => {
    const trend = makePercentTrend([sample(1, 2, 3)], { now: NOW, windowDays: 90 })
    expect(trend.points).toHaveLength(1)
    expect(trend.points[0].sparse).toBe(true)
    expect(trend.direction.verdict).toBe('insufficient-evidence')
  })

  it('returns an empty, non-null-percentage-free shape with no data', () => {
    const trend = makePercentTrend([], { now: NOW })
    expect(trend.points).toEqual([])
    expect(trend.totals).toMatchObject({ makes: 0, attempts: 0, makePct: null, interval: null })
    expect(trend.direction.verdict).toBe('insufficient-evidence')
    expect(trend.sparsePointCount).toBe(0)
  })

  it('ignores zero-attempt and malformed samples without throwing', () => {
    expect(makePercentTrend([{ makes: 0, attempts: 0, at: daysAgo(1) }, null, undefined], { now: NOW }).points)
      .toEqual([])
  })
})

describe('trendMilestones', () => {
  const window = { start: NOW - 30 * MS_PER_DAY, end: NOW }
  const markers = [
    { id: 'm2', disc_id: 'd1', marker_type: 'new_putter', effective_at: daysAgo(3), label: null },
    { id: 'm1', disc_id: 'd2', marker_type: 'new_putter', effective_at: daysAgo(10), label: 'Switched moulds' },
    { id: 'm0', disc_id: 'd1', marker_type: 'new_putter', effective_at: daysAgo(400), label: null },
    { id: 'mx', disc_id: 'd1', marker_type: 'new_putter', effective_at: 'nope', label: null },
  ]
  const discs = [{ id: 'd1', nickname: 'Blue', mold: 'Aviar' }, { id: 'd2', mold: 'Luna' }]

  it('keeps only in-window markers, oldest first, labelled from marker or disc', () => {
    const result = trendMilestones(markers, discs, window)
    expect(result.map((marker) => marker.id)).toEqual(['m1', 'm2'])
    expect(result[0].label).toBe('Switched moulds')
    expect(result[1].label).toBe('Blue · Aviar')
  })

  it('returns nothing with no markers, no discs, or an empty window', () => {
    expect(trendMilestones([], [], window)).toEqual([])
    expect(trendMilestones(markers, [], { start: NOW, end: NOW })).toEqual([])
    // An unknown disc still yields a usable, non-crashing label.
    expect(trendMilestones([markers[0]], [], window)[0].label).toBe('Equipment change')
  })
})
