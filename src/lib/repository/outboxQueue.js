// The retry/poison bookkeeping `PHASE_A_ARCHITECTURE.md` § 8 requires of every
// outbox record: attempt count, last error class, next retry, dependency key,
// and poison state.
//
// This was implemented twice — `activityOutbox.js` and `historyRecoveryOutbox.js`
// were the same forty lines with a different table constant — and a third
// consumer (the round outbox) was about to make it three. One implementation,
// parameterised by which `outbox` table names it owns, is the whole point:
// a queue that diverges from this contract is exactly how a permanently failing
// write becomes indistinguishable from a successful one.
//
// `dependencyScope` is the single real difference between the two originals.
// Activity lifecycle rows resolve `dependencyKey` against lifecycle rows only
// ('own'); history-recovery rows resolve against every queued row ('all'),
// because a hide/restore can depend on a lifecycle operation in another table.
export function createOutboxQueue({ database, tables, dependencyScope = 'own' }) {
  const owned = [...tables]

  async function rows() {
    if (owned.length === 1) return database.outbox.where('table').equals(owned[0]).toArray()
    return database.outbox.where('table').anyOf(owned).toArray()
  }

  function ownsRow(row) {
    return Boolean(row) && owned.includes(row.table)
  }

  async function listReady(nowMs = Date.now()) {
    const ownRows = await rows()
    const keySource = dependencyScope === 'all' ? await database.outbox.toArray() : ownRows
    const pendingKeys = new Set(keySource.map((row) => row.idempotencyKey).filter(Boolean))
    return ownRows
      .filter((row) => !row.poison)
      .filter((row) => row.nextRetryAt == null || row.nextRetryAt <= nowMs)
      .filter((row) => !row.dependencyKey || !pendingKeys.has(row.dependencyKey))
      .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
  }

  async function recordFailure(id, { errorClass, nextRetryAt, poison = false }) {
    return database.transaction('rw', database.outbox, async () => {
      const row = await database.outbox.get(id)
      if (!ownsRow(row)) return false
      await database.outbox.update(id, {
        attemptCount: (row.attemptCount ?? 0) + 1,
        lastErrorClass: errorClass,
        nextRetryAt,
        poison,
      })
      return true
    })
  }

  async function acknowledge(id) {
    return database.transaction('rw', database.outbox, async () => {
      const row = await database.outbox.get(id)
      if (!ownsRow(row)) return false
      await database.outbox.delete(id)
      return true
    })
  }

  // A poisoned row is never retried automatically — that is the point of the
  // state. Only an explicit user action clears it back to a retryable row.
  async function retryPoisoned() {
    const poisoned = (await rows()).filter((row) => row.poison)
    await database.transaction('rw', database.outbox, async () => {
      for (const row of poisoned) {
        await database.outbox.update(row.id, {
          poison: false,
          nextRetryAt: null,
          lastErrorClass: null,
        })
      }
    })
    return poisoned.length
  }

  return { rows, listReady, recordFailure, acknowledge, retryPoisoned }
}
