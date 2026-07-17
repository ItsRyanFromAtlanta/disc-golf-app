export const GOAL_TYPES = Object.freeze({
  TARGET_RATING: 'target_rating',
  PRACTICE_FREQUENCY: 'practice_frequency',
  PUTTING_VOLUME: 'putting_volume',
  CONSISTENCY: 'consistency',
})

export const GOAL_STATUSES = Object.freeze({
  ACTIVE: 'active', PAUSED: 'paused', COMPLETED: 'completed', CANCELLED: 'cancelled',
})

export const GOAL_DEFINITIONS = Object.freeze([
  { type: GOAL_TYPES.TARGET_RATING, label: 'Target rating', unit: 'rating', suffix: 'rating' },
  { type: GOAL_TYPES.PRACTICE_FREQUENCY, label: 'Practice frequency', unit: 'sessions_per_week', suffix: 'sessions/week' },
  { type: GOAL_TYPES.PUTTING_VOLUME, label: 'Putting volume', unit: 'putts_per_week', suffix: 'putts/week' },
  { type: GOAL_TYPES.CONSISTENCY, label: 'Consistency', unit: 'percent', suffix: '%' },
])

const TRANSITIONS = Object.freeze({
  active: new Set(['paused', 'completed', 'cancelled']),
  paused: new Set(['active', 'completed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
})

export function canTransitionGoal(from, to) {
  return TRANSITIONS[from]?.has(to) ?? false
}

export function transitionGoal(goal, nextStatus, occurredAt) {
  if (!canTransitionGoal(goal.status, nextStatus)) throw new Error('invalid_goal_transition')
  return {
    ...goal,
    status: nextStatus,
    version: goal.version + 1,
    updated_at: occurredAt,
    paused_at: nextStatus === 'paused' ? occurredAt : null,
    completed_at: nextStatus === 'completed' ? occurredAt : null,
    cancelled_at: nextStatus === 'cancelled' ? occurredAt : null,
  }
}

export function goalProgress(currentValue, targetValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) return null
  return Math.min(1, Math.max(0, currentValue / targetValue))
}

export function availableGoalActions(status) {
  if (status === GOAL_STATUSES.ACTIVE) return ['paused', 'completed', 'cancelled']
  if (status === GOAL_STATUSES.PAUSED) return ['active', 'completed', 'cancelled']
  return []
}
