// Persistent-storage request.
//
// The durability layer for unsynced work is localStorage (InstantLaunch) plus
// IndexedDB (Dexie outbox). Both are evictable by default: browsers clear
// "best effort" origin storage under pressure, and Safari additionally caps
// unvisited origins. A user who logs a round in the woods and does not reopen
// the app for a while can lose writes that never reached Supabase.
//
// navigator.storage.persist() asks for the "persistent" bucket, which is
// exempt from that eviction. Chrome grants it silently on installed/engaged
// origins; Safari grants it on home-screen install; anything else falls back
// to the honest "not persisted" answer rather than pretending.
//
// Decision logic is pure and separately tested; the exported entry point takes
// the StorageManager so no global is required in tests.

export const PERSISTENCE_UNSUPPORTED = 'unsupported'
export const PERSISTENCE_GRANTED = 'granted'
export const PERSISTENCE_DENIED = 'denied'
export const PERSISTENCE_FAILED = 'failed'

export function supportsPersistence(storage) {
  return typeof storage?.persist === 'function' && typeof storage?.persisted === 'function'
}

export async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
  if (!supportsPersistence(storage)) return { state: PERSISTENCE_UNSUPPORTED, persisted: false }

  try {
    // Already granted: never re-prompt. persist() is idempotent, but on
    // engagement-gated browsers a repeat call can re-trigger a prompt.
    if (await storage.persisted()) return { state: PERSISTENCE_GRANTED, persisted: true }

    const granted = await storage.persist()
    return {
      state: granted ? PERSISTENCE_GRANTED : PERSISTENCE_DENIED,
      persisted: Boolean(granted),
    }
  } catch (error) {
    // A rejection here must never break app start — the app simply keeps the
    // default evictable storage it already had.
    return { state: PERSISTENCE_FAILED, persisted: false, error }
  }
}
