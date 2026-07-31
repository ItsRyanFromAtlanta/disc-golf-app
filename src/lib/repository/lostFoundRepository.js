import { db } from '../db/dexieDb'
import { fetchUserDiscs } from '../discLocker'
import { normalizeLostFoundFields, sortLostFoundCases } from '../lostFound'
import { supabase } from '../supabaseClient'
import { readCourseList } from './courseRepository'
import { readThroughCache } from './offlineFirstRepository'

function rpcFields(row) {
  return {
    p_course_id: row.courseId,
    p_area_text: row.areaText,
    p_latitude: row.latitude,
    p_longitude: row.longitude,
    p_notes: row.notes,
    p_contact_name: row.contactName,
    p_contact_value: row.contactValue,
  }
}

async function syncOperation(row) {
  const params = row.op === 'open'
    ? {
        p_case_id: row.caseId,
        p_update_id: row.updateId,
        p_disc_id: row.discId,
        p_occurred_at: row.occurredAt,
        p_idempotency_key: row.idempotencyKey,
        ...rpcFields(row),
      }
    : {
        p_update_id: row.updateId,
        p_case_id: row.caseId,
        p_event_type: row.eventType,
        p_occurred_at: row.occurredAt,
        p_idempotency_key: row.idempotencyKey,
        ...rpcFields(row),
      }
  const { error } = await supabase.rpc(row.op === 'open' ? 'open_lost_found_case' : 'append_lost_found_update', params)
  if (error) throw error
}

function optimisticRows(row) {
  const update = {
    id: row.updateId,
    user_id: row.userId,
    case_id: row.caseId,
    event_type: row.op === 'open' ? 'reported_lost' : row.eventType,
    occurred_at: row.occurredAt,
    recorded_at: row.createdAt,
    course_id: row.courseId,
    area_text: row.areaText,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    contact_name: row.contactName,
    contact_value: row.contactValue,
    pending: true,
  }
  if (row.op !== 'open') return { update }
  return {
    update,
    caseRow: {
      id: row.caseId,
      user_id: row.userId,
      disc_id: row.discId,
      status: 'open',
      opened_at: row.occurredAt,
      latest_update_at: row.occurredAt,
      created_at: row.createdAt,
      pending: true,
    },
  }
}

async function queueOperation(input) {
  const fields = normalizeLostFoundFields(input)
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    updateId: crypto.randomUUID(),
    idempotencyKey: `lost-found:${crypto.randomUUID()}`,
    occurredAt: input.occurredAt || now,
    createdAt: now,
    status: 'pending',
    ...input,
    ...fields,
  }
  const optimistic = optimisticRows(row)
  await db.transaction('rw', db.lostFoundOutbox, db.lostFoundCases, db.lostFoundUpdates, async () => {
    await db.lostFoundOutbox.put(row)
    if (optimistic.caseRow) await db.lostFoundCases.put(optimistic.caseRow)
    await db.lostFoundUpdates.put(optimistic.update)
    if (!optimistic.caseRow) {
      const terminal = ['recovered', 'closed'].includes(row.eventType)
      await db.lostFoundCases.update(row.caseId, {
        latest_update_at: row.occurredAt,
        ...(terminal ? { status: row.eventType, resolved_at: row.occurredAt } : {}),
      })
    }
  })
  try {
    await syncOperation(row)
    await db.lostFoundOutbox.delete(row.id)
    await db.lostFoundUpdates.update(row.updateId, { pending: false })
    if (optimistic.caseRow) await db.lostFoundCases.update(row.caseId, { pending: false })
    return { caseId: row.caseId, queued: false }
  } catch (error) {
    await db.lostFoundOutbox.update(row.id, { status: 'retry', lastError: error.message })
    return { caseId: row.caseId, queued: true }
  }
}

export function openLostFoundCase({ userId, discId, ...fields }) {
  return queueOperation({ op: 'open', userId, discId, caseId: crypto.randomUUID(), ...fields })
}

export function appendLostFoundUpdate({ userId, caseId, eventType, ...fields }) {
  return queueOperation({ op: 'update', userId, caseId, eventType, ...fields })
}

export async function flushLostFoundOutbox(userId) {
  const rows = await db.lostFoundOutbox.where('userId').equals(userId).sortBy('createdAt')
  for (const row of rows) {
    try {
      await syncOperation(row)
      await db.lostFoundOutbox.delete(row.id)
      await db.lostFoundUpdates.update(row.updateId, { pending: false })
      if (row.op === 'open') await db.lostFoundCases.update(row.caseId, { pending: false })
    } catch (error) {
      await db.lostFoundOutbox.update(row.id, { status: 'retry', lastError: error.message })
    }
  }
}

export const LOST_FOUND_REFERENCE_DATA_MESSAGE =
  'Disc and course names could not be loaded. Your cases below are complete; the labels will fill in when you reconnect.'

// Everything the Lost & Found screen reads, in one place so the failure rules
// are testable instead of living in a page effect.
//
// The write path here has always been offline-first — `openLostFoundCase`
// queues durably and reports `queued: true` — but the read path was not, so a
// case filed in the field was durably queued and then reported as "No Lost &
// Found cases yet". Two causes, both addressed here:
//
//  1. Discs and courses were read straight from Supabase, so they rejected
//     offline. They now go through the same Dexie-backed readers the rest of
//     the app uses (`readThroughCache` is what backs discRepository;
//     `readCourseList` additionally adds back a course whose own creation is
//     still queued).
//  2. They sat in a `Promise.all` beside `loadLostFoundCases`, so either
//     rejection discarded the merged case list even though it had resolved.
//     `allSettled` stops reference data taking the case history down with it:
//     the cases are the user's own captured work, the names are only labels.
//
// A reference-data failure is reported, not swallowed (E2 audit finding 2) —
// it simply no longer hides anything. `discs`/`courses` come back null rather
// than [] when their read failed, so a caller keeps whatever it already had
// instead of blanking the pickers.
export async function loadLostFoundScreen(userId, readers = {}) {
  const {
    readDiscs = (id) => readThroughCache(db.discs, () => fetchUserDiscs(id)),
    readCourses = () => readCourseList(),
    readCases = (id) => loadLostFoundCases(id),
  } = readers
  const [discResult, courseResult, caseResult] = await Promise.allSettled([
    readDiscs(userId),
    readCourses(),
    readCases(userId),
  ])
  // Only the cases are load-bearing. If even the local mirror has nothing to
  // show, the caller still gets the real error rather than a false empty state.
  if (caseResult.status === 'rejected') throw caseResult.reason
  return {
    discs: discResult.status === 'fulfilled' ? discResult.value : null,
    courses: courseResult.status === 'fulfilled' ? courseResult.value : null,
    cases: caseResult.value.cases,
    updates: caseResult.value.updates,
    referenceError:
      discResult.status === 'rejected' || courseResult.status === 'rejected'
        ? LOST_FOUND_REFERENCE_DATA_MESSAGE
        : null,
  }
}

export async function loadLostFoundCases(userId) {
  try {
    const [{ data: cases, error: caseError }, { data: updates, error: updateError }] = await Promise.all([
      supabase.from('lost_found_cases').select('*').eq('user_id', userId).order('latest_update_at', { ascending: false }),
      supabase.from('lost_found_updates').select('*').eq('user_id', userId).order('occurred_at', { ascending: false }),
    ])
    if (caseError) throw caseError
    if (updateError) throw updateError
    const pending = await db.lostFoundOutbox.where('userId').equals(userId).toArray()
    await db.transaction('rw', db.lostFoundCases, db.lostFoundUpdates, async () => {
      await db.lostFoundCases.where('user_id').equals(userId).delete()
      await db.lostFoundUpdates.where('user_id').equals(userId).delete()
      if (cases?.length) await db.lostFoundCases.bulkPut(cases)
      if (updates?.length) await db.lostFoundUpdates.bulkPut(updates)
      for (const row of pending) {
        const optimistic = optimisticRows(row)
        if (optimistic.caseRow) await db.lostFoundCases.put(optimistic.caseRow)
        await db.lostFoundUpdates.put(optimistic.update)
        if (!optimistic.caseRow) {
          const terminal = ['recovered', 'closed'].includes(row.eventType)
          await db.lostFoundCases.update(row.caseId, {
            latest_update_at: row.occurredAt,
            ...(terminal ? { status: row.eventType, resolved_at: row.occurredAt } : {}),
          })
        }
      }
    })
    return {
      cases: sortLostFoundCases(await db.lostFoundCases.where('user_id').equals(userId).toArray()),
      updates: await db.lostFoundUpdates.where('user_id').equals(userId).toArray(),
    }
  } catch (error) {
    const cases = await db.lostFoundCases.where('user_id').equals(userId).toArray()
    const updates = await db.lostFoundUpdates.where('user_id').equals(userId).toArray()
    if (cases.length || updates.length) return { cases: sortLostFoundCases(cases), updates }
    throw error
  }
}
