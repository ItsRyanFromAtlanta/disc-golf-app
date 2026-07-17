export const FATIGUE_TRAILING_MISS_COUNT = 3
export const FATIGUE_STAGE_DROP_PCT = 0.2
export const FATIGUE_MIN_STAGE_ATTEMPTS = 5

export function fatigueCheckinTrigger({ outcomes = [], stage, previousStages = [] }) {
  const trailing = outcomes.slice(-FATIGUE_TRAILING_MISS_COUNT)
  if (trailing.length === FATIGUE_TRAILING_MISS_COUNT && trailing.every((value) => value === 'miss')) {
    return 'trailing_misses'
  }
  if (!stage || stage.attempts < FATIGUE_MIN_STAGE_ATTEMPTS) return null
  const sampled = previousStages.filter((value) => value.attempts >= FATIGUE_MIN_STAGE_ATTEMPTS)
  const attempts = sampled.reduce((sum, value) => sum + value.attempts, 0)
  if (!attempts) return null
  const baseline = sampled.reduce((sum, value) => sum + value.makes, 0) / attempts
  const current = stage.makes / stage.attempts
  return baseline - current >= FATIGUE_STAGE_DROP_PCT ? 'stage_drop' : null
}
