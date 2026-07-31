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
    // draft -> completed, without ever passing through active.
    //
    // Added 2026-07-31 to close DEFECT_REGISTER D-03. A round started while
    // another activity is current deliberately leaves its lifecycle parent a
    // draft (`roundRepository.ensureRoundActivity`) so the single-active
    // invariant is not bypassed. Before this entry that state was terminal in
    // practice: finalization refused anything but active/paused, so the parent
    // could never reach `completed`, and `weeklyReportRepository` admits only
    // completed activities. The round row itself read `completed`, so every
    // screen except the weekly report showed a finished round. The work was
    // done and permanently unreportable.
    //
    // Routing it through `active` first — the obvious fix, and the one the
    // register proposed — is NOT safe. `start` on a draft is exactly the
    // command the replacement flow hangs off: the RPC takes any other
    // active/paused activity for that user and marks it `incomplete`
    // (`20260712195448_phase_a_activity_lifecycle_rpc.sql`). Finalizing an old
    // round would then silently close whatever the player currently has live.
    // That trades a reporting bug for a data-integrity one.
    //
    // Going straight to `completed` cannot do that, because
    // `activities_one_current_per_user_idx` only constrains `active`/`paused` —
    // this transition never enters either, so it has nothing to replace and no
    // invariant to bypass. Finalizing is always user-initiated, so it is a
    // legitimate assertion that the activity happened; the caller carries that
    // responsibility, as it already does for every other finalize.
    [LIFECYCLE_COMMANDS.FINALIZE_COMPLETED]: ACTIVITY_STATES.COMPLETED,
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

/**
 * § 1: starting an activity while a *round* is current requires the user's
 * confirmation, because the round is what gets closed as incomplete.
 *
 * Exported so a launcher can ask the question before it flips any UI state,
 * while `planActivityStart` below stays the authority that enforces it. One
 * rule, two callers — a launcher that reimplemented this check could drift out
 * of agreement with the repository and let a start through that the repository
 * then refuses, which is precisely the failure this codebase already had.
 */
export function requiresRoundReplacementConfirmation(existingActivity) {
  if (!existingActivity) return false
  if (!isCurrentActivityState(existingActivity.state)) return false
  return isRoundActivityType(existingActivity.type)
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

  if (requiresRoundReplacementConfirmation(existingActivity)) {
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
