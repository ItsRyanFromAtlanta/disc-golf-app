import { describe, expect, it } from 'vitest'
import { describeRestoreDiscIds, latestBagVersion, previewBagRestore } from './bagHistory'

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

  it('labels restore changes and preserves an unavailable placeholder', () => {
    expect(describeRestoreDiscIds(
      { additions: ['c'], removals: ['a'], unavailable: ['lost'] },
      [{ id: 'a', nickname: 'Ace' }, { id: 'c', mold: 'Comet' }],
    )).toEqual({
      additions: [{ id: 'c', label: 'Comet' }],
      removals: [{ id: 'a', label: 'Ace' }],
      unavailable: [{ id: 'lost', label: 'Unavailable historical disc' }],
    })
  })
})
