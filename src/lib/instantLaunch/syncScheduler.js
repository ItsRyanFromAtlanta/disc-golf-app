import { nextBackoffDelayMs } from './backoff'

// Deliberately agnostic about WHAT is being synced — this only orchestrates
// WHEN to call the caller-supplied `flush`, and tracks status. The actual
// Supabase read/write payload logic (client-uuid upserts, dequeuing synced
// rows from the outbox) lives in the write-path code that constructs `flush`.
//
// Uses window/document (online event, page visibility), but only inside
// `start`/`stop`, and those bindings are now guarded. Everything else — the
// in-flight guard, the rerun queue, backoff, and the FAILED terminal rules —
// is plain logic and is unit-tested in syncScheduler.test.js. The header used
// to declare the whole module untestable under the node environment; that was
// true of the listeners and got generalised to the scheduler, which is how a
// concurrency bug sat here unnoticed. Browser-level behaviour is still
// exercised by the Playwright pass.
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
  let flushing = false
  let queuedRerun = false
  let queuedForce = false

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

  // One flush cycle. Returns true when it wants to be run again immediately.
  async function runFlush() {
    clearBackoff()
    setStatus(SYNC_STATUS.SYNCING)
    try {
      const result = await flush()
      if (result.error?.permanent) {
        setStatus(SYNC_STATUS.FAILED)
        return false
      }
      if (result.error) {
        attempt += 1
        setStatus(SYNC_STATUS.ERROR_RETRYING)
        backoffTimer = setTimeout(() => attemptFlush(), nextBackoffDelayMs(attempt - 1))
        return false
      }
      attempt = 0
      if (result.hasPending) {
        // A flush that completes with more work already queued (e.g. endSession
        // enqueues a summary write, triggers a flush, then enqueues a parent
        // update before that flush resolves) must not go quiet: the second
        // write is invisible to the in-flight flush's outbox snapshot. Ask for
        // another pass — this converges, since a pass only re-fires while the
        // outbox actually still has items.
        setStatus(SYNC_STATUS.PENDING)
        return true
      }
      setStatus(SYNC_STATUS.SYNCED)
      return false
    } catch {
      // network-level throw (fetch rejected, offline) — treated as transient
      attempt += 1
      setStatus(SYNC_STATUS.ERROR_RETRYING)
      backoffTimer = setTimeout(() => attemptFlush(), nextBackoffDelayMs(attempt - 1))
      return false
    }
  }

  // Every trigger — start, online, visibilitychange, notifyOutboxChanged,
  // retry, backoff — funnels through here.
  //
  // `flushing` is the concurrency guard, and it has to be a real in-flight flag
  // rather than a `status` check. Status was doing that job before, and it
  // could not: it is SYNCING only while `flush()` is awaited, so an `online`
  // event arriving next to a backoff retry started a second pass that read the
  // same outbox snapshot and sent every queued operation twice. Harmless
  // server-side (idempotency keys and id-conflict upserts absorb it) but it
  // defeated wire-level exactly-once and doubled reconnect traffic.
  //
  // A trigger that lands mid-flush is recorded, never dropped — dropping it is
  // what used to strand a write in PENDING until the next window event.
  async function attemptFlush({ force = false } = {}) {
    if (stopped) return
    if (flushing) {
      queuedRerun = true
      queuedForce = queuedForce || force
      return
    }

    flushing = true
    try {
      let again = true
      let forced = force
      while (again && !stopped) {
        queuedRerun = false
        const forcedThisPass = forced
        forced = false
        // FAILED is terminal and never auto-retried; only an explicit retry()
        // may cross this line. Checked per pass, because a flush can enter
        // FAILED while a trigger is already queued behind it.
        if (!forcedThisPass && status === SYNC_STATUS.FAILED) break

        const wantsAnotherPass = await runFlush()
        again = wantsAnotherPass || queuedRerun
        forced = queuedForce
        queuedForce = false
      }
    } finally {
      flushing = false
    }
  }

  function handleOnline() {
    if (status !== SYNC_STATUS.FAILED) attemptFlush()
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible' && status !== SYNC_STATUS.FAILED) attemptFlush()
  }

  // Listener wiring is the only browser-dependent part of this module, so it
  // is guarded rather than assumed. That keeps `stop()` from throwing outside a
  // browser — which is what let the scheduling logic below become unit-testable
  // at all, after years of the header comment declaring it wasn't.
  function bindWindowListeners(bind) {
    if (typeof window !== 'undefined') {
      window[bind ? 'addEventListener' : 'removeEventListener']('online', handleOnline)
    }
    if (typeof document !== 'undefined') {
      document[bind ? 'addEventListener' : 'removeEventListener']('visibilitychange', handleVisibility)
    }
  }

  function start() {
    bindWindowListeners(true)
    attemptFlush()
  }

  function stop() {
    stopped = true
    clearBackoff()
    bindWindowListeners(false)
  }

  // Opportunistic trigger (e.g. right after a stage completes) — tries again
  // immediately instead of waiting for the next event/backoff tick.
  //
  // The old `status !== SYNCING` half of this guard is gone on purpose. It was
  // standing in for an in-flight check, and as a side effect it *discarded* any
  // notification that arrived mid-flush. `attemptFlush` now queues those
  // instead, which is both safe against double-sending and strictly better at
  // not losing work.
  function notifyOutboxChanged() {
    if (status !== SYNC_STATUS.FAILED) attemptFlush()
  }

  // Explicit manual retry out of the FAILED terminal state — FAILED is never
  // auto-retried by online/visibility/notifyOutboxChanged, on purpose (a
  // permanent error hammering the same request on every reconnect isn't
  // useful; it needs a user action).
  //
  // `force` is what carries it past the per-pass terminal check in
  // attemptFlush — without it the guard that stops automatic triggers from
  // escaping FAILED would swallow the user's explicit retry too, including
  // when it arrives while a flush is still in flight.
  function retry() {
    if (!stopped) {
      attempt = 0
      attemptFlush({ force: true })
    }
  }

  function getStatus() {
    return status
  }

  return { start, stop, notifyOutboxChanged, retry, getStatus }
}
