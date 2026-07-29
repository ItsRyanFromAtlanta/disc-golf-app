import { createOutboxQueue } from './outboxQueue'

export const ACTIVITY_OUTBOX_TABLE = 'activity_lifecycle'

// Behaviour is unchanged from the hand-rolled version this replaces; the queue
// mechanics now live in `outboxQueue.js` so the round outbox reuses them
// instead of forking a second retry/poison scheme. Lifecycle rows resolve
// `dependencyKey` against lifecycle rows only, which is what `'own'` selects.
export function createActivityOutbox({ database }) {
  const queue = createOutboxQueue({
    database,
    tables: [ACTIVITY_OUTBOX_TABLE],
    dependencyScope: 'own',
  })
  return {
    listReady: queue.listReady,
    recordFailure: queue.recordFailure,
    acknowledge: queue.acknowledge,
  }
}
