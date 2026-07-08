// Layer 5 stub: XP/level-up events don't exist yet (gamification ledger is
// Layer 5), so this renders nothing today. Kept as a real component — not
// inline in SessionReport — so Layer 5 only has to start passing real events
// here, not build new UI for the celebration banner.
export default function CelebrationOverlay({ events }) {
  if (!events || events.length === 0) return null
  return (
    <div className="celebration-overlay">
      {events.map((e, i) => (
        <p key={i} className="celebration-banner">
          {e.message}
        </p>
      ))}
    </div>
  )
}
