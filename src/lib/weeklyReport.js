export const WEEKLY_REPORT_CALCULATION_VERSION = 'weekly-report-v1'

const DAY_MS = 24 * 60 * 60 * 1000

function dateParts(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) throw new Error('invalid_calendar_date')
  return match.slice(1).map(Number)
}

function calendarDate(dateMs) {
  return new Date(dateMs).toISOString().slice(0, 10)
}

function addCalendarDays(dateString, days) {
  const [year, month, day] = dateParts(dateString)
  return calendarDate(Date.UTC(year, month - 1, day) + days * DAY_MS)
}

function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

function timezoneOffsetMs(date, timezone) {
  const parts = zonedParts(date, timezone)
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime()
}

export function zonedMidnightUtc(dateString, timezone) {
  const [year, month, day] = dateParts(dateString)
  const localMidnight = Date.UTC(year, month - 1, day)
  let result = localMidnight - timezoneOffsetMs(new Date(localMidnight), timezone)
  // Re-evaluate at the candidate instant so a DST transition near the
  // boundary cannot borrow the previous day's offset.
  result = localMidnight - timezoneOffsetMs(new Date(result), timezone)
  return new Date(result).toISOString()
}

export function latestCompletedWeekWindow({ now = new Date(), timezone }) {
  const parts = zonedParts(now, timezone)
  const localDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  const [year, month, day] = dateParts(localDate)
  const isoDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7
  const currentMonday = addCalendarDays(localDate, 1 - isoDay)
  const weekStart = addCalendarDays(currentMonday, -7)
  const nextMonday = addCalendarDays(weekStart, 7)
  return {
    weekStart,
    weekEnd: addCalendarDays(weekStart, 6),
    windowStart: zonedMidnightUtc(weekStart, timezone),
    windowEnd: zonedMidnightUtc(nextMonday, timezone),
    timezone,
  }
}

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
