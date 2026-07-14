import { readInstantLaunchState, updateInstantLaunchState } from './storage'
import { applyDequeueOutboxEntries } from './stateReducer'
import { syncRows } from './supabaseSync'

// Standalone, session-agnostic outbox flush for Screen 10's [ SYNC NOW ]
// control. The per-page sync scheduler (useInstantLaunchSession) can only run
// while a capture page is mounted; the Analytics screen needs to drain any
// writes left pending from a session that ended offline, without knowing which
// session type produced them. Each outbox row carries a `_table` routing tag
// (added at enqueue) so this flush can send it to the right table; the
// puttEvents array is always putt_events, so it's routed unconditionally.
//
// Idempotent by construction: rows use the same client-generated id +
// ignoreDuplicates upsert as the scheduler path, so re-flushing an
// already-synced row is a no-op. Legacy rows written before `_table` tagging
// existed are left untouched (counted in `untaggedRemaining`); the owning
// session page flushes those on its next mount.
function groupByTable(rows, fallbackTable) {
  const byTable = new Map()
  let untagged = 0
  for (const row of rows) {
    const table = row._table ?? fallbackTable
    if (!table) {
      untagged += 1
      continue
    }
    const group = byTable.get(table) ?? []
    group.push(row)
    byTable.set(table, group)
  }
  return { byTable, untagged }
}

export async function flushOutbox() {
  const { outbox } = readInstantLaunchState()
  const arrays = [
    { name: 'parentWrites', idKey: 'parentIds', rows: outbox.parentWrites, fallback: null },
    { name: 'summaryWrites', idKey: 'summaryWriteIds', rows: outbox.summaryWrites, fallback: null },
    { name: 'puttEvents', idKey: 'puttEventIds', rows: outbox.puttEvents, fallback: 'putt_events' },
  ]

  const dequeued = { parentIds: [], summaryWriteIds: [], puttEventIds: [] }
  let untaggedRemaining = 0
  let hadError = false

  for (const { idKey, rows, fallback } of arrays) {
    const { byTable, untagged } = groupByTable(rows, fallback)
    untaggedRemaining += untagged
    for (const [table, group] of byTable) {
      try {
        const { succeededIds, permanentFailureIds } = await syncRows(table, group)
        dequeued[idKey].push(...succeededIds, ...permanentFailureIds)
        if (permanentFailureIds.length > 0 || succeededIds.length < group.length) hadError = true
      } catch {
        // network-level throw — leave the group in the outbox to retry later
        hadError = true
      }
    }
  }

  const next = updateInstantLaunchState(applyDequeueOutboxEntries, dequeued)
  const pending =
    next.outbox.parentWrites.length + next.outbox.summaryWrites.length + next.outbox.puttEvents.length

  return { pending, untaggedRemaining, hadError }
}

// Pure count of everything still waiting to sync — drives the ledger's "N
// pending writes" line and disables CLEAR CACHE while > 0.
export function pendingWriteCount(outbox) {
  if (!outbox) return 0
  return (outbox.parentWrites?.length ?? 0) + (outbox.summaryWrites?.length ?? 0) + (outbox.puttEvents?.length ?? 0)
}
