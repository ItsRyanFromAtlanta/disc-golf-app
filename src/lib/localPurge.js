// Device-local purge, used after the server-side account deletion succeeds.
//
// Deleting auth.users removes everything on the server, but this device still
// holds the InstantLaunch capture buffer, the installation ID, the Dexie
// mirror/outbox, and view preferences. Leaving those behind would let the next
// person to open the app see the deleted user's practice data, and would let a
// stale outbox row replay against an account that no longer exists.
//
// The key list is exported so it stays reviewable: every localStorage key the
// app writes must appear here or be deliberately excluded.

export const PURGEABLE_LOCAL_STORAGE_KEYS = Object.freeze([
  'discgolf.instantLaunch.v1',
  'discgolf.installationId.v1',
  'disc-locker-view-mode',
  'disc-locker-flair-mode',
])

// Pure: decides what to remove given the keys currently present. Anything the
// app owns is removed by exact match; unrelated keys from other origins-in-
// name-only are left alone rather than clearing the whole store.
export function selectPurgeableKeys(existingKeys = []) {
  const owned = new Set(PURGEABLE_LOCAL_STORAGE_KEYS)
  return existingKeys.filter((key) => owned.has(key) || key.startsWith('discgolf.'))
}

export function purgeLocalStorage(storage) {
  if (!storage) return []
  const existing = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key != null) existing.push(key)
  }
  const removable = selectPurgeableKeys(existing)
  removable.forEach((key) => {
    try {
      storage.removeItem(key)
    } catch {
      // A quota/permission error on one key must not abort the rest.
    }
  })
  return removable
}

// Closes and deletes the Dexie database outright rather than clearing tables
// one by one — a dropped database cannot leave a forgotten store behind when
// a future version adds one.
export async function purgeLocalDatabase(database) {
  if (!database) return false
  try {
    if (database.isOpen?.()) database.close()
    await database.delete()
    return true
  } catch {
    return false
  }
}

export async function purgeDeviceData({ storage, database } = {}) {
  const removedKeys = purgeLocalStorage(storage)
  const databaseDeleted = await purgeLocalDatabase(database)
  return { removedKeys, databaseDeleted }
}
