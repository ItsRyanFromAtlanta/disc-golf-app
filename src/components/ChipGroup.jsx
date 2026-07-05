// Shared zero-typing primitive: a horizontal row of tappable chips, used for
// both single-select (filters, pickers) and multi-select (tags) — the caller
// decides which via `isActive`. Extracted from five near-identical inline
// implementations (history/status filters, tag toggles, putter/preset
// pickers) that had all converged on the same chip-row/chip/chip-active
// markup independently.
export default function ChipGroup({ options, isActive = () => false, onSelect, getKey = (o) => o, getLabel = (o) => o }) {
  return (
    <div className="chip-row">
      {options.map((option) => (
        <button
          key={getKey(option)}
          type="button"
          className={`chip ${isActive(option) ? 'chip-active' : ''}`}
          onClick={() => onSelect(option)}
        >
          {getLabel(option)}
        </button>
      ))}
    </div>
  )
}
