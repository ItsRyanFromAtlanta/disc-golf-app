import { IconArrowLeft, IconBell } from '@tabler/icons-react'

export default function GlobalHeader({ title, showBack, onBack, onNotifications }) {
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
        <button
          type="button"
          className="global-header-icon-button"
          onClick={onNotifications}
          aria-label="Notifications"
        >
          <IconBell size={23} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
