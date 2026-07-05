import { describe, it, expect } from 'vitest'
import {
  pickDefaultMold,
  clampWeight,
  needsOnboarding,
  buildPutterDiscFields,
  MIN_WEIGHT_GRAMS,
  MAX_WEIGHT_GRAMS,
  DEFAULT_MOLD_NAME,
} from './onboarding'

describe('pickDefaultMold', () => {
  it('prefers the named default mold when present', () => {
    const molds = [{ mold_name: 'Proxy' }, { mold_name: DEFAULT_MOLD_NAME }]
    expect(pickDefaultMold(molds).mold_name).toBe(DEFAULT_MOLD_NAME)
  })

  it('falls back to the first mold when the default is absent', () => {
    const molds = [{ mold_name: 'Proxy' }, { mold_name: 'Other' }]
    expect(pickDefaultMold(molds).mold_name).toBe('Proxy')
  })

  it('returns null for an empty or missing list', () => {
    expect(pickDefaultMold([])).toBeNull()
    expect(pickDefaultMold(null)).toBeNull()
  })
})

describe('clampWeight', () => {
  it('clamps below the minimum', () => {
    expect(clampWeight(MIN_WEIGHT_GRAMS - 10)).toBe(MIN_WEIGHT_GRAMS)
  })

  it('clamps above the maximum', () => {
    expect(clampWeight(MAX_WEIGHT_GRAMS + 10)).toBe(MAX_WEIGHT_GRAMS)
  })

  it('passes through an in-range value', () => {
    expect(clampWeight(174)).toBe(174)
  })
})

describe('needsOnboarding', () => {
  it('is true for a fresh account with no bags', () => {
    expect(needsOnboarding([])).toBe(true)
    expect(needsOnboarding(null)).toBe(true)
  })

  it('is false once any bag exists', () => {
    expect(needsOnboarding([{ id: 'a' }])).toBe(false)
  })
})

describe('buildPutterDiscFields', () => {
  it('shapes the provisioning payload with role=primary_putter', () => {
    expect(
      buildPutterDiscFields({ moldId: 'm1', manufacturer: 'Axiom', moldName: 'Envy', weightGrams: 174 }),
    ).toEqual({
      mold_id: 'm1',
      manufacturer: 'Axiom',
      mold: 'Envy',
      weight_grams: 174,
      role: 'primary_putter',
      status: 'in_locker',
    })
  })
})
