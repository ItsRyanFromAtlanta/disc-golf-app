const ARCHIVED_STATUSES = new Set(['lost', 'retired', 'sold'])

export const DISC_TIERS = Object.freeze(['common', 'rare', 'epic', 'legendary', 'archived'])

export function discTier(disc = {}) {
  if (ARCHIVED_STATUSES.has(disc?.status)) return 'archived'
  if (disc?.role === 'primary_putter') return 'legendary'
  if (disc?.role === 'situational_weather') return 'epic'

  const wearScore = Number(disc?.wear_score)
  if (Number.isFinite(wearScore) && wearScore >= 7) return 'rare'

  return 'common'
}

export function discFlairSignal(disc = {}) {
  if (ARCHIVED_STATUSES.has(disc?.status)) return disc.status
  if (disc?.role === 'primary_putter') return 'Primary putter'
  if (disc?.role === 'situational_weather') return 'Weather role'

  const wearScore = Number(disc?.wear_score)
  if (Number.isFinite(wearScore)) return `Wear ${wearScore}/10`

  return 'Locker standard'
}
