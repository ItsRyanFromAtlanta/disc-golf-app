const STORAGE_KEY = 'disc-locker-view-mode'

// Wrapped in try/catch: localStorage can throw in private-browsing contexts:
// the preference just silently fails to persist rather than crashing the page.
export function getViewMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function setViewMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore — nothing to recover, preference just won't persist this session
  }
}
