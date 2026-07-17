import { describe, expect, it } from 'vitest'
import { formatRelativeToPar, parTotal, relativeToPar, roundTotal } from './rounds'

const holes = [
  { id: 'hole-1', par: 3 },
  { id: 'hole-2', par: 4 },
  { id: 'hole-3', par: 3 },
]

describe('round scoring helpers', () => {
  it('sums entered scores and ignores sparse holes', () => {
    expect(roundTotal([{ score: 3 }, { score: null }, { score: 4 }])).toBe(7)
    expect(roundTotal([{ score: undefined }, { score: '3' }])).toBe(3)
  })

  it('sums course par', () => {
    expect(parTotal(holes)).toBe(10)
    expect(parTotal([{ par: null }, { par: 3 }])).toBe(3)
  })

  it('computes current relative-to-par only for scored holes', () => {
    expect(relativeToPar([{ hole_id: 'hole-1', score: 4 }, { hole_id: 'hole-2', score: null }], holes)).toBe(1)
    expect(relativeToPar([{ hole: { par: 4 }, score: 3 }], holes)).toBe(-1)
  })

  it('formats even, over, under, and unavailable scores', () => {
    expect(formatRelativeToPar(0)).toBe('E')
    expect(formatRelativeToPar(3)).toBe('+3')
    expect(formatRelativeToPar(-2)).toBe('-2')
    expect(formatRelativeToPar(null)).toBe('—')
  })
})
