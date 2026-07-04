// Decay-weighted current form: exponentially weighted make % where each
// sample's weight halves every DECAY_HALF_LIFE_DAYS. Displayed beside the
// unweighted lifetime make % — current form above lifetime means trending up.
export const DECAY_HALF_LIFE_DAYS = 14

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function decayWeightedForm(samples, now, halfLifeDays = DECAY_HALF_LIFE_DAYS) {
  let weightedMakes = 0
  let weightedAttempts = 0
  let lifetimeMakes = 0
  let lifetimeAttempts = 0

  for (const s of samples) {
    if (!s.attempts) continue
    const ageDays = Math.max(0, (now - new Date(s.at)) / MS_PER_DAY)
    const weight = Math.pow(0.5, ageDays / halfLifeDays)
    weightedMakes += s.makes * weight
    weightedAttempts += s.attempts * weight
    lifetimeMakes += s.makes
    lifetimeAttempts += s.attempts
  }

  return {
    currentFormPct: weightedAttempts > 0 ? weightedMakes / weightedAttempts : null,
    lifetimePct: lifetimeAttempts > 0 ? lifetimeMakes / lifetimeAttempts : null,
    lifetimeMakes,
    lifetimeAttempts,
  }
}
