# Navigation Map

The global movement contract: shell ownership, the route tree, guards, back and tab behavior, the sheet
layer, and redirects. Screen documents describe *their* entries and exits; this file describes the system
those entries and exits operate inside.

Verified against `eb9fd2b`. Sources: `src/lib/routeMetadata.js`, `src/App.jsx`,
`src/components/AppShell.jsx`, `TabBar.jsx`, `ProtectedRoute.jsx`, and the hooks below.

## Section names are not URLs

The single most confusing thing about this app's navigation, stated once so no screen document has to
restate it:

| Section | Tab label | Root URL |
|---|---|---|
| `play` | Play | `/practice` |
| `discs` | Discs | `/bag` |
| `courses` | Courses | `/courses` |
| `me` | Me | `/profile` |

`resolveSectionRoot(section)` is the mapping. Section vocabulary is canonical — it is what
`routeMetadata`, the tab bar, and the architecture contract speak. The URLs are historical and are not
worth breaking saved links to change.

This is why `PHASE_A_ARCHITECTURE.md:206` naming `/play`, `/discs`, `/me` is **not** a contradiction of
the router. It is describing sections. See `_corrections/screen-specs-and-agents.md` C-5.

## Shell ownership

`AppShell` wraps every authenticated route and branches on `route.shell`:

**`standard`** — renders `GlobalHeader` → `ScreenScrollRegion` (the single scroll owner) → `TabBar`.
Pages render into an `Outlet` inside the scroll region and must not manage headers, tab clearance, or
safe-area insets themselves (`PHASE_A_ARCHITECTURE.md` § 13).

**`active`** — renders the page inside `.active-activity-shell` with **no header, no scroll region, and
no tab bar**. This is the field capture shell. Only two routes use it: `freeform-active` and
`regimen-active`. Both carry `scrollKey: null` and `showActivityPill: false`, because there is nothing to
scroll and no elsewhere-activity to advertise while you are inside the activity.

**`none`** — pre-shell. `/`, `/login`, `/onboarding` render without `AppShell` entirely.

`SheetHost` and `ToastHost` mount outside the shell branch, so both shells share one sheet layer.

## Route tree

Full table in `SCREEN_INVENTORY.md`. Shape only, here:

```
/                          root .................. SplashPage, or redirect to /practice when signed in
/login                     login ................. AuthPage
/onboarding                onboarding ............ OnboardingPage (session required, shell-less)

AppShell (ProtectedRoute)
  /notifications           notifications ......... section: play
  /practice                play-root
    /freeform              freeform-active ....... ACTIVE SHELL
    /regimens              regimen-select
      /new                 routine-builder
      /:regimenId/run      regimen-active ........ ACTIVE SHELL
    /history               practice-history
      /deleted             practice-history-deleted
      /:type/:id           practice-history-detail
    /stats                 practice-stats
  /bag                     discs-root
    /locker                disc-collection
    /manage                bag-manage
    /compare               disc-compare
    /lost-found            lost-found
    /discs/new             disc-new
    /discs/:discId         disc-detail
  /courses                 courses-root
    /new                   courses-new
    /:courseId             course-detail
  /rounds                  rounds-root ........... section: courses
    /new                   round-start
    /:roundId              round-scorecard
    /:roundId/summary      round-summary
  /profile                 me-root ............... renders CareerHubPage, not ProfilePage
    /details               profile-details
    /settings              settings
    /goals                 goals
    /reports               weekly-reports
    /trophies              trophy-room
```

Two placements that look wrong and are not: `/notifications` is `section: play` but lives outside
`/practice`, and the whole `/rounds` tree is `section: courses` so it highlights the COURSES tab.

## Guards and interceptors

Four things can redirect a navigation. They run inside `AppShell`, in this order:

| Guard | Source | Behavior |
|---|---|---|
| `ProtectedRoute` | `ProtectedRoute.jsx` | Renders `Loading...` while auth resolves; `<Navigate to="/login" replace />` when there is no user. Wraps the entire shell. |
| `useCrashRecoveryRedirect` | hook | Runs **once per app load**, not per navigation. Resumes a killed-and-relaunched PWA that reopened on the wrong page. |
| `useOnboardingGate` | hook | Routes a never-onboarded user (zero bags) to `/onboarding` before they reach the tab-barred shell. |
| `useActivityNavigationLifecycle` | hook | Observes the active activity across navigation. |

A screen document's "Auth / guard" flow path should name which of these can intercept it rather than
re-describing the mechanism.

## Back behavior

`GlobalHeader` shows a back control when a route resolves **and is not its section root** —
`showBack = Boolean(route && !isRoot)`, where `isRoot` means `resolveSectionRoot(route.section) ===
pathname`.

Back is **not** browser history. `handleBack()` calls `navigate(resolveSectionRoot(route.section))` —
it jumps to the section root. From `/bag/discs/:discId`, back goes to `/bag`, not to the locker you
arrived from. Screens wanting a different return path provide their own in-page link, as `disc-detail`
does with its `Locker` link.

## Tab press behavior

`resolveTabPressAction({ isTargetActive, isAtTop, hasRequestedTop })` resolves each press to one of three
actions, tested in `src/lib/navigation.test.js`:

| Action | When | Effect |
|---|---|---|
| `NAVIGATE` | Target tab is not the active section | Default `Link` navigation |
| `SCROLL_TO_TOP` | Active tab, not already at top | Smooth-scrolls the region; no navigation |
| Navigate to section root | Active tab, already at top | `navigate(resolveSectionRoot(...))` |

So the active tab is a three-state control: go there → scroll up → return to root. Scroll positions are
retained per `scrollKey` in a ref map and restored in a `useLayoutEffect`; a route with
`preserveNestedState: false` still has its position stored, but returns to it only within a single shell
mount.

## Sheet layer

One `SheetHost` mounted outside the shell branch, driven by a single `sheet` state object in `AppShell`.
When a sheet is open, the standard content is marked `aria-hidden`, satisfying the background-inert rule
in `PHASE_A_ARCHITECTURE.md` § 12.

Only one sheet is opened by the shell today: **Notifications**, from the header bell.
`NotificationSheet` marks a notification read, closes the sheet, then navigates to its destination.
Page-level sheets (putter picker, weather, filters) are opened by pages themselves.

The one-sheet-at-a-time rule is a contract, not an accident — do not add a second concurrent sheet host.

## Activity pill

`showActivityPill` in route metadata controls whether the header advertises a running activity. The
target is computed in `AppShell`:

- `putting_regimen` with a `regimenId` → `/practice/regimens/:regimenId/run`
- `putting_freeform` → `/practice/freeform`
- otherwise → no link

Both active-shell routes set `showActivityPill: false`, since you are already inside the activity.

## Aliases and canonicalization

`resolveCanonicalPath()` maps legacy paths before matching. One alias exists:

| Legacy | Canonical |
|---|---|
| `/regimens` | `/practice/regimens` |

`resolveRouteMetadata()` returns `isLegacyAlias: true` when canonicalization changed the path, so callers
can distinguish an aliased arrival. Unmatched paths return `null` — `AppShell` then falls back to the
title `Disc Golf` and hides the back control.

## Deep links

Every route is directly addressable and survives reload; there is no navigation state held outside the
URL except scroll positions.

**Eight query parameters across seven screens.** All are read-only — `grep -rn "setSearchParams("
src/pages/` returns nothing, so no screen ever writes back to the URL:

| Parameter | Route | Read at | Purpose |
|---|---|---|---|
| `addToBag` | `/bag/locker` | `BagLockerPage.jsx:19` | Add-to-bag mode for a specific bag |
| `mold` | `/bag/discs/new` | `DiscFormPage.jsx:44` | Pre-select a catalog mold |
| `plastic` | `/bag/discs/new` | `DiscFormPage.jsx:51` | Pre-select a plastic |
| `ids` | `/bag/compare` | `DiscComparePage.jsx:71-77` | Comma-split, deduped, capped at `COMPARE_MAX`. The only repeatable parameter — uses `getAll` |
| `disc` | `/bag/lost-found` | `LostFoundPage.jsx:54` | Link a disc to its case |
| `distance` | `/practice/freeform` | `FreeformLogPage.jsx:66` | Trophy Room pursuit-drill starting distance |
| `clone` | `/practice/regimens/new` | `RoutineBuilderPage.jsx:46` | CLONE & TWEAK source routine |
| `courseId`, `layoutId` | `/rounds/new` | `RoundStartPage.jsx:13-14` | Pre-select course and layout |

None has a shared constant between producer and consumer — every one is a bare string literal on both
sides, so a rename breaks the link silently and no test would catch it. `ids` is the only one with input
hardening (trim, dedupe, cap); `disc` is unvalidated.

A screen that accepts query parameters must document them in its Entry and exit table.
