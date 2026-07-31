import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_TYPES,
  LIFECYCLE_COMMANDS,
  LIFECYCLE_TRANSITION_TABLE,
  reduceActivityLifecycle,
} from '.'

// DEFECT_REGISTER D-03: a round started while another activity was current keeps
// a `draft` lifecycle parent. Before this transition existed that state was
// terminal — finalization refused it, so the parent could never reach
// `completed` and `weeklyReportRepository` (which admits only `completed`) could
// never see the round. The round row itself read `completed`, so every other
// screen showed a finished round while the weekly report silently omitted it.
const BASE_TIME = '2026-07-31T12:00:00.000Z'

function draftRound(overrides = {}) {
  return {
    id: 'round-1',
    type: ACTIVITY_TYPES.DISC_GOLF_ROUND,
    state: ACTIVITY_STATES.DRAFT,
    version: 0,
    ...overrides,
  }
}

function finalizeCommand(activity, overrides = {}) {
  return {
    type: LIFECYCLE_COMMANDS.FINALIZE_COMPLETED,
    expectedState: activity.state,
    expectedVersion: activity.version,
    occurredAt: BASE_TIME,
    recordedAt: BASE_TIME,
    source: ACTIVITY_SOURCES.MANUAL_ENTRY,
    installationId: 'installation-1',
    idempotencyKey: 'round:round-1:finalize',
    reason: ACTIVITY_STATE_REASONS.USER_FINALIZE,
    ...overrides,
  }
}

describe('finalizing a draft activity (D-03)', () => {
  it('moves a draft straight to completed', () => {
    const activity = draftRound()
    const result = reduceActivityLifecycle(activity, finalizeCommand(activity))

    expect(result.activity.state).toBe(ACTIVITY_STATES.COMPLETED)
    expect(result.stateEvent.previousState).toBe(ACTIVITY_STATES.DRAFT)
    expect(result.stateEvent.newState).toBe(ACTIVITY_STATES.COMPLETED)
  })

  it('never passes through active, which is what makes it safe', () => {
    // This is the whole point of the fix rather than an incidental property.
    // `start` is the command the replacement flow hangs off: starting a draft
    // marks any other active/paused activity `incomplete`. Routing finalization
    // through `active` would therefore close whatever the player currently has
    // live. Going straight to `completed` never enters the states
    // `activities_one_current_per_user_idx` constrains, so it cannot replace
    // anything.
    const activity = draftRound()
    const result = reduceActivityLifecycle(activity, finalizeCommand(activity))

    expect(result.stateEvent.newState).not.toBe(ACTIVITY_STATES.ACTIVE)
    expect(result.replacedActivity ?? null).toBeNull()
  })

  it('leaves draft -> start reaching active, so the replacement path is unchanged', () => {
    expect(LIFECYCLE_TRANSITION_TABLE[ACTIVITY_STATES.DRAFT][LIFECYCLE_COMMANDS.START]).toBe(
      ACTIVITY_STATES.ACTIVE,
    )
  })

  it('still refuses a draft command that was never legal', () => {
    const activity = draftRound()
    expect(
      LIFECYCLE_TRANSITION_TABLE[ACTIVITY_STATES.DRAFT][LIFECYCLE_COMMANDS.PAUSE],
    ).toBeUndefined()
    expect(() =>
      reduceActivityLifecycle(activity, finalizeCommand(activity, { type: LIFECYCLE_COMMANDS.PAUSE })),
    ).toThrow()
  })
})
