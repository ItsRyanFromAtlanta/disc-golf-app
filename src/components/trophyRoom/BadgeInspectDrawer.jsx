import { pursuitDistanceFor } from '../../lib/gamification/trophyRoom'

// Inspection drawer for a single badge square. Shows the badge, its unlock
// criteria in plain terms, and either its unlock date (earned) or a progress
// bar + a launch-drill shortcut (in progress / locked).
export default function BadgeInspectDrawer({ badge, onLaunch, onClose }) {
  const pctLabel = Math.round(badge.progress * 100)
  const distanceFt = pursuitDistanceFor(badge.criteria)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={badge.name}>
        <header className="practice-header">
          <h2>
            <span aria-hidden="true">{badge.icon}</span> {badge.name}
          </h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className={`trophy-tier-label trophy-tier-${badge.tier}`}>{badge.tier} tier</p>
        <p className="badge-inspect-desc">{badge.description}</p>

        {badge.status === 'unlocked' ? (
          <p className="badge-inspect-earned">
            🔓 Unlocked{' '}
            {badge.earnedAt
              ? new Date(badge.earnedAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
              : ''}
          </p>
        ) : (
          <>
            <div className="pursuit-bar-track">
              <div className="pursuit-bar-fill" style={{ width: `${pctLabel}%` }} />
            </div>
            <p className="badge-inspect-progress">{pctLabel}% complete</p>
            <button type="button" className="start-button" onClick={() => onLaunch(distanceFt)}>
              ▶️ Launch pursuit drill
              {distanceFt != null && <span className="pursuit-launch-dist"> · {distanceFt} ft</span>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
