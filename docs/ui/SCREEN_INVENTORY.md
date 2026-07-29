# Screen Inventory

The canonical route → component → document → status table. **Screen status lives here and nowhere else.**
Individual screen documents link to this file rather than carrying a status field of their own, so status
can never disagree with itself.

Generated from `src/lib/routeMetadata.js` and `src/App.jsx` at `eb9fd2b`. When a route is added, this
table and `routeMetadata.js` change together.

## Legend

| Doc status | Meaning |
|---|---|
| ✅ | Screen document written and verified against code |
| ⬜ | No document yet |
| 🔶 | Document exists but is provisional — blocked on an ADR or an unresolved correction |

Shell types come from `SHELL_TYPES` in `routeMetadata.js`: `standard` is the ordinary header + scroll
region + tab bar; `active` is the non-scrolling field capture shell; `none` is pre-shell (splash, auth,
onboarding).

## PLAY section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `play-root` | `/practice` | `PracticeMenuPage` | standard | ✓ | ⬜ |
| `freeform-active` | `/practice/freeform` | `FreeformLogPage` | **active** | — | ⬜ |
| `regimen-select` | `/practice/regimens` | `RegimenSelectPage` | standard | ✓ | ⬜ |
| `routine-builder` | `/practice/regimens/new` | `RoutineBuilderPage` | standard | ✓ | ⬜ |
| `regimen-active` | `/practice/regimens/:regimenId/run` | `RegimenRunPage` | **active** | — | ⬜ |
| `practice-history` | `/practice/history` | `HistoryPage` | standard | ✓ | ⬜ |
| `practice-history-deleted` | `/practice/history/deleted` | `HistoryPage deleted` | standard | ✓ | ⬜ |
| `practice-history-detail` | `/practice/history/:type/:id` | `HistoryDetailPage` | standard | ✓ | ⬜ |
| `practice-stats` | `/practice/stats` | `ConfidenceMapPage` | standard | ✓ | ⬜ |
| `notifications` | `/notifications` | `NotificationsPage` | standard | ✓ | ⬜ |

`notifications` carries `section: 'play'` but sits outside the `/practice` tree — it is the shared
notification destination reachable from the global header.

## DISCS section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `discs-root` | `/bag` | `BagPage` | standard | ✓ | ⬜ |
| `disc-collection` | `/bag/locker` | `BagLockerPage` | standard | ✓ | ⬜ |
| `bag-manage` | `/bag/manage` | `BagManagePage` | standard | ✓ | ⬜ |
| `disc-compare` | `/bag/compare` | `DiscComparePage` | standard | ✓ | ⬜ |
| `lost-found` | `/bag/lost-found` | `LostFoundPage` | standard | ✓ | ⬜ |
| `disc-new` | `/bag/discs/new` | `DiscFormPage` | standard | ✓ | ⬜ |
| `disc-detail` | `/bag/discs/:discId` | `DiscDetailPage` | standard | ✓ | **✅** |

`disc-detail` is the reference example for `TEMPLATE.md`.

## COURSES section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `courses-root` | `/courses` | `CoursesPage` | standard | ✓ | ⬜ |
| `courses-new` | `/courses/new` | `CourseFormPage` | standard | ✓ | ⬜ |
| `course-detail` | `/courses/:courseId` | `CourseDetailPage` | standard | ✓ | ⬜ |
| `rounds-root` | `/rounds` | `RoundsPage` | standard | ✓ | ⬜ |
| `round-start` | `/rounds/new` | `RoundStartPage` | standard | ✓ | ⬜ |
| `round-scorecard` | `/rounds/:roundId` | `RoundScorecardPage` | standard | ✓ | 🔶 blocked on ADR 0001 |
| `round-summary` | `/rounds/:roundId/summary` | `RoundSummaryPage` | standard | ✓ | 🔶 blocked on ADR 0001 |

The `/rounds` tree carries `section: 'courses'` — rounds are reached through the COURSES tab, which is
why they highlight it rather than PLAY.

## ME section

| Route id | Path | Component | Shell | Pill | Doc |
|---|---|---|---|---|---|
| `me-root` | `/profile` | `CareerHubPage` | standard | ✓ | ⬜ |
| `profile-details` | `/profile/details` | `ProfilePage` | standard | ✓ | ⬜ |
| `settings` | `/profile/settings` | `SettingsPage` | standard | ✓ | ⬜ |
| `goals` | `/profile/goals` | `GoalsPage` | standard | ✓ | ⬜ |
| `weekly-reports` | `/profile/reports` | `WeeklyReportsPage` | standard | ✓ | ⬜ |
| `trophy-room` | `/profile/trophies` | `TrophyRoomPage` | standard | ✓ | ⬜ |

`me-root` renders `CareerHubPage`, not `ProfilePage`. This is the "ME opens on a takeaway-first analytics
summary" behavior from `PRODUCT_ROADMAP.md:28` — profile identity fields live one level down at
`/profile/details`.

## Pre-shell

| Route id | Path | Component | Shell | Doc |
|---|---|---|---|---|
| `root` | `/` | `SplashPage`, or redirect to `/practice` when authenticated | none | ⬜ |
| `login` | `/login` | `AuthPage` | none | ⬜ |
| `onboarding` | `/onboarding` | `OnboardingPage` | none | ⬜ |

`onboarding` requires a session (guest or real) but renders outside the tab shell; the onboarding gate in
`AppShell` is what routes a never-onboarded user there.

## Aliases

| Legacy path | Canonical | Source |
|---|---|---|
| `/regimens` | `/practice/regimens` | `LEGACY_ROUTE_ALIASES`, resolved by `resolveCanonicalPath()` |

## Not in this inventory

**Parked blueprint screens.** `MASTER_PROJECT_BLUEPRINT.md` Screens 14–21 have no routes and are not
tracked here. Parking reasons are in `SCREEN_SPECS.md`.

**Screen 13 — UDisc CSV ingestion.** Unbuilt but still planned (owner, 2026-07-29). It has no route, so
it has no row; its forward-looking design document will live at `screens/_planned/udisc-ingestion.md` and
is marked as unbuilt. Do not add a row until a route exists.

**Screens 10 and 11.** The blueprint's Analytics Control Tower and Player Career Hub do not exist as
standalone destinations. Their content is distributed — `practice-stats`, `me-root`, `settings`,
`profile-details`. See `_corrections/screen-specs-and-agents.md` C-2.

## Counts

| | Count |
|---|---:|
| Routes in `routeMetadata.js` | 33 |
| Distinct page components | 32 |
| Screen documents written | 1 |
| Remaining | 32 |

`HistoryPage` serves two routes (`practice-history` and `practice-history-deleted`, the latter via a
`deleted` prop), which is why routes exceed components by one.
