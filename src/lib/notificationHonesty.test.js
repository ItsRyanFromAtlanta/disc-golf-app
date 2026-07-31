import { describe, expect, it } from 'vitest'
import { notificationDestination } from './notifications'
import {
  NOTIFICATION_PREFERENCE_CATEGORIES,
  PRODUCED_NOTIFICATION_CATEGORIES,
} from './notificationPreferences'

// DEFECT_REGISTER D-11. The weekly report is unproduced, unscheduled, and was
// misrouted. Gap 3 (the destination) is fixed here because it is wrong under
// every resolution of the other two. Gaps 1 and 2 — no scheduler, no producer —
// need a product decision and are recorded, not guessed at.
describe('weekly report notification destination (D-11 gap 3)', () => {
  function notification(payload = {}) {
    return { action_type: 'weekly_report', action_payload: payload }
  }

  it('routes to the reports screen, not the ME summary', () => {
    // `/profile` is the career summary. It does not contain the report the
    // notification is about, so a reader who tapped it had to go find it.
    expect(notificationDestination(notification())).toBe('/profile/reports')
  })

  it('still honours an explicit href', () => {
    expect(notificationDestination(notification({ href: '/profile/reports/2026-W30' }))).toBe(
      '/profile/reports/2026-W30',
    )
  })
})

describe('notification preferences state what they can actually do', () => {
  it('marks every category, so a new one cannot be added without deciding', () => {
    for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
      expect(typeof category.produced, `${category.id} must declare \`produced\``).toBe('boolean')
    }
  })

  it('reports only activity review as produced today', () => {
    // `notificationProducers.js` emits exactly two things: `activity_review`
    // and `sync_review`. Sync is critical rather than optional, so it is not a
    // preference row at all — which leaves one of these seven switches wired to
    // anything. If a producer lands, this test is the thing that fails and
    // reminds someone to flip the flag.
    expect(PRODUCED_NOTIFICATION_CATEGORIES).toEqual(['activity'])
  })

  it('keeps the unproduced categories rather than deleting them', () => {
    // The stored rows are the user's expressed intent. Whether these
    // notifications should exist is a product decision; silently promising
    // control that does not exist is the defect.
    const ids = NOTIFICATION_PREFERENCE_CATEGORIES.map((category) => category.id)
    expect(ids).toContain('weekly_report')
    expect(ids).toContain('coaching')
  })
})
