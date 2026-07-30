import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RoundWeatherPanel from '../components/RoundWeatherPanel'
import { useAuth } from '../hooks/useAuth'
import { useRoundWeather } from '../hooks/useRoundWeather'
import {
  finalizeRoundActivity,
  flushRoundOutbox,
  loadRound,
  useRoundSync,
  useUpdateRound,
} from '../lib/repository/roundRepository'
import { formatRelativeToPar } from '../lib/rounds'
import { isActivityOnlyRound, roundScoreSummary } from '../lib/roundScoring'

function formatPlayedAt(value) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Where the number came from, said out loud. A stated total and a derived one
// look identical on screen and are not the same fact, and the difference is
// exactly what a reader needs in order to trust — or discount — the number.
const SOURCE_NOTES = {
  scorecard: 'From the scorecard',
  stated: 'Entered by you',
  stated_vs_par: 'Entered total vs layout par',
}

export default function RoundSummaryPage() {
  const { roundId } = useParams()
  const { user } = useAuth()
  const updateRound = useUpdateRound(user.id)
  const roundSync = useRoundSync(user.id)
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const weather = useRoundWeather(round, setRound, user.id)

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

  const score = useMemo(() => roundScoreSummary(round ?? {}), [round])
  const activityOnly = isActivityOnlyRound(round ?? {})
  const [totalDraft, setTotalDraft] = useState('')
  const [totalDirty, setTotalDirty] = useState(false)

  // Seeded from the round, but never while the player is mid-edit: a background
  // outbox flush that re-reads the round must not overwrite a number being
  // typed into the field.
  useEffect(() => {
    if (totalDirty) return
    setTotalDraft(round?.total_score == null ? '' : String(round.total_score))
  }, [round?.total_score, totalDirty])

  const relative = score.relativeToPar == null ? '—' : formatRelativeToPar(score.relativeToPar)

  async function saveStatedTotal() {
    if (!round) return
    const parsed = totalDraft.trim() === '' ? null : Number(totalDraft)
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setNotice('Enter a whole number of strokes, or leave it blank.')
      return
    }
    const total = parsed == null ? null : Math.round(parsed)
    setSaving(true)
    setNotice(null)
    try {
      await updateRound.mutateAsync({ roundId: round.id, fields: { total_score: total } })
      // Merges the one field rather than swapping in the round `updateRound`
      // read back, for the reason `useRoundWeather` gives: the round on this
      // screen is not the round the data layer returns, and we already know the
      // value of the only column that changed. A queued write has no read-back
      // to swap in at all.
      setRound((current) => (current ? { ...current, total_score: total } : current))
      setTotalDirty(false)
    } catch (err) {
      if (err.localResult) {
        setRound((current) => (current ? { ...current, total_score: total } : current))
        setTotalDirty(false)
        setNotice('Total saved on this device; it will sync when you reconnect.')
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function finishRound() {
    if (!round) return
    setSaving(true)
    setNotice(null)
    try {
      const result = await updateRound.mutateAsync({
        roundId: round.id,
        // An activity-only round's total is whatever the player stated, or
        // nothing. Recomputing it from `round_holes` would overwrite a real
        // typed fact with the sum of an empty card — and on a scorecard round
        // it stays derived, exactly as before.
        fields: activityOnly
          ? { status: 'completed' }
          : { status: 'completed', total_score: score.total },
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
        {!activityOnly && (
          <Link to={`/rounds/${round.id}`} className="link-button">
            Scorecard
          </Link>
        )}
      </header>

      {notice && <p className="form-info">{notice}</p>}
      {roundSync.unsyncedRoundIds.includes(round.id) && (
        <p className="form-error" role="status">
          This round hasn’t reached the server, so it is saved on this device only.{' '}
          <button type="button" className="link-button" onClick={roundSync.retrySync}>
            Retry round sync
          </button>
        </p>
      )}

      <div className="round-summary-grid">
        <div className="round-summary-stat">
          <span>Relative to par</span>
          <strong>{relative}</strong>
          {score.relativeToParSource && <small>{SOURCE_NOTES[score.relativeToParSource]}</small>}
        </div>
        <div className="round-summary-stat">
          <span>Total strokes</span>
          <strong>{score.total ?? '—'}</strong>
          {score.totalSource && <small>{SOURCE_NOTES[score.totalSource]}</small>}
        </div>
        <div className="round-summary-stat">
          <span>Status</span>
          <strong>{round.status === 'completed' ? 'Completed' : 'In progress'}</strong>
        </div>
      </div>

      {activityOnly && (
        <section className="round-activity-only" aria-label="Activity-only round">
          {/* Stated plainly rather than left for the reader to infer from a
              screen full of em-dashes. A blank scorecard and a round nobody
              intended to score look identical otherwise. */}
          <p className="form-info">
            Logged without a scorecard. It counts towards your round history, streak and volume; it is
            deliberately left out of per-hole and stroke-average statistics.
          </p>

          <label className="round-activity-only-total">
            Total strokes (optional)
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={totalDraft}
              onChange={(event) => {
                setTotalDirty(true)
                setTotalDraft(event.target.value)
              }}
            />
          </label>
          {round.layout_id ? (
            <p className="log-time">Compared against {round.layout?.name ?? 'the recorded layout'} par.</p>
          ) : (
            <p className="log-time">No layout recorded, so a total cannot be turned into a score to par.</p>
          )}
          <button type="button" className="link-button" onClick={saveStatedTotal} disabled={saving}>
            {saving ? 'Saving…' : 'Save total'}
          </button>
        </section>
      )}

      {/* Still editable after the round is finished, and deliberately so: a
          player who forgot to log the wind at the first tee has nowhere else to
          record it, and conditions are a fact about the round rather than a
          score that finalization should freeze. */}
      <RoundWeatherPanel
        weather={weather.weather}
        onSave={weather.save}
        saving={weather.saving}
        message={weather.message}
      />

      {/* No hole list on an activity-only round. Rendering eighteen rows of
          "—" would imply a card waiting to be filled in, which is precisely
          the thing this round is not. */}
      {!activityOnly && (
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
      )}

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
