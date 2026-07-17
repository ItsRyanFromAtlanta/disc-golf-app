import { afterEach, describe, expect, it } from 'vitest'
import { getInstallationId, INSTALLATION_ID_STORAGE_KEY, resetInstallationIdForTests } from './installationId'

describe('installationId', () => {
  afterEach(() => resetInstallationIdForTests())

  it('persists and reuses the installation id when storage is available', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    const first = getInstallationId(storage)
    expect(values.get(INSTALLATION_ID_STORAGE_KEY)).toBe(first)
    expect(getInstallationId(storage)).toBe(first)
  })

  it('falls back to a stable in-memory id when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const first = getInstallationId(storage)
    expect(getInstallationId(storage)).toBe(first)
  })
})
