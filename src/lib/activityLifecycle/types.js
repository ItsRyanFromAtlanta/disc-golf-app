export const ACTIVITY_STATES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
})

export const ACTIVITY_TYPES = Object.freeze({
  PUTTING_FREEFORM: 'putting_freeform',
  PUTTING_REGIMEN: 'putting_regimen',
  DISC_GOLF_ROUND: 'disc_golf_round',
  PUTTING_GAME: 'putting_game',
  FIELDWORK: 'fieldwork',
  COURSE_PRACTICE: 'course_practice',
  LEAGUE_MATCH: 'league_match',
})

export const LIFECYCLE_COMMANDS = Object.freeze({
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  FINALIZE_COMPLETED: 'finalize_completed',
  MARK_INCOMPLETE: 'mark_incomplete',
})

export const ACTIVITY_SOURCES = Object.freeze({
  LIVE_CAPTURE: 'live_capture',
  BATCH_ENTRY: 'batch_entry',
  MANUAL_ENTRY: 'manual_entry',
  MANUAL_CORRECTION: 'manual_correction',
  UDISC_IMPORT: 'udisc_import',
  PDGA_IMPORT: 'pdga_import',
  SYSTEM_INFERENCE: 'system_inference',
  SENSOR: 'sensor',
  ADMIN_REPAIR: 'admin_repair',
})

export const ACTIVITY_STATE_REASONS = Object.freeze({
  FIRST_MEANINGFUL_FACT: 'first_meaningful_fact',
  USER_PAUSE: 'user_pause',
  NAVIGATION_AWAY: 'navigation_away',
  BACKGROUND_GRACE_ELAPSED: 'background_grace_elapsed',
  USER_RESUME: 'user_resume',
  CRASH_RECOVERY: 'crash_recovery',
  USER_FINALIZE: 'user_finalize',
  USER_SAVE_INCOMPLETE: 'user_save_incomplete',
  REPLACED_BY_ACTIVITY: 'replaced_by_activity',
  ROUND_REPLACEMENT_CONFIRMED: 'round_replacement_confirmed',
})

export const CURRENT_ACTIVITY_STATES = Object.freeze([
  ACTIVITY_STATES.ACTIVE,
  ACTIVITY_STATES.PAUSED,
])

export const TERMINAL_ACTIVITY_STATES = Object.freeze([
  ACTIVITY_STATES.COMPLETED,
  ACTIVITY_STATES.INCOMPLETE,
])

export const PRACTICE_ACTIVITY_TYPES = Object.freeze([
  ACTIVITY_TYPES.PUTTING_FREEFORM,
  ACTIVITY_TYPES.PUTTING_REGIMEN,
  ACTIVITY_TYPES.PUTTING_GAME,
  ACTIVITY_TYPES.FIELDWORK,
  ACTIVITY_TYPES.COURSE_PRACTICE,
])

export function isCurrentActivityState(state) {
  return CURRENT_ACTIVITY_STATES.includes(state)
}

export function isTerminalActivityState(state) {
  return TERMINAL_ACTIVITY_STATES.includes(state)
}

export function isPracticeActivityType(type) {
  return PRACTICE_ACTIVITY_TYPES.includes(type)
}

export function isRoundActivityType(type) {
  return type === ACTIVITY_TYPES.DISC_GOLF_ROUND || type === ACTIVITY_TYPES.LEAGUE_MATCH
}
