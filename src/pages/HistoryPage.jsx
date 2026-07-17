import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HISTORY_VISIBILITY,
  activityHistoryEntries,
  allPuttSamples,
  fetchHistory,
} from '../lib/history'
import { useAuth } from '../context/AuthContext'
import { useHistoryRecovery } from '../hooks/useHistoryRecovery'
import { SYNC_STATUS } from '../lib/instantLaunch/syncScheduler'
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

function SyncBadge({ state }) {
  if (state === 'pending') return <span className="history-sync-badge history-sync-pending">Saved on device</span>
  if (state === 'needs_attention') {
    return <span className="history-sync-badge history-sync-attention">Needs attention</span>
  }
  return null
}

function EntryContents({ entry, regimenPBs, distancePBs }) {
  if (entry.type === 'freeform') {
    return (
      <>
        <span>Freeform</span>
        <span>
          {entry.aggregate.minDistance == null
            ? 'No synced putts'
            : entry.aggregate.minDistance === entry.aggregate.maxDistance
              ? `${entry.aggregate.minDistance} ft`
              : `${entry.aggregate.minDistance}–${entry.aggregate.maxDistance} ft`}
        </span>
        <span>
          {entry.aggregate.makes}/{entry.aggregate.attempts}
        </span>
        {entry.activity.state === 'incomplete' && <span className="abandoned-badge">Incomplete</span>}
        {distancePBs.has(entry.id) && <span className="pb-badge">PB</span>}
        <SyncBadge state={entry.activity.sync_state} />
        {(entry.session?.tags ?? []).length > 0 && (
          <span className="row-tag-count">#{entry.session.tags.length}</span>
        )}
      </>
    )
  }

  return (
    <>
      <span>{entry.run?.putting_regimens?.name ?? 'Regimen'}</span>
      <span>{entry.run ? `${entry.run.total_score} pts` : 'Awaiting sync'}</span>
      <span className={entry.activity.state === 'completed' ? 'zone-badge' : 'abandoned-badge'}>
        {entry.activity.state === 'completed' ? 'Completed' : 'Incomplete'}
      </span>
      {regimenPBs.has(entry.id) && <span className="pb-badge">PB</span>}
      <SyncBadge state={entry.activity.sync_state} />
      {(entry.run?.tags ?? []).length > 0 && <span className="row-tag-count">#{entry.run.tags.length}</span>}
    </>
  )
}

export default function HistoryPage({ deleted = false }) {
  const { user } = useAuth()
  const recovery = useHistoryRecovery()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')

  const loadHistory = useCallback(() => {
    setError(null)
    return fetchHistory(user.id, {
      visibility: deleted ? HISTORY_VISIBILITY.HIDDEN : HISTORY_VISIBILITY.VISIBLE,
    })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [deleted, user.id])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (recovery.syncStatus === SYNC_STATUS.SYNCED) loadHistory()
  }, [loadHistory, recovery.syncStatus])

  const derived = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const samples = allPuttSamples(data)
    const entries = activityHistoryEntries(data)
    const runSets = data.runs.flatMap((run) =>
      (run.putting_regimen_run_sets ?? []).map((set) => ({
        setOrder: set.putting_regimen_sets?.set_order,
        makes: set.makes,
        attempts: set.attempts,
        pressurePuttMade: set.pressure_putt_made,
      })),
    )

    return {
      entries,
      regimenPBs: regimenPBRunIds(
        data.runs.map((run) => ({
          id: run.id,
          regimenId: run.regimen_id,
          totalScore: run.total_score,
          completed: run.completed,
          at: run.started_at,
        })),
      ),
      distancePBs: distancePBSessionIds(
        data.sessions.map((session) => ({
          id: session.id,
          at: session.created_at,
          logs: (session.putt_distance_logs ?? []).map((log) => ({
            distanceFeet: log.distance_feet,
            makes: log.makes,
            attempts: log.attempts,
          })),
        })),
      ),
      streak: practiceStreak(entries.map((entry) => entry.at), now),
      volume: volumeLedger(samples, now),
      form: decayWeightedForm(samples, now),
      pressure: pressureDifferential(runSets),
      fatigue: fatigueCurve(runSets),
      cadence: cadenceFingerprint(samples),
    }
  }, [data])

  async function handleRestore(activity) {
    try {
      await recovery.restore(activity)
      await loadHistory()
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <p className="form-error">{error}</p>
  if (!derived) return <p className="loading">Loading...</p>

  const { entries, regimenPBs, distancePBs, streak, volume, form, pressure, fatigue, cadence } = derived
  const visible = deleted
    ? entries
    : entries.filter(
        (entry) =>
          filter === 'All' ||
          (filter === 'Freeform' && entry.type === 'freeform') ||
          (filter === 'Regimens' && entry.type === 'regimen'),
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
        <h1>{deleted ? 'Recently Deleted' : 'History'}</h1>
        <Link to={deleted ? '/practice/history' : '/practice'} className="link-button">
          {deleted ? 'History' : 'Practice menu'}
        </Link>
      </header>

      {deleted ? (
        <p className="log-time">Hidden activities remain restorable here for 30 days.</p>
      ) : (
        <>
          <div className="stat-strip">
            <div className="stat-tile"><span className="stat-value">{streak}</span><span className="stat-label">day streak</span></div>
            <div className="stat-tile"><span className="stat-value">{volume.week}</span><span className="stat-label">putts this week</span></div>
            <div className="stat-tile"><span className="stat-value">{volume.month}</span><span className="stat-label">this month</span></div>
            <div className="stat-tile"><span className="stat-value">{volume.lifetime}</span><span className="stat-label">lifetime</span></div>
          </div>
          <div className="history-toolbar">
            <ChipGroup options={FILTERS} isActive={(item) => filter === item} onSelect={setFilter} />
            <Link to="/practice/history/deleted" className="link-button">Recently Deleted</Link>
          </div>
        </>
      )}

      {visible.length === 0 ? (
        <p>{deleted ? 'Nothing deleted recently.' : 'No sessions yet.'}</p>
      ) : (
        dayGroups.map((group) => (
          <div key={group.key} className="history-day">
            <h2 className="history-day-label">{dayLabel(group.key)}</h2>
            <ul className="putt-log-list">
              {group.entries.map((entry) => (
                <li key={`${entry.type}-${entry.id}`} className={deleted ? 'history-deleted-row' : undefined}>
                  {deleted ? (
                    <>
                      <div className="putt-log-row history-row history-row-ghost">
                        <EntryContents entry={entry} regimenPBs={regimenPBs} distancePBs={distancePBs} />
                      </div>
                      <button type="button" className="link-button" onClick={() => handleRestore(entry.activity)}>
                        Restore
                      </button>
                    </>
                  ) : entry.session || entry.run ? (
                    <Link to={`/practice/history/${entry.type}/${entry.id}`} className="putt-log-row history-row">
                      <EntryContents entry={entry} regimenPBs={regimenPBs} distancePBs={distancePBs} />
                    </Link>
                  ) : (
                    <div className="putt-log-row history-row">
                      <EntryContents entry={entry} regimenPBs={regimenPBs} distancePBs={distancePBs} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {!deleted && (
        <>
          <h2>Insights</h2>
          <dl className="insight-list">
            <div className="insight-row"><dt>Current form (14-day weighted)</dt><dd>{pct(form.currentFormPct)} vs {pctWithBand(form.lifetimeMakes, form.lifetimeAttempts)} lifetime</dd></div>
            <div className="insight-row"><dt>Clutch factor</dt><dd>{pressure.differential == null ? '—' : `${pressure.differential >= 0 ? '+' : ''}${Math.round(pressure.differential * 100)} pts (pressure ${pct(pressure.pressurePct)} vs regular ${pct(pressure.regularPct)})`}</dd></div>
            <div className="insight-row"><dt>Fatigue curve</dt><dd>{fatigue.length === 0 ? '—' : fatigue.map((bucket) => `S${bucket.setOrder} ${pct(bucket.makePct)}`).join(' · ')}</dd></div>
            <div className="insight-row"><dt>Time of day</dt><dd>{Object.keys(cadence.byTimeOfDay).length === 0 ? '—' : Object.entries(cadence.byTimeOfDay).map(([bucket, value]) => `${bucket} ${pct(value.makePct)}`).join(' · ')}</dd></div>
            <div className="insight-row"><dt>Rest between sessions</dt><dd>{Object.keys(cadence.byGap).length === 0 ? '—' : Object.entries(cadence.byGap).map(([bucket, value]) => `${bucket}d ${pct(value.makePct)}`).join(' · ')}</dd></div>
          </dl>
        </>
      )}

      {recovery.syncStatus === SYNC_STATUS.FAILED && (
        <button type="button" className="link-button" onClick={recovery.retrySync}>Retry activity sync</button>
      )}
    </section>
  )
}
