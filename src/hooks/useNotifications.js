import { useEffect, useState } from 'react'
import { isBadgeEligible } from '../lib/notifications'
import { notificationRepository } from '../lib/repository/notificationRepository'
import { createNotificationSyncAdapter } from '../lib/repository/notificationSync'
import { produceActivityReviewNotifications, produceSyncAttentionNotification } from '../lib/notificationProducers'
import { settingsRepository } from '../lib/repository/settingsRepository'

// Runs the producer -> flush -> pull chain for a user's notifications and
// reports whether it succeeded, rather than swallowing the rejection the way
// the previous `.catch(() => {})` did (D-24). A caller that cannot tell "the
// chain never completed" from "the chain completed and found nothing" cannot
// honestly render an empty inbox. Dependencies are injectable so this can be
// exercised without a live Supabase client or Dexie database.
export async function syncNotifications(
  userId,
  {
    sync = createNotificationSyncAdapter(),
    listPreferences = settingsRepository.listNotificationPreferences,
    produceActivityReview = produceActivityReviewNotifications,
    produceSyncAttention = produceSyncAttentionNotification,
  } = {},
) {
  try {
    // Producers are deterministic and deduped: an incomplete activity or a
    // poisoned outbox row can surface once without turning normal audit rows
    // into notification noise. A failed preference load must not skip
    // production, so it is swallowed locally rather than aborting the chain —
    // this is the one intentionally-ignored failure left, because the
    // producers below have their own defaults and losing a user's mute
    // preference for one cycle is not the same class of problem as losing
    // their notifications outright.
    await listPreferences(userId).catch(() => [])
    await Promise.all([produceActivityReview({ userId }), produceSyncAttention({ userId })])
    await sync.flush()
    await sync.pull(userId)
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

// The `notificationRepository.observe` error callback used to respond to a
// local read failure by setting the list to `[]` — the exact same state a
// genuinely empty inbox produces (D-24). A read failure is not the fact "you
// have no notifications"; it is the fact "we do not know what you have". So a
// failed read now leaves whatever notifications are already known in place
// and only raises the failure flag, instead of erasing them.
export function createObserveListener({ setNotifications, setSyncFailed }) {
  return {
    next: (rows) => {
      setSyncFailed(false)
      setNotifications(rows)
    },
    error: () => setSyncFailed(true),
  }
}

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [syncFailed, setSyncFailed] = useState(false)

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setSyncFailed(false)
      return undefined
    }
    let cancelled = false
    setSyncFailed(false)
    syncNotifications(userId).then((result) => {
      if (!cancelled && !result.ok) setSyncFailed(true)
    })
    const subscription = notificationRepository.observe(
      userId,
      createObserveListener({
        setNotifications: (rows) => { if (!cancelled) setNotifications(rows) },
        setSyncFailed: (value) => { if (!cancelled) setSyncFailed(value) },
      }),
    )
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [userId])

  return {
    notifications,
    badgeCount: notifications.filter((notification) => isBadgeEligible(notification)).length,
    // True when the most recent attempt to produce, flush, pull, or read
    // notifications failed. Distinct from an empty `notifications` array,
    // which now only ever means "we checked and there is nothing" — see
    // AppShell/GlobalHeader for how the shell badge renders this.
    syncFailed,
  }
}
