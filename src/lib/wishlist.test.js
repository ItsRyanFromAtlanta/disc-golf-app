import { describe, it, expect } from 'vitest'
import { stabilityGaps } from './wishlist'

function disc({ speed, turn, fade, status = 'in_locker' }) {
  return { status, moldInfo: { speed, glide: 5, turn, fade } }
}

describe('stabilityGaps', () => {
  it('flags a missing stability class within a speed class the player already carries', () => {
    // Fairway discs owned, but only understable (turn+fade = -3+1 = -2) --
    // stable and overstable fairway are both gaps.
    const discs = [disc({ speed: 7, turn: -3, fade: 1 })]
    const gaps = stabilityGaps(discs)
    expect(gaps.map((g) => `${g.speedClass}/${g.stabilityClass}`)).toEqual(['fairway/stable', 'fairway/overstable'])
  })

  it('reports nothing for a speed class with full stability coverage', () => {
    const discs = [
      disc({ speed: 3, turn: -2, fade: 0 }), // putter, understable (sum -2)
      disc({ speed: 3, turn: 0, fade: 0 }), // putter, stable (sum 0)
      disc({ speed: 3, turn: 0, fade: 3 }), // putter, overstable (sum 3)
    ]
    expect(stabilityGaps(discs)).toEqual([])
  })

  it('ignores discs that are not in the locker', () => {
    const discs = [disc({ speed: 7, turn: -3, fade: 1, status: 'retired' })]
    expect(stabilityGaps(discs)).toEqual([])
  })

  it('caps results at the given limit', () => {
    // A brand-new bag: one putter disc leaves gaps in 3 other speed classes
    // entirely uncovered (not counted) plus its own missing stability slots.
    const discs = [disc({ speed: 3, turn: 1, fade: 0 })]
    expect(stabilityGaps(discs, { limit: 1 })).toHaveLength(1)
  })

  it('excludes discs with unresolvable flight numbers rather than throwing', () => {
    const discs = [{ status: 'in_locker', moldInfo: {} }]
    expect(stabilityGaps(discs)).toEqual([])
  })
})
