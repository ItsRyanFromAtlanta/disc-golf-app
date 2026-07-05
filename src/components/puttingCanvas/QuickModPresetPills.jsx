// Presets from profileDefaults.quickModPresets — pre-adjusts the suggested
// session (e.g. "shorter session", "focus C2") before starting. Renders
// nothing if the user hasn't saved any yet.
export default function QuickModPresetPills({ presets, onSelect }) {
  if (!presets || presets.length === 0) return null

  return (
    <div className="chip-row">
      {presets.map((preset) => (
        <button key={preset.label} type="button" className="chip" onClick={() => onSelect(preset)}>
          {preset.label}
        </button>
      ))}
    </div>
  )
}
