// Simplified top-down flight path for the Putter Lineup flight curve (Screen 6).
// Not a physics simulation -- a readable cubic-Bézier approximation matching how
// manufacturer flight charts visualize speed/glide/turn/fade: total travel scales
// with speed+glide, turn bends the early flight, fade pulls back at the end.
const CLAMP_MIN = 0.35
const CLAMP_MAX = 1

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function flightPath({ speed, glide, turn, fade }, { width = 200, height = 300 } = {}) {
  if (speed == null || glide == null || turn == null || fade == null) return null

  const distance = height * clamp((speed * 0.6 + glide * 0.4) / 12, CLAMP_MIN, CLAMP_MAX)
  const startX = width / 2
  // Sign convention: negative turn (understable) drifts the disc toward +x
  // during high-speed flight; positive fade pulls it back toward -x late.
  const turnDrift = -turn * (width / 20)
  const fadeDrift = fade * (width / 20)

  const p1 = { x: startX + turnDrift, y: distance * 0.4 }
  const p2 = { x: startX + turnDrift - fadeDrift * 0.3, y: distance * 0.75 }
  const p3 = { x: startX - fadeDrift, y: distance }

  return `M ${startX} 0 C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`
}

export const ODOMETER_ALERT_THRESHOLD = 300

// A worn-in disc keeps drifting toward understable over time -- the odometer
// alert proposes nudging the wear slider up by one step, capped at 10.
export function proposeWearStepDown(wearScore) {
  return Math.min(10, (wearScore ?? 1) + 1)
}

// Wear (1-10) models a beat-in disc: worn plastic loses stability over time, so
// turn trends more negative (understable) and fade trends down. wear=1 (or no
// wear recorded yet) leaves the effective numbers untouched.
export function wearAdjustedFlightNumbers(effective, wearScore) {
  if (wearScore == null) return effective
  const wearFactor = clamp((wearScore - 1) / 9, 0, 1)
  return {
    ...effective,
    turn: effective.turn == null ? null : effective.turn - wearFactor * 2,
    fade: effective.fade == null ? null : Math.max(0, effective.fade - wearFactor * effective.fade * 0.6),
  }
}
