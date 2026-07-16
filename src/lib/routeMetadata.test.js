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
    expect(resolveRouteMetadata('/courses')).toMatchObject({ id: 'courses-root', section: 'courses', scrollKey: 'courses-root' })
  })

  it('keeps the locker compatibility route inside the collection-first DISCS section', () => {
    expect(resolveRouteMetadata('/bag/locker')).toMatchObject({ id: 'disc-collection', section: 'discs' })
    expect(resolveRouteMetadata('/bag')).toMatchObject({ id: 'discs-root', title: 'Discs' })
  })

  it('classifies the course and round trees with explicit workflow metadata', () => {
    expect(resolveRouteMetadata('/courses/new')).toMatchObject({
      id: 'courses-new',
      section: 'courses',
      preserveNestedState: true,
    })
    expect(resolveRouteMetadata('/courses/course-1')).toMatchObject({ id: 'course-detail', section: 'courses' })
    expect(resolveRouteMetadata('/rounds/new')).toMatchObject({ id: 'round-start', preserveNestedState: true })
    expect(resolveRouteMetadata('/rounds/round-1')).toMatchObject({ id: 'round-scorecard', preserveNestedState: true })
    expect(resolveRouteMetadata('/rounds/round-1/summary')).toMatchObject({ id: 'round-summary', preserveNestedState: false })
  })

  it('keeps the global notification fallback inside the standard shell', () => {
    expect(resolveRouteMetadata('/notifications')).toMatchObject({
      id: 'notifications',
      shell: SHELL_TYPES.STANDARD,
      scrollKey: 'notifications',
    })
  })

  it('preserves only expected resumable or editing workflows', () => {
    expect(resolveRouteMetadata('/practice/regimens/new').preserveNestedState).toBe(true)
    expect(resolveRouteMetadata('/bag/manage').preserveNestedState).toBe(true)
    expect(resolveRouteMetadata('/bag/discs/new').preserveNestedState).toBe(true)
    expect(resolveRouteMetadata('/practice/history').preserveNestedState).toBe(false)
    expect(resolveRouteMetadata('/practice/history/deleted')).toMatchObject({
      id: 'practice-history-deleted',
      title: 'Recently Deleted',
      scrollKey: 'play-history-deleted',
    })
    expect(resolveRouteMetadata('/bag/discs/disc-1').preserveNestedState).toBe(false)
    expect(resolveRouteMetadata('/bag/compare')).toMatchObject({
      id: 'disc-compare',
      section: 'discs',
      scrollKey: 'discs-compare',
    })
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
    expect(resolveSectionRoot('courses')).toBe('/courses')
  })

  it('returns null for an unknown path instead of inventing shell behavior', () => {
    expect(resolveRouteMetadata('/not-a-route')).toBeNull()
  })
})
