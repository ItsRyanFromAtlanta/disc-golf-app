import { liveQuery } from 'dexie'
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_STATES,
  LIFECYCLE_COMMANDS,
  createDraftLifecycle,
  isCurrentActivityState,
  isTerminalActivityState,
  planActivityStart,
  reduceActivityLifecycle,
} from '../activityLifecycle'
import { db as defaultDb } from '../db/dexieDb'
import { ACTIVITY_OUTBOX_TABLE } from './activityOutbox'

export { ACTIVITY_OUTBOX_TABLE } from './activityOutbox'

export const ACTIVITY_REPOSITORY_ERROR_CODES = Object.freeze({
  ACTIVITY_NOT_FOUND: 'activity_not_found',
  ACTIVITY_ID_CONFLICT: 'activity_id_conflict',
  IDEMPOTENCY_KEY_CONFLICT: 'idempotency_key_conflict',
  INVALID_MUTATION: 'invalid_mutation',
  SINGLE_ACTIVE_INVARIANT: 'single_active_invariant',
})

export class ActivityRepositoryError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ActivityRepositoryError'
    this.code = code
    this.details = details
  }
}

const VALID_SOURCES = new Set(Object.values(ACTIVITY_SOURCES))

function fail(code, message, details) {
  throw new ActivityRepositoryError(code, message, details)
}

function validateMutationEnvelope(mutation, { create = false } = {}) {
  if (!mutation || typeof mutation !== 'object') {
    fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, 'Mutation envelope is required.')
  }
  for (const field of ['occurredAt', 'recordedAt', 'source', 'installationId', 'idempotencyKey']) {
    if (typeof mutation[field] !== 'string' || !mutation[field]) {
      fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, `Mutation requires ${field}.`)
    }
  }
  if (Number.isNaN(Date.parse(mutation.occurredAt)) || Number.isNaN(Date.parse(mutation.recordedAt))) {
    fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, 'Mutation timestamps must be valid dates.')
  }
  if (!VALID_SOURCES.has(mutation.source)) {
    fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, 'Mutation source is unsupported.', {
      source: mutation.source,
    })
  }
  if (create && (mutation.expectedState !== null || mutation.expectedVersion !== null)) {
    fail(
      ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION,
      'Draft creation expects null state and version preconditions.',
    )
  }
}

function toEventRow(event, { id, userId }) {
  return {
    id,
    activity_id: event.activityId,
    user_id: userId,
    previous_state: event.previousState,
    new_state: event.newState,
    reason: event.reason,
    occurred_at: event.occurredAt,
    recorded_at: event.recordedAt,
    source: event.source,
    installation_id: event.installationId,
    metadata: event.metadata,
    idempotency_key: event.idempotencyKey,
  }
}

function outboxRow({ op, payload, mutation, dependencyKey = null }) {
  return {
    table: ACTIVITY_OUTBOX_TABLE,
    op,
    payload,
    createdAt: Date.parse(mutation.recordedAt),
    idempotencyKey: mutation.idempotencyKey,
    dependencyKey,
    attemptCount: 0,
    lastErrorClass: null,
    nextRetryAt: null,
    poison: false,
  }
}

export function createActivityRepository({
  database = defaultDb,
  eventIdFactory = () => crypto.randomUUID(),
  faultInjector = null,
} = {}) {
  const tables = [database.activities, database.activityStateEvents, database.outbox]

  function injectFault(stage, context) {
    faultInjector?.(stage, context)
  }

  async function currentRows(userId) {
    const rows = await database.activities.where('user_id').equals(userId).toArray()
    return rows.filter((row) => isCurrentActivityState(row.state))
  }

  async function requireSingleCurrent(userId) {
    const rows = await currentRows(userId)
    if (rows.length > 1) {
      fail(
        ACTIVITY_REPOSITORY_ERROR_CODES.SINGLE_ACTIVE_INVARIANT,
        'More than one active or paused activity exists for this user.',
        { userId, activityIds: rows.map((row) => row.id) },
      )
    }
    return rows[0] ?? null
  }

  async function eventForIdempotencyKey(key) {
    return database.activityStateEvents.where('idempotency_key').equals(key).first()
  }

  async function outboxForIdempotencyKey(key) {
    return database.outbox
      .where('[table+idempotencyKey]')
      .equals([ACTIVITY_OUTBOX_TABLE, key])
      .first()
  }

  async function idempotentTransitionResult(activityId, key) {
    const event = await eventForIdempotencyKey(key)
    const existingOutbox = await outboxForIdempotencyKey(key)
    if (!event) {
      if (!existingOutbox) return null
      fail(
        ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
        'Idempotency key was already used for a different lifecycle operation.',
        { key, activityId, existingOperation: existingOutbox.op },
      )
    }
    if (event.activity_id !== activityId) {
      fail(
        ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
        'Idempotency key was already used for another activity.',
        { key, activityId, existingActivityId: event.activity_id },
      )
    }
    return {
      outcome: 'idempotent',
      activity: await database.activities.get(activityId),
      stateEvent: event,
      replacedActivity: null,
      syncState: existingOutbox ? 'pending' : 'synced',
      warnings: [],
    }
  }

  async function queueTransition(activity, eventRow, mutation, dependencyKey) {
    await database.outbox.add(
      outboxRow({
        op: 'transition',
        payload: { activity, stateEvent: eventRow, mutation },
        mutation,
        dependencyKey,
      }),
    )
  }

  async function applyTransition(activity, command) {
    const replay = await idempotentTransitionResult(activity.id, command.idempotencyKey)
    if (replay) return replay

    const reduced = reduceActivityLifecycle(activity, command)
    if (reduced.outcome === 'idempotent') {
      return {
        ...reduced,
        replacedActivity: null,
        syncState: 'local',
        warnings: [],
      }
    }

    const nextActivity = {
      ...reduced.activity,
      updated_at: command.recordedAt,
      last_lifecycle_idempotency_key: command.idempotencyKey,
      has_meaningful_fact:
        command.type === LIFECYCLE_COMMANDS.START ? true : reduced.activity.has_meaningful_fact,
    }
    const eventRow = toEventRow(reduced.stateEvent, { id: eventIdFactory(), userId: activity.user_id })

    await database.activities.put(nextActivity)
    injectFault('after_activity_write', { activity: nextActivity, command })
    await database.activityStateEvents.add(eventRow)
    injectFault('after_state_event_write', { activity: nextActivity, stateEvent: eventRow, command })
    await queueTransition(
      nextActivity,
      eventRow,
      command,
      activity.last_lifecycle_idempotency_key ?? activity.create_idempotency_key ?? null,
    )
    injectFault('after_outbox_write', { activity: nextActivity, stateEvent: eventRow, command })

    return {
      outcome: 'applied',
      activity: nextActivity,
      stateEvent: eventRow,
      replacedActivity: null,
      syncState: 'pending',
      warnings: [],
    }
  }

  async function createDraft({ id, userId, type, mutation, metadata = {} }) {
    validateMutationEnvelope(mutation, { create: true })
    return database.transaction('rw', ...tables, async () => {
      const existing = await database.activities.get(id)
      if (existing) {
        if (existing.user_id !== userId || existing.type !== type) {
          fail(ACTIVITY_REPOSITORY_ERROR_CODES.ACTIVITY_ID_CONFLICT, 'Activity id is already in use.', {
            id,
          })
        }
        if (existing.create_idempotency_key !== mutation.idempotencyKey) {
          fail(
            ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
            'Draft creation retry must reuse its original idempotency key.',
            { id, expectedKey: existing.create_idempotency_key, actualKey: mutation.idempotencyKey },
          )
        }
        const pendingCreate = await outboxForIdempotencyKey(mutation.idempotencyKey)
        return {
          outcome: 'idempotent',
          activity: existing,
          stateEvent: null,
          replacedActivity: null,
          syncState: pendingCreate ? 'pending' : 'synced',
          warnings: [],
        }
      }

      const existingOutbox = await outboxForIdempotencyKey(mutation.idempotencyKey)
      if (existingOutbox) {
        fail(
          ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
          'Idempotency key was already used for another draft.',
          { key: mutation.idempotencyKey, id },
        )
      }

      const lifecycle = createDraftLifecycle({ id, type })
      const activity = {
        ...lifecycle,
        user_id: userId,
        hidden_at: null,
        needs_review: false,
        has_meaningful_fact: false,
        metadata,
        created_at: mutation.recordedAt,
        updated_at: mutation.recordedAt,
        create_idempotency_key: mutation.idempotencyKey,
        last_lifecycle_idempotency_key: mutation.idempotencyKey,
      }
      await database.activities.add(activity)
      injectFault('after_activity_write', { activity, mutation })
      await database.outbox.add(
        outboxRow({ op: 'create_draft', payload: { activity, mutation }, mutation, dependencyKey: null }),
      )
      injectFault('after_outbox_write', { activity, mutation })

      return {
        outcome: 'applied',
        activity,
        stateEvent: null,
        replacedActivity: null,
        syncState: 'pending',
        warnings: [],
      }
    })
  }

  async function start(activityId, mutation, { confirmRoundReplacement = false } = {}) {
    validateMutationEnvelope(mutation)
    return database.transaction('rw', ...tables, async () => {
      const replay = await idempotentTransitionResult(activityId, mutation.idempotencyKey)
      if (replay) return replay

      const replacement = await database.activities.get(activityId)
      if (!replacement) {
        fail(ACTIVITY_REPOSITORY_ERROR_CODES.ACTIVITY_NOT_FOUND, 'Activity was not found.', { activityId })
      }

      if (replacement.state !== ACTIVITY_STATES.DRAFT) {
        return applyTransition(replacement, { ...mutation, type: LIFECYCLE_COMMANDS.START })
      }

      const existing = await requireSingleCurrent(replacement.user_id)
      const plan = planActivityStart({ existingActivity: existing, replacementActivity: replacement })

      if (plan.requiresConfirmation && !confirmRoundReplacement) {
        return {
          outcome: 'confirmation_required',
          activity: replacement,
          stateEvent: null,
          replacedActivity: existing,
          syncState: 'local',
          warnings: ['round_replacement_confirmation_required'],
        }
      }

      let replacedActivity = null
      if (existing && plan.closeExisting) {
        const closeResult = await applyTransition(existing, {
          ...mutation,
          type: LIFECYCLE_COMMANDS.MARK_INCOMPLETE,
          expectedState: existing.state,
          expectedVersion: existing.version,
          reason: ACTIVITY_STATE_REASONS.REPLACED_BY_ACTIVITY,
          metadata: { ...(mutation.metadata ?? {}), replacementActivityId: replacement.id },
          idempotencyKey: `${mutation.idempotencyKey}:replace:${existing.id}`,
        })
        replacedActivity = closeResult.activity
      } else if (existing && plan.closeExistingOnConfirm && confirmRoundReplacement) {
        const closeResult = await applyTransition(existing, {
          ...mutation,
          type: LIFECYCLE_COMMANDS.MARK_INCOMPLETE,
          expectedState: existing.state,
          expectedVersion: existing.version,
          reason: ACTIVITY_STATE_REASONS.ROUND_REPLACEMENT_CONFIRMED,
          metadata: { ...(mutation.metadata ?? {}), replacementActivityId: replacement.id },
          idempotencyKey: `${mutation.idempotencyKey}:replace:${existing.id}`,
        })
        replacedActivity = closeResult.activity
      }

      const started = await applyTransition(replacement, {
        ...mutation,
        type: LIFECYCLE_COMMANDS.START,
        // Preserve the confirmation decision in the lifecycle envelope so
        // the ordered remote outbox can replay the same round-replacement
        // command after an offline restart.
        confirmRoundReplacement: Boolean(confirmRoundReplacement),
      })
      return {
        ...started,
        replacedActivity,
        warnings: replacedActivity ? ['previous_activity_marked_incomplete'] : [],
      }
    })
  }

  async function transition(activityId, type, mutation) {
    validateMutationEnvelope(mutation)
    return database.transaction('rw', ...tables, async () => {
      const replay = await idempotentTransitionResult(activityId, mutation.idempotencyKey)
      if (replay) return replay
      const activity = await database.activities.get(activityId)
      if (!activity) {
        fail(ACTIVITY_REPOSITORY_ERROR_CODES.ACTIVITY_NOT_FOUND, 'Activity was not found.', { activityId })
      }
      return applyTransition(activity, { ...mutation, type })
    })
  }

  async function getActive(userId) {
    return requireSingleCurrent(userId)
  }

  async function getById(activityId) {
    return (await database.activities.get(activityId)) ?? null
  }

  async function listHistory(userId, { includeHidden = false } = {}) {
    const rows = await database.activities.where('user_id').equals(userId).toArray()
    return rows
      .filter((row) => isTerminalActivityState(row.state) && (includeHidden || !row.hidden_at))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  function subscribeToActive(userId, listener, onError = () => {}) {
    return liveQuery(() => getActive(userId)).subscribe({ next: listener, error: onError })
  }

  return {
    createDraft,
    start,
    pause: (activityId, mutation) => transition(activityId, LIFECYCLE_COMMANDS.PAUSE, mutation),
    resume: (activityId, mutation) => transition(activityId, LIFECYCLE_COMMANDS.RESUME, mutation),
    finalize: (activityId, mutation) =>
      transition(activityId, LIFECYCLE_COMMANDS.FINALIZE_COMPLETED, mutation),
    markIncomplete: (activityId, mutation) =>
      transition(activityId, LIFECYCLE_COMMANDS.MARK_INCOMPLETE, mutation),
    getActive,
    getById,
    listHistory,
    subscribeToActive,
  }
}

export const activityRepository = createActivityRepository()
