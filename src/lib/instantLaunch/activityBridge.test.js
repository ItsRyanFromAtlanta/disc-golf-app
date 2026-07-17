import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITY_SOURCES, ACTIVITY_STATES } from '../activityLifecycle'
import { createAppDatabase } from '../db/dexieDb'
import { createActivityRepository } from '../repository/activityRepository'
import {
  INSTANT_LAUNCH_ACTIVITY_WARNINGS,
  activityIdForCrashRecoveryBuffer,
  activityTypeForSessionType,
  mirrorInstantLaunchActivity,
} from './activityBridge'
import { applyEnqueuePuttEvent, applySetCrashRecoveryBuffer, defaultInstantLaunchState } from './stateReducer'

const TIME = '2026-07-12T12:00:00.000Z'

describe('InstantLaunch activity bridge', () => {
  let database
  let repository
  let eventSequence

  beforeEach(async () => {
    database = createAppDatabase(`ActivityBridgeTest-${crypto.randomUUID()}`)
    eventSequence = 0
    repository = createActivityRepository({
      database,
      eventIdFactory: () => `event-${++eventSequence}`,
    })
    await database.open()
  })

  afterEach(async () => {
    await database.delete()
  })

  function activeInstantLaunchState(sessionType = 'freeform') {
    const parentIds =
      sessionType === 'regimen'
        ? { regimenRunId: 'run-1', regimenId: 'regimen-1' }
        : { freeformSessionId: 'session-1' }
    const withBuffer = applySetCrashRecoveryBuffer(defaultInstantLaunchState(), {
      hasActiveSession: true,
      sessionType,
      parentIds,
    })
    return applyEnqueuePuttEvent(withBuffer, { id: 'putt-1', outcome: 'make' })
  }

  function mirror(state) {
    return mirrorInstantLaunchActivity({
      repository,
      instantLaunchState: state,
      userId: 'user-1',
      occurredAt: TIME,
      installationId: 'installation-1',
      source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    })
  }

  it('maps shipped session types and derives a stable id from their parent row', () => {
    expect(activityTypeForSessionType('freeform')).toBe('putting_freeform')
    expect(activityTypeForSessionType('regimen')).toBe('putting_regimen')
    expect(activityTypeForSessionType('other')).toBeNull()
    expect(activityIdForCrashRecoveryBuffer(activeInstantLaunchState().crashRecoveryBuffer)).toBe('session-1')
  })

  it('creates and starts a mirror without touching the proven capture outbox', async () => {
    const state = activeInstantLaunchState()
    const result = await mirror(state)

    expect(result.outcome).toBe('mirrored')
    expect(result.activity).toMatchObject({ id: 'session-1', state: ACTIVITY_STATES.ACTIVE })
    expect(result.instantLaunchState.crashRecoveryBuffer.activityId).toBe('session-1')
    expect(result.instantLaunchState.outbox).toBe(state.outbox)
    expect(result.instantLaunchState.outbox.puttEvents).toEqual([{ id: 'putt-1', outcome: 'make' }])
  })

  it('is crash-retry safe even if the caller lost the first returned localStorage state', async () => {
    const originalState = activeInstantLaunchState()
    const first = await mirror(originalState)
    const retry = await mirror(originalState)

    expect(first.activity.id).toBe(retry.activity.id)
    expect(await database.activities.count()).toBe(1)
    expect(await database.activityStateEvents.count()).toBe(1)
    expect(await database.outbox.count()).toBe(2)
  })

  it('does nothing when no InstantLaunch session is active', async () => {
    const state = defaultInstantLaunchState()
    const result = await mirror(state)
    expect(result).toEqual({ instantLaunchState: state, activity: null, outcome: 'no_active_session', warnings: [] })
    expect(await database.activities.count()).toBe(0)
  })

  it('returns a warning rather than inventing identity for malformed recovery state', async () => {
    const state = applySetCrashRecoveryBuffer(defaultInstantLaunchState(), {
      hasActiveSession: true,
      sessionType: 'freeform',
      parentIds: {},
    })
    const result = await mirror(state)
    expect(result.warnings).toEqual([INSTANT_LAUNCH_ACTIVITY_WARNINGS.MISSING_PARENT_ID])
    expect(await database.activities.count()).toBe(0)
  })

  it('never reactivates a terminal mirrored activity', async () => {
    const state = activeInstantLaunchState()
    const mirrored = await mirror(state)
    await repository.markIncomplete('session-1', {
      expectedState: ACTIVITY_STATES.ACTIVE,
      expectedVersion: mirrored.activity.version,
      occurredAt: TIME,
      recordedAt: TIME,
      source: ACTIVITY_SOURCES.LIVE_CAPTURE,
      installationId: 'installation-1',
      idempotencyKey: 'end-session-1',
    })

    const retry = await mirror(state)
    expect(retry.outcome).toBe('not_mirrored')
    expect(retry.activity.state).toBe(ACTIVITY_STATES.INCOMPLETE)
    expect(retry.warnings).toEqual([INSTANT_LAUNCH_ACTIVITY_WARNINGS.TERMINAL_ACTIVITY])
  })
})
