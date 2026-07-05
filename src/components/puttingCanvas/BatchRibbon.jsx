import { useEffect, useState } from 'react'
import BatchGrid from './BatchGrid'
import BatchCarousel from './BatchCarousel'

const GRID_MAX_VOLUME = 10
const AUTO_ADVANCE_MS = 3000

// Batch-ribbon entry is the manual (non-gesture) input surface — per the
// data-split rule it writes straight into the stage tally with no
// synthesized putt_events rows (see sessionReducer.js's BATCH_COMPLETE).
// Only ever offers to fill whatever's left of the stage (volumePlanned here
// is the REMAINING count, not the stage's original total) — a stage that's
// partway gesture-logged only gets asked about the rest.
//
// onAdvance fires ~3s after a completion, once the remaining volume hits
// zero — what that means is page-specific (regimen moves to the next set;
// freeform just returns control to its own next-distance/end-session UI).
export default function BatchRibbon({ volumePlanned, historicalAvgMakePct, onComplete, onAdvance }) {
  const [confirmed, setConfirmed] = useState(null)

  useEffect(() => {
    if (!confirmed) return
    const timer = window.setTimeout(() => {
      setConfirmed(null)
      onAdvance?.()
    }, AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [confirmed, onAdvance])

  // Order matters: a single tap always accounts for the FULL remaining
  // volume (never a partial fill), so volumePlanned reads 0 on the very
  // same render that produces `confirmed` — check confirmed first, or the
  // confirmation would never actually be visible.
  if (confirmed) {
    return (
      <div className="batch-ribbon-confirmed">
        <p>
          Logged {confirmed.makes}/{confirmed.attempts}. Moving on...
        </p>
      </div>
    )
  }

  if (volumePlanned <= 0) return null

  function handleComplete(makes, attempts) {
    onComplete(makes, attempts)
    setConfirmed({ makes, attempts })
  }

  return volumePlanned <= GRID_MAX_VOLUME ? (
    <BatchGrid volumePlanned={volumePlanned} onComplete={handleComplete} />
  ) : (
    <BatchCarousel volumePlanned={volumePlanned} historicalAvgMakePct={historicalAvgMakePct} onComplete={handleComplete} />
  )
}
