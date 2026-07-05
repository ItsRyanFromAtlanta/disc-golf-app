import { describe, it, expect } from 'vitest'
import { classifyGesture, gestureAngleDegrees, isWithinCone, rapidFireTickCount } from './classify'
import { GESTURE_CONFIG } from './config'

function swipe(dx, dy, durationMs) {
  return [
    { x: 200, y: 200, t: 1000 },
    { x: 200 + dx, y: 200 + dy, t: 1000 + durationMs },
  ]
}

describe('gestureAngleDegrees', () => {
  it('reads pure up as 0deg', () => {
    expect(gestureAngleDegrees(0, -100)).toBeCloseTo(0)
  })
  it('reads pure right as 90deg', () => {
    expect(gestureAngleDegrees(100, 0)).toBeCloseTo(90)
  })
  it('reads pure down as 180deg', () => {
    expect(gestureAngleDegrees(0, 100)).toBeCloseTo(180)
  })
  it('reads pure left as 270deg', () => {
    expect(gestureAngleDegrees(-100, 0)).toBeCloseTo(270)
  })
})

describe('isWithinCone', () => {
  it('accepts exactly the half-angle boundary', () => {
    expect(isWithinCone(45, 0, 45)).toBe(true)
    expect(isWithinCone(315, 0, 45)).toBe(true) // -45deg wraps to 315
  })
  it('rejects just past the half-angle boundary', () => {
    expect(isWithinCone(45.001, 0, 45)).toBe(false)
  })
  it('handles wraparound near 0/360', () => {
    expect(isWithinCone(359, 0, 45)).toBe(true)
    expect(isWithinCone(1, 0, 45)).toBe(true)
  })
})

describe('classifyGesture', () => {
  it('classifies a fast, sufficiently long upward swipe as make', () => {
    expect(classifyGesture(swipe(0, -130, 300))).toEqual({ type: 'make' })
  })

  it('classifies a fast, sufficiently long downward swipe as miss', () => {
    expect(classifyGesture(swipe(0, 130, 300))).toEqual({ type: 'miss' })
  })

  it('classifies a fast, long-enough leftward swipe as undo (distinct, larger threshold)', () => {
    expect(classifyGesture(swipe(-170, 0, 300))).toEqual({ type: 'undo' })
  })

  it('rejects a leftward swipe that clears TRAVEL_PX but not the larger UNDO_TRAVEL_PX', () => {
    expect(classifyGesture(swipe(-130, 0, 300))).toEqual({ type: 'rejected' })
  })

  it('rejects an up swipe with enough travel but too slow', () => {
    expect(classifyGesture(swipe(0, -130, 500))).toEqual({ type: 'rejected' })
  })

  it('rejects a fast, long-enough swipe in the unrecognized "right" direction', () => {
    expect(classifyGesture(swipe(150, 0, 200))).toEqual({ type: 'rejected' })
  })

  it('reports none for incidental touches below the reject-minimum travel', () => {
    expect(classifyGesture(swipe(10, -15, 100))).toEqual({ type: 'none' })
  })

  it('reports none for fewer than two samples', () => {
    expect(classifyGesture([{ x: 0, y: 0, t: 0 }])).toEqual({ type: 'none' })
    expect(classifyGesture([])).toEqual({ type: 'none' })
  })
})

describe('rapidFireTickCount', () => {
  it('fires zero ticks before the long-press threshold', () => {
    expect(rapidFireTickCount(0)).toBe(0)
    expect(rapidFireTickCount(599, GESTURE_CONFIG)).toBe(0)
  })

  it('fires the first tick exactly at LONG_PRESS_MS, independent of DEBOUNCE_MS', () => {
    expect(rapidFireTickCount(600)).toBe(1)
    expect(rapidFireTickCount(799)).toBe(1)
  })

  it('fires one more tick every RAPID_FIRE_INTERVAL_MS after that', () => {
    expect(rapidFireTickCount(800)).toBe(2)
    expect(rapidFireTickCount(999)).toBe(2)
    expect(rapidFireTickCount(1000)).toBe(3)
  })
})
