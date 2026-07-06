// Zone A hero card priority chain (Screen 4): crash-recovery beats resuming
// the last session config, which beats a plain first-session/no-target
// prompt. Pure so the chain itself is unit-testable without mounting the page.
export function heroCardState(instantLaunchState, hasHistory) {
  const { crashRecoveryBuffer, smartPredictionCard } = instantLaunchState

  if (crashRecoveryBuffer?.hasActiveSession) {
    return {
      kind: 'crash-recovery',
      sessionType: crashRecoveryBuffer.sessionType,
      parentIds: crashRecoveryBuffer.parentIds,
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
