import { describe, expect, it } from 'vitest'
import { experimentComparison } from './experimentComparison'

const event = (id, outcome, occurred_at, putter_disc_id = 'disc-a') => ({
  id, outcome, occurred_at, putter_disc_id, distance_ft: 20,
})

describe('experimentComparison', () => {
  it('compares the marked disc after the boundary with attributed history before it', () => {
    const before = Array.from({ length: 10 }, (_, index) => event(`before-${index}`, index < 5 ? 'make' : 'miss', `2026-07-01T12:${String(index).padStart(2, '0')}:00Z`))
    const after = Array.from({ length: 10 }, (_, index) => event(`after-${index}`, index < 8 ? 'make' : 'miss', `2026-07-10T12:${String(index).padStart(2, '0')}:00Z`))
    const result = experimentComparison([
      { id: 'marker-1', disc_id: 'disc-a', effective_at: '2026-07-10T00:00:00Z', label: 'Switched to A' },
    ], [...before, ...after], [{ id: 'disc-a', nickname: 'A' }])

    expect(result.experiments[0]).toMatchObject({
      markerId: 'marker-1', discId: 'disc-a', ready: true,
      before: { makes: 5, attempts: 10 }, after: { makes: 8, attempts: 10 },
    })
    expect(result.experiments[0].delta).toBeCloseTo(0.3)
    expect(result.experiments[0].disc.nickname).toBe('A')
  })

  it('ends an experiment at the next marker and withholds small samples', () => {
    const events = [
      event('a-before', 'make', '2026-07-01T12:00:00Z'),
      event('a-after', 'miss', '2026-07-10T12:00:00Z'),
      event('b-after', 'make', '2026-07-20T12:00:00Z', 'disc-b'),
    ]
    const result = experimentComparison([
      { id: 'a', disc_id: 'disc-a', effective_at: '2026-07-10T00:00:00Z' },
      { id: 'b', disc_id: 'disc-b', effective_at: '2026-07-20T00:00:00Z' },
    ], events)

    expect(result.experiments[0].nextMarkerAt).toBeNull()
    expect(result.experiments[1]).toMatchObject({ before: { attempts: 1 }, after: { attempts: 1 }, delta: null, ready: false })
    expect(result.attributionCoverage).toBe(1)
  })

  it('does not invent attribution for batch or unselected events', () => {
    const result = experimentComparison([
      { id: 'marker', disc_id: 'disc-a', effective_at: '2026-07-10T00:00:00Z' },
    ], [
      event('unselected', 'make', '2026-07-01T12:00:00Z', null),
      { id: 'batch', outcome: 'make', distance_ft: 20, occurred_at: '2026-07-11T12:00:00Z' },
    ])

    expect(result.totalRealTimeAttempts).toBe(2)
    expect(result.attributedAttempts).toBe(0)
    expect(result.experiments[0].before.attempts).toBe(0)
  })
})
