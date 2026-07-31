import { IconArrowLeft, IconBell } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

// `activityResume` is `{ href, label }` or null — resolved by
// `resolveActivityResume` in the route contract. A single resolved prop rather
// than an activity plus a separately-computed href, because the pill's two
// previous inputs could disagree: an activity with no known destination left
// the header deciding whether a live activity was advertisable, which is a
// routing question, not a header one.
export default function GlobalHeader({ title, showBack, onBack, onNotifications, notificationCount = 0, showActivityPill, activityResume }) {
  return (
    <header className="global-header">
      <div className="global-header-leading">
        {showBack ? (
          <button type="button" className="global-header-icon-button" onClick={onBack} aria-label="Back">
            <IconArrowLeft size={24} aria-hidden="true" />
          </button>
        ) : null}
        <h1 className="global-header-title">{title}</h1>
      </div>
      <div className="global-header-actions">
        {showActivityPill && activityResume ? (
          <Link to={activityResume.href} className="active-activity-pill" aria-label={activityResume.label}>
            <span className="active-activity-pill-dot" aria-hidden="true" />
            Resume
          </Link>
        ) : null}
        <button
          type="button"
          className="global-header-icon-button notification-bell-button"
          onClick={onNotifications}
          aria-label={notificationCount ? `Notifications, ${notificationCount} needs attention` : 'Notifications'}
        >
          <IconBell size={23} aria-hidden="true" />
          {notificationCount ? <span className="notification-badge">{notificationCount > 99 ? '99+' : notificationCount}</span> : null}
        </button>
      </div>
    </header>
  )
}
