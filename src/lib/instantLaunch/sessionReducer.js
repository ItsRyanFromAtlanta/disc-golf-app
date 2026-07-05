import { GESTURE_CONFIG } from '../gestureEngine/config'

// The live, in-memory state of the CURRENT stage while the canvas is open —
// distinct from stateReducer.js, which manages the persisted cross-session
// blob. A snapshot of this gets written into crashRecoveryBuffer.currentStage
// periodically (by the caller) for crash recovery; it is not itself persisted
// directly.
//
// stage: { label, distanceFt, volumePlanned, historicalAvgMakePct }
export function initialSessionState(stage) {
  return {
    stage,
    events: [], // real gesture-captured events only, per the data-split rule (see putt_events_schema.sql)
    consecutiveMakes: 0,
    longestStreak: 0, // longest gesture-derived streak this stage — batch-ribbon fills have no per-putt
    // order, so they never extend this; see the write-adapter's pressure/streak inference for the
    // documented tradeoff this implies for mixed gesture+batch stages.
    tally: { makes: 0, attempts: 0 }, // full stage tally, including batch-ribbon fills
    nextSequence: 1,
  }
}

export function makeTerritoryPct(consecutiveMakes, config = GESTURE_CONFIG) {
  return Math.min(config.ZONE_GROWTH_CAP_PCT, consecutiveMakes * config.ZONE_GROWTH_PER_MAKE_PCT)
}

// Actions: GESTURE_MAKE{id, occurredAt}, GESTURE_MISS{id, occurredAt, missZone},
// UNDO, BATCH_COMPLETE{makes, attempts}.
//
// Moving to the next stage (or ending the session) is not a case here — each
// stage starts from a fresh initialSessionState(nextStage) call by whoever
// owns this reducer; there's no partial carryover between stages to model.
export function sessionReducer(state, action) {
  switch (action.type) {
    case 'GESTURE_MAKE': {
      // consecutiveMakesBefore lets UNDO restore the exact pre-event streak
      // (not just "subtract one"), which matters when undoing a MISS: a miss
      // resets the streak to 0 with no way back to what it was unless each
      // event remembers it. Client-side bookkeeping only — never sent to
      // Supabase (see the putt_events insert payload builder).
      const event = {
        id: action.id,
        outcome: 'make',
        missZone: null,
        sequence: state.nextSequence,
        occurredAt: action.occurredAt,
        consecutiveMakesBefore: state.consecutiveMakes,
        longestStreakBefore: state.longestStreak,
      }
      const consecutiveMakes = state.consecutiveMakes + 1
      return {
        ...state,
        events: [...state.events, event],
        consecutiveMakes,
        longestStreak: Math.max(state.longestStreak, consecutiveMakes),
        tally: { makes: state.tally.makes + 1, attempts: state.tally.attempts + 1 },
        nextSequence: state.nextSequence + 1,
      }
    }

    case 'GESTURE_MISS': {
      const event = {
        id: action.id,
        outcome: 'miss',
        missZone: action.missZone ?? null,
        sequence: state.nextSequence,
        occurredAt: action.occurredAt,
        consecutiveMakesBefore: state.consecutiveMakes,
        longestStreakBefore: state.longestStreak,
      }
      return {
        ...state,
        events: [...state.events, event],
        consecutiveMakes: 0,
        tally: { makes: state.tally.makes, attempts: state.tally.attempts + 1 },
        nextSequence: state.nextSequence + 1,
      }
    }

    // Scoped to the current, not-yet-finalized stage — undoes the most
    // recent GESTURE event only (batch-ribbon fills have their own
    // correction UX, not this gate). No-ops if there's nothing to undo.
    // Restores consecutiveMakes to its pre-event value (see
    // consecutiveMakesBefore above), so undoing a wrongly-registered miss
    // correctly resumes the streak it broke, not just "streak minus one".
    case 'UNDO': {
      const last = state.events[state.events.length - 1]
      if (!last) return state
      const wasMake = last.outcome === 'make'
      return {
        ...state,
        events: state.events.slice(0, -1),
        consecutiveMakes: last.consecutiveMakesBefore,
        longestStreak: last.longestStreakBefore,
        tally: { makes: state.tally.makes - (wasMake ? 1 : 0), attempts: state.tally.attempts - 1 },
      }
    }

    // Batch-ribbon entry: summary-only per the data-split rule — contributes
    // to the tally but never to `events`/`consecutiveMakes` (no synthesized
    // putt_events rows).
    case 'BATCH_COMPLETE': {
      return {
        ...state,
        tally: {
          makes: state.tally.makes + action.makes,
          attempts: state.tally.attempts + action.attempts,
        },
      }
    }

    default:
      return state
  }
}
