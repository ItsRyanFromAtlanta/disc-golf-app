import { useCallback, useEffect, useRef, useState } from 'react'
import { FSM_STATES, resolveBootstrapState } from '../lib/instantLaunch/fsm'
import { initialSessionState, sessionReducer } from '../lib/instantLaunch/sessionReducer'
import {
  applySetCrashRecoveryBuffer,
  applyClearCrashRecoveryBuffer,
  applyEnqueueParentWrite,
  applyEnqueueSummaryWrite,
  applyEnqueuePuttEvent,
  applyRemovePendingPuttEvent,
  applyAppendGhostCurrentEvent,
  applyRemoveGhostCurrentEvent,
  applyAppendCoachingEvent,
  applyRemoveCoachingEvent,
  applyMarkCoachingCallout,
  applyDequeueOutboxEntries,
  applySetProfileDefaults,
  applySetSmartPredictionCard,
} from '../lib/instantLaunch/stateReducer'
import { readInstantLaunchState, updateInstantLaunchState } from '../lib/instantLaunch/storage'
import { createSyncScheduler, SYNC_STATUS } from '../lib/instantLaunch/syncScheduler'
import { ACTIVITY_SOURCES, ACTIVITY_STATE_REASONS, ACTIVITY_STATES } from '../lib/activityLifecycle'
import { activityRepository } from '../lib/repository/activityRepository'
import { createActivitySyncAdapter } from '../lib/repository/activitySync'
import { getInstallationId } from '../lib/instantLaunch/installationId'
import { activityIdForCrashRecoveryBuffer, mirrorInstantLaunchActivity } from '../lib/instantLaunch/activityBridge'

// Orchestrates the FSM + unified localStorage subsystem + sync scheduler for
// one page (RegimenRunPage or FreeformLogPage) — generic across both session
// types. Page-specific write details (which Supabase table, which columns)
// are injected via `writeAdapter` so this hook never needs to know the
// difference between a regimen run and a freeform session.
//
// writeAdapter shape:
//   syncParentWrites(rows)  -> Promise<{ succeededIds, permanentFailureIds }>
//   syncSummaryWrites(rows) -> Promise<{ succeededIds, permanentFailureIds }>
//   syncPuttEvents(rows)    -> Promise<{ succeededIds, permanentFailureIds }>
//   deletePuttEvent(id)     -> Promise<void>  // undo-after-sync fallback
//
// Side effects (localStorage writes, outbox enqueue, scheduler nudges) are
// deliberately kept OUT of React state updater functions throughout — those
// can run more than once (React 19 StrictMode double-invokes them in dev,
// this app's main.jsx wraps everything in <StrictMode>) and duplicating a
// network-bound side effect would be a real bug, not just noise. A ref
// mirrors the live session state so each action reads/computes synchronously
// before touching storage, rather than relying on a setState functional updater.
// BOOTSTRAP happens once, synchronously, inside the lazy useState
// initializers below — not in a useEffect. An effect only runs after the
// first paint, which would mean one visible render of "nothing useful"
// before resolving READY_DEFAULT/ACTIVE_SESSION; computing it inline instead
// means the very first render already shows the right screen, matching the
// "no gating before the start button" TTFP rule.
function bootstrapSessionState(launchState) {
  if (resolveBootstrapState(launchState.crashRecoveryBuffer) !== FSM_STATES.ACTIVE_SESSION) return null
  const { currentStage } = launchState.crashRecoveryBuffer
  return initialSessionState({
    label: currentStage.label,
    distanceFt: currentStage.distanceFt,
    volumePlanned: currentStage.volumePlanned,
    historicalAvgMakePct: currentStage.historicalAvgMakePct,
  })
}

export function useInstantLaunchSession(writeAdapter, userId) {
  const [launchState, setLaunchState] = useState(() => readInstantLaunchState())
  const [fsm, setFsm] = useState(() => ({ status: resolveBootstrapState(launchState.crashRecoveryBuffer) }))
  const [sessionState, setSessionState] = useState(() => bootstrapSessionState(launchState))
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.SYNCED)

  const sessionStateRef = useRef(sessionState)
  const schedulerRef = useRef(null)
  const activitySyncRef = useRef(null)
  const mirrorPromiseRef = useRef(null)
  const writeAdapterRef = useRef(writeAdapter)
  writeAdapterRef.current = writeAdapter
  const userIdRef = useRef(userId)
  userIdRef.current = userId
  if (!activitySyncRef.current) activitySyncRef.current = createActivitySyncAdapter()

  const mirrorActiveActivity = useCallback(async (state = readInstantLaunchState()) => {
    if (!userIdRef.current || !state.crashRecoveryBuffer?.hasActiveSession) return null
    const occurredAt = new Date().toISOString()
    const result = await mirrorInstantLaunchActivity({
      repository: activityRepository,
      instantLaunchState: state,
      userId: userIdRef.current,
      occurredAt,
      recordedAt: occurredAt,
      installationId: getInstallationId(),
      source: ACTIVITY_SOURCES.LIVE_CAPTURE,
    })
    if (result.activity?.id) {
      const current = readInstantLaunchState()
      if (
        current.crashRecoveryBuffer.hasActiveSession &&
        activityIdForCrashRecoveryBuffer(current.crashRecoveryBuffer) ===
          activityIdForCrashRecoveryBuffer(state.crashRecoveryBuffer)
      ) {
        setLaunchState(updateInstantLaunchState(applySetCrashRecoveryBuffer, { activityId: result.activity.id }))
      }
    }
    return result
  }, [])

  // A resumed PWA may have a live InstantLaunch buffer but no React page
  // state. Mirror that buffer once on mount before any capture rows are
  // allowed to flush; all work remains local-first and offline-safe.
  const bootstrapMirrorRef = useRef(false)
  useEffect(() => {
    const state = readInstantLaunchState()
    if (!bootstrapMirrorRef.current && state.crashRecoveryBuffer.hasActiveSession) {
      bootstrapMirrorRef.current = true
      mirrorPromiseRef.current = mirrorActiveActivity(state).finally(() => {
        schedulerRef.current?.notifyOutboxChanged()
      })
    }
  }, [mirrorActiveActivity])

  // Builds a real, DB-shaped putt_events row (snake_case columns, the
  // correct exclusive-arc parent FK, user_id) from a gesture event — reads
  // sessionType/parentIds fresh off the persisted blob rather than closing
  // over React state, since gestureMake/gestureMiss are memoized once and
  // would otherwise see a stale sessionType/parentIds after startSession.
  function buildPuttEventRow({ id, outcome, missZone, distanceFt, occurredAt, sequence, putterDiscId, isPressure }) {
    const { sessionType, parentIds } = readInstantLaunchState().crashRecoveryBuffer
    const parentFk =
      sessionType === 'regimen'
        ? { regimen_run_id: parentIds?.regimenRunId }
        : { freeform_session_id: parentIds?.freeformSessionId }
    return {
      id,
      _op: 'insert',
      user_id: userIdRef.current,
      ...parentFk,
      set_order: sessionStateRef.current?.stage.regimenSetOrder ?? null,
      sequence,
      outcome,
      miss_zone: missZone,
      distance_ft: distanceFt,
      occurred_at: occurredAt,
      // Screen 8: which physical disc was active when this putt was logged —
      // lets the Session Summary's putter-performance breakdown (and an
      // ad-hoc mid-round SWAP) attribute makes/misses to the right disc.
      putter_disc_id: putterDiscId ?? null,
      is_pressure: isPressure === true,
    }
  }

  function setSession(next) {
    sessionStateRef.current = next
    setSessionState(next)
  }

  function nowStageSnapshot(stage, sequenceCounter) {
    return { currentStage: { ...stage, sequenceCounter }, lastUpdatedAt: new Date().toISOString() }
  }

  const flush = useCallback(async () => {
    const adapter = writeAdapterRef.current
    const state = readInstantLaunchState()
    const { parentWrites, summaryWrites, puttEvents } = state.outbox

    // A gesture or batch tap can arrive immediately after Start. Do not let
    // that early scheduler nudge race the Dexie mirror and violate the A6
    // parent foreign key; retry the mirror locally before any remote fact.
    if (state.crashRecoveryBuffer.hasActiveSession) {
      try {
        if (mirrorPromiseRef.current) await mirrorPromiseRef.current
        const mirroredState = readInstantLaunchState()
        if (!mirroredState.crashRecoveryBuffer.activityId) {
          mirrorPromiseRef.current = mirrorActiveActivity(mirroredState)
          await mirrorPromiseRef.current
        }
      } catch {
        return { hasPending: true, error: { permanent: false } }
      }
    }

    // A6 added composite foreign keys from typed practice parents to their
    // activity. Drain the lifecycle outbox first, and hold all capture facts
    // until the corresponding remote activity exists. InstantLaunch's three
    // capture queues remain otherwise untouched and authoritative.
    const lifecycleResult = await activitySyncRef.current.flush()
    if (lifecycleResult.error || lifecycleResult.hasPending) {
      return { hasPending: true, error: lifecycleResult.error ?? { permanent: false } }
    }

    if (!adapter || (parentWrites.length === 0 && summaryWrites.length === 0 && puttEvents.length === 0)) {
      return { hasPending: false, error: null }
    }

    const empty = { succeededIds: [], permanentFailureIds: [] }
    const [parentResult, summaryResult, eventsResult] = await Promise.all([
      parentWrites.length ? adapter.syncParentWrites(parentWrites) : empty,
      summaryWrites.length ? adapter.syncSummaryWrites(summaryWrites) : empty,
      puttEvents.length ? adapter.syncPuttEvents(puttEvents) : empty,
    ])

    const next = updateInstantLaunchState(applyDequeueOutboxEntries, {
      parentIds: [...parentResult.succeededIds, ...parentResult.permanentFailureIds],
      summaryWriteIds: [...summaryResult.succeededIds, ...summaryResult.permanentFailureIds],
      puttEventIds: [...eventsResult.succeededIds, ...eventsResult.permanentFailureIds],
    })
    setLaunchState(next)

    const anyPermanentFailure = [parentResult, summaryResult, eventsResult].some(
      (r) => r.permanentFailureIds.length > 0,
    )
    const stillPending =
      next.outbox.parentWrites.length + next.outbox.summaryWrites.length + next.outbox.puttEvents.length > 0

    if (anyPermanentFailure) return { hasPending: stillPending, error: { permanent: true } }

    const anyTransientFailure =
      parentResult.succeededIds.length + parentResult.permanentFailureIds.length < parentWrites.length ||
      summaryResult.succeededIds.length + summaryResult.permanentFailureIds.length < summaryWrites.length ||
      eventsResult.succeededIds.length + eventsResult.permanentFailureIds.length < puttEvents.length

    return anyTransientFailure ? { hasPending: stillPending, error: { permanent: false } } : { hasPending: stillPending, error: null }
  }, [mirrorActiveActivity])

  useEffect(() => {
    const scheduler = createSyncScheduler({ flush, onStatusChange: setSyncStatus })
    schedulerRef.current = scheduler
    scheduler.start()
    return () => scheduler.stop()
  }, [flush])

  const startSession = useCallback(({ sessionType, parentIds, activeRegimenSnapshot, ghostProfile, matchModeEnabled, initialStage, parentWriteRow }) => {
    const state = updateInstantLaunchState((s) => {
      let next = applySetCrashRecoveryBuffer(s, {
        hasActiveSession: true,
        sessionType,
        parentIds,
        activityId: null,
        activeRegimenSnapshot: activeRegimenSnapshot ?? null,
        ghostProfile: ghostProfile ?? null,
        ghostCurrentEvents: [],
        matchModeEnabled: matchModeEnabled === true,
        coachingEvents: [],
        coachingLastSpokenAttempt: 0,
        coachingLastInterventionAttempt: null,
        ...nowStageSnapshot(initialStage, 0),
      })
      if (parentWriteRow) next = applyEnqueueParentWrite(next, parentWriteRow)
      return next
    })
    setLaunchState(state)
    setSession(initialSessionState(initialStage))
    setFsm({ status: FSM_STATES.ACTIVE_SESSION })
    // Mirror locally before notifying the scheduler so the A6 parent FK can
    // never race ahead of its activity row during the first online flush.
    mirrorPromiseRef.current = mirrorActiveActivity(state).finally(() => schedulerRef.current?.notifyOutboxChanged())
  }, [mirrorActiveActivity])

  const gestureMake = useCallback((occurredAt, distanceFt, putterDiscId = null, isPressure = false) => {
    const id = crypto.randomUUID()
    const next = sessionReducer(sessionStateRef.current, { type: 'GESTURE_MAKE', id, occurredAt })
    setSession(next)
    const state = updateInstantLaunchState((s) => {
      const row = buildPuttEventRow({
        id,
        outcome: 'make',
        missZone: null,
        distanceFt,
        occurredAt,
        sequence: next.nextSequence - 1,
        putterDiscId,
        isPressure,
      })
      const withEvent = applyEnqueuePuttEvent(s, row)
      const withGhostProgress = applyAppendGhostCurrentEvent(withEvent, row)
      const withCoachingProgress = applyAppendCoachingEvent(withGhostProgress, row)
      return applySetCrashRecoveryBuffer(withCoachingProgress, nowStageSnapshot(next.stage, next.nextSequence - 1))
    })
    setLaunchState(state)
    schedulerRef.current?.notifyOutboxChanged()
  }, [])

  const gestureMiss = useCallback((occurredAt, distanceFt, missZone = null, putterDiscId = null, isPressure = false) => {
    const id = crypto.randomUUID()
    const next = sessionReducer(sessionStateRef.current, { type: 'GESTURE_MISS', id, occurredAt, missZone })
    setSession(next)
    const state = updateInstantLaunchState((s) => {
      const row = buildPuttEventRow({
        id,
        outcome: 'miss',
        missZone,
        distanceFt,
        occurredAt,
        sequence: next.nextSequence - 1,
        putterDiscId,
        isPressure,
      })
      const withEvent = applyEnqueuePuttEvent(s, row)
      const withGhostProgress = applyAppendGhostCurrentEvent(withEvent, row)
      const withCoachingProgress = applyAppendCoachingEvent(withGhostProgress, row)
      return applySetCrashRecoveryBuffer(withCoachingProgress, nowStageSnapshot(next.stage, next.nextSequence - 1))
    })
    setLaunchState(state)
    schedulerRef.current?.notifyOutboxChanged()
  }, [])

  // Scoped to the current stage's most recent gesture event (see
  // sessionReducer.js). If the event already synced (opportunistic sync raced
  // ahead of the undo tap), the local outbox no longer has it — that's the
  // signal to fall back to a real delete instead of a local splice.
  const undo = useCallback(() => {
    const current = sessionStateRef.current
    const last = current?.events[current.events.length - 1]
    if (!last) return

    const next = sessionReducer(current, { type: 'UNDO' })
    setSession(next)

    const stillPending = readInstantLaunchState().outbox.puttEvents.some((row) => row.id === last.id)
    if (stillPending) {
      setLaunchState(updateInstantLaunchState(
        (state, eventId) => applyRemoveCoachingEvent(
          applyRemoveGhostCurrentEvent(applyRemovePendingPuttEvent(state, eventId), eventId),
          eventId,
        ),
        last.id,
      ))
    } else {
      setLaunchState(updateInstantLaunchState(
        (state, eventId) => applyRemoveCoachingEvent(applyRemoveGhostCurrentEvent(state, eventId), eventId),
        last.id,
      ))
      writeAdapterRef.current?.deletePuttEvent(last.id)
    }
    schedulerRef.current?.notifyOutboxChanged()
  }, [])

  const batchComplete = useCallback((makes, attempts) => {
    const next = sessionReducer(sessionStateRef.current, { type: 'BATCH_COMPLETE', makes, attempts })
    setSession(next)
    const state = updateInstantLaunchState(applySetCrashRecoveryBuffer, nowStageSnapshot(next.stage, next.nextSequence - 1))
    setLaunchState(state)
  }, [])

  // summaryRowBuilder(sessionState) — receives the full current session state
  // (stage, tally, longestStreak, events, consecutiveMakes), not just
  // stage+tally, since the scoring formula needs longestStreak too. May
  // return a falsy value to skip finalizing entirely (e.g. a stage with zero
  // logged attempts — both summary tables reject attempts=0 via a check
  // constraint, and that would otherwise become a permanently-stuck outbox
  // entry rather than a graceful no-op).
  const finalizeCurrentStageSummary = useCallback((summaryRowBuilder) => {
    if (!summaryRowBuilder || !sessionStateRef.current) return
    const row = summaryRowBuilder(sessionStateRef.current)
    if (!row) return
    const state = updateInstantLaunchState(applyEnqueueSummaryWrite, row)
    setLaunchState(state)
    schedulerRef.current?.notifyOutboxChanged()
  }, [])

  const advanceStage = useCallback(
    (nextStage, summaryRowBuilder) => {
      finalizeCurrentStageSummary(summaryRowBuilder)
      setSession(initialSessionState(nextStage))
      const state = updateInstantLaunchState(applySetCrashRecoveryBuffer, nowStageSnapshot(nextStage, 0))
      setLaunchState(state)
    },
    [finalizeCurrentStageSummary],
  )

  const endSession = useCallback(
    (summaryRowBuilder, parentUpdateRow) => {
      finalizeCurrentStageSummary(summaryRowBuilder)
      const endingState = readInstantLaunchState()
      const activityId = endingState.crashRecoveryBuffer.activityId
      const terminalState = parentUpdateRow?.completed === false ? ACTIVITY_STATES.INCOMPLETE : ACTIVITY_STATES.COMPLETED
      const terminalReason =
        terminalState === ACTIVITY_STATES.INCOMPLETE
          ? ACTIVITY_STATE_REASONS.USER_SAVE_INCOMPLETE
          : ACTIVITY_STATE_REASONS.USER_FINALIZE
      const finalizeActivity = async () => {
        if (mirrorPromiseRef.current) await mirrorPromiseRef.current.catch(() => null)
        if (!activityId || !userIdRef.current) return
        const activity = await activityRepository.getById(activityId)
        if (!activity || ![ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED].includes(activity.state)) return
        const mutation = {
          expectedState: activity.state,
          expectedVersion: activity.version,
          occurredAt: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
          source: ACTIVITY_SOURCES.LIVE_CAPTURE,
          installationId: getInstallationId(),
          reason: terminalReason,
          idempotencyKey: `instant-launch:${activityId}:${terminalState}`,
        }
        if (terminalState === ACTIVITY_STATES.INCOMPLETE) {
          await activityRepository.markIncomplete(activityId, mutation)
        } else {
          await activityRepository.finalize(activityId, mutation)
        }
      }
      const state = updateInstantLaunchState((s) => {
        const withUpdate = parentUpdateRow ? applyEnqueueParentWrite(s, parentUpdateRow) : s
        return applyClearCrashRecoveryBuffer(withUpdate)
      })
      setLaunchState(state)
      setSession(null)
      setFsm({ status: FSM_STATES.READY_DEFAULT })
      void finalizeActivity()
        .catch(() => null)
        .finally(() => schedulerRef.current?.notifyOutboxChanged())
    },
    [finalizeCurrentStageSummary],
  )

  const updateProfileDefaults = useCallback((partial) => {
    setLaunchState(updateInstantLaunchState(applySetProfileDefaults, partial))
  }, [])

  const updateSmartPredictionCard = useCallback((card) => {
    setLaunchState(updateInstantLaunchState(applySetSmartPredictionCard, card))
  }, [])

  const markCoachingCallout = useCallback((callout) => {
    setLaunchState(updateInstantLaunchState(applyMarkCoachingCallout, callout))
  }, [])

  return {
    fsmStatus: fsm.status,
    sessionState,
    profileDefaults: launchState.profileDefaults,
    smartPredictionCard: launchState.smartPredictionCard,
    activeRegimenSnapshot: launchState.crashRecoveryBuffer.activeRegimenSnapshot,
    ghostProfile: launchState.crashRecoveryBuffer.ghostProfile,
    ghostCurrentEvents: launchState.crashRecoveryBuffer.ghostCurrentEvents,
    matchModeEnabled: launchState.crashRecoveryBuffer.matchModeEnabled,
    coachingEvents: launchState.crashRecoveryBuffer.coachingEvents,
    coachingLastSpokenAttempt: launchState.crashRecoveryBuffer.coachingLastSpokenAttempt,
    coachingLastInterventionAttempt: launchState.crashRecoveryBuffer.coachingLastInterventionAttempt,
    // Lets a freshly-mounted page (e.g. after a killed-and-relaunched PWA)
    // recover which parent row(s) an in-progress session belongs to, since
    // that page's own component state starts empty on a fresh mount.
    parentIds: launchState.crashRecoveryBuffer.parentIds,
    syncStatus,
    startSession,
    gestureMake,
    gestureMiss,
    undo,
    batchComplete,
    advanceStage,
    endSession,
    updateProfileDefaults,
    updateSmartPredictionCard,
    markCoachingCallout,
    retrySync: () => schedulerRef.current?.retry(),
  }
}
