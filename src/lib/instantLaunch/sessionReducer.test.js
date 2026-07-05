import { describe, it, expect } from 'vitest'
import { initialSessionState, sessionReducer, makeTerritoryPct } from './sessionReducer'

const STAGE = { label: 'Set 1', distanceFt: 15, volumePlanned: 10, historicalAvgMakePct: 0.7 }

describe('makeTerritoryPct', () => {
  it('grows 5% per consecutive make', () => {
    expect(makeTerritoryPct(0)).toBe(0)
    expect(makeTerritoryPct(1)).toBeCloseTo(0.05)
    expect(makeTerritoryPct(4)).toBeCloseTo(0.2)
  })

  it('caps at 60%', () => {
    expect(makeTerritoryPct(12)).toBe(0.6)
    expect(makeTerritoryPct(100)).toBe(0.6)
  })
})

describe('sessionReducer gesture events', () => {
  it('records a make: increments tally, consecutiveMakes, and sequence', () => {
    let state = initialSessionState(STAGE)
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e1', occurredAt: '2026-07-04T00:00:00Z' })
    expect(state.tally).toEqual({ makes: 1, attempts: 1 })
    expect(state.consecutiveMakes).toBe(1)
    expect(state.events).toEqual([
      {
        id: 'e1',
        outcome: 'make',
        missZone: null,
        sequence: 1,
        occurredAt: '2026-07-04T00:00:00Z',
        consecutiveMakesBefore: 0,
        longestStreakBefore: 0,
      },
    ])
    expect(state.nextSequence).toBe(2)
    expect(state.longestStreak).toBe(1)
  })

  it('records a miss: resets consecutiveMakes, captures an optional miss zone, leaves longestStreak alone', () => {
    let state = initialSessionState(STAGE)
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e1', occurredAt: 't1' })
    state = sessionReducer(state, { type: 'GESTURE_MISS', id: 'e2', occurredAt: 't2', missZone: 7 })
    expect(state.tally).toEqual({ makes: 1, attempts: 2 })
    expect(state.consecutiveMakes).toBe(0)
    expect(state.longestStreak).toBe(1)
    expect(state.events[1]).toEqual({
      id: 'e2',
      outcome: 'miss',
      missZone: 7,
      sequence: 2,
      occurredAt: 't2',
      consecutiveMakesBefore: 1,
      longestStreakBefore: 1,
    })
  })

  it('tracks the longest streak reached, surviving a later miss', () => {
    let state = initialSessionState(STAGE)
    for (const id of ['e1', 'e2', 'e3']) {
      state = sessionReducer(state, { type: 'GESTURE_MAKE', id, occurredAt: 't' })
    }
    expect(state.longestStreak).toBe(3)
    state = sessionReducer(state, { type: 'GESTURE_MISS', id: 'e4', occurredAt: 't' })
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e5', occurredAt: 't' })
    // one make after the miss (streak of 1) never exceeds the earlier streak of 3
    expect(state.longestStreak).toBe(3)
    expect(state.consecutiveMakes).toBe(1)
  })

  it('leaves missZone null when diagnostic mode is off', () => {
    const state = sessionReducer(initialSessionState(STAGE), { type: 'GESTURE_MISS', id: 'e1', occurredAt: 't1' })
    expect(state.events[0].missZone).toBeNull()
  })
})

describe('sessionReducer UNDO', () => {
  it('reverses the most recent make: tally, consecutiveMakes, longestStreak, and the event itself', () => {
    let state = initialSessionState(STAGE)
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e1', occurredAt: 't1' })
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e2', occurredAt: 't2' })
    state = sessionReducer(state, { type: 'UNDO' })
    expect(state.tally).toEqual({ makes: 1, attempts: 1 })
    expect(state.consecutiveMakes).toBe(1)
    expect(state.longestStreak).toBe(1)
    expect(state.events).toHaveLength(1)
    expect(state.events[0].id).toBe('e1')
  })

  it('reverses the most recent miss without touching consecutiveMakes', () => {
    let state = initialSessionState(STAGE)
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e1', occurredAt: 't1' })
    state = sessionReducer(state, { type: 'GESTURE_MISS', id: 'e2', occurredAt: 't2' })
    state = sessionReducer(state, { type: 'UNDO' })
    expect(state.tally).toEqual({ makes: 1, attempts: 1 })
    expect(state.consecutiveMakes).toBe(1)
    expect(state.events).toHaveLength(1)
  })

  it('is a no-op with nothing to undo', () => {
    const state = initialSessionState(STAGE)
    expect(sessionReducer(state, { type: 'UNDO' })).toBe(state)
  })

  it('never undoes a batch-ribbon fill (only ever touches gesture events)', () => {
    let state = initialSessionState(STAGE)
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e1', occurredAt: 't1' })
    state = sessionReducer(state, { type: 'BATCH_COMPLETE', makes: 4, attempts: 5 })
    state = sessionReducer(state, { type: 'UNDO' })
    // undoes the gesture make (e1), not the batch fill that came after it
    expect(state.tally).toEqual({ makes: 4, attempts: 5 })
    expect(state.events).toHaveLength(0)
  })
})

describe('sessionReducer BATCH_COMPLETE — mixed gesture + batch stage (data-split rule)', () => {
  it('adds to the tally without creating putt_events rows or touching consecutiveMakes', () => {
    let state = initialSessionState(STAGE)
    state = sessionReducer(state, { type: 'GESTURE_MAKE', id: 'e1', occurredAt: 't1' })
    state = sessionReducer(state, { type: 'GESTURE_MISS', id: 'e2', occurredAt: 't2' })
    // gesture-logged 1 make + 1 miss (2 of 10), batch-fill the remaining 8 (say 6 makes, 2 misses)
    state = sessionReducer(state, { type: 'BATCH_COMPLETE', makes: 6, attempts: 8 })

    expect(state.tally).toEqual({ makes: 7, attempts: 10 })
    // only the two real gesture events exist — the batch-filled 8 are not synthesized
    expect(state.events).toHaveLength(2)
    expect(state.consecutiveMakes).toBe(0) // unaffected by the batch fill
  })
})
