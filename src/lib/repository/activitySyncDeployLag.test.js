import { describe, expect, it } from 'vitest'
import { isPermanentActivitySyncError } from './activitySync'

// The regression this file exists for.
//
// D-03 added `draft -> completed` to the client transition table. Its server
// migration (`20260731001500`) is applied separately, so between a client
// reaching production and that migration landing, the deployed RPC answers
// `invalid_transition`. That message was classified permanent, which poisoned
// the outbox row — and `activitySync.flush` computes `hasPoison` across the
// whole table, so a single poisoned row reported `{ permanent: true }` forever
// and stopped InstantLaunch capture sync and history-recovery sync with it.
// Putts stayed queued locally while every screen rendered them normally.
//
// 940 unit tests were green when that shipped, because the only D-03 test
// covered the pure reducer. Nothing tested how the transition was *classified*
// when the server rejected it. That gap is what this file closes.
// Built to the shape `activityTransitionRpcArgs` actually reads: the command
// from `mutation.type`, the expected state from `stateEvent.previous_state`.
// An earlier draft of this helper invented `mutation.expectedState`, which
// passed every assertion below while the guard it was testing could never fire
// against a real outbox row.
function transitionRow(command, previousState) {
  return {
    op: 'transition',
    payload: {
      activity: { id: 'round-1', version: 2 },
      mutation: { type: command },
      stateEvent: { previous_state: previousState },
    },
  }
}

const invalidTransition = new Error('invalid_transition')

describe('deploy-lag classification for draft finalization', () => {
  it('treats the server rejecting draft -> completed as transient, so it waits instead of poisoning', () => {
    const row = transitionRow('finalize_completed', 'draft')
    expect(isPermanentActivitySyncError(invalidTransition, row)).toBe(false)
  })

  it('still poisons a genuinely illegal transition', () => {
    // A real bug must fail loudly rather than retry forever behind a backoff.
    // Only the one transition that is legal on the client and not yet on the
    // server is exempt.
    const row = transitionRow('start', 'completed')
    expect(isPermanentActivitySyncError(invalidTransition, row)).toBe(true)
  })

  it('still poisons finalize_completed from a state that was always legal', () => {
    // active -> completed has been supported by both sides since Phase A, so an
    // `invalid_transition` there means something is genuinely wrong.
    const row = transitionRow('finalize_completed', 'active')
    expect(isPermanentActivitySyncError(invalidTransition, row)).toBe(true)
  })

  it('does not exempt other lifecycle errors on the same transition', () => {
    const row = transitionRow('finalize_completed', 'draft')
    expect(isPermanentActivitySyncError(new Error('version_conflict'), row)).toBe(true)
    expect(isPermanentActivitySyncError(new Error('activity_not_found'), row)).toBe(true)
  })

  it('classifies conservatively when the row is unavailable', () => {
    expect(isPermanentActivitySyncError(invalidTransition)).toBe(true)
    expect(isPermanentActivitySyncError(invalidTransition, null)).toBe(true)
  })

  it('never exempts a create, which has no transition to be lagging', () => {
    const row = { ...transitionRow('finalize_completed', 'draft'), op: 'create_draft' }
    expect(isPermanentActivitySyncError(invalidTransition, row)).toBe(true)
  })
})
