import { beforeEach, describe, expect, it, vi } from 'vitest'

// A separate file from `roundLog.test.js` on purpose. That mock answers every
// list query with `[]`, which is right for the write-shape assertions it makes
// and useless for reading a round back. Rather than rework a mock thirty passing
// tests depend on, this one serves per-table rows.

const tables = {
  rounds: [],
  courses: [],
  layouts: [],
  round_holes: [],
  holes: [],
  discs: [],
}

function queryBuilder(table) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve({ data: tables[table]?.[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: tables[table]?.[0] ?? null, error: null }),
    then(resolve) {
      return Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve)
    },
  }
  return builder
}

vi.mock('./supabaseClient', () => ({
  supabase: { from: (table) => queryBuilder(table) },
}))

const { fetchRound } = await import('./roundLog')

// UUIDs, because that is the point: `hole_id` is a UUID, so any order derived
// from it is arbitrary. These are deliberately chosen so that sorting the ids as
// strings produces the *reverse* of play order — a test using ids that happened
// to sort correctly would pass against the bug.
const HOLE_IDS = {
  1: 'fff00000-0000-4000-8000-000000000001',
  2: 'aaa00000-0000-4000-8000-000000000002',
  3: '00000000-0000-4000-8000-000000000003',
}

beforeEach(() => {
  tables.rounds = [{ id: 'round-1', course_id: 'course-1', layout_id: 'layout-1' }]
  tables.courses = [{ id: 'course-1', name: 'Oak Grove' }]
  tables.layouts = [{ id: 'layout-1', name: 'Main' }]
  tables.holes = []
  tables.round_holes = []
  tables.discs = []
})

describe('fetchRound hole ordering', () => {
  it('returns round holes in play order, not in hole_id order', async () => {
    tables.holes = [
      { id: HOLE_IDS[1], layout_id: 'layout-1', hole_number: 1, tee_type: null },
      { id: HOLE_IDS[2], layout_id: 'layout-1', hole_number: 2, tee_type: null },
      { id: HOLE_IDS[3], layout_id: 'layout-1', hole_number: 3, tee_type: null },
    ]
    // Arriving shuffled, which is what an arbitrary UUID order looks like.
    tables.round_holes = [
      { id: 'rh-3', round_id: 'round-1', hole_id: HOLE_IDS[3], score: 4 },
      { id: 'rh-1', round_id: 'round-1', hole_id: HOLE_IDS[1], score: 3 },
      { id: 'rh-2', round_id: 'round-1', hole_id: HOLE_IDS[2], score: 5 },
    ]

    const round = await fetchRound('round-1')

    expect(round.round_holes.map((row) => row.hole.hole_number)).toEqual([1, 2, 3])
    // The scores travel with their holes — a sort that reordered one and not the
    // other would still satisfy the assertion above.
    expect(round.round_holes.map((row) => row.score)).toEqual([3, 5, 4])
  })

  it('sorts an unresolvable hole last rather than ahead of hole 1', async () => {
    tables.holes = [{ id: HOLE_IDS[1], layout_id: 'layout-1', hole_number: 1, tee_type: null }]
    tables.round_holes = [
      // No matching row in `holes`, so `hole` resolves to null. A naive
      // numeric sort puts `undefined` first, which would hide hole 1.
      { id: 'rh-orphan', round_id: 'round-1', hole_id: 'dddddddd-0000-4000-8000-00000000000f', score: 9 },
      { id: 'rh-1', round_id: 'round-1', hole_id: HOLE_IDS[1], score: 3 },
    ]

    const round = await fetchRound('round-1')

    expect(round.round_holes.map((row) => row.id)).toEqual(['rh-1', 'rh-orphan'])
  })

  it('orders two tees on the same hole number deterministically', async () => {
    tables.holes = [
      { id: HOLE_IDS[1], layout_id: 'layout-1', hole_number: 1, tee_type: 'blue' },
      { id: HOLE_IDS[2], layout_id: 'layout-1', hole_number: 1, tee_type: null },
    ]
    tables.round_holes = [
      { id: 'rh-blue', round_id: 'round-1', hole_id: HOLE_IDS[1], score: 3 },
      { id: 'rh-default', round_id: 'round-1', hole_id: HOLE_IDS[2], score: 4 },
    ]

    const round = await fetchRound('round-1')

    // Null tee first, matching how the layout-hole queries order `tee_type`.
    expect(round.round_holes.map((row) => row.id)).toEqual(['rh-default', 'rh-blue'])
  })

  it('does not mutate the rows it was given', async () => {
    tables.holes = [
      { id: HOLE_IDS[1], layout_id: 'layout-1', hole_number: 1 },
      { id: HOLE_IDS[2], layout_id: 'layout-1', hole_number: 2 },
    ]
    tables.round_holes = [
      { id: 'rh-2', round_id: 'round-1', hole_id: HOLE_IDS[2], score: 5 },
      { id: 'rh-1', round_id: 'round-1', hole_id: HOLE_IDS[1], score: 3 },
    ]

    await fetchRound('round-1')

    expect(tables.round_holes.map((row) => row.id)).toEqual(['rh-2', 'rh-1'])
  })
})
