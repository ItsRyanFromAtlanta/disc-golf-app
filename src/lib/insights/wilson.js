// Wilson score interval for a binomial proportion. Preferred over the normal
// approximation because it stays inside [0, 1] and behaves at small n — which
// is exactly when we show it (any displayed make % with n < 30).
export const WILSON_MIN_N_FOR_HIDING = 30

export function wilsonInterval(makes, attempts, z = 1.96) {
  if (attempts <= 0) return null
  const p = makes / attempts
  const z2 = z * z
  const denominator = 1 + z2 / attempts
  const center = (p + z2 / (2 * attempts)) / denominator
  const half = (z * Math.sqrt(p * (1 - p) / attempts + z2 / (4 * attempts * attempts))) / denominator
  return {
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
  }
}
