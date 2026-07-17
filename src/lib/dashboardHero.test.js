import { describe, it, expect } from 'vitest'
import { heroCardState } from './dashboardHero'
import { defaultInstantLaunchState } from './instantLaunch/stateReducer'

describe('heroCardState', () => {
  it('prioritizes crash-recovery over everything else', () => {
    const state = {
      ...defaultInstantLaunchState(),
      crashRecoveryBuffer: {
        hasActiveSession: true,
        sessionType: 'regimen',
        parentIds: { regimenRunId: 'r1', freeformSessionId: null, regimenId: 'reg1' },
      },
      smartPredictionCard: { lastRegimenId: 'reg2', suggestedDistanceFt: 20, computedAt: '2026-07-01' },
    }
    expect(heroCardState(state, true)).toEqual({
      kind: 'crash-recovery',
      sessionType: 'regimen',
      parentIds: { regimenRunId: 'r1', freeformSessionId: null, regimenId: 'reg1' },
    })
  })

  it('resumes the last config when no crash-recovery session is active', () => {
    const state = {
      ...defaultInstantLaunchState(),
      smartPredictionCard: { lastRegimenId: 'reg2', suggestedDistanceFt: 20, computedAt: '2026-07-01' },
    }
    expect(heroCardState(state, true)).toEqual({
      kind: 'resume-last',
      regimenId: 'reg2',
      suggestedDistanceFt: 20,
    })
  })

  it('surfaces a Dexie active activity when the crash buffer is empty', () => {
    expect(
      heroCardState(defaultInstantLaunchState(), true, {
        id: 'run-1',
        type: 'putting_regimen',
        state: 'paused',
        metadata: { regimenId: 'reg-1' },
      }),
    ).toEqual({
      kind: 'active-activity',
      activityId: 'run-1',
      activityType: 'putting_regimen',
      regimenId: 'reg-1',
      state: 'paused',
    })
  })

  it('prompts for a first session on a brand-new account', () => {
    expect(heroCardState(defaultInstantLaunchState(), false)).toEqual({ kind: 'first-session' })
  })

  it('falls back to a plain no-target prompt when history exists but no regimen was ever run', () => {
    expect(heroCardState(defaultInstantLaunchState(), true)).toEqual({ kind: 'no-target' })
  })
})
