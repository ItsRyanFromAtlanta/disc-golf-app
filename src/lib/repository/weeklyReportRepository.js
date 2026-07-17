import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'
import { buildWeeklyReportSnapshot, latestCompletedWeekWindow } from '../weeklyReport'

const REPORT_SELECT = '*'
const VISIBLE_STATES = ['completed']

function sortSnapshots(rows) {
  return [...rows].sort((a, b) => b.week_start.localeCompare(a.week_start) || b.version - a.version)
}

function throwResult(result) {
  if (result.error) throw result.error
  return result.data ?? []
}

export function createWeeklyReportRepository({ database = defaultDb, client = defaultSupabase } = {}) {
  async function list(userId) {
    const result = await client.from('weekly_report_snapshots').select(REPORT_SELECT)
      .eq('user_id', userId).order('week_start', { ascending: false }).order('version', { ascending: false })
    if (!result.error) {
      await database.weeklyReportSnapshots.bulkPut(result.data ?? [])
      return result.data ?? []
    }
    const cached = sortSnapshots(await database.weeklyReportSnapshots.where('user_id').equals(userId).toArray())
    if (cached.length) return cached
    throw result.error
  }

  async function reportingTimezone(userId) {
    const result = await client.from('profiles').select('timezone').eq('id', userId).single()
    if (result.error) throw result.error
    return result.data?.timezone || 'UTC'
  }

  async function sourceRows(userId, window) {
    const [activitiesResult, sessionsResult, runsResult, roundsResult] = await Promise.all([
      client.from('activities').select('id').eq('user_id', userId).in('state', VISIBLE_STATES).is('hidden_at', null),
      client.from('putt_sessions').select('id, created_at, putt_distance_logs(makes, attempts)')
        .eq('user_id', userId).gte('created_at', window.windowStart).lt('created_at', window.windowEnd),
      client.from('putting_regimen_runs').select('id, started_at, putting_regimen_run_sets(makes, attempts)')
        .eq('user_id', userId).gte('started_at', window.windowStart).lt('started_at', window.windowEnd),
      client.from('rounds').select('id, played_at, status').eq('user_id', userId)
        .gte('played_at', window.windowStart).lt('played_at', window.windowEnd),
    ])
    const visibleIds = new Set(throwResult(activitiesResult).map((row) => row.id))
    return {
      sessions: throwResult(sessionsResult).filter((row) => visibleIds.has(row.id)),
      runs: throwResult(runsResult).filter((row) => visibleIds.has(row.id)),
      rounds: throwResult(roundsResult).filter((row) => visibleIds.has(row.id)),
    }
  }

  async function latestVersion(userId, weekStart) {
    const result = await client.from('weekly_report_snapshots').select(REPORT_SELECT)
      .eq('user_id', userId).eq('week_start', weekStart)
      .order('version', { ascending: false }).limit(1).maybeSingle()
    if (result.error) throw result.error
    return result.data ?? null
  }

  async function generate(userId, { now = new Date() } = {}) {
    const timezone = await reportingTimezone(userId)
    const window = latestCompletedWeekWindow({ now, timezone })
    const sourceCutoff = now.toISOString()
    const sources = await sourceRows(userId, window)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const previous = await latestVersion(userId, window.weekStart)
      const version = (previous?.version ?? 0) + 1
      const snapshot = buildWeeklyReportSnapshot({
        ...sources, weekStart: window.weekStart, timezone,
        windowStart: window.windowStart, windowEnd: window.windowEnd,
        version, sourceCutoff,
      })
      const row = {
        id: crypto.randomUUID(), user_id: userId, ...snapshot,
        supersedes_id: previous?.id ?? null,
        generation_reason: previous ? 'correction_regeneration' : 'manual',
        idempotency_key: `weekly-report:${userId}:${window.weekStart}:${version}:${crypto.randomUUID()}`,
      }
      const result = await client.from('weekly_report_snapshots').insert(row).select().single()
      if (!result.error) {
        await database.weeklyReportSnapshots.put(result.data)
        return result.data
      }
      if (result.error.code !== '23505' || attempt === 1) throw result.error
    }
    throw new Error('weekly_report_generation_failed')
  }

  return { list, generate }
}

export const weeklyReportRepository = createWeeklyReportRepository()
