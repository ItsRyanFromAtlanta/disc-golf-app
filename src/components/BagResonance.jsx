import { useMemo, useState } from 'react'
import { buildBagResonance, RESONANCE_PRESETS } from '../lib/bagResonance'

const PRESET_LIST = Object.values(RESONANCE_PRESETS)
const COMPONENT_LABELS = [
  ['coverage', 'Flight coverage'],
  ['speedLadder', 'Speed ladder'],
  ['separation', 'Disc separation'],
]

export default function BagResonance({ discs = [], ghostSlots = [], capacity = 35 }) {
  const [presetId, setPresetId] = useState('balanced')
  const resonance = useMemo(
    () => buildBagResonance(discs, ghostSlots, presetId, capacity),
    [discs, ghostSlots, presetId, capacity],
  )

  return (
    <section className="bag-resonance" aria-labelledby="bag-resonance-title">
      <div className="bag-resonance-heading">
        <div>
          <h2 id="bag-resonance-title">Bag Resonance</h2>
          <p className="log-time">A transparent flight-balance snapshot</p>
        </div>
        <strong className="bag-resonance-score" aria-label={`Resonance score ${resonance.overall} out of 100`}>
          {resonance.overall}<span>/100</span>
        </strong>
      </div>

      <div className="bag-resonance-presets" role="group" aria-label="Resonance preset">
        {PRESET_LIST.map((preset) => (
          <button key={preset.id} type="button" aria-pressed={presetId === preset.id}
            onClick={() => setPresetId(preset.id)}>{preset.label}</button>
        ))}
      </div>

      <div className="bag-resonance-components">
        {COMPONENT_LABELS.map(([key, label]) => (
          <div key={key} className="bag-resonance-component">
            <div><span>{label}</span><strong>{resonance.components[key]}</strong></div>
            <div className="bag-resonance-track" aria-hidden="true">
              <div style={{ width: `${resonance.components[key]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="log-time">
        {resonance.components.validDiscCount} complete flight profile(s) · {resonance.components.missingDiscCount} missing data · {resonance.discCount}/{resonance.capacity} physical discs
      </p>
      {resonance.components.overlapPairs > 0 && (
        <p className="form-error">{resonance.components.overlapPairs} near-duplicate flight pair(s) reduce separation.</p>
      )}
      {resonance.activeGapCount > 0 ? (
        <p className="bag-resonance-gaps">
          Desired gaps: {resonance.ghostGapLabels.join(', ')}. Ghost gaps are targets only and do not use capacity.
        </p>
      ) : (
        <p className="log-time">No persisted desired flight gaps.</p>
      )}
      <p className="log-time">
        Weights: {Math.round(resonance.preset.coverage * 100)}% coverage · {Math.round(resonance.preset.speedLadder * 100)}% speed ladder · {Math.round(resonance.preset.separation * 100)}% separation
      </p>
    </section>
  )
}
