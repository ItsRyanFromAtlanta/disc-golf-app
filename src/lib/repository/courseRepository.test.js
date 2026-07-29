import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import { enqueueAndSend } from './outboxQueue'
import {
  PENDING_COURSE_ROUND_MESSAGE,
  assertCourseIsSynced,
  courseCreateKey,
  courseIdForOutboxEntry,
  createCourseSyncAdapter,
  listQueuedCourseIds,
  localCourseFromArgs,
  readCourseList,
} from './courseRepository'

const COURSE_ID = 'course-1'
const LAYOUT_ID = 'layout-1'
const NOW = Date.parse('2026-07-29T12:00:00.000Z')

// Shaped the way `roundLog.js` rethrows them.
const NETWORK_ERROR = Object.assign(new TypeError('Failed to fetch'), {})
const VALIDATION_REJECTION = Object.assign(new Error('Course name is required'), { code: '22023', status: 400 })
const DUPLICATE_HOLE = Object.assign(new Error('duplicate key value'), { code: '23505' })

function createArgs(overrides = {}) {
  return {
    p_name: 'Oak Grove',
    p_location: 'Pasadena',
    p_holes: [
      { id: 'hole-1', hole_number: 1, par: 3, distance_feet: null, tee_type: null, hazards: null, strategy_notes: null },
    ],
    p_course_id: COURSE_ID,
    p_layout_id: LAYOUT_ID,
    ...overrides,
  }
}

describe('courseRepository course outbox', () => {
  let database
  let api

  function adapter() {
    return createCourseSyncAdapter({ database, api })
  }

  async function queueCreate(payload = createArgs(), overrides = {}) {
    return database.outbox.add({
      table: 'courses',
      op: 'create',
      payload,
      createdAt: NOW,
      idempotencyKey: courseCreateKey(payload.p_course_id),
      dependencyKey: null,
      attemptCount: 0,
      lastErrorClass: null,
      nextRetryAt: null,
      poison: false,
      ...overrides,
    })
  }

  beforeEach(async () => {
    database = createAppDatabase(`CourseRepository-${crypto.randomUUID()}`)
    await database.open()
    api = {
      createCourseWithLayoutRpc: vi.fn(async (args) => args.p_course_id),
      fetchCourse: vi.fn(async (courseId) => ({
        id: courseId,
        name: 'Oak Grove',
        location: 'Pasadena',
        created_by: 'user-1',
        layouts: [{ id: LAYOUT_ID, course_id: courseId, name: 'Main', is_default: true, holes: [{ id: 'hole-1' }] }],
      })),
    }
  })

  afterEach(async () => database.delete())

  it('clears the entry and caches the server course when a queued create succeeds', async () => {
    await queueCreate()

    const result = await adapter().flush(NOW)

    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(1)
    expect(api.createCourseWithLayoutRpc.mock.calls[0][0]).toMatchObject({ p_course_id: COURSE_ID })
    expect(await database.outbox.count()).toBe(0)
    expect(await database.courses.get(COURSE_ID)).toMatchObject({ id: COURSE_ID, created_by: 'user-1' })
    expect(result).toMatchObject({ hasPending: false, error: null, permanentFailureIds: [] })
  })

  it('sends one RPC per queued course — the whole write is a single unit', async () => {
    // Finding 3's RPC is what makes this queueable: one call, one args object,
    // no "which of the three writes already landed" replay state.
    await queueCreate()
    await adapter().flush(NOW)

    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(1)
  })

  it('replays the recorded args verbatim, so ids do not change between attempts', async () => {
    // The RPC's idempotent early return is keyed on `p_course_id`. If a replay
    // regenerated ids, every reconnect would publish another copy of the same
    // course into shared, community-visible data.
    api.createCourseWithLayoutRpc.mockRejectedValueOnce(NETWORK_ERROR)
    await queueCreate()

    await adapter().flush(NOW)
    await adapter().flush(NOW + 2000)

    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(2)
    expect(api.createCourseWithLayoutRpc.mock.calls[0][0]).toEqual(api.createCourseWithLayoutRpc.mock.calls[1][0])
    expect(await database.outbox.count()).toBe(0)
  })

  it('acknowledges the entry when the write lands but the read-back fails', async () => {
    // The obstacle finding 4 named: `createCourseWithLayout` used to end in an
    // online read that a replay has nothing to return to. Splitting them means
    // a failed hydrate cannot requeue a course that is already on the server —
    // which would otherwise report as unsynced forever.
    api.fetchCourse.mockRejectedValue(NETWORK_ERROR)
    await queueCreate()

    const result = await adapter().flush(NOW)

    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(1)
    expect(await database.outbox.count()).toBe(0)
    expect(result).toMatchObject({ hasPending: false, error: null })
  })

  it('increments the attempt count and stays queued when the failure is transient', async () => {
    api.createCourseWithLayoutRpc.mockRejectedValue(NETWORK_ERROR)
    await queueCreate()

    const first = await adapter().flush(NOW)

    expect(first).toMatchObject({ hasPending: true, error: { permanent: false }, permanentFailureIds: [] })
    expect((await database.outbox.toArray())[0]).toMatchObject({
      attemptCount: 1,
      lastErrorClass: 'transient',
      poison: false,
      nextRetryAt: NOW + 2000, // shared backoff curve: 2s, 4s, 8s ... capped at 60s
    })

    // Still inside the backoff window: nothing is retried.
    await adapter().flush(NOW + 1000)
    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(1)

    await adapter().flush(NOW + 2000)
    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(2)
    expect((await database.outbox.toArray())[0]).toMatchObject({
      attemptCount: 2,
      nextRetryAt: NOW + 2000 + 4000,
    })
  })

  it('poisons a permanently rejected course instead of retrying it forever', async () => {
    // 22023 comes from the RPC's own validation and is not one of the four
    // Postgres codes the classifier knows, so the HTTP status carried alongside
    // it is what makes this permanent rather than an endless retry loop.
    api.createCourseWithLayoutRpc.mockRejectedValue(VALIDATION_REJECTION)
    await queueCreate()

    const result = await adapter().flush(NOW)

    const [row] = await database.outbox.toArray()
    expect(row).toMatchObject({ attemptCount: 1, lastErrorClass: 'permanent', poison: true, nextRetryAt: null })
    expect(result).toMatchObject({ hasPending: false, error: { permanent: true } })
    expect(result.permanentFailureIds).toEqual([row.id])

    await adapter().flush(NOW + 60_000)
    await adapter().flush(NOW + 600_000)
    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(1)
  })

  it('poisons a duplicate-hole constraint violation by Postgres code alone', async () => {
    // Finding 8 is live: `holes_layout_hole_tee_uniq` does not prevent duplicate
    // hole_numbers when tee_type is NULL, and every quick course is in that
    // branch. When it does fire it is 23505 — permanent, and it must not spin.
    api.createCourseWithLayoutRpc.mockRejectedValue(DUPLICATE_HOLE)
    await queueCreate()

    await adapter().flush(NOW)

    expect((await database.outbox.toArray())[0]).toMatchObject({ poison: true, lastErrorClass: 'permanent' })
  })

  it('surfaces poisoned entries by course and lets an explicit retry requeue them', async () => {
    api.createCourseWithLayoutRpc.mockRejectedValue(VALIDATION_REJECTION)
    await queueCreate()
    const sync = adapter()
    await sync.flush(NOW)

    const poisoned = await sync.listPoisoned()
    expect(poisoned.map(courseIdForOutboxEntry)).toEqual([COURSE_ID])

    expect(await sync.retryPoisoned()).toBe(1)
    expect((await database.outbox.toArray())[0]).toMatchObject({
      poison: false,
      nextRetryAt: null,
      lastErrorClass: null,
      attemptCount: 1, // history is kept; only the retry gate is cleared
    })

    api.createCourseWithLayoutRpc.mockImplementation(async (args) => args.p_course_id)
    await expect(sync.flush(NOW + 1000)).resolves.toMatchObject({ hasPending: false, error: null })
    expect(await database.outbox.count()).toBe(0)
  })

  it('leaves outbox rows belonging to other queues untouched', async () => {
    await database.outbox.add({ table: 'rounds', op: 'create', payload: { id: 'round-1' }, createdAt: NOW, poison: false })
    api.createCourseWithLayoutRpc.mockRejectedValue(NETWORK_ERROR)
    await queueCreate()

    await adapter().flush(NOW)

    const round = await database.outbox.where('table').equals('rounds').first()
    expect(round).not.toHaveProperty('attemptCount')
    expect(round).not.toHaveProperty('lastErrorClass')
    expect(api.createCourseWithLayoutRpc).toHaveBeenCalledTimes(1)
  })

  it('maps a queued entry back to the course the user would recognise', () => {
    expect(courseIdForOutboxEntry({ table: 'courses', op: 'create', payload: { p_course_id: COURSE_ID } })).toBe(
      COURSE_ID,
    )
    expect(courseIdForOutboxEntry({ table: 'rounds', op: 'create', payload: { id: 'round-1' } })).toBeNull()
    expect(courseIdForOutboxEntry(null)).toBeNull()
  })

  it('namespaces its idempotency key away from every other queue', () => {
    // The history-recovery queue resolves dependency keys against *every*
    // queued row, so an un-namespaced key would couple independent queues.
    expect(courseCreateKey(COURSE_ID)).toBe('course-outbox:course-1:create')
    expect(courseCreateKey(COURSE_ID)).not.toBe(`round-outbox:${COURSE_ID}:create`)
  })
})

describe('optimistic local course', () => {
  let database

  beforeEach(async () => {
    database = createAppDatabase(`CourseRepositoryLocal-${crypto.randomUUID()}`)
    await database.open()
  })

  afterEach(async () => database.delete())

  it('mirrors the shape fetchCourse returns, so a queued course is immediately usable', () => {
    const course = localCourseFromArgs(createArgs(), 'user-1')

    expect(course).toMatchObject({ id: COURSE_ID, name: 'Oak Grove', location: 'Pasadena', created_by: 'user-1' })
    expect(course.layouts).toHaveLength(1)
    expect(course.layouts[0]).toMatchObject({ id: LAYOUT_ID, course_id: COURSE_ID, is_default: true })
    expect(course.layouts[0].holes).toEqual([expect.objectContaining({ id: 'hole-1', layout_id: LAYOUT_ID })])
  })

  it('writes the optimistic course and the outbox entry before the network is touched', async () => {
    // The field case: the RPC never resolves, and the course still has to exist
    // locally and be queued for the next reconnect.
    const args = createArgs()
    const optimistic = localCourseFromArgs(args, 'user-1')

    await expect(
      enqueueAndSend({
        database,
        table: 'courses',
        op: 'create',
        payload: args,
        idempotencyKey: courseCreateKey(args.p_course_id),
        writeLocal: () => database.courses.put(optimistic),
        remote: () => Promise.reject(NETWORK_ERROR),
        writeRemote: () => undefined,
      }),
    ).rejects.toThrow(/Failed to fetch/)

    expect(await database.courses.get(COURSE_ID)).toMatchObject({ id: COURSE_ID, name: 'Oak Grove' })
    const [row] = await database.outbox.toArray()
    expect(row).toMatchObject({
      table: 'courses',
      op: 'create',
      idempotencyKey: courseCreateKey(COURSE_ID),
      attemptCount: 0,
      poison: false,
    })
    expect(row.payload).toEqual(args)
  })

  it('lists a queued course as not-on-the-server, poisoned or not', async () => {
    await database.outbox.add({
      table: 'courses',
      op: 'create',
      payload: createArgs(),
      createdAt: NOW,
      idempotencyKey: courseCreateKey(COURSE_ID),
      poison: true,
    })

    expect(await listQueuedCourseIds(database)).toEqual([COURSE_ID])
  })
})

describe('reading the course directory', () => {
  let database

  async function queue(courseId) {
    return database.outbox.add({
      table: 'courses',
      op: 'create',
      payload: createArgs({ p_course_id: courseId }),
      createdAt: NOW,
      idempotencyKey: courseCreateKey(courseId),
      poison: false,
    })
  }

  beforeEach(async () => {
    database = createAppDatabase(`CourseRepositoryRead-${crypto.randomUUID()}`)
    await database.open()
  })

  afterEach(async () => database.delete())

  it('shows a queued course alongside the remote directory it is not in yet', async () => {
    // The course the player just built is the one they most need to see, and by
    // definition it is not in the community directory yet.
    await database.courses.put(localCourseFromArgs(createArgs(), 'user-1'))
    await queue(COURSE_ID)
    const api = { fetchCourses: async () => [{ id: 'remote-1', name: 'Alta Vista' }] }

    const list = await readCourseList(database, api)

    expect(list.map((row) => row.id)).toEqual(['remote-1', COURSE_ID]) // sorted by name
  })

  it('does not add a course back once it has landed in the remote directory', async () => {
    await database.courses.put(localCourseFromArgs(createArgs(), 'user-1'))
    const api = { fetchCourses: async () => [{ id: COURSE_ID, name: 'Oak Grove' }] }

    const list = await readCourseList(database, api)

    expect(list.map((row) => row.id)).toEqual([COURSE_ID])
  })

  it('merges the lightweight directory row over the cache instead of replacing it', async () => {
    // `fetchCourses` selects no layouts and no holes. Writing those rows
    // straight over the cache would strip the layout a locally-created course
    // is carrying — the very data the offline scorecard would need.
    await database.courses.put(localCourseFromArgs(createArgs(), 'user-1'))
    const api = { fetchCourses: async () => [{ id: COURSE_ID, name: 'Oak Grove Renamed', location: 'Pasadena' }] }

    await readCourseList(database, api)

    const cached = await database.courses.get(COURSE_ID)
    expect(cached.name).toBe('Oak Grove Renamed')
    expect(cached.layouts[0].holes).toHaveLength(1)
  })

  it('falls back to the local mirror when the directory read fails', async () => {
    await database.courses.put(localCourseFromArgs(createArgs(), 'user-1'))
    const api = {
      fetchCourses: async () => {
        throw NETWORK_ERROR
      },
    }

    await expect(readCourseList(database, api)).resolves.toMatchObject([{ id: COURSE_ID }])
  })

  it('reports the failure when there is nothing cached to fall back to', async () => {
    const api = {
      fetchCourses: async () => {
        throw NETWORK_ERROR
      },
    }

    await expect(readCourseList(database, api)).rejects.toThrow(/Failed to fetch/)
  })
})

// The realistic field sequence: build a course standing on it with no signal,
// then immediately try to start a round. See PENDING_COURSE_ROUND_MESSAGE for
// why this is refused rather than queued behind the course.
describe('starting a round against a course that has not reached the server', () => {
  let database

  beforeEach(async () => {
    database = createAppDatabase(`CoursePending-${crypto.randomUUID()}`)
    await database.open()
  })

  afterEach(async () => database.delete())

  it('refuses while the course create is still queued', async () => {
    await database.outbox.add({
      table: 'courses',
      op: 'create',
      payload: createArgs(),
      createdAt: NOW,
      idempotencyKey: courseCreateKey(COURSE_ID),
      poison: false,
    })

    await expect(assertCourseIsSynced(COURSE_ID, database)).rejects.toThrow(PENDING_COURSE_ROUND_MESSAGE)
  })

  it('still refuses once that create has poisoned — that course is further from the server, not closer', async () => {
    await database.outbox.add({
      table: 'courses',
      op: 'create',
      payload: createArgs(),
      createdAt: NOW,
      idempotencyKey: courseCreateKey(COURSE_ID),
      poison: true,
    })

    await expect(assertCourseIsSynced(COURSE_ID, database)).rejects.toThrow(PENDING_COURSE_ROUND_MESSAGE)
  })

  it('allows it as soon as the course create drains', async () => {
    const id = await database.outbox.add({
      table: 'courses',
      op: 'create',
      payload: createArgs(),
      createdAt: NOW,
      idempotencyKey: courseCreateKey(COURSE_ID),
      poison: false,
    })
    await database.outbox.delete(id)

    await expect(assertCourseIsSynced(COURSE_ID, database)).resolves.toBeUndefined()
  })

  it('does not block a round on some other queued course, or on no course at all', async () => {
    await database.outbox.add({
      table: 'courses',
      op: 'create',
      payload: createArgs({ p_course_id: 'other-course' }),
      createdAt: NOW,
      idempotencyKey: courseCreateKey('other-course'),
      poison: false,
    })

    await expect(assertCourseIsSynced(COURSE_ID, database)).resolves.toBeUndefined()
    await expect(assertCourseIsSynced(null, database)).resolves.toBeUndefined()
  })
})
