import { useEffect } from 'react'
import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'
import { nextBackoffDelayMs } from '../instantLaunch/backoff'
import { attachResponseStatus, isPermanentError } from '../instantLaunch/errorClassification'
import { createOutboxQueue } from './outboxQueue'

// Entity name for the generic `db.outbox`, which doubles as the Supabase table
// name exactly as the other repositories do.
export const FATIGUE_CHECKIN_TABLE = 'practice_fatigue_checkins'

// A replay of a write that actually landed comes back as a unique violation on
// the primary key or on `idempotency_key`. The row IS on the server, so the
// queued entry is finished — re-queueing it would retry a doomed write forever
// behind a swallowed error, which is exactly what poisoned the round outbox
// (docs/development/E2_ROUND_COURSE_AUDIT.md findings 1 and 2). The table grants
// `select, insert` only, so PostgREST upsert is not available to make the replay
// idempotent server-side; classifying the duplicate is the client-side
// equivalent of the client-generated-id property finding 3 added deliberately.
const UNIQUE_VIOLATION = '23505'

export function createFatigueCheckinRepository({ database = defaultDb, client = defaultSupabase } = {}) {
  // Adversarial pre-deployment review, 2026-07-31: this was the last durable
  // write outside `outboxQueue.js` — the shared attempt-count/backoff/poison
  // contract `PHASE_A_ARCHITECTURE.md` § 8 requires of every queue (E2 audit
  // finding 2 is what happens when one diverges). `flushOutbox` in
  // `offlineFirstRepository.js` has no poison concept: every non-23505 error
  // was swallowed and retried on the next flush forever, so an RLS denial
  // (`42501`) or a check violation would loop invisibly instead of surfacing.
  // Moved onto the same `createOutboxQueue` machinery `activityOutbox.js`,
  // `historyRecoveryOutbox.js` and `courseRepository.js` already share — no
  // new Dexie schema needed, since `outbox` has carried
  // `idempotencyKey`/`dependencyKey`/`nextRetryAt` since v2 and `attemptCount`/
  // `lastErrorClass`/`poison` are unindexed fields the same table already
  // tolerates from those callers.
  const outbox = createOutboxQueue({ database, tables: [FATIGUE_CHECKIN_TABLE] })

  // `status` comes off the envelope, not the error — a `PostgrestError` never
  // carries one, and without it `isPermanentError` reads an RLS denial as
  // transient and retries it on every reconnect, forever (the exact gap this
  // migration closes). Both `record` and `flushPending` below keep an entry
  // queued unless this RESOLVES, so PostgREST's `{ error }` has to become a
  // throw.
  async function insertRemote(checkin) {
    const { error, status } = await client.from(FATIGUE_CHECKIN_TABLE).insert(checkin)
    if (error && error.code !== UNIQUE_VIOLATION) throw attachResponseStatus(error, status)
    return checkin
  }

  // Sync state per check-in id, derived from the outbox rather than stored as
  // a field on the mirrored row — one source of truth for "has this reached
  // the server", and now a three-way state instead of two: a poisoned entry
  // is queued forever otherwise, so it needs to read differently from one
  // still waiting for a reconnect.
  async function outboxStateById() {
    const rows = await outbox.rows()
    const state = new Map()
    for (const row of rows) {
      const id = row.payload?.id
      if (!id) continue
      state.set(id, row.poison ? 'needs_attention' : 'pending')
    }
    return state
  }

  // Mirrors locally first so the check-in is visible either way, then queues
  // BEFORE the remote attempt so a request that dies in flight still leaves a
  // durable retry record. This was the only durable write in the repository
  // layer that skipped the queue entirely: the insert was attempted once, and a
  // failure stranded the answer on the device with nothing to retry it.
  //
  // Classifies a PERMANENT first-attempt failure immediately, rather than only
  // classifying on a later `flushPending()` pass. Both call sites render the
  // returned `sync_state` directly and never re-check it once the check-in has
  // scrolled out of the active session, so a permanent failure (an RLS denial,
  // say) has to be visible from this same return value or it never gets shown
  // at all — it would sit poisoned in the outbox with nothing on screen to say
  // so until the next `flushPending()` classifies it, by which point this call
  // has already returned. Building the outbox row by hand (rather than
  // through `enqueueAndSend`) is what makes that id available to classify
  // against.
  //
  // A transient first-attempt failure is deliberately left UNclassified —
  // `attemptCount: 0`, `nextRetryAt: null`, exactly as inserted — rather than
  // also recording a failure and starting the backoff clock here. Every other
  // caller of this queue (`courseRepository.js`'s flush, `flushPending`
  // below) only calls `recordFailure` from inside an actual retry attempt, so
  // the first backoff window opens after the first RETRY fails, not after the
  // original write. Backing off here too would make the very next flush (e.g.
  // the `online` handler firing right after this returns) wait out a window
  // before making the retry attempt that window was supposed to follow.
  async function record(checkin) {
    await database.practiceFatigueCheckins.put(checkin)
    const outboxId = await database.outbox.add({
      table: FATIGUE_CHECKIN_TABLE,
      op: 'create',
      payload: checkin,
      createdAt: Date.now(),
      idempotencyKey: checkin.idempotency_key ?? null,
      dependencyKey: null,
      attemptCount: 0,
      lastErrorClass: null,
      nextRetryAt: null,
      poison: false,
    })
    try {
      await insertRemote(checkin)
      await outbox.acknowledge(outboxId)
      return { ...checkin, sync_state: 'synced' }
    } catch (error) {
      if (!isPermanentError(error)) return { ...checkin, sync_state: 'pending' }
      await outbox.recordFailure(outboxId, { errorClass: 'permanent', nextRetryAt: null, poison: true })
      return { ...checkin, sync_state: 'needs_attention' }
    }
  }

  // Replays every ready entry, classifying failures instead of swallowing them
  // the way `flushOutbox` did. A transient failure (offline, 5xx, deploy lag)
  // gets a backoff and stays retryable; a permanent one (RLS denial, check
  // violation, any 4xx) is poisoned — `listReady` excludes it from then on, so
  // it stops retrying and `outboxStateById` reports it as `needs_attention`
  // instead of `pending` forever.
  async function flushPending(nowMs = Date.now()) {
    for (const entry of await outbox.listReady(nowMs)) {
      try {
        await insertRemote(entry.payload)
        await outbox.acknowledge(entry.id)
      } catch (error) {
        const permanent = isPermanentError(error)
        await outbox.recordFailure(entry.id, {
          errorClass: permanent ? 'permanent' : 'transient',
          nextRetryAt: permanent ? null : nowMs + nextBackoffDelayMs(entry.attemptCount ?? 0),
          poison: permanent,
        })
      }
    }
  }

  // The only way back out of a poisoned row — see `activityOutbox.js`'s
  // `retryPoisoned` comment for why that hatch has to exist even for a
  // correctly-classified poison state.
  function retryPoisoned() {
    return outbox.retryPoisoned()
  }

  async function listForParent({ puttSessionId, regimenRunId }) {
    const field = puttSessionId ? 'putt_session_id' : 'regimen_run_id'
    const value = puttSessionId ?? regimenRunId
    const { data } = await client.from(FATIGUE_CHECKIN_TABLE).select('*').eq(field, value).order('recorded_at')
    if (data?.length) await database.practiceFatigueCheckins.bulkPut(data)
    const local = await database.practiceFatigueCheckins.where(field).equals(value).sortBy('recorded_at')
    const outboxState = await outboxStateById()
    const remoteIds = new Set(data?.map((row) => row.id) ?? [])

    function syncStateFor(row) {
      if (remoteIds.has(row.id)) return 'synced' // the server just returned it
      if (outboxState.has(row.id)) return outboxState.get(row.id) // 'pending' or 'needs_attention'
      // No queue entry either way. If the read succeeded the server does not
      // have this row, so it is stranded (written before this path queued
      // anything); if the read failed, all we know is that it was mirrored from
      // an earlier successful read.
      return data ? 'pending' : 'synced'
    }

    // This was `return data ?? local`. A SUCCESSFUL remote read returning [] is
    // not nullish, so the empty array won and a queued check-in disappeared from
    // the UI as well as from the server. The local mirror is unioned in instead:
    // a row the server has not acknowledged is the row the user most needs to
    // see, which is the same reason `readCourseList` adds its queued courses
    // back on top of the remote directory.
    const merged = data ? [...data, ...local.filter((row) => !remoteIds.has(row.id))] : local
    return merged
      .map((row) => ({ ...row, sync_state: syncStateFor(row) }))
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
  }

  return { record, listForParent, flushPending, retryPoisoned, outbox }
}

export const fatigueCheckinRepository = createFatigueCheckinRepository()

// Retries queued check-ins on mount and on reconnect, mirroring how the round
// and course queues wire their `online` listeners. Both capture screens mount
// it, so a check-in answered on a course with no signal is replayed as soon as
// the device is back — or on the next visit to either screen if the app was
// closed in between.
export function useFatigueCheckinSync(repository = fatigueCheckinRepository) {
  useEffect(() => {
    function flush() {
      repository.flushPending().catch(() => undefined)
    }
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [repository])
}
