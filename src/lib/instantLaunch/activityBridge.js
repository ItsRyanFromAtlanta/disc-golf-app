import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_TYPES,
  isCurrentActivityState,
} from '../activityLifecycle'
import { applySetCrashRecoveryBuffer } from './stateReducer'

export const INSTANT_LAUNCH_ACTIVITY_WARNINGS = Object.freeze({
  MISSING_PARENT_ID: 'instant_launch_activity_missing_parent_id',
  UNSUPPORTED_SESSION_TYPE: 'instant_launch_activity_unsupported_session_type',
  TERMINAL_ACTIVITY: 'instant_launch_activity_is_terminal',
})

// DEFECT_REGISTER D-02. `mirrorInstantLaunchActivity` returns
// `outcome: 'confirmation_required'` whenever the repository declined to
// START a draft because another activity (a round) is current and the caller
// never passed `confirmRoundReplacement`. The draft row it already minted
// does have a real `activity.id` — so a consumer that only checks
// `result.activity?.id` (rather than `result.outcome`) will treat this as a
// success: it persists the draft's id as the session's mirrored activity and
// happily syncs capture facts against it. That draft can never be started or
// finalized (DRAFT accepts only START), so the practice quietly collects
// putt rows a lifecycle mirror, History, and the weekly report never learn
// about. Any caller deciding whether it is safe to treat a mirror result as
// "the activity is live, capture may proceed" must route through this guard
// instead of re-deriving the check inline.
export function mirrorRequiresConfirmation(result) {
  return result?.outcome === 'confirmation_required'
}

export function activityTypeForSessionType(sessionType) {
  return {
    freeform: ACTIVITY_TYPES.PUTTING_FREEFORM,
    regimen: ACTIVITY_TYPES.PUTTING_REGIMEN,
  }[sessionType] ?? null
}

// Existing practice parent ids are already client-generated UUIDs. Reusing
// that stable id for the local activity mirror makes a crash between Dexie
// and localStorage writes retry-safe without inventing a second identity.
export function activityIdForCrashRecoveryBuffer(buffer) {
  if (buffer?.activityId) return buffer.activityId
  if (buffer?.sessionType === 'freeform') return buffer.parentIds?.freeformSessionId ?? null
  if (buffer?.sessionType === 'regimen') return buffer.parentIds?.regimenRunId ?? null
  return null
}

export function attachActivityMirror(instantLaunchState, activityId) {
  return applySetCrashRecoveryBuffer(instantLaunchState, { activityId })
}

export async function mirrorInstantLaunchActivity({
  repository,
  instantLaunchState,
  userId,
  occurredAt,
  recordedAt = occurredAt,
  installationId,
  source = ACTIVITY_SOURCES.LIVE_CAPTURE,
  // Carries the user's answer to the round-replacement prompt through to
  // `repository.start`. Without it the repository returns
  // `confirmation_required` and the activity stays a draft — which, because
  // DRAFT accepts only START, can never be finalized and so never reaches
  // History, while capture rows sync happily against it.
  confirmRoundReplacement = false,
}) {
  const buffer = instantLaunchState?.crashRecoveryBuffer
  if (!buffer?.hasActiveSession) {
    return { instantLaunchState, activity: null, outcome: 'no_active_session', warnings: [] }
  }

  const type = activityTypeForSessionType(buffer.sessionType)
  if (!type) {
    return {
      instantLaunchState,
      activity: null,
      outcome: 'not_mirrored',
      warnings: [INSTANT_LAUNCH_ACTIVITY_WARNINGS.UNSUPPORTED_SESSION_TYPE],
    }
  }

  const activityId = activityIdForCrashRecoveryBuffer(buffer)
  if (!activityId) {
    return {
      instantLaunchState,
      activity: null,
      outcome: 'not_mirrored',
      warnings: [INSTANT_LAUNCH_ACTIVITY_WARNINGS.MISSING_PARENT_ID],
    }
  }

  const baseMutation = {
    occurredAt,
    recordedAt,
    source,
    installationId,
    metadata: {
      instantLaunchSessionType: buffer.sessionType,
      ...(buffer.parentIds?.regimenId ? { regimenId: buffer.parentIds.regimenId } : {}),
    },
  }

  let activity = await repository.getById(activityId)
  if (!activity) {
    const created = await repository.createDraft({
      id: activityId,
      userId,
      type,
      mutation: {
        ...baseMutation,
        expectedState: null,
        expectedVersion: null,
        idempotencyKey: `instant-launch:${activityId}:create`,
      },
      metadata: {
        mirroredFrom: 'instant_launch',
        ...(buffer.parentIds?.regimenId ? { regimenId: buffer.parentIds.regimenId } : {}),
      },
    })
    activity = created.activity
  }

  if ([ACTIVITY_STATES.COMPLETED, ACTIVITY_STATES.INCOMPLETE].includes(activity.state)) {
    return {
      instantLaunchState: attachActivityMirror(instantLaunchState, activityId),
      activity,
      outcome: 'not_mirrored',
      warnings: [INSTANT_LAUNCH_ACTIVITY_WARNINGS.TERMINAL_ACTIVITY],
    }
  }

  // The start command is the only thing that can auto-close a previous
  // activity, and the repository is the only place that decides it did. Carry
  // its answer out verbatim (§ 1's toast reads it) rather than letting a caller
  // infer a replacement from a second source.
  let replacedActivity = null
  let replacedStateEvent = null

  if (!isCurrentActivityState(activity.state)) {
    const started = await repository.start(activityId, {
      ...baseMutation,
      expectedState: activity.state,
      expectedVersion: activity.version,
      reason: ACTIVITY_STATE_REASONS.CRASH_RECOVERY,
      idempotencyKey: `instant-launch:${activityId}:start`,
    }, { confirmRoundReplacement })
    if (started.outcome === 'confirmation_required') {
      return {
        instantLaunchState,
        activity,
        outcome: 'confirmation_required',
        warnings: started.warnings,
      }
    }
    activity = started.activity
    replacedActivity = started.replacedActivity ?? null
    replacedStateEvent = started.replacedStateEvent ?? null
  }

  return {
    instantLaunchState: attachActivityMirror(instantLaunchState, activityId),
    activity,
    replacedActivity,
    replacedStateEvent,
    outcome: 'mirrored',
    warnings: [],
  }
}
