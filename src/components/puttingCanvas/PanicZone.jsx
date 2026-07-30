import { useRef, useState } from 'react'

const LONG_PRESS_MS = 500
const ACCEPT_FLASH_MS = 220

// Low-battery / cold-hands panic mode: the whole canvas is one high-contrast
// zone. A quick tap logs a make; holding past LONG_PRESS_MS logs a miss.
//
// The zone is a real <button> and the hold has an explicit "Missed" twin, which
// it did not used to have. As a bare <div> with pointer handlers this mode was
// unreachable without a pointer — nothing here was focusable, so a keyboard or
// switch user could not log a single putt — and "hold = missed" had no
// non-gesture equivalent anywhere on the screen (PHASE_A_ARCHITECTURE.md § 9,
// "Keyboard / gesture alternatives"). Both are now covered without changing
// what a thumb does: tap still means made, hold still means missed.
//
// Make is driven off `click` rather than `pointerup` so that keyboard
// activation (Enter/Space, which synthesises a click and no pointer events at
// all) travels the same path. A completed long press suppresses the click that
// follows its own pointerup, so a hold logs one miss and never also a make.
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

  function handleMiss() {
    flash()
    onMiss()
  }

  function handlePointerDown() {
    longPressFiredRef.current = false
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      longPressFiredRef.current = true
      handleMiss()
    }, LONG_PRESS_MS)
  }

  function handleClick() {
    clearTimer()
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    flash()
    onMake()
  }

  return (
    <div className="panic-zone">
      <button
        type="button"
        className={`panic-zone-primary ${feedback ? 'panic-zone-accept' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClick={handleClick}
      >
        <span className="panic-zone-label">Tap = Made · Hold = Missed</span>
      </button>
      {/* The hold's non-gesture equivalent. Deliberately small and out of the
          thumb's way: it exists so the mode is operable without a timed press,
          not to compete with the surface above it. */}
      <button type="button" className="link-button panic-zone-miss" onClick={handleMiss}>
        Missed
      </button>
    </div>
  )
}
