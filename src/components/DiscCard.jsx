import { Link } from 'react-router-dom'
import { effectiveFlightNumbers } from '../lib/discs'
import { stabilityClass, stabilityColor } from '../lib/discFilters'

export default function DiscCard({ disc, variant = 'grid', to, action }) {
  const mold = disc.moldInfo
  const { speed, glide, turn, fade } = effectiveFlightNumbers(disc, mold)
  const stability = turn == null || fade == null ? null : stabilityClass(turn + fade)
  const accentColor = stability ? stabilityColor(stability) : 'transparent'

  const content = (
    <>
      <div className="disc-card-thumb" style={{ borderColor: accentColor }}>
        {disc.photo_url ? (
          <img src={disc.photo_url} alt="" />
        ) : (
          <span className="disc-card-thumb-fallback" style={{ background: accentColor }} />
        )}
      </div>
      <div className="disc-card-body">
        <span className="disc-card-title">{disc.nickname || mold?.mold_name || disc.mold}</span>
        <span className="disc-card-subtitle">{mold?.manufacturer ?? disc.manufacturer}</span>
        <span className="disc-card-numbers">
          {speed ?? '—'}/{glide ?? '—'}/{turn ?? '—'}/{fade ?? '—'}
        </span>
      </div>
      {disc.status !== 'in_locker' && <span className="abandoned-badge disc-card-status">{disc.status}</span>}
      {action}
    </>
  )

  const className = `disc-card disc-card-${variant}`

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  return <div className={className}>{content}</div>
}
