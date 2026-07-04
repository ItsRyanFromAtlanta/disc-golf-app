// Cadence fingerprint: make % split by when you practice.
// Time-of-day buckets (local time): morning < 12:00, afternoon 12:00-16:59,
// evening >= 17:00. Rest buckets group by days since the previous distinct
// practice day; the first-ever practice day has no gap and is excluded.
export const GAP_BUCKETS = ['0-1', '2-3', '4-7', '8+']

function timeOfDay(date) {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function gapBucket(days) {
  if (days <= 1) return '0-1'
  if (days <= 3) return '2-3'
  if (days <= 7) return '4-7'
  return '8+'
}

function localDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function addTo(bucketMap, key, sample) {
  const bucket = bucketMap[key] ?? { makes: 0, attempts: 0 }
  bucket.makes += sample.makes
  bucket.attempts += sample.attempts
  bucketMap[key] = bucket
}

function withPct(bucketMap) {
  const out = {}
  for (const [key, bucket] of Object.entries(bucketMap)) {
    out[key] = { ...bucket, makePct: bucket.attempts > 0 ? bucket.makes / bucket.attempts : null }
  }
  return out
}

export function cadenceFingerprint(samples) {
  const byTimeOfDay = {}
  const byGap = {}

  const dayStarts = new Map()
  for (const s of samples) {
    if (!s.attempts) continue
    const date = new Date(s.at)
    const key = localDayKey(date)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (!dayStarts.has(key)) dayStarts.set(key, dayStart)
  }
  const sortedDays = [...dayStarts.values()].sort((a, b) => a - b)
  const gapByDay = new Map()
  for (let i = 1; i < sortedDays.length; i++) {
    const days = Math.round((sortedDays[i] - sortedDays[i - 1]) / (24 * 60 * 60 * 1000))
    gapByDay.set(localDayKey(sortedDays[i]), gapBucket(days))
  }

  for (const s of samples) {
    if (!s.attempts) continue
    const date = new Date(s.at)
    addTo(byTimeOfDay, timeOfDay(date), s)
    const gap = gapByDay.get(localDayKey(date))
    if (gap) addTo(byGap, gap, s)
  }

  return { byTimeOfDay: withPct(byTimeOfDay), byGap: withPct(byGap) }
}
