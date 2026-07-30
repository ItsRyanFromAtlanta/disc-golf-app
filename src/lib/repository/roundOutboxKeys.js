// The round outbox's table names and dependency key, in a leaf module so that
// `roundRepository.js` and `roundPlayerRepository.js` can both use them without
// importing each other.
//
// They were inline in `roundRepository.js` until the round-player roster became
// a second queued child of a round. Moving them rather than duplicating the
// `round-outbox:` prefix is the point: that prefix is load-bearing (see
// `roundCreateKey`), and a second spelling of it would silently decouple a
// child from the create it must wait for.

export const ROUND_TABLE = 'rounds'
export const ROUND_HOLE_TABLE = 'round_holes'
export const ROUND_PLAYER_TABLE = 'round_players'

// The round parent has to exist remotely before its scorecard children, its
// roster or any later update can land, so queued children carry the create's
// idempotency key as their `dependencyKey` (`PHASE_A_ARCHITECTURE.md` § 8).
// Without it a replay while the create is still queued hits a foreign-key
// violation, which classifies as permanent and would poison a child that was
// never actually broken.
//
// Deliberately namespaced away from `round:${id}:create`, which is already the
// *activity lifecycle* mutation key for the same round. Reusing that string
// would make the history-recovery queue — which resolves dependencies against
// every queued row, not just its own — treat a pending round row as the
// lifecycle row it is waiting on.
export function roundCreateKey(roundId) {
  return `round-outbox:${roundId}:create`
}
