import { IconAlertCircle, IconBell, IconCheck, IconRefresh } from '@tabler/icons-react'
import { notificationDestination } from '../lib/notifications'
import { useNotifications } from '../hooks/useNotifications'

const CATEGORY_ICON = {
  activity: IconAlertCircle,
  sync: IconRefresh,
}

export default function NotificationSheet({ userId, onOpen, onResolve }) {
  const { notifications, syncFailed } = useNotifications(userId)
  const visible = notifications.filter((notification) => !notification.resolved_at)
  // The empty state has to distinguish "nothing to show" from "we could not find
  // out" — the last mile of D-24. The header bell already renders the failure
  // state, but the sheet body called `useNotifications` independently and read
  // only `.notifications`, so a first-ever sync failure (no prior successful
  // load, so nothing cached to fall back on) still said "You're all caught up."
  // over a list it had failed to fetch. That is the exact reassuring lie the
  // round outbox used to tell.
  if (!visible.length && syncFailed) {
    return (
      <p className="sheet-empty-state sheet-empty-state-unavailable" role="status">
        Notifications could not be loaded. They will appear once the connection recovers.
      </p>
    )
  }
  if (!visible.length) return <p className="sheet-empty-state">You’re all caught up.</p>

  return (
    <ul className="notification-list" aria-label="Notifications">
      {visible.map((notification) => {
        const Icon = CATEGORY_ICON[notification.category] ?? IconBell
        const destination = notificationDestination(notification)
        return (
          <li key={notification.id} className={`notification-row ${notification.read_at ? '' : 'notification-row-unread'}`}>
            <Icon size={22} aria-hidden="true" />
            <div className="notification-copy">
              <strong>{notification.title}</strong>
              {notification.body ? <span>{notification.body}</span> : null}
            </div>
            {destination ? (
              <button type="button" className="link-button notification-action" onClick={() => onOpen(notification, destination)}>
                Review
              </button>
            ) : (
              <button type="button" className="notification-resolve" onClick={() => onResolve(notification)} aria-label={`Resolve ${notification.title}`}>
                <IconCheck size={20} aria-hidden="true" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
