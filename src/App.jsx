import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import ScreenFallback from './components/ScreenFallback'
import './App.css'

// Boot path — deliberately NOT lazy.
//
// These three are what a cold start actually renders. Splitting them would
// buy nothing and cost a request waterfall: the browser cannot discover a
// lazy chunk until the entry chunk has downloaded, parsed, and run, so a
// lazy landing screen turns one round trip into two before the first pixel.
// On course, on a bad cell connection, that second round trip is the whole
// problem we are trying to fix.
//
//   SplashPage       — the signed-out landing at `/`
//   AuthPage         — the only way out of the signed-out landing
//   PracticeMenuPage — where `/` redirects a signed-in user, i.e. the screen
//                      the overwhelming majority of cold starts end on
//
// AppShell, ProtectedRoute and PwaUpdatePrompt are static above for the same
// reason: they are the frame every authenticated route renders inside.
import SplashPage from './pages/SplashPage'
import AuthPage from './pages/AuthPage'
import PracticeMenuPage from './pages/PracticeMenuPage'

// Everything below is reached by an explicit navigation, so its chunk is
// fetched while the user is already looking at a rendered screen. The service
// worker precaches every built asset (see vite.config.js), so an installed app
// still has all of these available offline — the split changes when they are
// downloaded, never whether they are.
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const FreeformLogPage = lazy(() => import('./pages/FreeformLogPage'))
const RegimenSelectPage = lazy(() => import('./pages/RegimenSelectPage'))
const RegimenRunPage = lazy(() => import('./pages/RegimenRunPage'))
const RoutineBuilderPage = lazy(() => import('./pages/RoutineBuilderPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const HistoryDetailPage = lazy(() => import('./pages/HistoryDetailPage'))
const ConfidenceMapPage = lazy(() => import('./pages/ConfidenceMapPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const CareerHubPage = lazy(() => import('./pages/CareerHubPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const GoalsPage = lazy(() => import('./pages/GoalsPage'))
const WeeklyReportsPage = lazy(() => import('./pages/WeeklyReportsPage'))
const TrophyRoomPage = lazy(() => import('./pages/TrophyRoomPage'))
const BagPage = lazy(() => import('./pages/BagPage'))
const BagLockerPage = lazy(() => import('./pages/BagLockerPage'))
const BagManagePage = lazy(() => import('./pages/BagManagePage'))
const DiscFormPage = lazy(() => import('./pages/DiscFormPage'))
const DiscDetailPage = lazy(() => import('./pages/DiscDetailPage'))
const DiscComparePage = lazy(() => import('./pages/DiscComparePage'))
const LostFoundPage = lazy(() => import('./pages/LostFoundPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const CourseFormPage = lazy(() => import('./pages/CourseFormPage'))
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'))
const CoursePrepPage = lazy(() => import('./pages/CoursePrepPage'))
const RoundsPage = lazy(() => import('./pages/RoundsPage'))
const RoundStartPage = lazy(() => import('./pages/RoundStartPage'))
const RoundScorecardPage = lazy(() => import('./pages/RoundScorecardPage'))
const RoundSummaryPage = lazy(() => import('./pages/RoundSummaryPage'))

function App() {
  const { user, loading } = useAuth()

  return (
    <>
      <PwaUpdatePrompt />
      <Routes>
      <Route
        path="/"
        element={loading ? null : user ? <Navigate to="/practice" replace /> : <SplashPage />}
      />
      <Route path="/login" element={<AuthPage />} />
      {/* Onboarding needs a session (guest or real) but not the tab-barred
          shell — useOnboardingGate (in AppShell) is what routes a
          never-onboarded user here in the first place. Its Suspense boundary
          is local rather than around <Routes>, because a boundary that high
          would unmount the shell — header and tab bar included — every time a
          lazy route resolved. */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Suspense fallback={<ScreenFallback />}>
              <OnboardingPage />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Every authenticated route lives under one shell: auth guard + the
          persistent bottom tab bar (Practice / Bag / Profile today; Rounds
          and Caddie slot in here as sibling top-level routes later). The
          shell owns the Suspense boundary for everything nested here; see
          AppShell.jsx. */}
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
          <Route path="settings" element={<SettingsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="reports" element={<WeeklyReportsPage />} />
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
          <Route path=":courseId/prep" element={<CoursePrepPage />} />
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
    </>
  )
}

export default App
