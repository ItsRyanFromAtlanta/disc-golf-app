import { createOutboxQueue } from './outboxQueue'

export const HISTORY_RECOVERY_OUTBOX_TABLE = 'activity_history'

// Behaviour is unchanged from the hand-rolled version this replaces. History
// rows may depend on a lifecycle operation queued under a different table, so
// they resolve `dependencyKey` against every queued row (`'all'`).
export function createHistoryRecoveryOutbox({ database }) {
  return createOutboxQueue({
    database,
    tables: [HISTORY_RECOVERY_OUTBOX_TABLE],
    dependencyScope: 'all',
  })
}
