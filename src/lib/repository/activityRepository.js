import { liveQuery } from 'dexie'
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_STATES,
  ACTIVITY_TYPES,
  LIFECYCLE_COMMANDS,
  createDraftLifecycle,
  isCurrentActivityState,
  isTerminalActivityState,
  planActivityStart,
  reduceActivityLifecycle,
} from '../activityLifecycle'
import { db as defaultDb } from '../db/dexieDb'
import { ACTIVITY_OUTBOX_TABLE } from './activityOutbox'
import { HISTORY_RECOVERY_OUTBOX_TABLE } from './historyRecoveryOutbox'

export { ACTIVITY_OUTBOX_TABLE } from './activityOutbox'

export const ACTIVITY_REPOSITORY_ERROR_CODES = Object.freeze({
  ACTIVITY_NOT_FOUND: 'activity_not_found',
  ACTIVITY_ID_CONFLICT: 'activity_id_conflict',
  IDEMPOTENCY_KEY_CONFLICT: 'idempotency_key_conflict',
  INVALID_MUTATION: 'invalid_mutation',
  INVALID_ACTIVITY_STATE: 'invalid_activity_state',
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

function auditRow({ id, activity, action, mutation, previousValues, newValues }) {
  return {
    id,
    user_id: activity.user_id,
    entity_type: 'activity',
    entity_id: activity.id,
    action,
    occurred_at: mutation.occurredAt,
    recorded_at: mutation.recordedAt,
    source: mutation.source,
    source_reference: mutation.sourceReference ?? null,
    installation_id: mutation.installationId,
    previous_values: previousValues,
    new_values: newValues,
    reason: mutation.reason ?? null,
    schema_version: 1,
    idempotency_key: mutation.idempotencyKey,
    metadata: mutation.metadata ?? {},
  }
}

function historyOutboxRow({ op, payload, mutation, dependencyKey }) {
  return {
    table: HISTORY_RECOVERY_OUTBOX_TABLE,
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
  auditIdFactory = () => crypto.randomUUID(),
  faultInjector = null,
} = {}) {
  const tables = [database.activities, database.activityStateEvents, database.outbox]
  const historyTables = [database.activities, database.auditEvents, database.outbox]

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

  function validateHistoryMutation(mutation, { correction = false } = {}) {
    validateMutationEnvelope(mutation)
    if (!Number.isInteger(mutation.expectedVersion) || mutation.expectedVersion < 0) {
      fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, 'History mutation requires expectedVersion.')
    }
    if (correction && mutation.source !== ACTIVITY_SOURCES.MANUAL_CORRECTION) {
      fail(
        ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION,
        'Finalized practice correction requires manual_correction source.',
      )
    }
  }

  async function historyIdempotentResult(activityId, action, mutation, newValues) {
    const audit = await database.auditEvents.where('idempotency_key').equals(mutation.idempotencyKey).first()
    if (!audit) return null
    if (
      audit.entity_id !== activityId ||
      audit.action !== action ||
      JSON.stringify(audit.new_values) !== JSON.stringify(newValues)
    ) {
      fail(
        ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
        'Idempotency key was already used for another history operation.',
        { activityId, action, key: mutation.idempotencyKey },
      )
    }
    const pending = await database.outbox
      .where('[table+idempotencyKey]')
      .equals([HISTORY_RECOVERY_OUTBOX_TABLE, mutation.idempotencyKey])
      .first()
    return {
      outcome: 'idempotent',
      activity: await database.activities.get(activityId),
      auditEvent: audit,
      syncState: pending ? (pending.poison ? 'needs_attention' : 'pending') : 'synced',
      warnings: [],
    }
  }

  async function requireHistoryActivity(activityId, mutation, { allowHidden = true } = {}) {
    const activity = await database.activities.get(activityId)
    if (!activity) {
      fail(ACTIVITY_REPOSITORY_ERROR_CODES.ACTIVITY_NOT_FOUND, 'Activity was not found.', { activityId })
    }
    if (!isTerminalActivityState(activity.state) || (!allowHidden && activity.hidden_at)) {
      fail(
        ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_ACTIVITY_STATE,
        'History mutation requires a visible completed or incomplete activity.',
        { activityId, state: activity.state, hiddenAt: activity.hidden_at },
      )
    }
    if (activity.version !== mutation.expectedVersion) {
      fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, 'Activity version is stale.', {
        activityId,
        expectedVersion: mutation.expectedVersion,
        actualVersion: activity.version,
      })
    }
    return activity
  }

  async function applyHistoryMutation({ activity, action, op, mutation, previousValues, newValues, patch, payload }) {
    const event = auditRow({
      id: auditIdFactory(),
      activity,
      action,
      mutation,
      previousValues,
      newValues,
    })
    const nextActivity = {
      ...activity,
      ...patch,
      version: activity.version + 1,
      updated_at: mutation.recordedAt,
      last_history_idempotency_key: mutation.idempotencyKey,
    }
    const dependencyKey =
      activity.last_history_idempotency_key ??
      activity.last_lifecycle_idempotency_key ??
      activity.create_idempotency_key ??
      null

    await database.activities.put(nextActivity)
    injectFault('after_history_activity_write', { activity: nextActivity, mutation, action })
    await database.auditEvents.add(event)
    injectFault('after_audit_write', { activity: nextActivity, auditEvent: event, mutation, action })
    await database.outbox.add(
      historyOutboxRow({
        op,
        payload: { activity: nextActivity, auditEvent: event, mutation, ...payload },
        mutation,
        dependencyKey,
      }),
    )
    injectFault('after_history_outbox_write', { activity: nextActivity, auditEvent: event, mutation, action })

    return {
      outcome: 'applied',
      activity: nextActivity,
      auditEvent: event,
      syncState: 'pending',
      warnings: [],
    }
  }

  async function setHidden(activityId, hidden, mutation) {
    validateHistoryMutation(mutation)
    const action = hidden ? 'hide' : 'restore'
    const hiddenAt = hidden ? mutation.recordedAt : null
    const newValues = { hidden_at: hiddenAt }
    return database.transaction('rw', ...historyTables, async () => {
      const replay = await historyIdempotentResult(activityId, action, mutation, newValues)
      if (replay) return replay
      const activity = await requireHistoryActivity(activityId, mutation)
      if (Boolean(activity.hidden_at) === hidden) {
        return {
          outcome: 'idempotent',
          activity,
          auditEvent: null,
          syncState: 'local',
          warnings: [],
        }
      }
      return applyHistoryMutation({
        activity,
        action,
        op: 'set_visibility',
        mutation,
        previousValues: { hidden_at: activity.hidden_at ?? null },
        newValues,
        patch: { hidden_at: hiddenAt },
        payload: { hidden },
      })
    })
  }

  async function correctPracticeDetails(activityId, { previousNotes, previousTags, notes, tags }, mutation) {
    validateHistoryMutation(mutation, { correction: true })
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string' || !tag)) {
      fail(ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_MUTATION, 'Correction tags must be non-empty strings.')
    }
    const previousValues = { notes: previousNotes ?? null, tags: previousTags ?? [] }
    const newValues = { notes: notes ?? null, tags }
    return database.transaction('rw', ...historyTables, async () => {
      const replay = await historyIdempotentResult(
        activityId,
        'correct_practice_details',
        mutation,
        newValues,
      )
      if (replay) return replay
      const activity = await requireHistoryActivity(activityId, mutation, { allowHidden: false })
      if (![ACTIVITY_TYPES.PUTTING_FREEFORM, ACTIVITY_TYPES.PUTTING_REGIMEN].includes(activity.type)) {
        fail(
          ACTIVITY_REPOSITORY_ERROR_CODES.INVALID_ACTIVITY_STATE,
          'Only finalized practice details can be corrected.',
          { activityId, type: activity.type },
        )
      }
      if (JSON.stringify(previousValues) === JSON.stringify(newValues)) {
        return {
          outcome: 'idempotent',
          activity,
          auditEvent: null,
          syncState: 'local',
          warnings: [],
        }
      }
      return applyHistoryMutation({
        activity,
        action: 'correct_practice_details',
        op: 'correct_practice_details',
        mutation,
        previousValues,
        newValues,
        patch: {},
        payload: { notes: notes ?? null, tags },
      })
    })
  }

  async function hydrateActivities(remoteRows) {
    return database.transaction('rw', database.activities, database.outbox, async () => {
      const pending = await database.outbox.toArray()
      for (const remote of remoteRows) {
        const hasPending = pending.some((row) => row.payload?.activity?.id === remote.id)
        const local = await database.activities.get(remote.id)
        if (!hasPending && (!local || remote.version >= local.version)) {
          await database.activities.put(remote)
        }
      }
    })
  }

  async function listHistoryWithSync(userId, { includeHidden = false } = {}) {
    const [rows, pending] = await Promise.all([
      listHistory(userId, { includeHidden }),
      database.outbox.toArray(),
    ])
    return rows.map((row) => {
      const operations = pending.filter((operation) => operation.payload?.activity?.id === row.id)
      return {
        ...row,
        sync_state: operations.some((operation) => operation.poison)
          ? 'needs_attention'
          : operations.length
            ? 'pending'
            : 'synced',
      }
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
    hide: (activityId, mutation) => setHidden(activityId, true, mutation),
    restore: (activityId, mutation) => setHidden(activityId, false, mutation),
    correctPracticeDetails,
    hydrateActivities,
    getActive,
    getById,
    listHistory,
    listHistoryWithSync,
    subscribeToActive,
  }
}

export const activityRepository = createActivityRepository()
