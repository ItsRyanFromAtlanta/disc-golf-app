// Pure offline-first primitives shared by every entity repository (see
// createRepository.js for the TanStack Query wrapper, and discRepository.js
// for a concrete instance). Kept framework-free — no Dexie or React import —
// so the core contract is unit-testable with plain in-memory fakes instead of
// a real IndexedDB/React Query harness. Any object exposing toArray/bulkPut/
// bulkDelete/add/delete (the subset of the Dexie Table API this module uses)
// works.

// Attempts the remote read; mirrors a successful result into the local cache
// table so a later offline reload still has something to show. On failure,
// falls back to whatever is already cached rather than surfacing nothing —
// the whole point of local-first for a course with no signal.
//
// A successful read also PRUNES cached rows absent from the remote result
// (not just upserts) — otherwise a disc removed/changed elsewhere would keep
// surfacing forever via the offline fallback path on this device, since
// nothing else ever tells the cache a row is gone.
export async function readThroughCache(cacheTable, fetchRemote) {
  try {
    const remote = await fetchRemote()
    const remoteIds = new Set(remote.map((row) => row.id))
    const staleIds = (await cacheTable.toArray())
      .map((row) => row.id)
      .filter((id) => !remoteIds.has(id))
    if (remote.length > 0) await cacheTable.bulkPut(remote)
    if (staleIds.length > 0) await cacheTable.bulkDelete(staleIds)
    return remote
  } catch (err) {
    const cached = await cacheTable.toArray()
    if (cached.length > 0) return cached
    throw err
  }
}

// Queues the mutation in the outbox BEFORE attempting it remotely, so a
// dropped connection mid-request still leaves a durable record to retry — the
// write is never silently lost. A successful remote call clears its own
// outbox entry immediately; a failed one stays queued (flushOutbox retries it
// later) and the error still propagates so the caller can surface it.
export async function writeThrough({ outboxTable, entityName, op, payload, remoteFn }) {
  const id = await outboxTable.add({ table: entityName, op, payload, createdAt: Date.now() })
  const result = await remoteFn(payload)
  await outboxTable.delete(id)
  return result
}

// Replays every queued mutation for one entity (e.g. on the browser's
// 'online' event, or on next app load). Entries whose remote call still
// fails stay queued for the next flush rather than being dropped.
export async function flushOutbox({ outboxTable, entityName, remoteFns }) {
  const pending = (await outboxTable.toArray()).filter((entry) => entry.table === entityName)
  for (const entry of pending) {
    try {
      await remoteFns[entry.op](entry.payload)
      await outboxTable.delete(entry.id)
    } catch {
      // still offline, or the remote rejected it — leave queued for next flush
    }
  }
}
