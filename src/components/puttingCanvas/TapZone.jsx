import { useRef, useState } from 'react'

const ACCEPT_FLASH_MS = 220

// Primary scoring input (Screen 8 divergence, signed off): a fixed 50/50
// split-screen MADE/MISSED tap surface, replacing swipe gestures as the
// default. Unlike GestureZone, this zone does NOT grow with streak — tap
// targets don't need bigger hit-zones the way a directional swipe cone does,
// and the blueprint specifies a literal 50/50 split.
export default function TapZone({ onMake, onMiss, onUndo, consecutiveMakes = 0 }) {
  const [feedback, setFeedback] = useState(false)
  const flashTimerRef = useRef(null)

  function flash() {
    setFeedback(true)
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setFeedback(false), ACCEPT_FLASH_MS)
  }

  function handleMake() {
    flash()
    onMake()
  }

  function handleMiss() {
    flash()
    onMiss()
  }

  return (
    <div className={`tap-zone ${feedback ? 'tap-zone-accept' : ''}`}>
      <button type="button" className="tap-zone-make" onClick={handleMake}>
        Made
      </button>
      <button type="button" className="tap-zone-miss" onClick={handleMiss}>
        Missed
      </button>
      <div className="tap-zone-footer">
        <button type="button" className="link-button tap-zone-undo" onClick={onUndo}>
          ↩ Undo
        </button>
        {consecutiveMakes > 0 && <span className="tap-zone-streak">🔥 Streak: {consecutiveMakes}</span>}
      </div>
    </div>
  )
}
