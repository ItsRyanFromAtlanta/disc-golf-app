# Rounds

| Field | Value |
|---|---|
| Route id | `rounds-root` |
| URL pattern | `/rounds` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Rounds` |
| Activity pill | declared shown (`showActivityPill: true`) — inert for rounds, see `_corrections/courses-screens.md` CS-7 |
| Scroll key | `rounds-root` |
| Preserves nested state | `false` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/RoundsPage.jsx` (96 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

## 1. Purpose

The player's full round history: every round they have logged, newest first, each showing the course, the
date, whether it is finished, and how it went against par. It is both the archive and the way back into a
round that was left in progress.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `View all` beside `My rounds` on `/courses` | `Link` from `courses-root` (`CoursesPage.jsx:74`) | The **only** in-app link to this route |
| In | `Back to rounds` after finishing a round | `Link` from `round-summary` (`RoundSummaryPage.jsx:132`) | Shown only once `round.status === 'completed'` |
| In | Direct URL / restored session | Route match | `ProtectedRoute` + the `AppShell` onboarding gate apply |
| Out | `Start round` (page header) | `Link` to `/rounds/new` | |
| Out | `Log a round` (empty state) | `Link` to `/rounds/new` | Same destination, different copy |
| Out | Round row | `Link` to `/rounds/:roundId` | Goes to the **scorecard**, for completed rounds too — see § 12 |
| Out | Shell back control | Header, shell-owned | Goes to **`/courses`**, not `/rounds` — see below |
| Out | Tab re-tap on COURSES | `TabBar` → `resolveSectionRoot('courses')` | Returns to `/courses` |

**This route highlights the COURSES tab and its back control leaves the `/rounds` tree entirely.** The
whole `/rounds` subtree carries `section: 'courses'` (`routeMetadata.js:43-81`), so:

- the tab bar highlights COURSES, not PLAY, on `/rounds` and everything under it;
- `resolveSectionRoot('courses')` is `/courses`, so `showBack` is true here (`/rounds` is not the section
  root) and `handleBack()` navigates to `/courses` — a *different* list from the one the user is looking
  at;
- pressing the COURSES tab from anywhere under `/rounds` lands on `/courses`, never on `/rounds`.

`/rounds` is therefore a second-level list that behaves like a root but is not one. This is deliberate
and is recorded once in `NAVIGATION_MAP.md` § Route tree; it is restated here because it is the single
most surprising navigation fact about this screen.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Rounds                               [ bell ]    | <- back goes to /courses, not /rounds
+-------------------------------------------------------+
|  ROUNDS                          [ Start round ]      | <- .practice-header; .start-button
+-------------------------------------------------------+
|  Showing saved rounds from this device.               | <- .form-error, only when the query errored
+-------------------------------------------------------+
|  +-------------------------------------------------+  |
|  | EAST ROSWELL PARK                            +2 |  | <- relative to par, computed client-side
|  | Mar 3, 2026 · Completed                      54 |  | <- played_at · status ; total_score
|  +-------------------------------------------------+  |
|  | HORSESHOE BEND                                — |  | <- em-dash when no hole has a score
|  | Mar 1, 2026 · In progress              Score —  |  |
|  +-------------------------------------------------+  |
|  | ROUND                                         E |  | <- "Round" when the course did not hydrate
|  | Date not set · Completed                     54 |  |
|  +-------------------------------------------------+  |
|  ( every round, no pagination, no filter, no search ) |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

Empty variant:

```
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  | <- .empty-state, dashed border
|  |  No rounds logged yet.                          |  |
|  |  [             Log a round             ]        |  |
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back to /courses, title "Rounds", notification bell
Body (shell scroll region, scrollKey rounds-root)
  Page header (.practice-header)
    hdr-title ............ h1, "Rounds"
    hdr-start ............ "Start round" link, .start-button
  Degraded banner
    banner-cached ........ "Showing saved rounds from this device."
  List (ul.course-list.round-list) or empty state
    list-empty ........... "No rounds logged yet." + "Log a round" CTA
    round-row ............ one .course-card per round
      row-course ......... course name, or "Round"
      row-meta ........... "<date> · Completed|In progress"
      row-relative ....... relative to par, or em-dash
      row-total .......... total strokes, or "Score —"
Tab bar (shell-owned)
```

No sticky element, no footer, no section headings — a header and one flat list.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Rounds` | — | — | — | always. Matches the route title — one of two screens in the batch where they agree |
| `hdr-start` | link (`.start-button`) | `Start round` | default / pressed | navigate | `/rounds/new` | always |
| `banner-cached` | `<p class="form-error">` | `Showing saved rounds from this device.` | present / absent | — | — | shown when `roundsQuery.error` is set **and** data exists (`RoundsPage.jsx:58`). Styled as an error but is an informational degraded state — the copy is right, the class is wrong |
| `list-empty` | block (`.empty-state`) | `No rounds logged yet.` + `Log a round` | — | navigate (CTA) | `/rounds/new` | shown when `rounds.length === 0` |
| `round-row` | link card (`.course-card`) | composed of the four cells below | default / pressed | navigate | `/rounds/:roundId` | one per round. **No filter, search, sort control, date grouping, or pagination exists** — every round the user has ever logged renders |
| `row-course` | strong | `round.course?.name ?? detail?.course?.name ?? 'Round'` | — | — | — | falls through to the literal `Round` when neither the list hydration nor the per-round detail produced a course |
| `row-meta` | small | `<formatPlayedAt(played_at)> · Completed` \| `· In progress` | — | — | — | `formatPlayedAt` returns `Date not set` for a null `played_at`, else `toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })` (`RoundsPage.jsx:7-10`) — device locale, no timezone handling. Status is a two-way split: anything that is not exactly `'completed'` reads `In progress` |
| `row-relative` | strong (`.course-card-score`) | `formatRelativeToPar(relativeToPar(detail.round_holes, detail.holes))`, else `—` | present / `—` | — | — | requires `details[round.id]` to have loaded **and** at least one hole to have a non-null, non-empty score (`:71-74`). Renders `E` / `+3` / `-2` / `—` per `formatRelativeToPar` |
| `row-total` | small | `round.total_score ?? detail?.total_score ?? 'Score —'` | — | — | — | the stored column, not a recomputation. **`row-relative` and `row-total` come from different sources and can disagree** — see § 12 question 2 |

`formatPlayedAt` is a module-local helper (`RoundsPage.jsx:7-10`) duplicated verbatim in
`RoundSummaryPage.jsx:12-15`. Neither is exported; neither is tested.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Round list | `useRoundList(user.id)` | `lib/repository/roundRepository` | Supabase + Dexie | React Query hook, `networkMode: 'offlineFirst'` |
| Full detail per round (holes + scores) | `loadRound(round.id, user.id)`, once **per round** | `lib/repository/roundRepository` | Supabase + Dexie | async, in a `Promise.all` |
| Relative to par | `relativeToPar(round_holes, holes)` then `formatRelativeToPar` | `lib/rounds` | — | **pure** |

Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

`useRoundList` → `readRoundList` (`roundRepository.js:82-96`) fetches remotely, bulk-puts into Dexie,
prunes cached rows absent remotely, and falls back to the cache on failure — rethrowing only when the
cache is also empty. It also registers an `online` listener (`:227-234`) that flushes the round outbox
and invalidates the list on reconnect, so this screen self-heals after a reconnection.

**The detail fetch is an N+1 and it is the screen's defining performance problem.** `RoundsPage.jsx:27-37`
runs, for every round in the list:

```js
Promise.all(rounds.map(async (round) => {
  try { return [round.id, await loadRound(round.id, user.id)] }
  catch { return [round.id, null] }
}))
```

`loadRound` calls `fetchRound`, which is itself six-to-seven round trips: the round, then a `Promise.all`
of course + layout + `round_holes` + layout `holes`, then a second `Promise.all` of missing holes +
discs, then a Dexie write (`roundLog.js:88-129`, `roundRepository.js:200-208`). So a 30-round history
issues on the order of **200 Supabase requests, concurrently, on every mount** — and the effect's
dependency is `roundsQuery.data`, whose identity changes on each refetch, so it re-runs on every
invalidation as well.

All of that work exists to render one value per row: `row-relative`. Nothing else on the screen uses
`details`, except the two `??` fallbacks in `row-course` and `row-total`. `T-rounds-root-1` is the fix.

The failure mode is at least contained: each `loadRound` has its own `try/catch` returning `null`, so one
failing round leaves its row showing `—` rather than breaking the list.

### Writes

**N/A** — this screen performs no mutations. Every control is a `Link`.

It does, indirectly, cause writes: `loadRound` caches each fetched round into Dexie
(`roundRepository.js:51-60`, a `db.transaction('rw', db.rounds, db.roundHoles, …)` that replaces the
round's hole rows), and `useRoundList`'s `online` listener calls `flushRoundOutbox`. Both are cache and
sync maintenance rather than user-intent writes. The transaction contract is
`PHASE_A_ARCHITECTURE.md` § 14.

### Offline

**This is the most offline-capable read screen in the section**, and the only one that says anything
about it to the user.

- `useRoundList` returns the Dexie cache when the remote fetch fails, so the list renders.
- `loadRound` does the same per round (`roundRepository.js:200-208`), so `row-relative` still computes
  from cached hole rows.
- `banner-cached` — `Showing saved rounds from this device.` — is displayed. It is the closest thing in
  the COURSES section to a `PHASE_A_ARCHITECTURE.md` § 12 calm state, but it is **not** one of the four
  named states (`Saved on Device`, `Syncing`, `Synced`, `Needs Attention`), it is styled `.form-error`
  rather than as a status, and it reserves no stable layout space — it appears and disappears, shifting
  the list.
- On reconnect, the `online` listener flushes the outbox and refetches without user action.

Two offline defects:

1. **Cached rounds come back unsorted.** The remote path orders by `played_at desc, created_at desc`
   (`roundLog.js:83-84`). The cache path is `db.rounds.where('user_id').equals(userId).toArray()`
   (`roundRepository.js:78-80`) with no `.sortBy()`, so the offline list arrives in Dexie index order —
   effectively arbitrary. The list silently changes order when the network drops.
2. **A never-synced round has no `course` relation.** `hydrateRounds` (`roundLog.js:63-76`) attaches
   `course` on the remote path only. An offline-created round read from cache has `course_id` but no
   `course`, so `row-course` falls to `detail?.course?.name` and then to the literal `Round`.

## 6. Flow paths

**Happy path.** `/courses` → `View all` → list renders newest-first with each row's relative-to-par →
tap an in-progress round → `/rounds/:roundId` resumes the scorecard.

**First run / empty.** `rounds.length === 0` → `list-empty` with a `Log a round` CTA. Correct and
complete. Note the copy is idiom A (`No rounds logged yet.`) while `courses-root`'s directory uses idiom
B (absence plus next action) — catalogued in `COPY_AND_TERMINOLOGY.md` § 2.

**Error.** Two behaviors, correctly separated — this screen handles errors better than the three
course screens:

- `roundsQuery.error` **with no data** (remote failed *and* cache empty) → `RoundsPage.jsx:45` returns
  `<p class="form-error">{roundsQuery.error.message}</p>` as the whole page. Raw Supabase text, no retry.
  Only reachable on a first-ever visit with no network.
- `roundsQuery.error` **with data** → the list renders normally with `banner-cached`. Non-blocking, and
  the right shape.
- A single `loadRound` rejection → that row's `row-relative` shows `—`; everything else is unaffected.

**Offline.** As § 5 — the list renders from cache with a banner, in the wrong order.

**Auth / guard.** `ProtectedRoute` gates the shell; the onboarding gate runs first.
`RoundsPage.jsx:14` dereferences `user.id` unconditionally. `useRoundList` and the Dexie cache are both
user-scoped (`readCachedRound` rejects a round whose `user_id` does not match, `roundRepository.js:98-106`),
so a shared device cannot leak another account's rounds through the cache.

**Interlock.** **N/A** — no cap or constraint is enforced or displayed. There is no limit on rounds, and
no truncation: unlike `courses-root`'s `.slice(0, 3)`, this list renders every round with no pagination,
which is what makes the N+1 in § 5 unbounded.

**Destructive.** **N/A** — nothing here deletes, discards, or hides a round. As with the rest of the
section, note the absence: **there is no way to delete a round anywhere in the app.** The J1 RLS policy
does grant owners full control (`Authenticated users manage own rounds`, `for all`, at
`20260714150000_phase_c_round_logging_rls.sql:160`), so unlike courses the database permits it — no UI
offers it. An accidental round started at the wrong course is permanent, appears in this list forever,
and counts toward the weekly report. See § 12 question 4.

## 7. Dependencies

### Schema

- `rounds` — reads `id`, `course_id`, `played_at`, `status`, `total_score`, plus the hydrated `course`
  relation. Base table at `supabase_schema.sql:103-115`; `layout_id`/`external_source`/`external_ref`
  added by `disc_locker_and_layouts_schema.sql:104-107`; `bag_id` by `bags_schema.sql:53`;
  `bag_version_id` by `supabase/migrations/20260715183500_phase_b_disc_timelines_bag_versions.sql:77-78`.
  `rounds_user_id_idx` (`20260714150000_phase_c_round_logging_rls.sql:25-26`) backs the owner predicate;
  RLS is `for all using (auth.uid() = user_id)`.
- `round_holes` — read per round through `loadRound`, for `score` and `hole_id` only. Owner-scoped
  through the parent round (`supabase_schema.sql:135-143`, replaced by
  `20260714150000_phase_c_round_logging_rls.sql:175-190`).
- `courses`, `layouts`, `holes` — read as relations by `fetchRound`/`hydrateRounds`.
- `rounds(id, user_id)` references `activities(id, user_id)` — the composite FK added by
  `supabase/migrations/20260712193922_phase_a_activity_lifecycle.sql:295-296`, indexed at
  `20260712201203_phase_a_activity_lifecycle_fk_indexes.sql:23-24`. Not read here, but it is why every
  round in this list has a lifecycle parent with the same id; see `round-start` § 5.
- Dexie `rounds` and `roundHoles`, schema version 5 onward (`db/dexieDb.js:98-99`), currently
  `'id, user_id, course_id, status, bag_version_id, [user_id+status]'` and `'id, round_id, hole_id'`
  (`:207-208`).

### Library

`lib/repository/roundRepository` (`useRoundList`, `loadRound`), `lib/rounds` (`relativeToPar`,
`formatRelativeToPar`), `context/AuthContext` (`useAuth`). Signatures in
[`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

### Components

**None.** No import from `src/components/`. The `.empty-state` block is hand-rolled;
[`COMPONENT_LIBRARY.md`](../COMPONENT_LIBRARY.md) § "Common needs with no shared component" item 6 cites
`src/pages/RoundsPage.jsx:61` by line.

### Screens

- **Requires:** `courses-root`'s `View all` link, or `round-summary`'s `Back to rounds`. Nothing else in
  the app links here.
- **Required by:** `round-start` (via `hdr-start`) and `round-scorecard` (via every row).
- **Overlaps:** `courses-root`'s `My rounds` section is the same data truncated to three, rendered with a
  different card composition (no date, no relative-to-par). Two renderings of one list, neither shared.

### Contracts and decisions

- `PHASE_A_ARCHITECTURE.md` § 12 — presentation and accessibility baseline, and the four calm states
  that `banner-cached` approximates without matching. § 13 — shell/route boundaries, correctly observed.
  § 14 — repository and transaction contract; the caching writes `loadRound` performs are governed by it.
- `PHASE_A_ARCHITECTURE.md` § 5 — no `round` metric subject exists yet; see § 9.
- **ADR 0001 (`docs/decisions/0001-live-round-interaction-model.md`, status Proposed)** does not block
  this screen — it scopes the capture surface — but it is worth knowing that its recommendation
  ("E2 hardens what exists; no rebuild of the round routes is in scope") is what makes this list's row
  contract safe to build on.
- `DEVELOPMENT_PLAN.md` § E2 owns the backlog.

## 8. Accessibility

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** `hdr-start` and the empty-state CTA inherit `min-height: var(--tap-target-min)` = 80px
  (`index.css:44`), meeting the 80pt primary-action rule. `.course-card` rows also carry
  `min-height: var(--tap-target-min)` (`App.css:520`), so every row is an 80px target — the best
  touch-target behavior in the section.
- **Good:** the whole row is one `Link`, so there is one focus stop per round rather than four.
- **Gap:** `banner-cached` uses `.form-error` for a non-error, and carries no `role="status"`. A
  screen-reader user gets no announcement that the list is stale, and a sighted user is told in error red
  that something went wrong when nothing did.
- **Gap:** `row-relative` conveys the most important value on the row as a bare `+2` / `E` / `—` with no
  label. Nothing tells assistive tech that it is a score relative to par, and `E` is unexplained even
  visually. `row-total`'s `Score —` fallback is labelled; the populated case (`54`) is not.
- **Gap:** the loading paragraph has no `role="status"` and the full-page error no `role="alert"`.
- **Gap:** the list has no landmark, no heading, and no accessible name — it is a bare `<ul>` after an
  `h1`. `courses-root` labels both of its sections with `aria-labelledby`; this screen labels nothing.
- **Gap:** with no pagination and no grouping, a player with 200 rounds gets 200 focus stops between the
  header and the tab bar, at every text scale.
- **App-wide, not a screen delta:** two `h1` elements per page — the shell's and this page's.

## 9. Events and telemetry

**N/A** — no metrics, no notifications, no lifecycle events emitted by this screen.

Two adjacent facts worth having in one place, because they are easy to assume otherwise:

- **Rounds do have lifecycle parents**, created by `roundRepository.ensureRoundActivity`
  (`roundRepository.js:127-162`) with `ACTIVITY_TYPES.DISC_GOLF_ROUND` and the round's own id. This
  screen neither reads nor writes them, and displays `rounds.status` rather than the activity state —
  which is why a round can read `Completed` here while its lifecycle parent is not `completed`. See
  `round-summary` § 12 question 1.
- **No metric subject covers rounds.** `PHASE_A_ARCHITECTURE.md` § 5 anticipates
  round/course/layout/hole subjects; `src/lib/metrics/registry.js` declares only `player`, `routine`,
  `session`, and `physical_disc`. `relativeToPar` is computed inline for display and is not a registered
  metric.

## 10. Tests

### Existing coverage

**Partial, at the pure-function layer only.** Confirmed by reading every import of `RoundsPage.jsx`:

| Import | Test file | Covers this screen? |
|---|---|---|
| `lib/rounds` (`relativeToPar`, `formatRelativeToPar`) | `src/lib/rounds.test.js` | Yes — `:21-31` |
| `lib/repository/roundRepository` (`useRoundList`, `loadRound`) | **absent** — no `roundRepository.test.js` | — |
| `context/AuthContext` | absent | — |

[`TEST_MAP.md`](../TEST_MAP.md):64 records `rounds-root` → `rounds`. Confirmed accurate, and worth being
precise about what those four tests do and do not reach.

**Covered:** `relativeToPar` over sparse cards, including reading par from `roundHole.hole.par` or from
the `holes` lookup (`rounds.test.js:22-23`), and all four `formatRelativeToPar` outputs (`:27-30`).

**Not covered, at any layer:**

- `useRoundList`'s remote-then-cache fallback, the stale-row prune, and the `online` flush listener.
- `loadRound`'s cache fallback and its user-scoping check.
- The N+1 effect: nothing asserts how many requests a 30-round list issues, so the regression that
  matters most here is unmeasurable.
- `formatPlayedAt`'s null branch, and the fact that it is duplicated in `RoundSummaryPage.jsx`.
- The unsorted-cache defect in § 5. There is no test that reads the list offline at all.
- Every rendering branch: empty state, degraded banner, `Round` fallback, `Score —` fallback.

The section headline applies: `src/lib/roundLog.js` and `roundRepository.js` between them own every round
query in the app and neither has a test file (`TEST_MAP.md`:69-72).

### Acceptance criteria

1. With three rounds, the list renders newest `played_at` first, then newest `created_at`.
2. A round with `played_at = null` renders `Date not set`.
3. A round with `status = 'in_progress'` renders `In progress`; `'completed'` renders `Completed`; any
   other value renders `In progress`.
4. A round where every hole is unscored renders `—` for relative-to-par and `Score —` for total.
5. A round of nine par-3 holes scored 3,3,3,4,3,3,3,3,3 renders `+1`.
6. A round whose `loadRound` rejects renders `—` for relative-to-par and does not affect any other row.
7. With zero rounds, `list-empty` renders and its CTA navigates to `/rounds/new`.
8. Offline with a populated cache, the list renders, `banner-cached` shows, **and the order matches the
   online order.** *Currently fails* — the cache path does not sort.
9. Offline with an empty cache, the error state offers a retry. *Currently fails* — no retry exists.
10. Opening `/rounds` with 30 rounds issues a bounded number of network requests. *Currently fails* —
    roughly 200, growing linearly.

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built).
Backlog specs:

1. Play a round to completion → `/rounds` → assert the row shows the right course, date, `Completed`, and
   a relative-to-par that matches `rounds.test.js`'s arithmetic. This is the tail of `TEST_MAP.md` E2E
   backlog item 4.
2. Start a round, score three holes, leave → `/rounds` → assert `In progress` and the partial
   relative-to-par → tap the row → assert the scorecard resumes with those three scores.
3. Go offline → `/rounds` → assert the list renders, the banner shows, and the order is unchanged
   (criterion 8).
4. Score a hole offline → reconnect → assert the outbox flushes exactly once and the list total updates
   without a duplicate row. Overlaps `TEST_MAP.md` E2E backlog item 2.

## 11. Tasks

E2 (`DEVELOPMENT_PLAN.md` § E2) owns these. Ordered by dependency.

#### T-rounds-root-1 — Stop fetching every round in full to render the list

- **Capability:** `data-access`
- **Touches:** `src/pages/RoundsPage.jsx`, `src/lib/roundLog.js`, `src/lib/repository/roundRepository.js`
- **Done when:** `/rounds` renders each row's relative-to-par without calling `loadRound` per round —
  either by extending `fetchRounds` to aggregate score and par in the list query, or by persisting a
  derived relative-to-par on the round; opening a 30-round list issues a bounded number of requests.
- **Verify:** `npm test` covering the new list query shape, plus a manual network-panel count at
  `/rounds` with 30 seeded rounds before and after.
- **Commit:** `perf: render the rounds list without a per-round detail fetch`
- **Note:** the single highest-value item in the COURSES section. It also removes the incidental Dexie
  write storm that `loadRound`'s `cacheRound` currently performs once per round per mount.

#### T-rounds-root-2 — Sort the offline round list

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/roundRepository.js`
- **Done when:** `cachedRoundsForUser` returns rounds ordered by `played_at` descending then `created_at`
  descending, matching `fetchRounds`; the offline list order equals the online order.
- **Verify:** `npm test` with a new `roundRepository.test.js` case seeding three out-of-order cached
  rounds (`fake-indexeddb`, per `db/dexieDb.js`'s `createAppDatabase`).
- **Commit:** `fix: order cached rounds like the remote list`

#### T-rounds-root-3 — Create `roundRepository.test.js`

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/roundRepository.test.js` (new)
- **Done when:** `readRoundList` (remote success, remote failure with cache, remote failure without
  cache, stale prune), `loadRound` (remote success, cache fallback, wrong-user rejection), and
  `saveRoundHole`'s queue-then-flush have unit tests against `fake-indexeddb` and a mocked
  `roundLog`.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `test: cover the round repository read and cache paths`
- **Note:** sequence before `T-rounds-root-1`, which changes the query shape this file would pin.

#### T-rounds-root-4 — Present the cached state as a calm status, not an error

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundsPage.jsx`, `src/App.css`
- **Done when:** `banner-cached` renders as one of the four `PHASE_A_ARCHITECTURE.md` § 12 calm states
  (`Saved on Device`), in reserved layout space that does not shift the list, with `role="status"`, and
  not in error styling.
- **Verify:** `npm run lint` plus a manual offline check at `/rounds` and a VoiceOver pass.
- **Commit:** `fix: show the offline round list state as a calm status`

#### T-rounds-root-5 — Label the score cells

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundsPage.jsx`
- **Done when:** `row-relative` and `row-total` carry accessible labels so the row's accessible name
  reads as course, date, status, score to par, and total strokes; the visual output is unchanged.
- **Verify:** `npm run lint` plus a manual VoiceOver pass on a three-round list.
- **Commit:** `fix: label the round list score cells for assistive tech`

#### T-rounds-root-6 — Add rounds-list retry and empty-cache recovery

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundsPage.jsx`
- **Done when:** the no-data error state renders house copy plus a `Retry` that refetches the query, and
  keeps the page header so the user can still reach `Start round`.
- **Verify:** `npm test` with a page-level test rejecting the query once then resolving.
- **Commit:** `fix: allow retry when the rounds list fails to load`

#### T-rounds-root-7 — Decide and implement round deletion

- **Capability:** `data-access`
- **Touches:** `src/pages/RoundsPage.jsx`, `src/lib/roundLog.js`,
  `src/lib/repository/roundRepository.js`, possibly a migration
- **Done when:** a round can be removed or hidden from this list through a confirmed destructive action
  that also resolves its lifecycle parent and its weekly-report contribution; or the decision to leave
  rounds permanent is recorded in `AGENTS.md`.
- **Verify:** `npm test` covering the delete path and its outbox behavior; negative RLS test asserting
  another user cannot delete.
- **Commit:** `feat: allow a round to be removed`
- **Blocked by:** § 12 question 4.
- **Note:** `COMPONENT_LIBRARY.md` item 8 records that the three existing destructive flows all call
  `window.confirm()` and that no confirmation component exists. Do not add a fourth `window.confirm`.

## 12. Open questions

1. **Rows link to the scorecard even for completed rounds.** `round-row` always targets
   `/rounds/:roundId`. For a completed round the summary is the more useful destination, and the
   scorecard remains fully editable after completion (`RoundScorecardPage` never checks `status`) without
   updating `total_score`. `courses-root` § 12 question 5 is the same question; decide once and apply to
   both.
2. **`row-relative` and `row-total` can disagree.** `row-relative` is recomputed from the live
   `round_holes`; `row-total` is the `rounds.total_score` column, written once by `round-summary`'s
   `Finish round` (`RoundSummaryPage.jsx:65`) and never updated again. Editing a score after finishing
   moves one number and not the other, and the row then shows a relative-to-par that does not correspond
   to its total. See `round-summary` § 12 question 2.
3. **The list is unbounded and unfiltered.** No date grouping, no course filter, no search, no
   pagination — every round the player has logged renders on every visit. Combined with the N+1 in § 5,
   this screen's cost grows quadratically with use. `T-rounds-root-1` fixes the request count; the
   rendering cost and the 200-focus-stop accessibility problem in § 8 need a separate answer.
4. **A round cannot be deleted.** RLS permits it (`for all` on `rounds`,
   `20260714150000_phase_c_round_logging_rls.sql:160`); no UI offers it. A mistaken round is permanent,
   appears here forever, and is counted by the weekly report through
   `weeklyReportRepository.js:43-50`. Decide delete, hide, or permanent-by-design. Blocks
   `T-rounds-root-7`.
5. **`banner-cached` is the section's only offline affordance and it is not a contract state.** Deciding
   `Saved on Device` here sets the pattern for `round-scorecard`'s ad-hoc
   `Saved on this device; it will retry when you reconnect.` notice
   (`RoundScorecardPage.jsx:137`) and for whatever `courses-root` and `course-detail` gain from
   `T-courses-root-4`. Worth settling once, for the whole section, rather than four times.

Filed corrections touching this screen:
[`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-1 (`preserveNestedState`),
CS-3 (`STATE_MATRIX.md` absent), CS-5 (`TEST_MAP.md` rows), CS-7 (activity pill).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no round
history screen; `/rounds` shipped as `DEVELOPMENT_PLAN.md` § J1 on 2026-07-14, ahead of
`PRODUCT_ROADMAP.md` Phase E by owner decision.

Do not confuse this with **Screen 9, Session Summary & Progress Report** (`SCREEN_SPECS.md:245`), which
is in scope and shipped — it covers *practice* sessions and lives under PLAY at `/practice/history`, with
its own `HistoryPage`/`HistoryDetailPage` pair. Practice history and round history are two separate
lists, in two separate tabs, sharing no component and no library module. Whether that is right is an open
product question, not a divergence.

**Screen 13, Frictionless UDisc Ingestion Center** (unbuilt, no route) will write `rounds` rows with
`external_source = 'udisc'` and an `external_ref`, deduplicated by the partial unique index
`rounds_external_uniq` (`disc_locker_and_layouts_schema.sql:117-119`). Those rounds will appear in this
list alongside hand-scored ones with no visual distinction — `external_source` is read by nothing on this
screen. Worth planning for before the importer lands, since a bulk import would multiply the N+1 in § 5
by the size of the user's UDisc history.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only additive schema), and #5
(**PLAY / DISCS / COURSES / ME** — the reason this round list sits under COURSES rather than PLAY) apply;
see `SCREEN_SPECS.md` § Standing divergences.
