// Phase A route contract. This is intentionally UI-framework-free so the shell,
// redirects, recovery logic, and tests use one description of every shipped
// route before A2 changes any rendered navigation.

export const SHELL_TYPES = Object.freeze({
  NONE: 'none',
  STANDARD: 'standard',
  ACTIVE: 'active',
})

const APP_ROUTES = [
  {
    id: 'courses-new',
    match: /^\/courses\/new$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Add Course',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'courses-form',
  },
  {
    id: 'course-detail',
    match: /^\/courses\/[^/]+$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Course',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'courses-detail',
  },
  {
    id: 'courses-root',
    match: /^\/courses$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Courses',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'courses-root',
  },
  {
    id: 'round-start',
    match: /^\/rounds\/new$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Start Round',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'round-start',
  },
  {
    id: 'round-summary',
    match: /^\/rounds\/[^/]+\/summary$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Round Summary',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'round-summary',
  },
  {
    id: 'round-scorecard',
    match: /^\/rounds\/[^/]+$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Scorecard',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'round-scorecard',
  },
  {
    id: 'rounds-root',
    match: /^\/rounds$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Rounds',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'rounds-root',
  },
  {
    id: 'notifications',
    match: /^\/notifications$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Notifications',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'notifications',
  },
  {
    id: 'freeform-active',
    match: /^\/practice\/freeform$/,
    section: 'play',
    shell: SHELL_TYPES.ACTIVE,
    title: 'Quick Play',
    showActivityPill: false,
    preserveNestedState: true,
    scrollKey: null,
  },
  {
    id: 'regimen-active',
    match: /^\/practice\/regimens\/[^/]+\/run$/,
    section: 'play',
    shell: SHELL_TYPES.ACTIVE,
    title: 'Routine',
    showActivityPill: false,
    preserveNestedState: true,
    scrollKey: null,
  },
  {
    id: 'routine-builder',
    match: /^\/practice\/regimens\/new$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Create Routine',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'play-routine-builder',
  },
  {
    id: 'practice-history-deleted',
    match: /^\/practice\/history\/deleted$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Recently Deleted',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'play-history-deleted',
  },
  {
    id: 'practice-history-detail',
    match: /^\/practice\/history\/[^/]+\/[^/]+$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Activity Detail',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'play-history-detail',
  },
  {
    id: 'practice-history',
    match: /^\/practice\/history$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'History',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'play-history',
  },
  {
    id: 'practice-stats',
    match: /^\/practice\/stats$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Practice Insights',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'play-stats',
  },
  {
    id: 'regimen-select',
    match: /^\/practice\/regimens$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Select Routine',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'play-regimens',
  },
  {
    id: 'play-root',
    match: /^\/practice$/,
    section: 'play',
    shell: SHELL_TYPES.STANDARD,
    title: 'Play',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'play-root',
  },
  {
    id: 'disc-new',
    match: /^\/bag\/discs\/new$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Add Disc',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'discs-form',
  },
  {
    id: 'disc-detail',
    match: /^\/bag\/discs\/[^/]+$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Disc',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'discs-detail',
  },
  {
    id: 'bag-manage',
    match: /^\/bag\/manage$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Manage Bags',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'discs-bag-manage',
  },
  {
    id: 'disc-collection',
    match: /^\/bag\/locker$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Collection',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'discs-collection',
  },
  {
    id: 'discs-root',
    match: /^\/bag$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Discs',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'discs-root',
  },
  {
    id: 'trophy-room',
    match: /^\/profile\/trophies$/,
    section: 'me',
    shell: SHELL_TYPES.STANDARD,
    title: 'Trophy Room',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'me-trophies',
  },
  {
    id: 'me-root',
    match: /^\/profile$/,
    section: 'me',
    shell: SHELL_TYPES.STANDARD,
    title: 'Me',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'me-root',
  },
]

const PUBLIC_ROUTES = [
  { id: 'root', match: /^\/$/, shell: SHELL_TYPES.NONE },
  { id: 'login', match: /^\/login$/, shell: SHELL_TYPES.NONE },
  { id: 'onboarding', match: /^\/onboarding$/, shell: SHELL_TYPES.NONE },
]

export const LEGACY_ROUTE_ALIASES = Object.freeze({
  '/regimens': '/practice/regimens',
})

export function resolveCanonicalPath(pathname) {
  return LEGACY_ROUTE_ALIASES[pathname] ?? pathname
}

export function resolveRouteMetadata(pathname) {
  const canonicalPath = resolveCanonicalPath(pathname)
  const route = [...APP_ROUTES, ...PUBLIC_ROUTES].find(({ match }) => match.test(canonicalPath))

  if (!route) return null

  return {
    ...route,
    pathname: canonicalPath,
    isLegacyAlias: canonicalPath !== pathname,
  }
}

export function resolveSectionRoot(section) {
  return {
    play: '/practice',
    discs: '/bag',
    courses: '/courses',
    me: '/profile',
  }[section] ?? null
}
