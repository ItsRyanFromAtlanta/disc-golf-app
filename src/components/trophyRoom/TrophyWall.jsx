import { TROPHY_FILTERS } from '../../lib/gamification/trophyRoom'

// 4-way filtered trophy wall: a segmented filter bar (ALL / UNLOCKED / IN
// PROGRESS / LOCKED with live counts) over a grid of badge squares. In-progress
// squares carry an inline progress bar; locked squares are dimmed. Tapping a
// square opens the inspection drawer (handled by the parent via onInspect).

const FILTER_LABELS = {
  all: 'All',
  unlocked: '🔓 Unlocked',
  in_progress: '🎯 In progress',
  locked: '🔒 Locked',
}

export default function TrophyWall({ badges, filter, counts, onFilterChange, onInspect }) {
  return (
    <section className="trophy-wall">
      <h2>Trophy wall</h2>

      <div className="trophy-filter-bar" role="tablist">
        {TROPHY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`chip trophy-filter-chip ${filter === f ? 'trophy-filter-chip-active' : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {FILTER_LABELS[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {badges.length === 0 ? (
        <p className="trophy-empty">Nothing here yet.</p>
      ) : (
        <div className="trophy-grid">
          {badges.map((badge) => (
            <button
              key={badge.id}
              type="button"
              className={`trophy-square trophy-square-${badge.status} trophy-tier-${badge.tier}`}
              onClick={() => onInspect(badge)}
            >
              <span className="trophy-square-icon" aria-hidden="true">
                {badge.icon}
              </span>
              <span className="trophy-square-name">{badge.name}</span>
              {badge.status === 'in_progress' && (
                <span className="trophy-square-bar-track">
                  <span className="trophy-square-bar-fill" style={{ width: `${Math.round(badge.progress * 100)}%` }} />
                </span>
              )}
              {badge.status === 'unlocked' && <span className="trophy-square-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
