import { describe, expect, it } from 'vitest'
import { latestBagVersion, previewBagRestore } from './bagHistory'

describe('bag history', () => {
  it('previews additions, removals, and unavailable historical discs', () => {
    expect(previewBagRestore({
      currentDiscIds: ['a', 'b'],
      snapshotDiscIds: ['b', 'c', 'lost'],
      availableDiscIds: ['a', 'b', 'c'],
    })).toEqual({ additions: ['c'], removals: ['a'], unavailable: ['lost'], targetDiscIds: ['b', 'c'] })
  })

  it('finds the latest immutable version', () => {
    expect(latestBagVersion([{ version: 1 }, { version: 3 }, { version: 2 }])).toEqual({ version: 3 })
    expect(latestBagVersion([])).toBeNull()
  })
})
