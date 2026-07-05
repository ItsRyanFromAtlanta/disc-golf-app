import { describe, it, expect } from 'vitest'
import {
  INSTANT_LAUNCH_SCHEMA_VERSION,
  defaultInstantLaunchState,
  migrateOrResetState,
  applySetProfileDefaults,
  applySetSmartPredictionCard,
  applySetCrashRecoveryBuffer,
  applyClearCrashRecoveryBuffer,
  applyEnqueueParentWrite,
  applyEnqueueSummaryWrite,
  applyEnqueuePuttEvent,
  applyDequeueOutboxEntries,
  applyRemovePendingPuttEvent,
} from './stateReducer'

describe('defaultInstantLaunchState', () => {
  it('has no active session and empty outboxes', () => {
    const state = defaultInstantLaunchState()
    expect(state.schemaVersion).toBe(INSTANT_LAUNCH_SCHEMA_VERSION)
    expect(state.crashRecoveryBuffer.hasActiveSession).toBe(false)
    expect(state.outbox).toEqual({ parentWrites: [], summaryWrites: [], puttEvents: [] })
  })
})

describe('migrateOrResetState', () => {
  it('resets on missing/null input', () => {
    expect(migrateOrResetState(null)).toEqual(defaultInstantLaunchState())
    expect(migrateOrResetState(undefined)).toEqual(defaultInstantLaunchState())
  })

  it('resets on a schema version mismatch (old shape from a future/past app version)', () => {
    expect(migrateOrResetState({ schemaVersion: 999, outbox: { garbage: true } })).toEqual(
      defaultInstantLaunchState(),
    )
  })

  it('passes through a matching schema version unchanged', () => {
    const state = { ...defaultInstantLaunchState(), profileDefaults: { favoritePutterDiscId: 'putter-1' } }
    expect(migrateOrResetState(state)).toBe(state)
  })
})

describe('profile / prediction / crash-recovery setters are immutable', () => {
  it('applySetProfileDefaults merges without mutating the original', () => {
    const state = defaultInstantLaunchState()
    const next = applySetProfileDefaults(state, { favoritePutterDiscId: 'putter-1' })
    expect(next.profileDefaults.favoritePutterDiscId).toBe('putter-1')
    expect(next.profileDefaults.diagnosticModeDefault).toBe(false)
    expect(state.profileDefaults.favoritePutterDiscId).toBeNull()
  })

  it('applySetSmartPredictionCard merges', () => {
    const next = applySetSmartPredictionCard(defaultInstantLaunchState(), { lastRegimenId: 'r1' })
    expect(next.smartPredictionCard.lastRegimenId).toBe('r1')
  })

  it('applySetCrashRecoveryBuffer merges and applyClearCrashRecoveryBuffer resets to default', () => {
    const withBuffer = applySetCrashRecoveryBuffer(defaultInstantLaunchState(), {
      hasActiveSession: true,
      sessionType: 'regimen',
    })
    expect(withBuffer.crashRecoveryBuffer.hasActiveSession).toBe(true)
    const cleared = applyClearCrashRecoveryBuffer(withBuffer)
    expect(cleared.crashRecoveryBuffer).toEqual(defaultInstantLaunchState().crashRecoveryBuffer)
  })
})

describe('outbox enqueue/dequeue', () => {
  it('enqueues into the right bucket without touching the others', () => {
    let state = defaultInstantLaunchState()
    state = applyEnqueueParentWrite(state, { id: 'p1' })
    state = applyEnqueueSummaryWrite(state, { id: 's1' })
    state = applyEnqueuePuttEvent(state, { id: 'e1' })
    expect(state.outbox.parentWrites).toEqual([{ id: 'p1' }])
    expect(state.outbox.summaryWrites).toEqual([{ id: 's1' }])
    expect(state.outbox.puttEvents).toEqual([{ id: 'e1' }])
  })

  it('dequeues confirmed-synced entries by id, leaving the rest', () => {
    let state = defaultInstantLaunchState()
    state = applyEnqueuePuttEvent(state, { id: 'e1' })
    state = applyEnqueuePuttEvent(state, { id: 'e2' })
    state = applyEnqueueParentWrite(state, { id: 'p1' })
    const next = applyDequeueOutboxEntries(state, { parentIds: ['p1'], puttEventIds: ['e1'] })
    expect(next.outbox.puttEvents).toEqual([{ id: 'e2' }])
    expect(next.outbox.parentWrites).toEqual([])
  })

  it('applyRemovePendingPuttEvent removes a single not-yet-synced event by id', () => {
    let state = defaultInstantLaunchState()
    state = applyEnqueuePuttEvent(state, { id: 'e1' })
    state = applyEnqueuePuttEvent(state, { id: 'e2' })
    const next = applyRemovePendingPuttEvent(state, 'e1')
    expect(next.outbox.puttEvents).toEqual([{ id: 'e2' }])
  })
})
