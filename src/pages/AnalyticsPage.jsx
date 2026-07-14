import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, allPuttSamples, distanceSamples } from '../lib/history'
import { fetchPrimaryPutterMilestones } from '../lib/analytics'
import {
  confidenceMap,
  makePercentTimeSeries,
  TIME_RANGE_DAYS,
  DEFAULT_TIME_RANGE_DAYS,
} from '../lib/insights'
import { readAppSettings, updateAppSettings } from '../lib/appSettings'
import { readInstantLaunchState, clearInstantLaunchState } from '../lib/instantLaunch/storage'
import { flushOutbox, pendingWriteCount } from '../lib/instantLaunch/flushOutbox'
import { db } from '../lib/db/dexieDb'
import TrendChart from '../components/analytics/TrendChart'
import ConfidenceMapPanel from '../components/analytics/ConfidenceMapPanel'
import SyncLedger from '../components/analytics/SyncLedger'
import BehavioralToggles from '../components/analytics/BehavioralToggles'
import DataExportPanel from '../components/analytics/DataExportPanel'
import ClearCacheModal from '../components/analytics/ClearCacheModal'

// Counts everything still waiting to reach Supabase: the InstantLaunch capture
// outbox (active-session writes) plus the staged Dexie repository outbox — both
// are "the local database sync" this screen reports on (SCREEN_SPECS divergence).
async function readPendingCount() {
  const instantLaunch = pendingWriteCount(readInstantLaunchState().outbox)
  let dexie = 0
  try {
    dexie = await db.outbox.count()
  } catch {
    // Dexie unavailable (e.g. private browsing) — just report the InstantLaunch side
  }
  return instantLaunch + dexie
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [error, setError] = useState(null)
  const [range, setRange] = useState(DEFAULT_TIME_RANGE_DAYS)

  const [settings, setSettings] = useState(() => readAppSettings())

  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  useEffect(() => {
    Promise.all([fetchHistory(user.id), fetchPrimaryPutterMilestones(user.id)])
      .then(([hist, marks]) => {
        setHistory(hist)
        setMilestones(marks)
      })
      .catch((err) => setError(err.message))
  }, [user.id])

  const refreshPending = useCallback(() => {
    readPendingCount().then(setPendingCount)
  }, [])

  useEffect(() => {
    refreshPending()
  }, [refreshPending])

  const bands = useMemo(() => (history ? confidenceMap(distanceSamples(history)) : []), [history])
  const series = useMemo(
    () => (history ? makePercentTimeSeries(allPuttSamples(history), { windowDays: range }) : null),
    [history, range],
  )

  function handleSettingChange(partial) {
    setSettings(updateAppSettings(partial))
  }

  async function handleSyncNow() {
    setSyncing(true)
    setSyncError(false)
    const result = await flushOutbox()
    setPendingCount(await readPendingCount())
    setSyncError(result.hadError)
    if (!result.hadError) setLastSyncedAt(Date.now())
    setSyncing(false)
  }

  async function handleClearCache() {
    clearInstantLaunchState()
    try {
      await db.delete()
      await db.open()
    } catch {
      // ignore — nothing to clear or Dexie unavailable
    }
    setClearOpen(false)
    refreshPending()
  }

  if (error) return <p className="form-error">{error}</p>
  if (!history || !series) return <p className="loading">Loading...</p>

  return (
    <section className="analytics-page">
      <header className="practice-header">
        <h1>Analytics</h1>
        <Link to="/practice" className="link-button">
          Practice menu
        </Link>
      </header>

      <section className="settings-card">
        <h2>Make % trend</h2>
        <TrendChart
          series={series}
          milestones={milestones}
          range={range}
          rangeOptions={TIME_RANGE_DAYS}
          onRangeChange={setRange}
        />
      </section>

      <section className="settings-card">
        <h2>Confidence map</h2>
        <ConfidenceMapPanel bands={bands} />
      </section>

      <SyncLedger
        pendingCount={pendingCount}
        lastSyncedAt={lastSyncedAt}
        syncing={syncing}
        syncError={syncError}
        onSyncNow={handleSyncNow}
      />

      <BehavioralToggles settings={settings} onChange={handleSettingChange} />

      <DataExportPanel history={history} />

      <section className="settings-card danger-zone">
        <h2>Clear local cache</h2>
        <p className="settings-card-sub">
          Wipes this device’s cached copy (never your server data). Disabled while writes are pending.
        </p>
        <button
          type="button"
          className="danger-button"
          disabled={pendingCount > 0}
          onClick={() => setClearOpen(true)}
        >
          Clear cache
        </button>
      </section>

      {clearOpen && <ClearCacheModal onCancel={() => setClearOpen(false)} onConfirm={handleClearCache} />}
    </section>
  )
}
