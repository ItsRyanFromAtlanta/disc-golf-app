import { GESTURE_CONFIG } from './config'

// Angle convention: 0deg = up, 90deg = right, 180deg = down, 270deg = left.
// "Right" is deliberately not a recognized gesture direction (only up/down/
// left are gates) — a gesture landing in that wedge falls through to
// rejected/none below, same as any other gesture that doesn't clear a
// direction's thresholds.
export function gestureAngleDegrees(dx, dy) {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

// Shortest angular distance between two headings, so 350deg vs 10deg reads
// as 20deg apart, not 340deg.
function angularDistance(a, b) {
  return Math.abs((((a - b + 180) % 360) + 360) % 360 - 180)
}

export function isWithinCone(angleDeg, targetDeg, coneHalfAngleDeg) {
  return angularDistance(angleDeg, targetDeg) <= coneHalfAngleDeg
}

// Straight-line displacement from the first sample to the last — the
// standard measure for a swipe's "travel," as opposed to cumulative path
// length along a wobbly finger trace.
export function gestureTravelPx(samples) {
  const first = samples[0]
  const last = samples[samples.length - 1]
  return Math.hypot(last.x - first.x, last.y - first.y)
}

export function gestureDurationMs(samples) {
  return samples[samples.length - 1].t - samples[0].t
}

// How many rapid-fire "make" ticks should have fired by `elapsedMs` into a
// held pointer-down: the first tick lands at LONG_PRESS_MS, then one more
// every RAPID_FIRE_INTERVAL_MS after that. Pure function of elapsed time (not
// a running counter) so a caller using setInterval/rAF can diff "ticks that
// should exist by now" against "ticks already emitted" and stay correct
// under timer drift or dropped frames.
export function rapidFireTickCount(elapsedMs, config = GESTURE_CONFIG) {
  if (elapsedMs < config.LONG_PRESS_MS) return 0
  return 1 + Math.floor((elapsedMs - config.LONG_PRESS_MS) / config.RAPID_FIRE_INTERVAL_MS)
}

// samples: [{x, y, t}] from PointerEvent.clientX/clientY + event.timeStamp,
// captured from pointerdown through the current point.
// Returns { type: 'make' | 'miss' | 'undo' | 'rejected' | 'none' }.
// 'rejected' = a real attempted gesture that didn't qualify (crimson-flash
// feedback); 'none' = below REJECT_MIN_TRAVEL_PX, an incidental touch with no
// feedback at all.
export function classifyGesture(samples, config = GESTURE_CONFIG) {
  if (!samples || samples.length < 2) return { type: 'none' }

  const dx = samples[samples.length - 1].x - samples[0].x
  const dy = samples[samples.length - 1].y - samples[0].y
  const travel = gestureTravelPx(samples)
  const duration = gestureDurationMs(samples)
  const angle = gestureAngleDegrees(dx, dy)

  const gates = [
    { type: 'undo', targetDeg: 270, travelPx: config.UNDO_TRAVEL_PX, velocityMs: config.UNDO_VELOCITY_MS },
    { type: 'make', targetDeg: 0, travelPx: config.TRAVEL_PX, velocityMs: config.VELOCITY_MS },
    { type: 'miss', targetDeg: 180, travelPx: config.TRAVEL_PX, velocityMs: config.VELOCITY_MS },
  ]

  for (const gate of gates) {
    if (
      isWithinCone(angle, gate.targetDeg, config.CONE_DEGREES) &&
      travel >= gate.travelPx &&
      duration <= gate.velocityMs
    ) {
      return { type: gate.type }
    }
  }

  return { type: travel >= config.REJECT_MIN_TRAVEL_PX ? 'rejected' : 'none' }
}
