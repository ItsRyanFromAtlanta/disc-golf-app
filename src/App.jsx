import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import SplashPage from './pages/SplashPage'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
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
import DiscDetailPage from './pages/DiscDetailPage'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={loading ? null : user ? <Navigate to="/practice" replace /> : <SplashPage />}
      />
      <Route path="/login" element={<AuthPage />} />
      {/* Onboarding needs a session (guest or real) but not the tab-barred
          shell — useOnboardingGate (in AppShell) is what routes a
          never-onboarded user here in the first place. */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Every authenticated route lives under one shell: auth guard + the
          persistent bottom tab bar (Practice / Bag / Profile today; Rounds
          and Caddie slot in here as sibling top-level routes later). */}
      <Route element={<AppShell />}>
        <Route path="/practice">
          <Route index element={<PracticeMenuPage />} />
          <Route path="freeform" element={<FreeformLogPage />} />
          <Route path="regimens" element={<RegimenSelectPage />} />
          <Route path="regimens/:regimenId/run" element={<RegimenRunPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:type/:id" element={<HistoryDetailPage />} />
          <Route path="stats" element={<ConfidenceMapPage />} />
        </Route>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/bag">
          <Route index element={<BagPage />} />
          <Route path="locker" element={<BagLockerPage />} />
          <Route path="manage" element={<BagManagePage />} />
          <Route path="discs/new" element={<DiscFormPage />} />
          <Route path="discs/:discId" element={<DiscDetailPage />} />
        </Route>
      </Route>

      {/* Old flat URLs from the v1/v2 slices */}
      <Route path="/regimens" element={<Navigate to="/practice/regimens" replace />} />
    </Routes>
  )
}

export default App
