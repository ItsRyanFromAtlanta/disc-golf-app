import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildFlightSpectrum, FLIGHT_SPECTRUM_MODES } from '../lib/flightSpectrum'

const WIDTH = 360
const HEIGHT = 250
const PAD = 34

function domain(values, fallbackMin, fallbackMax) {
  if (values.length === 0) return [fallbackMin, fallbackMax]
  return [Math.min(...values, fallbackMin), Math.max(...values, fallbackMax)]
}

function pointDetail(point, mode) {
  const notes = []
  if (mode === FLIGHT_SPECTRUM_MODES.CURRENT && point.overriddenAxes.length) notes.push(`overrides: ${point.overriddenAxes.join(', ')}`)
  if (point.wearAdjusted) notes.push('wear adjusted')
  return notes.length ? notes.join(' · ') : mode === FLIGHT_SPECTRUM_MODES.OFFICIAL ? 'manufacturer numbers' : 'current flight'
}

export default function FlightSpectrum({ discs = [], ghostSlots = [] }) {
  const [mode, setMode] = useState(FLIGHT_SPECTRUM_MODES.CURRENT)
  const spectrum = useMemo(() => buildFlightSpectrum(discs, ghostSlots, mode), [discs, ghostSlots, mode])
  const plotted = [...spectrum.clusters, ...spectrum.ghostPoints]
  const [xMin, xMax] = domain(plotted.map((point) => point.x), 1, 14)
  const [yMin, yMax] = domain(plotted.map((point) => point.y), -5, 6)
  const scaleX = (x) => PAD + ((x - xMin) / (xMax - xMin || 1)) * (WIDTH - PAD * 2)
  const scaleY = (y) => HEIGHT - PAD - ((y - yMin) / (yMax - yMin || 1)) * (HEIGHT - PAD * 2)
  const zeroY = yMin <= 0 && yMax >= 0 ? scaleY(0) : null

  return (
    <section className="flight-spectrum" aria-labelledby="flight-spectrum-title">
      <div className="flight-spectrum-header">
        <div>
          <h2 id="flight-spectrum-title">Flight Spectrum</h2>
          <p className="log-time">Speed × stability (turn + fade)</p>
        </div>
        <div className="flight-spectrum-toggle" role="group" aria-label="Flight number source">
          <button type="button" aria-pressed={mode === FLIGHT_SPECTRUM_MODES.CURRENT}
            onClick={() => setMode(FLIGHT_SPECTRUM_MODES.CURRENT)}>Current reality</button>
          <button type="button" aria-pressed={mode === FLIGHT_SPECTRUM_MODES.OFFICIAL}
            onClick={() => setMode(FLIGHT_SPECTRUM_MODES.OFFICIAL)}>Official</button>
        </div>
      </div>

      {spectrum.clusters.length === 0 && spectrum.ghostPoints.length === 0 ? (
        <p>No complete flight-number data is available for this bag.</p>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="flight-spectrum-chart" role="img"
          aria-label={`Flight Spectrum showing ${spectrum.capacityCount} physical discs and ${spectrum.ghostPoints.length} capacity-neutral desired slots in ${mode} mode`}>
          <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} className="flight-chart-axis" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} className="flight-chart-axis" />
          {zeroY !== null && <line x1={PAD} y1={zeroY} x2={WIDTH - PAD} y2={zeroY} className="flight-chart-zero-line" />}
          <text x={WIDTH / 2} y={HEIGHT - 7} textAnchor="middle" className="flight-chart-label">Speed</text>
          <text x={11} y={HEIGHT / 2} textAnchor="middle" className="flight-chart-label"
            transform={`rotate(-90 11 ${HEIGHT / 2})`}>Stability</text>
          {spectrum.clusters.map((cluster) => (
            <g key={cluster.id} className={cluster.members.length > 1 ? 'flight-spectrum-cluster' : 'flight-spectrum-disc'}>
              <circle cx={scaleX(cluster.x)} cy={scaleY(cluster.y)} r={cluster.members.length > 1 ? 10 : 6} />
              {cluster.members.length > 1 && <text x={scaleX(cluster.x)} y={scaleY(cluster.y) + 3} textAnchor="middle">{cluster.members.length}</text>}
              <title>{cluster.members.map((point) => point.label).join(', ')}</title>
            </g>
          ))}
          {spectrum.ghostPoints.map((point) => {
            const x = scaleX(point.x)
            const y = scaleY(point.y)
            return (
              <polygon key={point.id} points={`${x},${y - 8} ${x + 8},${y} ${x},${y + 8} ${x - 8},${y}`}
                className="flight-spectrum-ghost">
                <title>{point.label} — desired, capacity-neutral</title>
              </polygon>
            )
          })}
        </svg>
      )}

      <div className="flight-spectrum-legend" aria-label="Flight Spectrum legend">
        <span><i className="spectrum-legend-disc" /> Physical disc</span>
        <span><i className="spectrum-legend-cluster">2</i> Overlapping cluster</span>
        <span><i className="spectrum-legend-ghost" /> Desired slot · capacity-neutral</span>
      </div>

      {spectrum.missingDiscCount > 0 && (
        <p className="log-time">{spectrum.missingDiscCount} disc(s) omitted because this mode lacks complete speed, turn, and fade data.</p>
      )}

      <ul className="flight-spectrum-details" aria-label="Plotted physical discs">
        {spectrum.clusters.flatMap((cluster) => cluster.members.map((point) => (
          <li key={point.id}>
            <Link to={`/bag/discs/${point.id}`}>{point.label}</Link>
            <span>{point.x.toFixed(1)} speed · {point.y.toFixed(1)} stability · {pointDetail(point, mode)}</span>
          </li>
        )))}
      </ul>
    </section>
  )
}
