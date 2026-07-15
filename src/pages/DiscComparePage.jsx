import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDiscList } from '../lib/repository/discRepository'
import {
  buildDiscComparison,
  COMPARE_MAX,
  COMPARE_MIN,
  FLIGHT_AXES,
  NEAR_IDENTICAL_AXIS_DELTA,
} from '../lib/discCompare'
import { stabilityClass, stabilityColor } from '../lib/discFilters'
import { FlightCurveOverlay } from '../components/putterLineup/FlightCurve'

const CURVE_COLORS = [
  'var(--color-secondary-accent)',
  'var(--color-positive)',
  'var(--color-highlight)',
  'var(--color-negative)',
]

function discName(disc) {
  return disc.nickname || disc.moldInfo?.mold_name || disc.mold || 'Unnamed disc'
}

function discManufacturer(disc) {
  return disc.moldInfo?.manufacturer ?? disc.manufacturer ?? 'Unknown maker'
}

function overrideAxes(disc) {
  return FLIGHT_AXES.filter((axis) => disc[`override_${axis}`] !== null && disc[`override_${axis}`] !== undefined)
}

function axisStatus(extreme, discId) {
  const isMin = extreme.minIds.includes(discId)
  const isMax = extreme.maxIds.includes(discId)
  if (isMin && isMax) return { className: 'disc-compare-cell-match', label: 'range match' }
  if (isMin) return { className: 'disc-compare-cell-low', label: 'low' }
  if (isMax) return { className: 'disc-compare-cell-high', label: 'high' }
  return { className: '', label: '' }
}

function InvalidCompareState({ message }) {
  return (
    <section className="disc-compare-page">
      <header className="practice-header">
        <h1>Compare discs</h1>
        <Link to="/bag/locker" className="link-button">
          Locker
        </Link>
      </header>
      <p className="form-error">{message}</p>
      <Link to="/bag/locker" className="start-button">
        Choose discs
      </Link>
    </section>
  )
}

export default function DiscComparePage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const queryIds = useMemo(() => {
    const ids = searchParams
      .getAll('ids')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean)
    return [...new Set(ids)]
  }, [searchParams])
  const requestedIds = useMemo(() => queryIds.slice(0, COMPARE_MAX), [queryIds])
  const discsQuery = useDiscList(user.id)
  const discs = useMemo(
    () => discsQuery.data ?? (discsQuery.isError ? [] : null),
    [discsQuery.data, discsQuery.isError],
  )

  const selected = useMemo(
    () => requestedIds.map((id) => discs?.find((disc) => String(disc.id) === id)).filter(Boolean),
    [discs, requestedIds],
  )

  if (discsQuery.error && !discsQuery.data) return <p className="form-error">{discsQuery.error.message}</p>
  if (!discs) return <p className="loading">Loading...</p>
  if (queryIds.length < COMPARE_MIN) {
    return <InvalidCompareState message={`Choose at least ${COMPARE_MIN} discs to compare.`} />
  }
  if (selected.length < COMPARE_MIN) {
    return <InvalidCompareState message="One or more selected discs could not be found in your locker." />
  }

  const comparison = buildDiscComparison(selected)
  const rowsById = new Map(comparison.rows.map((row) => [String(row.discId), row]))
  const missingIds = requestedIds.filter((id) => !selected.some((disc) => String(disc.id) === id))
  const truncatedCount = queryIds.length - requestedIds.length
  const selectedById = new Map(selected.map((disc) => [String(disc.id), disc]))

  return (
    <section className="disc-compare-page">
      <header className="practice-header">
        <div>
          <p className="eyebrow">DISCS</p>
          <h1>Compare discs</h1>
        </div>
        <Link to="/bag/locker" className="link-button">
          Locker
        </Link>
      </header>

      <p className="disc-compare-intro">Effective flight numbers are shown below. Per-disc overrides are marked explicitly.</p>

      {truncatedCount > 0 && (
        <p className="disc-compare-notice">Comparison is capped at {COMPARE_MAX} discs; {truncatedCount} extra selection(s) were ignored.</p>
      )}
      {missingIds.length > 0 && (
        <p className="disc-compare-notice">Skipped {missingIds.length} disc(s) that are no longer in your locker.</p>
      )}

      {comparison.nearIdenticalPairs.length > 0 && (
        <aside className="disc-compare-alerts" aria-live="polite">
          <h2>No meaningful gaps</h2>
          <ul>
            {comparison.nearIdenticalPairs.map((pair) => {
              const names = pair.discIds.map((id) => discName(selectedById.get(String(id))))
              return (
                <li key={pair.discIds.join('-')}>
                  {names[0]} and {names[1]} are within ±{NEAR_IDENTICAL_AXIS_DELTA} on every effective flight axis.
                </li>
              )
            })}
          </ul>
        </aside>
      )}

      <section className="disc-compare-panel">
        <div className="disc-compare-panel-heading">
          <h2>Flight overlay</h2>
          <span>Current reality</span>
        </div>
        <div className="disc-compare-curve-stage">
          <FlightCurveOverlay entries={selected.map((disc, index) => ({ disc, color: CURVE_COLORS[index] }))} />
        </div>
        <div className="disc-compare-legend" aria-label="Curve legend">
          {selected.map((disc, index) => (
            <span key={disc.id}>
              <i className="disc-compare-legend-swatch" style={{ background: CURVE_COLORS[index] }} />
              {discName(disc)}
            </span>
          ))}
        </div>
      </section>

      <section className="disc-compare-panel">
        <div className="disc-compare-panel-heading">
          <h2>Effective flight numbers</h2>
          <span>Low/high highlights are per axis</span>
        </div>
        <div className="disc-compare-table-scroll">
          <table className="flight-compare-table disc-compare-table">
            <thead>
              <tr>
                <th scope="col">Axis</th>
                {selected.map((disc) => {
                  const row = rowsById.get(String(disc.id))
                  const stability = row.numbers.turn == null || row.numbers.fade == null ? null : stabilityClass(row.numbers.turn + row.numbers.fade)
                  return (
                    <th key={disc.id} scope="col" className="disc-compare-disc-heading">
                      <span>{discName(disc)}</span>
                      <span className="disc-compare-stability" style={{ borderColor: stabilityColor(stability) }}>
                        {stability ?? 'unknown'}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {FLIGHT_AXES.map((axis) => (
                <tr key={axis}>
                  <th scope="row">{axis}</th>
                  {selected.map((disc) => {
                    const row = rowsById.get(String(disc.id))
                    const value = row.numbers[axis]
                    const status = axisStatus(comparison.extremes[axis], disc.id)
                    const hasOverride = disc[`override_${axis}`] !== null && disc[`override_${axis}`] !== undefined
                    return (
                      <td
                        key={disc.id}
                        className={status.className}
                        aria-label={`${discName(disc)} ${axis}: ${value ?? 'not available'}${status.label ? `, ${status.label}` : ''}`}
                      >
                        <div className="disc-compare-value">
                          <strong>{value ?? '—'}</strong>
                          {hasOverride && <span className="disc-compare-override-mark" title="Per-disc override">override</span>}
                        </div>
                        {status.label && <small>{status.label}</small>}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Wear score</th>
                {selected.map((disc) => (
                  <td key={disc.id}>{disc.wear_score ?? '—'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="disc-compare-meta-grid">
        {selected.map((disc, index) => {
          const overrides = overrideAxes(disc)
          return (
            <article key={disc.id} className="disc-compare-meta-card">
              <div className="disc-compare-meta-heading">
                <i className="disc-compare-legend-swatch" style={{ background: CURVE_COLORS[index] }} />
                <h2>{discName(disc)}</h2>
              </div>
              <p>{discManufacturer(disc)} · {disc.status ?? 'status unknown'}</p>
              <p>
                <strong>Overrides:</strong> {overrides.length ? overrides.join(', ') : 'none'}
              </p>
              <Link to={`/bag/discs/${disc.id}`} className="link-button">
                Open disc
              </Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}
