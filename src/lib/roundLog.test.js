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

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (table) => queryBuilder(table),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
  },
}))

const { upsertRoundHole, createCourseWithLayout } = await import('./roundLog')

beforeEach(() => {
  calls.length = 0
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

describe('createCourseWithLayout', () => {
  it('rejects a course with no name before writing anything', async () => {
    await expect(createCourseWithLayout({ userId: 'user-1', name: '  ', holes: [{ par: 3 }] })).rejects.toThrow(
      /name is required/,
    )
    expect(calls).toHaveLength(0)
  })

  it('rejects a course with no holes before writing anything', async () => {
    await expect(createCourseWithLayout({ userId: 'user-1', name: 'Test Park', holes: [] })).rejects.toThrow(
      /at least one hole/,
    )
    expect(calls).toHaveLength(0)
  })
})
