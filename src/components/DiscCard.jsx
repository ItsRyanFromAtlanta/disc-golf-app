import { Link } from 'react-router-dom'
import { effectiveFlightNumbers } from '../lib/discs'
import { stabilityClass, stabilityColor } from '../lib/discFilters'
import { discFlairSignal, discTier } from '../lib/discFlair'

export default function DiscCard({ disc, variant = 'grid', to, action, flair = false }) {
  const mold = disc.moldInfo
  const { speed, glide, turn, fade } = effectiveFlightNumbers(disc, mold)
  const stability = turn == null || fade == null ? null : stabilityClass(turn + fade)
  const accentColor = stability ? stabilityColor(stability) : 'transparent'
  const tier = flair ? discTier(disc) : null

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
        {flair && (
          <dl className="disc-card-flair-stats" aria-label={`${tier} tier`}>
            <div>
              <dt>Tier</dt>
              <dd>{tier}</dd>
            </div>
            <div>
              <dt>Signal</dt>
              <dd>{discFlairSignal(disc)}</dd>
            </div>
          </dl>
        )}
      </div>
      {disc.status !== 'in_locker' && <span className="abandoned-badge disc-card-status">{disc.status}</span>}
      {action}
    </>
  )

  const className = `disc-card disc-card-${variant}${flair ? ` disc-card-flair disc-card-flair-${tier}` : ''}`

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  return <div className={className}>{content}</div>
}
