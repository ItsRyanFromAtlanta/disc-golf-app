import { describe, expect, it } from 'vitest'
import { dedupeNotifications, isBadgeEligible, notificationDestination } from './notifications'

const base = {
  id: 'n-1', user_id: 'user-1', category: 'activity', priority: 'actionable', title: 'Review',
  created_at: '2026-07-12T12:00:00.000Z', dedupe_key: 'activity-review:a-1', read_at: null, resolved_at: null,
}

describe('notification contract', () => {
  it('counts only unresolved actionable or critical, unexpired items toward the bell', () => {
    expect(isBadgeEligible(base, Date.parse('2026-07-12T13:00:00.000Z'))).toBe(true)
    expect(isBadgeEligible({ ...base, priority: 'info' })).toBe(false)
    expect(isBadgeEligible({ ...base, resolved_at: base.created_at })).toBe(false)
    expect(isBadgeEligible({ ...base, expires_at: base.created_at }, Date.parse('2026-07-12T13:00:00.000Z'))).toBe(false)
  })

  it('updates an unresolved duplicate without resetting its read state', () => {
    const result = dedupeNotifications([{ ...base, read_at: '2026-07-12T12:30:00.000Z' }], { ...base, id: 'n-2', title: 'Updated' })
    expect(result).toEqual([expect.objectContaining({ id: 'n-1', title: 'Updated', read_at: '2026-07-12T12:30:00.000Z' })])
  })

  it('maps approved activity and sync actions to existing routes', () => {
    expect(notificationDestination({ action_type: 'activity_review', action_payload: { activityId: 'a-1', type: 'regimen' } })).toBe('/practice/history/regimen/a-1')
    expect(notificationDestination({ action_type: 'sync_review' })).toBe('/practice/history')
  })
})
