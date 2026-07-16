export const DISC_ODOMETER_METRICS = Object.freeze(['throws', 'chain_hits', 'airballs'])

export const DISC_ODOMETER_LABELS = Object.freeze({
  throws: 'Throws',
  chain_hits: 'Chain hits',
  airballs: 'Airballs',
})

export const COSMETIC_TIER_THRESHOLDS = Object.freeze({ rare: 300, epic: 1000, legendary: 5000 })

const TIER_RANK = Object.freeze({ common: 0, rare: 1, epic: 2, legendary: 3 })

export function highestUnlockedTier(unlocks = []) {
  return unlocks.reduce((highest, unlock) => {
    const tier = typeof unlock === 'string' ? unlock : unlock?.tier
    return (TIER_RANK[tier] ?? -1) > TIER_RANK[highest] ? tier : highest
  }, 'common')
}

export function nextCosmeticMilestone(chainHits, unlocks = []) {
  const unlocked = new Set(unlocks.map((row) => typeof row === 'string' ? row : row.tier))
  return Object.entries(COSMETIC_TIER_THRESHOLDS)
    .map(([tier, threshold]) => ({ tier, threshold, remaining: Math.max(0, threshold - (chainHits ?? 0)) }))
    .find(({ tier }) => !unlocked.has(tier)) ?? null
}

export function validateOdometerInput({ metric, delta, source = 'manual_entry', reason }) {
  if (!DISC_ODOMETER_METRICS.includes(metric)) throw new Error('Choose a valid odometer metric')
  const amount = Number(delta)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10000) {
    throw new Error('Odometer change must be a non-zero whole number up to 10,000')
  }
  if (amount < 0 && source !== 'manual_correction') throw new Error('Negative changes must be corrections')
  if (amount < 0 && !reason?.trim()) throw new Error('A correction reason is required')
  return { metric, delta: amount, source, reason: reason?.trim() || null }
}
