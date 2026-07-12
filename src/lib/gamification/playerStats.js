import { distanceSamples } from '../history'
import { practiceStreak } from '../insights/activity'
import { regimenPBRunIds } from '../insights/pbs'
import { isCleanSet } from '../regimenScoring'

const PUTTER_ROLES = new Set(['primary_putter', 'backup_putter'])

// Pure: fetched practice + inventory rows -> a PlayerStats snapshot (see
// metrics.js for per-field docs). Kept in its own supabase-free module so it can
// be unit-tested without the client's import-time env check. `now` is a Date,
// threaded so the practice-day streak is measured "as of now".
//
// Reuses the existing history/insights helpers (distanceSamples, practiceStreak,
// regimenPBRunIds) rather than re-deriving their logic — the fetch in
// badgeEvaluatorService mirrors fetchHistory's nested shape precisely so
// distanceSamples works on it unchanged.
export function buildPlayerStats({ sessions, runs, discs }, now) {
  const freeformLogs = sessions.flatMap((s) => s.putt_distance_logs ?? [])
  const runSets = runs.flatMap((r) => r.putting_regimen_run_sets ?? [])

  const totalMakes =
    freeformLogs.reduce((sum, l) => sum + l.makes, 0) + runSets.reduce((sum, s) => sum + s.makes, 0)
  const totalAttempts =
    freeformLogs.reduce((sum, l) => sum + l.attempts, 0) + runSets.reduce((sum, s) => sum + s.attempts, 0)

  // One weather bucket per practice parent: its weather + that parent's total
  // makes. Summing makes from the SUMMARY children (not putt_events) keeps
  // batch-logged putts counted — see the data-split note in metrics.js.
  const weatherBuckets = [
    ...sessions.map((s) => ({
      windMph: s.wind_mph ?? null,
      condition: s.weather_condition ?? null,
      makes: (s.putt_distance_logs ?? []).reduce((sum, l) => sum + l.makes, 0),
    })),
    ...runs.map((r) => ({
      windMph: r.wind_mph ?? null,
      condition: r.weather_condition ?? null,
      makes: (r.putting_regimen_run_sets ?? []).reduce((sum, s) => sum + s.makes, 0),
    })),
  ]

  // A flawless run: completed, and the run's total makes/attempts pass the
  // same clean-set predicate regimenScoring.js already uses per-set — reused
  // rather than reimplemented so the two can't silently drift apart.
  const noMissRegimenRuns = runs.filter((r) => {
    if (!r.completed) return false
    const sets = r.putting_regimen_run_sets ?? []
    const m = sets.reduce((sum, s) => sum + s.makes, 0)
    const a = sets.reduce((sum, s) => sum + s.attempts, 0)
    return isCleanSet(m, a)
  }).length

  const practiceDates = [
    ...sessions.map((s) => s.created_at),
    ...runs.map((r) => r.started_at),
  ].filter(Boolean)

  return {
    totalMakes,
    totalAttempts,
    totalSessions: sessions.length + runs.length,
    practiceDayStreak: practiceStreak(practiceDates, now),
    distanceSamples: distanceSamples({ sessions, runs }),
    weatherBuckets,
    longestPuttStreak: runSets.reduce((max, s) => Math.max(max, s.longest_streak ?? 0), 0),
    cleanStages: runSets.filter((s) => s.clean_set).length,
    noMissRegimenRuns,
    pressurePuttsMade: runSets.filter((s) => s.pressure_putt_made).length,
    regimenRunsCompleted: runs.filter((r) => r.completed).length,
    regimenPbsSet: regimenPBRunIds(
      runs.map((r) => ({
        id: r.id,
        completed: r.completed,
        regimenId: r.regimen_id,
        totalScore: r.total_score,
        at: r.started_at,
      })),
    ).size,
    discsOwned: discs.length,
    // "Iron Arm" is putter-specific (see badgeCatalog.js) — scope the max to
    // discs actually in a putter role, not the account's whole locker.
    putterChainHitsMax: discs
      .filter((d) => PUTTER_ROLES.has(d.role))
      .reduce((max, d) => Math.max(max, d.total_chain_hits ?? 0), 0),
  }
}
