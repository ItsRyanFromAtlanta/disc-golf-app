const SESSION_FACTORS = ['indoor', 'outdoor', 'tired', 'new-putter', 'pre-tournament', 'experimenting']

export default function SessionContextSummary({ factors = [], effort, editable = false, onChange }) {
  if (!editable && !factors.length && effort == null) return null
  return (
    <section className="session-context-summary">
      <h2>Session context</h2>
      {editable ? (
        <>
          <div className="factor-chip-row">
            {SESSION_FACTORS.map((factor) => (
              <button
                key={factor}
                type="button"
                className={`chip ${factors.includes(factor) ? 'chip-active' : ''}`}
                onClick={() => onChange({ factors: factors.includes(factor) ? factors.filter((v) => v !== factor) : [...factors, factor], effort })}
              >{factor}</button>
            ))}
          </div>
          <label>Perceived effort (optional)
            <input type="range" min="1" max="10" value={effort ?? 5} onChange={(event) => onChange({ factors, effort: Number(event.target.value) })} />
            <span>{effort ?? 'Not recorded'}</span>
          </label>
        </>
      ) : (
        <p>{factors.join(' · ') || 'No factors'}{effort != null ? ` · Effort ${effort}/10` : ''}</p>
      )}
    </section>
  )
}
