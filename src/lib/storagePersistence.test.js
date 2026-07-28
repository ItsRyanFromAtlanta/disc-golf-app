import { describe, expect, it, vi } from 'vitest'
import {
  PERSISTENCE_DENIED,
  PERSISTENCE_FAILED,
  PERSISTENCE_GRANTED,
  PERSISTENCE_UNSUPPORTED,
  requestPersistentStorage,
  supportsPersistence,
} from './storagePersistence'

function storageManager({ persisted = false, persist = false } = {}) {
  return {
    persisted: vi.fn().mockResolvedValue(persisted),
    persist: vi.fn().mockResolvedValue(persist),
  }
}

describe('supportsPersistence', () => {
  it('requires both methods', () => {
    expect(supportsPersistence(storageManager())).toBe(true)
    expect(supportsPersistence({ persist: () => {} })).toBe(false)
    expect(supportsPersistence({ persisted: () => {} })).toBe(false)
    expect(supportsPersistence(undefined)).toBe(false)
  })
})

describe('requestPersistentStorage', () => {
  it('reports unsupported without throwing when the API is absent', async () => {
    expect(await requestPersistentStorage(undefined)).toEqual({
      state: PERSISTENCE_UNSUPPORTED,
      persisted: false,
    })
  })

  it('does not re-request when persistence was already granted', async () => {
    const storage = storageManager({ persisted: true })
    expect(await requestPersistentStorage(storage)).toEqual({ state: PERSISTENCE_GRANTED, persisted: true })
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('requests persistence when not yet granted', async () => {
    const storage = storageManager({ persisted: false, persist: true })
    expect(await requestPersistentStorage(storage)).toEqual({ state: PERSISTENCE_GRANTED, persisted: true })
    expect(storage.persist).toHaveBeenCalledOnce()
  })

  it('reports a denied request honestly', async () => {
    const storage = storageManager({ persisted: false, persist: false })
    expect(await requestPersistentStorage(storage)).toEqual({ state: PERSISTENCE_DENIED, persisted: false })
  })

  it('never throws when the browser rejects the call', async () => {
    const storage = {
      persisted: vi.fn().mockRejectedValue(new Error('denied by policy')),
      persist: vi.fn(),
    }
    const result = await requestPersistentStorage(storage)
    expect(result.state).toBe(PERSISTENCE_FAILED)
    expect(result.persisted).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })
})
