import { describe, it, expect } from 'vitest'
import { speedClass, stabilityClass, filterDiscs, sortDiscs } from './discFilters'

const mvpPhoton = { manufacturer: 'MVP', mold_name: 'Photon', speed: 11, glide: 5, turn: -1, fade: 2.5 }
const axiomEnvy = { manufacturer: 'Axiom', mold_name: 'Envy', speed: 3, glide: 3, turn: 0, fade: 2 }

function disc(overrides, mold, status = 'in_locker') {
  return { id: overrides.id ?? Math.random(), created_at: overrides.created_at ?? '2026-07-01', status, moldInfo: mold, ...overrides }
}

describe('speedClass', () => {
  it('buckets by conventional disc golf speed ranges', () => {
    expect(speedClass(2)).toBe('putter')
    expect(speedClass(5)).toBe('midrange')
    expect(speedClass(8)).toBe('fairway')
    expect(speedClass(12)).toBe('distance')
    expect(speedClass(null)).toBeNull()
  })
})

describe('stabilityClass', () => {
  it('buckets turn+fade into understable/stable/overstable', () => {
    expect(stabilityClass(-3)).toBe('understable')
    expect(stabilityClass(0)).toBe('stable')
    expect(stabilityClass(1)).toBe('stable')
    expect(stabilityClass(2.5)).toBe('overstable')
  })
})

describe('filterDiscs', () => {
  const discs = [
    disc({ id: 1, nickname: 'Star Photon' }, mvpPhoton),
    disc({ id: 2, nickname: 'Beat Envy' }, axiomEnvy),
    disc({ id: 3, nickname: 'Lost One' }, mvpPhoton, 'lost'),
  ]

  it('filters by status', () => {
    expect(filterDiscs(discs, { status: 'lost' }).map((d) => d.id)).toEqual([3])
  })

  it('filters by manufacturer', () => {
    expect(filterDiscs(discs, { manufacturer: 'Axiom' }).map((d) => d.id)).toEqual([2])
  })

  it('filters by speed class using EFFECTIVE numbers (override wins over stock)', () => {
    // Photon is stock speed 11 ("distance"); an override drops it to putter range.
    const overridden = disc({ id: 4, override_speed: 3 }, mvpPhoton)
    expect(filterDiscs([overridden], { speedClass: 'putter' })).toHaveLength(1)
    expect(filterDiscs([overridden], { speedClass: 'distance' })).toHaveLength(0)
  })

  it('filters by stability class using effective turn+fade', () => {
    const madeOverstable = disc({ id: 5, override_turn: 2, override_fade: 3 }, mvpPhoton)
    expect(filterDiscs([madeOverstable], { stability: 'overstable' })).toHaveLength(1)
    expect(filterDiscs([madeOverstable], { stability: 'understable' })).toHaveLength(0)
  })

  it('filters by search query across nickname, manufacturer, and mold name', () => {
    expect(filterDiscs(discs, { query: 'envy' }).map((d) => d.id)).toEqual([2])
    expect(filterDiscs(discs, { query: 'star' }).map((d) => d.id)).toEqual([1])
  })

  it('combines filters', () => {
    expect(filterDiscs(discs, { status: 'in_locker', manufacturer: 'MVP' }).map((d) => d.id)).toEqual([1])
  })
})

describe('sortDiscs', () => {
  const fast = disc({ id: 1, created_at: '2026-06-01' }, mvpPhoton) // speed 11
  const slow = disc({ id: 2, created_at: '2026-07-01' }, axiomEnvy) // speed 3

  it('sorts by effective speed descending', () => {
    expect(sortDiscs([slow, fast], 'speed').map((d) => d.id)).toEqual([1, 2])
  })

  it('sorts by stability ascending (most understable first)', () => {
    // Photon stock stability = -1+2.5 = 1.5; Envy = 0+2 = 2
    expect(sortDiscs([slow, fast], 'stability').map((d) => d.id)).toEqual([1, 2])
  })

  it('sorts by recently added descending', () => {
    expect(sortDiscs([fast, slow], 'recent').map((d) => d.id)).toEqual([2, 1])
  })

  it('uses EFFECTIVE speed, not stock, for sorting', () => {
    const overriddenSlow = disc({ id: 3, override_speed: 13, created_at: '2026-01-01' }, axiomEnvy)
    expect(sortDiscs([fast, overriddenSlow], 'speed').map((d) => d.id)).toEqual([3, 1])
  })
})
