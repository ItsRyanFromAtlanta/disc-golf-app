// BOOTSTRAP is transient (a single synchronous localStorage read, <200ms,
// never rendered) — resolveBootstrapState decides which of the other two
// states to land in. Route-mismatch handling (e.g. a buffered regimen-run
// session but the user is on a different route) is a separate concern, see
// crashRecovery.js.
export const FSM_STATES = {
  BOOTSTRAP: 'BOOTSTRAP',
  READY_DEFAULT: 'READY_DEFAULT',
  ACTIVE_SESSION: 'ACTIVE_SESSION',
}

export function initialFsmState() {
  return { status: FSM_STATES.BOOTSTRAP }
}

export function resolveBootstrapState(crashRecoveryBuffer) {
  return crashRecoveryBuffer?.hasActiveSession ? FSM_STATES.ACTIVE_SESSION : FSM_STATES.READY_DEFAULT
}

export function fsmReducer(state, action) {
  switch (action.type) {
    case 'START_SESSION':
    case 'RESUME_SESSION':
      return { status: FSM_STATES.ACTIVE_SESSION }
    case 'END_SESSION':
      return { status: FSM_STATES.READY_DEFAULT }
    default:
      return state
  }
}
