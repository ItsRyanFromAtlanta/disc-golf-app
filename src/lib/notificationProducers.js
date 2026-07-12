import { db as defaultDb } from './db/dexieDb'
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES } from './notifications'
import { notificationRepository as defaultRepository } from './repository/notificationRepository'

export async function produceActivityReviewNotifications({ userId, database = defaultDb, repository = defaultRepository }) {
  const incomplete = await database.activities.where('[user_id+state]').equals([userId, 'incomplete']).toArray()
  return Promise.all(
    incomplete.filter((activity) => !activity.hidden_at).map((activity) =>
      repository.upsert({
        id: crypto.randomUUID(), user_id: userId, category: NOTIFICATION_CATEGORIES.ACTIVITY,
        priority: NOTIFICATION_PRIORITIES.ACTIONABLE, title: 'Review incomplete activity',
        body: 'Finish its details or keep it in history for later review.', action_type: 'activity_review',
        action_payload: { activityId: activity.id, type: activity.type === 'putting_regimen' ? 'regimen' : 'freeform' },
        activity_id: activity.id, created_at: new Date().toISOString(), read_at: null, resolved_at: null,
        expires_at: null, updated_at: new Date().toISOString(), dedupe_key: `activity-review:${activity.id}`,
      }),
    ),
  )
}

export async function produceSyncAttentionNotification({ userId, database = defaultDb, repository = defaultRepository }) {
  const poisoned = (await database.outbox.toArray()).filter((row) => row.poison)
  if (!poisoned.length) return null
  const now = new Date().toISOString()
  return repository.upsert({
    id: crypto.randomUUID(), user_id: userId, category: NOTIFICATION_CATEGORIES.SYNC,
    priority: NOTIFICATION_PRIORITIES.CRITICAL, title: 'Sync needs attention',
    body: `${poisoned.length} saved change${poisoned.length === 1 ? '' : 's'} need review.`, action_type: 'sync_review',
    action_payload: {}, activity_id: null, created_at: now, read_at: null, resolved_at: null,
    expires_at: null, updated_at: now, dedupe_key: 'sync:poisoned-outbox',
  })
}
