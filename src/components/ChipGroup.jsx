// Shared zero-typing primitive: a horizontal row of tappable chips, used for
// both single-select (filters, pickers) and multi-select (tags) — the caller
// decides which via `isActive`. Extracted from five near-identical inline
// implementations (history/status filters, tag toggles, putter/preset
// pickers) that had all converged on the same chip-row/chip/chip-active
// markup independently.
//
// Selection is announced with `aria-pressed` — every chip is a real <button>
// that flips its own state in place, which is the ARIA toggle-button pattern.
// `role="radio"`/`aria-checked` was rejected even for the single-select callers
// (tabs, filters, unit pickers): a radiogroup owes the user roving tabindex and
// arrow-key traversal, and claiming the role without them is worse for a screen
// reader than an honest row of toggle buttons. Callers that pass no `isActive`
// (e.g. QuickModPresetPills) are firing actions, not toggling state, so they
// get no `aria-pressed` at all rather than a permanent "not pressed".
export default function ChipGroup({ options, isActive, onSelect, getKey = (o) => o, getLabel = (o) => o }) {
  return (
    <div className="chip-row">
      {options.map((option) => {
        const active = isActive ? Boolean(isActive(option)) : null
        return (
          <button
            key={getKey(option)}
            type="button"
            className={`chip ${active ? 'chip-active' : ''}`}
            aria-pressed={active ?? undefined}
            onClick={() => onSelect(option)}
          >
            {getLabel(option)}
          </button>
        )
      })}
    </div>
  )
}
