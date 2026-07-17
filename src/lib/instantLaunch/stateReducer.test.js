import { describe, it, expect } from 'vitest'
import {
  INSTANT_LAUNCH_SCHEMA_VERSION,
  defaultInstantLaunchState,
  migrateOrResetState,
  applySetProfileDefaults,
  applySetSmartPredictionCard,
  applySetCrashRecoveryBuffer,
  applyAppendGhostCurrentEvent,
  applyRemoveGhostCurrentEvent,
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
    expect(state.crashRecoveryBuffer.activityId).toBeNull()
    expect(state.outbox).toEqual({ parentWrites: [], summaryWrites: [], puttEvents: [] })
  })
})

describe('migrateOrResetState', () => {
  it('resets on missing/null input', () => {
    expect(migrateOrResetState(null)).toEqual(defaultInstantLaunchState())
    expect(migrateOrResetState(undefined)).toEqual(defaultInstantLaunchState())
  })

  it('resets on an unknown schema version', () => {
    expect(migrateOrResetState({ schemaVersion: 999, outbox: { garbage: true } })).toEqual(
      defaultInstantLaunchState(),
    )
  })

  it('normalizes a matching schema version without losing fields', () => {
    const state = { ...defaultInstantLaunchState(), profileDefaults: { favoritePutterDiscId: 'putter-1' } }
    const migrated = migrateOrResetState(state)
    expect(migrated.profileDefaults.favoritePutterDiscId).toBe('putter-1')
    expect(migrated.profileDefaults.quickPlayRegimenId).toBeNull()
    expect(migrated.profileDefaults.inputModeDefault).toBe('tap')
  })

  it('upgrades v1 without losing crash recovery or pending capture writes', () => {
    const v1 = {
      ...defaultInstantLaunchState(),
      schemaVersion: 1,
      crashRecoveryBuffer: {
        hasActiveSession: true,
        sessionType: 'freeform',
        parentIds: { freeformSessionId: 'session-1' },
        currentStage: { setOrder: 1, distanceFt: 20, sequenceCounter: 3 },
        lastUpdatedAt: '2026-07-12T12:00:00.000Z',
      },
      outbox: {
        parentWrites: [{ id: 'session-1' }],
        summaryWrites: [{ id: 'summary-1' }],
        puttEvents: [{ id: 'putt-1' }],
      },
    }

    const migrated = migrateOrResetState(v1)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.crashRecoveryBuffer.activityId).toBeNull()
    expect(migrated.crashRecoveryBuffer.parentIds.freeformSessionId).toBe('session-1')
    expect(migrated.crashRecoveryBuffer.ghostProfile).toBeNull()
    expect(migrated.crashRecoveryBuffer.ghostCurrentEvents).toEqual([])
    expect(migrated.outbox).toEqual(v1.outbox)
  })

  it('upgrades v2 while preserving active capture and adding ghost defaults', () => {
    const v2 = { ...defaultInstantLaunchState(), schemaVersion: 2 }
    delete v2.crashRecoveryBuffer.ghostProfile
    delete v2.crashRecoveryBuffer.ghostCurrentEvents
    v2.outbox.puttEvents = [{ id: 'pending' }]
    const migrated = migrateOrResetState(v2)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.crashRecoveryBuffer.ghostProfile).toBeNull()
    expect(migrated.crashRecoveryBuffer.ghostCurrentEvents).toEqual([])
    expect(migrated.outbox.puttEvents).toEqual([{ id: 'pending' }])
  })
})

describe('ghost pacing recovery diagnostics', () => {
  it('appends and removes current events without touching the sporting outbox', () => {
    const original = applySetCrashRecoveryBuffer(defaultInstantLaunchState(), { ghostProfile: { sourceRunId: 'ghost' } })
    const appended = applyAppendGhostCurrentEvent(original, { id: 'putt-1', outcome: 'make' })
    expect(appended.crashRecoveryBuffer.ghostCurrentEvents).toEqual([{ id: 'putt-1', outcome: 'make' }])
    expect(appended.outbox.puttEvents).toEqual([])
    const removed = applyRemoveGhostCurrentEvent(appended, 'putt-1')
    expect(removed.crashRecoveryBuffer.ghostCurrentEvents).toEqual([])
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
