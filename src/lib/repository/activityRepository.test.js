import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITY_SOURCES, ACTIVITY_STATES, ACTIVITY_TYPES } from '../activityLifecycle'
import { createAppDatabase } from '../db/dexieDb'
import { createActivityOutbox } from './activityOutbox'
import {
  ACTIVITY_OUTBOX_TABLE,
  ACTIVITY_REPOSITORY_ERROR_CODES,
  createActivityRepository,
} from './activityRepository'

const USER_ID = 'user-1'
const TIME = '2026-07-12T12:00:00.000Z'

function mutation(idempotencyKey, expectedState, expectedVersion, overrides = {}) {
  return {
    expectedState,
    expectedVersion,
    occurredAt: TIME,
    recordedAt: TIME,
    source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    installationId: 'installation-1',
    idempotencyKey,
    ...overrides,
  }
}

describe('activityRepository', () => {
  let database
  let repository
  let eventSequence

  beforeEach(async () => {
    database = createAppDatabase(`ActivityRepositoryTest-${crypto.randomUUID()}`)
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

  async function createDraft(id, type = ACTIVITY_TYPES.PUTTING_FREEFORM) {
    return repository.createDraft({
      id,
      userId: USER_ID,
      type,
      mutation: mutation(`create-${id}`, null, null),
    })
  }

  async function startDraft(id, key = `start-${id}`, options) {
    return repository.start(id, mutation(key, ACTIVITY_STATES.DRAFT, 0), options)
  }

  it('creates a local draft and a diagnostic-rich outbox entry in one transaction', async () => {
    const result = await createDraft('activity-1')

    expect(result.activity).toMatchObject({
      id: 'activity-1',
      user_id: USER_ID,
      state: ACTIVITY_STATES.DRAFT,
      version: 0,
      has_meaningful_fact: false,
    })
    expect(await database.activityStateEvents.count()).toBe(0)
    expect(await database.outbox.toArray()).toEqual([
      expect.objectContaining({
        table: ACTIVITY_OUTBOX_TABLE,
        op: 'create_draft',
        idempotencyKey: 'create-activity-1',
        dependencyKey: null,
        attemptCount: 0,
        lastErrorClass: null,
        nextRetryAt: null,
        poison: false,
        payload: expect.objectContaining({
          mutation: expect.objectContaining({ expectedState: null, expectedVersion: null }),
        }),
      }),
    ])
  })

  it('starts, pauses, resumes, and finalizes with append-only events', async () => {
    await createDraft('activity-1')
    const started = await startDraft('activity-1')
    const paused = await repository.pause(
      'activity-1',
      mutation('pause-1', ACTIVITY_STATES.ACTIVE, started.activity.version),
    )
    const resumed = await repository.resume(
      'activity-1',
      mutation('resume-1', ACTIVITY_STATES.PAUSED, paused.activity.version),
    )
    const finalized = await repository.finalize(
      'activity-1',
      mutation('finalize-1', ACTIVITY_STATES.ACTIVE, resumed.activity.version),
    )

    expect(finalized.activity.state).toBe(ACTIVITY_STATES.COMPLETED)
    expect(finalized.activity.version).toBe(4)
    expect(await database.activityStateEvents.count()).toBe(4)
    expect((await database.activityStateEvents.toArray()).map((event) => event.new_state)).toEqual([
      ACTIVITY_STATES.ACTIVE,
      ACTIVITY_STATES.PAUSED,
      ACTIVITY_STATES.ACTIVE,
      ACTIVITY_STATES.COMPLETED,
    ])
  })

  it('atomically marks a prior practice incomplete when a replacement starts', async () => {
    await createDraft('practice-1')
    await startDraft('practice-1')
    await createDraft('practice-2', ACTIVITY_TYPES.PUTTING_REGIMEN)

    const result = await startDraft('practice-2')

    expect(result.activity.state).toBe(ACTIVITY_STATES.ACTIVE)
    expect(result.replacedActivity).toMatchObject({ id: 'practice-1', state: ACTIVITY_STATES.INCOMPLETE })
    expect(await repository.getActive(USER_ID)).toMatchObject({ id: 'practice-2' })
    expect(await database.activityStateEvents.count()).toBe(3)
  })

  it('rolls back both sides when replacement start fails after closing the prior practice', async () => {
    await createDraft('practice-1')
    await startDraft('practice-1')
    await createDraft('practice-2')
    const eventCount = await database.activityStateEvents.count()
    const outboxCount = await database.outbox.count()
    const faultingRepository = createActivityRepository({
      database,
      eventIdFactory: () => `replacement-event-${++eventSequence}`,
      faultInjector: (stage, context) => {
        if (
          stage === 'after_activity_write' &&
          context.command?.idempotencyKey === 'start-practice-2'
        ) {
          throw new Error('replacement start crashed')
        }
      },
    })

    await expect(
      faultingRepository.start(
        'practice-2',
        mutation('start-practice-2', ACTIVITY_STATES.DRAFT, 0),
      ),
    ).rejects.toThrow('replacement start crashed')

    expect(await repository.getById('practice-1')).toMatchObject({ state: ACTIVITY_STATES.ACTIVE })
    expect(await repository.getById('practice-2')).toMatchObject({ state: ACTIVITY_STATES.DRAFT })
    expect(await database.activityStateEvents.count()).toBe(eventCount)
    expect(await database.outbox.count()).toBe(outboxCount)
  })

  it('does not change an active round until replacement is explicitly confirmed', async () => {
    await createDraft('round-1', ACTIVITY_TYPES.DISC_GOLF_ROUND)
    await startDraft('round-1')
    await createDraft('practice-1')

    const beforeEvents = await database.activityStateEvents.count()
    const pending = await startDraft('practice-1')
    expect(pending.outcome).toBe('confirmation_required')
    expect(await repository.getActive(USER_ID)).toMatchObject({ id: 'round-1', state: ACTIVITY_STATES.ACTIVE })
    expect(await database.activityStateEvents.count()).toBe(beforeEvents)

    const confirmed = await startDraft('practice-1', 'start-practice-1', { confirmRoundReplacement: true })
    expect(confirmed.activity.state).toBe(ACTIVITY_STATES.ACTIVE)
    expect(confirmed.replacedActivity).toMatchObject({ id: 'round-1', state: ACTIVITY_STATES.INCOMPLETE })
  })

  it('serializes concurrent starts so only one activity remains current', async () => {
    await createDraft('practice-1')
    await createDraft('practice-2')

    await Promise.all([startDraft('practice-1'), startDraft('practice-2')])

    const rows = await database.activities.where('user_id').equals(USER_ID).toArray()
    expect(rows.filter((row) => [ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED].includes(row.state))).toHaveLength(1)
    expect(rows.filter((row) => row.state === ACTIVITY_STATES.INCOMPLETE)).toHaveLength(1)
  })

  it('deduplicates a retried transition before checking stale preconditions', async () => {
    await createDraft('activity-1')
    const startMutation = mutation('stable-start-key', ACTIVITY_STATES.DRAFT, 0)
    const first = await repository.start('activity-1', startMutation)
    const retry = await repository.start('activity-1', startMutation)

    expect(first.outcome).toBe('applied')
    expect(retry.outcome).toBe('idempotent')
    expect(retry.activity.state).toBe(ACTIVITY_STATES.ACTIVE)
    expect(await database.activityStateEvents.count()).toBe(1)
    expect((await database.outbox.toArray()).filter((row) => row.op === 'transition')).toHaveLength(1)
    expect((await database.outbox.toArray()).find((row) => row.op === 'transition').payload.mutation).toMatchObject({
      expectedState: ACTIVITY_STATES.DRAFT,
      expectedVersion: 0,
      idempotencyKey: 'stable-start-key',
    })
  })

  it('reports an acknowledged idempotent retry as synced', async () => {
    await createDraft('activity-1')
    const startMutation = mutation('stable-start-key', ACTIVITY_STATES.DRAFT, 0)
    await repository.start('activity-1', startMutation)
    const outbox = createActivityOutbox({ database })
    const transitionRow = (await database.outbox.toArray()).find(
      (row) => row.idempotencyKey === 'stable-start-key',
    )
    await outbox.acknowledge(transitionRow.id)

    await expect(repository.start('activity-1', startMutation)).resolves.toMatchObject({
      outcome: 'idempotent',
      syncState: 'synced',
    })
  })

  it('rejects reusing an idempotency key for another lifecycle operation', async () => {
    await createDraft('activity-1')
    await expect(
      repository.createDraft({
        id: 'activity-2',
        userId: USER_ID,
        type: ACTIVITY_TYPES.PUTTING_FREEFORM,
        mutation: mutation('create-activity-1', null, null),
      }),
    ).rejects.toMatchObject({ code: ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT })

    await expect(
      repository.start('activity-1', mutation('create-activity-1', ACTIVITY_STATES.DRAFT, 0)),
    ).rejects.toMatchObject({ code: ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT })

    await expect(
      repository.createDraft({
        id: 'activity-1',
        userId: USER_ID,
        type: ACTIVITY_TYPES.PUTTING_FREEFORM,
        mutation: mutation('different-create-key', null, null),
      }),
    ).rejects.toMatchObject({ code: ACTIVITY_REPOSITORY_ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT })
  })

  it.each(['after_activity_write', 'after_state_event_write', 'after_outbox_write'])(
    'rolls back activity, event, and outbox writes when interrupted at %s',
    async (faultStage) => {
    await createDraft('activity-1')
    const faultingRepository = createActivityRepository({
      database,
      eventIdFactory: () => 'fault-event',
      faultInjector: (stage, context) => {
        if (stage === faultStage && context.command?.type === 'start') {
          throw new Error('simulated crash')
        }
      },
    })

    await expect(
      faultingRepository.start('activity-1', mutation('start-with-crash', ACTIVITY_STATES.DRAFT, 0)),
    ).rejects.toThrow('simulated crash')

    expect(await repository.getById('activity-1')).toMatchObject({ state: ACTIVITY_STATES.DRAFT, version: 0 })
    expect(await database.activityStateEvents.count()).toBe(0)
    expect((await database.outbox.toArray()).map((row) => row.op)).toEqual(['create_draft'])
    },
  )

  it('releases dependent outbox operations in lifecycle order and records retry diagnostics', async () => {
    await createDraft('activity-1')
    const started = await startDraft('activity-1')
    await repository.pause(
      'activity-1',
      mutation('pause-activity-1', ACTIVITY_STATES.ACTIVE, started.activity.version),
    )
    const outbox = createActivityOutbox({ database })

    let ready = await outbox.listReady(Date.parse(TIME))
    expect(ready.map((row) => row.idempotencyKey)).toEqual(['create-activity-1'])
    await outbox.acknowledge(ready[0].id)

    ready = await outbox.listReady(Date.parse(TIME))
    expect(ready.map((row) => row.idempotencyKey)).toEqual(['start-activity-1'])
    await outbox.recordFailure(ready[0].id, {
      errorClass: 'network',
      nextRetryAt: Date.parse(TIME) + 10_000,
    })
    expect(await outbox.listReady(Date.parse(TIME))).toEqual([])

    ready = await outbox.listReady(Date.parse(TIME) + 10_000)
    expect(ready[0]).toMatchObject({ attemptCount: 1, lastErrorClass: 'network' })
    await outbox.acknowledge(ready[0].id)

    ready = await outbox.listReady(Date.parse(TIME) + 10_000)
    expect(ready.map((row) => row.idempotencyKey)).toEqual(['pause-activity-1'])
    await outbox.recordFailure(ready[0].id, {
      errorClass: 'validation',
      nextRetryAt: null,
      poison: true,
    })
    expect(await outbox.listReady(Date.parse(TIME) + 20_000)).toEqual([])
  })

  it('surfaces corrupted local state instead of choosing between two current activities', async () => {
    await createDraft('activity-1')
    await createDraft('activity-2')
    await database.activities.update('activity-1', { state: ACTIVITY_STATES.ACTIVE })
    await database.activities.update('activity-2', { state: ACTIVITY_STATES.PAUSED })

    await expect(repository.getActive(USER_ID)).rejects.toMatchObject({
      code: ACTIVITY_REPOSITORY_ERROR_CODES.SINGLE_ACTIVE_INVARIANT,
    })
  })

  it('lists non-draft visible history newest first', async () => {
    await createDraft('older')
    await startDraft('older')
    await repository.finalize('older', mutation('finish-older', ACTIVITY_STATES.ACTIVE, 1, {
      recordedAt: '2026-07-12T12:01:00.000Z',
    }))
    await createDraft('newer')
    await startDraft('newer')
    await repository.markIncomplete('newer', mutation('finish-newer', ACTIVITY_STATES.ACTIVE, 1, {
      recordedAt: '2026-07-12T12:02:00.000Z',
    }))
    await database.activities.update('older', { hidden_at: TIME })
    await createDraft('currently-active')
    await startDraft('currently-active')

    expect((await repository.listHistory(USER_ID)).map((row) => row.id)).toEqual(['newer'])
    expect((await repository.listHistory(USER_ID, { includeHidden: true })).map((row) => row.id)).toEqual([
      'newer',
      'older',
    ])
  })

  it('publishes active activity changes through a Dexie live query', async () => {
    let subscription
    const observed = new Promise((resolve, reject) => {
      subscription = repository.subscribeToActive(
        USER_ID,
        (activity) => {
          if (activity?.id === 'activity-1') resolve(activity)
        },
        reject,
      )
    })

    await createDraft('activity-1')
    await startDraft('activity-1')
    await expect(observed).resolves.toMatchObject({ id: 'activity-1', state: ACTIVITY_STATES.ACTIVE })
    subscription.unsubscribe()
  })

  it('hides and restores terminal activity with atomic local audit and outbox rows', async () => {
    await createDraft('activity-1')
    await startDraft('activity-1')
    const completed = await repository.finalize(
      'activity-1',
      mutation('finish-1', ACTIVITY_STATES.ACTIVE, 1),
    )

    const hidden = await repository.hide(
      'activity-1',
      mutation('hide-1', null, completed.activity.version, {
        source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
      }),
    )
    expect(hidden).toMatchObject({ outcome: 'applied', syncState: 'pending' })
    expect(hidden.activity).toMatchObject({ hidden_at: TIME, version: 3 })
    expect(hidden.auditEvent).toMatchObject({ action: 'hide', new_values: { hidden_at: TIME } })
    expect(await repository.listHistory(USER_ID)).toEqual([])

    const restored = await repository.restore(
      'activity-1',
      mutation('restore-1', null, hidden.activity.version, {
        source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
      }),
    )
    expect(restored.activity).toMatchObject({ hidden_at: null, version: 4 })
    expect((await database.auditEvents.toArray()).map((row) => row.action)).toEqual(['hide', 'restore'])
    expect(
      (await database.outbox.where('table').equals('activity_history').toArray()).map((row) => row.op),
    ).toEqual(['set_visibility', 'set_visibility'])
  })

  it('queues finalized practice detail correction without changing sporting facts', async () => {
    await createDraft('activity-1')
    await startDraft('activity-1')
    const completed = await repository.finalize(
      'activity-1',
      mutation('finish-1', ACTIVITY_STATES.ACTIVE, 1),
    )

    const corrected = await repository.correctPracticeDetails(
      'activity-1',
      {
        previousNotes: null,
        previousTags: [],
        notes: 'windy finish',
        tags: ['windy'],
      },
      mutation('correct-1', null, completed.activity.version, {
        source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
      }),
    )

    expect(corrected.activity).toMatchObject({ version: 3, state: ACTIVITY_STATES.COMPLETED })
    expect(corrected.auditEvent).toMatchObject({
      action: 'correct_practice_details',
      previous_values: { notes: null, tags: [] },
      new_values: { notes: 'windy finish', tags: ['windy'] },
    })
    expect(await database.outbox.where('table').equals('activity_history').first()).toMatchObject({
      op: 'correct_practice_details',
      payload: expect.objectContaining({ notes: 'windy finish', tags: ['windy'] }),
    })
    expect(await database.activityStateEvents.count()).toBe(2)
  })

  it('preserves optimistic local history state while its outbox operation is pending', async () => {
    await createDraft('activity-1')
    await startDraft('activity-1')
    const completed = await repository.finalize(
      'activity-1',
      mutation('finish-1', ACTIVITY_STATES.ACTIVE, 1),
    )
    await repository.hide(
      'activity-1',
      mutation('hide-1', null, completed.activity.version, {
        source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
      }),
    )

    await repository.hydrateActivities([
      { ...completed.activity, hidden_at: null, updated_at: TIME },
    ])

    expect(await repository.getById('activity-1')).toMatchObject({ hidden_at: TIME, version: 3 })
    expect(await repository.listHistoryWithSync(USER_ID, { includeHidden: true })).toEqual([
      expect.objectContaining({ id: 'activity-1', sync_state: 'pending' }),
    ])
  })

  it('rolls back history activity, audit, and outbox writes together', async () => {
    await createDraft('activity-1')
    await startDraft('activity-1')
    const completed = await repository.finalize(
      'activity-1',
      mutation('finish-1', ACTIVITY_STATES.ACTIVE, 1),
    )
    const faulting = createActivityRepository({
      database,
      faultInjector: (stage) => {
        if (stage === 'after_audit_write') throw new Error('audit write interrupted')
      },
    })

    await expect(
      faulting.hide(
        'activity-1',
        mutation('hide-with-fault', null, completed.activity.version, {
          source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
        }),
      ),
    ).rejects.toThrow('audit write interrupted')

    expect(await repository.getById('activity-1')).toMatchObject({ hidden_at: null, version: 2 })
    expect(await database.auditEvents.count()).toBe(0)
    expect(await database.outbox.where('table').equals('activity_history').count()).toBe(0)
  })
})
