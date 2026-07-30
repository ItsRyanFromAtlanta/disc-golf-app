import { BAG_VERIFICATION_STATUSES } from '../roundBagVerification'

// How much of a round history has a bag snapshot that can actually be trusted.
//
// A per-round verification answers one question; this answers the one that
// decides whether any bag-versus-scoring analysis is worth building. If eleven
// of twelve rounds cannot establish which discs were carried, a "you score
// better with the tournament bag" claim is measuring the one round that can.
//
// Two properties it deliberately has:
//
//   * `unknown` rounds — the ones whose version history could not be read — are
//     counted separately and are NOT folded into "unverified". A network
//     failure is not a fact about a bag, and pooling the two would let a bad
//     connection look like bad record-keeping. It also means coverage improves
//     on its own once the reads succeed, rather than being permanently poisoned
//     by a single offline session.
//   * `coverage` is `null` for an empty history rather than 0. Zero rounds is
//     the absence of coverage information, not zero coverage — the same rule
//     `roundVolumeLedger` follows for scoring coverage.
export function bagSnapshotLedger(verifications = []) {
  const byStatus = {}
  for (const status of Object.values(BAG_VERIFICATION_STATUSES)) byStatus[status] = 0

  let considered = 0
  for (const verification of verifications) {
    const status = verification?.status
    if (!(status in byStatus)) continue
    byStatus[status] += 1
    // A round with no bag is not a gap in the record — nothing was claimed, so
    // there is nothing to verify. Counting it against coverage would penalise
    // a player for not selecting a bag they did not carry.
    if (status !== BAG_VERIFICATION_STATUSES.NO_BAG_RECORDED) considered += 1
  }

  const verified = byStatus[BAG_VERIFICATION_STATUSES.VERIFIED]
  const unknown = byStatus[BAG_VERIFICATION_STATUSES.UNKNOWN]
  const checked = considered - unknown

  return {
    rounds: verifications.length,
    byStatus,
    verified,
    // Everything that was checked and did not come back clean, whatever the
    // reason. Named for what it means to a reader rather than for the statuses
    // it happens to sum.
    unverifiable: checked - verified,
    unknown,
    withoutBag: byStatus[BAG_VERIFICATION_STATUSES.NO_BAG_RECORDED],
    // Of the rounds that claimed a bag AND could be checked, the share whose
    // snapshot holds up.
    coverage: checked > 0 ? verified / checked : null,
  }
}
