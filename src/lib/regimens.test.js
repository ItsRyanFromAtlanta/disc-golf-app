import { describe, expect, it } from 'vitest'
import { selectableRegimens } from './regimens'

// D-20: RegimenSelectPage surfaced archived routines as startable, unrunnable
// orphans. selectableRegimens is the shared predicate screens use to hide
// them without touching fetchRegimensWithSets or regimenRepository's cache
// (see the notes on both) — those must keep returning/caching archived rows
// so the offline mirror stays complete for the builder's clone/edit paths.
describe('selectableRegimens', () => {
  it('excludes routines flagged archived: true', () => {
    const regimens = [
      { id: 'active-1', archived: false },
      { id: 'active-2' }, // archived undefined must still be treated as runnable
      { id: 'archived-1', archived: true },
    ]
    expect(selectableRegimens(regimens).map((regimen) => regimen.id)).toEqual(['active-1', 'active-2'])
  })

  it('is a no-op when nothing is archived', () => {
    const regimens = [{ id: 'a' }, { id: 'b', archived: false }]
    expect(selectableRegimens(regimens)).toEqual(regimens)
  })

  it('returns an empty list when every routine is archived', () => {
    expect(selectableRegimens([{ id: 'only', archived: true }])).toEqual([])
  })
})
