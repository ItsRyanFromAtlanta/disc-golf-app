import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import ScreenFallback from './ScreenFallback'
import TabBar from './TabBar'
import GlobalHeader from './GlobalHeader'
import ScreenScrollRegion from './ScreenScrollRegion'
import SheetHost from './SheetHost'
import ToastHost from './ToastHost'
import { ToastContext, useToastController } from '../hooks/useToast'
import { useCrashRecoveryRedirect } from '../hooks/useCrashRecoveryRedirect'
import { useOnboardingGate } from '../hooks/useOnboardingGate'
import { useActiveActivity } from '../hooks/useActiveActivity'
import { useActivityNavigationLifecycle } from '../hooks/useActivityNavigationLifecycle'
import { useNotifications } from '../hooks/useNotifications'
import NotificationSheet from './NotificationSheet'
import { notificationRepository } from '../lib/repository/notificationRepository'
import { useAuth } from '../hooks/useAuth'
import { resolveActivityResume, resolveRouteMetadata, resolveSectionRoot, SHELL_TYPES } from '../lib/routeMetadata'

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const activeActivity = useActiveActivity(user?.id)
  const { badgeCount, syncFailed } = useNotifications(user?.id)
  useActivityNavigationLifecycle(user?.id, activeActivity)
  const scrollRegionRef = useRef(null)
  const scrollPositionsRef = useRef({})
  const requestedTopRef = useRef(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const [sheet, setSheet] = useState(null)
  // § 6/§ 13: the shell owns the toast host. Anything rendered beneath it
  // raises a toast through `useToast()`; nothing else stores toast state.
  const { toast, showToast, dismissToast } = useToastController()
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
  // Destination *and* accessible name come from the route contract, so the
  // pill can advertise any activity type that has a capture screen — a round
  // included — instead of the two the shell used to spell out here.
  const activityResume = resolveActivityResume(activeActivity)

  // `route.scrollKey` identifies a route *instance*, not a route: two course
  // detail pages resolve to different keys, so this re-runs when you move
  // between them and each record is restored to its own offset rather than
  // inheriting the previous one's. `scrollPositionsRef` therefore holds one
  // entry per record visited this session — a few numbers, discarded on unmount.
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
      <ToastContext.Provider value={showToast}>
        <div className={`app-shell ${isActiveShell ? 'app-shell-active' : 'app-shell-standard'}`}>
          {isActiveShell ? (
            <div className="active-activity-shell">
              {/* Inside the shell chrome, never around it: the boundary has to
                  sit where a screen's own loading state sits, so a chunk that
                  is still downloading swaps the same box a pending query
                  would. Hoisting it above this div would blank the frame. */}
              <Suspense fallback={<ScreenFallback />}>
                <Outlet />
              </Suspense>
            </div>
          ) : (
            <div className="app-shell-standard-content" aria-hidden={sheet ? true : undefined}>
              <GlobalHeader
                title={route?.title ?? 'Disc Golf'}
                showBack={Boolean(route && !isRoot)}
                onBack={handleBack}
                showActivityPill={route?.showActivityPill}
                activityResume={activityResume}
                notificationCount={badgeCount}
                notificationsUnavailable={syncFailed}
                onNotifications={() =>
                  setSheet({
                    title: 'Notifications',
                    content: (
                      <NotificationSheet
                        userId={user?.id}
                        onOpen={async (notification, destination) => {
                          await notificationRepository.setStatus(notification.id, { read_at: new Date().toISOString() })
                          setSheet(null)
                          navigate(destination)
                        }}
                        onResolve={(notification) => notificationRepository.setStatus(notification.id, { resolved_at: new Date().toISOString() })}
                      />
                    ),
                  })
                }
              />
              <ScreenScrollRegion ref={scrollRegionRef} onScroll={handleScroll}>
                {/* Inside the scroll region, below the header and above the
                    tab bar, so both stay mounted while a route chunk loads.
                    Scroll restoration is unaffected: the only routes that
                    have a saved scrollTop are ones already visited, whose
                    chunk is resolved and therefore renders synchronously. */}
                <Suspense fallback={<ScreenFallback />}>
                  <Outlet />
                </Suspense>
              </ScreenScrollRegion>
              <TabBar
                isAtTop={isAtTop}
                hasRequestedTop={requestedTopRef.current}
                onScrollToTop={scrollToTop}
              />
            </div>
          )}
          <SheetHost sheet={sheet} onClose={() => setSheet(null)} />
          <ToastHost toast={toast?.message ?? null} onDismiss={dismissToast} />
        </div>
      </ToastContext.Provider>
    </ProtectedRoute>
  )
}
