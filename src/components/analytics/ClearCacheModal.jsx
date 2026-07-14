import { useState } from 'react'

// 2-step CLEAR CACHE confirmation (Screen 10). Clears the on-device Dexie +
// InstantLaunch buffers ONLY — never server data. The parent guarantees this is
// only reachable with zero pending writes, so nothing un-synced is lost; the
// two steps still guard against an accidental tap. Reuses the shared slide-up
// modal (.modal-backdrop/.modal-sheet).
export default function ClearCacheModal({ onCancel, onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function handleConfirm() {
    setClearing(true)
    await onConfirm()
    // parent unmounts the modal on success; no need to reset local state
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {!confirming ? (
          <>
            <h2>Clear local cache?</h2>
            <p className="modal-body-text">
              This clears data cached on <strong>this device</strong> only — your synced practice history
              on the server is untouched and will re-download. Nothing is waiting to sync, so nothing is
              lost.
            </p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={() => setConfirming(true)}>
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Are you sure?</h2>
            <p className="modal-body-text">This can’t be undone. The cache rebuilds from the server on next load.</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCancel} disabled={clearing}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={handleConfirm} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear cache'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
