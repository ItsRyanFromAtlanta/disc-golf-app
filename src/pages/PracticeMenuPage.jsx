import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChartBar, IconTargetArrow } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, allPuttSamples, distanceSamples } from '../lib/history'
import { practiceStreak, volumeLedger, suggestNextSession } from '../lib/insights'
import { heroCardState } from '../lib/dashboardHero'
import { applySetProfileDefaults } from '../lib/instantLaunch/stateReducer'
import { readInstantLaunchState, updateInstantLaunchState } from '../lib/instantLaunch/storage'
import { quickPlayOptions, resolveQuickPlayRegimen } from '../lib/playLaunch'
import { regimenRepository } from '../lib/repository/regimenRepository'
import { useActiveActivity } from '../hooks/useActiveActivity'
import ChipGroup from '../components/ChipGroup'

const ZONE_B_TABS = [
  { key: 'standard', label: '★ Standard' },
  { key: 'custom', label: '🛠️ Custom' },
  { key: 'new', label: '➕ New' },
]

function activityDate(value) {
  // Date-only strings (putt_sessions.session_date) must parse as local time,
  // not UTC midnight, or they display as the previous day in western timezones.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function RegimenLaunchCard({ regimen }) {
  return (
    <div className="regimen-card">
      <div className="regimen-card-header">
        <span className={`difficulty-badge difficulty-${regimen.difficulty}`}>{'★'.repeat(regimen.difficulty)}</span>
        <h3>{regimen.name}</h3>
      </div>
      {regimen.description && <p className="regimen-description">{regimen.description}</p>}
      <div className="regimen-launch-actions">
        <Link to={`/practice/regimens/${regimen.id}/run`} className="start-button">
          Launch
        </Link>
        <Link to={`/practice/regimens/new?clone=${regimen.id}`} className="link-button">
          👯 Clone &amp; Tweak
        </Link>
      </div>
    </div>
  )
}

export default function PracticeMenuPage() {
  const { user, signOut } = useAuth()
  const activeActivity = useActiveActivity(user?.id)
  const [historyData, setHistoryData] = useState(null)
  const [regimens, setRegimens] = useState(null)
  const [zoneBTab, setZoneBTab] = useState('standard')
  const [quickPlayRegimenId, setQuickPlayRegimenId] = useState(
    () => readInstantLaunchState().profileDefaults.quickPlayRegimenId,
  )
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchHistory(user.id)
      .then(setHistoryData)
      .catch((err) => setError(err.message))
  }, [user.id])

  useEffect(() => {
    let cancelled = false
    regimenRepository.list(user.id)
      .then((data) => { if (!cancelled) setRegimens(data) })
      .catch((fetchError) => { if (!cancelled) setError(fetchError.message) })
    return () => { cancelled = true }
  }, [user.id])

  const hasHistory = historyData ? historyData.sessions.length > 0 || historyData.runs.length > 0 : false

  // Sourced from suggestNextSession (real Supabase history), not the
  // localStorage smartPredictionCard directly -- nothing writes that field
  // yet, so it would always read null. Real crash-recovery state still comes
  // from the actual InstantLaunch buffer.
  const hero = useMemo(
    () => heroCardState(readInstantLaunchState(), hasHistory, activeActivity),
    [activeActivity, hasHistory],
  )

  const suggestion = useMemo(() => {
    if (!historyData) return null
    return suggestNextSession(
      historyData.runs,
      distanceSamples(historyData),
      allPuttSamples(historyData),
      new Date(),
    )
  }, [historyData])

  const streak = useMemo(() => {
    if (!historyData) return 0
    const dates = [...historyData.sessions.map((s) => s.created_at), ...historyData.runs.map((r) => r.started_at)]
    return practiceStreak(dates, new Date())
  }, [historyData])

  const volume = useMemo(() => {
    if (!historyData) return null
    return volumeLedger(allPuttSamples(historyData), new Date())
  }, [historyData])

  const recent = useMemo(() => {
    if (!historyData) return []
    const merged = [
      ...historyData.sessions.map((s) => ({
        id: `session-${s.id}`,
        at: s.created_at,
        label: 'Freeform session',
        detail: null,
      })),
      ...historyData.runs.map((r) => ({
        id: `run-${r.id}`,
        at: r.started_at,
        label: r.putting_regimens?.name ?? 'Regimen run',
        detail: r.completed ? `${r.total_score} pts` : 'In progress',
      })),
    ]
    return merged.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 3)
  }, [historyData])

  // System regimens have user_id null; custom routines are the user's own,
  // non-archived rows (RLS already scopes the query to system + own).
  const standardRegimens = regimens?.filter((r) => r.user_id == null) ?? []
  const customRegimens = regimens?.filter((r) => r.user_id === user.id && !r.archived) ?? []
  const quickPlay = resolveQuickPlayRegimen(regimens ?? [], quickPlayRegimenId)
  const quickPlayChoices = quickPlayOptions(regimens ?? [])
  const suggestedRegimen = regimens?.find((regimen) => regimen.id === suggestion?.lastRegimenId) ?? null

  function setQuickPlayDefault(regimenId) {
    setQuickPlayRegimenId(regimenId)
    updateInstantLaunchState(applySetProfileDefaults, { quickPlayRegimenId: regimenId })
  }

  if (error) return <p className="form-error">{error}</p>

  return (
    <section className="practice-menu-page">
      <header className="practice-header">
        <h1>Putt Hub</h1>
        <span className="header-actions">
          {streak > 0 && <span className="streak-badge">🔥 {streak}-day streak</span>}
          <Link to="/practice/stats" className="stats-shortcut" title="Confidence map">
            <IconChartBar size={22} stroke={1.75} />
          </Link>
          <button type="button" className="link-button" onClick={signOut}>
            Sign out
          </button>
        </span>
      </header>

      <section className="dashboard-zone-a">
        {hero.kind === 'crash-recovery' ? (
          <Link
            to={hero.sessionType === 'regimen' ? `/practice/regimens/${hero.parentIds.regimenId}/run` : '/practice/freeform'}
            className="hero-card hero-card-resume"
          >
            ▶️ Resume session in progress
          </Link>
        ) : hero.kind === 'active-activity' ? (
          <Link
            to={hero.activityType === 'putting_regimen' && hero.regimenId ? `/practice/regimens/${hero.regimenId}/run` : '/practice/freeform'}
            className="hero-card hero-card-resume"
          >
            ▶️ Resume active practice
            <span className="log-time">{hero.state === 'paused' ? 'Paused safely for later' : 'In progress'}</span>
          </Link>
        ) : null}

        <div className="quick-play-card">
          <div className="quick-play-copy">
            <IconTargetArrow size={24} stroke={1.75} aria-hidden="true" />
            <div>
              <h2>Quick Play</h2>
              <p>{quickPlay.regimen?.name ?? 'No routine available'}</p>
            </div>
          </div>
          <label htmlFor="quick-play-default">Default on this device</label>
          <select
            id="quick-play-default"
            value={quickPlay.regimen?.id ?? ''}
            disabled={quickPlayChoices.length === 0}
            onChange={(event) => setQuickPlayDefault(event.target.value)}
          >
            {quickPlayChoices.map((regimen) => (
              <option key={regimen.id} value={regimen.id}>
                {regimen.user_id == null ? `Level ${regimen.difficulty}: ` : 'Custom: '}{regimen.name}
              </option>
            ))}
          </select>
          {quickPlay.regimen ? (
            <Link to={`/practice/regimens/${quickPlay.regimen.id}/run`} className="start-button">
              Start Quick Play
            </Link>
          ) : (
            <span className="start-button" aria-disabled="true">Quick Play unavailable</span>
          )}
        </div>
      </section>

      <section className="dashboard-zone-b">
        <div className="play-section-heading">
          <h2>Select routine</h2>
          <Link to="/practice/freeform" className="link-button">Free Play</Link>
        </div>
        <ChipGroup
          options={ZONE_B_TABS}
          getKey={(t) => t.key}
          getLabel={(t) => t.label}
          isActive={(t) => zoneBTab === t.key}
          onSelect={(t) => setZoneBTab(t.key)}
        />

        {!regimens ? (
          <p className="loading">Loading...</p>
        ) : zoneBTab === 'standard' ? (
          standardRegimens.map((regimen) => <RegimenLaunchCard key={regimen.id} regimen={regimen} />)
        ) : zoneBTab === 'custom' ? (
          customRegimens.length === 0 ? (
            <p>
              No custom routines yet.{' '}
              <Link to="/practice/regimens/new">Build one →</Link>
            </p>
          ) : (
            customRegimens.map((regimen) => <RegimenLaunchCard key={regimen.id} regimen={regimen} />)
          )
        ) : (
          <Link to="/practice/regimens/new" className="start-button">
            ➕ Build a custom routine
          </Link>
        )}
      </section>

      <section className="dashboard-zone-c play-suggestion-card">
        <h2>Suggested next session</h2>
        {suggestedRegimen ? (
          <Link to={`/practice/regimens/${suggestedRegimen.id}/run`} className="mode-card">
            <span className="mode-card-body">
              <span className="mode-card-title">{suggestedRegimen.name}</span>
              <span className="mode-card-description">Suggested target: {suggestion?.suggestedDistanceFt} ft</span>
            </span>
            <span className="mode-card-chevron" aria-hidden="true">›</span>
          </Link>
        ) : (
          <Link to="/practice/regimens" className="link-button">Choose a routine to establish your baseline</Link>
        )}
      </section>

      <h2>
        Recent activity{' '}
        <Link to="/practice/history" className="link-button">
          View all
        </Link>
      </h2>
      {!historyData ? (
        <p className="loading">Loading...</p>
      ) : recent.length === 0 ? (
        <p>No practice logged yet — pick a mode above to get started.</p>
      ) : (
        <>
          {volume && <p className="log-time">This week: {volume.week} putts</p>}
          <ul className="putt-log-list">
            {recent.map((entry) => (
              <li key={entry.id} className="putt-log-row">
                <span>{entry.label}</span>
                <span className="log-time">
                  {entry.detail ? `${entry.detail} · ` : ''}
                  {activityDate(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
