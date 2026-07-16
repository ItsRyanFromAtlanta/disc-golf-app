import { describe, expect, it } from 'vitest'
import { buildBagResonance, RESONANCE_PRESETS, resonanceComponents } from './bagResonance'

const disc = (id, speed, turn, fade) => ({ id, moldInfo: { speed, glide: 4, turn, fade }, status: 'in_locker' })

describe('Bag Resonance', () => {
  it('scores transparent coverage, speed ladder, and separation components', () => {
    const result = resonanceComponents([
      disc('p-under', 3, -2, 0),
      disc('p-stable', 3, 0, 0),
      disc('mid-over', 5, 0, 3),
    ])
    expect(result.coverage).toBe(50)
    expect(result.speedLadder).toBe(50)
    expect(result.separation).toBe(100)
    expect(result.occupiedCells).toEqual(['midrange/overstable', 'putter/stable', 'putter/understable'])
  })

  it('applies preset weights while keeping ghost gaps out of counts and capacity', () => {
    const result = buildBagResonance(
      [disc('p', 3, 0, 0)],
      [{ id: 'g', speed_class: 'fairway', stability_class: 'overstable', removed_at: null }],
      'minimal',
      10,
    )
    expect(result.preset).toEqual(RESONANCE_PRESETS.minimal)
    expect(result.discCount).toBe(1)
    expect(result.capacity).toBe(10)
    expect(result.headroom).toBe(9)
    expect(result.activeGapCount).toBe(1)
    expect(result.ghostGapLabels).toEqual(['overstable fairway'])
  })

  it('penalizes near-duplicate current-reality discs and reports missing data', () => {
    const result = buildBagResonance([
      disc('a', 7, -1, 2),
      disc('b', 7, -1, 2),
      { id: 'missing', moldInfo: { speed: 7, glide: 5 } },
    ])
    expect(result.components.overlapPairs).toBe(1)
    expect(result.components.separation).toBe(0)
    expect(result.components.missingDiscCount).toBe(1)
  })
})
