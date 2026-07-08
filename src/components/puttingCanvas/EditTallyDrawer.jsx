import { useState } from 'react'

// Ad-hoc "[📝 EDIT]" correction: lets the player set the CORRECT total
// makes/attempts for the current stage rather than adding more. Computes the
// delta from the current tally and hands it to the caller, which applies it
// via the same BATCH_COMPLETE action batch-ribbon entry already uses (that
// reducer case just adds to the tally, so a negative delta corrects it too).
export default function EditTallyDrawer({ currentMakes, currentAttempts, onApply, onCancel }) {
  const [makes, setMakes] = useState(currentMakes)
  const [attempts, setAttempts] = useState(currentAttempts)

  const invalid = makes < 0 || attempts < 0 || makes > attempts

  function handleApply() {
    onApply(makes - currentMakes, attempts - currentAttempts)
  }

  return (
    <div className="edit-tally-drawer">
      <span className="editor-label">Correct this stage's tally</span>
      <div className="edit-tally-fields">
        <label>
          Makes
          <input type="number" min="0" value={makes} onChange={(e) => setMakes(Number(e.target.value))} />
        </label>
        <label>
          Attempts
          <input type="number" min="0" value={attempts} onChange={(e) => setAttempts(Number(e.target.value))} />
        </label>
      </div>
      {invalid && <p className="form-error">Makes can't exceed attempts.</p>}
      <div className="profile-section-actions">
        <button type="button" onClick={handleApply} disabled={invalid}>
          Apply
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
