import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { mostRecentRegimenId } from '../lib/insights'
import { regimenRepository } from '../lib/repository/regimenRepository'
import { drillGroupLabel, drillKind, DRILL_TYPES } from '../lib/drillEngine'

export default function RegimenSelectPage() {
  const { user, signOut } = useAuth()
  const [regimens, setRegimens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [suggestedId, setSuggestedId] = useState(null)

  const groups = ['Classic drills', 'Scored regimens', 'Custom routines']
    .map((label) => ({ label, regimens: regimens.filter((regimen) => drillGroupLabel(regimen) === label) }))
    .filter((group) => group.regimens.length > 0)

  useEffect(() => {
    let cancelled = false
    regimenRepository.list(user.id)
      .then((data) => { if (!cancelled) setRegimens(data) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user.id])

  // Light-touch smart-prediction surface — just enough to highlight "last
  // time you did this one," not a rebuild of this page. A direct query for
  // regimen_id/started_at is enough here; the full fetchHistory (sessions +
  // distance logs too) belongs to the run/log pages that actually use it.
  useEffect(() => {
    supabase
      .from('putting_regimen_runs')
      .select('regimen_id, started_at')
      .eq('user_id', user.id)
      .then(({ data }) => setSuggestedId(mostRecentRegimenId(data ?? [])))
  }, [user.id])

  return (
    <section className="regimen-select-page">
      <header className="practice-header">
        <h1>Putting Regimens</h1>
        <button type="button" className="link-button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <p>
        <Link to="/practice">&larr; Practice menu</Link>
      </p>

      {loading && <p className="loading">Loading...</p>}
      {error && <p className="form-error">{error}</p>}

      {groups.map((group) => (
        <section key={group.label} className="regimen-group">
          <h2>{group.label}</h2>
          <ul className="regimen-list">
            {group.regimens.map((regimen) => {
              const classic = [DRILL_TYPES.JYLY, DRILL_TYPES.AROUND_THE_WORLD, DRILL_TYPES.CLUTCH].includes(drillKind(regimen))
              return (
                <li key={regimen.id} className="regimen-card">
                  <div className="regimen-card-header">
                    <span className={`difficulty-badge difficulty-${regimen.difficulty}`}>
                      {'★'.repeat(regimen.difficulty)}
                    </span>
                    <h3>{regimen.name}</h3>
                    {suggestedId === regimen.id && <span className="pb-badge">Last time</span>}
                  </div>
                  {regimen.description && <p className="regimen-description">{regimen.description}</p>}
                  {classic ? (
                    <p className="regimen-rule-summary">
                      {drillKind(regimen) === DRILL_TYPES.JYLY
                        ? '100 putts · score every make'
                        : drillKind(regimen) === DRILL_TYPES.CLUTCH
                          ? 'One pressure putt · randomized 2–8 min rest'
                          : `10 stations · ${regimen.rules_config?.max_attempts ?? 100} attempt cap`}
                    </p>
                  ) : (
                    <dl className="regimen-stats">
                      <div><dt>Base pts/make</dt><dd>{regimen.base_points_per_make}</dd></div>
                      <div><dt>Streak step</dt><dd>{Math.round(regimen.streak_step * 100)}%</dd></div>
                      <div><dt>Clean set bonus</dt><dd>{Math.round(regimen.no_miss_bonus_pct * 100)}%</dd></div>
                      <div><dt>Completion bonus</dt><dd>{regimen.completion_bonus}</dd></div>
                    </dl>
                  )}
                  <Link to={`/practice/regimens/${regimen.id}/run`} className="start-button">Start</Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </section>
  )
}
