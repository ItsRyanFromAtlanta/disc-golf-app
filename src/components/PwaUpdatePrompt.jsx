import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { resolveRouteMetadata, SHELL_TYPES } from '../lib/routeMetadata'

// Service-worker update prompt.
//
// The app previously used registerType 'autoUpdate' with skipWaiting, which
// activates a new worker and reloads the page the moment a deploy lands.
// `main` auto-deploys, so that could reload the page mid-routine and take the
// active capture screen with it. Updates now wait for an explicit tap, and the
// prompt stays hidden entirely while an ACTIVE shell route is on screen — it
// reappears once the athlete is back on an ordinary screen.
export default function PwaUpdatePrompt() {
  const { pathname } = useLocation()
  const [needRefresh, setNeedRefresh] = useState(false)
  const [reloadSW, setReloadSW] = useState(null)

  useEffect(() => {
    let cancelled = false

    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        const update = registerSW({
          immediate: true,
          onNeedRefresh: () => setNeedRefresh(true),
        })
        // Stored in a setter callback so React keeps the function itself
        // rather than invoking it as a lazy initializer.
        setReloadSW(() => update)
      })
      .catch(() => {
        // No service worker in this environment (dev server, unsupported
        // browser). Nothing to update, nothing to show.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const isActiveCapture = resolveRouteMetadata(pathname)?.shell === SHELL_TYPES.ACTIVE
  if (!needRefresh || !reloadSW || isActiveCapture) return null

  return (
    <div className="pwa-update-prompt" role="status">
      <p className="pwa-update-copy">A new version is ready.</p>
      <div className="pwa-update-actions">
        <button type="button" className="btn-primary" onClick={() => reloadSW(true)}>
          Reload now
        </button>
        <button type="button" className="link-button" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    </div>
  )
}
