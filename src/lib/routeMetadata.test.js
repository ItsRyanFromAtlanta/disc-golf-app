import { describe, expect, it } from 'vitest'
import { LEGACY_ROUTE_ALIASES, SHELL_TYPES, resolveActivityResume, resolveCanonicalPath, resolveRouteMetadata, resolveSectionRoot } from './routeMetadata'
import { ACTIVITY_TYPES } from './activityLifecycle/types'

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

  it('keeps profile editing nested under the ME career summary', () => {
    expect(resolveRouteMetadata('/profile/details')).toMatchObject({
      id: 'profile-details', section: 'me', title: 'Profile', preserveNestedState: true,
    })
  })

  it('keeps settings nested under ME with preserved form state', () => {
    expect(resolveRouteMetadata('/profile/settings')).toMatchObject({
      id: 'settings', section: 'me', title: 'Settings', preserveNestedState: true,
    })
  })

  it('keeps goal lifecycle management nested under ME', () => {
    expect(resolveRouteMetadata('/profile/goals')).toMatchObject({
      id: 'goals', section: 'me', title: 'Goals', preserveNestedState: true,
    })
  })

  it('keeps immutable weekly report history nested under ME', () => {
    expect(resolveRouteMetadata('/profile/reports')).toMatchObject({
      id: 'weekly-reports', section: 'me', title: 'Weekly Reports', preserveNestedState: false,
    })
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
    // The prep sheet is a nested course route, so it must not be swallowed by
    // the course-detail pattern above it.
    expect(resolveRouteMetadata('/courses/course-1/prep')).toMatchObject({
      id: 'course-prep',
      section: 'courses',
      title: 'Course Prep',
      preserveNestedState: true,
    })
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

describe('resolving where a live activity is resumed', () => {
  // The regression this exists for: the header pill resolved a destination for
  // the two putting types only, so a live round — the activity the seven
  // COURSES routes carry `showActivityPill` for — advertised nothing anywhere.
  it('sends a live round to its own scorecard, keyed by the activity id', () => {
    expect(resolveActivityResume({ id: 'round-1', type: ACTIVITY_TYPES.DISC_GOLF_ROUND })).toEqual({
      href: '/rounds/round-1',
      label: 'Resume active round',
    })
    // Two live rounds must not resolve to one another's scorecard.
    expect(resolveActivityResume({ id: 'round-2', type: ACTIVITY_TYPES.DISC_GOLF_ROUND }).href).toBe('/rounds/round-2')
  })

  // Both putting types keep the accessible name the shipped shell already had.
  // The name describes what the user returns to, and a regimen run is practice
  // as much as a freeform session is; only the round needed a different word.
  it('still resolves both putting capture screens under their existing accessible name', () => {
    expect(resolveActivityResume({ id: 'a-1', type: ACTIVITY_TYPES.PUTTING_FREEFORM })).toEqual({
      href: '/practice/freeform',
      label: 'Resume active practice',
    })
    expect(
      resolveActivityResume({ id: 'a-2', type: ACTIVITY_TYPES.PUTTING_REGIMEN, metadata: { regimenId: 'r-9' } }),
    ).toEqual({ href: '/practice/regimens/r-9/run', label: 'Resume active practice' })
  })

  it('resolves every destination it names to a route the shell actually serves', () => {
    const activities = [
      { id: 'a-1', type: ACTIVITY_TYPES.PUTTING_FREEFORM },
      { id: 'a-2', type: ACTIVITY_TYPES.PUTTING_REGIMEN, metadata: { regimenId: 'r-9' } },
      { id: 'round-1', type: ACTIVITY_TYPES.DISC_GOLF_ROUND },
    ]
    for (const activity of activities) {
      expect(resolveRouteMetadata(resolveActivityResume(activity).href)).not.toBeNull()
    }
  })

  it('advertises nothing when there is genuinely nowhere to send the user', () => {
    expect(resolveActivityResume(null)).toBeNull()
    expect(resolveActivityResume(undefined)).toBeNull()
    // A regimen run whose parent regimen was never recorded has no runnable URL.
    expect(resolveActivityResume({ id: 'a-3', type: ACTIVITY_TYPES.PUTTING_REGIMEN })).toBeNull()
    // Declared lifecycle types with no capture screen shipped yet.
    expect(resolveActivityResume({ id: 'a-4', type: ACTIVITY_TYPES.FIELDWORK })).toBeNull()
    expect(resolveActivityResume({ id: 'a-5', type: 'not_a_type' })).toBeNull()
  })
})
