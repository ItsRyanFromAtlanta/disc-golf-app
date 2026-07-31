export const NOTIFICATION_CATEGORIES = Object.freeze({
  ACTIVITY: 'activity',
  SYNC: 'sync',
})

export const NOTIFICATION_PRIORITIES = Object.freeze({
  ACTIONABLE: 'actionable',
  CRITICAL: 'critical',
  INFO: 'info',
})

export function isExpired(notification, now = Date.now()) {
  return Boolean(notification.expires_at && Date.parse(notification.expires_at) <= now)
}

export function isBadgeEligible(notification, now = Date.now()) {
  return Boolean(
    !notification.resolved_at &&
      !isExpired(notification, now) &&
      [NOTIFICATION_PRIORITIES.ACTIONABLE, NOTIFICATION_PRIORITIES.CRITICAL].includes(notification.priority),
  )
}

export function notificationDestination(notification) {
  const { action_type: type, action_payload: payload = {} } = notification
  if (type === 'activity_review' && payload.activityId) return `/practice/history/${payload.type ?? 'freeform'}/${payload.activityId}`
  if (type === 'sync_review') return '/practice/history'
  // `/profile/reports`, not `/profile` (DEFECT_REGISTER D-11 gap 3). A weekly
  // report notification landed the reader on the ME career summary, which is a
  // different screen that does not contain the report they were told about.
  // Wrong under every resolution of the other two gaps in D-11 — the report is
  // never at `/profile` regardless of who generates it — so it is corrected
  // independently of that product decision.
  if (type === 'weekly_report') return payload.href ?? '/profile/reports'
  return null
}

export function dedupeNotifications(existing, incoming) {
  const match = existing.find(
    (notification) =>
      notification.user_id === incoming.user_id &&
      notification.dedupe_key === incoming.dedupe_key &&
      !notification.resolved_at,
  )
  if (!match) return [...existing, incoming]
  return existing.map((notification) =>
    notification.id === match.id
      ? { ...notification, ...incoming, id: match.id, created_at: match.created_at, read_at: match.read_at }
      : notification,
  )
}
