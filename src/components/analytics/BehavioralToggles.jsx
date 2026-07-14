import { UNIT_OPTIONS, STACK_SIZE_MIN, STACK_SIZE_MAX } from '../../lib/appSettings'

// Behavioral toggles (Screen 10): display units, default batch-ribbon stack
// size, and a global haptics switch. Controlled by the parent, which owns the
// persisted appSettings; each change fires onChange with a partial patch.
export default function BehavioralToggles({ settings, onChange }) {
  return (
    <section className="settings-card behavioral-toggles">
      <h2>Preferences</h2>

      <div className="setting-row">
        <div className="setting-label">
          <span>Units</span>
          <small>Distance display (app is feet-native)</small>
        </div>
        <div className="chip-row" role="group" aria-label="Units">
          {UNIT_OPTIONS.map((unit) => (
            <button
              key={unit}
              type="button"
              className={`chip ${settings.units === unit ? 'chip-active' : ''}`}
              aria-pressed={settings.units === unit}
              onClick={() => onChange({ units: unit })}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>Default stack size</span>
          <small>Putts per batch-ribbon distance</small>
        </div>
        <input
          type="number"
          className="setting-number"
          min={STACK_SIZE_MIN}
          max={STACK_SIZE_MAX}
          value={settings.defaultStackSize}
          onChange={(e) => onChange({ defaultStackSize: Number(e.target.value) })}
          aria-label="Default stack size"
        />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>Haptics</span>
          <small>Vibration on make/miss (supported devices)</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.hapticsEnabled}
          className={`switch ${settings.hapticsEnabled ? 'switch-on' : ''}`}
          onClick={() => onChange({ hapticsEnabled: !settings.hapticsEnabled })}
        >
          <span className="switch-knob" />
        </button>
      </div>
    </section>
  )
}
