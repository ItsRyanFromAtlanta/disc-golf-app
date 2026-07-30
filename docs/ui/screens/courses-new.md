# Add Course (Quick course)

| Field | Value |
|---|---|
| Route id | `courses-new` |
| URL pattern | `/courses/new` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Add Course` |
| Activity pill | declared shown (`showActivityPill: true`) — inert for rounds, see `_corrections/courses-screens.md` CS-7 |
| Scroll key | `courses-form` |
| Preserves nested state | `true` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/CourseFormPage.jsx` (84 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

**The shell header and the page disagree on this screen's name.** `routeMetadata.js:18` titles it
`Add Course`; `CourseFormPage.jsx:40` renders `<h1>Quick course</h1>`. The user sees two names at once,
in two capitalization styles. `COPY_AND_TERMINOLOGY.md` § 4 asks screen documents to record exactly this;
a task is filed in § 11.

## 1. Purpose

Creates a minimum-viable course in one submit so a round can start immediately: a name, an optional
location, a hole count, and one par value applied to every hole. It is explicitly a stub-maker — the page
says so — and it is the only course-creation surface in the app.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Add course` in the `/courses` page header | `Link` from `courses-root` | Primary path |
| In | `Build a course` in the `/courses` directory empty state | `Link` from `courses-root` | Same destination |
| In | `Add course` in the `/rounds/new` no-courses empty state | `Link` from `round-start` (`RoundStartPage.jsx:133`) | The dead-end recovery path when a round cannot start |
| In | Direct URL / restored session | Route match | `ProtectedRoute` + the `AppShell` onboarding gate apply |
| Out | `Cancel` | `Link` to `/courses` | In-page, top right; **not** the shell back control |
| Out | Successful submit | `navigate('/courses/' + course.id)` (`CourseFormPage.jsx:29`) | Replaces nothing — the form stays in history, so the browser Back button returns to a form the user already submitted |
| Out | Shell back control | Header, shell-owned | Goes to `/courses` (section root), same as Cancel |
| Out | Tab re-tap on COURSES | `TabBar` → `resolveSectionRoot('courses')` | Returns to `/courses` |

The `/rounds/new` entry matters: `round-start` renders an empty state instead of a form when the course
catalog is empty, so this screen is a required step in the first-ever-round flow.

No query parameters are read. Unlike `round-start`, this screen accepts no prefill.

Guards: only `ProtectedRoute` and the onboarding gate.
`useActivityNavigationLifecycle` never intercepts a `standard`-shell route — it acts solely on
transitions into and out of `SHELL_TYPES.ACTIVE` (`useActivityNavigationLifecycle.js:36-38`), and no
COURSES route uses the active shell.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Add Course                           [ bell ]    | <- Shell header; title != page h1
+-------------------------------------------------------+
|  QUICK COURSE                        [ Cancel ]       | <- .practice-header; .link-button
+-------------------------------------------------------+
|  Create a lightweight course now and enrich its       | <- .form-info, static copy
|  hole details later.                                  |
|                                                       |
|  [ error message ]                                    | <- .form-error, only after a failed submit
+-------------------------------------------------------+
|  Course name                                          |
|  [_______________________________________]  required  |
|                                                       |
|  Location                                             |
|  [_______________________________________]  optional  |
|                                                       |
|  Number of holes                                      |
|  [ 9        ]  min 1 / max 36 / required              | <- type=number, spinner keyboard
|                                                       |
|  Default par per hole                                 |
|  [ 3        ]  min 2 / max 6 / required               | <- type=number
|                                                       |
|  [            Create course             ]             | <- .btn-primary, full width, 80px tall
|                                       ("Creating…")   |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

There is no per-hole editor, no par-per-hole variation, no distance field, no tee-type field, and no
layout name control. Every one of those columns exists in the schema and is written as `null` or a
constant — see § 5.

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back to /courses, title "Add Course", notification bell
Body (shell scroll region, scrollKey courses-form)
  Page header (.practice-header)
    hdr-title ............ h1, "Quick course"
    hdr-cancel ........... "Cancel" link
  Intro
    info-copy ............ "Create a lightweight course now and enrich its hole details later."
  Error
    err-inline ........... form-error, present only when a submit failed
  Form (.putt-form, onSubmit=handleSubmit)
    fld-name ............. label + text input, required
    fld-location ......... label + text input, optional
    fld-holes ............ label + number input, min 1 max 36, required, default "9"
    fld-par .............. label + number input, min 2 max 6, required, default "3"
    cta-submit ........... "Create course" / "Creating…"
Tab bar (shell-owned)
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Quick course` | — | — | — | always. Diverges from the route title `Add Course` |
| `hdr-cancel` | link (`.link-button`) | `Cancel` | default / pressed | navigate | `/courses` | always, including mid-save — there is **no** guard on abandoning an in-flight submit |
| `info-copy` | `<p class="form-info">` | `Create a lightweight course now and enrich its hole details later.` | static | — | — | always. **The promised enrichment surface does not exist** — see § 12 |
| `err-inline` | `<p class="form-error">` | `err.message`, verbatim from Supabase or from `createCourseWithLayout`'s own `throw new Error(...)` | present / absent | — | — | set on submit failure, cleared at the start of the next submit (`:19`). Inline and non-blocking — the form stays usable, which is the right pattern and the one `courses-root` and `course-detail` lack |
| `fld-name` | text input, `id="course-name"` | label `Course name` | empty / filled / browser-invalid | set state | local | `required`; browser-validated. Not trimmed client-side — `createCourseWithLayout` trims and rejects whitespace-only with `Course name is required` (`roundLog.js:200`) |
| `fld-location` | text input, `id="course-location"` | label `Location` | empty / filled | set state | local | optional. Empty string → `null` server-side (`roundLog.js:210`), which is what makes the `Location not set` fallback on `courses-root` and `course-detail` correct |
| `fld-holes` | number input, `id="course-hole-count"` | label `Number of holes` | default `"9"` / edited / browser-invalid | set state | local | `min="1" max="36" required`. **Clamped again on submit**: `Math.max(1, Math.min(36, Number(holeCount) \|\| 0))` (`:21`), so a pasted `999` silently becomes 36 rather than erroring |
| `fld-par` | number input, `id="course-default-par"` | label `Default par per hole` | default `"3"` / edited / browser-invalid | set state | local | `min="2" max="6" required`. Clamped on submit to 2–6 with a fallback of 3 (`:22`). Applied to **every** hole — per-hole par is not editable here |
| `cta-submit` | button (`.btn-primary`) | `Create course` → `Creating…` while saving | idle / saving / disabled | `createCourseWithLayout` then navigate | `courses` + `layouts` + `holes` | `disabled={saving}`. Guards double-submit **within one attempt only** — see § 12 question 2 |

Every input has an explicit `htmlFor`/`id` pair. That is the good pattern from
[`screens/disc-detail.md`](disc-detail.md) § 8 and this screen follows it completely.

## 5. Data contract

### Reads

**N/A** — this screen reads nothing. It renders from four `useState` defaults and `useAuth().user`.
That is why it has no loading state and no read-path error state, and why it is the only screen in the
COURSES section that renders instantly.

### Writes

| Mutation | Call | Idempotency key | Local transaction boundary |
|---|---|---|---|
| Create course + default layout + N holes | `createCourseWithLayout({ userId, name, location, holes })` (`lib/roundLog`) | **none** | **none** |

`createCourseWithLayout` (`roundLog.js:192-236`) is three sequential Supabase round trips against a
client-minted `courseId` and `layoutId`, then a re-fetch:

1. validate `ownerId`, `name.trim()`, `holes.length > 0` — throws before any write
2. `upsert` one `courses` row (`created_by = ownerId`)
3. `upsert` one `layouts` row — always `name: 'Main'`, `is_default: true`
4. `upsert` N `holes` rows — `hole_number` 1..N, `par` as clamped, and
   `distance_feet`, `tee_type`, `hazards`, `strategy_notes` all `null`
5. `return fetchCourse(courseId)` — a fourth round trip, whose result is used only for `course.id`

**There is no transaction and no rollback.** Steps 2–4 are independent statements. A failure at step 3 or
4 leaves a course row with no layout, or a layout with no holes, permanently — and because the J1 RLS
migration ships no delete policy for `courses`/`layouts`/`holes`
(`20260714150000_phase_c_round_logging_rls.sql`), the orphan cannot be cleaned up by any user. The
`This course has no layout holes yet.` empty state on `course-detail` (`CourseDetailPage.jsx:50`) is
precisely the visible symptom of a partial creation. This is the sharpest divergence on the screen from
`PHASE_A_ARCHITECTURE.md` § 14, which requires local-first writes inside one transaction with an ordered,
idempotent outbox; none of that applies here because `roundLog.js` is Supabase-only with no repository in
front of it (`LIB_API_INDEX.md:640`).

Ids are minted client-side with `crypto.randomUUID()` and written with `onConflict: 'id'`, which makes a
*replay of the same payload* idempotent — but nothing replays it, and each fresh submit mints new ids, so
a user-initiated retry after a timeout creates a duplicate course. See § 12 question 2.

### Offline

**The screen does not work offline at all.** `createCourseWithLayout` has no Dexie write, no outbox
entry, and no local fallback. Submitting with no network rejects at step 2 and surfaces the raw network
error in `err-inline`; the typed values survive in component state, so a retry after reconnect works, but
nothing is queued and nothing syncs on its own.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`) is displayed. `Saved on Device` is the state this screen most obviously wants and
cannot express, because there is no local write to describe.

This is the load-bearing offline gap in the section: `round-start` requires at least one course, so a
player who arrives at an unlisted course with no signal cannot create it, cannot start a round, and has
no path forward — even though `round-scorecard` itself is fully offline-capable. Tracked as
`T-courses-new-2` and as `round-start` § 12 question 1.

## 6. Flow paths

**Happy path.** `/courses` → `Add course` → type a name → accept the `9` / `3` defaults → `Create course`
→ button reads `Creating…` (`S-SAVING`, `CourseFormPage.jsx:78` — a page-owned hand replication of
`EditableSection`'s pattern, with the control disabled while in flight, which is the row's correct shape)
→ three writes succeed → `fetchCourse` returns → `navigate('/courses/<id>')` → `course-detail` renders
the `Main` layout with nine par-3 holes and a `Start round` button.

**First run / empty.** `S-EMPTY` and `S-LOAD` are both `➖` here — this screen has no data-dependent
state, so there is no distinct empty rendering and no initial read to wait on. Identical to the happy
path. It is the entry point *out of* the empty state on both `courses-root` and `round-start`.

**Error.** `S-ERR-INLINE` (`CourseFormPage.jsx:47`) — any rejection sets `err-inline` and clears
`saving`, leaving every field populated and the button live. **This screen is deliberately outside
`S-ERR-BLOCK`**, one of the minority the row does not list among its 19; there is no page-level error
state. `S-RETRY` binds only nominally, as on `goals`: no retry control exists, but the form stays live
so resubmitting *is* the retry. Three distinct error sources reach the same banner with three different
registers of copy:

| Source | Message the user sees |
|---|---|
| `roundLog.js:199` | `You must be signed in to create a course` |
| `roundLog.js:200` | `Course name is required` |
| `roundLog.js:201` | `A course needs at least one hole` |
| Supabase / network | raw PostgREST or fetch error text |

The first three are house copy; the fourth is not, and it is the one an offline user always gets.

**Offline.** `S-OFFLINE-READ` — `lib/roundLog` is one of the eight modules with no cache, though it costs
little here because the screen reads nothing on mount. **Diverges from `S-OFFLINE-WRITE`:**
`createCourseWithLayout` is three direct Supabase writes with no outbox and no flush, so submission is a
hard failure with a raw message, values retained, nothing queued — and no `S-SYNC` label is displayable.
Worse than the row's generic uncovered-write case, because the three writes are not atomic: a partial
success leaves the zero-hole layout that `course-detail` § 6 records as unhandled. As § 5.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell; `CourseFormPage.jsx:7`
dereferences `user.id` unconditionally. `createCourseWithLayout` additionally re-resolves the user via `supabase.auth.getUser()`
when `userId` is falsy (`roundLog.js:193-198`) — defensive, and unreachable from this screen. A Supabase
anonymous (guest) session can create courses, and those courses are visible to every authenticated user
because of the community-read RLS policy; nothing warns the user of that.

**Interlock.** Two numeric bounds, both enforced twice and neither backed by a database constraint:

| Bound | Input attribute | Submit clamp | DB constraint |
|---|---|---|---|
| Hole count 1–36 | `min="1" max="36"` | `Math.max(1, Math.min(36, …))` (`:21`) | none |
| Par 2–6 | `min="2" max="6"` | `Math.max(2, Math.min(6, …))` (`:22`) | none |

Both clamp **silently** — an out-of-range value is corrected without a message, so a user who types `50`
gets a 36-hole course with no explanation. Contrast the two hard interlocks named in
`SCREEN_SPECS.md` standing divergence #6 (the 100-putt routine ceiling and the 35-disc bag capacity),
which have "app-side disabling AND a DB `CHECK` constraint." These do not, and the app-side handling is
correction rather than disabling.

`S-INTERLOCK-CAP` surveys three ceilings and does not include these two. They introduce a **fourth
enforcement quality** the row does not describe: not "enforced, inconsistently pre-empted" but *silently
corrected and never enforced* — no disable, no message, and no backing constraint. Of everything in the
COURSES section this is the only interlock that changes the user's data without telling them. Noted in
`_corrections/state-citations-2.md`.

**Destructive.** **N/A** — the screen creates only, so `S-CONFIRM` is `➖`. The relevant destructive fact
is the absence of the
inverse: a course created here can never be deleted (§ 5), so an accidental submit is permanent and
globally visible. `Cancel` discards unsaved input with no confirmation, which is appropriate for a form
this short.

## 7. Dependencies

### Schema

- `courses` — writes `id`, `name`, `location`, `created_by` (`supabase_schema.sql:55-62`). Insert policy
  requires `created_by = auth.uid()`
  (`supabase/migrations/20260714150000_phase_c_round_logging_rls.sql:42-47`). No unique constraint on
  `name`, so duplicate course names are permitted.
- `layouts` — writes `id`, `course_id`, `name: 'Main'`, `is_default: true`. Introduced as a first-class
  table by `disc_locker_and_layouts_schema.sql:77-84`, which also adds
  `layouts_course_name_uniq (course_id, lower(name))` and `layouts_one_default_per_course` — a partial
  unique index guaranteeing at most one default layout per course. Because this screen always writes
  exactly one layout per new course, neither index can be violated from here.
- `holes` — writes `id`, `layout_id`, `hole_number`, `par`, and explicit `null` for `distance_feet`,
  `tee_type`, `hazards`, `strategy_notes`. `holes.layout_id` was added by
  `disc_locker_and_layouts_schema.sql:94-96`; `migrate_disc_locker_and_layouts.sql:199-202` makes it
  `NOT NULL`, drops the legacy `holes.course_id`, and replaces the old uniqueness with
  `holes_layout_hole_tee_uniq (layout_id, hole_number, tee_type)`. **That index does not prevent
  duplicate hole numbers when `tee_type` is `null`**, because Postgres treats NULLs as distinct in a
  unique index by default — and this screen always writes `tee_type: null`. Unreachable from this form
  (hole numbers are generated `1..N`), but it is a live hazard for any future per-hole editor.

### Library

`lib/roundLog` (`createCourseWithLayout`, which internally calls `fetchCourse`), `context/AuthContext`
(`useAuth`), `react-router-dom` (`Link`, `useNavigate`). Signatures in
[`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

No pure-logic module is involved. The two clamps and the hole-array construction are inline in
`handleSubmit` (`CourseFormPage.jsx:21-28`) rather than in `src/lib/`, which is why they are untestable
without mounting the page — the direct cause of acceptance criteria 1–4 below having no home.

### Components

**None.** No import from `src/components/`. The form is raw JSX on the `.putt-form` class.

Notably absent: the segmented-stepper pattern the rest of the app uses for bounded numeric choices.
`routineBuilder.js` exports `DISTANCE_OPTIONS` and `PUTT_OPTIONS` as chip arrays and `onboarding.js`
exports `MIN_WEIGHT_GRAMS`/`MAX_WEIGHT_GRAMS`/`WEIGHT_STEP_GRAMS` for a stepper
([`LIB_API_INDEX.md`](../LIB_API_INDEX.md) §§ 3). Hole count and par are exactly that shape of choice and
are typed instead. See § 12 question 1.

### Screens

- **Requires:** `courses-root` or `round-start` to reach it.
- **Required by:** `round-start` — a round cannot begin without at least one course with at least one
  layout hole, and this is the only screen that creates one.
- **Hands off to:** `course-detail`, unconditionally, on success.

### Contracts and decisions

- `PHASE_A_ARCHITECTURE.md` § 14 (repository and transaction contract) — **not satisfied**; see § 5.
  This is the clearest instance in the section of a write path that predates the repository pattern.
- `PHASE_A_ARCHITECTURE.md` § 12 — 80pt primary action (met by `.btn-primary`), 44pt secondary
  (not met by `.link-button`), keyboard-safe fields, 320px width.
- `PHASE_A_ARCHITECTURE.md` § 13 — shell/route boundaries; correctly observed.
- **Zero-typing principle.** Not a numbered contract section, but a stated project principle running
  through onboarding, the routine builder, and PDGA entry, restated in
  `docs/decisions/0001-live-round-interaction-model.md` § Context: "the app avoids keyboards on purpose."
  This screen is four keyboard fields. It is not blocked by ADR 0001 — that ADR scopes the live round
  screens — but the same principle bears on it. See § 12 question 1.
- No blocking ADR.
- `DEVELOPMENT_PLAN.md` § E2 owns the backlog.

## 8. Accessibility

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** all four inputs have explicit `htmlFor`/`id` pairs (`course-name`, `course-location`,
  `course-hole-count`, `course-default-par`). Complete, and the pattern to copy.
- **Good:** `required` plus `min`/`max` mean validation is browser-native, so the failure is announced by
  the platform rather than by untested custom code.
- **Good:** `cta-submit` inherits `min-height: var(--tap-target-min)` = 80px (`index.css:44`,
  `App.css:435-446`), meeting the 80pt primary-action rule, and its label changes to `Creating…` so the
  busy state is conveyed as text and not by a spinner alone.
- **Gap:** `hdr-cancel` is a `.link-button` with no `min-height` and no padding (`App.css:455-466`) —
  roughly 17px tall against a 44×44pt minimum. Shared fix tracked as `T-courses-root-6`.
- **Gap:** `err-inline` has no `role="alert"` and no `aria-live`, so a submit failure is silent to a
  screen-reader user whose focus is still on the button. This screen needs it more than the read-only
  screens do, because the error is the only feedback a failed submit produces.
- **Gap:** the silent clamping in § 6 has no assistive-tech counterpart either. A value corrected from
  `50` to `36` is announced to nobody, including sighted users.
- **Gap:** `type="number"` raises a numeric-with-spinner keyboard rather than a plain numeric keypad, and
  offers scroll-wheel and arrow-key increment that can change a committed value unintentionally.
  `inputMode="numeric"` is used on `round-scorecard`'s score input (`RoundScorecardPage.jsx:201`) and is
  absent here — an inconsistency within one section.

## 9. Events and telemetry

**N/A** — no metrics, no notifications, no lifecycle events.

Creating a course writes no lifecycle activity: `ACTIVITY_TYPES` (`activityLifecycle/types.js:9-17`) has
no course-creation type, and only `round-start` (via `roundRepository.ensureRoundActivity`) touches the
lifecycle in this section. `PHASE_A_ARCHITECTURE.md` § 5 anticipates `course` and `layout` metric
subjects; `src/lib/metrics/registry.js` declares only `player`, `routine`, `session`, and
`physical_disc`.

## 10. Tests

### Existing coverage

**None.** Confirmed by reading every import of `CourseFormPage.jsx`:

| Import | Test file |
|---|---|
| `lib/roundLog` (`createCourseWithLayout`) | **absent** — no `src/lib/roundLog.test.js` exists |
| `context/AuthContext` | absent |

[`TEST_MAP.md`](../TEST_MAP.md):62 records `courses-new` → **none**, with the note "Quick-course creation
is untested." Confirmed.

Be specific about what that means, because this screen is the one where the untested logic is not
trivial:

- The two clamps (`:21-22`) are unverified. Nothing asserts that `0` becomes `1`, that `999` becomes
  `36`, that `''` becomes `1` via `Number('') || 0`, or that a par of `1` becomes `2`.
- The hole-array construction (`:27`) is unverified. Nothing asserts that `count = 9` yields nine rows
  numbered 1–9 with the clamped par.
- `createCourseWithLayout`'s three-step write is unverified. Nothing asserts the `Main`/`is_default`
  layout, the `null` normalization of `location`, or the three `throw` guards at `roundLog.js:199-201`.
- **Nothing at all covers the partial-write failure mode in § 5** — the one that produces permanently
  orphaned courses.

Because the clamps live inline in the component rather than in `src/lib/`, none of this is testable at
the layer where all 74 of the repo's test files live. `T-courses-new-1` exists to move them.

### Acceptance criteria

1. `Number of holes = 0` produces a course with 1 hole; `= 999` produces 36; `= ''` produces 1.
2. `Default par per hole = 1` produces par-2 holes; `= 9` produces par-6; a non-numeric value produces
   par 3.
3. A submit with `Number of holes = 9` writes exactly nine `holes` rows, numbered 1–9, all with the
   clamped par, all with `layout_id` equal to the created layout.
4. Every created course gets exactly one layout, named `Main`, with `is_default = true`.
5. An empty `Location` writes `null`, not `''` — verified by `course-detail` rendering
   `Location not set`.
6. A whitespace-only course name is rejected with `Course name is required` and no rows are written.
7. A successful submit navigates to `/courses/<newId>` and that page renders the created layout.
8. A failed submit leaves every typed value in place and re-enables the button.
9. Submitting with no network shows an error and **queues the course for later sync**. *Currently
   fails* — nothing is queued.
10. A submit that fails after the `courses` insert but before the `holes` insert leaves no partially
    created course. *Currently fails* — it leaves one, permanently.
11. Submitting twice in a row (double-tap, or retry after a timeout) creates one course, not two.
    *Currently fails for the retry case* — see § 12 question 2.

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built).
These are backlog specs:

1. `/courses` → `Add course` → name + 18 holes + par 3 → `Create course` → land on `/courses/:id` with 18
   rows and `par 54`. This is the first leg of `TEST_MAP.md` E2E backlog item 4.
2. Reject the network mid-submit → assert the error renders inline, the form is still populated, and a
   retry after reconnect succeeds **exactly once**.
3. Create a course with an empty Location → assert `Location not set` on both `courses-root` and
   `course-detail`.
4. Create a course as user A → sign in as user B → assert it appears in B's directory (the community-read
   RLS contract, which no test covers at any layer).

## 11. Tasks

E2 (`DEVELOPMENT_PLAN.md` § E2) owns these. Ordered by dependency.

#### T-courses-new-1 — Extract quick-course construction into a tested pure module

- **Capability:** `pure-logic`
- **Touches:** `src/lib/courses.js` (new), `src/lib/courses.test.js` (new),
  `src/pages/CourseFormPage.jsx`
- **Done when:** a pure `buildQuickCourseHoles({ holeCount, par })` (clamping 1–36 and 2–6 and returning
  `{ holeNumber, par }[]`) exists with unit tests covering acceptance criteria 1–3, and
  `CourseFormPage.jsx` calls it instead of the inline expressions at `:21-28`.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `refactor: extract quick-course hole construction into a tested module`

#### T-courses-new-2 — Make course creation survive an offline submit

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/` (course repository), `src/lib/db/dexieDb.js`,
  `src/pages/CourseFormPage.jsx`
- **Done when:** submitting with no network writes the course, layout, and holes to Dexie, queues one
  outbox entry, navigates to `/courses/<localId>`, and replays exactly once on reconnect; the outbox
  entry carries an idempotency key so a replay cannot duplicate the course.
- **Verify:** `npm test` covering queue-then-flush and flush-twice-is-a-no-op; manual offline create in
  `npm run dev` followed by reconnect.
- **Commit:** `feat: queue quick-course creation for offline sync`
- **Blocked by:** `T-courses-root-4` (the course cache this writes through) and `T-courses-new-1`.

#### T-courses-new-3 — Make the three-statement course write atomic

- **Capability:** `schema`
- **Touches:** new migration under `supabase/migrations/`, `src/lib/roundLog.js`
- **Done when:** course + layout + holes are created by one idempotent authenticated Supabase RPC that
  either writes all three or none; a forced failure between statements leaves no orphaned course.
- **Verify:** `npm test` for the client call plus a negative SQL test asserting rollback; rollback notes
  in the migration per `TASK_FORMAT.md`.
- **Commit:** `feat: create quick courses in one atomic RPC`
- **Note:** `PHASE_A_ARCHITECTURE.md` § 14 already requires this shape ("Independent browser
  find/update/insert calls are not acceptable"). Schema files are append-only
  (`DEVELOPMENT_PLAN.md` § Standing conventions).

#### T-courses-new-4 — Replace the numeric text fields with steppers

- **Capability:** `ui-routine`
- **Touches:** `src/lib/courses.js`, `src/pages/CourseFormPage.jsx`, `src/App.css`
- **Done when:** hole count and par are chosen from segmented options (`9` / `18` / custom, and `3` / `4`
  / `5`) in the shape used by `DISTANCE_OPTIONS`/`PUTT_OPTIONS`, with no keyboard required for the common
  case; the clamps remain as a safety net for the custom path.
- **Verify:** `npm test` for the option constants; manual one-thumb check at 320px width.
- **Commit:** `feat: choose hole count and par without a keyboard`
- **Blocked by:** § 12 question 1.

#### T-courses-new-5 — Reconcile the route title and the page heading

- **Capability:** `docs`
- **Touches:** `src/lib/routeMetadata.js` **or** `src/pages/CourseFormPage.jsx`, plus
  `src/lib/routeMetadata.test.js` if the metadata changes
- **Done when:** the shell header and the page `h1` name this screen identically, and
  `COPY_AND_TERMINOLOGY.md` § 4's Title Case vs sentence case split is applied consistently to whichever
  wins.
- **Verify:** `npm test` (`routeMetadata.test.js`) plus a visual check at `/courses/new`.
- **Commit:** `fix: use one name for the quick course screen`
- **Note:** touching `routeMetadata.js` also changes `SCREEN_INVENTORY.md`'s identity row and this
  document's identity block. Land all three together.

#### T-courses-new-6 — Announce submit failures and silent clamps

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CourseFormPage.jsx`
- **Done when:** `err-inline` carries `role="alert"`, and a clamped hole count or par renders a visible
  note ("Set to the maximum of 36 holes") rather than changing silently.
- **Verify:** `npm run lint` plus a manual VoiceOver pass submitting an invalid form.
- **Commit:** `fix: announce course form errors and clamped values`

## 12. Open questions

1. **Should this form use a keyboard at all?** Hole count and par are bounded enumerations with two
   overwhelmingly common answers (9 or 18 holes; par 3). The app's stated zero-typing principle —
   restated in `docs/decisions/0001-live-round-interaction-model.md` § Context — and its existing stepper
   constants (`DISTANCE_OPTIONS`, `PUTT_OPTIONS`, `WEIGHT_STEP_GRAMS`) both point at chips. Course name
   genuinely needs a keyboard; the other three fields probably do not. Blocks `T-courses-new-4`.
2. **A retried submit creates a duplicate course.** `saving` guards a double-tap within one attempt, but
   each call to `handleSubmit` mints fresh UUIDs (`roundLog.js:203-204`). A submit that times out after
   the server committed, followed by the user pressing the button again, produces two identical courses —
   both permanently visible to every user (community read, no delete policy). Fixing this needs a
   mount-stable client id, the way `createRepository`'s `useCreate` "mints a stable `clientId` per mount
   so a retried create upserts" (`LIB_API_INDEX.md:686`). Folded into `T-courses-new-2`.
3. **`info-copy` promises an enrichment path that does not exist.** "Create a lightweight course now and
   enrich its hole details later" — there is no hole editor anywhere in the app. `course-detail` is
   read-only, and `distance_feet`, `tee_type`, `hazards`, and `strategy_notes` are written as `null` here
   and never written again by any screen. Either build the editor or change the copy;
   `DEVELOPMENT_PLAN.md` § E2's "course preparation" item is the natural home for the editor.
4. **Should a course be per-user or community?** Inherited from `courses-root` § 12 question 1, and
   sharper here: this screen is where a private-looking act ("add my home course") becomes a globally
   visible, undeletable row. If the answer is "community," this form should say so before submit.
5. **Hole numbering assumes a contiguous 1..N course.** Every hole gets `tee_type: null` and
   `hole_number = index + 1`. Courses with lettered holes, multiple tees, or a 21-hole layout with a
   skipped number cannot be represented, and the `holes_layout_hole_tee_uniq` index will not catch a
   duplicate once a per-hole editor allows `tee_type` to stay null. Decide the tee-type model before
   building the editor from question 3.

Filed corrections touching this screen:
[`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-1
(`preserveNestedState`), CS-3 (`STATE_MATRIX.md`, since resolved), CS-4 (§ J1's stated reuse — the "secondary
tasks in sheets" ergonomics claim is not met here), CS-7 (activity pill).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no
course-creation screen; `/courses/new` shipped as `DEVELOPMENT_PLAN.md` § J1 on 2026-07-14, ahead of
`PRODUCT_ROADMAP.md` Phase E by owner decision.

The closest blueprint relative is **Screen 13, Frictionless UDisc Ingestion Center** — unbuilt, no route
— which creates `courses` rows by import rather than by hand and resolves name variants through the
existing `course_aliases` table (`SCREEN_SPECS.md:334-346`). When it lands, it becomes a second writer of
the same three tables, and `T-courses-new-3`'s atomic RPC should be shared by both rather than
duplicated.

Standing divergences #1 (React/Vite, not Expo — so the blueprint's `SegmentedGridChip` primitive that
`T-courses-new-4` wants is a plain React component) and #3 (append-only additive schema — why `courses`
still carries the vestigial `layout_name` column that this screen never writes) apply; see
`SCREEN_SPECS.md` § Standing divergences. Divergence #6's "app-side disabling AND a DB `CHECK`
constraint" standard for interlocks is **not** met by this screen's two numeric bounds — see § 6.
