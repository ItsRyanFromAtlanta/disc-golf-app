import { useRef, useState } from 'react'

const LONG_PRESS_MS = 500
const ACCEPT_FLASH_MS = 220

// Low-battery / cold-hands panic mode: the whole canvas becomes one
// high-contrast zone. A quick tap logs a make; holding past LONG_PRESS_MS
// logs a miss instead — no undo affordance (deliberately minimal, matching
// the blueprint's "single high-contrast touch zone" description).
export default function PanicZone({ onMake, onMiss }) {
  const timerRef = useRef(null)
  const longPressFiredRef = useRef(false)
  const [feedback, setFeedback] = useState(false)

  function flash() {
    setFeedback(true)
    window.setTimeout(() => setFeedback(false), ACCEPT_FLASH_MS)
  }

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handlePointerDown() {
    longPressFiredRef.current = false
    timerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true
      flash()
      onMiss()
    }, LONG_PRESS_MS)
  }

  function handlePointerUp() {
    clearTimer()
    if (!longPressFiredRef.current) {
      flash()
      onMake()
    }
  }

  return (
    <div
      className={`panic-zone ${feedback ? 'panic-zone-accept' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={clearTimer}
    >
      <span className="panic-zone-label">Tap = Made · Hold = Missed</span>
    </div>
  )
}
