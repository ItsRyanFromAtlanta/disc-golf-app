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
import RoutineBuilderPage from './pages/RoutineBuilderPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import ConfidenceMapPage from './pages/ConfidenceMapPage'
import ProfilePage from './pages/ProfilePage'
import CareerHubPage from './pages/CareerHubPage'
import TrophyRoomPage from './pages/TrophyRoomPage'
import BagPage from './pages/BagPage'
import BagLockerPage from './pages/BagLockerPage'
import BagManagePage from './pages/BagManagePage'
import DiscFormPage from './pages/DiscFormPage'
import DiscDetailPage from './pages/DiscDetailPage'
import DiscComparePage from './pages/DiscComparePage'
import LostFoundPage from './pages/LostFoundPage'
import NotificationsPage from './pages/NotificationsPage'
import CoursesPage from './pages/CoursesPage'
import CourseFormPage from './pages/CourseFormPage'
import CourseDetailPage from './pages/CourseDetailPage'
import RoundsPage from './pages/RoundsPage'
import RoundStartPage from './pages/RoundStartPage'
import RoundScorecardPage from './pages/RoundScorecardPage'
import RoundSummaryPage from './pages/RoundSummaryPage'
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
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/practice">
          <Route index element={<PracticeMenuPage />} />
          <Route path="freeform" element={<FreeformLogPage />} />
          <Route path="regimens" element={<RegimenSelectPage />} />
          <Route path="regimens/new" element={<RoutineBuilderPage />} />
          <Route path="regimens/:regimenId/run" element={<RegimenRunPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/deleted" element={<HistoryPage deleted />} />
          <Route path="history/:type/:id" element={<HistoryDetailPage />} />
          <Route path="stats" element={<ConfidenceMapPage />} />
        </Route>
        <Route path="/profile">
          <Route index element={<CareerHubPage />} />
          <Route path="details" element={<ProfilePage />} />
          <Route path="trophies" element={<TrophyRoomPage />} />
        </Route>
        <Route path="/bag">
          <Route index element={<BagPage />} />
          <Route path="locker" element={<BagLockerPage />} />
          <Route path="compare" element={<DiscComparePage />} />
          <Route path="lost-found" element={<LostFoundPage />} />
          <Route path="manage" element={<BagManagePage />} />
          <Route path="discs/new" element={<DiscFormPage />} />
          <Route path="discs/:discId" element={<DiscDetailPage />} />
        </Route>
        <Route path="/courses">
          <Route index element={<CoursesPage />} />
          <Route path="new" element={<CourseFormPage />} />
          <Route path=":courseId" element={<CourseDetailPage />} />
        </Route>
        <Route path="/rounds">
          <Route index element={<RoundsPage />} />
          <Route path="new" element={<RoundStartPage />} />
          <Route path=":roundId/summary" element={<RoundSummaryPage />} />
          <Route path=":roundId" element={<RoundScorecardPage />} />
        </Route>
      </Route>

      {/* Old flat URLs from the v1/v2 slices */}
      <Route path="/regimens" element={<Navigate to="/practice/regimens" replace />} />
    </Routes>
  )
}

export default App
