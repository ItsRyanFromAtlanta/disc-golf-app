# Courses

| Field | Value |
|---|---|
| Route id | `courses-root` |
| URL pattern | `/courses` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Courses` |
| Activity pill | declared shown (`showActivityPill: true`) — see note below |
| Scroll key | `courses-root` |
| Preserves nested state | `false` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/CoursesPage.jsx` (98 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

The activity pill is declared but can never render a round. `AppShell.jsx:42-47` computes a pill target
only for `putting_regimen` and `putting_freeform`; a `disc_golf_round` activity yields `null` and
`GlobalHeader.jsx:16` suppresses the pill. See `_corrections/courses-screens.md` CS-7.

## 1. Purpose

The COURSES tab's landing screen: a directory of every course in the shared community catalog, plus the
three most recent rounds as a shortcut back into play. It answers "which course am I playing" and "where
was I" in one glance, and it is the only entry point into the whole `/courses` + `/rounds` tree.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | COURSES tab press | `TabBar` → `resolveSectionRoot('courses')` | The **only** way in from elsewhere in the app. No other page in `src/` links to `/courses`; verified by grep. |
| In | COURSES tab re-tap while already here and at top | `resolveTabPressAction` → navigate to section root | No-op in practice — this route *is* the section root |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; a never-onboarded user is diverted to `/onboarding` by the `AppShell` onboarding gate before this route renders |
| Out | `Add course` (page header) | `Link` to `/courses/new` | |
| Out | `Build a course` (directory empty state) | `Link` to `/courses/new` | Same destination, different copy |
| Out | Course row | `Link` to `/courses/:courseId` | |
| Out | `View all` (My rounds heading) | `Link` to `/rounds` | |
| Out | Recent round row | `Link` to `/rounds/:roundId` | Goes to the **scorecard**, not the summary, for completed rounds too |
| Out | Header bell | Shell-owned sheet | `NotificationSheet` |

**This route highlights the COURSES tab, and so does the entire `/rounds` tree.** `/rounds`,
`/rounds/new`, `/rounds/:roundId`, and `/rounds/:roundId/summary` all carry `section: 'courses'`
(`routeMetadata.js:43-81`), so rounds are reached and highlighted through COURSES rather than PLAY. This
is deliberate and is recorded in `NAVIGATION_MAP.md`; it is the single most surprising fact about
navigating this section.

**Back control:** none. `resolveSectionRoot('courses') === '/courses'`, so `showBack` is `false` here
(`NAVIGATION_MAP.md` § Back behavior). Every other screen in this batch shows a back chevron that returns
here regardless of where the user actually came from.

**Tab re-tap** follows the standard three-state behavior in `NAVIGATION_MAP.md` § Tab press behavior.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|      Courses                              [ bell ]    | <- Shell header; no back control at a section root
+-------------------------------------------------------+
|  COURSES                        [ Add course ]        | <- .practice-header; h1 + .start-button
+-------------------------------------------------------+
|  Directory                            4 courses       | <- .section-heading-row; count pluralizes
|  +-------------------------------------------------+  |
|  | EAST ROSWELL PARK                             -> |  | <- .course-card, whole row is the Link
|  | Roswell, GA                                      |  |
|  +-------------------------------------------------+  |
|  | HORSESHOE BEND                                -> |  |
|  | Location not set                                 |  | <- fallback when course.location is null
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  My rounds                            [ View all ]    |
|  +-------------------------------------------------+  |
|  | EAST ROSWELL PARK                             54 |  | <- total_score, or em-dash
|  | In progress                                      |  |
|  +-------------------------------------------------+  |
|  ( max 3 rows — .slice(0, 3) )                        |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

Empty-state variant of the Directory section:

```
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  | <- .empty-state, dashed border
|  |  No courses yet. Build a quick course for your   |  |
|  |  next round.                                     |  |
|  |  [           Build a course           ]          |  |
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  title "Courses", notification bell; no back control, no activity pill for rounds
Body (shell scroll region, scrollKey courses-root)
  Page header (.practice-header)
    hdr-title ............ h1, "Courses"
    hdr-add .............. "Add course" link, .start-button
  Error banner
    err-inline ........... rendered when (error || roundError); see § 4 for the dead branch
  Directory section (aria-labelledby course-directory-title)
    dir-heading .......... h2 "Directory"
    dir-count ............ "<n> course" / "<n> courses"
    dir-empty ............ empty state: copy + "Build a course" CTA
    dir-row .............. one .course-card per course (name, location, chevron)
  My rounds section (aria-labelledby recent-rounds-title)
    rounds-heading ....... h2 "My rounds"
    rounds-viewall ....... "View all" link
    rounds-empty ......... "Your played rounds will appear here."
    rounds-row ........... one .course-card per round, max 3
Tab bar (shell-owned)
```

There is no page-level footer and no sticky element. The screen is a single scroll of two stacked
sections.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Courses` | — | — | — | always |
| `hdr-add` | link (`.start-button`) | `Add course` | default / pressed | navigate | `/courses/new` | always |
| `err-inline` | `<p class="form-error">` | `error \|\| roundError` | present / absent | — | — | shown when either is truthy. **The `error` term is unreachable**: `CoursesPage.jsx:24` returns a full-page error whenever `error && !courses`, and the single-run effect at `:17-21` sets exactly one of the two, so `error && courses` never holds. Only `roundError` can reach this banner. |
| `dir-heading` | h2 | `Directory` | — | — | — | always |
| `dir-count` | text (`.log-time`) | `<n> course` / `<n> courses` | — | — | — | always; singular when `length === 1` |
| `dir-empty` | block | `No courses yet. Build a quick course for your next round.` + `Build a course` | — | navigate (CTA) | `/courses/new` | shown when `courses.length === 0` |
| `dir-row` | link card | `course.name` (uppercased by CSS) over `course.location \|\| 'Location not set'`, plus a `→` chevron marked `aria-hidden` | default / pressed | navigate | `/courses/:courseId` | one per row in `fetchCourses()`; **no filter, search, sort control, or pagination exists** — the list is whatever the query returns, ordered by `name` |
| `rounds-heading` | h2 | `My rounds` | — | — | — | always |
| `rounds-viewall` | link (`.link-button`) | `View all` | default / pressed | navigate | `/rounds` | always, including when the recent list is empty |
| `rounds-empty` | text (`.log-time`) | `Your played rounds will appear here.` | — | — | — | shown when `recentRounds.length === 0`. Note this is a bare line, **not** the `.empty-state` block the directory uses — two empty-state idioms on one screen (`COPY_AND_TERMINOLOGY.md` § 2) |
| `rounds-row` | link card | `round.course?.name ?? 'Round'` over `Completed` / `In progress`; trailing `round.total_score ?? '—'` | default / pressed | navigate | `/rounds/:roundId` | first 3 of `useRoundList` data |

Route title vs page heading: the shell header reads `Courses` and the page `h1` reads `Courses` — the
one screen in this batch where they agree (`COPY_AND_TERMINOLOGY.md` § 4).

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Course directory | `fetchCourses` | `lib/roundLog` | Supabase (`courses`) | async, **no local mirror** |
| Round list | `useRoundList(user.id)` | `lib/repository/roundRepository` | Supabase + Dexie | React Query hook, `networkMode: 'offlineFirst'` |

Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

Two facts about `fetchCourses` that shape this screen:

1. **The directory is community-wide, not user-scoped.** `roundLog.js:158` is
   `supabase.from('courses').select('*').order('name')` with no `eq('created_by', …)`. Scoping comes
   entirely from RLS, and the shipped policy is
   `for select to authenticated using (true)`
   (`supabase/migrations/20260714150000_phase_c_round_logging_rls.sql:36-40`). Every authenticated user
   sees every course anyone has ever created. This is by design — courses are shared community data
   (`supabase_schema.sql:53`) — but nothing on screen says so, and `dir-count` reads as a personal count.
2. **It is deliberately shallow.** `roundLog.js:159` — "Keep the root directory lightweight. Course
   detail loads layouts/holes." No hole count or par is available here, which is why `dir-row` shows
   location rather than a course summary.

`useRoundList` is the offline-first half of the screen: `readRoundList` (`roundRepository.js:82-96`)
tries `fetchRounds`, mirrors the result into Dexie, prunes rows absent remotely, and falls back to the
Dexie cache on failure — rethrowing only when the cache is also empty.

### Writes

**N/A** — this screen performs no mutations. Every control is a `Link`.

The transaction contract that would apply to any future write is `PHASE_A_ARCHITECTURE.md` § 14.

### Offline

Half the screen survives; half does not.

- **Round list:** survives. `useRoundList` returns cached rounds, and its `online` listener
  (`roundRepository.js:227-234`) flushes the round outbox and invalidates the list on reconnect.
- **Course directory:** does not. `fetchCourses` is a bare Supabase call in a Supabase-only module
  (`LIB_API_INDEX.md:640`), so with no network the promise rejects and `CoursesPage.jsx:24` renders the
  error message **as the entire page** — no header, no rounds, no retry, no navigation other than the tab
  bar. The offline user loses the recent-rounds shortcut too, purely as collateral.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`) is rendered anywhere on this screen. The nearest thing is `rounds-root`'s
`Showing saved rounds from this device.` banner, which this screen does not have.

## 6. Flow paths

**Happy path.** COURSES tab → `fetchCourses` and `useRoundList` resolve → directory renders sorted by
name with a count, My rounds renders up to three cards → tap a course → `/courses/:courseId`.

**First run / empty.** A brand-new account has no courses and no rounds. Both sections render their own
empty affordance and the screen is fully usable: `dir-empty` offers `Build a course`, `rounds-empty`
states that rounds will appear. Because courses are community data, a new user on a populated instance
sees other people's courses immediately — the "empty" directory is rarer than it looks.

**Error.** Two distinct behaviors, which is the screen's main structural inconsistency:

- `fetchCourses` rejects → `CoursesPage.jsx:24` returns `<p class="form-error">{error}</p>` as the whole
  page. No retry control; recovery requires a reload or a tab round-trip that remounts the component.
  The message is a raw `err.message` from Supabase, not house copy.
- `useRoundList` rejects with a populated cache → the query succeeds, nothing is shown. Rejects with an
  empty cache → `roundsQuery.error` is set, `roundsQuery.isLoading` is false, and the page renders
  normally with `err-inline` showing `roundError` and an empty My rounds section. Non-blocking, correct.

**Offline.** As § 5. Directory read fails hard; round list degrades gracefully. The screen has no way to
express "these courses are stale" because it never caches them in the first place.

**Auth / guard.** `ProtectedRoute` gates the shell. `CoursesPage.jsx:13` dereferences `user.id`
unconditionally for `useRoundList`, so there is no anonymous render path. A Supabase anonymous ("guest")
session is a real user for this purpose and sees the community directory normally. The onboarding gate
runs first, so a zero-bag user never reaches this screen.

**Interlock.** **N/A** — no cap or constraint is enforced or displayed here. Courses are unbounded; the
recent-rounds list is truncated to 3 by `.slice(0, 3)` (`CoursesPage.jsx:27`), which is presentation, not
an interlock.

**Destructive.** **N/A** — nothing on this screen deletes, retires, or discards. Worth stating why: the
J1 RLS migration deliberately ships **no delete policy** for `courses`
(`20260714150000_phase_c_round_logging_rls.sql:29` — "there is deliberately no delete policy in J1"),
so a course created by mistake cannot be removed from this directory by any user, including its creator.
See § 12.

## 7. Dependencies

### Schema

- `courses` — `id`, `name`, `location`, `created_by`, `created_at` (`supabase_schema.sql:55-62`), plus
  `external_source` / `external_ref` added by `disc_locker_and_layouts_schema.sql:96-98` for idempotent
  import (unused by this screen). RLS replaced wholesale by
  `supabase/migrations/20260714150000_phase_c_round_logging_rls.sql`: select-all-authenticated,
  insert with `created_by = auth.uid()`, update creator-only, **no delete**.
- `rounds` — read through `useRoundList`; only `id`, `course_id`, `status`, `total_score`, `played_at`
  and the hydrated `course` relation are consumed here. `rounds_user_id_idx`
  (`20260714150000_phase_c_round_logging_rls.sql:25-26`) backs the owner predicate.
- Dexie `rounds` table, schema version 5 onward (`db/dexieDb.js:98`), currently
  `'id, user_id, course_id, status, bag_version_id, [user_id+status]'` (`:207`).

### Library

`lib/roundLog` (`fetchCourses`), `lib/repository/roundRepository` (`useRoundList`),
`context/AuthContext` (`useAuth`). Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

`courseLocation()` (`CoursesPage.jsx:7-9`) is a two-line module-local fallback helper, not a library
export. `CourseDetailPage.jsx:35` reimplements the identical `course.location || 'Location not set'`
inline — a small duplication, flagged in § 11.

### Components

**None.** This page imports no component from `src/components/`. Every element is raw JSX styled by
class. In particular the `.empty-state` block is hand-rolled, which
[`COMPONENT_LIBRARY.md`](../COMPONENT_LIBRARY.md) § "Common needs with no shared component" item 6 names
explicitly, citing `src/pages/CoursesPage.jsx:46`.

### Screens

- **Requires:** nothing. This is the section root and the tree's only entrance.
- **Required by:** `courses-new`, `course-detail`, `rounds-root` (all four are reachable only from here
  or from each other). `courses-new` and `round-summary` both offer a `Cancel` / `Course directory` link
  back to this route.
- **Shell back target:** every other screen in the COURSES section returns here on the header back
  control, because `handleBack()` navigates to the section root rather than through history.

### Contracts and decisions

- `PHASE_A_ARCHITECTURE.md` § 12 — presentation and accessibility baseline; § 13 — shell/route
  boundaries (this page correctly manages no header, tab clearance, or safe area); § 14 — repository and
  transaction contract (no writes here).
- `PHASE_A_ARCHITECTURE.md` § 5 — the metric registry's subject scopes do not yet include
  `course`; see § 9.
- No blocking ADR. ADR 0001 governs the round screens, not this one.
- `DEVELOPMENT_PLAN.md` § E2 is the work item that owns this screen's backlog.

## 8. Accessibility

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** both sections use `aria-labelledby` pointing at real `h2` ids
  (`course-directory-title`, `recent-rounds-title`) — the only screen in this batch that does. Copy it.
- **Good:** the `→` chevron carries `aria-hidden="true"`, so the row's accessible name is just the course
  name and location.
- **Good:** `hdr-add` and both `.btn-primary` CTAs inherit `min-height: var(--tap-target-min)` = 80px
  (`index.css:44`), satisfying the 80pt primary-action rule.
- **Gap:** `rounds-viewall` uses `.link-button`, which sets no `min-height` and no padding
  (`App.css:455-466`). At a 14px font it is roughly 17px tall — well under the 44×44pt secondary-control
  minimum. This affects every `.link-button` in the section; tracked once, in § 11.
- **Gap:** the loading state is a bare `<p class="loading">Loading courses...</p>` with no `role="status"`
  or `aria-live`, so a screen-reader user gets no announcement when content replaces it. Same for the
  full-page error, which has no `role="alert"`.
- **Gap:** `dir-count` (`4 courses`) is visually associated with the heading by layout only. It sits
  inside `.section-heading-row` as a sibling `<span>` and is announced as loose text.
- **App-wide, not a screen delta:** the shell renders `<h1 class="global-header-title">` and this page
  renders its own `<h1>`, so every `standard`-shell screen has two `h1` elements. Noted here for
  completeness; the fix belongs to `AppShell`/`GlobalHeader`.

## 9. Events and telemetry

**N/A** — no metrics, no notifications, no lifecycle events.

Worth stating why rather than leaving it bare: `PHASE_A_ARCHITECTURE.md` § 5 says "Add round/course/
layout/hole scopes with their capture features," and that has not happened.
`src/lib/metrics/registry.js` declares subjects `player`, `routine`, `session`, and `physical_disc` only
— no `course`, `round`, `layout`, or `hole` subject exists. Nothing on this screen emits a metric,
produces a notification (§ 7), or writes a lifecycle event (§ 2).

## 10. Tests

### Existing coverage

**None.** Confirmed by reading every import of `CoursesPage.jsx`:

| Import | Test file |
|---|---|
| `lib/roundLog` (`fetchCourses`) | **absent** — there is no `src/lib/roundLog.test.js` |
| `lib/repository/roundRepository` (`useRoundList`) | **absent** — there is no `roundRepository.test.js` |
| `context/AuthContext` | absent |

[`TEST_MAP.md`](../TEST_MAP.md):61 records `courses-root` → **none**; this document confirms it. Nothing
verifies that the directory renders, that the empty state appears, that the count pluralizes, that the
recent list truncates at three, or that a failed `fetchCourses` is recoverable. And because there are no
page tests anywhere in the repo (`TEST_MAP.md` § The headline: all 74 test files live under `src/lib/`),
there is no existing harness to add one to — a page test here would be the first of its kind.

The gap is not merely "this screen is untested." It is that **`roundLog.js` — the module that owns every
course and round query in the app — has no test file at all**, so the failure would be equally invisible
at the library layer.

### Acceptance criteria

1. With three courses in the catalog, the directory renders three rows sorted by `name` ascending and
   `dir-count` reads `3 courses`.
2. With exactly one course, `dir-count` reads `1 course` (singular).
3. A course with `location = null` renders `Location not set`, not an empty line.
4. With zero courses, `dir-empty` renders and its CTA navigates to `/courses/new`.
5. A course created by a *different* user appears in the directory (community-read RLS), and this is
   either intentional and communicated on screen, or changed. See § 12.
6. With five rounds, exactly three render under My rounds, newest `played_at` first.
7. A round with `total_score = null` renders `—` in the score slot, not `0` or blank.
8. A round with `status = 'in_progress'` renders `In progress`; anything else renders `Completed`.
9. With the network offline and a populated Dexie cache, **the page still renders the round list**.
   *Currently fails* — the `fetchCourses` rejection takes the whole page down first.
10. A failed `fetchCourses` renders an error **with a retry control**. *Currently fails* — no retry
    exists.

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built —
`TEST_MAP.md` § E2E backlog). These are backlog specs, not coverage:

1. Sign in → COURSES tab → directory renders → tap a course → `/courses/:courseId` renders that course.
2. Zero-course account → empty state → `Build a course` → create → return to `/courses` and see the new
   course in the directory. This is the front half of `TEST_MAP.md` E2E backlog item 4.
3. Go offline → COURSES tab → assert the round list still renders (the acceptance criterion 9 regression
   guard).
4. Tab three-state: press COURSES while on `/courses` scrolled down → scrolls to top; press again →
   stays (already the section root).

## 11. Tasks

E2 ("audit and harden the existing course/layout and offline round routes rather than rebuilding them",
`DEVELOPMENT_PLAN.md` § E2) owns these. Ordered by dependency.

#### T-courses-root-1 — Create `roundLog.test.js` covering the course queries

- **Capability:** `data-access`
- **Touches:** `src/lib/roundLog.test.js` (new)
- **Done when:** `fetchCourses` and `fetchCourse` have unit tests against a mocked Supabase client
  covering the happy path, the empty result, and a thrown Postgres error; the file exists and is picked up
  by the suite.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `test: cover roundLog course queries`

#### T-courses-root-2 — Stop the course fetch failure from blanking the whole screen

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CoursesPage.jsx`
- **Done when:** with `fetchCourses` rejecting and `useRoundList` resolving from cache, the page renders
  its header, an inline directory-level error, and the My rounds section; the full-page early return at
  `CoursesPage.jsx:24` is gone.
- **Verify:** `npm test` with a new page-level test that rejects `fetchCourses` and resolves
  `useRoundList`.
- **Commit:** `fix: keep courses page usable when the directory fetch fails`

#### T-courses-root-3 — Add a retry control to the directory error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CoursesPage.jsx`
- **Done when:** the inline directory error renders a `Retry` control that re-runs `fetchCourses`; a
  succeeding retry renders the directory without a page reload.
- **Verify:** `npm test` with a test that rejects `fetchCourses` once then resolves.
- **Commit:** `fix: allow retry when the course directory fails to load`
- **Blocked by:** `T-courses-root-2`.

#### T-courses-root-4 — Give the course directory an offline cache

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/` (new course repository), `src/lib/db/dexieDb.js`,
  `src/pages/CoursesPage.jsx`, `src/pages/CourseDetailPage.jsx`, `src/pages/RoundStartPage.jsx`
- **Done when:** courses read through a `readThroughCache`-backed repository
  (`offlineFirstRepository.js`), so a previously-visited directory renders offline; a new Dexie version is
  appended, never edited in place.
- **Verify:** `npm test` covering cache hit, cache miss, and prune-on-refresh; manual offline check at
  `/courses` in `npm run dev`.
- **Commit:** `feat: cache the course directory for offline reads`
- **Note:** this is the largest item in the section and unblocks the offline story for `course-detail`
  and `round-start` at the same time. Sequence it after `T-courses-root-1`, so the query layer has tests
  before it moves.

#### T-courses-root-5 — Announce loading and error states to assistive tech

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CoursesPage.jsx`
- **Done when:** the loading paragraph carries `role="status"` and the error paragraph `role="alert"`;
  visual output is unchanged.
- **Verify:** `npm run lint` plus a manual VoiceOver pass at `/courses`.
- **Commit:** `fix: announce courses loading and error states`

#### T-courses-root-6 — Give `.link-button` a 44pt hit area

- **Capability:** `ui-routine`
- **Touches:** `src/App.css`
- **Done when:** `.link-button` meets the 44×44pt secondary-control minimum from
  `PHASE_A_ARCHITECTURE.md` § 12 without changing its visual weight; `View all`, `Cancel`, `Directory`,
  and `Scorecard` across the COURSES section all inherit it.
- **Verify:** `npm run build` plus a manual 320px-width check of `/courses`, `/courses/new`,
  `/courses/:id`, `/rounds/:id/summary`.
- **Commit:** `fix: meet the secondary touch target minimum for link buttons`
- **Note:** `.link-button` is used app-wide, so this touches every section. Verify PLAY and ME too.

#### T-courses-root-7 — Say whose courses these are

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CoursesPage.jsx`
- **Done when:** the Directory section states that courses are shared community data, or filters to the
  user's own, per the decision in § 12 question 1.
- **Verify:** manual check at `/courses` with two accounts against the same project.
- **Commit:** `feat: clarify the community scope of the course directory`
- **Blocked by:** § 12 question 1.

## 12. Open questions

1. **Should the directory be community-wide or personal?** `fetchCourses` returns every course any user
   created (`roundLog.js:158` + the select-all-authenticated RLS policy). That matches the "shared
   community data" intent in `supabase_schema.sql:53` and the `disc_molds` precedent, but the heading
   says `Directory` with a plain count and nothing distinguishes a course you built from one you did not.
   On a multi-user instance this list grows without bound and has no search, filter, or "mine only"
   affordance. Decide: community with provenance shown, or personal with a separate discovery surface.
2. **A mistakenly created course cannot be deleted by anyone.** The J1 RLS migration ships no delete
   policy for `courses`, `layouts`, or `holes`
   (`20260714150000_phase_c_round_logging_rls.sql`, comment at :29). Combined with question 1, one user's
   typo is permanently visible to everyone. Needs either a creator-delete policy with a
   no-rounds-reference guard, or an explicit "courses are append-only" statement in `AGENTS.md`.
3. **`err-inline`'s `error` term is dead code.** `CoursesPage.jsx:38` renders `{error || roundError}` but
   the `error` branch is unreachable (see § 4). Harmless today; it will mislead the next reader. Fold
   into `T-courses-root-2`.
4. **Two empty-state idioms on one screen.** `dir-empty` is an `.empty-state` block with a CTA;
   `rounds-empty` is a bare `.log-time` line with none.
   [`COPY_AND_TERMINOLOGY.md`](../COPY_AND_TERMINOLOGY.md) § 2 catalogues this across the app and
   [`COMPONENT_LIBRARY.md`](../COMPONENT_LIBRARY.md) item 6 names the structural cause. A shared
   empty-state component would settle both; that is a cross-section task, not a `courses-root` one.
5. **Recent-round rows link to the scorecard even when the round is completed.** `rounds-row` always
   targets `/rounds/:roundId`. For a completed round the summary (`/rounds/:roundId/summary`) is the more
   useful destination, and the scorecard remains fully editable after completion without updating
   `total_score` — see `round-summary` § 12. Decide once and apply to `rounds-root` too, which has the
   same behavior.

Filed corrections touching this screen: [`_corrections/courses-screens.md`](../_corrections/courses-screens.md)
CS-1 (`preserveNestedState`), CS-3 (`STATE_MATRIX.md`, since resolved), CS-5 (`TEST_MAP.md` rows), CS-7 (activity
pill).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `/courses` shipped as `DEVELOPMENT_PLAN.md` § J1 on
2026-07-14, a documented jump ahead of `PRODUCT_ROADMAP.md` Phase E, and `MASTER_PROJECT_BLUEPRINT.md`
§ 3 has no course-directory screen.

Two blueprint screens are adjacent and should not be confused with this one:

- **Screen 13, Frictionless UDisc Ingestion Center** — unbuilt, no route. It writes the *same* `courses`
  and `rounds` tables (`SCREEN_SPECS.md:334-346`) and relies on `course_aliases` and the
  `(external_source, external_ref)` partial unique indexes that already exist
  (`disc_locker_and_layouts_schema.sql:113-124`). When it lands, this directory is where imported courses
  will surface. Its forward-looking document is planned at `screens/_planned/udisc-ingestion.md`
  (`SCREEN_INVENTORY.md` § Not in this inventory).
- **Screen 14, Course Practice Hubs & Leaderboards** — `PARKED (Social)` (`SCREEN_SPECS.md:42`). Not this
  screen, and nothing here anticipates it.

Standing divergence #5 (`SCREEN_SPECS.md:69-72`) is the one that applies: the shipped tab bar is
**PLAY / DISCS / COURSES / ME**, with COURSES "added at its documented trigger when the J1 directory
shipped 2026-07-14" — that trigger is this screen. Standing divergences #1 (React/Vite, not Expo) and #3
(append-only schema) apply as they do everywhere.
