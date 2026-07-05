// Named, field-tunable gesture thresholds (CSS px / ms — see classify.js for
// why these must be measured from PointerEvent.clientX/clientY, never a
// canvas backing-store buffer, so they stay DPR-independent without needing
// per-device adjustment).
export const GESTURE_CONFIG = {
  TRAVEL_PX: 120,
  REJECT_MIN_TRAVEL_PX: 40, // below this: incidental touch, no feedback at all
  VELOCITY_MS: 350,
  CONE_DEGREES: 45, // half-angle: a gesture qualifies within +/-45 deg of a cardinal direction
  DEBOUNCE_MS: 400, // swipe-classified gestures only — see sessionReducer, not applied to rapid-fire ticks
  UNDO_TRAVEL_PX: 160,
  UNDO_VELOCITY_MS: 400,
  LONG_PRESS_MS: 600,
  RAPID_FIRE_INTERVAL_MS: 200,
  ZONE_GROWTH_PER_MAKE_PCT: 0.05,
  ZONE_GROWTH_CAP_PCT: 0.6,
}
