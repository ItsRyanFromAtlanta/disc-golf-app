import { nextBackoffDelayMs } from '../instantLaunch/backoff'
import { isPermanentError } from '../instantLaunch/errorClassification'
import { supabase as defaultSupabase } from '../supabaseClient'
import { db as defaultDb } from '../db/dexieDb'
import { createActivitySyncAdapter } from './activitySync'
import {
  HISTORY_RECOVERY_OUTBOX_TABLE,
  createHistoryRecoveryOutbox,
} from './historyRecoveryOutbox'

const PERMANENT_HISTORY_ERRORS = new Set([
  'unauthenticated',
  'invalid_mutation',
  'activity_not_found',
  'version_conflict',
  'invalid_activity_state',
  'practice_record_not_found',
  'idempotency_key_conflict',
  'audit_event_id_conflict',
])

export function isPermanentHistoryRecoveryError(error) {
  if (isPermanentError(error)) return true
  return typeof error?.message === 'string' && PERMANENT_HISTORY_ERRORS.has(error.message)
}

export function visibilityRpcArgs(row) {
  const { activity, auditEvent, mutation, hidden } = row.payload
  return {
    p_activity_id: activity.id,
    p_expected_version: activity.version - 1,
    p_hidden: hidden,
    p_occurred_at: mutation.occurredAt,
    p_recorded_at: mutation.recordedAt,
    p_source: mutation.source,
    p_installation_id: mutation.installationId,
    p_idempotency_key: mutation.idempotencyKey,
    p_audit_event_id: auditEvent.id,
    p_reason: mutation.reason ?? null,
    p_metadata: mutation.metadata ?? {},
  }
}

export function correctionRpcArgs(row) {
  const { activity, auditEvent, mutation, notes, tags } = row.payload
  return {
    p_activity_id: activity.id,
    p_expected_version: activity.version - 1,
    p_notes: notes,
    p_tags: tags,
    p_occurred_at: mutation.occurredAt,
    p_recorded_at: mutation.recordedAt,
    p_source: mutation.source,
    p_installation_id: mutation.installationId,
    p_idempotency_key: mutation.idempotencyKey,
    p_audit_event_id: auditEvent.id,
    p_reason: mutation.reason ?? null,
    p_metadata: mutation.metadata ?? {},
  }
}

export function createHistoryRecoverySyncAdapter({
  database = defaultDb,
  client = defaultSupabase,
  outbox,
  lifecycleSync,
} = {}) {
  const historyOutbox = outbox ?? createHistoryRecoveryOutbox({ database })
  const activityLifecycleSync = lifecycleSync ?? createActivitySyncAdapter({ database, client })

  async function flush(nowMs = Date.now()) {
    const lifecycleResult = await activityLifecycleSync.flush(nowMs)
    if (lifecycleResult.error || lifecycleResult.hasPending) {
      return { hasPending: true, error: lifecycleResult.error ?? { permanent: false } }
    }

    const permanentFailureIds = []
    let transientFailure = false

    while (true) {
      const ready = await historyOutbox.listReady(nowMs)
      if (ready.length === 0) break
      for (const row of ready) {
        try {
          const visibility = row.op === 'set_visibility'
          const rpcName = visibility ? 'activity_set_visibility' : 'activity_correct_practice_details'
          const args = visibility ? visibilityRpcArgs(row) : correctionRpcArgs(row)
          const { error } = await client.rpc(rpcName, args)
          if (error) throw error
          await historyOutbox.acknowledge(row.id)
        } catch (error) {
          const permanent = isPermanentHistoryRecoveryError(error)
          if (permanent) permanentFailureIds.push(row.id)
          else transientFailure = true
          await historyOutbox.recordFailure(row.id, {
            errorClass: permanent ? 'permanent' : 'transient',
            nextRetryAt: permanent ? null : nowMs + nextBackoffDelayMs(row.attemptCount ?? 0),
            poison: permanent,
          })
        }
      }
    }

    const rows = await database.outbox.where('table').equals(HISTORY_RECOVERY_OUTBOX_TABLE).toArray()
    const hasPoison = rows.some((row) => row.poison)
    const remaining = rows.some((row) => !row.poison)
    return {
      hasPending: remaining,
      error:
        hasPoison || permanentFailureIds.length
          ? { permanent: true }
          : transientFailure || remaining
            ? { permanent: false }
            : null,
      permanentFailureIds,
    }
  }

  return { flush, retryPoisoned: historyOutbox.retryPoisoned }
}
