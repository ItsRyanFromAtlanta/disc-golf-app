import { IconArrowLeft, IconBell } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

export default function GlobalHeader({ title, showBack, onBack, onNotifications, notificationCount = 0, showActivityPill, activeActivity, activeHref }) {
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
        {showActivityPill && activeActivity && activeHref ? (
          <Link to={activeHref} className="active-activity-pill" aria-label="Resume active practice">
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
