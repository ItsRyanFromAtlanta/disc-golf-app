import { nextBackoffDelayMs } from './backoff'

// Deliberately agnostic about WHAT is being synced — this only orchestrates
// WHEN to call the caller-supplied `flush`, and tracks status. The actual
// Supabase read/write payload logic (client-uuid upserts, dequeuing synced
// rows from the outbox) lives in the write-path code that constructs `flush`.
//
// Uses window/document (online event, page visibility) so it is not
// vitest-testable under this repo's default node test environment — see
// storage.js's comment for the same constraint. Exercised via the Playwright
// browser pass instead (see the plan's Verification section).
export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  SYNCING: 'syncing',
  ERROR_RETRYING: 'error-retrying',
  FAILED: 'failed', // terminal: a permanent error (constraint violation / 4xx) — needs a manual retry, never auto-retried
}

// flush: () => Promise<{ hasPending: boolean, error: null | { permanent: boolean } }>
export function createSyncScheduler({ flush, onStatusChange }) {
  let status = SYNC_STATUS.SYNCED
  let attempt = 0
  let backoffTimer = null
  let stopped = false

  function setStatus(next) {
    if (status === next) return
    status = next
    onStatusChange?.(status)
  }

  function clearBackoff() {
    if (backoffTimer) {
      clearTimeout(backoffTimer)
      backoffTimer = null
    }
  }

  async function attemptFlush() {
    if (stopped) return
    clearBackoff()
    setStatus(SYNC_STATUS.SYNCING)
    try {
      const result = await flush()
      if (result.error?.permanent) {
        setStatus(SYNC_STATUS.FAILED)
        return
      }
      if (result.error) {
        attempt += 1
        setStatus(SYNC_STATUS.ERROR_RETRYING)
        backoffTimer = setTimeout(attemptFlush, nextBackoffDelayMs(attempt - 1))
        return
      }
      attempt = 0
      setStatus(result.hasPending ? SYNC_STATUS.PENDING : SYNC_STATUS.SYNCED)
    } catch {
      // network-level throw (fetch rejected, offline) — treated as transient
      attempt += 1
      setStatus(SYNC_STATUS.ERROR_RETRYING)
      backoffTimer = setTimeout(attemptFlush, nextBackoffDelayMs(attempt - 1))
    }
  }

  function handleOnline() {
    if (status !== SYNC_STATUS.FAILED) attemptFlush()
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible' && status !== SYNC_STATUS.FAILED) attemptFlush()
  }

  function start() {
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    attemptFlush()
  }

  function stop() {
    stopped = true
    clearBackoff()
    window.removeEventListener('online', handleOnline)
    document.removeEventListener('visibilitychange', handleVisibility)
  }

  // Opportunistic trigger (e.g. right after a stage completes) — tries again
  // immediately instead of waiting for the next event/backoff tick.
  function notifyOutboxChanged() {
    if (status !== SYNC_STATUS.SYNCING && status !== SYNC_STATUS.FAILED) attemptFlush()
  }

  // Explicit manual retry out of the FAILED terminal state — FAILED is never
  // auto-retried by online/visibility/notifyOutboxChanged, on purpose (a
  // permanent error hammering the same request on every reconnect isn't
  // useful; it needs a user action).
  function retry() {
    if (!stopped) {
      attempt = 0
      attemptFlush()
    }
  }

  function getStatus() {
    return status
  }

  return { start, stop, notifyOutboxChanged, retry, getStatus }
}
