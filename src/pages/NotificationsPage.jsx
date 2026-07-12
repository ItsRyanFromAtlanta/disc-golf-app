import { useNavigate } from 'react-router-dom'
import NotificationSheet from '../components/NotificationSheet'
import { notificationRepository } from '../lib/repository/notificationRepository'
import { useAuth } from '../context/AuthContext'

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <main className="notifications-page">
      <NotificationSheet
        userId={user?.id}
        onOpen={async (notification, destination) => {
          await notificationRepository.setStatus(notification.id, { read_at: new Date().toISOString() })
          navigate(destination)
        }}
        onResolve={(notification) => notificationRepository.setStatus(notification.id, { resolved_at: new Date().toISOString() })}
      />
    </main>
  )
}
