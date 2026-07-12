import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITY_SOURCES, ACTIVITY_STATES, ACTIVITY_TYPES } from '../activityLifecycle'
import { createAppDatabase } from '../db/dexieDb'
import { createActivityRepository } from './activityRepository'
import {
  activityCreateRpcArgs,
  activityTransitionRpcArgs,
  createActivitySyncAdapter,
  isPermanentActivitySyncError,
} from './activitySync'

const TIME = '2026-07-12T12:00:00.000Z'

function mutation(key, expectedState, expectedVersion, overrides = {}) {
  return {
    expectedState,
    expectedVersion,
    occurredAt: TIME,
    recordedAt: TIME,
    source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    installationId: 'installation-1',
    idempotencyKey: key,
    ...overrides,
  }
}

describe('activitySync', () => {
  let database
  let repository

  beforeEach(async () => {
    database = createAppDatabase(`ActivitySyncTest-${crypto.randomUUID()}`)
    repository = createActivityRepository({ database })
    await database.open()
  })

  afterEach(async () => database.delete())

  it('maps local lifecycle envelopes to the deployed RPC arguments', async () => {
    await repository.createDraft({
      id: 'activity-1',
      userId: 'user-1',
      type: ACTIVITY_TYPES.PUTTING_FREEFORM,
      mutation: mutation('create-1', null, null),
      metadata: { mirroredFrom: 'instant_launch' },
    })
    const started = await repository.start('activity-1', mutation('start-1', ACTIVITY_STATES.DRAFT, 0))
    const rows = await database.outbox.toArray()
    const createRow = rows.find((row) => row.op === 'create_draft')
    const transitionRow = rows.find((row) => row.op === 'transition')

    expect(activityCreateRpcArgs(createRow)).toMatchObject({
      p_activity_id: 'activity-1',
      p_type: ACTIVITY_TYPES.PUTTING_FREEFORM,
      p_idempotency_key: 'create-1',
      p_metadata: { mirroredFrom: 'instant_launch' },
    })
    expect(activityTransitionRpcArgs(transitionRow)).toMatchObject({
      p_activity_id: 'activity-1',
      p_command: 'start',
      p_expected_state: 'draft',
      p_expected_version: started.activity.version - 1,
      p_state_event_id: transitionRow.payload.stateEvent.id,
      p_idempotency_key: 'start-1',
      p_confirm_round_replacement: false,
    })
  })

  it('flushes create and dependent transition in order and acknowledges both', async () => {
    await repository.createDraft({
      id: 'activity-1',
      userId: 'user-1',
      type: ACTIVITY_TYPES.PUTTING_FREEFORM,
      mutation: mutation('create-1', null, null),
    })
    await repository.start('activity-1', mutation('start-1', ACTIVITY_STATES.DRAFT, 0))

    const calls = []
    const adapter = createActivitySyncAdapter({
      database,
      client: {
        async rpc(name, args) {
          calls.push([name, args])
          return { data: { outcome: 'applied' }, error: null }
        },
      },
    })

    await expect(adapter.flush(Date.parse(TIME))).resolves.toMatchObject({ hasPending: false, error: null })
    expect(calls.map(([name]) => name)).toEqual(['activity_create_draft', 'activity_transition'])
    expect(await database.outbox.where('table').equals('activity_lifecycle').count()).toBe(0)
  })

  it('poisons known lifecycle conflicts but leaves network failures retryable', () => {
    expect(isPermanentActivitySyncError({ code: 'P0001', message: 'version_conflict' })).toBe(true)
    expect(isPermanentActivitySyncError({ code: 'P0001', message: 'some_network_proxy_error' })).toBe(false)
    expect(isPermanentActivitySyncError({ status: 503, message: 'offline' })).toBe(false)
  })
})
