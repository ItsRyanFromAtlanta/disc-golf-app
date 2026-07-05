// Static grid for stages with <=10 remaining attempts — one tap picks how
// many of the remaining attempts were makes (complementary auto-fill: misses
// = remaining - makes, never asked for separately).
export default function BatchGrid({ volumePlanned, onComplete }) {
  const values = Array.from({ length: volumePlanned + 1 }, (_, i) => i)

  return (
    <div className="batch-grid">
      <span className="editor-label">How many of the remaining {volumePlanned} did you make?</span>
      <div className="batch-grid-cells">
        {values.map((n) => (
          <button key={n} type="button" className="batch-grid-cell" onClick={() => onComplete(n, volumePlanned)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
