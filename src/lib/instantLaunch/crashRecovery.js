// Parses the two session-hosting routes; anything else (practice menu,
// history, bag, profile) has no session type of its own.
export function routeSessionTypeFromPath(pathname) {
  if (pathname === '/practice/freeform') return { sessionType: 'freeform' }
  const match = pathname.match(/^\/practice\/regimens\/([^/]+)\/run$/)
  if (match) return { sessionType: 'regimen', regimenId: match[1] }
  return { sessionType: null }
}

// Decides whether the current route needs to redirect to resume a buffered
// session. Returns a path to navigate to, or null if no redirect is needed
// (either there's no active session, or the current route already matches
// it exactly — including, for a regimen run, matching regimenId).
//
// Deliberately does NOT redirect away from non-session pages just because a
// session is buffered as active — a user browsing History or Profile mid-run
// should not get yanked back to the canvas. The caller (useCrashRecoveryRedirect)
// only invokes this once per app load, precisely so this only fires for the
// "killed-and-relaunched PWA reopened on the wrong page" scenario, not on
// every in-app navigation.
export function resolveCrashRecoveryRedirect(crashRecoveryBuffer, currentRoute) {
  if (!crashRecoveryBuffer?.hasActiveSession) return null

  const { sessionType, parentIds } = crashRecoveryBuffer
  const target =
    sessionType === 'regimen'
      ? `/practice/regimens/${parentIds?.regimenId}/run`
      : sessionType === 'freeform'
        ? '/practice/freeform'
        : null
  if (!target) return null

  const alreadyThere =
    currentRoute.sessionType === sessionType &&
    (sessionType !== 'regimen' || currentRoute.regimenId === parentIds?.regimenId)

  return alreadyThere ? null : target
}
