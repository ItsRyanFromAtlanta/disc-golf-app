import { beforeEach, describe, expect, it, vi } from 'vitest'

// roundLog talks to the Supabase singleton directly, so the client is mocked
// rather than injected. The assertions below are about the *shape of the
// request* — which conflict target, which columns — because that is exactly
// what the offline replay path got wrong and what no test covered.

const calls = []

function queryBuilder(table) {
  const builder = {
    upsert(payload, options) {
      calls.push({ table, op: 'upsert', payload, options })
      return builder
    },
    update(payload) {
      calls.push({ table, op: 'update', payload })
      return builder
    },
    select() {
      return builder
    },
    eq() {
      return builder
    },
    in() {
      return builder
    },
    order() {
      return builder
    },
    maybeSingle: () => Promise.resolve({ data: builder.__row, error: null }),
    single: () => Promise.resolve({ data: builder.__row, error: null }),
    then(resolve) {
      return Promise.resolve({ data: [], error: null }).then(resolve)
    },
  }
  // Echo the upserted payload back the way PostgREST would, plus the
  // server-owned id the client no longer sends.
  builder.__row = { id: 'server-owned-id' }
  return builder
}

// Course creation is one RPC now, so the mock records `rpc` alongside the table
// writes — a test that only watched `from()` could not tell "one transaction"
// from "three upserts that happen to be in order".
let rpcResponse = { data: 'server-course-id', error: null }

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (table) => queryBuilder(table),
    rpc: (fn, args) => {
      calls.push({ op: 'rpc', fn, args })
      return Promise.resolve(rpcResponse)
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
  },
}))

const { upsertRoundHole, buildCourseCreateArgs, createCourseWithLayoutRpc, COURSE_CREATE_UNAVAILABLE_MESSAGE } =
  await import('./roundLog')

// The online convenience wrapper this replaces did both halves in one call.
// Course creation is queued now (E2 finding 4), so the args are built at one
// moment and sent at another — possibly days later, from `courseRepository`'s
// outbox replay. Tests follow that split.
function createCourse({ name = 'Oak Grove', location, holes = NINE_HOLES } = {}) {
  return createCourseWithLayoutRpc(buildCourseCreateArgs({ name, location, holes }))
}

const NINE_HOLES = Array.from({ length: 9 }, (_, index) => ({ holeNumber: index + 1, par: 3 }))

function writeCalls() {
  // Reads go through select/eq/order, which the builder does not record, so
  // everything left in `calls` is a write.
  return calls
}

beforeEach(() => {
  calls.length = 0
  rpcResponse = { data: 'server-course-id', error: null }
})

describe('upsertRoundHole', () => {
  it('resolves on the natural key rather than the surrogate id', async () => {
    // round_holes carries `unique (round_id, hole_id)`. Resolving on `id`
    // meant a replay with a regenerated id took the INSERT branch and died on
    // that constraint — permanently, since flushRoundOutbox requeues silently.
    await upsertRoundHole({ roundId: 'round-1', holeId: 'hole-1', score: 3 })

    const [call] = calls
    expect(call.table).toBe('round_holes')
    expect(call.options).toEqual({ onConflict: 'round_id,hole_id' })
  })

  it('does not send id, so a conflict cannot rewrite the primary key', async () => {
    // PostgREST merge-duplicates updates every column supplied. Sending `id`
    // would rewrite the key the local Dexie mirror is indexed by.
    await upsertRoundHole({ id: 'client-generated', roundId: 'round-1', holeId: 'hole-1', score: 4 })

    expect(calls[0].payload).not.toHaveProperty('id')
    expect(calls[0].payload).toMatchObject({ round_id: 'round-1', hole_id: 'hole-1', score: 4 })
  })

  it('converges when the same hole is written twice with different local ids', async () => {
    // The offline case that used to poison the outbox: two optimistic rows for
    // one hole, created either side of a cache clear.
    await upsertRoundHole({ id: 'local-a', roundId: 'round-1', holeId: 'hole-1', score: 3 })
    await upsertRoundHole({ id: 'local-b', roundId: 'round-1', holeId: 'hole-1', score: 5 })

    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.options).toEqual({ onConflict: 'round_id,hole_id' })
      expect(call.payload).not.toHaveProperty('id')
    }
    // Same target row both times — the second write updates rather than
    // inserting a duplicate that the unique constraint would reject.
    expect(calls[0].payload.round_id).toBe(calls[1].payload.round_id)
    expect(calls[0].payload.hole_id).toBe(calls[1].payload.hole_id)
    expect(calls[1].payload.score).toBe(5)
  })

  it('normalises a blank score to null rather than 0', async () => {
    // An untouched hole must stay unplayed; 0 would silently become a score.
    await upsertRoundHole({ roundId: 'round-1', holeId: 'hole-1', score: '' })

    expect(calls[0].payload.score).toBeNull()
  })

  it('coerces numeric strings, which is what the score input produces', async () => {
    await upsertRoundHole({ roundId: 'round-1', holeId: 'hole-1', score: '4' })

    expect(calls[0].payload.score).toBe(4)
  })

  it('refuses a hole with no parent round or hole reference', async () => {
    await expect(upsertRoundHole({ score: 3 })).rejects.toThrow(/roundId and holeId/)
    await expect(upsertRoundHole({ roundId: 'round-1', score: 3 })).rejects.toThrow(/roundId and holeId/)
  })
})

describe('buildCourseCreateArgs', () => {
  it('rejects a course with no name before writing anything', async () => {
    expect(() => buildCourseCreateArgs({ name: '  ', holes: [{ par: 3 }] })).toThrow(/name is required/)
    expect(calls).toHaveLength(0)
  })

  it('rejects a course with no holes before writing anything', async () => {
    // Validating before the args exist matters more now than it did online: an
    // invalid course must never reach the outbox, where it would fail on every
    // reconnect forever instead of being rejected once, immediately, for free.
    expect(() => buildCourseCreateArgs({ name: 'Test Park', holes: [] })).toThrow(/at least one hole/)
    expect(calls).toHaveLength(0)
  })

  it('sends the whole hole set in one payload, snake_cased, without a layout id', () => {
    // `layout_id` is the function's to assign — the holes belong to the layout
    // it creates in the same transaction, so the client cannot pre-bind them.
    const args = buildCourseCreateArgs({
      name: 'Oak Grove',
      holes: [{ holeNumber: 7, par: 5, distanceFeet: '420', teeType: 'Blue', strategyNotes: 'OB left' }],
    })

    expect(args.p_holes).toHaveLength(1)
    expect(args.p_holes[0]).toMatchObject({
      hole_number: 7,
      par: 5,
      distance_feet: 420,
      tee_type: 'Blue',
      strategy_notes: 'OB left',
    })
    expect(args.p_holes[0]).not.toHaveProperty('layout_id')
  })

  it('trims the name and sends a blank location as null', () => {
    const args = buildCourseCreateArgs({ name: '  Oak Grove  ', location: '   ', holes: NINE_HOLES })

    expect(args.p_name).toBe('Oak Grove')
    expect(args.p_location).toBeNull()
  })

  it('falls back to array position for hole_number and 3 for par', () => {
    const args = buildCourseCreateArgs({ name: 'Oak Grove', holes: [{}, {}, {}] })

    expect(args.p_holes.map((hole) => hole.hole_number)).toEqual([1, 2, 3])
    expect(args.p_holes.map((hole) => hole.par)).toEqual([3, 3, 3])
  })

  it('generates the ids client-side so the same args can be replayed safely', () => {
    // This is what makes the call queueable at all: a replay that regenerated
    // its ids would create a second course on every reconnect.
    const args = buildCourseCreateArgs({ name: 'Oak Grove', holes: NINE_HOLES })
    const uuid = /^[0-9a-f-]{36}$/i

    expect(args.p_course_id).toMatch(uuid)
    expect(args.p_layout_id).toMatch(uuid)
    expect(args.p_course_id).not.toBe(args.p_layout_id)
    for (const hole of args.p_holes) expect(hole.id).toMatch(uuid)
  })

  it('carries no owner id — the function derives attribution from auth.uid()', () => {
    // `created_by` used to come from the client. It is not in the args at all,
    // which also means attribution survives an outbox replay: the owner is
    // resolved from the JWT when the call lands, not when it was queued.
    const args = buildCourseCreateArgs({ name: 'Oak Grove', holes: NINE_HOLES })

    expect(args).not.toHaveProperty('p_user_id')
    expect(args).not.toHaveProperty('p_created_by')
    expect(JSON.stringify(args)).not.toMatch(/user|created_by/i)
  })
})

describe('createCourseWithLayoutRpc', () => {
  it('writes the course, its layout and its holes in a single transactional RPC', async () => {
    // The whole point of finding 3's change: three sequential upserts could
    // leave an orphan course or an empty layout visible to every authenticated
    // user, with no client-side repair path. One RPC is one transaction — and
    // one queueable unit, with no "which of the three already landed" state.
    await createCourse({ location: 'Pasadena' })

    expect(writeCalls()).toHaveLength(1)
    expect(writeCalls()[0].op).toBe('rpc')
    expect(writeCalls()[0].fn).toBe('create_course_with_layout')
  })

  it('no longer upserts courses, layouts or holes directly', async () => {
    await createCourse()

    const tables = writeCalls()
      .filter((call) => call.op === 'upsert')
      .map((call) => call.table)
    expect(tables).toEqual([])
  })

  it('returns the course id and does not read the course back', async () => {
    // The read-back is deliberately not part of the queued unit: an outbox
    // replay has no caller to hand a hydrated course to, and a read that fails
    // after the write landed must not look like a write that failed.
    const courseId = await createCourse()

    expect(courseId).toBe('server-course-id')
    expect(writeCalls()).toHaveLength(1)
  })

  it('falls back to the client-generated id when the function returns nothing', async () => {
    rpcResponse = { data: null, error: null }
    const args = buildCourseCreateArgs({ name: 'Oak Grove', holes: NINE_HOLES })

    await expect(createCourseWithLayoutRpc(args)).resolves.toBe(args.p_course_id)
  })

  it('replays the same args without changing a single id', async () => {
    // The reconnect case: a queued entry is replayed with the args recorded at
    // creation time, so the RPC's idempotent early return recognises the course
    // instead of inserting a second one.
    const args = buildCourseCreateArgs({ name: 'Oak Grove', holes: NINE_HOLES })
    await createCourseWithLayoutRpc(args)
    await createCourseWithLayoutRpc(args)

    expect(writeCalls()).toHaveLength(2)
    expect(writeCalls()[0].args).toEqual(writeCalls()[1].args)
  })

  it('explains a missing function instead of leaking the PostgREST string', async () => {
    // `main` auto-deploys, so there is always a window where the button is live
    // and the migration is not. PGRST202 and 42883 both mean "not deployed yet".
    for (const code of ['PGRST202', '42883']) {
      calls.length = 0
      rpcResponse = { data: null, error: { code, message: 'Could not find the function in the schema cache' } }
      await expect(createCourse()).rejects.toThrow(COURSE_CREATE_UNAVAILABLE_MESSAGE)
    }
  })

  it('rethrows any other failure with its message intact', async () => {
    // A constraint or RLS rejection is rolled back whole by the function, so
    // the real message is more useful to the user than a generic one.
    rpcResponse = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }

    await expect(createCourse()).rejects.toThrow(/duplicate key value/)
  })

  it('attaches the HTTP status, which is what makes a rejected course poison rather than retry', async () => {
    // A PostgrestError carries `code` but never `status`, and the outbox's
    // classifier only knows four Postgres codes by number. The RPC's own
    // validation raises 22023 / 28000 / 42501 — none of them in that set — so
    // without the status a permanently rejected course would be classified
    // transient and re-sent on every reconnect, forever, invisibly. That is
    // finding 2 on a different queue.
    rpcResponse = { data: null, error: { code: '22023', message: 'Course name is required' }, status: 400 }

    await expect(createCourse()).rejects.toMatchObject({ status: 400, code: '22023' })
  })

  it('leaves a network-level failure classifiable as transient', async () => {
    // No status, no known code: the reconnect case, which must stay retryable.
    rpcResponse = { data: null, error: { message: 'Failed to fetch' } }

    const error = await createCourse().catch((err) => err)
    expect(error.status).toBeUndefined()
    expect(error.message).toBe('Failed to fetch')
  })
})
