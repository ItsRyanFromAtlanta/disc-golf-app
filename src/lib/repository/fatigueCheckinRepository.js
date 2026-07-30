import { useEffect } from 'react'
import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'
import { flushOutbox, writeThrough } from './offlineFirstRepository'

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
  // `writeThrough` and `flushOutbox` keep an entry queued unless remoteFn
  // RESOLVES, so PostgREST's `{ error }` has to become a throw here.
  async function insertRemote(checkin) {
    const { error } = await client.from(FATIGUE_CHECKIN_TABLE).insert(checkin)
    if (error && error.code !== UNIQUE_VIOLATION) throw error
    return checkin
  }

  const remoteFns = { create: insertRemote }

  // Ids of check-ins still waiting in the outbox. Derived from the queue rather
  // than stored as a field on the mirrored row, so there is one source of truth
  // for "has this reached the server" and no second copy to drift.
  async function queuedIds() {
    const entries = await database.outbox.where('table').equals(FATIGUE_CHECKIN_TABLE).toArray()
    return new Set(entries.map((entry) => entry.payload?.id).filter(Boolean))
  }

  // Mirrors locally first so the check-in is visible either way, then queues
  // BEFORE the remote attempt so a request that dies in flight still leaves a
  // durable retry record. This was the only durable write in the repository
  // layer that skipped the queue entirely: the insert was attempted once, and a
  // failure stranded the answer on the device with nothing to retry it.
  async function record(checkin) {
    await database.practiceFatigueCheckins.put(checkin)
    try {
      await writeThrough({
        outboxTable: database.outbox,
        entityName: FATIGUE_CHECKIN_TABLE,
        op: 'create',
        payload: checkin,
        remoteFn: insertRemote,
      })
      return { ...checkin, sync_state: 'synced' }
    } catch {
      // Deliberately left queued: flushPending() retries it on reconnect, and
      // the caller renders the pending badge from this return value.
      return { ...checkin, sync_state: 'pending' }
    }
  }

  function flushPending() {
    return flushOutbox({ outboxTable: database.outbox, entityName: FATIGUE_CHECKIN_TABLE, remoteFns })
  }

  async function listForParent({ puttSessionId, regimenRunId }) {
    const field = puttSessionId ? 'putt_session_id' : 'regimen_run_id'
    const value = puttSessionId ?? regimenRunId
    const { data } = await client.from(FATIGUE_CHECKIN_TABLE).select('*').eq(field, value).order('recorded_at')
    if (data?.length) await database.practiceFatigueCheckins.bulkPut(data)
    const local = await database.practiceFatigueCheckins.where(field).equals(value).sortBy('recorded_at')
    const queued = await queuedIds()
    const remoteIds = new Set(data?.map((row) => row.id) ?? [])

    function syncStateFor(row) {
      if (remoteIds.has(row.id)) return 'synced' // the server just returned it
      if (queued.has(row.id)) return 'pending' // still waiting in the outbox
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

  return { record, listForParent, flushPending }
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
