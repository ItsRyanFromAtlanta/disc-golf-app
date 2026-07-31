import { isPermanentError } from '../instantLaunch/errorClassification'
import { nextBackoffDelayMs } from '../instantLaunch/backoff'
import { supabase as defaultSupabase } from '../supabaseClient'
import { ACTIVITY_OUTBOX_TABLE, createActivityOutbox } from './activityOutbox'
import { db as defaultDb } from '../db/dexieDb'

const LIFECYCLE_ERROR_MESSAGES = new Set([
  'unauthenticated',
  'invalid_activity',
  'invalid_mutation',
  'invalid_command',
  'invalid_transition',
  'activity_not_found',
  'activity_id_conflict',
  'idempotency_key_conflict',
  'state_conflict',
  'version_conflict',
  'state_event_id_conflict',
  'round_replacement_confirmation_required',
])

// The deploy-lag exemption, and the reason it is scoped this narrowly.
//
// `draft -> completed` was added to the client transition table on 2026-07-31
// (D-03) and to the server by migration `20260731001500`. Between a client
// landing on `main` and that migration being applied, the deployed RPC has no
// arm for it and answers `invalid_transition` — which this module classifies as
// permanent, so the row is poisoned. That is not a stuck row: `flush` computes
// `hasPoison` across the whole table and reports `{ permanent: true }` forever,
// which stops InstantLaunch capture sync and history-recovery sync too. Putts
// stay in the local outbox indefinitely while every screen renders them fine.
//
// The rest of `LIFECYCLE_ERROR_MESSAGES` stays permanent, because those really
// are unfixable by retrying. This one is fixable by waiting, and waiting is what
// `DEPLOY_LAG_CODES` in `errorClassification.js` already does for the same
// situation at the PostgREST layer — a client that writes ahead of its migration
// must wait, not poison.
//
// Deliberately keyed on the exact transition rather than on `invalid_transition`
// wholesale: a genuine illegal transition — a bug — must still poison loudly
// instead of retrying forever behind a backoff.
// Reads the same two fields `activityTransitionRpcArgs` sends as `p_command`
// and `p_expected_state`, so this cannot drift from what the server was
// actually asked to do. The previous state lives on the state event, not on the
// mutation — a guard written against `mutation.expectedState` type-checks,
// passes a hand-built test, and silently never fires in production.
function isDeployLagTransition(row) {
  if (!row || row.op === 'create_draft') return false
  const { mutation, stateEvent } = row.payload ?? {}
  return mutation?.type === 'finalize_completed' && stateEvent?.previous_state === 'draft'
}

export function isPermanentActivitySyncError(error, row = null) {
  if (typeof error?.message === 'string'
    && error.message === 'invalid_transition'
    && isDeployLagTransition(row)) {
    return false
  }
  if (isPermanentError(error)) return true
  return typeof error?.message === 'string' && LIFECYCLE_ERROR_MESSAGES.has(error.message)
}

export function activityCreateRpcArgs(row) {
  const { activity, mutation } = row.payload
  return {
    p_activity_id: activity.id,
    p_type: activity.type,
    p_occurred_at: mutation.occurredAt,
    p_recorded_at: mutation.recordedAt,
    p_source: mutation.source,
    p_installation_id: mutation.installationId,
    p_idempotency_key: mutation.idempotencyKey,
    p_metadata: activity.metadata ?? {},
  }
}

export function activityTransitionRpcArgs(row) {
  const { activity, stateEvent, mutation } = row.payload
  return {
    p_activity_id: activity.id,
    p_command: mutation.type,
    p_expected_state: stateEvent.previous_state,
    p_expected_version: activity.version - 1,
    p_occurred_at: stateEvent.occurred_at,
    p_recorded_at: stateEvent.recorded_at,
    p_source: stateEvent.source,
    p_installation_id: stateEvent.installation_id,
    p_idempotency_key: stateEvent.idempotency_key,
    p_state_event_id: stateEvent.id,
    p_reason: stateEvent.reason,
    p_metadata: stateEvent.metadata ?? {},
    p_confirm_round_replacement: Boolean(mutation.confirmRoundReplacement),
  }
}

export function createActivitySyncAdapter({ database = defaultDb, client = defaultSupabase, outbox } = {}) {
  const activityOutbox = outbox ?? createActivityOutbox({ database })
  async function flush(nowMs = Date.now()) {
    const permanentFailureIds = []
    let transientFailure = false

    // Re-read after each dependency wave so a create and its start transition
    // can drain in one scheduler pass while preserving the outbox order.
    while (true) {
      const ready = await activityOutbox.listReady(nowMs)
      if (ready.length === 0) break
      for (const row of ready) {
        try {
          const rpcName = row.op === 'create_draft' ? 'activity_create_draft' : 'activity_transition'
          const args = row.op === 'create_draft' ? activityCreateRpcArgs(row) : activityTransitionRpcArgs(row)
          const { error } = await client.rpc(rpcName, args)
          if (error) throw error
          await activityOutbox.acknowledge(row.id)
        } catch (error) {
          const permanent = isPermanentActivitySyncError(error, row)
          if (permanent) permanentFailureIds.push(row.id)
          else transientFailure = true
          await activityOutbox.recordFailure(row.id, {
            errorClass: permanent ? 'permanent' : 'transient',
            nextRetryAt: permanent ? null : nowMs + nextBackoffDelayMs(row.attemptCount ?? 0),
            poison: permanent,
          })
        }
      }
    }

    const allRows = await database.outbox.where('table').equals(ACTIVITY_OUTBOX_TABLE).toArray()
    const remaining = allRows.filter((row) => !row.poison).length
    const hasPoison = allRows.some((row) => row.poison)
    return {
      hasPending: remaining > 0,
      error:
        permanentFailureIds.length > 0 || hasPoison
          ? { permanent: true }
          : transientFailure || remaining > 0
            ? { permanent: false }
            : null,
      permanentFailureIds,
    }
  }

  return { flush }
}
