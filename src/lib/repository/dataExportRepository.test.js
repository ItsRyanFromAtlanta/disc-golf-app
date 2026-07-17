import { describe, expect, it, vi } from 'vitest'
import { createDataExportRepository, EXPORT_PAGE_SIZE } from './dataExportRepository'

function createClient(tables) {
  const calls = []
  return {
    calls,
    from: vi.fn((table) => {
      const state = { table, filters: [], start: 0, end: Number.MAX_SAFE_INTEGER, order: 'id' }
      const builder = {
        select: vi.fn(() => builder),
        order: vi.fn((column) => { state.order = column; return builder }),
        eq: vi.fn((column, value) => { state.filters.push(['eq', column, value]); return builder }),
        in: vi.fn((column, values) => { state.filters.push(['in', column, values]); return builder }),
        range: vi.fn((start, end) => { state.start = start; state.end = end; return builder }),
        then(resolve, reject) {
          try {
            let rows = [...(tables[table] ?? [])]
            state.filters.forEach(([operator, column, value]) => {
              rows = operator === 'eq'
                ? rows.filter((row) => row[column] === value)
                : rows.filter((row) => value.includes(row[column]))
            })
            rows.sort((left, right) => String(left[state.order] ?? '').localeCompare(String(right[state.order] ?? '')))
            calls.push({ ...state })
            return Promise.resolve({ data: rows.slice(state.start, state.end + 1), error: null }).then(resolve, reject)
          } catch (error) {
            return Promise.reject(error).then(resolve, reject)
          }
        },
      }
      return builder
    }),
  }
}

describe('dataExportRepository', () => {
  it('paginates owner reads and applies the account filter on direct-owner tables', async () => {
    const activities = Array.from({ length: EXPORT_PAGE_SIZE + 1 }, (_, index) => ({
      id: `activity-${String(index).padStart(3, '0')}`,
      user_id: 'user-1',
    }))
    const client = createClient({
      profiles: [{ id: 'user-1', username: 'ace' }, { id: 'user-2', username: 'other' }],
      activities,
    })

    const datasets = await createDataExportRepository({ client }).collectUserExport('user-1')

    expect(datasets.profiles.rows).toEqual([{ id: 'user-1', username: 'ace' }])
    expect(datasets.activities.rows).toHaveLength(EXPORT_PAGE_SIZE + 1)
    expect(client.calls.filter((call) => call.table === 'activities')).toHaveLength(2)
    expect(client.calls.find((call) => call.table === 'profiles').filters).toContainEqual(['eq', 'id', 'user-1'])
    expect(client.calls.find((call) => call.table === 'goals').filters).toContainEqual(['eq', 'user_id', 'user-1'])
  })

  it('includes only shared rows referenced by the owner data', async () => {
    const client = createClient({
      profiles: [{ id: 'user-1', home_course_id: 'course-home' }],
      rounds: [{ id: 'round-1', user_id: 'user-1', course_id: 'course-played', layout_id: 'layout-1' }],
      round_holes: [{ id: 'rh-1', round_id: 'round-1', hole_id: 'hole-1' }],
      courses: [
        { id: 'course-home', name: 'Home' },
        { id: 'course-played', name: 'Played' },
        { id: 'course-unrelated', name: 'Unrelated' },
      ],
      layouts: [{ id: 'layout-1', course_id: 'course-played' }, { id: 'layout-2', course_id: 'course-unrelated' }],
      holes: [{ id: 'hole-1', layout_id: 'layout-1' }, { id: 'hole-2', layout_id: 'layout-1' }, { id: 'hole-3', layout_id: 'layout-2' }],
      course_aliases: [{ id: 'alias-1', course_id: 'course-played' }, { id: 'alias-2', course_id: 'course-unrelated' }],
      putting_regimen_runs: [{ id: 'run-1', user_id: 'user-1', regimen_id: 'regimen-system' }],
      putting_regimen_run_sets: [{ id: 'result-1', run_id: 'run-1', regimen_set_id: 'set-1' }],
      putting_regimens: [{ id: 'regimen-system', user_id: null }, { id: 'regimen-other', user_id: null }],
      putting_regimen_sets: [{ id: 'set-1', regimen_id: 'regimen-system' }, { id: 'set-2', regimen_id: 'regimen-other' }],
      disc_shot_tag_assignments: [{ id: 'assignment-1', user_id: 'user-1', shot_tag_id: 'tag-system' }],
      shot_tags: [{ id: 'tag-system', user_id: null }, { id: 'tag-unrelated', user_id: null }],
    })

    const datasets = await createDataExportRepository({ client }).collectUserExport('user-1')

    expect(datasets.courses.rows.map((row) => row.id).sort()).toEqual(['course-home', 'course-played'])
    expect(datasets.layouts.rows.map((row) => row.id)).toEqual(['layout-1'])
    expect(datasets.holes.rows.map((row) => row.id).sort()).toEqual(['hole-1', 'hole-2'])
    expect(datasets.course_aliases.rows.map((row) => row.id)).toEqual(['alias-1'])
    expect(datasets.putting_regimens.rows.map((row) => row.id)).toEqual(['regimen-system'])
    expect(datasets.putting_regimen_sets.rows.map((row) => row.id)).toEqual(['set-1'])
    expect(datasets.shot_tags.rows.map((row) => row.id)).toEqual(['tag-system'])
  })

  it('fails the whole export when any authoritative table read fails', async () => {
    const client = createClient({})
    client.from = vi.fn((table) => {
      const builder = {
        select: () => builder, order: () => builder, eq: () => builder, in: () => builder,
        range: () => builder,
        then: (resolve) => Promise.resolve(table === 'goals'
          ? { data: null, error: { message: 'network unavailable' } }
          : { data: [], error: null }).then(resolve),
      }
      return builder
    })

    await expect(createDataExportRepository({ client }).collectUserExport('user-1'))
      .rejects.toThrow('Could not export goals: network unavailable')
  })
})
