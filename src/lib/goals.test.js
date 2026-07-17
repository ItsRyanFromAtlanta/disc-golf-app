import { describe, expect, it } from 'vitest'
import { availableGoalActions, canTransitionGoal, goalProgress, transitionGoal } from './goals'

describe('goal lifecycle', () => {
  it('allows pause/resume and rejects terminal transitions', () => {
    expect(canTransitionGoal('active', 'paused')).toBe(true)
    expect(canTransitionGoal('paused', 'active')).toBe(true)
    expect(canTransitionGoal('completed', 'active')).toBe(false)
  })

  it('updates version and lifecycle timestamps deterministically', () => {
    expect(transitionGoal({ id: 'g1', status: 'active', version: 2 }, 'paused', '2026-07-16T20:00:00Z')).toMatchObject({
      status: 'paused', version: 3, paused_at: '2026-07-16T20:00:00Z', completed_at: null,
    })
  })

  it('clamps progress and rejects unusable targets', () => {
    expect(goalProgress(50, 100)).toBe(0.5)
    expect(goalProgress(120, 100)).toBe(1)
    expect(goalProgress(1, 0)).toBeNull()
  })

  it('exposes only valid user actions for each lifecycle state', () => {
    expect(availableGoalActions('active')).toEqual(['paused', 'completed', 'cancelled'])
    expect(availableGoalActions('paused')).toEqual(['active', 'completed', 'cancelled'])
    expect(availableGoalActions('completed')).toEqual([])
  })
})
