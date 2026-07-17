// Pure transitions over the single unified localStorage blob
// (`discgolf.instantLaunch.v1`, see storage.js). Nothing in this file touches
// localStorage directly — storage.js is the only impure caller, which is
// what keeps this fully vitest-testable (no jsdom in this repo's vitest
// config, so `localStorage` itself isn't available under test).
export const INSTANT_LAUNCH_SCHEMA_VERSION = 4

export function defaultInstantLaunchState() {
  return {
    schemaVersion: INSTANT_LAUNCH_SCHEMA_VERSION,
    profileDefaults: {
      favoritePutterDiscId: null,
      quickPlayRegimenId: null,
      quickModPresets: [],
      diagnosticModeDefault: false,
      // Scoring Canvas (Screen 8): tap is primary per the signed-off input
      // model; gesture/panic are opt-in alt modes, same pattern as
      // diagnosticModeDefault.
      inputModeDefault: 'tap',
      matchModeEnabled: false,
    },
    smartPredictionCard: {
      lastRegimenId: null,
      suggestedDistanceFt: null,
      computedAt: null,
    },
    crashRecoveryBuffer: {
      hasActiveSession: false,
      sessionType: null, // 'freeform' | 'regimen' | null
      activityId: null, // Phase A lifecycle mirror; populated by the A4 bridge
      parentIds: { regimenRunId: null, freeformSessionId: null, regimenId: null },
      // Cached so a killed-and-relaunched PWA can resume ACTIVE_SESSION with
      // zero network dependency (no re-fetching the regimen/sets to render
      // distances/reps) — matches the "no network gating" TTFP rule.
      activeRegimenSnapshot: null, // { regimen, sets } | null
      // D4 ghost pacing: frozen at session start and progressed only by real
      // gesture/tap events. These are diagnostic snapshots, never a second
      // sporting-fact outbox and never synthesized from batch summaries.
      ghostProfile: null,
      ghostCurrentEvents: [],
      // D4 Match Mode: a frozen opt-in plus a diagnostic-only real-time event
      // snapshot and callout cursors. The putt outbox remains authoritative.
      matchModeEnabled: false,
      coachingEvents: [],
      coachingLastSpokenAttempt: 0,
      coachingLastInterventionAttempt: null,
      currentStage: { setOrder: null, distanceFt: null, sequenceCounter: 0 },
      lastUpdatedAt: null,
    },
    outbox: {
      parentWrites: [], // pending putting_regimen_runs / putt_sessions inserts (+ later updates)
      summaryWrites: [], // pending putting_regimen_run_sets / putt_distance_logs upserts
      puttEvents: [], // pending putt_events inserts
    },
  }
}

// V1 is the shipped InstantLaunch shape; v2 adds activityId; v3 adds frozen
// ghost-pacing diagnostics; v4 adds Match Mode diagnostics. Preserve every recovery snapshot and pending
// capture write during upgrades. Any unknown shape still resets rather than
// risking malformed capture state.
export function migrateOrResetState(rawParsed) {
  if (!rawParsed || ![1, 2, 3, INSTANT_LAUNCH_SCHEMA_VERSION].includes(rawParsed.schemaVersion)) {
    return defaultInstantLaunchState()
  }

  const defaults = defaultInstantLaunchState()
  return {
    ...defaults,
    ...rawParsed,
    schemaVersion: INSTANT_LAUNCH_SCHEMA_VERSION,
    profileDefaults: { ...defaults.profileDefaults, ...rawParsed.profileDefaults },
    smartPredictionCard: { ...defaults.smartPredictionCard, ...rawParsed.smartPredictionCard },
    crashRecoveryBuffer: {
      ...defaults.crashRecoveryBuffer,
      ...rawParsed.crashRecoveryBuffer,
      parentIds: {
        ...defaults.crashRecoveryBuffer.parentIds,
        ...rawParsed.crashRecoveryBuffer?.parentIds,
      },
      currentStage: {
        ...defaults.crashRecoveryBuffer.currentStage,
        ...rawParsed.crashRecoveryBuffer?.currentStage,
      },
    },
    outbox: { ...defaults.outbox, ...rawParsed.outbox },
  }
}

export function applySetProfileDefaults(state, partial) {
  return { ...state, profileDefaults: { ...state.profileDefaults, ...partial } }
}

export function applySetSmartPredictionCard(state, card) {
  return { ...state, smartPredictionCard: { ...state.smartPredictionCard, ...card } }
}

export function applySetCrashRecoveryBuffer(state, buffer) {
  return { ...state, crashRecoveryBuffer: { ...state.crashRecoveryBuffer, ...buffer } }
}

export function applyAppendGhostCurrentEvent(state, event) {
  if (!state.crashRecoveryBuffer.ghostProfile) return state
  return {
    ...state,
    crashRecoveryBuffer: {
      ...state.crashRecoveryBuffer,
      ghostCurrentEvents: [...state.crashRecoveryBuffer.ghostCurrentEvents, event],
    },
  }
}

export function applyRemoveGhostCurrentEvent(state, eventId) {
  return {
    ...state,
    crashRecoveryBuffer: {
      ...state.crashRecoveryBuffer,
      ghostCurrentEvents: state.crashRecoveryBuffer.ghostCurrentEvents.filter((event) => event.id !== eventId),
    },
  }
}

export function applyAppendCoachingEvent(state, event) {
  if (!state.crashRecoveryBuffer.matchModeEnabled) return state
  return {
    ...state,
    crashRecoveryBuffer: {
      ...state.crashRecoveryBuffer,
      coachingEvents: [...state.crashRecoveryBuffer.coachingEvents, event],
    },
  }
}

export function applyRemoveCoachingEvent(state, eventId) {
  return {
    ...state,
    crashRecoveryBuffer: {
      ...state.crashRecoveryBuffer,
      coachingEvents: state.crashRecoveryBuffer.coachingEvents.filter((event) => event.id !== eventId),
    },
  }
}

export function applyMarkCoachingCallout(state, { attempt, intervention }) {
  return {
    ...state,
    crashRecoveryBuffer: {
      ...state.crashRecoveryBuffer,
      coachingLastSpokenAttempt: attempt,
      coachingLastInterventionAttempt: intervention
        ? attempt
        : state.crashRecoveryBuffer.coachingLastInterventionAttempt,
    },
  }
}

export function applyClearCrashRecoveryBuffer(state) {
  return { ...state, crashRecoveryBuffer: defaultInstantLaunchState().crashRecoveryBuffer }
}

export function applyEnqueueParentWrite(state, row) {
  return { ...state, outbox: { ...state.outbox, parentWrites: [...state.outbox.parentWrites, row] } }
}

export function applyEnqueueSummaryWrite(state, row) {
  return { ...state, outbox: { ...state.outbox, summaryWrites: [...state.outbox.summaryWrites, row] } }
}

export function applyEnqueuePuttEvent(state, row) {
  return { ...state, outbox: { ...state.outbox, puttEvents: [...state.outbox.puttEvents, row] } }
}

// Removes entries that have been confirmed synced, by client-generated id.
export function applyDequeueOutboxEntries(state, { parentIds = [], summaryWriteIds = [], puttEventIds = [] }) {
  return {
    ...state,
    outbox: {
      parentWrites: state.outbox.parentWrites.filter((row) => !parentIds.includes(row.id)),
      summaryWrites: state.outbox.summaryWrites.filter((row) => !summaryWriteIds.includes(row.id)),
      puttEvents: state.outbox.puttEvents.filter((row) => !puttEventIds.includes(row.id)),
    },
  }
}

// Removes a single not-yet-synced putt event from the outbox (the common
// "undo" case — see sessionReducer.js). If it already synced, the caller
// needs a real DELETE instead; this only handles the still-local case.
export function applyRemovePendingPuttEvent(state, eventId) {
  return {
    ...state,
    outbox: { ...state.outbox, puttEvents: state.outbox.puttEvents.filter((row) => row.id !== eventId) },
  }
}
