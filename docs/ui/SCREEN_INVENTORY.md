# Screen Inventory

The canonical route → component → document → status table. **Screen status lives here and nowhere else.**
Individual screen documents link to this file rather than carrying a status field of their own, so status
can never disagree with itself.

Generated from `src/lib/routeMetadata.js` and `src/App.jsx`. When a route is added, this table and
`routeMetadata.js` change together.

## Legend

| Doc status | Meaning |
|---|---|
| ✅ | Screen document written and verified against code |
| 🔶 | Written but provisional — blocked on an ADR or an unresolved correction |
| ⬜ | No document yet |

Shell types come from `SHELL_TYPES` in `routeMetadata.js`: `standard` is the ordinary header + scroll
region + tab bar; `active` is the non-scrolling field capture shell; `none` is pre-shell (splash, auth,
onboarding).

**Coverage is complete.** All 33 routes have documents.

## PLAY section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `play-root` | `/practice` | `PracticeMenuPage` | standard | ✓ | [✅](screens/play-root.md) |
| `freeform-active` | `/practice/freeform` | `FreeformLogPage` | **active** | — | [✅](screens/freeform-active.md) |
| `regimen-select` | `/practice/regimens` | `RegimenSelectPage` | standard | ✓ | [✅](screens/regimen-select.md) |
| `routine-builder` | `/practice/regimens/new` | `RoutineBuilderPage` | standard | ✓ | [✅](screens/routine-builder.md) |
| `regimen-active` | `/practice/regimens/:regimenId/run` | `RegimenRunPage` | **active** | — | [✅](screens/regimen-active.md) |
| `practice-history` | `/practice/history` | `HistoryPage` | standard | ✓ | [✅](screens/practice-history.md) |
| `practice-history-deleted` | `/practice/history/deleted` | `HistoryPage deleted` | standard | ✓ | [✅](screens/practice-history-deleted.md) |
| `practice-history-detail` | `/practice/history/:type/:id` | `HistoryDetailPage` | standard | ✓ | [✅](screens/practice-history-detail.md) |
| `practice-stats` | `/practice/stats` | `ConfidenceMapPage` | standard | ✓ | [✅](screens/practice-stats.md) |
| `notifications` | `/notifications` | `NotificationsPage` | standard | ✓ | [✅](screens/notifications.md) |

`notifications` carries `section: 'play'` but sits outside the `/practice` tree — it is the shared
notification destination reachable from the global header.

## DISCS section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `discs-root` | `/bag` | `BagPage` | standard | ✓ | [✅](screens/discs-root.md) |
| `disc-collection` | `/bag/locker` | `BagLockerPage` | standard | ✓ | [✅](screens/disc-collection.md) |
| `bag-manage` | `/bag/manage` | `BagManagePage` | standard | ✓ | [✅](screens/bag-manage.md) |
| `disc-compare` | `/bag/compare` | `DiscComparePage` | standard | ✓ | [✅](screens/disc-compare.md) |
| `lost-found` | `/bag/lost-found` | `LostFoundPage` | standard | ✓ | [✅](screens/lost-found.md) |
| `disc-new` | `/bag/discs/new` | `DiscFormPage` | standard | ✓ | [✅](screens/disc-new.md) |
| `disc-detail` | `/bag/discs/:discId` | `DiscDetailPage` | standard | ✓ | [✅](screens/disc-detail.md) |

`disc-detail` is the reference example for `TEMPLATE.md`.

## COURSES section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `courses-root` | `/courses` | `CoursesPage` | standard | ✓ | [✅](screens/courses-root.md) |
| `courses-new` | `/courses/new` | `CourseFormPage` | standard | ✓ | [✅](screens/courses-new.md) |
| `course-detail` | `/courses/:courseId` | `CourseDetailPage` | standard | ✓ | [✅](screens/course-detail.md) |
| `rounds-root` | `/rounds` | `RoundsPage` | standard | ✓ | [✅](screens/rounds-root.md) |
| `round-start` | `/rounds/new` | `RoundStartPage` | standard | ✓ | [✅](screens/round-start.md) |
| `round-scorecard` | `/rounds/:roundId` | `RoundScorecardPage` | standard | ✓ | [🔶](screens/round-scorecard.md) ADR 0001 |
| `round-summary` | `/rounds/:roundId/summary` | `RoundSummaryPage` | standard | ✓ | [🔶](screens/round-summary.md) ADR 0001 |

The `/rounds` tree carries `section: 'courses'` — rounds are reached through the COURSES tab, which is
why they highlight it rather than PLAY.

## ME section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `me-root` | `/profile` | `CareerHubPage` | standard | ✓ | [✅](screens/me-root.md) |
| `profile-details` | `/profile/details` | `ProfilePage` | standard | ✓ | [✅](screens/profile-details.md) |
| `settings` | `/profile/settings` | `SettingsPage` | standard | ✓ | [✅](screens/settings.md) |
| `goals` | `/profile/goals` | `GoalsPage` | standard | ✓ | [✅](screens/goals.md) |
| `weekly-reports` | `/profile/reports` | `WeeklyReportsPage` | standard | ✓ | [✅](screens/weekly-reports.md) |
| `trophy-room` | `/profile/trophies` | `TrophyRoomPage` | standard | ✓ | [✅](screens/trophy-room.md) |

`me-root` renders `CareerHubPage`, not `ProfilePage`. This is the "ME opens on a takeaway-first analytics
summary" behavior from `PRODUCT_ROADMAP.md:28` — profile identity fields live one level down at
`/profile/details`.

## Pre-shell

| Route id | Path | Component | Shell | Doc |
|---|---|---|---|---|
| `root` | `/` | `SplashPage`, or redirect to `/practice` when authenticated | none | [✅](screens/root.md) |
| `login` | `/login` | `AuthPage` | none | [✅](screens/login.md) |
| `onboarding` | `/onboarding` | `OnboardingPage` | none | [✅](screens/onboarding.md) |

`PUBLIC_ROUTES` (`routeMetadata.js:314-318`) declares only `id`, `match`, and `shell`. The other metadata
fields are **absent keys**, not `null` — distinct from `freeform-active`'s deliberate `scrollKey: null`.
`onboarding` is the only `shell: none` route with a guard, wrapped directly in `App.jsx:57-61`.

## Aliases

| Legacy path | Canonical | Source |
|---|---|---|
| `/regimens` | `/practice/regimens` | `LEGACY_ROUTE_ALIASES`, resolved by `resolveCanonicalPath()` |

## Route metadata caveat

`preserveNestedState` is declared on all 30 app routes and asserted in `routeMetadata.test.js`, but **no
runtime code reads it**. `AppShell` restores scroll from `scrollKey` alone, and parameterized routes
share one key per pattern — so scroll leaks between instances (between two different discs, two different
courses, two different rounds). See `_corrections/courses-screens.md` CS-1 and `screens/disc-detail.md`
§ 2. The field is not a behavior contract today; do not write documentation that assumes it is.

## Not in this inventory

**Parked blueprint screens.** `MASTER_PROJECT_BLUEPRINT.md` Screens 14–21 have no routes and are not
tracked here. Parking reasons are in `SCREEN_SPECS.md`.

**Screen 13 — UDisc CSV ingestion.** Unbuilt but still planned (owner, 2026-07-29). It has no route, so
it has no row. Its forward-looking design document is outstanding. Do not add a row until a route exists.

**Screens 10 and 11.** The blueprint's Analytics Control Tower and Player Career Hub do not exist as
standalone destinations. Their content is distributed — `practice-stats`, `me-root`, `settings`,
`profile-details`. See `_corrections/screen-specs-and-agents.md` C-2.

## Counts

| | Count |
|---|---:|
| Routes in `routeMetadata.js` | 33 |
| Distinct page components | 32 |
| Screen documents | **33** |
| Verified (✅) | 31 |
| Provisional (🔶) | 2 |
| Outstanding | 0 |

`HistoryPage` serves two routes (`practice-history` and `practice-history-deleted`, the latter via a
`deleted` prop), which is why routes exceed components by one.
