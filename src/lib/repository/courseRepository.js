import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../db/dexieDb'
import { nextBackoffDelayMs } from '../instantLaunch/backoff'
import { isPermanentError } from '../instantLaunch/errorClassification'
import { SYNC_STATUS, createSyncScheduler } from '../instantLaunch/syncScheduler'
import { createOutboxQueue, enqueueAndSend } from './outboxQueue'
import { buildCourseCreateArgs, createCourseWithLayoutRpc, fetchCourse, fetchCourses } from '../roundLog'

// E2 audit finding 4. Every other write in the app queued through an outbox;
// quick-course creation called Supabase directly and threw. It is a field
// action — someone standing on an unlisted course with one bar of signal — so
// it is precisely the write the offline architecture exists for.
//
// Structured after the round outbox (`roundRepository.js`) and sharing its
// machinery: the same `createOutboxQueue`, the same permanent/transient
// classifier, the same backoff curve, and a `flush` whose result shape
// `createSyncScheduler` already consumes. A fourth hand-rolled queue is exactly
// what `outboxQueue.js`'s header warns about.
//
// What makes this queueable at all is finding 3's RPC: one call, one args
// object, no multi-step replay state, and client-generated `p_course_id` /
// `p_layout_id` so a reconnect that retries a call which actually landed gets
// the existing course back instead of a duplicate.
const COURSE_TABLE = 'courses'
const DEFAULT_LAYOUT_NAME = 'Main'

// Namespaced away from anything the activity/history queues use, for the same
// reason `roundCreateKey` is: the history-recovery queue resolves dependency
// keys against *every* queued row, so an un-namespaced string couples two
// independent queues.
export function courseCreateKey(courseId) {
  return `course-outbox:${courseId}:create`
}

export function courseIdForOutboxEntry(entry) {
  if (entry?.table !== COURSE_TABLE) return null
  return entry.payload?.p_course_id ?? null
}

// The optimistic row is shaped exactly like `fetchCourse`'s result — course,
// nested default layout, nested holes — so a screen reading the local mirror
// cannot tell a queued course from a fetched one by shape alone. Whether it has
// reached the server is a separate, explicit question (`listQueuedCourseIds`),
// never something a caller has to infer from a missing field.
export function localCourseFromArgs(args, userId = null) {
  return {
    id: args.p_course_id,
    name: args.p_name,
    location: args.p_location,
    layout_name: DEFAULT_LAYOUT_NAME,
    created_by: userId,
    created_at: new Date().toISOString(),
    layouts: [
      {
        id: args.p_layout_id,
        course_id: args.p_course_id,
        name: DEFAULT_LAYOUT_NAME,
        is_default: true,
        holes: args.p_holes.map((hole) => ({ ...hole, layout_id: args.p_layout_id })),
      },
    ],
  }
}

async function cacheCourse(course, database = db) {
  if (!course?.id) return course
  await database.courses.put(course)
  return course
}

function byName(a, b) {
  return String(a.name ?? '').localeCompare(String(b.name ?? ''))
}

// `fetchCourses` is a deliberately lightweight directory read: no layouts, no
// holes. Writing those rows straight over the cache would strip the layout a
// locally-created course still carries, so the remote row is merged on top of
// whatever is already cached rather than replacing it.
export async function readCourseList(database = db, api = { fetchCourses }) {
  const queuedIds = new Set(await listQueuedCourseIds(database))
  try {
    const remote = await api.fetchCourses()
    if (remote.length > 0) {
      const cached = new Map(
        (await database.courses.bulkGet(remote.map((row) => row.id)))
          .filter(Boolean)
          .map((row) => [row.id, row]),
      )
      await database.courses.bulkPut(remote.map((row) => ({ ...cached.get(row.id), ...row })))
    }

    // A queued course is not in the remote list yet by definition, and it is the
    // one the user most needs to see — they just created it. Nothing else is
    // added back: the remote directory is community-wide and authoritative.
    const remoteIds = new Set(remote.map((row) => row.id))
    const pendingOnly = (await database.courses.bulkGet([...queuedIds]))
      .filter(Boolean)
      .filter((row) => !remoteIds.has(row.id))
    return [...remote, ...pendingOnly].sort(byName)
  } catch (error) {
    const cached = await database.courses.toArray()
    if (cached.length > 0) return cached.sort(byName)
    throw error
  }
}

// Replays one queued course creation. Throws on failure so the caller can
// classify it.
//
// The write is the queued unit; the read-back is not. `create_course_with_layout`
// returns only the course id, and hydrating it is a second round trip that can
// fail on its own — on the connection that just barely managed the write. If a
// failed read requeued the entry, a course that is already on the server would
// keep reporting as unsynced. It is idempotent to retry, so nothing is lost by
// letting the next list read pick the row up instead.
async function replayCourseEntry(entry, { database, api }) {
  const courseId = await api.createCourseWithLayoutRpc(entry.payload)
  try {
    await cacheCourse(await api.fetchCourse(courseId), database)
  } catch {
    // Deliberately swallowed, and only here: the write landed, so the entry is
    // done. The local optimistic mirror stands in until a list read refreshes it.
  }
}

export function createCourseSyncAdapter({
  database = db,
  api = { createCourseWithLayoutRpc, fetchCourse },
} = {}) {
  const outbox = createOutboxQueue({ database, tables: [COURSE_TABLE] })

  // One pass, unlike the round flush's re-read loop: course entries carry no
  // dependency keys on each other — each is a self-contained transaction — so
  // there is nothing a second wave could unblock.
  async function flush(nowMs = Date.now()) {
    const permanentFailureIds = []
    let transientFailure = false

    for (const entry of await outbox.listReady(nowMs)) {
      try {
        await replayCourseEntry(entry, { database, api })
        await outbox.acknowledge(entry.id)
      } catch (error) {
        const permanent = isPermanentError(error)
        if (permanent) permanentFailureIds.push(entry.id)
        else transientFailure = true
        await outbox.recordFailure(entry.id, {
          errorClass: permanent ? 'permanent' : 'transient',
          nextRetryAt: permanent ? null : nowMs + nextBackoffDelayMs(entry.attemptCount ?? 0),
          poison: permanent,
        })
      }
    }

    const rows = await outbox.rows()
    const hasPoison = rows.some((row) => row.poison)
    const remaining = rows.filter((row) => !row.poison).length
    return {
      hasPending: remaining > 0,
      error:
        hasPoison || permanentFailureIds.length > 0
          ? { permanent: true }
          : transientFailure || remaining > 0
            ? { permanent: false }
            : null,
      permanentFailureIds,
    }
  }

  return {
    flush,
    listPoisoned: async () => (await outbox.rows()).filter((row) => row.poison),
    retryPoisoned: outbox.retryPoisoned,
    outbox,
  }
}

const courseSync = createCourseSyncAdapter()

// Serialised for the same reason `flushRoundOutbox` is: several surfaces flush,
// and two concurrent passes would read the same snapshot and send every queued
// write twice.
let flushChain = Promise.resolve()

export function flushCourseOutbox(nowMs) {
  const run = flushChain.then(
    () => courseSync.flush(nowMs ?? Date.now()),
    () => courseSync.flush(nowMs ?? Date.now()),
  )
  flushChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// Every course still in the queue, poisoned or not — i.e. every course that is
// definitely not on the server.
export async function listQueuedCourseIds(database = db) {
  const rows = await createOutboxQueue({ database, tables: [COURSE_TABLE] }).rows()
  return [...new Set(rows.map(courseIdForOutboxEntry).filter(Boolean))]
}

export async function listFailedCourseIds() {
  return [...new Set((await courseSync.listPoisoned()).map(courseIdForOutboxEntry).filter(Boolean))]
}

export async function retryFailedCourseOutbox() {
  return courseSync.retryPoisoned()
}

// DECISION — starting a round on a course that has not reached the server.
//
// It is refused, and told to the user in those words. The realistic field
// sequence (create a course offline, immediately start a round on it) is exactly
// why this needs deciding rather than discovering.
//
// `rounds.course_id` and `rounds.layout_id` are foreign keys into `courses` and
// `layouts`: shared, community-visible tables. Rounds are private and mirrored
// locally by design; course reference data is remote-authoritative (see the
// Dexie v5/v15 notes). A round queued against a queued course would invert that
// — a private row pointing at a shared row that does not exist yet — and would
// need a second cross-queue dependency graph plus an offline hole snapshot for
// the scorecard to render against. Worse, the two failure modes compound: a
// course create that poisons (finding 8's duplicate `hole_number` under a NULL
// `tee_type` is a live example) would strand the round behind it permanently,
// turning one unrecoverable write into two.
//
// The cost of refusing is bounded and short: the course drains on the next
// reconnect and the round starts normally. The cost of allowing it is an
// orphaned round the user cannot see the cause of, which is finding 2's lesson.
export const PENDING_COURSE_ROUND_MESSAGE =
  'This course is saved on this device but has not reached the server yet. A round has to be filed ' +
  'against the shared course record, so start it once the course syncs.'

export async function assertCourseIsSynced(courseId, database = db) {
  if (!courseId) return
  if ((await listQueuedCourseIds(database)).includes(courseId)) {
    throw new Error(PENDING_COURSE_ROUND_MESSAGE)
  }
}

export function useCourseList() {
  const queryClient = useQueryClient()

  useEffect(() => {
    function onOnline() {
      flushCourseOutbox()
        .catch(() => undefined)
        .then(() => queryClient.invalidateQueries({ queryKey: [COURSE_TABLE, 'list'] }))
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [queryClient])

  return useQuery({
    queryKey: [COURSE_TABLE, 'list'],
    queryFn: () => readCourseList(),
    networkMode: 'offlineFirst',
  })
}

export function useCreateCourse(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, location, holes }) => {
      // A local guard only; the RPC raises 28000 on its own if the JWT is
      // missing. Checked here so a signed-out user never queues a write that
      // could not possibly land.
      if (!userId) throw new Error('You must be signed in to create a course')

      const args = buildCourseCreateArgs({ name, location, holes })
      const optimistic = localCourseFromArgs(args, userId)
      try {
        await enqueueAndSend({
          database: db,
          table: COURSE_TABLE,
          op: 'create',
          payload: args,
          idempotencyKey: courseCreateKey(args.p_course_id),
          writeLocal: () => cacheCourse(optimistic),
          remote: () => createCourseWithLayoutRpc(args),
          writeRemote: async (courseId) => {
            try {
              await cacheCourse(await fetchCourse(courseId))
            } catch {
              // See `replayCourseEntry`: the write landed, so a failed
              // read-back must not be reported as a failed create.
            }
          },
        })
        return optimistic
      } catch (error) {
        // The optimistic row and the outbox entry are both valid even when the
        // remote call failed, so the caller can still show the course.
        error.localResult = optimistic
        throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COURSE_TABLE, 'list'] }),
  })
}

// Mirrors `useRoundSync`. `queuedCourseIds` and `failedCourseIds` are reported
// separately because they are different things to say to a user: one is "not
// yet", the other is "not without your help". Both matter here in a way they do
// not for rounds — a queued course is also the reason a round cannot be started
// on it.
export function useCourseSync() {
  const queryClient = useQueryClient()
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.SYNCED)
  const [queuedCourseIds, setQueuedCourseIds] = useState([])
  const [failedCourseIds, setFailedCourseIds] = useState([])
  const schedulerRef = useRef(null)

  useEffect(() => {
    let active = true

    async function refresh() {
      const [queued, failed] = await Promise.all([listQueuedCourseIds(), listFailedCourseIds()])
      if (!active) return
      setQueuedCourseIds(queued)
      setFailedCourseIds(failed)
    }

    const scheduler = createSyncScheduler({
      flush: () => flushCourseOutbox(),
      onStatusChange: (status) => {
        if (!active) return
        setSyncStatus(status)
        refresh().catch(() => undefined)
        if (status === SYNC_STATUS.SYNCED) {
          queryClient.invalidateQueries({ queryKey: [COURSE_TABLE, 'list'] })
        }
      },
    })
    schedulerRef.current = scheduler
    scheduler.start()
    refresh().catch(() => undefined)

    return () => {
      active = false
      scheduler.stop()
      schedulerRef.current = null
    }
  }, [queryClient])

  const retrySync = useCallback(async () => {
    await retryFailedCourseOutbox()
    setFailedCourseIds([])
    schedulerRef.current?.retry()
  }, [])

  return { syncStatus, queuedCourseIds, failedCourseIds, retrySync }
}
