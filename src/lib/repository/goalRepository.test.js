import { describe, expect, it, vi } from 'vitest'
import { createGoalRepository } from './goalRepository'

describe('goalRepository RPC boundary', () => {
  it('creates through the atomic RPC with matching type and unit', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'goal-1' }, error: null })
    const repository = createGoalRepository({ client: { rpc }, database: {} })
    await repository.create({ type: 'putting_volume', targetValue: 500, unit: 'putts_per_week', startsOn: '2026-07-16', targetDate: '' })
    expect(rpc).toHaveBeenCalledWith('goal_create', expect.objectContaining({
      p_goal_type: 'putting_volume', p_target_value: 500, p_target_unit: 'putts_per_week', p_target_date: null,
    }))
  })

  it('sends the current version on a transition', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'goal-1', status: 'paused' }, error: null })
    const repository = createGoalRepository({ client: { rpc }, database: {} })
    await repository.transition({ id: 'goal-1', version: 4 }, 'paused')
    expect(rpc).toHaveBeenCalledWith('goal_transition', expect.objectContaining({
      p_goal_id: 'goal-1', p_expected_version: 4, p_new_status: 'paused', p_source: 'manual_entry',
    }))
  })
})
