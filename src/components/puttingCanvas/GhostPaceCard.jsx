function signedCount(value, noun) {
  if (value == null) return `No same-attempt ${noun}`
  if (value === 0) return `Even ${noun}`
  return `${Math.abs(value)} ${noun} ${value > 0 ? 'ahead' : 'behind'}`
}

function timeLabel(value) {
  if (value == null) return 'No same-attempt time'
  if (Math.abs(value) < 500) return 'Even time'
  return `${Math.round(Math.abs(value) / 1000)}s ${value < 0 ? 'ahead' : 'behind'}`
}

export default function GhostPaceCard({ profile, comparison }) {
  if (!profile) return null
  return <aside className="ghost-pace-card" aria-live="polite">
    <header><strong>Best-run ghost</strong><span>{profile.sourceScore} pts · {profile.eventCount} timed putts</span></header>
    {!comparison?.ready ? <p>{comparison?.attemptsNeeded ?? 3} more real-time attempt{comparison?.attemptsNeeded === 1 ? '' : 's'} to compare.</p> : <div className="ghost-pace-metrics">
      <span><strong>{signedCount(comparison.attemptDelta, 'putts')}</strong><small>At this elapsed time</small></span>
      <span><strong>{timeLabel(comparison.timeDeltaMs)}</strong><small>At attempt {comparison.currentAttempts}</small></span>
      <span><strong>{signedCount(comparison.makeDelta, 'makes')}</strong><small>Same attempt count</small></span>
    </div>}
    <small>Real-time capture only · batch totals do not receive invented timing.</small>
  </aside>
}
