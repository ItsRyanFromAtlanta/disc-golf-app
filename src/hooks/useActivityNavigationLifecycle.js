import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ACTIVITY_SOURCES, ACTIVITY_STATE_REASONS, ACTIVITY_STATES } from '../lib/activityLifecycle'
import { activityRepository } from '../lib/repository/activityRepository'
import { getInstallationId } from '../lib/instantLaunch/installationId'
import { readInstantLaunchState } from '../lib/instantLaunch/storage'
import { resolveRouteMetadata, SHELL_TYPES } from '../lib/routeMetadata'

function lifecycleMutation(activity, reason, idempotencyKey) {
  const now = new Date().toISOString()
  return {
    expectedState: activity.state,
    expectedVersion: activity.version,
    occurredAt: now,
    recordedAt: now,
    source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    installationId: getInstallationId(),
    reason,
    idempotencyKey,
    metadata: { source: 'route_navigation' },
  }
}

// Leaving a live screen is a real lifecycle boundary, while switching from
// one live screen to another is not. The crash buffer remains authoritative:
// if End/Abandon already cleared it, navigation must not create a synthetic
// pause after the user finished the session.
export function useActivityNavigationLifecycle(userId, activeActivity) {
  const { pathname } = useLocation()
  const previousPathRef = useRef(pathname)
  const operationRef = useRef(null)

  useEffect(() => {
    const previousRoute = resolveRouteMetadata(previousPathRef.current)
    const nextRoute = resolveRouteMetadata(pathname)
    const leftActive = previousRoute?.shell === SHELL_TYPES.ACTIVE && nextRoute?.shell !== SHELL_TYPES.ACTIVE
    const enteredActive = previousRoute?.shell !== SHELL_TYPES.ACTIVE && nextRoute?.shell === SHELL_TYPES.ACTIVE
    previousPathRef.current = pathname

    if (!userId || !activeActivity || !readInstantLaunchState().crashRecoveryBuffer.hasActiveSession) return

    if (leftActive && activeActivity.state === ACTIVITY_STATES.ACTIVE) {
      const key = `navigation:${activeActivity.id}:${activeActivity.version}:pause`
      if (operationRef.current !== key) {
        operationRef.current = key
        void activityRepository
          .pause(activeActivity.id, lifecycleMutation(activeActivity, ACTIVITY_STATE_REASONS.NAVIGATION_AWAY, key))
          .catch(() => null)
      }
      return
    }

    if (enteredActive && activeActivity.state === ACTIVITY_STATES.PAUSED) {
      const key = `navigation:${activeActivity.id}:${activeActivity.version}:resume`
      if (operationRef.current !== key) {
        operationRef.current = key
        void activityRepository
          .resume(activeActivity.id, lifecycleMutation(activeActivity, ACTIVITY_STATE_REASONS.USER_RESUME, key))
          .catch(() => null)
      }
    }
  }, [activeActivity, pathname, userId])
}
