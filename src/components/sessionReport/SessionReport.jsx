import NotesTagsEditor from '../NotesTagsEditor'
import CelebrationOverlay from './CelebrationOverlay'

// Unified post-session / history-detail report — one component, two entry
// points, so a just-finished session and the same session viewed later from
// History never tell two slightly different stories (see SCREEN_SPECS.md
// Screen 9). All data is precomputed by the caller (fetchers + the pure
// insights functions) — this component only renders.
export default function SessionReport({
  title,
  headerAction,
  at,
  lifecycleState,
  syncState,
  completed,
  totalScore,
  hero,
  rows,
  putterRows,
  dropOffRows,
  celebrationEvents = [],
  notes,
  tags,
  onSaveNotesTags,
  onHide,
  onRetrySync,
  onReplay,
  onDashboard,
}) {
  const heroPct = hero.attempts ? Math.round((hero.makes / hero.attempts) * 100) : 0

  return (
    <section className="session-report">
      <CelebrationOverlay events={celebrationEvents} />

      <header className="practice-header">
        <h1>{title}</h1>
        {headerAction}
      </header>

      <p className="detail-date">
        {new Date(at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        {completed != null && (
          <>
            {' · '}
            <span className={completed ? 'zone-badge' : 'abandoned-badge'}>
              {completed ? 'Completed' : 'Abandoned'}
            </span>
          </>
        )}
      </p>

      {(lifecycleState || syncState) && (
        <div className="activity-detail-status" aria-label="Activity status">
          {lifecycleState && (
            <span className={lifecycleState === 'completed' ? 'zone-badge' : 'abandoned-badge'}>
              {lifecycleState === 'completed' ? 'Completed' : 'Incomplete'}
            </span>
          )}
          {syncState === 'pending' && <span className="history-sync-badge history-sync-pending">Saved on device</span>}
          {syncState === 'needs_attention' && (
            <span className="history-sync-badge history-sync-attention">Needs attention</span>
          )}
          {syncState === 'synced' && <span className="history-sync-badge">Synced</span>}
          {onRetrySync && (
            <button type="button" className="link-button" onClick={onRetrySync}>Retry sync</button>
          )}
        </div>
      )}

      <div className="hero-scoreboard">
        <div className="hero-scoreboard-row">
          <span className="hero-scoreboard-score">
            {hero.makes} / {hero.attempts} putts made
          </span>
          {totalScore != null && <span className="hero-scoreboard-total">{totalScore} pts</span>}
        </div>
        {hero.longestStreak != null && (
          <span className="hero-scoreboard-streak">🔥 Streak peak: {hero.longestStreak}</span>
        )}
        <div className="hero-scoreboard-bar-track">
          <div className="hero-scoreboard-bar-fill" style={{ width: `${heroPct}%` }} />
        </div>
      </div>

      {putterRows && putterRows.length > 0 && (
        <>
          <h2>Putter performance</h2>
          <ul className="putt-log-list">
            {putterRows.map((p) => (
              <li key={p.putterDiscId} className="putt-log-row">
                <span>{p.label}</span>
                <span className="log-time">
                  {p.makes}/{p.attempts} ({Math.round(p.pct * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {dropOffRows && dropOffRows.length > 0 && (
        <>
          <h2>Distance vs 30-day baseline</h2>
          <ul className="putt-log-list">
            {dropOffRows.map((d) => (
              <li key={d.label} className="putt-log-row">
                <span>{d.label}</span>
                <span>
                  {d.todayMakes}/{d.todayAttempts} ({Math.round(d.todayPct * 100)}%)
                </span>
                <span className={d.warn ? 'form-error' : 'log-time'}>
                  {d.baselinePct == null ? 'no baseline yet' : `baseline ${Math.round(d.baselinePct * 100)}%`}
                  {d.warn ? ' ⚠️' : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Breakdown</h2>
      <ul className="putt-log-list">
        {rows.map((r, i) => (
          <li key={i} className="putt-log-row">
            <span>{r.label}</span>
            <span>{r.detail}</span>
            <span>
              {r.makes}/{r.attempts}
            </span>
            {r.cleanSet && <span className="zone-badge">Clean</span>}
            {r.pointsEarned != null && <span className="log-time">{r.pointsEarned} pts</span>}
          </li>
        ))}
      </ul>

      {onSaveNotesTags && (
        <NotesTagsEditor
          key={`${title}-${notes ?? ''}-${(tags ?? []).join()}`}
          initialNotes={notes}
          initialTags={tags}
          onSave={onSaveNotesTags}
        />
      )}

      {(onReplay || onDashboard) && (
        <div className="session-report-footer">
          {onReplay && (
            <button type="button" className="start-button" onClick={onReplay}>
              🔄 Replay
            </button>
          )}
          {onDashboard && (
            <button type="button" className="link-button session-report-dashboard" onClick={onDashboard}>
              🏠 Dashboard
            </button>
          )}
        </div>
      )}

      {onHide && (
        <button type="button" className="history-hide-button" onClick={onHide}>
          Hide from History
        </button>
      )}
    </section>
  )
}
