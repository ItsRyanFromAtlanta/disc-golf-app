# Start Round

| Field | Value |
|---|---|
| Route id | `round-start` |
| URL pattern | `/rounds/new` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Start Round` |
| Activity pill | declared shown (`showActivityPill: true`) — inert for rounds, see `_corrections/courses-screens.md` CS-7 |
| Scroll key | `round-start` |
| Preserves nested state | `true` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/RoundStartPage.jsx` (192 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

Route title `Start Round` (Title Case) against page `h1` `Start round` (sentence case) — the same
capitalization split `COPY_AND_TERMINOLOGY.md` § 4 catalogues app-wide, here inside one screen.

## 1. Purpose

The pre-round setup form: choose a course, a layout, and optionally the bag being carried, then create
the round and hand off to the scorecard. It is where the round's immutable context — which holes, which
discs were available — is fixed before a single throw is recorded.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Start round` on a layout in `/courses/:courseId` | `Link` with `?courseId=&layoutId=` (`CourseDetailPage.jsx:66`) | Primary path; both selects arrive prefilled |
| In | `Start a round` in `/courses/:courseId`'s no-layouts empty state | `Link` with `?courseId=` only (`CourseDetailPage.jsx:51`) | **Dead end** — a course with no layouts cannot produce a round; see § 6 |
| In | `Start round` in the `/rounds` page header | `Link` from `rounds-root` | No parameters; first course and its default layout are preselected |
| In | `Log a round` in the `/rounds` empty state | `Link` from `rounds-root` | Same |
| In | Direct URL / restored session | Route match | `ProtectedRoute` + the `AppShell` onboarding gate apply |
| Out | `Cancel` | `Link` to `/courses` | In-page, top right. Note it returns to the **course directory**, not to `/rounds` or to the course the user came from |
| Out | `Add course` (no-courses empty state) | `Link` to `/courses/new` | The recovery path when the catalog is empty |
| Out | Successful submit | `navigate('/rounds/' + round.id)` (`RoundStartPage.jsx:106`) | To the scorecard |
| Out | **Failed** submit with a local round | `navigate('/rounds/' + err.localResult.id)` (`:108-111`) | The offline path — see § 5. The user reaches the scorecard on a round that exists only on this device |
| Out | Shell back control | Header, shell-owned | Goes to `/courses` (section root), same as Cancel |
| Out | Tab re-tap on COURSES | `TabBar` → `resolveSectionRoot('courses')` | Returns to `/courses` |

**Query parameters.** This is the only screen in the app besides `lost-found` that reads them:

| Parameter | Read at | Binding |
|---|---|---|
| `courseId` | `RoundStartPage.jsx:13` | **Advisory.** `:34-37` keeps it only if it appears in `fetchCourses()`; otherwise it silently falls back to `courseRows[0]` |
| `layoutId` | `:14` | **Advisory.** `:66-70` keeps it only if it appears in the fetched course's layouts; otherwise it falls back to the `is_default` layout, then to the first |

Neither fallback tells the user. A stale bookmark or a hand-edited link therefore starts a round at a
different course than the URL names, with no warning. `NAVIGATION_MAP.md` § Deep links does not yet list
this contract — filed as [`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-2.

Guards: `ProtectedRoute` and the onboarding gate only. `useActivityNavigationLifecycle` acts solely on
transitions into and out of `SHELL_TYPES.ACTIVE` (`useActivityNavigationLifecycle.js:36-38`) and no
COURSES route uses the active shell, so it never intercepts this screen — **including on the navigation
that has just created a live round activity.**

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Start Round                          [ bell ]    | <- Shell header; Title Case
+-------------------------------------------------------+
|  START ROUND                       [ Cancel ]         | <- .practice-header; sentence case h1
+-------------------------------------------------------+
|  [ error message ]                                    | <- .form-error; load errors and submit errors
+-------------------------------------------------------+
|  Course                                               |
|  [ East Roswell Park                          v ]     | <- native select; no placeholder option
|                                                       |
|  Layout                                               |
|  [ Main · 18 holes                            v ]     | <- disabled while the course loads
|                                                       |
|  Bag (optional)                                       |
|  [ Tournament Bag                             v ]     | <- pre-selected to the default bag
|                                                       |
|  18 holes · par 54                                    | <- .form-info; only when a layout resolves
|                                                       |
|  [            Start round               ]             | <- .btn-primary, 80px; "Starting…" while saving
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

No-courses variant (replaces the entire form):

```
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
|  |  Create a quick course before starting a round. |  |
|  |  [             Add course              ]        |  |
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
```

There is no weather field, no target-score field, no player list, and no starting-hole choice. All four
exist as schema columns or roadmap items — `rounds.weather_summary` and `rounds.target_score`
(`supabase_schema.sql:109-110`) are never written by any screen, and weather and group scorecards are
named as later E2 items (`DEVELOPMENT_PLAN.md` § E2).

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back to /courses, title "Start Round", notification bell
Body (shell scroll region, scrollKey round-start)
  Page header (.practice-header)
    hdr-title ............ h1, "Start round"
    hdr-cancel ........... "Cancel" link
  Error
    err-inline ........... form-error; carries both load and submit failures
  No-courses empty state (replaces the form entirely)
    empty-copy ........... "Create a quick course before starting a round."
    empty-cta ............ "Add course" → /courses/new
  Form (.putt-form, onSubmit=handleSubmit)
    fld-course ........... label + select, one option per course
    fld-layout ........... label + select, one option per layout of the selected course
    fld-bag .............. label + select, "No bag selected" + one option per bag
    info-summary ......... "<n> holes · par <parTotal>" for the resolved layout
    cta-submit ........... "Start round" / "Starting…"
Tab bar (shell-owned)
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Start round` | — | — | — | always |
| `hdr-cancel` | link (`.link-button`) | `Cancel` | default / pressed | navigate | `/courses` | always, including mid-save — no guard on abandoning an in-flight create |
| `err-inline` | `<p class="form-error">` | `err.message`, or the literal `Choose a course and layout first` (`:92`) | present / absent | — | — | set by either effect's `catch` **or** by submit. Load errors and submit errors share one banner with no distinction, and a load error is never cleared by a later successful load |
| `empty-copy` + `empty-cta` | block (`.empty-state`) | `Create a quick course before starting a round.` + `Add course` | — | navigate | `/courses/new` | shown when `courses?.length === 0` (`:130`). Note the `?.` — when `fetchCourses` **fails**, `courses` is `null`, the test is false, and the form renders instead with an empty course select and a disabled button |
| `fld-course` | select, `id="round-course"` | label `Course`; option text = `course.name` | — | set course, then clear the layout (`:143-146`) | local state | one option per course. **No placeholder option**, so the select always displays something; the value is preselected at `:34-37`. No search or filter — every community course is an option (see `courses-root` § 5) |
| `fld-layout` | select, `id="round-layout"` | label `Layout`; option text = `<name> · <n> holes` | enabled / disabled | set layout | local state | `disabled={loadingCourse \|\| !course?.layouts.length}` (`:160`). A course with no layouts renders an empty, disabled select with no explanatory text |
| `fld-bag` | select, `id="round-bag"` | label `Bag (optional)`; first option `No bag selected`, then `bag.name` | — | set bag | local state | **Despite the "(optional)" label the default bag is preselected** at `:38-41` (`bagRows.find(b => b.is_default) ?? bagRows[0]`), so choosing "no bag" is an explicit opt-out. This matters: a selected bag triggers a bag-version capture on submit (§ 5) |
| `info-summary` | `<p class="form-info">` | `<n> holes · par <parTotal(selectedLayout.holes)>` | present / absent | — | — | rendered only when `selectedLayout` resolves (`:179-183`). **Does not pluralize** — a one-hole layout reads `1 holes`, the same defect as `course-detail`'s `lay-summary` |
| `cta-submit` | button (`.btn-primary`) | `Start round` → `Starting…` while saving | idle / saving / disabled | `useCreateRound().mutateAsync` then navigate | `rounds` (+ `activities`, `bag_versions`) | `disabled={saving \|\| loadingCourse \|\| !selectedLayout}` (`:185`). Disabled — with no stated reason — whenever the chosen course has no layouts |

No control on this screen writes anything until `cta-submit`. Everything above it is local state.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Course list | `fetchCourses()` | `lib/roundLog` | Supabase (`courses`) | async, **no local mirror** |
| User's bags | `fetchBags(user.id)` | `lib/discLocker` | Supabase (`bags`) | async, **no local mirror** |
| Selected course + layouts + holes | `fetchCourse(selectedCourseId)` | `lib/roundLog` | Supabase | async, **no local mirror**, re-run on every course change |
| Layout par total | `parTotal(selectedLayout.holes)` | `lib/rounds` | — | **pure** |

Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

Two effects, both correctly race-guarded with an `active` flag:

- `:27-53`, keyed on `user.id` — `Promise.all([fetchCourses(), fetchBags(user.id)])`, then resolves the
  course selection and preselects the default bag.
- `:55-82`, keyed on `selectedCourseId` — `fetchCourse`, then resolves the layout selection, preferring
  the `is_default` layout.

**Every read is Supabase-only** (`LIB_API_INDEX.md:640` lists both `roundLog.js` and `discLocker.js`
under "Supabase only (no local mirror)"), so this screen cannot be *reached* usefully offline even though
the round it creates can be *written* offline. See § 5 Offline.

### Writes

| Mutation | Call | Idempotency key | Local transaction boundary |
|---|---|---|---|
| Capture the bag snapshot | `captureBagVersion(bag_id, { idempotencyKey: 'round-bag:<roundId>' })` | `round-bag:<roundId>` | Supabase RPC — atomic server-side |
| Create the lifecycle parent | `activityRepository.createDraft` then conditionally `.start` | `round:<roundId>:create`, `round:<roundId>:start` | One Dexie transaction each, per `PHASE_A_ARCHITECTURE.md` § 14 |
| Create the round | `useCreateRound(user.id).mutateAsync(fields)` → `createRound` | none of its own; the client-minted `id` plus `onConflict: 'id'` makes replay idempotent | Dexie write + one shared-`outbox` entry, queued **before** the remote call |

`useCreateRound` (`roundRepository.js:244-283`) is the most carefully built write path in the section and
worth reading in order:

1. Mint `roundId = crypto.randomUUID()`.
2. If a bag is selected, `captureBagVersion(bag_id, { idempotencyKey: 'round-bag:<roundId>' })` — the
   `capture_bag_version` Supabase RPC (`LIB_API_INDEX.md:757`). On failure, fall back to
   `latestBagVersion(await loadBagVersions(bag_id))?.id ?? null`.
3. Build `payload = { ...fields, id: roundId, user_id, bag_version_id }`.
4. `runQueuedMutation` (`roundRepository.js:210-222`): **add an outbox row first**, then write the
   optimistic round into Dexie, then call the remote, then write the remote result, then delete the
   outbox row. Queue-before-remote is exactly the durability ordering
   `PHASE_A_ARCHITECTURE.md` § 14 requires and `offlineFirstRepository.writeThrough` documents
   (`LIB_API_INDEX.md:679`).
5. The remote is `createRoundWithActivity` (`:164-172`): `ensureRoundActivity` → flush the activity sync
   adapter → `createRound`.
6. On any failure, attach `error.localResult = payload` and rethrow, so the page can navigate to the
   optimistic round (`:274-278`).

**The lifecycle bridge is the part with a consequence the code comment does not follow through on.**
`ensureRoundActivity` (`:127-162`):

- creates an `activities` draft whose **id is the round id**, type `disc_golf_round`. This is required,
  not decorative: `rounds(id, user_id)` carries a composite FK to `activities(id, user_id)`
  (`supabase/migrations/20260712193922_phase_a_activity_lifecycle.sql:295-296`), so the parent must exist
  before the round insert. The comment at `:123-126` says so.
- then, **only if `activityRepository.getActive(userId)` returns nothing**, starts it. The comment at
  `:140-144` explains the choice: "Starting a new round while another activity is current requires the
  existing lifecycle confirmation flow. J1 keeps that decision out of the round form, so it leaves the
  parent as a draft in that case."

What the comment does not say is what a permanently-draft parent costs:

| Consequence | Where |
|---|---|
| `finalizeRoundActivity` refuses to act on a `draft` parent — it returns early unless the state is `active` or `paused` | `roundRepository.js:174-183` |
| so the activity never reaches `completed`, even after the user finishes the round | — |
| and `weeklyReportRepository` counts only rounds whose activity id appears among activities in state `completed` | `weeklyReportRepository.js:6, 38, 50` |
| **so a round started while any other activity was current never appears in a weekly report**, no matter how completely it is played | — |

Nothing in the UI surfaces this, and `rounds.status` still reads `completed`, so the round looks finished
everywhere except in the report. Tracked as `T-round-start-3` and `round-summary` § 12 question 1.

The inverse case is also live: when the round *does* start its activity, the round becomes the user's
single current activity. `PracticeMenuPage.jsx:162-169` then renders **"▶️ Resume active practice"** on
`/practice` linking to `/practice/freeform` — the wrong destination, because that branch has no
`disc_golf_round` case. Filed as
[`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-6.

### Offline

Mixed, and broken in a way that is easy to miss.

**Reads: no offline support.** `fetchCourses`, `fetchBags`, and `fetchCourse` are all Supabase-only. With
no network, `loading` clears, `courses` stays `null`, `courses?.length === 0` is false, and the form
renders with an empty course select, an empty disabled layout select, an error banner containing the raw
network message, and a disabled submit button. The screen is a shell of itself with no path forward.

**Writes: designed to work offline — with one hole.** `runQueuedMutation` queues before the remote call
and `error.localResult` lets the page navigate straight to the optimistic round, so the intended offline
flow is: create locally, land on the scorecard, score the round, flush on reconnect. That flow is real
and `round-scorecard` supports it.

**The hole:** the bag-version step at `roundRepository.js:250-258` runs **before** `payload` and
`runQueuedMutation` exist:

```js
try { bagVersionId = await captureBagVersion(...) }
catch { bagVersionId = latestBagVersion(await loadBagVersions(fields.bag_id))?.id ?? null }
```

`captureBagVersion` is a bare Supabase RPC and always fails offline. `loadBagVersions`
(`bagHistoryRepository.js:23-34`) falls back to the Dexie `bagVersions` table but **rethrows the original
error when the cache is empty** (`:28`). That rethrow escapes `mutationFn` before the `try` that attaches
`error.localResult` — so the page's offline branch at `RoundStartPage.jsx:108` does not fire, no outbox
entry is written, no local round exists, and the user sees a raw error.

And because `fld-bag` preselects the default bag, this is the **default** path, not an edge case. A
player whose device has never cached a bag version — which is to say, one who has never changed a bag
while online — cannot start a round offline at all. The workaround is to set the bag select to
`No bag selected`, which no one would guess.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered on this screen at any point.

## 6. Flow paths

**Happy path.** `/courses/:id` → `Start round` on a layout → both selects prefilled, default bag
preselected, `18 holes · par 54` shown → `Start round` → bag version captured → activity draft created
and started → round row written → `navigate('/rounds/<id>')` → scorecard.

**First run / empty.** Two empties, handled asymmetrically:

| Situation | Behavior |
|---|---|
| No courses | `empty-copy` + `Add course` replaces the form. Correct, and the reason `courses-new` is reachable from here. |
| No bags | Silent. `bags` stays `[]`, no default is preselected, and `fld-bag` shows only `No bag selected`. Fine — the field is genuinely optional — but note the onboarding gate guarantees at least one bag exists, so this is only reachable for a user who deleted all of theirs. |
| Course with no layouts | Not handled. `fld-layout` renders empty and disabled, `info-summary` is absent, and `cta-submit` is disabled with no message. Arriving here from `course-detail`'s no-layouts empty state produces exactly this dead end — see `course-detail` § 6. |

`S-EMPTY` covers the first row only, and covers it well: `RoundStartPage.jsx:131` is one of the four
`.empty-state` users in the app. The second row is out of scope (an optional field, correctly silent).
**The third row is a divergence from `S-EMPTY`** — a genuinely empty layout list with no empty state at
all, only a disabled control. The grid's `✅` for this route reflects the no-courses case.

**Error.** `S-ERR-INLINE` (`RoundStartPage.jsx:129`) — every failure lands in one `err-inline` banner,
and **this screen is deliberately outside `S-ERR-BLOCK`**, one of the minority the row does not list
among its 19:

- either effect's `catch` sets it; a subsequent successful load does **not** clear it, so a transient
  course-fetch failure leaves a stale error above a working form;
- `handleSubmit` clears it at `:97` and re-sets it on failure;
- the guard at `:91-93` produces house copy (`Choose a course and layout first`), unreachable in practice
  because `cta-submit` is already disabled by `!selectedLayout`;
- everything else is a raw Supabase or network message.

**Diverges from `S-ERR-INLINE` in one respect the row does not cover:** the banner is not cleared by a
later *successful* load, only by `handleSubmit` at `:97`. The row's premise is "a failure is shown beside
content that still works"; here a resolved failure is shown beside content that works, which is a
stale-signal defect rather than a severity one. `S-RETRY` binds nominally — no retry control exists, but
the form stays live, so re-selecting or resubmitting is reachable without a reload.

**Offline.** `S-OFFLINE-READ` — mixed: `roundRepository` is cache-backed while `lib/roundLog` and
`lib/discLocker` are two of the eight uncached modules, so the course and bag reads fail while the round
path survives. `S-OFFLINE-WRITE` is partial: the write works only when a bag version is cached or no bag
is selected. As § 5. No `S-SYNC` label is displayable on this screen, so a round created offline gives
the user no calm-state confirmation that it was saved on device.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell; `S-ONBOARD` — the onboarding gate
runs first, which is why a bag normally exists. `RoundStartPage.jsx:10` dereferences `user.id` unconditionally. The onboarding gate
matters here in a second way: it guarantees the `bags` fetch is non-empty for a normal user, which is
what makes the default-bag preselection — and therefore the offline defect above — the common path rather
than a rare one.

**Interlock.** One, and it is the useful kind: `cta-submit` is disabled unless a layout resolves
(`:185`), which prevents a round without holes. It is enforced app-side only — `rounds.layout_id` is
deliberately nullable (`migrate_disc_locker_and_layouts.sql:206-207`: "left NULLABLE on purpose (future
score-only imports may not resolve a layout)"), so the database will accept what the form refuses. The
disabling is silent, with no adjacent explanation, which is what turns the `course-detail` dead-end path
into a confusing one rather than a merely blocked one. `S-INTERLOCK-CAP` surveys three ceilings and does
not include this one; it is a precondition gate rather than a capacity cap, and it is the mirror image of
the row's pattern — pre-empted app-side with no backing constraint, where the row's three are enforced
with inconsistent pre-emption.

The **single-active-activity invariant** is the other interlock in play, and this screen deliberately
does not enforce it — it degrades instead, leaving the parent as a draft (§ 5). **That is
`S-INTERLOCK-ACTIVE`, but this screen diverges from the row in the manner of its failure, not merely by
omitting the dialog.** The row's finding is that the confirmation flow is fully built in the repository
and never reaches a screen. Here the repository declines to reach for it: `ensureRoundActivity`
(`roundRepository.js:145-158`) calls `activityRepository.getActive(userId)` first and invokes
`activityRepository.start` **only when nothing is active**. When a round or practice *is* live, the
`start` call — and with it `planActivityStart`'s `round_confirmation_required` and the
`confirmRoundReplacement` flag the row describes — is skipped entirely, by an explicit comment
("J1 keeps that decision out of the round form"). So the confirmation is not lost in the UI layer on this
path; it is never requested. The user-visible result is the same, and the round row is still created.

The row's gap-1 screen list (`play-root`, `freeform-active`, `regimen-active`, `round-scorecard`,
`practice-history`) does not name `round-start`, which is where a round is *started* and therefore where
§ 11's confirmation is most directly owed. Noted in `_corrections/state-citations-2.md`.

**Destructive.** **N/A** — nothing here deletes, so `S-CONFIRM` is `➖`. `Cancel` discards local
selections with no confirmation, correctly. The relevant absence is downstream: once submitted, a round cannot be deleted anywhere in the
app (`rounds-root` § 12 question 4), so an accidental `Start round` on the wrong course is permanent.

## 7. Dependencies

### Schema

- `rounds` — writes `id`, `user_id`, `course_id`, `layout_id`, `bag_id`, `bag_version_id`, `status`,
  `played_at`. `normalizeRoundFields` (`roundLog.js:24-40`) whitelists the writable columns, so
  `weather_summary`, `target_score`, `total_score`, `external_source`, and `external_ref` are permitted
  by the layer and simply never sent by this screen (`supabase_schema.sql:103-114`). `layout_id` from
  `disc_locker_and_layouts_schema.sql:104`; `bag_id` from `bags_schema.sql:53`; `bag_version_id` from
  `supabase/migrations/20260715183500_phase_b_disc_timelines_bag_versions.sql:77-78`.
- `activities` — a `disc_golf_round` row is created with the round's own id. The composite FK
  `rounds_activity_owner_fkey` on `rounds(id, user_id) → activities(id, user_id)` comes from
  `supabase/migrations/20260712193922_phase_a_activity_lifecycle.sql:295-296` and is indexed by
  `20260712201203_phase_a_activity_lifecycle_fk_indexes.sql:23-24`. **This FK is why the write order
  cannot be reversed** — the comment at `roundRepository.js:123-126` is load-bearing.
- `bag_versions` / `bag_version_discs` — written by the `capture_bag_version` RPC
  (`20260715183500_phase_b_disc_timelines_bag_versions.sql`).
- `courses`, `layouts`, `holes`, `bags` — read only.
- Dexie `rounds`, `roundHoles`, and the shared `outbox`
  (`++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]`,
  `db/dexieDb.js`), plus the activity lifecycle's own tables.

### Library

`lib/roundLog` (`fetchCourses`, `fetchCourse`), `lib/discLocker` (`fetchBags`), `lib/rounds`
(`parTotal`), `lib/repository/roundRepository` (`useCreateRound`, and transitively `captureBagVersion`,
`loadBagVersions`, `latestBagVersion`, `activityRepository`, `createActivitySyncAdapter`,
`getInstallationId`), `context/AuthContext` (`useAuth`). Signatures in
[`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

### Components

**None.** No import from `src/components/`. The `.empty-state` block is hand-rolled;
[`COMPONENT_LIBRARY.md`](../COMPONENT_LIBRARY.md) § "Common needs with no shared component" item 6 cites
`src/pages/RoundStartPage.jsx:131` by line.

`DEVELOPMENT_PLAN.md` § J1's **Reuse** bullet promised "field-screen ergonomics (primary controls in
viewport, secondary in sheets)". Course, layout, and bag are three native `<select>` elements inline; no
sheet is opened. Filed as [`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-4.

### Screens

- **Requires:** at least one course with at least one layout containing at least one hole — created only
  by `courses-new`. Also requires `courses-root` or `course-detail` or `rounds-root` to link here.
- **Required by:** `round-scorecard`, which this screen is the only creator of. Every round in the app
  originates here.
- **Affects, invisibly:** `play-root` (an active round activity changes its hero card — CS-6),
  `weekly-reports` (a draft-parent round is excluded from reports — § 5), and `bag-manage`/`discs-root`
  (a bag version is captured on submit and appears in bag history).

### Contracts and decisions

- `PHASE_A_ARCHITECTURE.md` § 14 (repository and transaction contract) — the **best-observed** instance
  in this section: queue-before-remote, client-minted ids, idempotency keys, expected state and version
  on every lifecycle mutation, installation id, and a source. Read `roundRepository.js:108-172` as the
  worked example.
- `PHASE_A_ARCHITECTURE.md` § 1–3 (activity envelope, lifecycle history, finalization) — this screen is
  where a round's lifecycle parent is created; § 3's finalization contract is exercised by
  `round-summary`.
- `PHASE_A_ARCHITECTURE.md` § 12 — 80pt primary (met), 44pt secondary (not met by `.link-button`), calm
  offline states (absent).
- **ADR 0001, `docs/decisions/0001-live-round-interaction-model.md`, status Proposed.** Its Context names
  `round-start` alongside `round-scorecard` and `round-summary` as screens that "cannot state a stable
  interaction contract until this closes" (`0001-live-round-interaction-model.md:18-20`).
  `SCREEN_INVENTORY.md` marks only the other two as 🔶 blocked. This document follows the inventory —
  the setup form is unaffected by whichever capture model wins, since Option C keeps the structured
  scorecard as primary and Options A and B both still need a round to exist. Recorded as a discrepancy in
  § 12 question 5 and as [`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-9.
  **Do not resolve the ADR from this document.**
- `DEVELOPMENT_PLAN.md` § E2 owns the backlog.

## 8. Accessibility

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** all three selects have explicit `htmlFor`/`id` pairs (`round-course`, `round-layout`,
  `round-bag`), and they are native `<select>` elements, so platform accessibility and the platform
  picker come for free.
- **Good:** `cta-submit` inherits `min-height: var(--tap-target-min)` = 80px (`index.css:44`), meeting
  the 80pt primary-action rule, and its label changes to `Starting…` so the busy state is text rather
  than a spinner alone.
- **Good:** the `(optional)` marker on the bag label is in the label text, so it is announced.
- **Gap:** `hdr-cancel` is a `.link-button` with no `min-height` and no padding (`App.css:455-466`) —
  roughly 17px tall against a 44×44pt minimum. Shared fix, `T-courses-root-6`.
- **Gap:** `cta-submit`'s disabled state has no `aria-describedby` and no adjacent explanation. A user
  arriving from `course-detail`'s empty state finds a dead button and is told nothing, visually or
  otherwise. This is the accessibility face of the § 6 dead end.
- **Gap:** `fld-layout`'s disabled state is likewise unexplained, and it has two distinct causes
  (`loadingCourse` and no layouts) that look identical.
- **Gap:** `err-inline` has no `role="alert"`, so a submit failure is silent to a screen-reader user whose
  focus is on the button.
- **Gap:** the loading paragraph (`Loading round setup...`) has no `role="status"`.
- **Gap:** `info-summary` (`18 holes · par 54`) updates when the layout changes but is not in a live
  region, so a screen-reader user changing layouts gets no confirmation of what changed.
- **App-wide, not a screen delta:** two `h1` elements per page — the shell's and this page's.

## 9. Events and telemetry

**This is the only screen in the COURSES section that writes lifecycle events on entry to a round.**

| What | Contract | Detail |
|---|---|---|
| Activity draft created | `PHASE_A_ARCHITECTURE.md` § 2 | `activityRepository.createDraft({ id: roundId, type: 'disc_golf_round', … })`, idempotency key `round:<roundId>:create`, source `MANUAL_ENTRY`, installation id from `getInstallationId()`, metadata `{ source: 'round_logging', courseId, layoutId }` (`roundRepository.js:108-138`) |
| Activity started — **conditionally** | `PHASE_A_ARCHITECTURE.md` §§ 2–3 | Only when `getActive(userId)` is empty. `expectedState: 'draft'`, `expectedVersion: 0`, reason `FIRST_MEANINGFUL_FACT`, idempotency key `round:<roundId>:start` (`:145-159`) |
| Sync flush | `PHASE_A_ARCHITECTURE.md` § 8 | `roundActivitySync.flush()` before the round insert (`:170`) and again inside `flushRoundOutbox` (`:326`) |
| Bag version captured | — | `capture_bag_version` RPC, idempotency key `round-bag:<roundId>`. Appears in bag history on `bag-manage` |

**Notifications:** none produced or consumed (`PHASE_A_ARCHITECTURE.md` § 7).

**Metrics:** none emitted. `PHASE_A_ARCHITECTURE.md` § 5 anticipates a `round` subject;
`src/lib/metrics/registry.js` declares only `player`, `routine`, `session`, and `physical_disc`. A round
is therefore a first-class lifecycle activity that no metric can address.

**Downstream, silently:** the created round becomes a weekly-report input only if its activity parent
later reaches `completed` (`weeklyReportRepository.js:38, 50`) — which the conditional start above can
prevent permanently. See § 5.

## 10. Tests

### Existing coverage

**Partial, at the pure-function layer only.** Confirmed by reading every import of `RoundStartPage.jsx`:

| Import | Test file | Covers this screen? |
|---|---|---|
| `lib/rounds` (`parTotal`) | `src/lib/rounds.test.js` | Yes — `:16-19` |
| `lib/discLocker` (`fetchBags`) | `src/lib/discLocker.test.js` | Exists; does not cover this screen's use |
| `lib/roundLog` (`fetchCourses`, `fetchCourse`) | **absent** — no `roundLog.test.js` | — |
| `lib/repository/roundRepository` (`useCreateRound`) | **absent** — no `roundRepository.test.js` | — |
| `context/AuthContext` | absent | — |

[`TEST_MAP.md`](../TEST_MAP.md):65 records `round-start` → `rounds`. Accurate as far as it goes; it omits
`discLocker`, filed as [`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-5.

**Not covered, at any layer — and this is the screen where that hurts most**, because it owns the
section's only genuinely intricate write path:

- The whole of `useCreateRound`: the bag-version capture, its fallback, the outbox ordering, the
  optimistic Dexie write, `error.localResult`, and the query invalidation.
- **`ensureRoundActivity`'s conditional start** — the branch that silently decides whether a round will
  ever count in a weekly report. Nothing anywhere asserts either branch.
  `src/lib/repository/activityRepository.test.js:161` does create a `DISC_GOLF_ROUND` draft, which is the
  closest existing coverage and does not exercise this function.
- `finalizeRoundActivity`'s early return on a draft parent.
- The offline defect in § 5 — `loadBagVersions` rethrowing past the `localResult` attachment. A test
  seeding an empty `bagVersions` table and a rejecting RPC would have caught it.
- Both effects' `active`-flag race guards and the advisory query-parameter fallbacks.
- Every rendering branch: no-courses empty state, disabled layout select, disabled submit.

### Acceptance criteria

1. Arriving with `?courseId=X&layoutId=Y` where both exist preselects exactly those, and the created
   round's `course_id`/`layout_id` match.
2. Arriving with a `courseId` that is not in `fetchCourses()` falls back to the first course — **and says
   so.** *Currently fails* — the fallback is silent.
3. Arriving with no parameters preselects the first course and that course's `is_default` layout.
4. Changing the course clears the layout selection and reselects the new course's default.
5. The default bag is preselected when one exists; `No bag selected` writes `bag_id: null`.
6. Submitting with a bag captures exactly one bag version, and submitting twice for the same round id
   captures no second one (the `round-bag:<roundId>` idempotency key).
7. Submitting with no other activity current creates an `activities` row in state `active` with the
   round's id.
8. Submitting **while another activity is current** creates the parent in state `draft`, the round is
   still created, and **the user is told that this round will not be counted until its activity is
   resolved.** *Currently fails* — nothing is said, and the round is silently excluded from weekly
   reports forever.
9. Submitting offline with a bag selected and no cached bag version still creates a local round and
   navigates to its scorecard. *Currently fails* — see § 5.
10. Submitting offline with `No bag selected` creates a local round, queues one outbox entry, and
    replays exactly once on reconnect.
11. A course with no layouts disables submit **and explains why**. *Currently fails* — silent.
12. A layout of 18 par-3 holes renders `18 holes · par 54`, matching `parTotal`.

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built).
Backlog specs:

1. Quick course → `/courses/:id` → `Start round` → scorecard, with `course_id`, `layout_id`, and
   `bag_version_id` all populated. The middle of `TEST_MAP.md` E2E backlog item 4.
2. Go offline → `/rounds/new` → submit → assert a local round exists, the scorecard opens, and reconnect
   flushes it exactly once with no duplicate. Overlaps `TEST_MAP.md` E2E backlog item 2 and is the
   regression guard for § 5.
3. Start a freeform practice session, leave it running, then start a round → assert the round is created,
   assert what the app says about the two concurrent activities, and assert the round still reaches the
   weekly report.
4. Start a round, then open `/practice` → assert the hero card offers to resume **the round**, not
   freeform (the CS-6 regression guard).

## 11. Tasks

E2 (`DEVELOPMENT_PLAN.md` § E2) owns these. Ordered by dependency.

#### T-round-start-1 — Fix the offline create path when a bag version cannot be resolved

- **Capability:** `sync`
- **Touches:** `src/lib/repository/roundRepository.js`
- **Done when:** the bag-version resolution at `roundRepository.js:250-258` cannot throw out of
  `mutationFn` — a failure resolves `bag_version_id` to `null` and the round still queues, writes
  locally, and exposes `error.localResult`; submitting offline with a bag selected and no cached bag
  version lands on the scorecard.
- **Verify:** `npm test` with a new `roundRepository.test.js` case: rejecting `captureBagVersion`,
  rejecting `loadBagVersions`, empty Dexie `bagVersions`; assert an outbox entry exists and
  `error.localResult.id` is set.
- **Commit:** `fix: start a round offline when no bag version can be captured`
- **Note:** highest-severity item on this screen. It silently breaks the section's headline offline
  capability on the default path.

#### T-round-start-2 — Create `roundRepository.test.js` (shared with `T-rounds-root-3`)

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/roundRepository.test.js` (new)
- **Done when:** `useCreateRound`'s bag-version branch, outbox ordering, optimistic write, and
  `error.localResult`; `ensureRoundActivity`'s both branches; and `finalizeRoundActivity`'s early return
  all have unit tests against `fake-indexeddb` and a mocked `roundLog` + `activityRepository`.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `test: cover the round creation and lifecycle bridge`
- **Note:** land before `T-round-start-1` and `T-round-start-3` so both have a regression net.

#### T-round-start-3 — Resolve, or surface, a round whose lifecycle parent stays a draft

- **Capability:** `sync`
- **Touches:** `src/lib/repository/roundRepository.js`, `src/pages/RoundStartPage.jsx`,
  `src/pages/RoundSummaryPage.jsx`
- **Done when:** a round created while another activity is current either (a) prompts the user through
  the existing lifecycle confirmation flow, or (b) is finalizable later so its parent reaches `completed`
  and the round appears in weekly reports; in either case the user is told at creation time, not silently
  excluded.
- **Verify:** `npm test` covering both branches end to end, including a `weeklyReportRepository` case
  asserting the round is counted.
- **Commit:** `fix: resolve the lifecycle parent for a round started during another activity`
- **Blocked by:** `T-round-start-2`, and § 12 question 1.
- **Note:** `roundRepository.js:140-144` records this as a deliberate J1 deferral. E2 is where it comes
  due.

#### T-round-start-4 — Explain every disabled and fallen-back state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundStartPage.jsx`
- **Done when:** a course with no layouts shows a message and a link to fix it rather than a silently
  disabled button; a requested `courseId`/`layoutId` that could not be honored says which course was
  chosen instead; `err-inline` carries `role="alert"` and load errors clear on a successful reload.
- **Verify:** `npm test` with page-level tests for the zero-layout and bad-parameter cases; manual check
  of the `course-detail` empty-state → `round-start` path.
- **Commit:** `fix: explain why a round cannot start`
- **Note:** pairs with `T-course-detail-2`, which blocks the same dead end at its origin. Do both.

#### T-round-start-5 — Read the setup form from the offline cache

- **Capability:** `data-access`
- **Touches:** `src/pages/RoundStartPage.jsx`, the course repository from `T-courses-root-4`, a bag cache
- **Done when:** `/rounds/new` renders a usable course and layout selection offline from previously
  cached data, with a `Saved on Device` calm state per `PHASE_A_ARCHITECTURE.md` § 12; a truly
  first-time-offline user still gets the no-courses empty state rather than an empty form.
- **Verify:** `npm test` for the cached read; manual offline check in `npm run dev`.
- **Commit:** `feat: choose a course and layout offline`
- **Blocked by:** `T-courses-root-4`, `T-round-start-1`.

#### T-round-start-6 — Fix the `courses === null` empty-state test

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundStartPage.jsx`
- **Done when:** a failed `fetchCourses` renders an error state with a retry rather than an empty form;
  the `courses?.length === 0` branch at `:130` fires only for a genuinely empty catalog.
- **Verify:** `npm test` with a page-level test rejecting `fetchCourses`.
- **Commit:** `fix: distinguish an empty course catalog from a failed load`

## 12. Open questions

1. **What should happen when a round starts while another activity is current?**
   `roundRepository.js:140-144` defers to "the existing lifecycle confirmation flow" and, in the meantime,
   leaves the parent a draft — which permanently excludes the round from weekly reports (§ 5). The
   options are the ones `PHASE_A_ARCHITECTURE.md` § 14 already names for conflicting starts: auto-close
   the current activity and start the round, keep both and let the user choose, or keep the draft but
   make it finalizable later. This is a real product decision, not a bug fix. Blocks `T-round-start-3`.
2. **Should `Bag (optional)` really preselect the default bag?** The label says optional; the behavior is
   opt-out. The preselection is what makes every round capture a bag version — valuable data, and the
   reason the § 5 offline defect is on the default path. If bag snapshots are the point, the label is
   wrong; if the field is genuinely optional, the preselection is.
3. **Should the round's context be richer than course + layout + bag?** `rounds.weather_summary` and
   `rounds.target_score` are live, nullable columns (`supabase_schema.sql:108-109`) written by nothing,
   and `DEVELOPMENT_PLAN.md` § E2 lists weather as a follow-on. Deciding now whether they belong on this
   form or in a mid-round sheet affects `T-round-start-4`'s layout.
4. **Nothing prevents two concurrent in-progress rounds.** `rounds.status` has no partial unique index and
   this form does not check for an existing `in_progress` round. Starting a second one is possible and
   produces two rounds the user must reconcile by hand — with the additional effect that the second one's
   activity parent will be a draft (question 1), so the two behave differently in reports.
5. **ADR 0001 names this screen; `SCREEN_INVENTORY.md` does not.**
   `docs/decisions/0001-live-round-interaction-model.md:18-20` lists `round-start` among the three
   documents that "cannot state a stable interaction contract until this closes";
   `SCREEN_INVENTORY.md`:61-64 marks only `round-scorecard` and `round-summary` as 🔶. This document
   follows the inventory, which owns status, and treats `round-start` as unblocked because the setup form
   is orthogonal to the capture model. If that reading is wrong, this document becomes provisional too.
   Filed as [`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-9. **Not resolved
   here.**

Filed corrections touching this screen:
[`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-1 (`preserveNestedState`),
CS-2 (this screen consumes the second query-parameter contract), CS-3 (`STATE_MATRIX.md`, since resolved), CS-4
(§ J1's stated reuse), CS-5 (`TEST_MAP.md` omits `discLocker`), CS-6 (the PLAY hero mislinks an active
round created here), CS-7 (activity pill), CS-9 (ADR 0001 scope vs inventory status).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no round setup
screen; `/rounds/new` shipped as `DEVELOPMENT_PLAN.md` § J1 on 2026-07-14, ahead of
`PRODUCT_ROADMAP.md` Phase E by owner decision.

Blueprint **Screen 8, Rapid-Fire Scoring Canvas & Mid-Round Swaps** (`SCREEN_SPECS.md:217`) is titled as
though it covers rounds and does not: it is the *putting practice* capture canvas, shipped under PLAY as
`FreeformLogPage`/`RegimenRunPage` on the `active` shell, and its "mid-round" refers to a practice
session. The disc-golf round tree shares no component and no library module with it. That naming
collision is worth stating once, because "Screen 8" appears throughout `SCREEN_SPECS.md` and
`DEVLOG.md` in language that reads as if it were about rounds.

**Screen 13, Frictionless UDisc Ingestion Center** (unbuilt, no route) is the only other writer of
`rounds` rows the project plans (`SCREEN_SPECS.md:334-346`). It bypasses this screen entirely, which
means it will also bypass `ensureRoundActivity` — so the lifecycle-parent question in § 12 question 1
must be answered before the importer is built, or imported rounds will have no activity parent at all and
will violate `rounds_activity_owner_fkey`.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only additive schema — the reason
`weather_summary` and `target_score` sit unused on `rounds`), and #5 (**PLAY / DISCS / COURSES / ME**)
apply; see `SCREEN_SPECS.md` § Standing divergences. Divergence #6's interlock standard ("app-side
disabling AND a DB `CHECK` constraint") is only half met by the layout requirement in § 6, and
deliberately so — `rounds.layout_id` is nullable on purpose for future imports.
