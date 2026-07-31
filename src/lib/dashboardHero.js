import { resolveActivityResume } from './routeMetadata'

// Zone A hero card priority chain (Screen 4): crash-recovery beats resuming
// the last session config, which beats a plain first-session/no-target
// prompt. Pure so the chain itself is unit-testable without mounting the page.
export function heroCardState(instantLaunchState, hasHistory, activeActivity = null) {
  const { crashRecoveryBuffer, smartPredictionCard } = instantLaunchState

  if (crashRecoveryBuffer?.hasActiveSession) {
    return {
      kind: 'crash-recovery',
      sessionType: crashRecoveryBuffer.sessionType,
      parentIds: crashRecoveryBuffer.parentIds,
    }
  }

  if (activeActivity) {
    return {
      kind: 'active-activity',
      activityId: activeActivity.id,
      activityType: activeActivity.type,
      regimenId: activeActivity.metadata?.regimenId ?? null,
      state: activeActivity.state,
      // D-12: this used to be resolved by a ternary in PracticeMenuPage.jsx
      // with only a `putting_regimen` branch and an `else`, so a round in
      // progress fell into the `else` and linked to the freeform putting
      // canvas. `resolveActivityResume` is the same type-keyed lookup
      // AppShell's header pill was fixed to use for the identical bug
      // (D-13, `src/lib/routeMetadata.js`) — reused here rather than
      // reimplemented, so "where does this activity live" has exactly one
      // answer in the app, not two that can drift apart.
      resume: resolveActivityResume(activeActivity),
    }
  }

  if (smartPredictionCard?.lastRegimenId) {
    return {
      kind: 'resume-last',
      regimenId: smartPredictionCard.lastRegimenId,
      suggestedDistanceFt: smartPredictionCard.suggestedDistanceFt,
    }
  }

  // hasHistory but no regimen ever run (freeform-only) still gets a plain
  // prompt rather than the "first session ever" copy.
  return hasHistory ? { kind: 'no-target' } : { kind: 'first-session' }
}
