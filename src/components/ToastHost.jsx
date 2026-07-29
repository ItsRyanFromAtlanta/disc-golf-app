import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// § 6: the shell owns the toast host, and transient toasts stay local — a
// toast is never persisted and never becomes a notification row (§ 7 reserves
// those for durable/actionable cross-device items).
export const TOAST_DURATION_MS = 6000

// Deliberately a no-op default rather than a thrown "missing provider": the
// only producer today is `useInstantLaunchSession`, which is also exercised
// outside the shell (unit tests, and any future non-shell mount). A toast is
// an announcement, not a transaction — failing to place one must never break
// the lifecycle work that raised it.
const noopShowToast = () => {}
const ToastContext = createContext(noopShowToast)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ showToast, children }) {
  return <ToastContext.Provider value={showToast}>{children}</ToastContext.Provider>
}

/**
 * One toast slot, not a queue. § 1's auto-close notice is the only producer so
 * far, and a single slot is what keeps "do not stack indefinitely" structural
 * rather than a cap someone has to remember to enforce: a newer toast replaces
 * the older one and restarts the timer. `key` lets a repeated raise of the
 * same event (a retried mirror, a StrictMode double-invoke) land on the same
 * slot instead of visibly re-announcing itself.
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

export default function ToastHost({ toast, onDismiss }) {
  if (!toast) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      <p className="toast-message">{toast}</p>
      {onDismiss ? (
        <button type="button" className="toast-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
