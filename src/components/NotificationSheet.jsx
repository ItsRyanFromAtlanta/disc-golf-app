import { IconAlertCircle, IconBell, IconCheck, IconRefresh } from '@tabler/icons-react'
import { notificationDestination } from '../lib/notifications'
import { useNotifications } from '../hooks/useNotifications'

const CATEGORY_ICON = {
  activity: IconAlertCircle,
  sync: IconRefresh,
}

export default function NotificationSheet({ userId, onOpen, onResolve }) {
  const { notifications } = useNotifications(userId)
  const visible = notifications.filter((notification) => !notification.resolved_at)
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
