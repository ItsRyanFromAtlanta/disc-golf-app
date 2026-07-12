// A stable per-installation identifier travels with every lifecycle mutation.
// It is diagnostic metadata, not an identity or authorization token; the
// server always derives ownership from auth.uid().
export const INSTALLATION_ID_STORAGE_KEY = 'discgolf.installationId.v1'

let memoryFallback = null

function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `installation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getInstallationId(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  if (memoryFallback) return memoryFallback

  try {
    const existing = storage?.getItem(INSTALLATION_ID_STORAGE_KEY)
    if (existing) {
      memoryFallback = existing
      return existing
    }
    const generated = newId()
    storage?.setItem(INSTALLATION_ID_STORAGE_KEY, generated)
    memoryFallback = generated
    return generated
  } catch {
    // Private browsing or a disabled storage backend should not gate live
    // capture. The in-memory value remains stable for this page lifetime.
    memoryFallback = newId()
    return memoryFallback
  }
}

export function resetInstallationIdForTests() {
  memoryFallback = null
}
