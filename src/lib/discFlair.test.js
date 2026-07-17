import { describe, expect, it } from 'vitest'
import { discFlairSignal, discTier } from './discFlair'

describe('discTier', () => {
  it('lets archived status take precedence over every other signal', () => {
    expect(discTier({ status: 'lost', role: 'primary_putter', wear_score: 9 })).toBe('archived')
    expect(discTier({ status: 'retired' })).toBe('archived')
    expect(discTier({ status: 'sold' })).toBe('archived')
  })

  it('marks a primary putter as legendary', () => {
    expect(discTier({ status: 'in_locker', role: 'primary_putter' })).toBe('legendary')
  })

  it('marks a situational weather disc as epic', () => {
    expect(discTier({ status: 'in_locker', role: 'situational_weather' })).toBe('epic')
  })

  it('keeps the highest permanent odometer unlock above temporary role and wear signals', () => {
    expect(discTier({ cosmeticUnlocks: [{ tier: 'epic' }], wear_score: 2 })).toBe('epic')
    expect(discTier({ cosmeticUnlocks: [{ tier: 'rare' }, { tier: 'legendary' }], role: 'standard' })).toBe('legendary')
  })

  it('accepts numeric wear values at or above the rare threshold', () => {
    expect(discTier({ wear_score: 7 })).toBe('rare')
    expect(discTier({ wear_score: '8' })).toBe('rare')
    expect(discTier({ wear_score: 6.99 })).toBe('common')
  })

  it('defaults unknown or missing signals to common', () => {
    expect(discTier()).toBe('common')
    expect(discTier(null)).toBe('common')
    expect(discTier({ status: 'in_locker', wear_score: 'worn' })).toBe('common')
    expect(discTier({ status: 'in_locker', role: 'utility' })).toBe('common')
  })
})

describe('discFlairSignal', () => {
  it('uses the highest-priority human-readable signal', () => {
    expect(discFlairSignal({ status: 'sold', role: 'primary_putter' })).toBe('sold')
    expect(discFlairSignal({ role: 'primary_putter', wear_score: 9 })).toBe('Primary putter')
    expect(discFlairSignal({ role: 'situational_weather', wear_score: 8 })).toBe('Weather role')
    expect(discFlairSignal({ wear_score: 7 })).toBe('Wear 7/10')
    expect(discFlairSignal({})).toBe('Locker standard')
  })
})
