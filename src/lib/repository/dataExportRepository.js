import { supabase as defaultSupabase } from '../supabaseClient'

export const EXPORT_PAGE_SIZE = 500

const OWNER_SOURCES = [
  { table: 'profiles', ownerColumn: 'id' },
  { table: 'activities' },
  { table: 'activity_state_events' },
  { table: 'audit_events' },
  { table: 'notifications' },
  { table: 'discs' },
  { table: 'bags' },
  { table: 'disc_state_events' },
  { table: 'bag_versions' },
  { table: 'bag_version_discs' },
  { table: 'bag_ghost_slots' },
  { table: 'shot_tags' },
  { table: 'disc_shot_tag_assignments' },
  { table: 'disc_photos' },
  { table: 'lost_found_cases' },
  { table: 'lost_found_updates' },
  { table: 'disc_odometer_events' },
  { table: 'disc_cosmetic_unlocks' },
  { table: 'catalog_submissions' },
  { table: 'catalog_submission_evidence' },
  { table: 'user_disc_configurations' },
  { table: 'putt_sessions' },
  { table: 'putt_distance_logs' },
  { table: 'putting_regimens' },
  { table: 'putting_regimen_runs' },
  { table: 'putt_events' },
  { table: 'practice_fatigue_checkins' },
  { table: 'practice_experiment_markers' },
  { table: 'rounds' },
  { table: 'notification_preferences', orderColumn: 'category', minimumColumns: ['user_id', 'category'] },
  { table: 'goals' },
  { table: 'goal_events' },
  { table: 'weekly_report_snapshots' },
  { table: 'badge_progress' },
  { table: 'xp_events' },
]

const RLS_DERIVED_SOURCES = [
  { table: 'bag_discs' },
  { table: 'disc_role_history' },
  { table: 'putting_regimen_run_sets' },
  { table: 'round_holes' },
  { table: 'live_sessions' },
  { table: 'caddie_recommendations' },
]

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function values(rows, column) {
  return unique(rows.map((row) => row[column]))
}

function mergeRows(...groups) {
  const rows = new Map()
  groups.flat().forEach((row) => rows.set(row.id ?? `${row.user_id}:${row.category}`, row))
  return [...rows.values()]
}

async function fetchPages(client, table, { configure = (query) => query, orderColumn = 'id', pageSize = EXPORT_PAGE_SIZE } = {}) {
  const rows = []
  for (let start = 0; ; start += pageSize) {
    let query = client.from(table).select('*').order(orderColumn, { ascending: true })
    query = configure(query).range(start, start + pageSize - 1)
    const { data, error } = await query
    if (error) throw new Error(`Could not export ${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < pageSize) break
  }
  return rows
}

async function fetchByIds(client, table, column, ids) {
  const chunks = []
  const distinctIds = unique(ids)
  for (let index = 0; index < distinctIds.length; index += 100) chunks.push(distinctIds.slice(index, index + 100))
  const groups = await Promise.all(chunks.map((chunk) => fetchPages(client, table, {
    configure: (query) => query.in(column, chunk),
  })))
  return mergeRows(...groups)
}

function dataset(rows, scope, minimumColumns = ['id']) {
  return { rows, scope, minimumColumns }
}

export function createDataExportRepository({ client = defaultSupabase } = {}) {
  async function collectUserExport(userId) {
    if (!userId) throw new Error('A signed-in account is required to export data.')

    const datasets = {}
    const ownerGroups = await Promise.all(OWNER_SOURCES.map(async (source) => {
      const rows = await fetchPages(client, source.table, {
        orderColumn: source.orderColumn,
        configure: (query) => query.eq(source.ownerColumn ?? 'user_id', userId),
      })
      return [source, rows]
    }))
    ownerGroups.forEach(([source, rows]) => {
      const minimumColumns = source.minimumColumns ?? (source.ownerColumn === 'id' ? ['id'] : ['id', 'user_id'])
      datasets[source.table] = dataset(rows, 'owner', minimumColumns)
    })

    const derivedGroups = await Promise.all(RLS_DERIVED_SOURCES.map(async (source) => [
      source,
      await fetchPages(client, source.table),
    ]))
    derivedGroups.forEach(([source, rows]) => {
      datasets[source.table] = dataset(rows, 'owner-via-parent-rls')
    })

    const profiles = datasets.profiles.rows
    const rounds = datasets.rounds.rows
    const roundHoles = datasets.round_holes.rows
    const recommendations = datasets.caddie_recommendations.rows
    const runs = datasets.putting_regimen_runs.rows
    const runSets = datasets.putting_regimen_run_sets.rows
    const assignments = datasets.disc_shot_tag_assignments.rows
    const badgeProgress = datasets.badge_progress.rows
    const configurations = datasets.user_disc_configurations.rows
    const discs = datasets.discs.rows

    const courseIds = unique([...values(profiles, 'home_course_id'), ...values(rounds, 'course_id')])
    const courses = await fetchByIds(client, 'courses', 'id', courseIds)
    datasets.courses = dataset(courses, 'referenced-shared')

    const layouts = await fetchByIds(client, 'layouts', 'id', values(rounds, 'layout_id'))
    datasets.layouts = dataset(layouts, 'referenced-shared')

    const holesById = await fetchByIds(client, 'holes', 'id', unique([
      ...values(roundHoles, 'hole_id'),
      ...values(recommendations, 'hole_id'),
    ]))
    const holesByLayout = await fetchByIds(client, 'holes', 'layout_id', values(layouts, 'id'))
    datasets.holes = dataset(mergeRows(holesById, holesByLayout), 'referenced-shared')
    datasets.course_aliases = dataset(await fetchByIds(client, 'course_aliases', 'course_id', courseIds), 'referenced-shared')

    const regimenIds = unique([...values(datasets.putting_regimens.rows, 'id'), ...values(runs, 'regimen_id')])
    datasets.putting_regimens.rows = mergeRows(
      datasets.putting_regimens.rows,
      await fetchByIds(client, 'putting_regimens', 'id', regimenIds),
    )
    const regimenSetsByRegimen = await fetchByIds(client, 'putting_regimen_sets', 'regimen_id', regimenIds)
    const regimenSetsById = await fetchByIds(client, 'putting_regimen_sets', 'id', values(runSets, 'regimen_set_id'))
    datasets.putting_regimen_sets = dataset(mergeRows(regimenSetsByRegimen, regimenSetsById), 'owner-or-referenced-shared')

    datasets.shot_tags.rows = mergeRows(
      datasets.shot_tags.rows,
      await fetchByIds(client, 'shot_tags', 'id', values(assignments, 'shot_tag_id')),
    )
    datasets.badges = dataset(await fetchByIds(client, 'badges', 'id', values(badgeProgress, 'badge_id')), 'referenced-shared')

    const moldIds = unique([...values(discs, 'mold_id'), ...values(configurations, 'mold_id')])
    const plasticIds = values(configurations, 'plastic_id')
    const discMolds = await fetchByIds(client, 'disc_molds', 'id', moldIds)
    datasets.disc_molds = dataset(discMolds, 'referenced-shared')
    datasets.disc_plastics = dataset(await fetchByIds(client, 'disc_plastics', 'id', plasticIds), 'referenced-shared')
    datasets.disc_runs = dataset(await fetchByIds(client, 'disc_runs', 'id', values(configurations, 'run_id')), 'referenced-shared')
    datasets.disc_stamps = dataset(await fetchByIds(client, 'disc_stamps', 'id', values(configurations, 'stamp_id')), 'referenced-shared')
    datasets.disc_mold_plastics = dataset(await fetchByIds(client, 'disc_mold_plastics', 'mold_id', moldIds), 'referenced-shared')

    const manufacturerIds = values(discMolds, 'manufacturer_id')
    datasets.manufacturers = dataset(await fetchByIds(client, 'manufacturers', 'id', manufacturerIds), 'referenced-shared')
    datasets.manufacturer_aliases = dataset(await fetchByIds(client, 'manufacturer_aliases', 'manufacturer_id', manufacturerIds), 'referenced-shared')

    return datasets
  }

  return { collectUserExport }
}

export const dataExportRepository = createDataExportRepository()
