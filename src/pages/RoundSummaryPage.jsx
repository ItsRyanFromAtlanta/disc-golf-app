import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  finalizeRoundActivity,
  flushRoundOutbox,
  loadRound,
  useUpdateRound,
} from '../lib/repository/roundRepository'
import { formatRelativeToPar, relativeToPar, roundTotal } from '../lib/rounds'

function formatPlayedAt(value) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RoundSummaryPage() {
  const { roundId } = useParams()
  const { user } = useAuth()
  const updateRound = useUpdateRound(user.id)
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    flushRoundOutbox(user.id)
      .catch(() => undefined)
      .then(() => loadRound(roundId, user.id))
      .then((value) => {
        if (active) setRound(value)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [roundId, user.id])

  const total = useMemo(() => (round ? roundTotal(round.round_holes) : 0), [round])
  const hasScore = useMemo(
    () => Boolean(round?.round_holes?.some((row) => row.score !== null && row.score !== '')),
    [round],
  )
  const relative = useMemo(
    () => (round && hasScore ? formatRelativeToPar(relativeToPar(round.round_holes, round.holes)) : '—'),
    [hasScore, round],
  )

  async function finishRound() {
    if (!round) return
    setSaving(true)
    setNotice(null)
    try {
      const result = await updateRound.mutateAsync({
        roundId: round.id,
        fields: { status: 'completed', total_score: hasScore ? total : null },
      })
      setRound(result)
      try {
        await finalizeRoundActivity(round.id, user.id)
      } catch {
        setNotice('Round saved; its activity lifecycle will retry when you reconnect.')
      }
    } catch (err) {
      if (err.localResult) {
        setRound((current) => ({ ...current, ...err.localResult }))
        setNotice('Round completed on this device; it will sync when you reconnect.')
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="loading">Loading round summary...</p>
  if (error || !round) return <p className="form-error">{error || 'Round not found'}</p>

  return (
    <section className="round-summary-page">
      <header className="practice-header">
        <div>
          <h1>{round.course?.name ?? 'Round summary'}</h1>
          <p className="log-time">{formatPlayedAt(round.played_at)}</p>
        </div>
        <Link to={`/rounds/${round.id}`} className="link-button">
          Scorecard
        </Link>
      </header>

      {notice && <p className="form-info">{notice}</p>}

      <div className="round-summary-grid">
        <div className="round-summary-stat">
          <span>Relative to par</span>
          <strong>{relative}</strong>
        </div>
        <div className="round-summary-stat">
          <span>Total strokes</span>
          <strong>{hasScore ? total : '—'}</strong>
        </div>
        <div className="round-summary-stat">
          <span>Status</span>
          <strong>{round.status === 'completed' ? 'Completed' : 'In progress'}</strong>
        </div>
      </div>

      <ol className="course-hole-list round-summary-holes">
        {(round.holes ?? []).map((hole) => {
          const row = round.round_holes.find((candidate) => candidate.hole_id === hole.id)
          return (
            <li key={hole.id} className="course-hole-row">
              <strong>Hole {hole.hole_number}</strong>
              <span>Par {hole.par}</span>
              <span>{row?.score ?? '—'}</span>
            </li>
          )
        })}
      </ol>

      <div className="round-actions">
        {round.status === 'completed' ? (
          <Link to="/rounds" className="btn-primary">
            Back to rounds
          </Link>
        ) : (
          <button type="button" className="btn-primary" onClick={finishRound} disabled={saving}>
            {saving ? 'Finishing…' : 'Finish round'}
          </button>
        )}
        <Link to="/courses" className="link-button">
          Course directory
        </Link>
      </div>
    </section>
  )
}
