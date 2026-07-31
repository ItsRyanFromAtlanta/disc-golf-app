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
      resume: { href: '/practice/regimens/reg-1/run', label: 'Resume active practice' },
    })
  })

  // D-12 regression: the hero used to carry only the raw activity fields, so
  // PracticeMenuPage had to re-derive a destination itself — and its ternary
  // had no `disc_golf_round` branch, so an in-progress round fell through to
  // the freeform putting canvas. `resume` is resolved once, here, from the
  // same table `resolveActivityResume` uses for the header pill (D-13), so a
  // round in progress resolves to its own scorecard rather than nowhere.
  it('resolves a live round to its own scorecard, not the freeform canvas', () => {
    expect(
      heroCardState(defaultInstantLaunchState(), true, {
        id: 'round-9',
        type: 'disc_golf_round',
        state: 'active',
      }),
    ).toEqual({
      kind: 'active-activity',
      activityId: 'round-9',
      activityType: 'disc_golf_round',
      regimenId: null,
      state: 'active',
      resume: { href: '/rounds/round-9', label: 'Resume active round' },
    })
  })

  it('resolves a freeform activity to the freeform canvas', () => {
    expect(
      heroCardState(defaultInstantLaunchState(), true, {
        id: 'ff-1',
        type: 'putting_freeform',
        state: 'active',
      }),
    ).toEqual({
      kind: 'active-activity',
      activityId: 'ff-1',
      activityType: 'putting_freeform',
      regimenId: null,
      state: 'active',
      resume: { href: '/practice/freeform', label: 'Resume active practice' },
    })
  })

  it('leaves resume null for an activity type with no capture screen shipped yet', () => {
    expect(
      heroCardState(defaultInstantLaunchState(), true, {
        id: 'fw-1',
        type: 'fieldwork',
        state: 'active',
      }),
    ).toEqual({
      kind: 'active-activity',
      activityId: 'fw-1',
      activityType: 'fieldwork',
      regimenId: null,
      state: 'active',
      resume: null,
    })
  })

  it('prompts for a first session on a brand-new account', () => {
    expect(heroCardState(defaultInstantLaunchState(), false)).toEqual({ kind: 'first-session' })
  })

  it('falls back to a plain no-target prompt when history exists but no regimen was ever run', () => {
    expect(heroCardState(defaultInstantLaunchState(), true)).toEqual({ kind: 'no-target' })
  })
})
