import { describe, expect, it } from 'vitest'
import { createSyncScheduler, SYNC_STATUS } from './syncScheduler'

// The module header says this file is not vitest-testable because it uses
// window/document. That is true only of `start`/`stop` — the scheduling logic
// itself touches neither, so every test below drives it through
// `notifyOutboxChanged`/`retry` without ever calling `start()`. The concurrency
// bug these cover lived precisely in the part that was assumed untestable.

/** A flush whose resolution each test controls, so overlap is deterministic. */
function controllableFlush() {
  const pending = []
  let calls = 0

  const flush = () => {
    calls += 1
    return new Promise((resolve) => pending.push(resolve))
  }

  return {
    flush,
    get calls() {
      return calls
    },
    get inFlight() {
      return pending.length
    },
    /** Resolve the oldest outstanding flush and let microtasks settle. */
    async settle(result = { hasPending: false, error: null }) {
      const resolve = pending.shift()
      if (!resolve) throw new Error('settle() called with no flush in flight')
      resolve(result)
      // Two turns: one for the await inside runFlush, one for the loop around it.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('createSyncScheduler concurrency', () => {
  it('does not start a second flush while one is already running', async () => {
    // The reconnect bug: an `online` event landing next to a backoff retry
    // started a second pass over the same outbox snapshot, and every queued
    // operation went out twice.
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    expect(controller.calls).toBe(1)

    // Three more triggers arrive while the first flush is still in flight.
    scheduler.notifyOutboxChanged()
    scheduler.notifyOutboxChanged()
    scheduler.notifyOutboxChanged()
    await Promise.resolve()

    expect(controller.calls).toBe(1)
    expect(controller.inFlight).toBe(1)
  })

  it('runs exactly one follow-up pass for any number of triggers that arrived mid-flush', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    scheduler.notifyOutboxChanged()
    scheduler.notifyOutboxChanged()

    await controller.settle()

    // Coalesced into one rerun, not replayed once per trigger.
    expect(controller.calls).toBe(2)
  })

  it('does not drop a trigger that arrives mid-flush', async () => {
    // The hazard on the other side of the guard: the old code discarded any
    // notifyOutboxChanged that landed while status was SYNCING, stranding that
    // write until the next window event.
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    scheduler.notifyOutboxChanged()

    await controller.settle()
    expect(controller.calls).toBe(2)

    await controller.settle()
    expect(scheduler.getStatus()).toBe(SYNC_STATUS.SYNCED)
  })

  it('keeps flushing while the outbox still reports pending work', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()

    await controller.settle({ hasPending: true, error: null })
    expect(controller.calls).toBe(2)

    await controller.settle({ hasPending: false, error: null })
    expect(controller.calls).toBe(2)
    expect(scheduler.getStatus()).toBe(SYNC_STATUS.SYNCED)
  })

  it('converges rather than looping forever once the outbox drains', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    await controller.settle({ hasPending: true, error: null })
    await controller.settle({ hasPending: true, error: null })
    await controller.settle({ hasPending: false, error: null })

    expect(controller.calls).toBe(3)
    expect(controller.inFlight).toBe(0)
  })
})

describe('createSyncScheduler failure handling', () => {
  it('enters the terminal FAILED state on a permanent error', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    await controller.settle({ hasPending: false, error: { permanent: true } })

    expect(scheduler.getStatus()).toBe(SYNC_STATUS.FAILED)
  })

  it('does not auto-retry a trigger that was queued behind a flush which then failed permanently', async () => {
    // A permanent error hammering the same request on every reconnect is not
    // useful; FAILED needs a user action. The queued trigger must not sneak
    // past that, which is why the terminal check runs per pass.
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    scheduler.notifyOutboxChanged()

    await controller.settle({ hasPending: false, error: { permanent: true } })

    expect(controller.calls).toBe(1)
    expect(scheduler.getStatus()).toBe(SYNC_STATUS.FAILED)
  })

  it('ignores an ordinary trigger once FAILED', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    await controller.settle({ hasPending: false, error: { permanent: true } })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()

    expect(controller.calls).toBe(1)
  })

  it('lets an explicit retry escape FAILED', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    await controller.settle({ hasPending: false, error: { permanent: true } })

    scheduler.retry()
    await Promise.resolve()

    expect(controller.calls).toBe(2)
    expect(scheduler.getStatus()).toBe(SYNC_STATUS.SYNCING)
  })

  it('lets a retry requested mid-flush escape FAILED once that flush finishes', async () => {
    // retry() has to survive the per-pass terminal check that an ordinary
    // trigger does not — otherwise a user tapping retry at the wrong moment is
    // silently ignored.
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    scheduler.retry()

    await controller.settle({ hasPending: false, error: { permanent: true } })

    expect(controller.calls).toBe(2)
  })

  it('stops scheduling once stopped', async () => {
    const controller = controllableFlush()
    const scheduler = createSyncScheduler({ flush: controller.flush })

    scheduler.notifyOutboxChanged()
    await Promise.resolve()
    scheduler.stop()

    scheduler.notifyOutboxChanged()
    await Promise.resolve()

    expect(controller.calls).toBe(1)
  })
})
