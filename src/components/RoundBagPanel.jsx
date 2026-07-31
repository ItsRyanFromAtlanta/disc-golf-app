import { BAG_VERIFICATION_STATUSES, describeBagVerification } from '../lib/roundBagVerification'

// The bag a round was played with, and whether that can be established.
//
// The design decision worth stating: an unverifiable snapshot is not an error
// and is not styled as one. Most of the reasons a bag cannot be confirmed are
// ordinary — the round predates snapshotting, the phone was offline, the bag
// was genuinely edited between rounds — and none of them are the player's
// mistake. Rendering them in the error treatment would train people to ignore
// the one case that does matter.
//
// So there are exactly two tones: confirmed, and everything else stated plainly
// with its reason. What there is never is a claim: the panel does not say "you
// probably carried these" for a snapshot it could not resolve, and it offers no
// button to attach a plausible version to a round that lacks one. Correcting
// history is not a read screen's job, and this project's rule is that
// corrections preserve previous and new values rather than overwriting.

const VERIFIED = BAG_VERIFICATION_STATUSES.VERIFIED

export default function RoundBagPanel({ verification }) {
  // Nothing until the background read resolves. A skeleton would imply the
  // answer is imminent, and on a bad connection it is not.
  if (!verification) return null

  const { headline, detail } = describeBagVerification(verification)
  const confirmed = verification.status === VERIFIED
  const drift = verification.driftFromCurrent
  // The snapshot's own `name` is preferred over any current bag name: it is the
  // bag as it was called at the time, which is the honest label for a round
  // played before it was renamed. When no snapshot resolves, the fallback
  // distinguishes "a bag was recorded, we just cannot name it" from "no bag was
  // recorded", which are different facts.
  //
  // There used to be a second fallback here, a `bagName` prop, between these
  // two. It read `round.bag?.name` at the one call site — `RoundSummaryPage` —
  // but `fetchRound` (`src/lib/roundLog.js`) never hydrates a `bag` relation on
  // a round, only `bag_id`/`bag_version_id`, so that prop was always `null` and
  // this branch could never fire. Removed rather than fixed: `versionName`
  // already covers every status that resolves a snapshot, and inventing a
  // "current bag name" fallback for the statuses that do not would contradict
  // the paragraph above it — a round's bag name is what the snapshot said, not
  // whatever the bag happens to be called today.
  const label = verification.versionName ?? (verification.bagId ? 'Bag recorded' : 'No bag recorded')

  return (
    <section className="round-bag" aria-label="Bag used">
      <div className="round-bag-row">
        <span className="round-bag-name">
          🎒 {label}
          {verification.versionNumber != null && (
            <small> · snapshot v{verification.versionNumber}</small>
          )}
        </span>
        <span className={`history-sync-badge ${confirmed ? '' : 'history-sync-attention'}`}>{headline}</span>
      </div>

      <p className="log-time">{detail}</p>

      {/* Context, not a fault. A player reading a six-month-old round wants to
          know how far their bag has moved since; a bag that has changed a lot
          says nothing bad about the round's record. */}
      {confirmed && drift && (drift.added.length > 0 || drift.removed.length > 0) && (
        <p className="log-time">
          Your bag has changed since: {drift.added.length} added, {drift.removed.length} removed.
        </p>
      )}
    </section>
  )
}
