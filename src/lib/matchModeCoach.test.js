import { describe, expect, it } from 'vitest'
import { evaluateMatchMode } from './matchModeCoach'

const event = (outcome, missZone = null, distanceFt = 25) => ({ outcome, miss_zone: missZone, distance_ft: distanceFt })

describe('evaluateMatchMode', () => {
  it('requires three consecutive same-zone, same-band misses', () => {
    expect(evaluateMatchMode({ events: [event('miss', 7), event('miss', 7)] })).toBeNull()
    expect(evaluateMatchMode({ events: [event('miss', 7), event('miss', 8), event('miss', 7)] })).toBeNull()
    expect(evaluateMatchMode({ events: [event('miss', 7), event('miss', 7), event('miss', 7)] })).toMatchObject({ kind: 'miss_pattern', intervention: true })
  })

  it('does not repeat a pattern on the fourth identical miss', () => {
    const events = [event('miss', 7), event('miss', 7), event('miss', 7), event('miss', 7)]
    expect(evaluateMatchMode({ events, lastSpokenAttempt: 3, lastInterventionAttempt: 3 })).toBeNull()
  })

  it('detects a 30-point drop across two five-attempt windows', () => {
    const previous = ['make', 'make', 'make', 'make', 'miss'].map((o) => event(o))
    const current = ['make', 'miss', 'miss', 'miss', 'miss'].map((o) => event(o))
    expect(evaluateMatchMode({ events: [...previous, ...current] })).toMatchObject({ kind: 'sustained_drop', attempt: 10 })
  })

  it('announces five-attempt milestones with available ghost pace', () => {
    const result = evaluateMatchMode({
      events: ['make', 'make', 'miss', 'make', 'miss'].map((o) => event(o)),
      ghostComparison: { ready: true, makeDelta: 1 },
    })
    expect(result).toMatchObject({ kind: 'milestone', intervention: false, attempt: 5 })
    expect(result.message).toContain('60 percent')
    expect(result.message).toContain('1 make ahead')
  })

  it('honors spoken-attempt and intervention cooldown state', () => {
    const events = [event('miss', 7), event('miss', 7), event('miss', 7)]
    expect(evaluateMatchMode({ events, lastSpokenAttempt: 3 })).toBeNull()
    expect(evaluateMatchMode({ events, lastInterventionAttempt: 1 })).toBeNull()
  })
})
