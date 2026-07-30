import { useState } from 'react'
import ChipGroup from './ChipGroup'
import {
  ROUND_WEATHER_CONDITIONS,
  conditionLabel,
  describeRoundWeather,
  roundWeatherFields,
} from '../lib/roundWeather'

// Round conditions, edited the same way practice conditions already are.
//
// The interaction is deliberately the mid-session weather drawer from
// `puttingCanvas/CanvasToolbar.jsx`: a chip showing the current reading, which
// opens the same five-option `ChipGroup` and the same wind field that only
// appears once a direction is chosen. A player who has set the weather during a
// putting session should not have to learn a second control here.
//
// Two things differ, both because a round is not a putting session:
//
//   * Practice holds weather in component state and writes it once, at session
//     end. A round has no such moment — it spans hours, is finished on a
//     different screen, and is often corrected the next morning. So this panel
//     saves explicitly, on a button, rather than on every keystroke: a round
//     write goes through the outbox, and one queued entry per character typed
//     into the notes field would be indefensible on a bad connection.
//   * `weather_summary` is offered as a free-text note. That column predates
//     the structured pair by the whole of J1 and stays exactly what it was —
//     the place for "gusting hard after the turn", which no vocabulary of five
//     values will ever capture.
export default function RoundWeatherPanel({ weather, onSave, saving = false, message = null }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(weather)

  const description = describeRoundWeather(weather)

  function openEditor() {
    // Reseed from the saved round every time, so an abandoned edit does not
    // linger and reappear as though it had been saved.
    setDraft(weather)
    setOpen(true)
  }

  async function save() {
    await onSave(roundWeatherFields(draft))
    setOpen(false)
  }

  return (
    <section className="round-weather" aria-label="Round conditions">
      <div className="round-weather-row">
        <span className="round-weather-reading">
          🌬️ {description ?? 'Conditions not recorded'}
        </span>
        <button
          type="button"
          className="link-button"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openEditor())}
        >
          {open ? 'Cancel' : description ? 'Edit conditions' : 'Add conditions'}
        </button>
      </div>

      {/* A queued save is not a failure — the round is on the device and the
          outbox owns it from here — so it must not be styled as one. */}
      {message && (
        <p className={message.tone === 'error' ? 'form-error' : 'form-info'} role="status">
          {message.text}
        </p>
      )}

      {open && (
        <div className="round-weather-editor">
          <ChipGroup
            options={ROUND_WEATHER_CONDITIONS}
            isActive={(option) => draft.condition === option}
            getLabel={conditionLabel}
            // Tapping the active chip clears it: weather is optional, and
            // without this there is no way to undo a mis-tap short of saving a
            // condition the round did not have.
            onSelect={(option) =>
              setDraft((current) => ({
                ...current,
                condition: current.condition === option ? null : option,
              }))
            }
          />

          {draft.condition && draft.condition !== 'clear' && (
            <label className="round-weather-wind">
              Wind (mph)
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={draft.windMph ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    windMph: event.target.value === '' ? null : Number(event.target.value),
                  }))
                }
              />
            </label>
          )}

          <label className="round-weather-note">
            Notes (optional)
            <textarea
              rows="2"
              value={draft.summary ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
            />
          </label>

          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save conditions'}
          </button>
        </div>
      )}
    </section>
  )
}
