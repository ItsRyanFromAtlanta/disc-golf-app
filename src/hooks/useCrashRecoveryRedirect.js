import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { readInstantLaunchState } from '../lib/instantLaunch/storage'
import { resolveCrashRecoveryRedirect, routeSessionTypeFromPath } from '../lib/instantLaunch/crashRecovery'

// Checked exactly once per app load (the ref guard), not on every
// navigation. This exists to resume a killed-and-relaunched PWA that
// reopened on the wrong page (e.g. at the practice menu instead of a
// mid-flight regimen run) — it deliberately does not re-fire on ordinary
// in-app navigation, or a user browsing History/Profile mid-session would
// get yanked back to the canvas. See crashRecovery.js for the full reasoning.
export function useCrashRecoveryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    const { crashRecoveryBuffer } = readInstantLaunchState()
    const redirectTo = resolveCrashRecoveryRedirect(crashRecoveryBuffer, routeSessionTypeFromPath(location.pathname))
    if (redirectTo && redirectTo !== location.pathname) {
      navigate(redirectTo, { replace: true })
    }
    // Mount-once by design (see comment above) — not re-run when location changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
