import { describe, expect, it } from 'vitest'
import { discDisplayName, normalizeLostFoundFields, sortLostFoundCases } from './lostFound'

describe('Lost & Found helpers', () => {
  it('normalizes optional text and paired coordinates', () => {
    expect(normalizeLostFoundFields({ areaText: '  Hole 7  ', latitude: '35.5', longitude: '-80.25' })).toMatchObject({
      areaText: 'Hole 7',
      latitude: 35.5,
      longitude: -80.25,
      notes: null,
    })
  })

  it('rejects partial and out-of-range coordinate pairs', () => {
    expect(() => normalizeLostFoundFields({ latitude: 35 })).toThrow('provided together')
    expect(() => normalizeLostFoundFields({ latitude: 91, longitude: 0 })).toThrow('Latitude')
    expect(() => normalizeLostFoundFields({ latitude: 0, longitude: -181 })).toThrow('Longitude')
  })

  it('puts open and most recently updated cases first', () => {
    const rows = sortLostFoundCases([
      { id: 'resolved', status: 'recovered', latest_update_at: '2026-07-15T12:00:00Z' },
      { id: 'older-open', status: 'open', latest_update_at: '2026-07-13T12:00:00Z' },
      { id: 'newer-open', status: 'open', latest_update_at: '2026-07-14T12:00:00Z' },
    ])
    expect(rows.map((row) => row.id)).toEqual(['newer-open', 'older-open', 'resolved'])
  })

  it('uses nickname, catalog mold, legacy mold, then fallback', () => {
    expect(discDisplayName({ nickname: 'Money' })).toBe('Money')
    expect(discDisplayName({ moldInfo: { mold_name: 'Hex' } })).toBe('Hex')
    expect(discDisplayName({ mold: 'Zone' })).toBe('Zone')
    expect(discDisplayName(null)).toBe('Unknown disc')
  })
})
