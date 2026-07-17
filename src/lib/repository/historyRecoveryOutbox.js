export const HISTORY_RECOVERY_OUTBOX_TABLE = 'activity_history'

export function createHistoryRecoveryOutbox({ database }) {
  async function rows() {
    return database.outbox.where('table').equals(HISTORY_RECOVERY_OUTBOX_TABLE).toArray()
  }

  async function listReady(nowMs = Date.now()) {
    const [historyRows, allRows] = await Promise.all([rows(), database.outbox.toArray()])
    const pendingKeys = new Set(allRows.map((row) => row.idempotencyKey).filter(Boolean))
    return historyRows
      .filter((row) => !row.poison)
      .filter((row) => row.nextRetryAt == null || row.nextRetryAt <= nowMs)
      .filter((row) => !row.dependencyKey || !pendingKeys.has(row.dependencyKey))
      .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
  }

  async function recordFailure(id, { errorClass, nextRetryAt, poison = false }) {
    return database.transaction('rw', database.outbox, async () => {
      const row = await database.outbox.get(id)
      if (!row || row.table !== HISTORY_RECOVERY_OUTBOX_TABLE) return false
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
      if (!row || row.table !== HISTORY_RECOVERY_OUTBOX_TABLE) return false
      await database.outbox.delete(id)
      return true
    })
  }

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
