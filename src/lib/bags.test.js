import { describe, it, expect } from 'vitest'
import {
  bagIdsToUnsetForNewDefault,
  isVisibleInBagView,
  bagViewDiscs,
  flightChartPoint,
  flightChartPoints,
  capacityTier,
  bagDisplayName,
  buildBagDraft,
  bagDraftHasChanges,
} from './bags'

describe('bagIdsToUnsetForNewDefault', () => {
  it('flips the previously-default bag when a new one is promoted', () => {
    const bags = [
      { id: 'a', is_default: true },
      { id: 'b', is_default: false },
      { id: 'c', is_default: false },
    ]
    expect(bagIdsToUnsetForNewDefault(bags, 'b')).toEqual(['a'])
  })

  it('returns nothing to unset if the target is already the only default', () => {
    const bags = [{ id: 'a', is_default: true }, { id: 'b', is_default: false }]
    expect(bagIdsToUnsetForNewDefault(bags, 'a')).toEqual([])
  })

  it('returns nothing to unset on a fresh account with no default yet', () => {
    const bags = [{ id: 'a', is_default: false }]
    expect(bagIdsToUnsetForNewDefault(bags, 'a')).toEqual([])
  })
})

describe('bag editor contracts', () => {
  const bag = { id: 'a', name: 'Tournament Cart', description: null, bag_type: 'tournament', capacity: null, is_default: true }

  it('keeps private names internally and uses a generic external main-bag label', () => {
    expect(bagDisplayName(bag)).toBe('Tournament Cart')
    expect(bagDisplayName(bag, { external: true })).toBe('Main Bag')
    expect(bagDisplayName({ name: 'Travel', is_default: false }, { external: true })).toBe('Travel')
  })

  it('detects grouped metadata and membership changes independent of membership order', () => {
    const draft = buildBagDraft(bag, ['d1', 'd2'])
    expect(bagDraftHasChanges(bag, ['d2', 'd1'], draft)).toBe(false)
    expect(bagDraftHasChanges(bag, ['d1', 'd2'], { ...draft, discIds: ['d1'] })).toBe(true)
    expect(bagDraftHasChanges(bag, ['d1', 'd2'], { ...draft, name: 'New name' })).toBe(true)
  })
})

describe('isVisibleInBagView / bagViewDiscs', () => {
  it('excludes lost/retired/sold from bag views, keeps in_locker', () => {
    const discs = [
      { id: 1, status: 'in_locker' },
      { id: 2, status: 'lost' },
      { id: 3, status: 'retired' },
      { id: 4, status: 'sold' },
    ]
    expect(bagViewDiscs(discs).map((d) => d.id)).toEqual([1])
    expect(isVisibleInBagView({ status: 'lost' })).toBe(false)
  })
})

describe('flightChartPoint / flightChartPoints', () => {
  const mold = { speed: 9, glide: 5, turn: -1, fade: 2 }

  it('plots stock numbers when the disc has no overrides', () => {
    const disc = {}
    expect(flightChartPoint(disc, mold)).toEqual({ x: 9, y: 1, disc, mold })
  })

  it('plots OVERRIDDEN numbers, not stock, when overrides are set', () => {
    const disc = { override_turn: -3, override_fade: 3 }
    // stock stability would be -1+2=1; overridden is -3+3=0 -- must use override
    expect(flightChartPoint(disc, mold)).toEqual({ x: 9, y: 0, disc, mold })
  })

  it('excludes a disc with no resolvable speed (no mold, no override)', () => {
    expect(flightChartPoint({}, null)).toBeNull()
  })

  it('filters out unplaceable discs across a list, keeping the rest', () => {
    const good = { override_turn: -2, override_fade: 2 }
    const points = flightChartPoints([
      { disc: good, mold },
      { disc: {}, mold: null },
    ])
    expect(points).toHaveLength(1)
    expect(points[0].x).toBe(9)
  })
})

describe('capacityTier', () => {
  it('is ok below the warning band', () => {
    expect(capacityTier(0)).toBe('ok')
    expect(capacityTier(29)).toBe('ok')
  })

  it('warns in the last 5 slots before the cap', () => {
    expect(capacityTier(30)).toBe('warn')
    expect(capacityTier(34)).toBe('warn')
  })

  it('is full at and beyond the cap', () => {
    expect(capacityTier(35)).toBe('full')
    expect(capacityTier(40)).toBe('full')
  })

  it('scales the warning band off a custom cap', () => {
    expect(capacityTier(4, 10)).toBe('ok')
    expect(capacityTier(5, 10)).toBe('warn')
    expect(capacityTier(10, 10)).toBe('full')
  })
})
