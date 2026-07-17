import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVITY_SOURCES, ACTIVITY_STATES, ACTIVITY_TYPES } from './activityLifecycle'
import { createAppDatabase } from './db/dexieDb'
import { applyEnqueuePuttEvent, applySetCrashRecoveryBuffer, defaultInstantLaunchState } from './instantLaunch/stateReducer'
import { mirrorInstantLaunchActivity } from './instantLaunch/activityBridge'
import { createActivityRepository } from './repository/activityRepository'
import { createActivitySyncAdapter } from './repository/activitySync'
import { createSyncScheduler, SYNC_STATUS } from './instantLaunch/syncScheduler'

const TIME = '2026-07-12T12:00:00.000Z'

function mutation(key, expectedState, expectedVersion, overrides = {}) {
  return {
    expectedState,
    expectedVersion,
    occurredAt: TIME,
    recordedAt: TIME,
    source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    installationId: 'a10-test-installation',
    idempotencyKey: key,
    ...overrides,
  }
}

function activeState(sessionType, parentIds) {
  return applyEnqueuePuttEvent(
    applySetCrashRecoveryBuffer(defaultInstantLaunchState(), {
      hasActiveSession: true,
      sessionType,
      parentIds,
    }),
    { id: `${sessionType}-putt-1`, outcome: 'make' },
  )
}

describe('A10 offline equivalence gates', () => {
  let databases

  beforeEach(() => {
    databases = []
  })

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.delete()))
  })

  it('reopens a crashed local lifecycle with its activity and ordered outbox intact', async () => {
    const name = `A10Reload-${crypto.randomUUID()}`
    let database = createAppDatabase(name)
    databases.push(database)
    const firstRepository = createActivityRepository({ database })
    await database.open()
    await firstRepository.createDraft({
      id: 'a10-activity',
      userId: 'a10-user',
      type: ACTIVITY_TYPES.PUTTING_FREEFORM,
      mutation: mutation('a10-create', null, null),
    })
    await firstRepository.start('a10-activity', mutation('a10-start', ACTIVITY_STATES.DRAFT, 0))
    database.close()

    database = createAppDatabase(name)
    databases.push(database)
    await database.open()
    expect(await database.activities.get('a10-activity')).toMatchObject({ state: ACTIVITY_STATES.ACTIVE, version: 1 })
    expect((await database.outbox.toArray()).map((row) => row.op)).toEqual(['create_draft', 'transition'])
  })

  it('does not duplicate remote writes when reconnect flush is retried after acknowledgement', async () => {
    const database = createAppDatabase(`A10ExactlyOnce-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = createActivityRepository({ database })
    await database.open()
    await repository.createDraft({
      id: 'a10-exactly-once',
      userId: 'a10-user',
      type: ACTIVITY_TYPES.PUTTING_FREEFORM,
      mutation: mutation('a10-exactly-once-create', null, null),
    })
    const calls = []
    const adapter = createActivitySyncAdapter({
      database,
      client: { rpc: async (name, args) => (calls.push([name, args]), { data: {}, error: null }) },
    })

    await adapter.flush(Date.parse(TIME))
    await adapter.flush(Date.parse(TIME))
    expect(calls).toHaveLength(1)
    expect(await database.outbox.where('table').equals('activity_lifecycle').count()).toBe(0)
  })

  it('preserves both offline starts while the authoritative server rejects the second active transition', async () => {
    const databaseA = createAppDatabase(`A10DeviceA-${crypto.randomUUID()}`)
    const databaseB = createAppDatabase(`A10DeviceB-${crypto.randomUUID()}`)
    databases.push(databaseA, databaseB)
    const repositoryA = createActivityRepository({ database: databaseA })
    const repositoryB = createActivityRepository({ database: databaseB })
    await databaseA.open()
    await databaseB.open()
    await repositoryA.createDraft({ id: 'a10-device-a', userId: 'a10-user', type: ACTIVITY_TYPES.PUTTING_FREEFORM, mutation: mutation('a10-a-create', null, null) })
    await repositoryB.createDraft({ id: 'a10-device-b', userId: 'a10-user', type: ACTIVITY_TYPES.PUTTING_FREEFORM, mutation: mutation('a10-b-create', null, null) })
    await repositoryA.start('a10-device-a', mutation('a10-a-start', ACTIVITY_STATES.DRAFT, 0))
    await repositoryB.start('a10-device-b', mutation('a10-b-start', ACTIVITY_STATES.DRAFT, 0))

    const server = { activities: new Map(), activeByUser: new Map() }
    const client = {
      async rpc(name, args) {
        if (name === 'activity_create_draft') {
          server.activities.set(args.p_activity_id, { state: ACTIVITY_STATES.DRAFT, version: 0, user_id: 'a10-user' })
          return { data: {}, error: null }
        }
        const activity = server.activities.get(args.p_activity_id)
        if (server.activeByUser.has('a10-user') && server.activeByUser.get('a10-user') !== args.p_activity_id) {
          return { data: null, error: { code: 'P0001', message: 'state_conflict' } }
        }
        activity.state = ACTIVITY_STATES.ACTIVE
        activity.version += 1
        server.activeByUser.set('a10-user', args.p_activity_id)
        return { data: {}, error: null }
      },
    }
    const adapterA = createActivitySyncAdapter({ database: databaseA, client })
    const adapterB = createActivitySyncAdapter({ database: databaseB, client })
    await adapterA.flush(Date.parse(TIME))
    const resultB = await adapterB.flush(Date.parse(TIME))

    expect(server.activeByUser.get('a10-user')).toBe('a10-device-a')
    expect(await databaseB.activities.get('a10-device-b')).toMatchObject({ state: ACTIVITY_STATES.ACTIVE })
    expect(resultB.error).toMatchObject({ permanent: true })
    expect((await databaseB.outbox.where('table').equals('activity_lifecycle').toArray()).some((row) => row.poison)).toBe(true)
  })

  it('keeps transient reconnect failures retryable and converges to synced', async () => {
    vi.useFakeTimers()
    const statuses = []
    let attempts = 0
    const scheduler = createSyncScheduler({
      flush: async () => {
        attempts += 1
        return attempts === 1 ? { hasPending: true, error: { permanent: false } } : { hasPending: false, error: null }
      },
      onStatusChange: (status) => statuses.push(status),
    })
    try {
      globalThis.window = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
      globalThis.document = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
      scheduler.start()
      await vi.runOnlyPendingTimersAsync()
      expect(scheduler.getStatus()).toBe(SYNC_STATUS.SYNCED)
      expect(statuses).toEqual([SYNC_STATUS.SYNCING, SYNC_STATUS.ERROR_RETRYING, SYNC_STATUS.SYNCING, SYNC_STATUS.SYNCED])
    } finally {
      scheduler.stop()
      delete globalThis.window
      delete globalThis.document
      vi.useRealTimers()
    }
  })

  it('keeps the crash bridge identity stable without synthesizing capture facts', async () => {
    const database = createAppDatabase(`A10Bridge-${crypto.randomUUID()}`)
    databases.push(database)
    await database.open()
    const repository = createActivityRepository({ database })
    const state = activeState('freeform', { freeformSessionId: 'a10-session' })
    const result = await mirrorInstantLaunchActivity({
      repository,
      instantLaunchState: state,
      userId: 'a10-user',
      occurredAt: TIME,
      installationId: 'a10-installation',
      source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    })
    expect(result.activity.id).toBe('a10-session')
    expect(result.instantLaunchState.outbox.puttEvents).toEqual([{ id: 'freeform-putt-1', outcome: 'make' }])
    expect(await database.activities.count()).toBe(1)
  })
})
