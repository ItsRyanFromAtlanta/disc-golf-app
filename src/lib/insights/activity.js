// Streak + volume ledger for the history header strip.
// Streak: consecutive days (local) with >= 1 practice entry, counting back
// from today — or from yesterday if today has no entry yet (an active streak
// isn't broken until a full day is missed).
// Volume: total putt attempts this calendar week (Monday start, local),
// this calendar month, and lifetime.

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function practiceStreak(dates, now) {
  const days = new Set(dates.map((d) => startOfDay(new Date(d)).getTime()))
  const today = startOfDay(now).getTime()

  let cursor = days.has(today) ? today : today - MS_PER_DAY
  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor -= MS_PER_DAY
  }
  return streak
}

export function volumeLedger(samples, now) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const day = startOfDay(now)
  // getDay(): Sunday = 0; shift so Monday starts the week.
  const daysSinceMonday = (day.getDay() + 6) % 7
  const weekStart = new Date(day - daysSinceMonday * MS_PER_DAY)

  let week = 0
  let month = 0
  let lifetime = 0
  for (const s of samples) {
    if (!s.attempts) continue
    const at = new Date(s.at)
    lifetime += s.attempts
    if (at >= monthStart) month += s.attempts
    if (at >= weekStart) week += s.attempts
  }
  return { week, month, lifetime }
}
