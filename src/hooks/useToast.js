import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// § 6/§ 13: `AppShell` owns the toast host, so it owns the toast state too.
// This module is the seam between the shell that renders a toast and the code
// that raises one; `ToastHost` stays a pure presentational component.
//
// A toast is transient and local by contract (§ 6). It is never persisted and
// never becomes a notification row — § 7 reserves those for durable,
// actionable, cross-device items.
export const TOAST_DURATION_MS = 6000

// Deliberately a no-op default rather than a thrown "missing provider": the
// only producer today is `useInstantLaunchSession`, which also runs outside the
// shell (unit tests, and any future non-shell mount). A toast is an
// announcement, not a transaction — failing to place one must never break the
// lifecycle work that raised it.
const noopShowToast = () => {}
export const ToastContext = createContext(noopShowToast)

export function useToast() {
  return useContext(ToastContext)
}

/**
 * One toast slot, not a queue. § 1's auto-close notice is the only producer so
 * far, and a single slot is what makes "do not stack indefinitely" structural
 * rather than a cap someone has to remember to enforce: a newer toast replaces
 * the older one and restarts the timer. `key` lets a repeated raise of the same
 * event (a retried mirror, a StrictMode double-invoke) land on the same slot
 * instead of visibly re-announcing itself.
 */
export function useToastController({ durationMs = TOAST_DURATION_MS } = {}) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const dismissToast = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const showToast = useCallback(
    (message, { key = null } = {}) => {
      if (!message) return
      setToast((current) => (current && key && current.key === key ? current : { key, message }))
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setToast(null)
      }, durationMs)
    },
    [clearTimer, durationMs],
  )

  useEffect(() => clearTimer, [clearTimer])

  return { toast, showToast, dismissToast }
}
