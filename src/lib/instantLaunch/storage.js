import { defaultInstantLaunchState, migrateOrResetState } from './stateReducer'

const STORAGE_KEY = 'discgolf.instantLaunch.v1'

// Thin try/catch shell (same defensive style as viewPreference.js) —
// localStorage can throw in private-browsing contexts or when full; the app
// falls back to an in-memory default rather than crashing. All real logic
// lives in stateReducer.js's pure functions, which is what keeps this
// repo's vitest setup (no jsdom, no `localStorage` global) able to unit-test
// everything except this one wrapper.
export function readInstantLaunchState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return migrateOrResetState(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultInstantLaunchState()
  }
}

export function writeInstantLaunchState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore — the in-memory state for this page life is still correct, it
    // just won't persist across reload/relaunch
  }
}

// Wipes the persisted InstantLaunch blob entirely (Screen 10's CLEAR CACHE) —
// resets to a fresh default. Only safe to call with an empty outbox (the
// Analytics screen gates on zero pending writes), since this discards any
// not-yet-synced captures along with the cache.
export function clearInstantLaunchState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore — nothing persisted to clear
  }
  return defaultInstantLaunchState()
}

// Read-modify-write in one step: apply a pure stateReducer transform and
// persist the result, returning the new state so callers can sync their own
// React state from it too.
export function updateInstantLaunchState(applyFn, ...args) {
  const next = applyFn(readInstantLaunchState(), ...args)
  writeInstantLaunchState(next)
  return next
}
