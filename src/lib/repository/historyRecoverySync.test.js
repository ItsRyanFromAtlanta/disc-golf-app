import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITY_SOURCES, ACTIVITY_STATES, ACTIVITY_TYPES } from '../activityLifecycle'
import { createAppDatabase } from '../db/dexieDb'
import { createActivityRepository } from './activityRepository'
import {
  correctionRpcArgs,
  createHistoryRecoverySyncAdapter,
  isPermanentHistoryRecoveryError,
  visibilityRpcArgs,
} from './historyRecoverySync'

const TIME = '2026-07-12T22:00:00.000Z'

function mutation(key, expectedVersion) {
  return {
    expectedState: null,
    expectedVersion,
    occurredAt: TIME,
    recordedAt: TIME,
    source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
    installationId: 'installation-1',
    idempotencyKey: key,
  }
}

describe('historyRecoverySync', () => {
  let database
  let repository

  beforeEach(async () => {
    database = createAppDatabase(`HistoryRecoverySync-${crypto.randomUUID()}`)
    repository = createActivityRepository({ database })
    await database.open()
    await database.activities.add({
      id: 'activity-1',
      user_id: 'user-1',
      type: ACTIVITY_TYPES.PUTTING_FREEFORM,
      state: ACTIVITY_STATES.COMPLETED,
      version: 2,
      hidden_at: null,
      has_meaningful_fact: true,
      created_at: TIME,
      updated_at: TIME,
    })
  })

  afterEach(async () => database.delete())

  it('maps visibility and correction rows to deployed RPC arguments', async () => {
    await repository.hide('activity-1', mutation('hide-1', 2))
    const visibility = await database.outbox.where('table').equals('activity_history').first()
    expect(visibilityRpcArgs(visibility)).toMatchObject({
      p_activity_id: 'activity-1',
      p_expected_version: 2,
      p_hidden: true,
      p_idempotency_key: 'hide-1',
      p_audit_event_id: visibility.payload.auditEvent.id,
    })

    await database.outbox.clear()
    await database.activities.update('activity-1', { hidden_at: null })
    await repository.correctPracticeDetails(
      'activity-1',
      { previousNotes: null, previousTags: [], notes: 'note', tags: ['windy'] },
      mutation('correct-1', 3),
    )
    const correction = await database.outbox.where('table').equals('activity_history').first()
    expect(correctionRpcArgs(correction)).toMatchObject({
      p_activity_id: 'activity-1',
      p_expected_version: 3,
      p_notes: 'note',
      p_tags: ['windy'],
      p_idempotency_key: 'correct-1',
    })
  })

  it('flushes ready operations through authenticated RPCs and acknowledges them', async () => {
    await repository.hide('activity-1', mutation('hide-1', 2))
    const calls = []
    const adapter = createHistoryRecoverySyncAdapter({
      database,
      lifecycleSync: { flush: async () => ({ hasPending: false, error: null }) },
      client: {
        async rpc(name, args) {
          calls.push([name, args])
          return { data: { outcome: 'applied' }, error: null }
        },
      },
    })

    await expect(adapter.flush(Date.parse(TIME))).resolves.toMatchObject({ hasPending: false, error: null })
    expect(calls.map(([name]) => name)).toEqual(['activity_set_visibility'])
    expect(await database.outbox.where('table').equals('activity_history').count()).toBe(0)
  })

  it('poisons contract conflicts and classifies network failures as retryable', () => {
    expect(isPermanentHistoryRecoveryError({ code: 'P0001', message: 'version_conflict' })).toBe(true)
    expect(isPermanentHistoryRecoveryError({ status: 503, message: 'offline' })).toBe(false)
  })
})
