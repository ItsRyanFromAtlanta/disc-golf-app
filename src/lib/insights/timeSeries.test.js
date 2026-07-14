import { describe, it, expect } from 'vitest'
import { makePercentTimeSeries, TIME_RANGE_DAYS } from './timeSeries'

const DAY = 24 * 60 * 60 * 1000
// Fixed reference "now" on a UTC day boundary keeps bucket math exact.
const NOW = Date.parse('2026-07-14T00:00:00Z')

function daysAgo(n, hour = 12) {
  return new Date(NOW - n * DAY + hour * 60 * 60 * 1000).toISOString()
}

describe('makePercentTimeSeries', () => {
  it('aggregates same-UTC-day samples into one point and computes make %', () => {
    const series = makePercentTimeSeries(
      [
        { makes: 3, attempts: 5, at: daysAgo(2, 9) },
        { makes: 4, attempts: 5, at: daysAgo(2, 18) },
        { makes: 1, attempts: 4, at: daysAgo(1, 10) },
      ],
      { now: NOW, windowDays: 30 },
    )
    expect(series.points).toEqual([
      { periodStart: NOW - 2 * DAY, makes: 7, attempts: 10, makePct: 0.7 },
      { periodStart: NOW - 1 * DAY, makes: 1, attempts: 4, makePct: 0.25 },
    ])
    expect(series.totalMakes).toBe(8)
    expect(series.totalAttempts).toBe(14)
    expect(series.makePct).toBeCloseTo(8 / 14)
  })

  it('excludes samples outside the trailing window', () => {
    const series = makePercentTimeSeries(
      [
        { makes: 5, attempts: 5, at: daysAgo(3) },
        { makes: 0, attempts: 5, at: daysAgo(40) }, // beyond a 7-day window
      ],
      { now: NOW, windowDays: 7 },
    )
    expect(series.points).toHaveLength(1)
    expect(series.totalAttempts).toBe(5)
  })

  it('leaves rest days as gaps rather than fabricating 0% points', () => {
    const series = makePercentTimeSeries(
      [
        { makes: 2, attempts: 4, at: daysAgo(5) },
        { makes: 3, attempts: 4, at: daysAgo(1) },
      ],
      { now: NOW, windowDays: 30 },
    )
    // Only the two practiced days appear; the 4 idle days between them do not.
    expect(series.points).toHaveLength(2)
  })

  it('skips zero-attempt and unparseable samples', () => {
    const series = makePercentTimeSeries(
      [
        { makes: 0, attempts: 0, at: daysAgo(1) },
        { makes: 1, attempts: 2, at: 'not-a-date' },
        { makes: 2, attempts: 2, at: daysAgo(2) },
      ],
      { now: NOW, windowDays: 30 },
    )
    expect(series.points).toHaveLength(1)
    expect(series.totalAttempts).toBe(2)
  })

  it('returns null make % for an empty window', () => {
    const series = makePercentTimeSeries([], { now: NOW, windowDays: 30 })
    expect(series.points).toEqual([])
    expect(series.makePct).toBeNull()
  })

  it('exposes the standard range options', () => {
    expect(TIME_RANGE_DAYS).toEqual([7, 30, 90])
  })
})
