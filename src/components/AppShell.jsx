import { useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import TabBar from './TabBar'
import GlobalHeader from './GlobalHeader'
import ScreenScrollRegion from './ScreenScrollRegion'
import SheetHost from './SheetHost'
import ToastHost from './ToastHost'
import { useCrashRecoveryRedirect } from '../hooks/useCrashRecoveryRedirect'
import { useOnboardingGate } from '../hooks/useOnboardingGate'
import { useActiveActivity } from '../hooks/useActiveActivity'
import { useActivityNavigationLifecycle } from '../hooks/useActivityNavigationLifecycle'
import { useAuth } from '../context/AuthContext'
import { resolveRouteMetadata, resolveSectionRoot, SHELL_TYPES } from '../lib/routeMetadata'

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const activeActivity = useActiveActivity(user?.id)
  useActivityNavigationLifecycle(user?.id, activeActivity)
  const scrollRegionRef = useRef(null)
  const scrollPositionsRef = useRef({})
  const requestedTopRef = useRef(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const [sheet, setSheet] = useState(null)
  // Resumes a killed-and-relaunched PWA that reopened on the wrong page —
  // checked once per app load, not on every navigation. See the hook's own
  // comment for why that distinction matters.
  useCrashRecoveryRedirect()
  // Routes a never-onboarded user (zero bags) to Screen 3 before they reach
  // the tab-barred shell.
  useOnboardingGate()

  const route = resolveRouteMetadata(pathname)
  const isActiveShell = route?.shell === SHELL_TYPES.ACTIVE
  const isRoot = route && resolveSectionRoot(route.section) === pathname
  const activeHref =
    activeActivity?.type === 'putting_regimen' && activeActivity.metadata?.regimenId
      ? `/practice/regimens/${activeActivity.metadata.regimenId}/run`
      : activeActivity?.type === 'putting_freeform'
        ? '/practice/freeform'
        : null

  useLayoutEffect(() => {
    if (isActiveShell) return
    const region = scrollRegionRef.current
    if (!region || !route?.scrollKey) return

    const top = scrollPositionsRef.current[route.scrollKey] ?? 0
    region.scrollTop = top
    setIsAtTop(top <= 1)
    requestedTopRef.current = false
  }, [isActiveShell, route?.scrollKey])

  function handleScroll(event) {
    if (route?.scrollKey) scrollPositionsRef.current[route.scrollKey] = event.currentTarget.scrollTop
    const atTop = event.currentTarget.scrollTop <= 1
    setIsAtTop(atTop)
    if (!atTop) requestedTopRef.current = false
  }

  function scrollToTop() {
    requestedTopRef.current = true
    scrollRegionRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setIsAtTop(true)
  }

  function handleBack() {
    const root = resolveSectionRoot(route?.section)
    if (root) navigate(root)
  }

  return (
    <ProtectedRoute>
      <div className={`app-shell ${isActiveShell ? 'app-shell-active' : 'app-shell-standard'}`}>
        {isActiveShell ? (
          <div className="active-activity-shell">
            <Outlet />
          </div>
        ) : (
          <div className="app-shell-standard-content" aria-hidden={sheet ? true : undefined}>
            <GlobalHeader
              title={route?.title ?? 'Disc Golf'}
              showBack={Boolean(route && !isRoot)}
              onBack={handleBack}
              showActivityPill={route?.showActivityPill}
              activeActivity={activeActivity}
              activeHref={activeHref}
              onNotifications={() =>
                setSheet({
                  title: 'Notifications',
                  content: <p className="sheet-empty-state">You’re all caught up.</p>,
                })
              }
            />
            <ScreenScrollRegion ref={scrollRegionRef} onScroll={handleScroll}>
              <Outlet />
            </ScreenScrollRegion>
            <TabBar
              isAtTop={isAtTop}
              hasRequestedTop={requestedTopRef.current}
              onScrollToTop={scrollToTop}
            />
          </div>
        )}
        <SheetHost sheet={sheet} onClose={() => setSheet(null)} />
        <ToastHost toast={null} />
      </div>
    </ProtectedRoute>
  )
}
