import { stackPips } from '../../lib/scoringCanvas'

// Blueprint's "geometric array representing remaining discs in the physical
// stack" — diamonds mark the pressure-putt slot, circles mark standard putts.
// Purely derived from stackPips(); see that function's comment for how
// gesture vs. batch-filled attempts are distinguished.
export default function StackTracker({ volumePlanned, events, attemptsTotal, hasPressureLast = false }) {
  const pips = stackPips(volumePlanned, events, attemptsTotal, hasPressureLast)

  return (
    <div className="stack-tracker" role="img" aria-label={`${attemptsTotal} of ${volumePlanned} putts logged`}>
      {pips.map((pip, i) => (
        <span key={i} className={`stack-pip stack-pip-${pip.state}`}>
          {pip.bonus ? '◆' : '●'}
        </span>
      ))}
    </div>
  )
}
