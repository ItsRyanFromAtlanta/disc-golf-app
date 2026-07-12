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

  if (!isCurrentActivityState(activity.state)) {
    const started = await repository.start(activityId, {
      ...baseMutation,
      expectedState: activity.state,
      expectedVersion: activity.version,
      reason: ACTIVITY_STATE_REASONS.CRASH_RECOVERY,
      idempotencyKey: `instant-launch:${activityId}:start`,
    })
    if (started.outcome === 'confirmation_required') {
      return {
        instantLaunchState,
        activity,
        outcome: 'confirmation_required',
        warnings: started.warnings,
      }
    }
    activity = started.activity
  }

  return {
    instantLaunchState: attachActivityMirror(instantLaunchState, activityId),
    activity,
    outcome: 'mirrored',
    warnings: [],
  }
}
