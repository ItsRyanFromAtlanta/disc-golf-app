import { Outlet } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import TabBar from './TabBar'
import { useCrashRecoveryRedirect } from '../hooks/useCrashRecoveryRedirect'

export default function AppShell() {
  // Resumes a killed-and-relaunched PWA that reopened on the wrong page —
  // checked once per app load, not on every navigation. See the hook's own
  // comment for why that distinction matters.
  useCrashRecoveryRedirect()

  return (
    <ProtectedRoute>
      <div className="app-shell">
        <div className="app-shell-content">
          <Outlet />
        </div>
        <TabBar />
      </div>
    </ProtectedRoute>
  )
}
