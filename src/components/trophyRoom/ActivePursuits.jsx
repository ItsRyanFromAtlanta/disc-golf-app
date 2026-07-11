import { pursuitDistanceFor } from '../../lib/gamification/trophyRoom'

// Active Pursuits carousel: the badges closest to unlocking, each with a 1-tap
// "Launch pursuit drill" that drops into the freeform scoring canvas
// preconfigured to a relevant distance (when the badge implies one). Renders
// nothing when there are no in-progress badges yet.
export default function ActivePursuits({ pursuits, onLaunch }) {
  if (pursuits.length === 0) return null

  return (
    <section className="pursuits">
      <h2>Active pursuits</h2>
      <div className="pursuit-carousel">
        {pursuits.map((badge) => {
          const pctLabel = Math.round(badge.progress * 100)
          const distanceFt = pursuitDistanceFor(badge.criteria)
          return (
            <article key={badge.id} className="pursuit-card">
              <div className="pursuit-card-head">
                <span className="pursuit-card-icon" aria-hidden="true">
                  {badge.icon}
                </span>
                <span className="pursuit-card-name">{badge.name}</span>
                <span className="pursuit-card-pct">{pctLabel}%</span>
              </div>
              <p className="pursuit-card-desc">{badge.description}</p>
              <div className="pursuit-bar-track">
                <div className="pursuit-bar-fill" style={{ width: `${pctLabel}%` }} />
              </div>
              <button type="button" className="start-button pursuit-launch" onClick={() => onLaunch(distanceFt)}>
                ▶️ Launch pursuit drill
                {distanceFt != null && <span className="pursuit-launch-dist"> · {distanceFt} ft</span>}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
