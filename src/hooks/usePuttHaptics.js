import { useCallback } from 'react'

// Simplified per-outcome patterns (ms). iOS Safari doesn't implement
// navigator.vibrate at all, so the capability check below silently no-ops
// there with no platform special-casing needed.
const PATTERNS = {
  make: 15,
  miss: [0, 40, 30, 40],
  undo: 25,
}

export function usePuttHaptics() {
  const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

  const vibrate = useCallback(
    (pattern) => {
      if (!supported) return
      navigator.vibrate(pattern)
    },
    [supported],
  )

  const vibrateMake = useCallback(() => vibrate(PATTERNS.make), [vibrate])
  const vibrateMiss = useCallback(() => vibrate(PATTERNS.miss), [vibrate])
  const vibrateUndo = useCallback(() => vibrate(PATTERNS.undo), [vibrate])

  return { supported, vibrateMake, vibrateMiss, vibrateUndo }
}
