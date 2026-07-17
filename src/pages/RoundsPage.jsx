import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatRelativeToPar, relativeToPar } from '../lib/rounds'
import { loadRound, useRoundList } from '../lib/repository/roundRepository'

function formatPlayedAt(value) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RoundsPage() {
  const { user } = useAuth()
  const roundsQuery = useRoundList(user.id)
  const [details, setDetails] = useState({})

  useEffect(() => {
    let active = true
    const rounds = roundsQuery.data ?? []
    if (rounds.length === 0) {
      setDetails({})
      return () => {
        active = false
      }
    }

    Promise.all(
      rounds.map(async (round) => {
        try {
          return [round.id, await loadRound(round.id, user.id)]
        } catch {
          return [round.id, null]
        }
      }),
    ).then((entries) => {
      if (active) setDetails(Object.fromEntries(entries))
    })

    return () => {
      active = false
    }
  }, [roundsQuery.data, user.id])

  if (roundsQuery.isLoading) return <p className="loading">Loading rounds...</p>
  if (roundsQuery.error && !roundsQuery.data) return <p className="form-error">{roundsQuery.error.message}</p>

  const rounds = roundsQuery.data ?? []

  return (
    <section className="rounds-page">
      <header className="practice-header">
        <h1>Rounds</h1>
        <Link to="/rounds/new" className="start-button">
          Start round
        </Link>
      </header>

      {roundsQuery.error && <p className="form-error">Showing saved rounds from this device.</p>}

      {rounds.length === 0 ? (
        <div className="empty-state">
          <p>No rounds logged yet.</p>
          <Link to="/rounds/new" className="btn-primary">
            Log a round
          </Link>
        </div>
      ) : (
        <ul className="course-list round-list">
          {rounds.map((round) => {
            const detail = details[round.id]
            const hasScore = Boolean(detail?.round_holes?.some((row) => row.score !== null && row.score !== ''))
            const relative = detail && hasScore
              ? formatRelativeToPar(relativeToPar(detail.round_holes, detail.holes))
              : '—'
            return (
              <li key={round.id}>
                <Link to={`/rounds/${round.id}`} className="course-card">
                  <span>
                    <strong>{round.course?.name ?? detail?.course?.name ?? 'Round'}</strong>
                    <small>
                      {formatPlayedAt(round.played_at)} · {round.status === 'completed' ? 'Completed' : 'In progress'}
                    </small>
                  </span>
                  <span className="course-card-score">
                    <strong>{relative}</strong>
                    <small>{round.total_score ?? detail?.total_score ?? 'Score —'}</small>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
