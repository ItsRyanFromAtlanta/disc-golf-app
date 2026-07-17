import { liveQuery } from 'dexie'
import { db as defaultDb } from '../db/dexieDb'
import { dedupeNotifications, isBadgeEligible } from '../notifications'
import { isOptionalNotificationEnabled } from '../notificationPreferences'

export const NOTIFICATION_OUTBOX_TABLE = 'notifications'

function outboxRow(op, payload) {
  return {
    table: NOTIFICATION_OUTBOX_TABLE,
    op,
    payload,
    createdAt: Date.now(),
    idempotencyKey: `notification:${op}:${payload.id}:${crypto.randomUUID()}`,
    dependencyKey: null,
    attemptCount: 0,
    lastErrorClass: null,
    nextRetryAt: null,
    poison: false,
  }
}

export function createNotificationRepository({ database = defaultDb } = {}) {
  async function upsert(notification) {
    if (notification.priority !== 'critical') {
      const preferences = await database.notificationPreferences.where('user_id').equals(notification.user_id).toArray()
      if (!isOptionalNotificationEnabled(preferences, notification.category)) return null
    }
    const existing = await database.notifications.where('user_id').equals(notification.user_id).toArray()
    const merged = dedupeNotifications(existing, notification)
    const current = merged.find((row) => row.dedupe_key === notification.dedupe_key && !row.resolved_at) ?? notification
    await database.transaction('rw', database.notifications, database.outbox, async () => {
      await database.notifications.put(current)
      await database.outbox.add(outboxRow('upsert', current))
    })
    return current
  }

  async function setStatus(id, status) {
    const notification = await database.notifications.get(id)
    if (!notification) return null
    const next = { ...notification, ...status, updated_at: new Date().toISOString() }
    await database.transaction('rw', database.notifications, database.outbox, async () => {
      await database.notifications.put(next)
      await database.outbox.add(outboxRow('set_status', next))
    })
    return next
  }

  function observe(userId, listener) {
    return liveQuery(() => database.notifications.where('user_id').equals(userId).reverse().sortBy('created_at')).subscribe(listener)
  }

  async function list(userId) {
    return database.notifications.where('user_id').equals(userId).reverse().sortBy('created_at')
  }

  async function badgeCount(userId, now = Date.now()) {
    return (await list(userId)).filter((notification) => isBadgeEligible(notification, now)).length
  }

  return { upsert, setStatus, observe, list, badgeCount }
}

export const notificationRepository = createNotificationRepository()
