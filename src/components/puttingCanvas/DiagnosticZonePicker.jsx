import { MISS_ZONES } from '../../lib/gestureEngine/missZones'

// Shown only when diagnostic mode is on and a miss gesture just fired.
// Sound/haptic feedback for the miss already played immediately (feel
// shouldn't wait on this), but the actual putt_events row is deferred until
// this resolves — recording it with missZone=null immediately and then
// patching it in afterward would mean mutating a row that may already be
// mid-sync. Skipping just finalizes it with missZone=null instead.
export default function DiagnosticZonePicker({ onSelectZone, onDismiss }) {
  return (
    <div className="diagnostic-zone-picker-overlay">
      <div className="diagnostic-zone-picker">
        <p className="diagnostic-zone-picker-label">Where did it miss?</p>
        <div className="diagnostic-zone-grid">
          {MISS_ZONES.map((zone) => (
            <button
              key={zone.id}
              type="button"
              className="diagnostic-zone-cell"
              onClick={() => onSelectZone(zone.id)}
            >
              {zone.label}
            </button>
          ))}
        </div>
        <button type="button" className="link-button" onClick={onDismiss}>
          Skip
        </button>
      </div>
    </div>
  )
}
