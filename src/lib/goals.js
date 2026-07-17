export const GOAL_TYPES = Object.freeze({
  TARGET_RATING: 'target_rating',
  PRACTICE_FREQUENCY: 'practice_frequency',
  PUTTING_VOLUME: 'putting_volume',
  CONSISTENCY: 'consistency',
})

export const GOAL_STATUSES = Object.freeze({
  ACTIVE: 'active', PAUSED: 'paused', COMPLETED: 'completed', CANCELLED: 'cancelled',
})

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
