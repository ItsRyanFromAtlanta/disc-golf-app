import { useEffect, useState } from 'react'
import { ACTIVITY_STATES } from '../activityLifecycle'
import { BAG_VERIFICATION_STATUSES, verifyRoundBag } from '../roundBagVerification'
import { activityRepository } from './activityRepository'
import { loadBagVersions } from './bagHistoryRepository'

// Gathers the evidence `verifyRoundBag` needs, and is careful about the one
// thing that separates a verification from an accusation: a read that failed
// must arrive as `null`, not as an empty list.
//
// `loadBagVersions` is already remote-first with a Dexie fallback, so it
// answers from the local mirror when the network is gone. It throws only when
// both are empty — which is exactly the "could not be established" case, and is
// caught here and turned into `versions: null` rather than `[]`.

/**
 * When did this round finish?
 *
 * There is no `rounds.finished_at`, and inventing one would have been a
 * migration in service of a read-only feature. The activity parent already
 * carries the answer: `rounds(id, user_id)` references
 * `activities(id, user_id)`, so a round's activity is stored under the round's
 * own id, and `updated_at` on a terminal activity is the moment it was
 * finalized — the last lifecycle transition it had.
 *
 * Returns `null` for a round still in progress (an open window is honest: an
 * edit "during" a live round means "since it started"), and for a round whose
 * activity is not on this device. A round created on another phone has no local
 * activity mirror, and guessing an end time from `played_at` — a client clock,
 * set at the start, on a different device — would be worse than reporting the
 * window as open.
 */
export async function roundEndedAt(roundId, userId) {
  try {
    const activity = await activityRepository.getById(roundId)
    if (!activity || (userId && activity.user_id !== userId)) return null
    const terminal = [ACTIVITY_STATES.COMPLETED, ACTIVITY_STATES.INCOMPLETE]
    return terminal.includes(activity.state) ? (activity.updated_at ?? null) : null
  } catch {
    return null
  }
}

/**
 * Verify one round's bag snapshot. Never throws, and never repairs.
 *
 * Everything that can go wrong here — offline, a deleted bag, a version the
 * mirror never saw — resolves to a status, because the caller is a panel on a
 * summary screen and an error boundary is not an answer to "which discs did I
 * have?".
 */
export async function verifyRoundBagSnapshot(round, userId) {
  if (!round?.bag_id && !round?.bag_version_id) {
    return verifyRoundBag({ round: round ?? {}, versions: [] })
  }

  let versions = null
  try {
    versions = await loadBagVersions(round.bag_id ?? null)
  } catch {
    // Deliberately left null. `verifyRoundBag` reports `unknown` for it, which
    // is a different claim from "there is no snapshot" and has to stay that
    // way — otherwise a basement turns into a permanent record of a bag that
    // was never verified.
    versions = null
  }

  return verifyRoundBag({
    round,
    versions,
    roundEndedAt: await roundEndedAt(round.id, userId),
  })
}

/**
 * Verification for a round, resolved in the background.
 *
 * `null` while it is still running, which callers render as nothing at all —
 * the panel appears when there is something true to say. It is never a blocking
 * read: a round summary must open on one bar of signal whether or not its bag
 * history is reachable.
 */
export function useRoundBagVerification(round, userId) {
  const [verification, setVerification] = useState(null)
  const roundId = round?.id ?? null
  const bagId = round?.bag_id ?? null
  const bagVersionId = round?.bag_version_id ?? null

  useEffect(() => {
    if (!roundId) {
      setVerification(null)
      return undefined
    }
    let active = true
    verifyRoundBagSnapshot(round, userId)
      .then((result) => {
        if (active) setVerification(result)
      })
      .catch(() => {
        if (active) setVerification({ status: BAG_VERIFICATION_STATUSES.UNKNOWN, verified: false })
      })
    return () => {
      active = false
    }
    // Keyed on the identifying facts rather than the round object: the summary
    // screen replaces `round` on every weather or total save, and re-running a
    // bag read for a changed note would be pure waste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, bagId, bagVersionId, userId])

  return verification
}
