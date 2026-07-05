import { useEffect, useRef } from 'react'
import { classifyGesture, rapidFireTickCount } from '../lib/gestureEngine/classify'
import { GESTURE_CONFIG } from '../lib/gestureEngine/config'

const RAPID_FIRE_POLL_MS = 50

// Wires raw Pointer Events (clientX/clientY/timeStamp — CSS-pixel,
// DPR-independent by browser guarantee, see classify.js) on a DOM element to
// the pure gesture classifier. Emits onMake/onMiss/onUndo for a qualifying
// swipe, onRejected for an attempted-but-unqualified one, and onMake
// repeatedly (paced by rapidFireTickCount, independent of the swipe
// debounce) for a held long-press.
export function useGesturePointer(zoneRef, callbacks, config = GESTURE_CONFIG) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    const el = zoneRef.current
    if (!el) return

    let samples = []
    let active = false
    let debounceUntil = 0
    let longPressTimer = null
    let longPressStart = 0
    let rapidFireTicksEmitted = 0

    function clearLongPress() {
      if (longPressTimer) {
        clearInterval(longPressTimer)
        longPressTimer = null
      }
    }

    function startLongPressWatch() {
      longPressStart = performance.now()
      rapidFireTicksEmitted = 0
      longPressTimer = setInterval(() => {
        const elapsed = performance.now() - longPressStart
        const ticksDue = rapidFireTickCount(elapsed, config)
        while (rapidFireTicksEmitted < ticksDue) {
          rapidFireTicksEmitted += 1
          callbacksRef.current.onMake?.()
        }
      }, RAPID_FIRE_POLL_MS)
    }

    function handlePointerDown(e) {
      active = true
      samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]
      startLongPressWatch()
      el.setPointerCapture?.(e.pointerId)
    }

    function handlePointerMove(e) {
      if (!active) return
      samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    }

    function handlePointerUp(e) {
      if (!active) return
      active = false
      clearLongPress()

      // A held long-press that already fired rapid-fire ticks ends here —
      // the release itself is not also a swipe to classify.
      if (rapidFireTicksEmitted > 0) {
        samples = []
        return
      }

      samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
      const now = performance.now()
      if (now < debounceUntil) {
        samples = []
        return
      }

      const result = classifyGesture(samples, config)
      samples = []

      // Debounce applies to swipe-classified gestures only (make/miss/undo),
      // never to rapid-fire ticks — see GESTURE_CONFIG's comment.
      if (result.type === 'make' || result.type === 'miss' || result.type === 'undo') {
        debounceUntil = now + config.DEBOUNCE_MS
      }

      if (result.type === 'make') callbacksRef.current.onMake?.()
      else if (result.type === 'miss') callbacksRef.current.onMiss?.()
      else if (result.type === 'undo') callbacksRef.current.onUndo?.()
      else if (result.type === 'rejected') callbacksRef.current.onRejected?.()
    }

    function handlePointerCancel() {
      active = false
      clearLongPress()
      samples = []
    }

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerup', handlePointerUp)
      el.removeEventListener('pointercancel', handlePointerCancel)
      clearLongPress()
    }
  }, [zoneRef, config])
}
