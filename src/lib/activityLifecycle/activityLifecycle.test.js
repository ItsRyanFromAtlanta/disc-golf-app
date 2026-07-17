import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_TYPES,
  BACKGROUND_AUTO_PAUSE_GRACE_MS,
  LIFECYCLE_COMMANDS,
  LIFECYCLE_ERROR_CODES,
  LIFECYCLE_TRANSITION_TABLE,
  canUndoReplacement,
  createDraftLifecycle,
  planActivityStart,
  reduceActivityLifecycle,
  shouldAutoPause,
} from '.'

const BASE_TIME = '2026-07-12T12:00:00.000Z'

function activity(state, overrides = {}) {
  return {
    id: 'activity-1',
    type: ACTIVITY_TYPES.PUTTING_FREEFORM,
    state,
    version: 3,
    ...overrides,
  }
}

function command(type, currentActivity, overrides = {}) {
  return {
    type,
    expectedState: currentActivity.state,
    expectedVersion: currentActivity.version,
    occurredAt: BASE_TIME,
    recordedAt: BASE_TIME,
    source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    installationId: 'installation-1',
    idempotencyKey: `key-${type}`,
    ...overrides,
  }
}

const appliedCases = [
  [ACTIVITY_STATES.DRAFT, LIFECYCLE_COMMANDS.START, ACTIVITY_STATES.ACTIVE],
  [ACTIVITY_STATES.ACTIVE, LIFECYCLE_COMMANDS.PAUSE, ACTIVITY_STATES.PAUSED],
  [ACTIVITY_STATES.ACTIVE, LIFECYCLE_COMMANDS.FINALIZE_COMPLETED, ACTIVITY_STATES.COMPLETED],
  [ACTIVITY_STATES.ACTIVE, LIFECYCLE_COMMANDS.MARK_INCOMPLETE, ACTIVITY_STATES.INCOMPLETE],
  [ACTIVITY_STATES.PAUSED, LIFECYCLE_COMMANDS.RESUME, ACTIVITY_STATES.ACTIVE],
  [ACTIVITY_STATES.PAUSED, LIFECYCLE_COMMANDS.FINALIZE_COMPLETED, ACTIVITY_STATES.COMPLETED],
  [ACTIVITY_STATES.PAUSED, LIFECYCLE_COMMANDS.MARK_INCOMPLETE, ACTIVITY_STATES.INCOMPLETE],
]

const idempotentCases = [
  [ACTIVITY_STATES.ACTIVE, LIFECYCLE_COMMANDS.START],
  [ACTIVITY_STATES.ACTIVE, LIFECYCLE_COMMANDS.RESUME],
  [ACTIVITY_STATES.PAUSED, LIFECYCLE_COMMANDS.PAUSE],
  [ACTIVITY_STATES.COMPLETED, LIFECYCLE_COMMANDS.FINALIZE_COMPLETED],
  [ACTIVITY_STATES.INCOMPLETE, LIFECYCLE_COMMANDS.MARK_INCOMPLETE],
]

describe('activity lifecycle transitions', () => {
  it.each(appliedCases)('%s + %s -> %s', (from, action, to) => {
    const current = activity(from)
    const result = reduceActivityLifecycle(current, command(action, current, {
      reason: ACTIVITY_STATE_REASONS.USER_PAUSE,
      metadata: { trigger: 'test' },
    }))

    expect(result.outcome).toBe('applied')
    expect(result.activity).toEqual({ ...current, state: to, version: 4 })
    expect(result.stateEvent).toEqual({
      activityId: current.id,
      previousState: from,
      newState: to,
      reason: ACTIVITY_STATE_REASONS.USER_PAUSE,
      occurredAt: BASE_TIME,
      recordedAt: BASE_TIME,
      source: ACTIVITY_SOURCES.LIVE_CAPTURE,
      installationId: 'installation-1',
      metadata: { trigger: 'test' },
      idempotencyKey: `key-${action}`,
    })
    expect(current).toEqual(activity(from))
  })

  it.each(idempotentCases)('%s + %s is idempotent', (state, action) => {
    const current = activity(state)
    const result = reduceActivityLifecycle(current, command(action, current))

    expect(result).toEqual({ outcome: 'idempotent', activity: current, stateEvent: null })
    expect(result.activity).toBe(current)
  })

  it('rejects every state/command pair absent from the transition table', () => {
    for (const state of Object.values(ACTIVITY_STATES)) {
      for (const action of Object.values(LIFECYCLE_COMMANDS)) {
        if (Object.prototype.hasOwnProperty.call(LIFECYCLE_TRANSITION_TABLE[state], action)) continue
        const current = activity(state)
        expect(() => reduceActivityLifecycle(current, command(action, current))).toThrow(
          expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_TRANSITION }),
        )
      }
    }
  })

  it('rejects stale expected state and version independently', () => {
    const current = activity(ACTIVITY_STATES.ACTIVE)
    expect(() => reduceActivityLifecycle(current, command(LIFECYCLE_COMMANDS.PAUSE, current, {
      expectedState: ACTIVITY_STATES.PAUSED,
    }))).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.STATE_CONFLICT }))
    expect(() => reduceActivityLifecycle(current, command(LIFECYCLE_COMMANDS.PAUSE, current, {
      expectedVersion: 2,
    }))).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.VERSION_CONFLICT }))
  })

  it.each(['occurredAt', 'recordedAt', 'installationId', 'idempotencyKey'])(
    'requires mutation field %s',
    (field) => {
      const current = activity(ACTIVITY_STATES.ACTIVE)
      expect(() => reduceActivityLifecycle(current, command(LIFECYCLE_COMMANDS.PAUSE, current, {
        [field]: '',
      }))).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_COMMAND }))
    },
  )

  it('rejects unknown sources, commands, activity states, types, and versions', () => {
    const current = activity(ACTIVITY_STATES.ACTIVE)
    expect(() => reduceActivityLifecycle(current, command(LIFECYCLE_COMMANDS.PAUSE, current, {
      source: 'browser_guess',
    }))).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_COMMAND }))
    expect(() => reduceActivityLifecycle(current, command('finish-ish', current))).toThrow(
      expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_COMMAND }),
    )
    for (const invalid of [activity('lost'), activity(ACTIVITY_STATES.ACTIVE, { type: 'other' }), activity(ACTIVITY_STATES.ACTIVE, { version: -1 })]) {
      expect(() => reduceActivityLifecycle(invalid, command(LIFECYCLE_COMMANDS.PAUSE, invalid))).toThrow(
        expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_ACTIVITY }),
      )
    }
  })
})

describe('draft creation and start planning', () => {
  it('creates a version-zero local draft', () => {
    expect(createDraftLifecycle({ id: 'draft-1', type: ACTIVITY_TYPES.PUTTING_REGIMEN })).toEqual({
      id: 'draft-1',
      type: ACTIVITY_TYPES.PUTTING_REGIMEN,
      state: ACTIVITY_STATES.DRAFT,
      version: 0,
    })
  })

  it('starts directly when no current activity exists', () => {
    const replacementActivity = createDraftLifecycle({ id: 'draft-2', type: ACTIVITY_TYPES.PUTTING_FREEFORM })
    expect(planActivityStart({ existingActivity: null, replacementActivity })).toEqual({
      kind: 'start',
      closeExisting: false,
      requiresConfirmation: false,
    })
  })

  it.each([ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED])(
    'atomically replaces a %s practice without confirmation',
    (state) => {
      const replacementActivity = createDraftLifecycle({ id: 'draft-2', type: ACTIVITY_TYPES.PUTTING_REGIMEN })
      expect(planActivityStart({ existingActivity: activity(state), replacementActivity })).toEqual({
        kind: 'replace_practice',
        closeExisting: true,
        requiresConfirmation: false,
      })
    },
  )

  it.each([ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED])(
    'requires confirmation before replacing a %s round',
    (state) => {
      const existingActivity = activity(state, { type: ACTIVITY_TYPES.DISC_GOLF_ROUND })
      const replacementActivity = createDraftLifecycle({ id: 'draft-2', type: ACTIVITY_TYPES.PUTTING_FREEFORM })
      expect(planActivityStart({ existingActivity, replacementActivity })).toEqual({
        kind: 'round_confirmation_required',
        closeExisting: false,
        closeExistingOnConfirm: true,
        requiresConfirmation: true,
      })
    },
  )

  it.each([ACTIVITY_STATES.DRAFT, ACTIVITY_STATES.COMPLETED, ACTIVITY_STATES.INCOMPLETE])(
    'does not treat %s as the current activity',
    (state) => {
      const replacementActivity = createDraftLifecycle({ id: 'draft-2', type: ACTIVITY_TYPES.PUTTING_FREEFORM })
      expect(planActivityStart({ existingActivity: activity(state), replacementActivity }).kind).toBe('start')
    },
  )

  it('rejects a non-draft replacement and self-replacement', () => {
    expect(() => planActivityStart({
      existingActivity: null,
      replacementActivity: activity(ACTIVITY_STATES.ACTIVE, { id: 'replacement' }),
    })).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_TRANSITION }))

    const replacementActivity = createDraftLifecycle({ id: 'same', type: ACTIVITY_TYPES.PUTTING_FREEFORM })
    expect(() => planActivityStart({
      existingActivity: activity(ACTIVITY_STATES.ACTIVE, { id: 'same' }),
      replacementActivity,
    })).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_TRANSITION }))
  })

  it('validates an existing record even when it does not look current', () => {
    const replacementActivity = createDraftLifecycle({ id: 'draft-2', type: ACTIVITY_TYPES.PUTTING_FREEFORM })
    expect(() => planActivityStart({
      existingActivity: activity('lost'),
      replacementActivity,
    })).toThrow(expect.objectContaining({ code: LIFECYCLE_ERROR_CODES.INVALID_ACTIVITY }))
  })
})

describe('central lifecycle policies', () => {
  it('auto-pauses only at or after the 60-second background grace', () => {
    expect(shouldAutoPause({ backgroundedAtMs: 1_000, nowMs: 1_000 + BACKGROUND_AUTO_PAUSE_GRACE_MS - 1 })).toBe(false)
    expect(shouldAutoPause({ backgroundedAtMs: 1_000, nowMs: 1_000 + BACKGROUND_AUTO_PAUSE_GRACE_MS })).toBe(true)
    expect(shouldAutoPause({ backgroundedAtMs: null, nowMs: 61_000 })).toBe(false)
  })

  it('allows replacement Undo only before the replacement has a meaningful fact', () => {
    expect(canUndoReplacement({ replacementHasMeaningfulFact: false })).toBe(true)
    expect(canUndoReplacement({ replacementHasMeaningfulFact: true })).toBe(false)
    expect(canUndoReplacement({})).toBe(false)
  })
})
