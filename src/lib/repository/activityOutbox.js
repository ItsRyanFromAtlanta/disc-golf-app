export const ACTIVITY_OUTBOX_TABLE = 'activity_lifecycle'

export function createActivityOutbox({ database }) {
  async function lifecycleRows() {
    return database.outbox.where('table').equals(ACTIVITY_OUTBOX_TABLE).toArray()
  }

  async function listReady(nowMs = Date.now()) {
    const rows = await lifecycleRows()
    const pendingKeys = new Set(rows.map((row) => row.idempotencyKey))
    return rows
      .filter((row) => !row.poison)
      .filter((row) => row.nextRetryAt === null || row.nextRetryAt === undefined || row.nextRetryAt <= nowMs)
      .filter((row) => !row.dependencyKey || !pendingKeys.has(row.dependencyKey))
      .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
  }

  async function recordFailure(id, { errorClass, nextRetryAt, poison = false }) {
    return database.transaction('rw', database.outbox, async () => {
      const row = await database.outbox.get(id)
      if (!row || row.table !== ACTIVITY_OUTBOX_TABLE) return false
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
      if (!row || row.table !== ACTIVITY_OUTBOX_TABLE) return false
      await database.outbox.delete(id)
      return true
    })
  }

  return { listReady, recordFailure, acknowledge }
}
