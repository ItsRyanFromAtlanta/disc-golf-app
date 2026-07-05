import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchHistory, sessionAggregate, allPuttSamples } from '../lib/history'
import { useAuth } from '../context/AuthContext'
import ChipGroup from '../components/ChipGroup'
import {
  fatigueCurve,
  pressureDifferential,
  decayWeightedForm,
  cadenceFingerprint,
  wilsonInterval,
  WILSON_MIN_N_FOR_HIDING,
  regimenPBRunIds,
  distancePBSessionIds,
  practiceStreak,
  volumeLedger,
} from '../lib/insights'

const FILTERS = ['All', 'Freeform', 'Regimens']

function pct(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function pctWithBand(makes, attempts) {
  if (!attempts) return '—'
  const shown = pct(makes / attempts)
  if (attempts >= WILSON_MIN_N_FOR_HIDING) return shown
  const band = wilsonInterval(makes, attempts)
  return `${shown} (${pct(band.lower)}–${pct(band.upper)})`
}

function dayKey(iso) {
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dayLabel(timestamp) {
  return new Date(timestamp).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchHistory(user.id).then(setData).catch((err) => setError(err.message))
  }, [user.id])

  const derived = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const samples = allPuttSamples(data)

    const runSets = data.runs.flatMap((r) =>
      (r.putting_regimen_run_sets ?? []).map((s) => ({
        setOrder: s.putting_regimen_sets?.set_order,
        makes: s.makes,
        attempts: s.attempts,
        pressurePuttMade: s.pressure_putt_made,
      })),
    )

    const entries = [
      ...data.sessions.map((s) => ({
        type: 'freeform',
        id: s.id,
        at: s.created_at,
        session: s,
        aggregate: sessionAggregate(s),
      })),
      ...data.runs.map((r) => ({ type: 'regimen', id: r.id, at: r.started_at, run: r })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at))

    return {
      entries,
      regimenPBs: regimenPBRunIds(
        data.runs.map((r) => ({
          id: r.id,
          regimenId: r.regimen_id,
          totalScore: r.total_score,
          completed: r.completed,
          at: r.started_at,
        })),
      ),
      distancePBs: distancePBSessionIds(
        data.sessions.map((s) => ({
          id: s.id,
          at: s.created_at,
          logs: (s.putt_distance_logs ?? []).map((l) => ({
            distanceFeet: l.distance_feet,
            makes: l.makes,
            attempts: l.attempts,
          })),
        })),
      ),
      streak: practiceStreak(entries.map((e) => e.at), now),
      volume: volumeLedger(samples, now),
      form: decayWeightedForm(samples, now),
      pressure: pressureDifferential(runSets),
      fatigue: fatigueCurve(runSets),
      cadence: cadenceFingerprint(samples),
    }
  }, [data])

  if (error) return <p className="form-error">{error}</p>
  if (!derived) return <p className="loading">Loading...</p>

  const { entries, regimenPBs, distancePBs, streak, volume, form, pressure, fatigue, cadence } = derived

  const visible = entries.filter(
    (e) =>
      filter === 'All' ||
      (filter === 'Freeform' && e.type === 'freeform') ||
      (filter === 'Regimens' && e.type === 'regimen'),
  )

  const dayGroups = []
  for (const entry of visible) {
    const key = dayKey(entry.at)
    const group = dayGroups.at(-1)
    if (group && group.key === key) group.entries.push(entry)
    else dayGroups.push({ key, entries: [entry] })
  }

  return (
    <section className="history-page">
      <header className="practice-header">
        <h1>History</h1>
        <Link to="/practice" className="link-button">
          Practice menu
        </Link>
      </header>

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">day streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{volume.week}</span>
          <span className="stat-label">putts this week</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{volume.month}</span>
          <span className="stat-label">this month</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{volume.lifetime}</span>
          <span className="stat-label">lifetime</span>
        </div>
      </div>

      <ChipGroup options={FILTERS} isActive={(f) => filter === f} onSelect={setFilter} />

      {visible.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        dayGroups.map((group) => (
          <div key={group.key} className="history-day">
            <h2 className="history-day-label">{dayLabel(group.key)}</h2>
            <ul className="putt-log-list">
              {group.entries.map((entry) =>
                entry.type === 'freeform' ? (
                  <li key={`f-${entry.id}`}>
                    <Link to={`/practice/history/freeform/${entry.id}`} className="putt-log-row history-row">
                      <span>Freeform</span>
                      <span>
                        {entry.aggregate.minDistance == null
                          ? 'No putts'
                          : entry.aggregate.minDistance === entry.aggregate.maxDistance
                            ? `${entry.aggregate.minDistance} ft`
                            : `${entry.aggregate.minDistance}–${entry.aggregate.maxDistance} ft`}
                      </span>
                      <span>
                        {entry.aggregate.makes}/{entry.aggregate.attempts}
                      </span>
                      {distancePBs.has(entry.id) && <span className="pb-badge">PB</span>}
                      {(entry.session.tags ?? []).length > 0 && <span className="row-tag-count">#{entry.session.tags.length}</span>}
                    </Link>
                  </li>
                ) : (
                  <li key={`r-${entry.id}`}>
                    <Link to={`/practice/history/regimen/${entry.id}`} className="putt-log-row history-row">
                      <span>{entry.run.putting_regimens?.name ?? 'Regimen'}</span>
                      <span>{entry.run.completed ? `${entry.run.total_score} pts` : null}</span>
                      <span className={entry.run.completed ? 'zone-badge' : 'abandoned-badge'}>
                        {entry.run.completed ? 'Completed' : 'Abandoned'}
                      </span>
                      {regimenPBs.has(entry.id) && <span className="pb-badge">PB</span>}
                      {(entry.run.tags ?? []).length > 0 && <span className="row-tag-count">#{entry.run.tags.length}</span>}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))
      )}

      <h2>Insights</h2>
      <dl className="insight-list">
        <div className="insight-row">
          <dt>Current form (14-day weighted)</dt>
          <dd>
            {pct(form.currentFormPct)} vs {pctWithBand(form.lifetimeMakes, form.lifetimeAttempts)} lifetime
          </dd>
        </div>
        <div className="insight-row">
          <dt>Clutch factor</dt>
          <dd>
            {pressure.differential == null
              ? '—'
              : `${pressure.differential >= 0 ? '+' : ''}${Math.round(pressure.differential * 100)} pts (pressure ${pct(pressure.pressurePct)} vs regular ${pct(pressure.regularPct)})`}
          </dd>
        </div>
        <div className="insight-row">
          <dt>Fatigue curve</dt>
          <dd>
            {fatigue.length === 0
              ? '—'
              : fatigue.map((b) => `S${b.setOrder} ${pct(b.makePct)}`).join(' · ')}
          </dd>
        </div>
        <div className="insight-row">
          <dt>Time of day</dt>
          <dd>
            {Object.keys(cadence.byTimeOfDay).length === 0
              ? '—'
              : Object.entries(cadence.byTimeOfDay)
                  .map(([bucket, v]) => `${bucket} ${pct(v.makePct)}`)
                  .join(' · ')}
          </dd>
        </div>
        <div className="insight-row">
          <dt>Rest between sessions</dt>
          <dd>
            {Object.keys(cadence.byGap).length === 0
              ? '—'
              : Object.entries(cadence.byGap)
                  .map(([bucket, v]) => `${bucket}d ${pct(v.makePct)}`)
                  .join(' · ')}
          </dd>
        </div>
      </dl>
    </section>
  )
}
