import { describe, expect, it } from 'vitest'
import {
  buildFlightSpectrum,
  clusterSpectrumPoints,
  discSpectrumPoint,
  FLIGHT_SPECTRUM_MODES,
  ghostSpectrumPoint,
  spectrumFlightNumbers,
} from './flightSpectrum'

const moldInfo = { mold_name: 'Volt', speed: 8, glide: 5, turn: -1, fade: 2 }

describe('Flight Spectrum', () => {
  it('defaults to override-then-wear current reality and can show official numbers', () => {
    const disc = { id: 'd1', moldInfo, override_turn: -2, wear_score: 10 }
    const current = spectrumFlightNumbers(disc)
    expect(current.turn).toBe(-4)
    expect(current.fade).toBeCloseTo(0.8)
    expect(spectrumFlightNumbers(disc, FLIGHT_SPECTRUM_MODES.OFFICIAL)).toEqual({ speed: 8, glide: 5, turn: -1, fade: 2 })
    expect(discSpectrumPoint(disc).overriddenAxes).toEqual(['turn'])
    expect(discSpectrumPoint(disc).wearAdjusted).toBe(true)
  })

  it('clusters nearby discs deterministically but preserves separated points', () => {
    const clusters = clusterSpectrumPoints([
      { id: 'c', x: 9, y: 2 },
      { id: 'a', x: 7, y: 0 },
      { id: 'b', x: 7.5, y: 0.5 },
    ])
    expect(clusters.map((cluster) => cluster.members.map((point) => point.id))).toEqual([['a', 'b'], ['c']])
  })

  it('converts active complete ghost targets and excludes incomplete targets', () => {
    expect(ghostSpectrumPoint({ id: 'g1', speed_class: 'fairway', stability_class: 'stable', target_speed: 7, target_turn: -1, target_fade: 2 })).toMatchObject({ x: 7, y: 1, type: 'ghost' })
    expect(ghostSpectrumPoint({ id: 'g2', target_speed: 7 })).toBeNull()
  })

  it('reports missing flight data and keeps ghosts capacity-neutral', () => {
    const spectrum = buildFlightSpectrum(
      [{ id: 'good', moldInfo }, { id: 'missing', moldInfo: {} }],
      [
        { id: 'active', speed_class: 'fairway', stability_class: 'stable', target_speed: 7, target_turn: -1, target_fade: 2, removed_at: null },
        { id: 'removed', target_speed: 3, target_turn: 0, target_fade: 1, removed_at: '2026-01-01' },
      ],
    )
    expect(spectrum.clusters).toHaveLength(1)
    expect(spectrum.ghostPoints).toHaveLength(1)
    expect(spectrum.missingDiscCount).toBe(1)
    expect(spectrum.capacityCount).toBe(2)
  })
})
