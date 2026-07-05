import { describe, it, expect } from 'vitest'
import { routeSessionTypeFromPath, resolveCrashRecoveryRedirect } from './crashRecovery'

describe('routeSessionTypeFromPath', () => {
  it('recognizes the freeform route', () => {
    expect(routeSessionTypeFromPath('/practice/freeform')).toEqual({ sessionType: 'freeform' })
  })

  it('recognizes a regimen run route and extracts the regimen id', () => {
    expect(routeSessionTypeFromPath('/practice/regimens/abc-123/run')).toEqual({
      sessionType: 'regimen',
      regimenId: 'abc-123',
    })
  })

  it('treats any other route as session-less', () => {
    expect(routeSessionTypeFromPath('/practice')).toEqual({ sessionType: null })
    expect(routeSessionTypeFromPath('/practice/history')).toEqual({ sessionType: null })
    expect(routeSessionTypeFromPath('/profile')).toEqual({ sessionType: null })
    expect(routeSessionTypeFromPath('/practice/regimens')).toEqual({ sessionType: null })
  })
})

describe('resolveCrashRecoveryRedirect', () => {
  it('does nothing when there is no active session', () => {
    expect(resolveCrashRecoveryRedirect({ hasActiveSession: false }, { sessionType: null })).toBeNull()
  })

  it('redirects to the freeform route when a freeform session is active and the user is elsewhere', () => {
    const buffer = { hasActiveSession: true, sessionType: 'freeform', parentIds: {} }
    expect(resolveCrashRecoveryRedirect(buffer, { sessionType: null })).toBe('/practice/freeform')
  })

  it('does not redirect when already on the matching freeform route', () => {
    const buffer = { hasActiveSession: true, sessionType: 'freeform', parentIds: {} }
    expect(resolveCrashRecoveryRedirect(buffer, { sessionType: 'freeform' })).toBeNull()
  })

  it('redirects to the specific in-progress regimen run, not just any regimen route', () => {
    const buffer = { hasActiveSession: true, sessionType: 'regimen', parentIds: { regimenId: 'regimen-A' } }
    expect(resolveCrashRecoveryRedirect(buffer, { sessionType: 'regimen', regimenId: 'regimen-B' })).toBe(
      '/practice/regimens/regimen-A/run',
    )
  })

  it('does not redirect when already on the matching regimen run route', () => {
    const buffer = { hasActiveSession: true, sessionType: 'regimen', parentIds: { regimenId: 'regimen-A' } }
    expect(resolveCrashRecoveryRedirect(buffer, { sessionType: 'regimen', regimenId: 'regimen-A' })).toBeNull()
  })

  it('resolves a redirect target even from an unrelated page — the pure function does not know this only gets called once per app load', () => {
    // The "don't yank the user back mid-browsing" guarantee comes from
    // useCrashRecoveryRedirect calling this exactly once per app load, not
    // from this function refusing to redirect — see crashRecovery.js's doc
    // comment. This test just pins the resolver's own (context-free) output.
    const buffer = { hasActiveSession: true, sessionType: 'regimen', parentIds: { regimenId: 'regimen-A' } }
    const redirect = resolveCrashRecoveryRedirect(buffer, { sessionType: null })
    expect(redirect).toBe('/practice/regimens/regimen-A/run')
  })
})
