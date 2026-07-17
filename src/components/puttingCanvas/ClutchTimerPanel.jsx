import { useEffect, useRef, useState } from 'react'
import {
  clutchTimerState,
  formatClutchCountdown,
  requestClutchNotificationPermission,
} from '../../lib/clutchTimer'

export default function ClutchTimerPanel({ dueAt, distanceFt, onReady, onExit }) {
  const [timer, setTimer] = useState(() => clutchTimerState(dueAt, Date.now()))
  const [permission, setPermission] = useState(() => globalThis.Notification?.permission ?? 'unsupported')
  const firedRef = useRef(false)

  useEffect(() => {
    function tick() {
      const next = clutchTimerState(dueAt, Date.now())
      setTimer(next)
      if (next.status === 'putt_now' && !firedRef.current) {
        firedRef.current = true
        onReady()
      }
    }
    tick()
    const interval = globalThis.setInterval(tick, 1000)
    const handleVisibility = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      globalThis.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [dueAt, onReady])

  async function enableAlerts() {
    setPermission(await requestClutchNotificationPermission())
  }

  return (
    <section className="clutch-timer-panel" aria-live="polite">
      <p className="clutch-eyebrow">Clutch simulator · {distanceFt} ft</p>
      <h2>Reset. Do not rehearse.</h2>
      <p className="clutch-countdown" aria-label={`${formatClutchCountdown(timer.remainingMs)} remaining`}>
        {formatClutchCountdown(timer.remainingMs)}
      </p>
      <p>The exact deadline is saved. Leaving and returning will not reroll it.</p>
      {permission === 'default' && (
        <button type="button" className="secondary-button clutch-alert-button" onClick={enableAlerts}>
          Enable system alert
        </button>
      )}
      {permission === 'denied' && <p className="form-hint">System alerts are blocked; the in-app alarm still works.</p>}
      {permission === 'unsupported' && <p className="form-hint">System alerts are unavailable; keep the app nearby.</p>}
      <button type="button" className="link-button" onClick={onExit}>End run</button>
    </section>
  )
}
