// Pure transitions over the single unified localStorage blob
// (`discgolf.instantLaunch.v1`, see storage.js). Nothing in this file touches
// localStorage directly — storage.js is the only impure caller, which is
// what keeps this fully vitest-testable (no jsdom in this repo's vitest
// config, so `localStorage` itself isn't available under test).
export const INSTANT_LAUNCH_SCHEMA_VERSION = 1

export function defaultInstantLaunchState() {
  return {
    schemaVersion: INSTANT_LAUNCH_SCHEMA_VERSION,
    profileDefaults: {
      favoritePutterDiscId: null,
      quickModPresets: [],
      diagnosticModeDefault: false,
      // Scoring Canvas (Screen 8): tap is primary per the signed-off input
      // model; gesture/panic are opt-in alt modes, same pattern as
      // diagnosticModeDefault.
      inputModeDefault: 'tap',
    },
    smartPredictionCard: {
      lastRegimenId: null,
      suggestedDistanceFt: null,
      computedAt: null,
    },
    crashRecoveryBuffer: {
      hasActiveSession: false,
      sessionType: null, // 'freeform' | 'regimen' | null
      parentIds: { regimenRunId: null, freeformSessionId: null, regimenId: null },
      // Cached so a killed-and-relaunched PWA can resume ACTIVE_SESSION with
      // zero network dependency (no re-fetching the regimen/sets to render
      // distances/reps) — matches the "no network gating" TTFP rule.
      activeRegimenSnapshot: null, // { regimen, sets } | null
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

// Guards against a shape mismatch from a previous app version's blob —
// resets to a fresh default rather than trying to migrate or crash on
// unexpected shape.
export function migrateOrResetState(rawParsed) {
  if (!rawParsed || rawParsed.schemaVersion !== INSTANT_LAUNCH_SCHEMA_VERSION) return defaultInstantLaunchState()
  return rawParsed
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
