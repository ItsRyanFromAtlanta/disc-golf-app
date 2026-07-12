import { describe, expect, it } from 'vitest'
import { LEGACY_ROUTE_ALIASES, SHELL_TYPES, resolveCanonicalPath, resolveRouteMetadata, resolveSectionRoot } from './routeMetadata'

describe('route metadata contract', () => {
  it('classifies every shipped active capture route as a resumable active shell without the activity pill', () => {
    for (const pathname of ['/practice/freeform', '/practice/regimens/foundation/run']) {
      const route = resolveRouteMetadata(pathname)
      expect(route.section).toBe('play')
      expect(route.shell).toBe(SHELL_TYPES.ACTIVE)
      expect(route.showActivityPill).toBe(false)
      expect(route.preserveNestedState).toBe(true)
      expect(route.scrollKey).toBeNull()
    }
  })

  it('classifies each current section root under its approved future section name', () => {
    expect(resolveRouteMetadata('/practice')).toMatchObject({ id: 'play-root', section: 'play', scrollKey: 'play-root' })
    expect(resolveRouteMetadata('/bag')).toMatchObject({ id: 'discs-root', section: 'discs', scrollKey: 'discs-root' })
    expect(resolveRouteMetadata('/profile')).toMatchObject({ id: 'me-root', section: 'me', scrollKey: 'me-root' })
  })

  it('preserves only expected resumable or editing workflows', () => {
    expect(resolveRouteMetadata('/practice/regimens/new').preserveNestedState).toBe(true)
    expect(resolveRouteMetadata('/bag/manage').preserveNestedState).toBe(true)
    expect(resolveRouteMetadata('/bag/discs/new').preserveNestedState).toBe(true)
    expect(resolveRouteMetadata('/practice/history').preserveNestedState).toBe(false)
    expect(resolveRouteMetadata('/bag/discs/disc-1').preserveNestedState).toBe(false)
  })

  it('keeps public routes outside an authenticated shell', () => {
    expect(resolveRouteMetadata('/login')).toMatchObject({ id: 'login', shell: SHELL_TYPES.NONE })
    expect(resolveRouteMetadata('/onboarding')).toMatchObject({ id: 'onboarding', shell: SHELL_TYPES.NONE })
  })

  it('documents and resolves the shipped legacy regimen alias', () => {
    expect(LEGACY_ROUTE_ALIASES).toEqual({ '/regimens': '/practice/regimens' })
    expect(resolveCanonicalPath('/regimens')).toBe('/practice/regimens')
    expect(resolveRouteMetadata('/regimens')).toMatchObject({
      id: 'regimen-select',
      pathname: '/practice/regimens',
      isLegacyAlias: true,
    })
  })

  it('maps each approved section to its current compatibility root', () => {
    expect(resolveSectionRoot('play')).toBe('/practice')
    expect(resolveSectionRoot('discs')).toBe('/bag')
    expect(resolveSectionRoot('me')).toBe('/profile')
    expect(resolveSectionRoot('courses')).toBeNull()
  })

  it('returns null for an unknown path instead of inventing shell behavior', () => {
    expect(resolveRouteMetadata('/not-a-route')).toBeNull()
  })
})
