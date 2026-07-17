import { describe, expect, it } from 'vitest'
import { DRILL_TYPES, drillGroupLabel, nextDrillStage, scoreDrillStage, validateDrillConfig } from './drillEngine'

const sets = Array.from({ length: 10 }, (_, index) => ({ id: `${index}`, reps_required: 1 }))
const around = { drill_type: DRILL_TYPES.AROUND_THE_WORLD, rules_config: { version: 1, kind: DRILL_TYPES.AROUND_THE_WORLD, max_attempts: 100 } }

describe('drillEngine', () => {
  it('advances and steps back Around the World stations', () => {
    expect(nextDrillStage({ regimen: around, currentIndex: 4, setCount: 10, makes: 1, attemptsSoFar: 8 }).nextIndex).toBe(5)
    expect(nextDrillStage({ regimen: around, currentIndex: 4, setCount: 10, makes: 0, attemptsSoFar: 8 }).nextIndex).toBe(3)
    expect(nextDrillStage({ regimen: around, currentIndex: 0, setCount: 10, makes: 0, attemptsSoFar: 1 }).nextIndex).toBe(0)
  })

  it('completes only after making the final station', () => {
    expect(nextDrillStage({ regimen: around, currentIndex: 9, setCount: 10, makes: 1, attemptsSoFar: 12 }).completed).toBe(true)
    expect(nextDrillStage({ regimen: around, currentIndex: 9, setCount: 10, makes: 0, attemptsSoFar: 12 })).toMatchObject({ completed: false, nextIndex: 8 })
  })

  it('bounds Around the World at the configured attempt cap', () => {
    expect(nextDrillStage({ regimen: around, currentIndex: 3, setCount: 10, makes: 0, attemptsSoFar: 100 }).exhausted).toBe(true)
  })

  it('scores classic drills by makes without synthesizing event facts', () => {
    expect(scoreDrillStage(around, { makes: 1, attempts: 1 }, () => ({ points: 99 }))).toEqual({ points: 1, cleanSet: true })
  })

  it('validates the JYLY 100-putt contract', () => {
    const jyly = { drill_type: DRILL_TYPES.JYLY, rules_config: { version: 1, kind: DRILL_TYPES.JYLY } }
    const jylySets = Array.from({ length: 10 }, () => ({ reps_required: 10 }))
    expect(validateDrillConfig(jyly, jylySets).valid).toBe(true)
    expect(validateDrillConfig(jyly, jylySets.slice(1)).valid).toBe(false)
  })

  it('groups classic drills separately from fixed and custom routines', () => {
    expect(drillGroupLabel(around)).toBe('Classic drills')
    expect(drillGroupLabel({ drill_type: 'custom' })).toBe('Custom routines')
    expect(drillGroupLabel({})).toBe('Scored regimens')
    expect(validateDrillConfig(around, sets).valid).toBe(true)
  })

  it('completes a clutch drill after its selected pressure putt', () => {
    const clutch = { drill_type: DRILL_TYPES.CLUTCH, rules_config: { version: 1, kind: DRILL_TYPES.CLUTCH } }
    expect(validateDrillConfig(clutch, [{ reps_required: 1 }]).valid).toBe(true)
    expect(nextDrillStage({ regimen: clutch, currentIndex: 2, setCount: 4, makes: 0, attemptsSoFar: 1 }).completed).toBe(true)
    expect(drillGroupLabel(clutch)).toBe('Classic drills')
  })
})
