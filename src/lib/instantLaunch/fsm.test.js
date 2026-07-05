import { describe, it, expect } from 'vitest'
import { FSM_STATES, initialFsmState, resolveBootstrapState, fsmReducer } from './fsm'

describe('initialFsmState', () => {
  it('starts in BOOTSTRAP', () => {
    expect(initialFsmState()).toEqual({ status: FSM_STATES.BOOTSTRAP })
  })
})

describe('resolveBootstrapState', () => {
  it('resumes ACTIVE_SESSION when the crash-recovery buffer has one', () => {
    expect(resolveBootstrapState({ hasActiveSession: true })).toBe(FSM_STATES.ACTIVE_SESSION)
  })

  it('lands on READY_DEFAULT otherwise', () => {
    expect(resolveBootstrapState({ hasActiveSession: false })).toBe(FSM_STATES.READY_DEFAULT)
    expect(resolveBootstrapState(null)).toBe(FSM_STATES.READY_DEFAULT)
    expect(resolveBootstrapState(undefined)).toBe(FSM_STATES.READY_DEFAULT)
  })
})

describe('fsmReducer', () => {
  it('moves to ACTIVE_SESSION on START_SESSION and RESUME_SESSION', () => {
    expect(fsmReducer(initialFsmState(), { type: 'START_SESSION' })).toEqual({ status: FSM_STATES.ACTIVE_SESSION })
    expect(fsmReducer(initialFsmState(), { type: 'RESUME_SESSION' })).toEqual({ status: FSM_STATES.ACTIVE_SESSION })
  })

  it('moves to READY_DEFAULT on END_SESSION', () => {
    expect(fsmReducer({ status: FSM_STATES.ACTIVE_SESSION }, { type: 'END_SESSION' })).toEqual({
      status: FSM_STATES.READY_DEFAULT,
    })
  })

  it('ignores unknown actions', () => {
    const state = { status: FSM_STATES.READY_DEFAULT }
    expect(fsmReducer(state, { type: 'NOPE' })).toBe(state)
  })
})
