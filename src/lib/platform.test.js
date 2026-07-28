import { describe, expect, it } from 'vitest'
import { isIosLike, isStandaloneDisplay, oauthRedirectLeavesApp, readPlatformContext } from './platform'

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'

describe('isIosLike', () => {
  it('detects classic iOS user agents', () => {
    expect(isIosLike({ userAgent: IPHONE_UA })).toBe(true)
    expect(isIosLike({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)' })).toBe(true)
  })

  it('detects iPadOS running in desktop mode', () => {
    expect(isIosLike({ userAgent: 'Macintosh; Intel Mac OS X', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
  })

  it('does not mistake a real Mac for iOS', () => {
    expect(isIosLike({ userAgent: 'Macintosh; Intel Mac OS X', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
  })

  it('is false for Android and for empty input', () => {
    expect(isIosLike({ userAgent: ANDROID_UA })).toBe(false)
    expect(isIosLike()).toBe(false)
  })
})

describe('isStandaloneDisplay', () => {
  it('accepts either the media query or the legacy iOS flag', () => {
    expect(isStandaloneDisplay({ displayModeStandalone: true })).toBe(true)
    expect(isStandaloneDisplay({ navigatorStandalone: true })).toBe(true)
  })

  it('is false in an ordinary browser tab', () => {
    expect(isStandaloneDisplay({ displayModeStandalone: false, navigatorStandalone: false })).toBe(false)
    expect(isStandaloneDisplay()).toBe(false)
  })
})

describe('oauthRedirectLeavesApp', () => {
  it('is true only for an installed iOS PWA', () => {
    expect(oauthRedirectLeavesApp({ ios: true, standalone: true })).toBe(true)
  })

  it('is false for iOS Safari tabs, installed Android, and desktop', () => {
    expect(oauthRedirectLeavesApp({ ios: true, standalone: false })).toBe(false)
    expect(oauthRedirectLeavesApp({ ios: false, standalone: true })).toBe(false)
    expect(oauthRedirectLeavesApp({ ios: false, standalone: false })).toBe(false)
    expect(oauthRedirectLeavesApp()).toBe(false)
  })
})

describe('readPlatformContext', () => {
  it('reads an installed iOS PWA from navigator and window', () => {
    const context = readPlatformContext(
      { userAgent: IPHONE_UA, standalone: true },
      { matchMedia: () => ({ matches: false }) },
    )
    expect(context).toEqual({ ios: true, standalone: true, oauthLeavesApp: true })
  })

  it('reads an installed Android PWA via the display-mode query', () => {
    const context = readPlatformContext(
      { userAgent: ANDROID_UA },
      { matchMedia: (query) => ({ matches: query === '(display-mode: standalone)' }) },
    )
    expect(context).toEqual({ ios: false, standalone: true, oauthLeavesApp: false })
  })

  it('survives a missing navigator and window', () => {
    expect(readPlatformContext(undefined, undefined)).toEqual({
      ios: false,
      standalone: false,
      oauthLeavesApp: false,
    })
  })
})
