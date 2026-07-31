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
    // Exposed 2026-07-31. This was the only one of the four outbox queues with
    // no way back out of a poisoned row — the round, course and history-recovery
    // queues all surface `retryPoisoned`. That asymmetry turned any single
    // permanently-classified lifecycle row into an unrecoverable state for the
    // whole app, because `flush`'s `hasPoison` gate also stops InstantLaunch
    // capture sync and history-recovery sync. A misclassification then has no
    // remedy short of clearing site data, which throws away the very rows the
    // queue exists to protect.
    //
    // Keeping the hatch is worth it even now that the misclassification that
    // exposed it is fixed: the next one should be recoverable without a code
    // change.
    retryPoisoned: queue.retryPoisoned,
  }
}
