import { PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS, WILSON_MIN_N_FOR_HIDING } from '../lib/insights'

const pct = (value) => `${Math.round(value * 100)}%`
const points = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pts`

function discLabel(row) {
  const disc = row.disc
  if (!disc) return `Unknown disc · ${row.putterDiscId.slice(0, 8)}`
  const mold = disc.moldInfo?.mold_name || disc.mold || 'Unnamed putter'
  return disc.nickname ? `${disc.nickname} · ${mold}` : mold
}

export default function PutterComparison({ report }) {
  return <section className="putter-comparison" aria-labelledby="putter-comparison-title">
    <h2 id="putter-comparison-title">Physical putter comparison</h2>
    <p className="confidence-map-intro">
      Real-time attributed attempts only. The adjusted delta compares each disc with the pooled result at distances both discs actually played.
    </p>
    {report.totalRealTimeAttempts === 0 ? <p>No real-time attempts in completed visible sessions yet.</p> : <>
      <p className="putter-attribution-coverage">
        Physical disc captured for <strong>{report.attributedAttempts} of {report.totalRealTimeAttempts}</strong> real-time attempts
        {report.attributionCoverage != null ? ` (${pct(report.attributionCoverage)})` : ''}.
      </p>
      {!report.comparisonReady && <p>Use at least two selected physical putters to unlock a comparison.</p>}
      <div className="putter-comparison-list">{report.rows.map((row) => <article className="putter-comparison-card" key={row.putterDiscId}>
        <header><div><h3>{discLabel(row)}</h3>{row.disc?.plastic && <span>{row.disc.plastic}</span>}</div>{row.disc?.role && <span className="status-chip">{row.disc.role.replaceAll('_', ' ')}</span>}</header>
        <div className="putter-comparison-summary">
          <div><strong>{pct(row.pct)}</strong><span>{row.makes}/{row.attempts} overall</span></div>
          <div><strong>{row.distanceAdjustedDelta == null ? '—' : points(row.distanceAdjustedDelta)}</strong><span>shared-distance delta · n={row.sharedBandAttempts}</span></div>
        </div>
        {row.attempts < WILSON_MIN_N_FOR_HIDING && <p className="confidence-band-caveat">Overall 95% interval {pct(row.interval.lower)}–{pct(row.interval.upper)} · n={row.attempts}</p>}
        {row.distanceAdjustedDelta == null && <p className="career-note">Needs {PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS} attempts at distances shared with another disc.</p>}
        <details><summary>Distance evidence ({row.bands.length})</summary><ul className="putter-distance-list">{row.bands.map((band) => <li key={band.start}>
          <span>{band.label}{band.shared ? ' · shared' : ''}</span><strong>{band.makes}/{band.attempts} ({pct(band.pct)})</strong>
          {band.attempts < WILSON_MIN_N_FOR_HIDING && <small>{pct(band.interval.lower)}–{pct(band.interval.upper)} interval</small>}
        </li>)}</ul></details>
      </article>)}</div>
    </>}
  </section>
}
