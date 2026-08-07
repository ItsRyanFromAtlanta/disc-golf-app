import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: { from: (...args) => client.from(...args), auth: {} } }))

import {
  createCourseWithLayout,
  fetchRound,
  fetchRounds,
  upsertRoundHole,
} from './roundLog'

let client

/**
 * Minimal PostgREST stand-in: tables of rows, `eq`/`in` filters, `order`, and
 * an `upsert` that merges on the primary key the way `onConflict: 'id'` does.
 * `failWrites` reproduces a write that fails part-way through a multi-statement
 * sequence, which is the case the retry-safe course ids exist for.
 */
function createClient(seed = {}) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]))
  const writes = []
  const failWrites = new Set()

  function rowsFor(table) {
    if (!tables.has(table)) tables.set(table, [])
    return tables.get(table)
  }

  function from(table) {
    const filters = []
    const orderBy = []
    let staged = null
    let failure = null

    function read() {
      if (staged) return staged
      let rows = rowsFor(table).map((row) => ({ ...row }))
      for (const [operator, column, value] of filters) {
        rows = operator === 'in'
          ? rows.filter((row) => value.includes(row[column]))
          : rows.filter((row) => row[column] === value)
      }
      for (const [column, ascending] of [...orderBy].reverse()) {
        rows.sort((left, right) => {
          const compared = String(left[column] ?? '').localeCompare(String(right[column] ?? ''))
          return ascending ? compared : -compared
        })
      }
      return rows
    }

    function settle(data) {
      return Promise.resolve(failure ? { data: null, error: failure } : { data, error: null })
    }

    const builder = {
      select: () => builder,
      eq(column, value) {
        filters.push(['eq', column, value])
        return builder
      },
      in(column, value) {
        filters.push(['in', column, value])
        return builder
      },
      order(column, { ascending = true } = {}) {
        orderBy.push([column, ascending])
        return builder
      },
      upsert(payload) {
        const incoming = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ ...row }))
        writes.push({ table, op: 'upsert', rows: incoming })
        if (failWrites.has(table)) {
          failure = { message: `${table} write rejected` }
          return builder
        }
        const rows = rowsFor(table)
        for (const row of incoming) {
          const index = rows.findIndex((existing) => existing.id === row.id)
          if (index >= 0) rows[index] = { ...rows[index], ...row }
          else rows.push(row)
        }
        staged = incoming
        return builder
      },
      update(payload) {
        writes.push({ table, op: 'update', rows: [payload] })
        const matched = read()
        const rows = rowsFor(table)
        staged = matched.map((match) => {
          const index = rows.findIndex((existing) => existing.id === match.id)
          rows[index] = { ...rows[index], ...payload }
          return { ...rows[index] }
        })
        return builder
      },
      single: () => settle(read()[0] ?? null),
      maybeSingle: () => settle(read()[0] ?? null),
      then: (resolve, reject) => settle(read()).then(resolve, reject),
    }
    return builder
  }

  return { from, writes, failWrites, rowsFor, tables }
}

function upsertsFor(table) {
  return client.writes.filter((write) => write.table === table && write.op === 'upsert')
}

describe('roundLog round holes', () => {
  beforeEach(() => {
    client = createClient({
      round_holes: [{ id: 'stored-row', round_id: 'round-1', hole_id: 'hole-1', score: 3, disc_id: null, notes: null }],
    })
  })

  it('writes a hole that has no row yet under the id the client generated', async () => {
    const saved = await upsertRoundHole({ id: 'fresh-row', roundId: 'round-1', holeId: 'hole-2', score: 4 })

    expect(saved.id).toBe('fresh-row')
    expect(saved.score).toBe(4)
    expect(client.rowsFor('round_holes')).toHaveLength(2)
  })

  // `round_holes` is uniquely keyed on (round_id, hole_id). A second device —
  // or this one after a cache eviction — generates a new row id for a hole the
  // server already stores, and upserting that on `id` alone would insert a
  // duplicate the unique index rejects on every retry.
  it('reuses the stored id when the hole already has a row under a different key', async () => {
    const saved = await upsertRoundHole({ id: 'other-device-row', roundId: 'round-1', holeId: 'hole-1', score: 5 })

    expect(saved.id).toBe('stored-row')
    expect(saved.score).toBe(5)
    expect(client.rowsFor('round_holes')).toHaveLength(1)
    expect(upsertsFor('round_holes')[0].rows[0].id).toBe('stored-row')
  })

  it('keeps rows for the same hole number in different rounds separate', async () => {
    await upsertRoundHole({ id: 'round-2-row', roundId: 'round-2', holeId: 'hole-1', score: 2 })

    expect(client.rowsFor('round_holes')).toHaveLength(2)
    expect(upsertsFor('round_holes')[0].rows[0].id).toBe('round-2-row')
  })

  it('rejects a hole write that names no round or hole', async () => {
    await expect(upsertRoundHole({ roundId: 'round-1' })).rejects.toThrow(/roundId and holeId/)
  })
})

describe('createCourseWithLayout', () => {
  beforeEach(() => {
    client = createClient()
  })

  it('creates the course, its default layout, and every hole', async () => {
    const course = await createCourseWithLayout({
      userId: 'user-1',
      name: '  East Roswell Park  ',
      location: '  Roswell, GA  ',
      holes: [{ holeNumber: 1, par: 3 }, { holeNumber: 2, par: 4 }],
    })

    expect(course.name).toBe('East Roswell Park')
    expect(course.location).toBe('Roswell, GA')
    expect(course.layouts).toHaveLength(1)
    expect(course.layouts[0]).toMatchObject({ name: 'Main', is_default: true })
    expect(course.layouts[0].holes.map((hole) => hole.par)).toEqual([3, 4])
  })

  it('requires an owner, a name, and at least one hole', async () => {
    await expect(createCourseWithLayout({ userId: 'user-1', name: '  ', holes: [{ par: 3 }] })).rejects.toThrow(
      /Course name is required/,
    )
    await expect(createCourseWithLayout({ userId: 'user-1', name: 'Bare', holes: [] })).rejects.toThrow(
      /at least one hole/,
    )
  })

  // The three writes are not transactional and J1 grants no delete policy on
  // courses, layouts, or holes, so a retry that minted fresh ids would strand
  // the first attempt's rows in the shared directory permanently.
  it('completes the first attempt on retry instead of stranding a second course', async () => {
    const draft = {
      userId: 'user-1',
      courseId: 'course-draft',
      layoutId: 'layout-draft',
      name: 'Flat Creek',
      holes: [{ id: 'hole-draft-1', holeNumber: 1, par: 3 }],
    }

    client.failWrites.add('holes')
    await expect(createCourseWithLayout(draft)).rejects.toThrow(/holes write rejected/)
    expect(client.rowsFor('courses')).toHaveLength(1)

    client.failWrites.delete('holes')
    const course = await createCourseWithLayout(draft)

    expect(course.id).toBe('course-draft')
    expect(client.rowsFor('courses')).toHaveLength(1)
    expect(client.rowsFor('layouts')).toHaveLength(1)
    expect(client.rowsFor('holes')).toHaveLength(1)
  })
})

describe('round hydration', () => {
  beforeEach(() => {
    client = createClient({
      rounds: [
        { id: 'round-1', user_id: 'user-1', course_id: 'course-1', layout_id: 'layout-1', played_at: '2026-07-02' },
        { id: 'round-2', user_id: 'user-1', course_id: 'course-1', layout_id: null, played_at: '2026-07-01' },
        { id: 'round-3', user_id: 'user-2', course_id: 'course-1', layout_id: 'layout-1', played_at: '2026-07-03' },
      ],
      courses: [{ id: 'course-1', name: 'Flat Creek' }],
      layouts: [{ id: 'layout-1', course_id: 'course-1', name: 'Long', is_default: true }],
      holes: [
        { id: 'hole-1', layout_id: 'layout-1', hole_number: 1, par: 3 },
        { id: 'hole-2', layout_id: 'layout-1', hole_number: 2, par: 4 },
        { id: 'hole-retired', layout_id: 'layout-9', hole_number: 3, par: 3 },
      ],
      round_holes: [
        { id: 'rh-1', round_id: 'round-1', hole_id: 'hole-1', score: 3, disc_id: 'disc-1' },
        { id: 'rh-2', round_id: 'round-1', hole_id: 'hole-retired', score: 5, disc_id: null },
      ],
      discs: [{ id: 'disc-1', nickname: 'Beat Roc' }],
    })
  })

  it('attaches the course and layout to every listed round', async () => {
    const rounds = await fetchRounds('user-1')

    expect(rounds.map((round) => round.id)).toEqual(['round-1', 'round-2'])
    expect(rounds[0].course.name).toBe('Flat Creek')
    expect(rounds[0].layout.name).toBe('Long')
    expect(rounds[1].layout).toBeNull()
  })

  // A layout can be re-cut after a round is played. The scores recorded against
  // its removed holes still belong to the round and must survive the read.
  it('keeps scored holes that the round layout no longer lists', async () => {
    const round = await fetchRound('round-1')

    expect(round.course.name).toBe('Flat Creek')
    expect(round.layout.holes.map((hole) => hole.id)).toEqual(['hole-1', 'hole-2'])
    expect(round.holes.map((hole) => hole.id)).toEqual(['hole-1', 'hole-2', 'hole-retired'])
    expect(round.round_holes.find((row) => row.id === 'rh-2').hole.id).toBe('hole-retired')
    expect(round.round_holes.find((row) => row.id === 'rh-1').disc.nickname).toBe('Beat Roc')
  })

  it('reads a round that never resolved a layout', async () => {
    const round = await fetchRound('round-2')

    expect(round.layout).toBeNull()
    expect(round.holes).toEqual([])
    expect(round.round_holes).toEqual([])
  })
})
