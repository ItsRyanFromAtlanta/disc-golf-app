import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { conditionLedger, conditionSplits } from '../lib/insights'
import { formatRelativeToPar, relativeToPar } from '../lib/rounds'
import { conditionLabel, describeRoundWeather, readRoundWeather } from '../lib/roundWeather'
import { loadRound, useRoundList, useRoundSync } from '../lib/repository/roundRepository'

function formatPlayedAt(value) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// One decimal is as much precision as an average over three rounds earns.
function formatAverage(value) {
  return formatRelativeToPar(Math.round(value * 10) / 10)
}

export default function RoundsPage() {
  const { user } = useAuth()
  const roundsQuery = useRoundList(user.id)
  const roundSync = useRoundSync(user.id)
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

  const rounds = useMemo(() => roundsQuery.data ?? [], [roundsQuery.data])

  // The list row carries the weather columns, but only the hydrated detail
  // carries the holes a relative-to-par can be computed from — so the split
  // reads the detail where one has loaded and falls back to the bare row, which
  // the split will then skip as uncomparable rather than guess at.
  const detailedRounds = useMemo(
    () => rounds.map((round) => details[round.id] ?? round),
    [details, rounds],
  )
  const ledger = useMemo(() => conditionLedger(detailedRounds), [detailedRounds])
  const splits = useMemo(() => conditionSplits(detailedRounds), [detailedRounds])

  if (roundsQuery.isLoading) return <p className="loading">Loading rounds...</p>
  if (roundsQuery.error && !roundsQuery.data) return <p className="form-error">{roundsQuery.error.message}</p>

  return (
    <section className="rounds-page">
      <header className="practice-header">
        <h1>Rounds</h1>
        <Link to="/rounds/new" className="start-button">
          Start round
        </Link>
      </header>

      {roundsQuery.error && <p className="form-error">Showing saved rounds from this device.</p>}

      {roundSync.unsyncedRoundIds.length > 0 && (
        <p className="form-error" role="status">
          {roundSync.unsyncedRoundIds.length === 1
            ? '1 round has not reached the server.'
            : `${roundSync.unsyncedRoundIds.length} rounds have not reached the server.`}{' '}
          They are saved on this device only.{' '}
          <button type="button" className="link-button" onClick={roundSync.retrySync}>
            Retry round sync
          </button>
        </p>
      )}

      {/* A ledger, not a verdict. Counts are facts about what was logged; the
          per-layout split below only appears once it is comparing the same
          holes across enough rounds to mean anything (see
          `lib/insights/roundConditions.js`). Coverage is stated because weather
          is optional and a reader has to know how much of their history these
          numbers actually cover. */}
      {ledger.recorded > 0 && (
        <section className="round-conditions" aria-label="Conditions logged">
          <h2>Conditions</h2>
          <p className="round-conditions-ledger">
            {ledger.conditions.map((entry) => `${conditionLabel(entry.condition)} ${entry.rounds}`).join(' · ')}
          </p>
          <p className="log-time">
            Logged on {ledger.recorded} of {ledger.recorded + ledger.unrecorded} rounds
          </p>

          {splits.map((layout) => (
            <div key={layout.layoutId} className="round-conditions-split">
              <strong>
                {layout.courseName ?? 'Course'}
                {layout.layoutName ? ` · ${layout.layoutName}` : ''}
              </strong>
              <ul className="putt-log-list">
                {layout.conditions.map((entry) => (
                  <li key={entry.condition} className="putt-log-row">
                    <span>{conditionLabel(entry.condition)}</span>
                    <span>{formatAverage(entry.averageRelativeToPar)}</span>
                    <span className="log-time">
                      {entry.rounds} {entry.rounds === 1 ? 'round' : 'rounds'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

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
            const conditions = describeRoundWeather(readRoundWeather(round))
            return (
              <li key={round.id}>
                <Link to={`/rounds/${round.id}`} className="course-card">
                  <span>
                    <strong>{round.course?.name ?? detail?.course?.name ?? 'Round'}</strong>
                    <small>
                      {formatPlayedAt(round.played_at)} · {round.status === 'completed' ? 'Completed' : 'In progress'}
                    </small>
                    {/* Nothing at all when unrecorded — a "conditions not
                        recorded" line on every row would be noise on the
                        screen a player scans for scores. */}
                    {conditions && <small className="round-card-conditions">🌬️ {conditions}</small>}
                    {roundSync.unsyncedRoundIds.includes(round.id) && (
                      <span className="history-sync-badge history-sync-attention">Needs attention</span>
                    )}
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
