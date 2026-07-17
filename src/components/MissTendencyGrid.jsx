import { WILSON_MIN_N_FOR_HIDING } from '../lib/insights'

const pct = (value) => `${Math.round(value * 100)}%`
const displayLabel = (value) => value.replace('-', ' ')

export default function MissTendencyGrid({ report }) {
  return <section className="miss-tendency" aria-labelledby="miss-tendency-title">
    <h2 id="miss-tendency-title">Miss tendency</h2>
    <p className="confidence-map-intro">
      Diagnostic misses only. Heat shows where real-time misses landed; batch totals never invent direction data.
    </p>
    {report.totalMisses === 0 ? <p>No real-time misses in completed visible sessions yet.</p> : <>
      <p className="miss-capture-coverage">
        Zone captured for <strong>{report.zonedMisses} of {report.totalMisses}</strong> real-time misses
        {report.captureCoverage != null ? ` (${pct(report.captureCoverage)})` : ''}.
      </p>
      {report.zonedMisses === 0 ? <p>Turn on Diagnostic during a live session to populate the heat grid.</p>
        : <div className="miss-band-list">{report.bands.filter((band) => band.zonedMisses > 0).map((band) => <article className="miss-band" key={band.start}>
          <header><h3>{band.label}</h3><span>{band.zonedMisses}/{band.totalMisses} zoned</span></header>
          {band.dominantZones.length > 0
            ? <p className="miss-pattern">Repeated pattern: <strong>{band.dominantZones.map((zone) => displayLabel(zone.label)).join(' / ')}</strong> ({band.dominantZones[0].count} misses)</p>
            : <p className="career-note">No repeated three-miss vector yet.</p>}
          <div className="miss-heat-grid" aria-label={`${band.label} miss heat grid`}>
            {band.zones.map((zone) => <div
              className="miss-heat-cell"
              key={zone.id}
              style={{ '--miss-heat-opacity': zone.count ? 0.1 + zone.share * 0.25 : 0 }}
              aria-label={`${displayLabel(zone.label)}: ${zone.count}`}
            ><span>{displayLabel(zone.label)}</span><strong>{zone.count}</strong></div>)}
          </div>
          {band.zonedMisses < WILSON_MIN_N_FOR_HIDING && <p className="confidence-band-caveat">Small sample: n={band.zonedMisses}. Counts are evidence, not coaching.</p>}
        </article>)}</div>}
    </>}
  </section>
}
