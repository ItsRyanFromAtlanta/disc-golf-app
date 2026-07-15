const STORAGE_KEY = 'disc-locker-view-mode'
const FLAIR_STORAGE_KEY = 'disc-locker-flair-mode'

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

export function getFlairMode() {
  try {
    return localStorage.getItem(FLAIR_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setFlairMode(enabled) {
  try {
    localStorage.setItem(FLAIR_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // ignore — nothing to recover, preference just won't persist this session
  }
}
