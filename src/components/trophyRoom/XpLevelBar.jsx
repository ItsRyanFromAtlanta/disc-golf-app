import { xpProgressInLevel } from '../../lib/gamification/xp'

// RPG progression card: current level + a Burnt Terracotta XP bar (design
// system's positive color) + the XP-to-next line. All derived from the lifetime
// XP total via the pure xpProgressInLevel — the profiles.level column is just a
// cache, so the bar recomputes from XP to stay correct even if the cache lags.
export default function XpLevelBar({ xp, onOpenLedger }) {
  const { level, intoLevel, levelSpan, toNext, pct } = xpProgressInLevel(xp)
  const atCap = levelSpan === 0

  return (
    <div className="xp-card">
      <div className="xp-card-header">
        <span className="xp-card-level">Level {level}</span>
        <button type="button" className="chip xp-ledger-button" onClick={onOpenLedger}>
          📜 Ledger
        </button>
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <p className="xp-card-caption">
        {atCap ? (
          <>Max level — {xp.toLocaleString()} XP</>
        ) : (
          <>
            {intoLevel.toLocaleString()} / {levelSpan.toLocaleString()} XP · {toNext.toLocaleString()} to Level{' '}
            {level + 1}
          </>
        )}
      </p>
    </div>
  )
}
