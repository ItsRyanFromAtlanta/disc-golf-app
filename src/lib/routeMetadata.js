// Phase A route contract. This is intentionally UI-framework-free so the shell,
// redirects, recovery logic, and tests use one description of every shipped
// route before A2 changes any rendered navigation.

import { ACTIVITY_TYPES } from './activityLifecycle/types'

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
    id: 'course-prep',
    match: /^\/courses\/[^/]+\/prep$/,
    section: 'courses',
    shell: SHELL_TYPES.STANDARD,
    title: 'Course Prep',
    showActivityPill: true,
    // The layout picker lives in the query string, so returning to the sheet
    // from a round should land where the player left it rather than resetting
    // to the default layout.
    preserveNestedState: true,
    scrollKey: 'courses-prep',
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
    id: 'lost-found',
    match: /^\/bag\/lost-found$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Lost & Found',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'discs-lost-found',
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
    id: 'disc-compare',
    match: /^\/bag\/compare$/,
    section: 'discs',
    shell: SHELL_TYPES.STANDARD,
    title: 'Compare Discs',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'discs-compare',
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
    id: 'weekly-reports',
    match: /^\/profile\/reports$/,
    section: 'me',
    shell: SHELL_TYPES.STANDARD,
    title: 'Weekly Reports',
    showActivityPill: true,
    preserveNestedState: false,
    scrollKey: 'me-weekly-reports',
  },
  {
    id: 'goals',
    match: /^\/profile\/goals$/,
    section: 'me',
    shell: SHELL_TYPES.STANDARD,
    title: 'Goals',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'me-goals',
  },
  {
    id: 'settings',
    match: /^\/profile\/settings$/,
    section: 'me',
    shell: SHELL_TYPES.STANDARD,
    title: 'Settings',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'me-settings',
  },
  {
    id: 'profile-details',
    match: /^\/profile\/details$/,
    section: 'me',
    shell: SHELL_TYPES.STANDARD,
    title: 'Profile',
    showActivityPill: true,
    preserveNestedState: true,
    scrollKey: 'me-profile',
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

// Where a live activity is resumed, and what to call that in an accessible
// name.
//
// The shell's header pill exists to put a user back inside whatever is running.
// It used to answer that with two hardcoded branches — regimen and freeform —
// so every other activity type resolved to no destination and the pill rendered
// nothing. The type that most needs it is `disc_golf_round`: all seven COURSES
// routes declare `showActivityPill: true` and all seven can be visited with a
// round live, which made the flag inert for exactly the case it was added for.
//
// A table keyed on activity type rather than a chain of conditionals, because
// the question "where does this activity live" is one lookup per type. A
// capture screen added later is a row here, not a new branch in the shell. The
// remaining declared types (`putting_game`, `fieldwork`, `course_practice`,
// `league_match`) have no capture route shipped yet, so they resolve to no
// destination — which is honest, not the same omission: there is nowhere to
// send a user, rather than somewhere we forgot to name.
const ACTIVITY_RESUME_DESTINATIONS = Object.freeze({
  [ACTIVITY_TYPES.PUTTING_FREEFORM]: {
    label: 'Resume active practice',
    href: () => '/practice/freeform',
  },
  [ACTIVITY_TYPES.PUTTING_REGIMEN]: {
    // Same name as freeform on purpose: a regimen run and a freeform session
    // are both putting practice, and the accessible name describes what the
    // user is going back to, not which screen renders it. Only the round
    // needed a different word.
    label: 'Resume active practice',
    href: (activity) =>
      activity.metadata?.regimenId ? `/practice/regimens/${activity.metadata.regimenId}/run` : null,
  },
  [ACTIVITY_TYPES.DISC_GOLF_ROUND]: {
    // `ensureRoundActivity` creates the lifecycle parent with the round's own
    // id, so the activity id *is* the scorecard's route parameter. No schema
    // change or metadata lookup is needed to route back to a live round.
    label: 'Resume active round',
    href: (activity) => (activity.id ? `/rounds/${activity.id}` : null),
  },
})

export function resolveActivityResume(activity) {
  const destination = activity?.type ? ACTIVITY_RESUME_DESTINATIONS[activity.type] : null
  if (!destination) return null
  const href = destination.href(activity)
  return href ? { href, label: destination.label } : null
}

export function resolveSectionRoot(section) {
  return {
    play: '/practice',
    discs: '/bag',
    courses: '/courses',
    me: '/profile',
  }[section] ?? null
}
