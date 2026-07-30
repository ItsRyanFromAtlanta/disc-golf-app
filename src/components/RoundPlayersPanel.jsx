import { useState } from 'react'
import { formatRelativeToPar } from '../lib/rounds'
import { ROUND_PLAYER_LIMIT, describeRoster, isRosterFull, nextAvailablePosition } from '../lib/roundPlayers'
import { describeGroupScorecard, groupScorecard } from '../lib/insights/groupScorecard'

// Who else was on the card.
//
// This is the whole user-facing surface of the group-scorecard groundwork, and
// what it is NOT is the design:
//
//   * It never leaves this account. A companion is a private label the round's
//     owner wrote; there is no invitation, no link, no share, and no way for
//     the person named here to see, confirm or contest it. That is deliberate —
//     the moment a name here reaches another account it needs the consent,
//     identity and moderation design that `PRODUCT_ROADMAP.md` parks behind the
//     Social revisit trigger.
//   * It never ranks. Seats are shown in the order they were recorded, with the
//     owner first because it is their round. No sort by score, no gap, no
//     winner: head-to-head is `FEATURE_BACKLOG.md`'s LATER (deliberate) row and
//     one sort call is the entire distance between this panel and that feature.
//   * Every companion total is labelled as stated, for the same reason
//     `RoundSummaryPage` labels the owner's — a number typed about somebody
//     else's round from memory must never look like a scorecard.
//
// The panel is on the summary rather than the scorecard, alongside the bag, for
// the reason that panel gives: who you played with is a question asked after
// the round, not while standing over a putt.

const SOURCE_NOTES = {
  scorecard: 'From the scorecard',
  stated: 'Entered by you',
  stated_vs_par: 'Entered total vs layout par',
}

export default function RoundPlayersPanel({
  round,
  players,
  available = true,
  onSave,
  onRemove,
  saving = false,
  message = null,
}) {
  const [open, setOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [totalDraft, setTotalDraft] = useState('')

  // Nothing until the background read settles. A skeleton would promise an
  // answer that, on one bar of signal, is not coming.
  if (players == null) return null

  // The migration is not applied. Saying so plainly beats offering an editor
  // whose writes would sit in the outbox until a deploy the player has no
  // visibility into — the AGENTS.md degrade-on-missing rule, applied to a table.
  if (!available) {
    return (
      <section className="round-players" aria-label="Playing partners">
        <p className="log-time">Recording who else played is not available on this deployment yet.</p>
      </section>
    )
  }

  const card = groupScorecard({ round: round ?? {}, players })
  // Names in the heading, coverage underneath. Who you played with is the fact
  // a player is looking for; how many totals were filled in is context for the
  // numbers below it, and putting the count first would make the panel read as
  // a results table.
  const description = describeRoster(players)
  const coverage = describeGroupScorecard(card)
  const full = isRosterFull(players)

  async function submit(event) {
    event.preventDefault()
    const position = nextAvailablePosition(players)
    if (position == null) return
    await onSave({ position, displayName: nameDraft, totalScore: totalDraft })
    setNameDraft('')
    setTotalDraft('')
    setOpen(false)
  }

  return (
    <section className="round-players" aria-label="Playing partners">
      <div className="round-players-row">
        <span className="round-players-heading">
          👥 {description ?? 'No playing partners recorded'}
        </span>
        <button
          type="button"
          className="link-button"
          aria-expanded={open}
          disabled={full}
          onClick={() => setOpen((current) => !current)}
        >
          {full ? `Card full (${ROUND_PLAYER_LIMIT} max)` : open ? 'Cancel' : 'Add player'}
        </button>
      </div>

      {/* A queued save is not a failure — the roster is on the device and the
          outbox owns it from here — so it must not be styled as one. */}
      {message && (
        <p className={message.tone === 'error' ? 'form-error' : 'form-info'} role="status">
          {message.text}
        </p>
      )}

      {coverage && <p className="log-time">{coverage}</p>}

      {card.isGroupRound && (
        <ol className="round-players-list">
          {card.entries.map((entry) => (
            <li key={`${entry.kind}-${entry.position}`} className="round-players-entry">
              <strong>{entry.name}</strong>
              <span>
                {entry.total ?? '—'}
                {entry.relativeToPar != null && ` (${formatRelativeToPar(entry.relativeToPar)})`}
              </span>
              {entry.totalSource && <small>{SOURCE_NOTES[entry.totalSource]}</small>}
              {entry.kind === 'companion' && (
                <button type="button" className="link-button" onClick={() => onRemove(entry.position)} disabled={saving}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {open && !full && (
        <form className="round-players-editor" onSubmit={submit}>
          <label>
            Name
            <input
              type="text"
              value={nameDraft}
              maxLength={60}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </label>
          <label>
            Their total (optional)
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={totalDraft}
              onChange={(event) => setTotalDraft(event.target.value)}
            />
          </label>
          {/* Stated up front rather than buried in a settings screen. Somebody
              typing another person's name into an app deserves to know where it
              goes, and the honest answer here is "nowhere". */}
          <p className="log-time">
            Private to your account. Nothing is shared with the people you name, and none of this
            reaches community data.
          </p>
          <button type="submit" className="btn-primary" disabled={saving || !nameDraft.trim()}>
            {saving ? 'Saving…' : 'Add to card'}
          </button>
        </form>
      )}
    </section>
  )
}
