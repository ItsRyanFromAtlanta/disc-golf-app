import { Outlet } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import TabBar from './TabBar'

export default function AppShell() {
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
