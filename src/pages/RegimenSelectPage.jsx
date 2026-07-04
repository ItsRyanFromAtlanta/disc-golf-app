import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function RegimenSelectPage() {
  const { signOut } = useAuth()
  const [regimens, setRegimens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('putting_regimens')
      .select('*')
      .order('difficulty', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRegimens(data)
        setLoading(false)
      })
  }, [])

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

      <ul className="regimen-list">
        {regimens.map((regimen) => (
          <li key={regimen.id} className="regimen-card">
            <div className="regimen-card-header">
              <span className={`difficulty-badge difficulty-${regimen.difficulty}`}>
                {'★'.repeat(regimen.difficulty)}
              </span>
              <h2>{regimen.name}</h2>
            </div>
            {regimen.description && <p className="regimen-description">{regimen.description}</p>}
            <dl className="regimen-stats">
              <div>
                <dt>Base pts/make</dt>
                <dd>{regimen.base_points_per_make}</dd>
              </div>
              <div>
                <dt>Streak step</dt>
                <dd>{Math.round(regimen.streak_step * 100)}%</dd>
              </div>
              <div>
                <dt>Clean set bonus</dt>
                <dd>{Math.round(regimen.no_miss_bonus_pct * 100)}%</dd>
              </div>
              <div>
                <dt>Completion bonus</dt>
                <dd>{regimen.completion_bonus}</dd>
              </div>
            </dl>
            <Link to={`/practice/regimens/${regimen.id}/run`} className="start-button">
              Start
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
