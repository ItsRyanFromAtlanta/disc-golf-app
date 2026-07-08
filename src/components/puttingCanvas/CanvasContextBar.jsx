import { IconX } from '@tabler/icons-react'
import ChipGroup from '../ChipGroup'

const INPUT_MODES = [
  { key: 'tap', label: 'Tap' },
  { key: 'gesture', label: 'Gesture' },
  { key: 'panic', label: 'Panic' },
]

function syncStatusLabel(status) {
  switch (status) {
    case 'synced':
      return 'Synced'
    case 'pending':
      return 'Pending'
    case 'syncing':
      return 'Syncing...'
    case 'error-retrying':
      return 'Retrying...'
    case 'failed':
      return 'Sync failed'
    default:
      return ''
  }
}

// Top zone of the canvas: stage progress, distance/volume, sound + diagnostic
// toggles, sync status, exit. Purely presentational — the page/hook layer
// owns all the actual state this displays.
export default function CanvasContextBar({
  stageLabel,
  stageIndex,
  stageCount,
  distanceFt,
  makes,
  attempts,
  volumePlanned,
  silenced,
  onToggleSilence,
  diagnosticMode,
  onToggleDiagnostic,
  inputMode,
  onChangeInputMode,
  syncStatus,
  onExit,
}) {
  return (
    <div className="canvas-context-bar">
      <div className="canvas-context-bar-row">
        <button type="button" className="canvas-exit-button" onClick={onExit} aria-label="Exit session">
          <IconX size={20} stroke={2} />
        </button>
        <span className="canvas-stage-label">
          {stageLabel} &middot; Stage {stageIndex} / {stageCount}
        </span>
        <span className={`canvas-sync-pill canvas-sync-${syncStatus}`}>{syncStatusLabel(syncStatus)}</span>
      </div>
      <div className="canvas-context-bar-row">
        <span className="canvas-distance">{distanceFt} ft</span>
        <span className="canvas-volume">
          {makes}/{attempts} of {volumePlanned}
        </span>
      </div>
      <div className="canvas-context-bar-row canvas-toggles">
        <button type="button" className={`chip ${silenced ? 'chip-active' : ''}`} onClick={onToggleSilence}>
          {silenced ? 'Silenced' : 'Sound on'}
        </button>
        <button type="button" className={`chip ${diagnosticMode ? 'chip-active' : ''}`} onClick={onToggleDiagnostic}>
          Diagnostic
        </button>
      </div>
      {inputMode && onChangeInputMode && (
        <div className="canvas-context-bar-row">
          <ChipGroup
            options={INPUT_MODES}
            getKey={(m) => m.key}
            getLabel={(m) => m.label}
            isActive={(m) => inputMode === m.key}
            onSelect={(m) => onChangeInputMode(m.key)}
          />
        </div>
      )}
    </div>
  )
}
