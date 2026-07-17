import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EXPERIMENT_MIN_SIDE_ATTEMPTS, WILSON_MIN_N_FOR_HIDING } from '../lib/insights'

const pct = (value) => `${Math.round(value * 100)}%`
const delta = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pts`

function discLabel(disc) {
  if (!disc) return 'Unknown physical disc'
  return disc.nickname ? `${disc.nickname} · ${disc.mold || 'Unnamed mold'}` : disc.mold || 'Unnamed mold'
}

function localDateTimeValue() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return date.toISOString().slice(0, 16)
}

export default function ExperimentMarkerPanel({ userId, discs = [], experiments = [], onCreated }) {
  const putters = useMemo(() => discs.filter((disc) => !disc.status || !['lost', 'retired', 'sold'].includes(disc.status)), [discs])
  const [discId, setDiscId] = useState(putters[0]?.id ?? '')
  const [effectiveAt, setEffectiveAt] = useState(localDateTimeValue)
  const [label, setLabel] = useState('New putter')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function createMarker(event) {
    event.preventDefault()
    if (!discId || !effectiveAt) return
    setSaving(true)
    setError(null)
    const marker = {
      id: crypto.randomUUID(), user_id: userId, disc_id: discId, marker_type: 'new_putter',
      effective_at: new Date(effectiveAt).toISOString(), label: label.trim() || 'New putter',
      notes: notes.trim() || null, idempotency_key: crypto.randomUUID(),
    }
    const { error: insertError } = await supabase.from('practice_experiment_markers').insert(marker)
    if (insertError) setError(insertError.message)
    else { setLabel('New putter'); setNotes(''); onCreated?.() }
    setSaving(false)
  }

  return <section className="experiment-marker-panel" aria-labelledby="experiment-marker-title">
    <h2 id="experiment-marker-title">New-putter experiments</h2>
    <p className="confidence-map-intro">Mark when a physical putter enters rotation. The comparison uses attributed attempts before the marker and that disc’s attempts until the next marker.</p>
    <form className="experiment-marker-form" onSubmit={createMarker}>
      <label>Physical putter<select value={discId} onChange={(event) => setDiscId(event.target.value)} required>
        <option value="">Select a disc</option>
        {putters.map((disc) => <option value={disc.id} key={disc.id}>{discLabel(disc)}</option>)}
      </select></label>
      <label>Started using it<input type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} required /></label>
      <label>Marker label<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} /></label>
      <label>Notes <span className="field-optional">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={2} /></label>
      <button className="save-button" type="submit" disabled={saving || !putters.some((disc) => disc.id === discId)}>{saving ? 'Saving…' : 'Save experiment marker'}</button>
      {error && <p className="form-error">{error}</p>}
    </form>
    <div className="experiment-list">
      {experiments.length === 0 ? <p className="career-note">No experiment markers yet.</p> : experiments.map((experiment) => <article className="experiment-card" key={experiment.markerId}>
        <header><div><h3>{experiment.label}</h3><span>{discLabel(experiment.disc)} · {new Date(experiment.effectiveAt).toLocaleDateString()}</span></div>{experiment.ready && <span className="status-chip">Evidence ready</span>}</header>
        {experiment.ready ? <div className="experiment-result"><div><strong>{pct(experiment.before.pct)}</strong><span>Before · {experiment.before.attempts} attempts</span></div><div><strong>{pct(experiment.after.pct)}</strong><span>After · {experiment.after.attempts} attempts</span></div><div><strong>{delta(experiment.delta)}</strong><span>Change</span></div></div> : <p className="career-note">Needs {EXPERIMENT_MIN_SIDE_ATTEMPTS} attributed attempts before and after this marker.</p>}
        {(experiment.before.attempts < WILSON_MIN_N_FOR_HIDING || experiment.after.attempts < WILSON_MIN_N_FOR_HIDING) && <small className="confidence-band-caveat">Small-sample intervals remain visible: before {experiment.before.interval ? `${pct(experiment.before.interval.lower)}–${pct(experiment.before.interval.upper)}` : '—'}, after {experiment.after.interval ? `${pct(experiment.after.interval.lower)}–${pct(experiment.after.interval.upper)}` : '—'}.</small>}
        {experiment.notes && <p className="experiment-notes">{experiment.notes}</p>}
      </article>)}
    </div>
  </section>
}
