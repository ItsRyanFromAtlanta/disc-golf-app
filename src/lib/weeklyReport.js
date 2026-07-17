export const WEEKLY_REPORT_CALCULATION_VERSION = 'weekly-report-v1'

function inWindow(value, startMs, endMs) {
  const ms = Date.parse(value)
  return Number.isFinite(ms) && ms >= startMs && ms < endMs
}

export function buildWeeklyReportSnapshot({
  sessions = [], runs = [], rounds = [], weekStart, timezone, windowStart, windowEnd,
  version = 1, sourceCutoff,
}) {
  const mondayMs = Date.parse(`${weekStart}T00:00:00.000Z`)
  if (!Number.isFinite(mondayMs) || new Date(mondayMs).getUTCDay() !== 1) throw new Error('week_start_must_be_monday')
  const startMs = Date.parse(windowStart)
  const endMs = Date.parse(windowEnd)
  if (!timezone || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('invalid_week_window')
  }
  const selectedSessions = sessions.filter((row) => inWindow(row.created_at, startMs, endMs))
  const selectedRuns = runs.filter((row) => inWindow(row.started_at, startMs, endMs))
  const selectedRounds = rounds.filter((row) => inWindow(row.played_at, startMs, endMs))
  const practiceRows = [
    ...selectedSessions.flatMap((row) => row.putt_distance_logs ?? []),
    ...selectedRuns.flatMap((row) => row.putting_regimen_run_sets ?? []),
  ]
  const makes = practiceRows.reduce((sum, row) => sum + (row.makes ?? 0), 0)
  const attempts = practiceRows.reduce((sum, row) => sum + (row.attempts ?? 0), 0)
  const completedRounds = selectedRounds.filter((row) => row.status === 'completed')
  const highlights = []
  if (attempts) highlights.push({ key: 'putting_accuracy', value: makes / attempts, sampleSize: attempts })
  if (selectedSessions.length + selectedRuns.length) {
    highlights.push({ key: 'practice_sessions', value: selectedSessions.length + selectedRuns.length })
  }
  if (completedRounds.length) highlights.push({ key: 'rounds_completed', value: completedRounds.length })

  return {
    week_start: weekStart,
    timezone,
    window_start: windowStart,
    window_end: windowEnd,
    version,
    calculation_version: WEEKLY_REPORT_CALCULATION_VERSION,
    source_cutoff: sourceCutoff,
    sample_counts: { practiceSessions: selectedSessions.length + selectedRuns.length, putts: attempts, rounds: selectedRounds.length },
    metrics: { makes, attempts, makePct: attempts ? makes / attempts : null, completedRounds: completedRounds.length },
    highlights,
  }
}
