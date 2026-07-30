import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RoundWeatherPanel from '../components/RoundWeatherPanel'
import { useAuth } from '../hooks/useAuth'
import { useRoundWeather } from '../hooks/useRoundWeather'
import { SYNC_STATUS } from '../lib/instantLaunch/syncScheduler'
import { useDiscList } from '../lib/repository/discRepository'
import { flushRoundOutbox, loadRound, saveRoundHole, useRoundSync } from '../lib/repository/roundRepository'
import { formatRelativeToPar, relativeToPar, roundTotal } from '../lib/rounds'
import { isActivityOnlyRound } from '../lib/roundScoring'
import { fetchProfile, upsertProfileFields } from '../lib/profile'

function sortedHoles(round) {
  return [...(round.layout?.holes ?? round.holes ?? [])].sort((a, b) => {
    if (a.hole_number !== b.hole_number) return a.hole_number - b.hole_number
    return String(a.tee_type ?? '').localeCompare(String(b.tee_type ?? ''))
  })
}

function prepareRound(round) {
  const holes = sortedHoles(round)
  const rowsByHole = new Map((round.round_holes ?? []).map((row) => [row.hole_id, row]))
  const rows = holes.map((hole) => {
    const existing = rowsByHole.get(hole.id)
    return (
      existing ?? {
        id: crypto.randomUUID(),
        round_id: round.id,
        hole_id: hole.id,
        score: null,
        disc_id: null,
        notes: null,
        hole,
      }
    )
  })
  const known = new Set(holes.map((hole) => hole.id))
  return { ...round, holes, round_holes: [...rows, ...(round.round_holes ?? []).filter((row) => !known.has(row.hole_id))] }
}

function replaceRoundHole(round, holeId, patch) {
  const rows = [...(round.round_holes ?? [])]
  const index = rows.findIndex((row) => row.hole_id === holeId)
  if (index < 0) return { ...round, round_holes: [...rows, patch] }
  rows[index] = { ...rows[index], ...patch }
  return { ...round, round_holes: rows }
}

// The calm sync vocabulary from PHASE_A_ARCHITECTURE.md § 12. The label holds
// the same slot whatever the state, so it never reflows the toolbar.
function syncLabel(status) {
  if (status === SYNC_STATUS.FAILED) return 'Needs attention'
  if (status === SYNC_STATUS.SYNCING) return 'Syncing'
  if (status === SYNC_STATUS.PENDING || status === SYNC_STATUS.ERROR_RETRYING) return 'Saved on device'
  return 'Synced'
}

function discLabel(disc) {
  return disc.nickname || disc.moldInfo?.mold_name || disc.mold || disc.manufacturer || 'Disc'
}

export default function RoundScorecardPage() {
  const { roundId } = useParams()
  const { user } = useAuth()
  const discsQuery = useDiscList(user.id)
  const roundSync = useRoundSync(user.id)
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [savingHoleId, setSavingHoleId] = useState(null)
  const [roundTurnPromptEnabled, setRoundTurnPromptEnabled] = useState(true)
  const [roundTurnDismissed, setRoundTurnDismissed] = useState(false)
  const weather = useRoundWeather(round, setRound, user.id)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchProfile(user.id)
      .then((profile) => {
        if (active) setRoundTurnPromptEnabled(profile?.round_turn_prompt_enabled ?? true)
      })
      .catch(() => undefined)
    flushRoundOutbox(user.id)
      .catch(() => undefined)
      .then(() => loadRound(roundId, user.id))
      .then((value) => {
        if (active) setRound(prepareRound(value))
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

  const currentTotal = useMemo(() => (round ? roundTotal(round.round_holes) : 0), [round])
  const hasScore = useMemo(
    () => Boolean(round?.round_holes?.some((row) => row.score !== null && row.score !== '')),
    [round],
  )
  const currentRelative = useMemo(
    () => (round && hasScore ? formatRelativeToPar(relativeToPar(round.round_holes, round.holes)) : '—'),
    [hasScore, round],
  )
  const discs = discsQuery.data ?? []
  const frontNineComplete = useMemo(() => {
    const front = round?.holes?.filter((hole) => hole.hole_number <= 9) ?? []
    return front.length >= 9 && front.every((hole) => {
      const row = round?.round_holes?.find((value) => value.hole_id === hole.id)
      return row?.score !== null && row?.score !== ''
    })
  }, [round])

  function rowFor(hole) {
    return round?.round_holes.find((row) => row.hole_id === hole.id)
  }

  function makeRow(hole) {
    return (
      rowFor(hole) ?? {
        id: crypto.randomUUID(),
        round_id: round.id,
        hole_id: hole.id,
        score: null,
        disc_id: null,
        notes: null,
        hole,
      }
    )
  }

  function updateLocal(hole, patch) {
    const row = makeRow(hole)
    setRound((current) => replaceRoundHole(current, hole.id, { ...row, ...patch, hole }))
    return { ...row, ...patch, hole }
  }

  async function persist(hole, patch) {
    const payload = updateLocal(hole, patch)
    setSavingHoleId(hole.id)
    setNotice(null)
    try {
      const saved = await saveRoundHole(payload)
      setRound((current) => replaceRoundHole(current, hole.id, { ...payload, ...saved, hole }))
    } catch {
      setNotice('Saved on this device; it will retry when you reconnect.')
    } finally {
      setSavingHoleId(null)
    }
  }

  if (loading) return <p className="loading">Loading scorecard...</p>
  if (error || !round) return <p className="form-error">{error || 'Round not found'}</p>

  // An activity-only round has no scorecard, so this route has nothing to
  // render. It is reachable anyway — a bookmark, a rounds-list row, a shared
  // link — so it explains itself and points at the summary rather than showing
  // a card of empty inputs that would silently start writing `round_holes` the
  // player never asked for. Switching a round between modes is deliberately not
  // offered here: that is a correction, and corrections in this project owe an
  // audit trail with previous and new values, which the round layer does not
  // have yet.
  if (isActivityOnlyRound(round)) {
    return (
      <section className="scorecard-page">
        <header className="practice-header">
          <div>
            <h1>{round.course?.name ?? 'Round'}</h1>
            <p className="log-time">Logged without a scorecard</p>
          </div>
          <Link to={`/rounds/${round.id}/summary`} className="start-button">
            Summary
          </Link>
        </header>
        <p className="form-info">
          This round was logged as an activity, so there are no per-hole scores to enter. Conditions and
          an optional total live on the summary.
        </p>
      </section>
    )
  }

  // A round that never reaches the server still renders perfectly from the
  // local mirror, so nothing else on this screen would ever reveal the failure.
  // This banner is the only place the user can learn about it.
  const roundStuck = roundSync.unsyncedRoundIds.includes(round.id)

  return (
    <section className="scorecard-page">
      <header className="practice-header">
        <div>
          <h1>{round.course?.name ?? 'Round'}</h1>
          <p className="log-time">{round.layout?.name ?? 'Scorecard'}</p>
        </div>
        <Link to={`/rounds/${round.id}/summary`} className="start-button">
          Finish
        </Link>
      </header>

      <div className="scorecard-toolbar" aria-live="polite">
        <span>
          <strong>{currentRelative}</strong> · {currentTotal} strokes
        </span>
        <span>{savingHoleId ? 'Saving…' : syncLabel(roundSync.syncStatus)}</span>
      </div>

      {notice && <p className="form-info">{notice}</p>}
      {roundStuck && (
        <p className="form-error" role="status">
          This round hasn’t reached the server. Your scores are safe on this device, but they are not
          backed up or visible on your other devices.{' '}
          <button type="button" className="link-button" onClick={roundSync.retrySync}>
            Retry round sync
          </button>
        </p>
      )}
      {/* Mid-round, in the same slot the practice canvas puts its weather
          drawer: conditions change between the front and back nine, and the
          player is standing on the course when they do. */}
      <RoundWeatherPanel
        weather={weather.weather}
        onSave={weather.save}
        saving={weather.saving}
        message={weather.message}
      />

      {roundTurnPromptEnabled && frontNineComplete && !roundTurnDismissed && (
        <aside className="round-turn-prompt" aria-label="Round turn check-in">
          <strong>At the turn</strong>
          <p>Take a breath, check your pace, and reset your target for the back nine.</p>
          <button type="button" className="chip" onClick={() => setRoundTurnDismissed(true)}>Got it</button>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setRoundTurnPromptEnabled(false)
              upsertProfileFields(user.id, { round_turn_prompt_enabled: false }).catch(() => setNotice('Preference will retry when you reconnect.'))
            }}
          >Don’t show this again</button>
        </aside>
      )}
      {discsQuery.error && <p className="form-error">Disc list unavailable; scores still save without a disc.</p>}

      <ol className="scorecard-hole-list">
        {round.holes.map((hole) => {
          const row = rowFor(hole)
          return (
            <li key={hole.id} className="scorecard-hole">
              <div className="scorecard-hole-meta">
                <div>
                  <strong>Hole {hole.hole_number}</strong>
                  <span>
                    Par {hole.par} · {hole.distance_feet ? `${hole.distance_feet} ft` : 'distance —'}
                  </span>
                </div>
                <label>
                  Score
                  <input
                    className="scorecard-input"
                    type="number"
                    min="1"
                    max="20"
                    inputMode="numeric"
                    value={row?.score ?? ''}
                    onChange={(event) => updateLocal(hole, { score: event.target.value === '' ? null : Number(event.target.value) })}
                    onBlur={(event) => persist(hole, { score: event.target.value })}
                    aria-label={`Score for hole ${hole.hole_number}`}
                  />
                </label>
              </div>

              <label>
                Disc (optional)
                <select
                  value={row?.disc_id ?? ''}
                  onChange={(event) => persist(hole, { disc_id: event.target.value || null })}
                >
                  <option value="">No disc selected</option>
                  {discs.map((disc) => (
                    <option key={disc.id} value={disc.id}>
                      {discLabel(disc)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Notes (optional)
                <textarea
                  rows="2"
                  value={row?.notes ?? ''}
                  onChange={(event) => updateLocal(hole, { notes: event.target.value })}
                  onBlur={(event) => persist(hole, { notes: event.target.value || null })}
                />
              </label>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
