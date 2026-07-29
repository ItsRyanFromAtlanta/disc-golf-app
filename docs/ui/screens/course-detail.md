# Course

| Field | Value |
|---|---|
| Route id | `course-detail` |
| URL pattern | `/courses/:courseId` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Course` |
| Activity pill | declared shown (`showActivityPill: true`) — inert for rounds, see `_corrections/courses-screens.md` CS-7 |
| Scroll key | `courses-detail` |
| Preserves nested state | `false` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/CourseDetailPage.jsx` (88 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

The shell header shows the static string `Course` while the page `h1` shows the course's name, so the
screen is named twice, differently, on every visit (`COPY_AND_TERMINOLOGY.md` § 4). The same pattern
appears on `round-scorecard` and `round-summary`.

## 1. Purpose

The read-only record of one course: its name, location, and every layout with that layout's hole list,
par total, and a launch button. It is where a player confirms they are about to play the right eighteen
holes, and it is the primary jumping-off point into a round.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Course row in the `/courses` directory | `Link` from `courses-root` | Primary path |
| In | Successful quick-course submit | `navigate('/courses/' + course.id)` from `courses-new` (`CourseFormPage.jsx:29`) | Unconditional — every course creation lands here |
| In | Direct URL / restored session | Route match | `ProtectedRoute` + the `AppShell` onboarding gate apply |
| Out | `Directory` link in the page header | `Link` to `/courses` | In-page, top right; **not** the shell back control |
| Out | `Start round` on any layout | `Link` to `/rounds/new?courseId=<id>&layoutId=<id>` | One per layout. Both parameters set |
| Out | `Start a round` in the no-layouts empty state | `Link` to `/rounds/new?courseId=<id>` | **`layoutId` omitted** — and a course with no layouts cannot produce a round; see § 6 |
| Out | Shell back control | Header, shell-owned | Goes to `/courses` (section root), regardless of arrival path |
| Out | Tab re-tap on COURSES | `TabBar` → `resolveSectionRoot('courses')` | Returns to `/courses` |

**`/rounds/new?courseId=&layoutId=` is a shipped query-parameter contract**, produced only here
(`CourseDetailPage.jsx:51` and `:66`) and consumed only by `round-start` (`RoundStartPage.jsx:13-14`).
`NAVIGATION_MAP.md` § Deep links currently states that `/bag/lost-found?disc=` is the app's only
query-parameter contract; that is out of date. Filed as
[`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-2.

Both parameters are **advisory, not binding**. `round-start` falls back to the first available course
(`RoundStartPage.jsx:34-37`) and to the course's default layout (`:66-70`) when the requested id is not
present in what it fetched, with no message. A stale or hand-typed link therefore starts a different
round than it names.

**Scroll position leaks between courses.** `AppShell` stores and restores scroll offset by `scrollKey`
alone, and every course shares the key `courses-detail`. Scrolling deep into course A, returning to
`/courses`, then opening course B restores A's offset onto B's page. See CS-1.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Course                               [ bell ]    | <- Shell header; static title
+-------------------------------------------------------+
|  EAST ROSWELL PARK               [ Directory ]        | <- h1 = course.name; .link-button
|  Roswell, GA                                          | <- .log-time; "Location not set" when null
+-------------------------------------------------------+
|  Layouts                              2 layouts       | <- .section-heading-row; count pluralizes
|                                                       |
|  +-------------------------------------------------+  |
|  | Main                          [ Start round ]   |  | <- h3 + .btn-primary.course-start-button
|  | 18 holes · par 54                               |  | <- parTotal(layout.holes)
|  |                                                 |  |
|  |  Hole 1        Par 3          320 ft            |  | <- .course-hole-row, 3-column grid
|  |  Hole 2        Par 4          Distance —        |  | <- fallback when distance_feet is null
|  |  Hole 3        Par 3          Distance —        |  |
|  |  ... one row per hole, no truncation ...        |  |
|  +-------------------------------------------------+  |
|  +-------------------------------------------------+  |
|  | Long tees                     [ Start round ]   |  |
|  | 18 holes · par 56                               |  |
|  |  ...                                            |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

No-layouts variant:

```
|  Layouts                              0 layouts       |
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  | <- .empty-state, dashed border
|  |  This course has no layout holes yet.           |  | <- copy says "holes"; condition tests layouts
|  |  [           Start a round            ]         |  | <- links to /rounds/new?courseId= (no layoutId)
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
```

Every layout renders its full hole list inline, expanded, always. There is no accordion, no collapse, no
"show all", and no virtualization — a course with four 18-hole layouts renders 72 rows in one scroll.

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back to /courses, title "Course", notification bell
Body (shell scroll region, scrollKey courses-detail)
  Page header (.practice-header)
    hdr-title ............ h1, course.name
    hdr-location ......... course.location || "Location not set"
    hdr-directory ........ "Directory" link
  Layouts section (aria-labelledby course-layouts-title)
    lay-heading .......... h2 "Layouts"
    lay-count ............ "<n> layout" / "<n> layouts"
    lay-empty ............ empty state: copy + "Start a round" CTA
    Layout card (.course-layout, one per layout)
      lay-name ........... h3, layout.name
      lay-summary ........ "<n> holes · par <parTotal>"
      lay-start .......... "Start round" CTA
      Hole list (ol.course-hole-list)
        hole-row ......... "Hole <n>" / "Par <n>" / "<n> ft" or "Distance —"
Tab bar (shell-owned)
```

The page is a single scroll with no sticky element. The `Start round` button sits inside each layout's
heading row rather than in a footer, so on a long layout the launch control scrolls out of view — a
divergence from `PHASE_A_ARCHITECTURE.md` § 12's "primary field controls in viewport" intent, though
§ 12 binds that requirement to the active capture shell rather than to `standard` screens.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `course.name`, uppercased by CSS | — | — | — | always; a course always has a `name` (`courses.name` is `not null`) |
| `hdr-location` | `<p class="log-time">` | `course.location \|\| 'Location not set'` | — | — | — | always. Reimplements `CoursesPage.jsx:7-9`'s `courseLocation()` inline rather than sharing it |
| `hdr-directory` | link (`.link-button`) | `Directory` | default / pressed | navigate | `/courses` | always |
| `lay-heading` | h2 | `Layouts` | — | — | — | always |
| `lay-count` | text (`.log-time`) | `<n> layout` / `<n> layouts` | — | — | — | always; correctly singularizes at 1 |
| `lay-empty` | block (`.empty-state`) | `This course has no layout holes yet.` + `Start a round` | — | navigate (CTA) | `/rounds/new?courseId=<id>` | shown when `course.layouts.length === 0`. **The copy and the condition disagree** — it fires on zero *layouts*, not zero *holes*. A course with one empty layout falls through to the card path instead; see § 12 question 1 |
| `lay-name` | h3 | `layout.name` | — | — | — | one per layout. Quick courses always produce exactly one, named `Main` (`roundLog.js:217`) |
| `lay-summary` | `<p class="log-time">` | `<n> holes · par <parTotal(layout.holes)>` | — | — | — | `parTotal` sums `par` over the layout's holes, treating null/non-finite as 0 (`rounds.js:21-23`). **Does not pluralize** — a one-hole layout reads `1 holes` |
| `lay-start` | link (`.btn-primary.course-start-button`) | `Start round` | default / pressed | navigate | `/rounds/new?courseId=<id>&layoutId=<layoutId>` | always, **including for a layout with zero holes** — which produces an unstartable round; see § 6 |
| `hole-row` | list item (`li.course-hole-row`, 3-column grid) | `Hole <hole_number>` · `Par <par>` · `<distance_feet> ft` or `Distance —` | — | — | — | one per hole, ordered by `hole_number` then `tee_type` (`roundLog.js:176`). Read-only — **no hole on this screen is editable anywhere in the app** |

`hole-row` renders `par` verbatim from the database with no fallback, so a `null` par (permitted —
`holes.par int default 3`, nullable) renders as `Par ` with nothing after it, while `parTotal` counts it
as 0. Unreachable from `courses-new`, which always writes a par; reachable from any future import.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Course + layouts + each layout's holes | `fetchCourse(courseId)` | `lib/roundLog` | Supabase (`courses`, `layouts`, `holes`) | async, **no local mirror** |
| Layout par total | `parTotal(layout.holes)` | `lib/rounds` | — | **pure** |

Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

`fetchCourse` (`roundLog.js:163-190`) is three sequential round trips, not a join:

1. `courses.select('*').eq('id', courseId).single()` — **`.single()`, so a missing or unreadable course
   rejects** rather than returning null
2. `layouts.select('*').eq('course_id', courseId).order('is_default', { ascending: false }).order('name')`
   — default layout first, then alphabetical
3. `holes.select('*').in('layout_id', layoutIds).order('hole_number').order('tee_type')`, skipped
   entirely when there are no layouts

then groups holes by `layout_id` in memory and returns `{ ...course, layouts: [{ ...layout, holes }] }`.
Every layout key is present even when its hole array is empty.

The read is **not user-scoped**. `CourseDetailPage.jsx` never calls `useAuth` — the only page in this
batch that does not — and `fetchCourse` has no `created_by` predicate. Access is governed entirely by the
select-all-authenticated RLS policy on `courses`/`layouts`/`holes`
(`supabase/migrations/20260714150000_phase_c_round_logging_rls.sql:36-40`, `:63-67`, and the holes block
following). Any authenticated user can open any course by id.

The single-flight effect (`CourseDetailPage.jsx:11-25`) is correctly written: it resets `course` and
`error` on every `courseId` change and guards both callbacks with an `active` flag, so a fast
course-to-course navigation cannot land a stale response.

### Writes

**N/A** — this screen performs no mutations. Every control is a `Link`.

Worth stating what that costs, because the gap is structural rather than incidental: `layouts` and
`holes` are written **only** by `createCourseWithLayout` (`roundLog.js:216-232`), and no screen in the
app can add a layout, rename one, add or remove a hole, or set a hole's `distance_feet`, `tee_type`,
`hazards`, or `strategy_notes`. Everything this page displays as `Distance —` is permanently `—`. That
makes `courses-new`'s promise — "enrich its hole details later" (`CourseFormPage.jsx:46`) — unfulfillable
today. See `courses-new` § 12 question 3.

The transaction contract that would apply to a future editor is `PHASE_A_ARCHITECTURE.md` § 14.

### Offline

**The screen does not work offline.** `fetchCourse` is a bare Supabase call in a Supabase-only module
(`LIB_API_INDEX.md:640`) with no Dexie mirror and no fallback. With no network the promise rejects and
`CourseDetailPage.jsx:27` renders the raw error message **as the entire page** — no header, no course
name, no navigation except the tab bar, no retry.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`) is rendered.

The practical consequence: a player standing at a course they have opened a hundred times cannot see its
hole list without signal. `round-scorecard` — the screen that actually needs to work in a field — *is*
offline-capable through `loadRound`'s Dexie fallback, so the section's offline story is inverted: the
reference data is online-only and the capture data is not. `T-courses-root-4` fixes this for all three
course-reading screens at once.

## 6. Flow paths

**Happy path.** `/courses` → tap a course → `fetchCourse` resolves → header, layout cards, and hole lists
render → tap `Start round` on the intended layout → `/rounds/new?courseId=…&layoutId=…` arrives with both
selects prefilled → `round-start` creates the round.

**First run / empty.** Three distinct emptinesses, only one of which is handled:

| Situation | What renders |
|---|---|
| Course has no layouts | `lay-empty`, with a `Start a round` CTA that **cannot** succeed — see the Interlock path |
| Course has a layout with zero holes | Not the empty state. A layout card reading `0 holes · par 0` with an empty `<ol>` and a live `Start round` button that also cannot succeed |
| Course has layouts and holes | Normal render |

The middle row is the one produced by a partially failed quick-course creation (`courses-new` § 5), and
it is unhandled.

`S-EMPTY` covers only the first row, and it covers it well: `CourseDetailPage.jsx:49` is one of the four
`.empty-state` users in the app, so the no-layouts case has the row's best markup. **The second row is a
divergence from `S-EMPTY`**: a zero-hole layout is genuinely empty and renders no empty state at all —
an empty `<ol>` under a live CTA, which is the row's `❌` condition rather than its `cosmetic` one. The
grid's `✅` for this route reflects the handled case only.

**Error.** `S-ERR-BLOCK` — `fetchCourse` rejects → `CourseDetailPage.jsx:27` returns
`<p class="form-error">{error}</p>` as the whole page, with no retry control (`S-RETRY`) and no way back
except the tab bar. It is one of the thirteen **unguarded** instances, with no `&& !data` test, and this
screen has no `S-ERR-INLINE` path at all, so every failure is total. Two common causes produce the same
unhelpful raw string:

- **Course not found.** `.single()` on a nonexistent id rejects with PostgREST's
  `JSON object requested, multiple (or no) rows returned`. The user sees that sentence. There is no
  `Course not found` copy anywhere.
- **Offline.** A network-level fetch error message, verbatim.

`error` is checked before `course` (`:27` before `:28`), so an error always wins over the loading state —
correct ordering, wrong presentation.

**Offline.** `S-OFFLINE-READ`, on the failing side: `lib/roundLog` is one of the eight modules with no
cache, so the single read throws straight into `S-ERR-BLOCK` and the screen cannot render offline at all.
`S-STALE` therefore never arises, and no `S-SYNC` label is displayable. As § 5.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell; `S-ONBOARD` — the onboarding gate
runs first. This page never reads `user`, so it has no per-user branch at all: an anonymous (guest)
Supabase session renders it identically to a full account, which is consistent with `S-GUEST`'s finding
that `AuthPage` is the only screen that branches on `isGuest`.

**Interlock.** `S-INTERLOCK-CAP` is `➖` — no cap or constraint is enforced here. But the screen contains
a **dead-end launch path** that behaves like a missing one. `lay-start` and the `lay-empty` CTA are always enabled, and neither
checks that the target layout has holes. Following either into `round-start`:

- with `layoutId` pointing at a hole-less layout, or with no layout at all, `round-start`'s layout
  `<select>` is empty and its submit button is disabled by `!selectedLayout`
  (`RoundStartPage.jsx:185`);
- so the user lands on a form they cannot submit, with no explanation and no way to add holes, because no
  hole editor exists.

The correct behavior is to disable or relabel the CTA here, where the hole count is already known. Filed
as `T-course-detail-2`.

**Destructive.** **N/A** — the screen deletes nothing, so `S-CONFIRM` is `➖`. As with `courses-root`,
the notable fact is the
absence of the inverse: the J1 RLS migration ships no delete policy for `courses`, `layouts`, or `holes`
(`20260714150000_phase_c_round_logging_rls.sql`, comment at :29), so nothing displayed on this page can
be removed by anyone, including its creator.

## 7. Dependencies

### Schema

- `courses` — reads `id`, `name`, `location` (`supabase_schema.sql:55-62`). The vestigial
  `courses.layout_name text default 'Main'` column survives on the table and is never read or written by
  any screen; `rounds.layout_name` was dropped by `migrate_disc_locker_and_layouts.sql:208` but the
  `courses` copy was not. Append-only schema policy (`SCREEN_SPECS.md` standing divergence #3) is why.
- `layouts` — reads `id`, `name`, `is_default`, `course_id`. First-class table added by
  `disc_locker_and_layouts_schema.sql:77-84`, with `layouts_course_name_uniq (course_id, lower(name))`
  and the partial unique `layouts_one_default_per_course` guaranteeing at most one default per course —
  which is what makes `fetchCourse`'s `order('is_default', { ascending: false })` a deterministic sort.
- `holes` — reads `id`, `hole_number`, `par`, `distance_feet`, `layout_id`. `layout_id` added by
  `disc_locker_and_layouts_schema.sql:94-96` and made `NOT NULL` by
  `migrate_disc_locker_and_layouts.sql:199`, which also drops `holes.course_id` and installs
  `holes_layout_hole_tee_uniq (layout_id, hole_number, tee_type)`. `tee_type`, `hazards`, and
  `strategy_notes` exist on the table and are **never displayed** by this screen or written by any.
- RLS: select-all-authenticated on all three; update restricted to the parent course's creator for
  `layouts` and `holes` (`20260714150000_phase_c_round_logging_rls.sql:75-95` and the holes block); no
  delete policy on any of them.

### Library

`lib/roundLog` (`fetchCourse`), `lib/rounds` (`parTotal`), `react-router-dom` (`Link`, `useParams`).
Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

`parTotal` is the only pure function on the screen and the only thing on it covered by a test
(`src/lib/rounds.test.js:16-19`).

### Components

**None.** No import from `src/components/`. The `.empty-state` block is hand-rolled;
[`COMPONENT_LIBRARY.md`](../COMPONENT_LIBRARY.md) § "Common needs with no shared component" item 6 cites
`src/pages/CourseDetailPage.jsx:49` by line as one of the four instances.

### Screens

- **Requires:** `courses-root` (the row that links here) or `courses-new` (which navigates here on
  success). There is no third way in short of a direct URL.
- **Required by:** `round-start` — this screen is the origin of both forms of the
  `/rounds/new?courseId=…` link, and the only place a specific layout can be chosen before the round form
  loads.
- **Adjacent:** `courses-new` creates everything this screen displays; nothing edits it.

### Contracts and decisions

- `PHASE_A_ARCHITECTURE.md` § 12 — presentation and accessibility baseline; the full-page error state is
  the notable divergence (§ 6). § 13 — shell/route boundaries, correctly observed. § 14 — repository and
  transaction contract; no writes here, but see § 5 on the absent editor.
- `PHASE_A_ARCHITECTURE.md` § 5 — no `course`, `layout`, or `hole` metric subject exists yet; see § 9.
- No blocking ADR. ADR 0001 scopes the three round screens, not this one — but note that its Consequences
  ("E2 hardens what exists; no rebuild of the round routes is in scope") is what keeps this screen's
  `Start round` contract stable.
- `DEVELOPMENT_PLAN.md` § E2, whose "course preparation" line item is the natural home for the missing
  hole editor.

## 8. Accessibility

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** the Layouts section uses `aria-labelledby="course-layouts-title"` against a real `h2` id.
- **Good:** heading levels nest correctly — page `h1`, section `h2`, layout `h3` — which makes the hole
  lists navigable by heading in a screen reader. This is the cleanest heading structure in the batch.
- **Good:** each layout's holes are an ordered list (`<ol class="course-hole-list">`), which conveys hole
  sequence structurally rather than only visually.
- **Good:** `lay-start` inherits `min-height: 48px` from `.course-start-button` (`App.css:586-592`),
  comfortably over the 44pt secondary minimum — though it is arguably the primary action on the screen,
  in which case the 80pt bar applies and 48px falls short. Which one it is depends on § 12 question 3.
- **Gap:** `hdr-directory` is a `.link-button` with no `min-height` and no padding
  (`App.css:455-466`) — roughly 17px tall against a 44×44pt minimum. Shared fix, `T-courses-root-6`.
- **Gap:** the loading paragraph has no `role="status"` and the full-page error no `role="alert"`, so
  neither is announced.
- **Gap:** `hole-row` is a three-column CSS grid whose cells are bare text — `Hole 1`, `Par 3`, `320 ft`.
  There is no table semantics and no per-column header, so a screen reader reads three unlabeled values
  per row. `Par` and the `ft` suffix carry their own meaning, which mitigates it; `Distance —` reads as
  the literal string "Distance em-dash".
- **Gap:** a long course (four 18-hole layouts = 72 rows) has no landmark, skip link, or collapse to move
  past a layout's holes to the next layout's `Start round`. At 200% text scaling this is a very long
  scroll to reach the second layout's launch control.
- **App-wide, not a screen delta:** two `h1` elements per page — the shell's and this page's.

## 9. Events and telemetry

**N/A** — no metrics, no notifications, no lifecycle events.

Opening a course is not an activity: `ACTIVITY_TYPES` (`activityLifecycle/types.js:9-17`) has no
course-view type, and the lifecycle is only touched in this section by `round-start` (through
`roundRepository.ensureRoundActivity`) and `round-summary` (through `finalizeRoundActivity`).
`PHASE_A_ARCHITECTURE.md` § 5 anticipates `course`, `layout`, and `hole` metric subjects "with their
capture features"; `src/lib/metrics/registry.js` declares only `player`, `routine`, `session`, and
`physical_disc`, so there is nothing to emit into.

## 10. Tests

### Existing coverage

**Almost none.** Confirmed by reading every import of `CourseDetailPage.jsx`:

| Import | Test file | Covers this screen? |
|---|---|---|
| `lib/roundLog` (`fetchCourse`) | **absent** — no `src/lib/roundLog.test.js` exists | — |
| `lib/rounds` (`parTotal`) | `src/lib/rounds.test.js` | Partly — `parTotal` is tested at `:16-19` |
| `react-router-dom` | — | — |

[`TEST_MAP.md`](../TEST_MAP.md):63 records `course-detail` → **none**. That is very nearly right and
slightly harsh: `parTotal` — the one derived value on the screen — is covered, including its
null-par-counts-as-zero behavior (`rounds.test.js:18`). Everything else is not.

Specifically unverified:

- `fetchCourse`'s three-step shape: that layouts come back default-first, that holes are grouped onto the
  right layout, that a layout with no holes still gets an empty `holes` array, and that the hole query is
  skipped when `layoutIds` is empty (`roundLog.js:175`).
- The `.single()` rejection path for a nonexistent `courseId`.
- Every rendering branch: empty state, layout card, hole row, the `Distance —` fallback.
- The `active`-flag race guard on fast course-to-course navigation.

And the same headline as the rest of the section: **`src/lib/roundLog.js` owns every course and round
query in the app and has no test file at all** (`TEST_MAP.md`:69-72), so the failure is invisible at the
library layer as well as the page layer. There are zero page tests anywhere in the repo, so adding one
here means establishing the pattern.

### Acceptance criteria

1. A course with two layouts renders two cards, the `is_default` layout first, then alphabetically by
   name.
2. A layout with 18 par-3 holes renders `18 holes · par 54`, matching `parTotal`.
3. A hole with `distance_feet = null` renders `Distance —`; a hole with `320` renders `320 ft`.
4. Holes render in `hole_number` order, then `tee_type` order.
5. A course with zero layouts renders `lay-empty` and `lay-count` reads `0 layouts`.
6. A course with one layout that has zero holes renders a layout card reading `0 holes · par 0` — and
   **either its `Start round` button is disabled or the screen explains why a round cannot start.**
   *Currently fails* — the button is live and leads to an unsubmittable form.
7. A nonexistent `courseId` renders `Course not found`, not a PostgREST error string. *Currently fails.*
8. A failed load renders an error **with a retry control**. *Currently fails* — no retry exists.
9. With the network offline and the course previously visited, the hole list still renders. *Currently
   fails* — there is no cache.
10. Navigating from course A to course B replaces the content and does not leave A's scroll offset.
    *Currently fails* — see CS-1.

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built).
Backlog specs:

1. `/courses` → open a course → `Start round` on the default layout → assert `/rounds/new` arrives with
   both selects prefilled to that course and layout, and that the created round's `layout_id` matches.
   This is the hinge of `TEST_MAP.md` E2E backlog item 4.
2. Create a course with 18 holes at par 3 → open it → assert `18 holes · par 54`, and that the number
   matches what `round-summary` later reports as relative-to-par for an all-3s round.
3. Open a course whose layout has zero holes → assert the launch path is blocked or explained (the
   acceptance criterion 6 regression guard).
4. Open course A, scroll to the bottom, go back, open course B → assert B renders from the top
   (criterion 10).

## 11. Tasks

E2 (`DEVELOPMENT_PLAN.md` § E2) owns these. Ordered by dependency.

#### T-course-detail-1 — Distinguish "not found" from "failed to load", and add a retry

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CourseDetailPage.jsx`, `src/lib/roundLog.js`
- **Done when:** a nonexistent `courseId` renders `Course not found` with a link to `/courses`; any other
  failure renders house error copy plus a `Retry` control that re-runs `fetchCourse`; neither state
  removes the page header. Switching `fetchCourse`'s course query from `.single()` to `.maybeSingle()` is
  the mechanism.
- **Verify:** `npm test` with new `roundLog` cases for the missing-row and thrown-error paths (depends on
  `T-courses-root-1` creating the file).
- **Commit:** `fix: separate missing and failed course loads`

#### T-course-detail-2 — Block the launch path for a layout with no holes

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CourseDetailPage.jsx`
- **Done when:** a layout with zero holes renders its `Start round` control as disabled with a stated
  reason, and the no-layouts empty state no longer offers `Start a round`; a layout with holes is
  unchanged.
- **Verify:** `npm test` with a page-level test for both zero-hole shapes, plus a manual check at
  `/courses/<id>` for a partially created course.
- **Commit:** `fix: do not offer to start a round on an empty layout`

#### T-course-detail-3 — Fix the empty-state copy and the hole-count plural

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CourseDetailPage.jsx`
- **Done when:** the zero-layouts state says so (`This course has no layouts yet.`), a separate message
  covers the zero-holes case, and `lay-summary` reads `1 hole` at one hole.
- **Verify:** `npm run lint` plus a visual check of a one-hole course.
- **Commit:** `fix: correct course detail empty state and plural copy`
- **Note:** land with `T-course-detail-2`; they touch the same branches.

#### T-course-detail-4 — Read the course through the offline cache

- **Capability:** `data-access`
- **Touches:** `src/pages/CourseDetailPage.jsx`, the course repository from `T-courses-root-4`
- **Done when:** a previously visited course renders offline from Dexie, including its layouts and holes,
  and shows a `Saved on Device` calm state per `PHASE_A_ARCHITECTURE.md` § 12; a never-visited course
  offline still renders the not-found/error state from `T-course-detail-1`.
- **Verify:** `npm test` covering cache hit and cache miss; manual offline check in `npm run dev`.
- **Commit:** `feat: read course detail from the offline cache`
- **Blocked by:** `T-courses-root-4`, `T-course-detail-1`.

#### T-course-detail-5 — Scope the scroll key to the course id

- **Capability:** `ui-routine`
- **Touches:** `src/components/AppShell.jsx` (or `src/lib/routeMetadata.js`)
- **Done when:** navigating between two courses does not restore one's scroll offset onto the other; the
  same fix applies to `round-scorecard`, `round-summary`, and `disc-detail`, which share the same defect.
- **Verify:** `npm test` (`routeMetadata.test.js` if the key derivation moves there) plus a manual
  A → root → B check on all four routes.
- **Commit:** `fix: scope scroll restoration to the route instance`
- **Blocked by:** [`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-1 —
  decide whether `preserveNestedState` gains behavior at the same time or is retired.

#### T-course-detail-6 — Give the hole list assistive-tech structure

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CourseDetailPage.jsx`, `src/App.css`
- **Done when:** each hole row's three values are individually labelled to assistive tech (par and
  distance are not bare numbers), and a long course exposes a way to reach the next layout without
  scrolling every hole.
- **Verify:** `npm run lint` plus a manual VoiceOver pass on a two-layout, 18-hole course at 200% text
  scaling.
- **Commit:** `fix: make the course hole list navigable by assistive tech`

#### T-course-detail-7 — Build the hole editor

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CourseDetailPage.jsx`, `src/lib/roundLog.js`, new migration if RLS needs it
- **Done when:** a course's creator can set `distance_feet`, `tee_type`, `hazards`, and `strategy_notes`
  per hole, add and remove holes, and add a second layout — fulfilling `courses-new`'s "enrich its hole
  details later" promise; a non-creator sees the page read-only, matching the creator-only update policy
  at `20260714150000_phase_c_round_logging_rls.sql:75-95`.
- **Verify:** `npm test` for the write path plus a negative RLS test asserting a non-creator's update is
  rejected.
- **Commit:** `feat: edit course layout holes`
- **Blocked by:** § 12 questions 2 and 4, and `courses-new` § 12 question 5 (the tee-type model).
- **Note:** the largest item in the COURSES section and the one `DEVELOPMENT_PLAN.md` § E2 names as
  "course preparation." Do not start it before ADR 0001 closes — a hole editor is the natural place a
  scorecard rebuild gets proposed.

## 12. Open questions

1. **`lay-empty`'s copy and its condition disagree.** `This course has no layout holes yet.` fires on
   `course.layouts.length === 0` (`CourseDetailPage.jsx:48`), which is a missing *layout*, not missing
   holes. The genuinely hole-less case — a layout that exists with an empty hole array, produced by a
   partially failed quick-course create — falls through to a layout card reading `0 holes · par 0` with a
   live launch button. Two bugs wearing one message. `T-course-detail-2` and `T-course-detail-3`.
2. **Nothing in the app can edit a layout or a hole.** `layouts` and `holes` are written once, by
   `createCourseWithLayout`, and never again. `distance_feet`, `tee_type`, `hazards`, and
   `strategy_notes` are permanently null for every quick course. Decide whether the editor is E2 scope
   ("course preparation") or later, and whether it lives on this screen or a new `/courses/:id/edit`
   route. Blocks `T-course-detail-7`.
3. **Is `Start round` the primary action on this screen?** It is styled `.btn-primary` but sized 48px by
   `.course-start-button` (`App.css:586-592`), while `PHASE_A_ARCHITECTURE.md` § 12 sets 80pt for primary
   field actions and 44pt for secondary. Its placement — inside a heading row, scrolling away above a
   long hole list — implies secondary; its prominence implies primary. Settle it, because the answer
   determines whether a launch control belongs in a sticky footer.
4. **Who may edit a shared course?** RLS grants update to the parent course's `created_by` only. On a
   community catalog that means the first person to add a course owns its hole data forever, and everyone
   else sees `Distance —` with no way to improve it. The `disc_molds` precedent this policy mirrors is
   insert-open/update-closed with no moderation model — `disc_locker_and_layouts_schema.sql:147-149`
   says so in as many words: "no update/delete policy exists, so edits are closed (update-closed) until
   a moderation model exists." Courses inherited that shape without the question being asked.
   Blocks `T-course-detail-7`.
5. **Should a course page show rounds played there?** The data is available — `rounds.course_id` is
   indexed and `useRoundList` already hydrates `round.course` — and it is the obvious content for a page
   that is currently a static reference sheet. `SCREEN_SPECS.md:69-72` (standing divergence #5) says
   "course statistics live with their subject," which points directly at this page. Nothing is built.

Filed corrections touching this screen:
[`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-1 (`preserveNestedState` and
the shared scroll key), CS-2 (this screen produces the second query-parameter contract), CS-3 (`STATE_MATRIX.md`,
since resolved), CS-5 (`TEST_MAP.md` rows), CS-7 (activity pill).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no course
detail screen; `/courses/:courseId` shipped as `DEVELOPMENT_PLAN.md` § J1 on 2026-07-14, ahead of
`PRODUCT_ROADMAP.md` Phase E by owner decision.

Two blueprint screens are adjacent and must not be mistaken for this one:

- **Screen 13, Frictionless UDisc Ingestion Center** — unbuilt, no route. It writes the same `courses`,
  `layouts`, and `holes` rows by import and resolves name variants through `course_aliases`
  (`SCREEN_SPECS.md:334-346`). Imported courses will surface on this page, and imported holes are the
  first realistic source of a non-null `distance_feet` — which is to say, the first time the
  `Distance —` fallback stops being universal.
- **Screen 14, Course Practice Hubs & Leaderboards** — `PARKED (Social)` (`SCREEN_SPECS.md:42, 358`).
  It is the screen § 12 question 5 gestures at, and parking it is why this page has no
  rounds-played-here section.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only additive schema — the reason
`courses.layout_name` and `holes.hazards`/`strategy_notes` sit unused on the tables), and #5
(**PLAY / DISCS / COURSES / ME**, with course statistics living "with their subject") apply; see
`SCREEN_SPECS.md` § Standing divergences.
