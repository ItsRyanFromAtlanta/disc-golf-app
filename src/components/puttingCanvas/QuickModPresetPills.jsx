import ChipGroup from '../ChipGroup'

// Presets from profileDefaults.quickModPresets — pre-adjusts the suggested
// session (e.g. "shorter session", "focus C2") before starting. Renders
// nothing if the user hasn't saved any yet.
export default function QuickModPresetPills({ presets, onSelect }) {
  if (!presets || presets.length === 0) return null

  return (
    <ChipGroup options={presets} getKey={(preset) => preset.label} getLabel={(preset) => preset.label} onSelect={onSelect} />
  )
}
