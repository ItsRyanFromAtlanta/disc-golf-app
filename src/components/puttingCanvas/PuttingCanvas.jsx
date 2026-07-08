// Generic ACTIVE_SESSION shell — knows nothing about regimen vs. freeform.
// Slot-based composition so each piece (batch ribbon, gesture/tap zone,
// toolbar) can evolve independently without this component changing. toolbar
// and stackTracker are optional (Screen 8 additions) — a caller that omits
// them renders nothing extra, so this stays backward compatible.
export default function PuttingCanvas({ contextBar, toolbar, stackTracker, gestureZone, batchRibbon }) {
  return (
    <div className="putting-canvas">
      {contextBar}
      {toolbar}
      <div className="putting-canvas-body">
        {stackTracker}
        {gestureZone}
        {batchRibbon}
      </div>
    </div>
  )
}
