import { describe, expect, it, vi } from 'vitest'
import {
  PURGEABLE_LOCAL_STORAGE_KEYS,
  purgeDeviceData,
  purgeLocalDatabase,
  purgeLocalStorage,
  selectPurgeableKeys,
} from './localPurge'

function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
    keys: () => [...map.keys()],
  }
}

describe('selectPurgeableKeys', () => {
  it('selects every key the app owns', () => {
    expect(selectPurgeableKeys([...PURGEABLE_LOCAL_STORAGE_KEYS])).toEqual([...PURGEABLE_LOCAL_STORAGE_KEYS])
  })

  it('selects future discgolf-prefixed keys so a new one is not silently retained', () => {
    expect(selectPurgeableKeys(['discgolf.somethingNew.v2'])).toEqual(['discgolf.somethingNew.v2'])
  })

  it('leaves unrelated keys alone', () => {
    expect(selectPurgeableKeys(['sb-auth-token', 'theme', 'unrelated'])).toEqual([])
  })

  it('handles an empty store', () => {
    expect(selectPurgeableKeys([])).toEqual([])
    expect(selectPurgeableKeys()).toEqual([])
  })
})

describe('purgeLocalStorage', () => {
  it('removes owned keys and retains the rest', () => {
    const storage = fakeStorage({
      'discgolf.instantLaunch.v1': '{}',
      'discgolf.installationId.v1': 'abc',
      'disc-locker-view-mode': 'grid',
      'disc-locker-flair-mode': 'on',
      'unrelated-key': 'keep me',
    })

    const removed = purgeLocalStorage(storage)

    expect(removed).toHaveLength(4)
    expect(storage.keys()).toEqual(['unrelated-key'])
  })

  it('continues past a key that throws on removal', () => {
    const storage = fakeStorage({
      'discgolf.instantLaunch.v1': '{}',
      'discgolf.installationId.v1': 'abc',
    })
    const original = storage.removeItem
    storage.removeItem = (key) => {
      if (key === 'discgolf.instantLaunch.v1') throw new Error('quota')
      return original(key)
    }

    expect(() => purgeLocalStorage(storage)).not.toThrow()
    expect(storage.has('discgolf.installationId.v1')).toBe(false)
  })

  it('is a no-op without a storage implementation', () => {
    expect(purgeLocalStorage(undefined)).toEqual([])
  })
})

describe('purgeLocalDatabase', () => {
  it('closes an open database before deleting it', async () => {
    const database = {
      isOpen: () => true,
      close: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    expect(await purgeLocalDatabase(database)).toBe(true)
    expect(database.close).toHaveBeenCalledOnce()
    expect(database.delete).toHaveBeenCalledOnce()
  })

  it('does not close a database that is already closed', async () => {
    const database = { isOpen: () => false, close: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) }
    await purgeLocalDatabase(database)
    expect(database.close).not.toHaveBeenCalled()
  })

  it('reports failure instead of throwing when the delete is blocked', async () => {
    const database = {
      isOpen: () => false,
      close: vi.fn(),
      delete: vi.fn().mockRejectedValue(new Error('blocked by another tab')),
    }
    expect(await purgeLocalDatabase(database)).toBe(false)
  })

  it('is a no-op without a database', async () => {
    expect(await purgeLocalDatabase(undefined)).toBe(false)
  })
})

describe('purgeDeviceData', () => {
  it('reports what it cleared from both stores', async () => {
    const storage = fakeStorage({ 'discgolf.instantLaunch.v1': '{}', keep: '1' })
    const database = { isOpen: () => true, close: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) }

    expect(await purgeDeviceData({ storage, database })).toEqual({
      removedKeys: ['discgolf.instantLaunch.v1'],
      databaseDeleted: true,
    })
  })

  it('survives being called with nothing available', async () => {
    expect(await purgeDeviceData()).toEqual({ removedKeys: [], databaseDeleted: false })
  })
})
