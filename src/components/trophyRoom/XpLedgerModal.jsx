import { XP_PER_MAKE, XP_PER_CLEAN_STAGE } from '../../lib/gamification/constants'

// Slide-up XP audit modal: the last 30 days of ledger events plus the multiplier
// guide (per the blueprint's Screen 12 ledger). Read-only — xp_events is an
// immutable ledger, so there's nothing to edit here.

const SOURCE_LABELS = {
  regimen_run: 'Regimen run',
  session: 'Freeform session',
  badge: 'Badge unlocked',
  import: 'UDisc import',
}

function sourceLabel(sourceType) {
  return SOURCE_LABELS[sourceType] ?? sourceType
}

export default function XpLedgerModal({ ledger, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="XP ledger">
        <header className="practice-header">
          <h2>XP Ledger</h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="xp-guide">
          +{XP_PER_MAKE} XP / make · +{XP_PER_CLEAN_STAGE} XP / clean stage · badge unlocks award bonus XP
        </p>

        <h3>Last 30 days</h3>
        {ledger.length === 0 ? (
          <p>No XP earned in the last 30 days.</p>
        ) : (
          <ul className="putt-log-list">
            {ledger.map((e) => (
              <li key={e.id} className="putt-log-row">
                <span>{sourceLabel(e.source_type)}</span>
                <span className="log-time">
                  {new Date(e.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                <span className={e.amount >= 0 ? 'zone-badge' : 'abandoned-badge'}>
                  {e.amount >= 0 ? '+' : ''}
                  {e.amount.toLocaleString()} XP
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
