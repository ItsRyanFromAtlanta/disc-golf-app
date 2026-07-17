import { describe, expect, it } from 'vitest'
import { activeGhostSlots, assignedShotTags, normalizeShotTag } from './discTaxonomy'

describe('disc taxonomy', () => {
  it('keeps tombstones out of active ghost slots and tag assignments', () => {
    expect(activeGhostSlots([{ id: 'a' }, { id: 'b', removed_at: '2026-01-01' }])).toEqual([{ id: 'a' }])
    expect(assignedShotTags(
      [{ id: 'tag-a', label: 'Hyzer' }, { id: 'tag-b', label: 'Roller' }],
      [{ shot_tag_id: 'tag-a' }, { shot_tag_id: 'tag-b', removed_at: '2026-01-01' }],
    )).toEqual([{ id: 'tag-a', label: 'Hyzer' }])
  })

  it('normalizes private tag labels to lowercase kebab slugs', () => {
    expect(normalizeShotTag('  Wind / Utility  ')).toBe('wind-utility')
  })
})
