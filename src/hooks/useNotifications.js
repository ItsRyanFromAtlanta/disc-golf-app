import { useEffect, useState } from 'react'
import { isBadgeEligible } from '../lib/notifications'
import { notificationRepository } from '../lib/repository/notificationRepository'
import { createNotificationSyncAdapter } from '../lib/repository/notificationSync'
import { produceActivityReviewNotifications, produceSyncAttentionNotification } from '../lib/notificationProducers'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      return undefined
    }
    const sync = createNotificationSyncAdapter()
    // Producers are deterministic and deduped: an incomplete activity or a
    // poisoned outbox row can surface once without turning normal audit rows
    // into notification noise.
    Promise.all([
      produceActivityReviewNotifications({ userId }),
      produceSyncAttentionNotification({ userId }),
    ])
      .then(() => sync.flush())
      .then(() => sync.pull(userId))
      .catch(() => {})
    const subscription = notificationRepository.observe(userId, {
      next: (rows) => setNotifications(rows),
      error: () => setNotifications([]),
    })
    return () => subscription.unsubscribe()
  }, [userId])

  return {
    notifications,
    badgeCount: notifications.filter((notification) => isBadgeEligible(notification)).length,
  }
}
