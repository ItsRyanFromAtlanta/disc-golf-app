// Generic ACTIVE_SESSION shell — knows nothing about regimen vs. freeform.
// Slot-based composition (contextBar/gestureZone/batchRibbon) so the batch
// ribbon (grid vs. carousel) and gesture zone (placeholder vs. real physics)
// can each evolve independently without this component changing.
export default function PuttingCanvas({ contextBar, gestureZone, batchRibbon }) {
  return (
    <div className="putting-canvas">
      {contextBar}
      <div className="putting-canvas-body">
        {gestureZone}
        {batchRibbon}
      </div>
    </div>
  )
}
