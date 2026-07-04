import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import PracticeMenuPage from './pages/PracticeMenuPage'
import FreeformLogPage from './pages/FreeformLogPage'
import RegimenSelectPage from './pages/RegimenSelectPage'
import RegimenRunPage from './pages/RegimenRunPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import ConfidenceMapPage from './pages/ConfidenceMapPage'
import ProfilePage from './pages/ProfilePage'
import BagPage from './pages/BagPage'
import BagLockerPage from './pages/BagLockerPage'
import BagManagePage from './pages/BagManagePage'
import DiscFormPage from './pages/DiscFormPage'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading ? null : <Navigate to={user ? '/practice' : '/login'} replace />
        }
      />
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route index element={<PracticeMenuPage />} />
        <Route path="freeform" element={<FreeformLogPage />} />
        <Route path="regimens" element={<RegimenSelectPage />} />
        <Route path="regimens/:regimenId/run" element={<RegimenRunPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:type/:id" element={<HistoryDetailPage />} />
        <Route path="stats" element={<ConfidenceMapPage />} />
      </Route>
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bag"
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route index element={<BagPage />} />
        <Route path="locker" element={<BagLockerPage />} />
        <Route path="manage" element={<BagManagePage />} />
        <Route path="discs/new" element={<DiscFormPage />} />
        <Route path="discs/:discId" element={<DiscFormPage />} />
      </Route>
      {/* Old flat URLs from the v1/v2 slices */}
      <Route path="/regimens" element={<Navigate to="/practice/regimens" replace />} />
    </Routes>
  )
}

export default App
