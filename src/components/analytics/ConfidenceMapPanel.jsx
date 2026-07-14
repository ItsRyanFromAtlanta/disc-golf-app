import { WILSON_MIN_N_FOR_HIDING, LOCK_IN_LOWER_BOUND } from '../../lib/insights'

// Extracted from the standalone ConfidenceMapPage so Screen 10's Analytics
// tower can embed the same band list as one panel (the confidence map is that
// screen's expansion, per SCREEN_SPECS). Pure presentational — takes the
// already-computed `bands` (confidenceMap(distanceSamples(history))) so the
// parent owns the single history fetch.
const ZONE_LABELS = {
  'lock-in': 'Lock-in',
  developing: 'Developing',
  'coin-flip': 'Coin-flip',
}

function pct(value) {
  return `${Math.round(value * 100)}%`
}

export default function ConfidenceMapPanel({ bands }) {
  return (
    <div className="confidence-map-panel">
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
    </div>
  )
}
