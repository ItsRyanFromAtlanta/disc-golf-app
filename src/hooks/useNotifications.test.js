import { describe, expect, it, vi } from 'vitest'
import { createObserveListener, syncNotifications } from './useNotifications'

// D-24: the producer/sync chain used to end in `.catch(() => {})`, and
// `notificationRepository.observe`'s error callback used to set `[]` — both
// rendered identically to a genuinely empty inbox. These tests hold the
// replacement contract: a caller can always tell "nothing to show" apart
// from "we could not find out".

describe('syncNotifications', () => {
  const okDeps = () => ({
    sync: { flush: vi.fn().mockResolvedValue(undefined), pull: vi.fn().mockResolvedValue([]) },
    listPreferences: vi.fn().mockResolvedValue([]),
    produceActivityReview: vi.fn().mockResolvedValue([]),
    produceSyncAttention: vi.fn().mockResolvedValue(null),
  })

  it('reports success once producers, flush, and pull all complete', async () => {
    const deps = okDeps()
    const result = await syncNotifications('user-1', deps)
    expect(result).toEqual({ ok: true })
    expect(deps.produceActivityReview).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(deps.produceSyncAttention).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(deps.sync.flush).toHaveBeenCalled()
    expect(deps.sync.pull).toHaveBeenCalledWith('user-1')
  })

  it('reports failure, with the error, when the remote pull rejects', async () => {
    const deps = okDeps()
    const pullError = new Error('network unreachable')
    deps.sync.pull.mockRejectedValue(pullError)
    const result = await syncNotifications('user-1', deps)
    expect(result).toEqual({ ok: false, error: pullError })
  })

  it('reports failure when the outbox flush rejects', async () => {
    const deps = okDeps()
    const flushError = new Error('poisoned row')
    deps.sync.flush.mockRejectedValue(flushError)
    const result = await syncNotifications('user-1', deps)
    expect(result).toEqual({ ok: false, error: flushError })
  })

  it('reports failure when a producer rejects', async () => {
    const deps = okDeps()
    const producerError = new Error('dexie read failed')
    deps.produceActivityReview.mockRejectedValue(producerError)
    const result = await syncNotifications('user-1', deps)
    expect(result).toEqual({ ok: false, error: producerError })
  })

  it('does not let a failed preference lookup abort the chain', async () => {
    const deps = okDeps()
    deps.listPreferences.mockRejectedValue(new Error('permission denied'))
    const result = await syncNotifications('user-1', deps)
    expect(result).toEqual({ ok: true })
    expect(deps.produceActivityReview).toHaveBeenCalled()
  })
})

describe('createObserveListener', () => {
  it('on a successful read, clears the failure flag and forwards the rows', () => {
    const setNotifications = vi.fn()
    const setSyncFailed = vi.fn()
    const listener = createObserveListener({ setNotifications, setSyncFailed })

    const rows = [{ id: 'n1' }]
    listener.next(rows)

    expect(setSyncFailed).toHaveBeenCalledWith(false)
    expect(setNotifications).toHaveBeenCalledWith(rows)
  })

  it('on a read error, raises the failure flag and leaves the notification list untouched', () => {
    const setNotifications = vi.fn()
    const setSyncFailed = vi.fn()
    const listener = createObserveListener({ setNotifications, setSyncFailed })

    listener.error(new Error('dexie blocked'))

    expect(setSyncFailed).toHaveBeenCalledWith(true)
    // The old behaviour called setNotifications([]) here, collapsing "we
    // could not read the inbox" into "the inbox is empty". It must not.
    expect(setNotifications).not.toHaveBeenCalled()
  })
})
