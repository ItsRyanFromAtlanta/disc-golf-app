import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchPracticeInsights, distanceSamples } from '../lib/history'
import { confidenceMap, missTendency, WILSON_MIN_N_FOR_HIDING, LOCK_IN_LOWER_BOUND } from '../lib/insights'
import MissTendencyGrid from '../components/MissTendencyGrid'

const ZONE_LABELS = {
  'lock-in': 'Lock-in',
  developing: 'Developing',
  'coin-flip': 'Coin-flip',
}

function pct(value) {
  return `${Math.round(value * 100)}%`
}

export default function ConfidenceMapPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPracticeInsights(user.id).then(setData).catch((err) => setError(err.message))
  }, [user.id])

  const bands = useMemo(() => (data ? confidenceMap(distanceSamples(data)) : null), [data])
  const misses = useMemo(() => (data ? missTendency(data.puttEvents) : null), [data])

  if (error) return <p className="form-error">{error}</p>
  if (!bands) return <p className="loading">Loading...</p>

  return (
    <section className="confidence-map-page">
      <header className="practice-header">
        <h1>Practice Insights</h1>
        <Link to="/practice" className="link-button">
          Practice menu
        </Link>
      </header>

      <h2>Distance confidence</h2>
      <p className="confidence-map-intro">
        Make % by distance band, colored by how sure we can be. A band only turns{' '}
        <strong>lock-in</strong> once its worst-case estimate still clears {pct(LOCK_IN_LOWER_BOUND)} —
        small samples stay <strong>coin-flip</strong> even at a high point estimate.
      </p>

      {bands.length === 0 ? (
        <p>No putts logged yet — the map fills in as you practice.</p>
      ) : (
        <ul className="confidence-band-list">
          {bands.map((band) => (
            <li key={band.start} className={`confidence-band zone-${band.zone}`}>
              <div className="confidence-band-header">
                <span className="confidence-band-label">{band.label}</span>
                <span className="confidence-band-zone">{ZONE_LABELS[band.zone]}</span>
              </div>
              <div className="confidence-band-track">
                <div
                  className="confidence-band-interval"
                  style={{
                    left: `${band.interval.lower * 100}%`,
                    width: `${(band.interval.upper - band.interval.lower) * 100}%`,
                  }}
                />
                <div className="confidence-band-point" style={{ left: `${band.makePct * 100}%` }} />
                <div className="confidence-band-midline" />
              </div>
              <div className="confidence-band-footer">
                <span>
                  {band.makes}/{band.attempts} ({pct(band.makePct)})
                </span>
                {band.attempts < WILSON_MIN_N_FOR_HIDING && (
                  <span className="confidence-band-caveat">
                    n={band.attempts} — interval {pct(band.interval.lower)}–{pct(band.interval.upper)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <MissTendencyGrid report={misses} />
    </section>
  )
}
