import { useRef, useState } from 'react'
import { useGesturePointer } from '../../hooks/useGesturePointer'
import { GESTURE_CONFIG } from '../../lib/gestureEngine/config'

const ACCEPT_FLASH_MS = 220
const REJECT_FLASH_MS = 260

// makeTerritoryPct (from sessionReducer.js) is a raw 0->ZONE_GROWTH_CAP_PCT
// value tracking the streak itself — it is NOT the on-screen height. The
// visual zone starts at a 50/50 split and grows toward a 60%-of-height cap
// as the raw value approaches its own cap, so a fresh stage (0 consecutive
// makes) still renders a fully usable, evenly-split zone rather than a
// zero-height Make button.
const BASELINE_MAKE_ZONE_PCT = 50
const MAKE_ZONE_CAP_PCT = 60

function makeZoneHeightPct(makeTerritoryPct, growthCap) {
  const progress = growthCap > 0 ? makeTerritoryPct / growthCap : 0
  return BASELINE_MAKE_ZONE_PCT + progress * (MAKE_ZONE_CAP_PCT - BASELINE_MAKE_ZONE_PCT)
}

// The whole zone is one continuous swipe surface (up=make, down=miss,
// left=undo via useGesturePointer/classify.js) — the Make/Miss sub-areas
// below are visual territory only, not separately-tappable targets. A small
// explicit Undo button stays in the corner too: not everyone will discover
// swipe-left on their own, and it doesn't compete with the swipe surface.
export default function GestureZone({
  onMake,
  onMiss,
  onUndo,
  makeTerritoryPct = 0,
  growthCap = GESTURE_CONFIG.ZONE_GROWTH_CAP_PCT,
}) {
  const zoneRef = useRef(null)
  const flashTimerRef = useRef(null)
  const [feedback, setFeedback] = useState(null) // 'accept' | 'reject' | null

  function flash(kind, ms) {
    setFeedback(kind)
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setFeedback(null), ms)
  }

  useGesturePointer(zoneRef, {
    onMake: () => {
      flash('accept', ACCEPT_FLASH_MS)
      onMake()
    },
    onMiss: () => {
      flash('accept', ACCEPT_FLASH_MS)
      onMiss()
    },
    onUndo: () => {
      flash('accept', ACCEPT_FLASH_MS)
      onUndo()
    },
    onRejected: () => flash('reject', REJECT_FLASH_MS),
  })

  const heightPct = makeZoneHeightPct(makeTerritoryPct, growthCap)
  const feedbackClass = feedback === 'accept' ? 'gesture-zone-accept' : feedback === 'reject' ? 'gesture-zone-reject' : ''

  return (
    <div ref={zoneRef} className={`gesture-zone ${feedbackClass}`} style={{ '--make-territory': `${heightPct}%` }}>
      <div className="gesture-zone-make" aria-hidden="true">
        Make
      </div>
      <div className="gesture-zone-miss" aria-hidden="true">
        Miss
      </div>
      <button type="button" className="link-button gesture-zone-undo" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}
