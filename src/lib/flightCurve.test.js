import { describe, it, expect } from 'vitest'
import { flightPath, wearAdjustedFlightNumbers, proposeWearStepDown } from './flightCurve'

const numbers = { speed: 3, glide: 4, turn: -1, fade: 1 }

describe('flightPath', () => {
  it('returns null when any flight number is missing', () => {
    expect(flightPath({ speed: 3, glide: 4, turn: null, fade: 1 })).toBeNull()
    expect(flightPath({})).toBeNull()
  })

  it('returns a cubic Bézier path starting at the top-center of the viewport', () => {
    const path = flightPath(numbers, { width: 200, height: 300 })
    expect(path).toMatch(/^M 100 0 C /)
  })

  it('bends further to the drift side as |turn| grows', () => {
    const firstControlX = (path) => Number(path.split('C ')[1].split(' ')[0])
    const mild = flightPath({ speed: 3, glide: 4, turn: -1, fade: 0 })
    const sharp = flightPath({ speed: 3, glide: 4, turn: -4, fade: 0 })
    expect(firstControlX(sharp)).toBeGreaterThan(firstControlX(mild))
  })
})

describe('proposeWearStepDown', () => {
  it('steps up by one, capped at 10', () => {
    expect(proposeWearStepDown(4)).toBe(5)
    expect(proposeWearStepDown(10)).toBe(10)
  })

  it('defaults an unset wear score to a step from 1', () => {
    expect(proposeWearStepDown(null)).toBe(2)
  })
})

describe('wearAdjustedFlightNumbers', () => {
  it('leaves numbers untouched at wear=1 (factory fresh)', () => {
    expect(wearAdjustedFlightNumbers(numbers, 1)).toEqual(numbers)
  })

  it('returns the input unchanged when wear is not recorded', () => {
    expect(wearAdjustedFlightNumbers(numbers, null)).toEqual(numbers)
  })

  it('drifts turn more negative and fade lower as wear increases', () => {
    const worn = wearAdjustedFlightNumbers(numbers, 10)
    expect(worn.turn).toBeLessThan(numbers.turn)
    expect(worn.fade).toBeLessThan(numbers.fade)
    expect(worn.fade).toBeGreaterThanOrEqual(0)
  })

  it('passes through null axes without throwing', () => {
    const sparse = { speed: 3, glide: 4, turn: null, fade: null }
    expect(wearAdjustedFlightNumbers(sparse, 8)).toEqual(sparse)
  })
})
