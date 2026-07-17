import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATES,
  ACTIVITY_TYPES,
  LIFECYCLE_COMMANDS,
  isCurrentActivityState,
  isPracticeActivityType,
  isRoundActivityType,
} from './types'

export const LIFECYCLE_ERROR_CODES = Object.freeze({
  INVALID_ACTIVITY: 'invalid_activity',
  INVALID_COMMAND: 'invalid_command',
  INVALID_TRANSITION: 'invalid_transition',
  STATE_CONFLICT: 'state_conflict',
  VERSION_CONFLICT: 'version_conflict',
})

export class LifecycleTransitionError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'LifecycleTransitionError'
    this.code = code
    this.details = details
  }
}

const VALID_STATES = new Set(Object.values(ACTIVITY_STATES))
const VALID_TYPES = new Set(Object.values(ACTIVITY_TYPES))
const VALID_COMMANDS = new Set(Object.values(LIFECYCLE_COMMANDS))
const VALID_SOURCES = new Set(Object.values(ACTIVITY_SOURCES))

// `null` means the command is already satisfied and must not append another
// state event. Missing entries are invalid transitions.
export const LIFECYCLE_TRANSITION_TABLE = Object.freeze({
  [ACTIVITY_STATES.DRAFT]: Object.freeze({
    [LIFECYCLE_COMMANDS.START]: ACTIVITY_STATES.ACTIVE,
  }),
  [ACTIVITY_STATES.ACTIVE]: Object.freeze({
    [LIFECYCLE_COMMANDS.START]: null,
    [LIFECYCLE_COMMANDS.RESUME]: null,
    [LIFECYCLE_COMMANDS.PAUSE]: ACTIVITY_STATES.PAUSED,
    [LIFECYCLE_COMMANDS.FINALIZE_COMPLETED]: ACTIVITY_STATES.COMPLETED,
    [LIFECYCLE_COMMANDS.MARK_INCOMPLETE]: ACTIVITY_STATES.INCOMPLETE,
  }),
  [ACTIVITY_STATES.PAUSED]: Object.freeze({
    [LIFECYCLE_COMMANDS.PAUSE]: null,
    [LIFECYCLE_COMMANDS.RESUME]: ACTIVITY_STATES.ACTIVE,
    [LIFECYCLE_COMMANDS.FINALIZE_COMPLETED]: ACTIVITY_STATES.COMPLETED,
    [LIFECYCLE_COMMANDS.MARK_INCOMPLETE]: ACTIVITY_STATES.INCOMPLETE,
  }),
  [ACTIVITY_STATES.COMPLETED]: Object.freeze({
    [LIFECYCLE_COMMANDS.FINALIZE_COMPLETED]: null,
  }),
  [ACTIVITY_STATES.INCOMPLETE]: Object.freeze({
    [LIFECYCLE_COMMANDS.MARK_INCOMPLETE]: null,
  }),
})

function fail(code, message, details) {
  throw new LifecycleTransitionError(code, message, details)
}

function validateActivity(activity) {
  if (!activity || typeof activity.id !== 'string' || !activity.id) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_ACTIVITY, 'Activity requires a non-empty id.')
  }
  if (!VALID_TYPES.has(activity.type) || !VALID_STATES.has(activity.state)) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_ACTIVITY, 'Activity has an unsupported type or state.', {
      type: activity.type,
      state: activity.state,
    })
  }
  if (!Number.isInteger(activity.version) || activity.version < 0) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_ACTIVITY, 'Activity version must be a non-negative integer.')
  }
}

function validateCommand(command) {
  if (!command || !VALID_COMMANDS.has(command.type)) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_COMMAND, 'Lifecycle command is unsupported.', { type: command?.type })
  }
  if (!VALID_SOURCES.has(command.source)) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_COMMAND, 'Lifecycle command source is unsupported.', {
      source: command.source,
    })
  }
  for (const field of ['occurredAt', 'recordedAt', 'installationId', 'idempotencyKey']) {
    if (typeof command[field] !== 'string' || !command[field]) {
      fail(LIFECYCLE_ERROR_CODES.INVALID_COMMAND, `Lifecycle command requires ${field}.`)
    }
  }
}

export function createDraftLifecycle({ id, type }) {
  const activity = { id, type, state: ACTIVITY_STATES.DRAFT, version: 0 }
  validateActivity(activity)
  return activity
}

export function reduceActivityLifecycle(activity, command) {
  validateActivity(activity)
  validateCommand(command)

  if (command.expectedState !== activity.state) {
    fail(LIFECYCLE_ERROR_CODES.STATE_CONFLICT, 'Activity state no longer matches the expected state.', {
      expected: command.expectedState,
      actual: activity.state,
    })
  }
  if (command.expectedVersion !== activity.version) {
    fail(LIFECYCLE_ERROR_CODES.VERSION_CONFLICT, 'Activity version no longer matches the expected version.', {
      expected: command.expectedVersion,
      actual: activity.version,
    })
  }

  const stateCommands = LIFECYCLE_TRANSITION_TABLE[activity.state]
  if (!Object.prototype.hasOwnProperty.call(stateCommands, command.type)) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_TRANSITION, `Cannot ${command.type} an activity in ${activity.state}.`, {
      state: activity.state,
      command: command.type,
    })
  }

  const nextState = stateCommands[command.type]
  if (nextState === null) {
    return { outcome: 'idempotent', activity, stateEvent: null }
  }

  const nextActivity = { ...activity, state: nextState, version: activity.version + 1 }
  const stateEvent = {
    activityId: activity.id,
    previousState: activity.state,
    newState: nextState,
    reason: command.reason ?? null,
    occurredAt: command.occurredAt,
    recordedAt: command.recordedAt,
    source: command.source,
    installationId: command.installationId,
    metadata: command.metadata ?? {},
    idempotencyKey: command.idempotencyKey,
  }

  return { outcome: 'applied', activity: nextActivity, stateEvent }
}

export function planActivityStart({ existingActivity, replacementActivity }) {
  validateActivity(replacementActivity)
  if (replacementActivity.state !== ACTIVITY_STATES.DRAFT) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_TRANSITION, 'A replacement must begin as a draft.', {
      state: replacementActivity.state,
    })
  }

  if (!existingActivity) {
    return { kind: 'start', closeExisting: false, requiresConfirmation: false }
  }

  validateActivity(existingActivity)
  if (!isCurrentActivityState(existingActivity.state)) {
    return { kind: 'start', closeExisting: false, requiresConfirmation: false }
  }
  if (existingActivity.id === replacementActivity.id) {
    fail(LIFECYCLE_ERROR_CODES.INVALID_TRANSITION, 'An activity cannot replace itself.')
  }

  if (isRoundActivityType(existingActivity.type)) {
    return {
      kind: 'round_confirmation_required',
      closeExisting: false,
      closeExistingOnConfirm: true,
      requiresConfirmation: true,
    }
  }

  if (isPracticeActivityType(existingActivity.type)) {
    return { kind: 'replace_practice', closeExisting: true, requiresConfirmation: false }
  }

  fail(LIFECYCLE_ERROR_CODES.INVALID_ACTIVITY, 'Current activity type has no replacement policy.', {
    type: existingActivity.type,
  })
}
