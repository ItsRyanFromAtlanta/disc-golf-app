import { describe, it, expect } from 'vitest'
import {
  defaultAppSettings,
  normalizeSettings,
  applySettings,
  STACK_SIZE_MIN,
  STACK_SIZE_MAX,
} from './appSettings'

describe('normalizeSettings', () => {
  it('returns defaults for null/garbage input', () => {
    expect(normalizeSettings(null)).toEqual(defaultAppSettings())
    expect(normalizeSettings('nope')).toEqual(defaultAppSettings())
  })

  it('degrades unknown fields to defaults individually', () => {
    const s = normalizeSettings({ units: 'furlongs', hapticsEnabled: 'yes', defaultStackSize: 12 })
    expect(s.units).toBe('feet')
    expect(s.hapticsEnabled).toBe(true)
    expect(s.defaultStackSize).toBe(12)
  })

  it('clamps stack size into the allowed band and rounds', () => {
    expect(normalizeSettings({ defaultStackSize: 1 }).defaultStackSize).toBe(STACK_SIZE_MIN)
    expect(normalizeSettings({ defaultStackSize: 999 }).defaultStackSize).toBe(STACK_SIZE_MAX)
    expect(normalizeSettings({ defaultStackSize: 12.6 }).defaultStackSize).toBe(13)
  })

  it('accepts a valid unit and a false haptics flag', () => {
    const s = normalizeSettings({ units: 'meters', hapticsEnabled: false })
    expect(s.units).toBe('meters')
    expect(s.hapticsEnabled).toBe(false)
  })
})

describe('applySettings', () => {
  it('merges a partial update onto current settings', () => {
    const next = applySettings(defaultAppSettings(), { hapticsEnabled: false })
    expect(next).toEqual({ ...defaultAppSettings(), hapticsEnabled: false })
  })

  it('re-normalizes an out-of-range partial', () => {
    expect(applySettings(defaultAppSettings(), { defaultStackSize: 500 }).defaultStackSize).toBe(STACK_SIZE_MAX)
  })
})
