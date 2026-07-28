import { useEffect, useRef, useState } from 'react'

// Keeps the screen awake during active capture.
//
// A 100-putt routine is minutes of standing still between taps, and iOS
// auto-locks after 30 seconds by default. Without this the athlete is waking
// the phone between every station — exactly the one-thumb friction the field
// rules exist to prevent.
//
// The sentinel is released by the browser whenever the page is hidden, so a
// visibility listener re-acquires it on return. `supported` is reported back so
// callers can be honest about the fallback instead of implying it worked
// (same contract as usePuttHaptics).
export function useWakeLock(active) {
  const sentinelRef = useRef(null)
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!supported || !active) return undefined

    let cancelled = false

    async function acquire() {
      // Only meaningful while visible; requesting on a hidden document throws.
      if (cancelled || document.visibilityState !== 'visible' || sentinelRef.current) return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
          return
        }
        sentinelRef.current = sentinel
        setHeld(true)
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null
          setHeld(false)
        })
      } catch {
        // Denied (low battery, policy, unsupported surface). Capture continues
        // exactly as before; only the screen timeout is unaffected.
        setHeld(false)
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      setHeld(false)
      if (sentinel) sentinel.release().catch(() => {})
    }
  }, [supported, active])

  return { supported, held }
}
