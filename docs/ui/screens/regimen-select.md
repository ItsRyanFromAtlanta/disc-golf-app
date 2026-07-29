# Regimen Select (Putting Regimens)

| Field | Value |
|---|---|
| Route id | `regimen-select` |
| URL pattern | `/practice/regimens` |
| Section | `play` |
| Shell | `standard` |
| Header title | `Select Routine` |
| Activity pill | shown |
| Scroll key | `play-regimens` |
| Preserves nested state | no |
| Page component | `src/pages/RegimenSelectPage.jsx` (98 lines) |
| Blueprint screen | none as a screen — folded into Screen 4 by `SCREEN_SPECS.md`, but shipped standalone; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

The full catalogue of runnable routines, grouped by kind — Classic drills, Scored regimens, Custom
routines — with the scoring rules of each one exposed before launch. Where `play-root`'s launchpad is
optimised for starting fast, this screen is optimised for *choosing*: it is the only surface that shows a
regimen's base points, streak step, clean-set bonus, and completion bonus side by side.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Choose a routine to establish your baseline` on `play-root` | `Link` from `/practice` (`PracticeMenuPage.jsx:247`) | **The only in-app link to this screen.** It renders only when no suggested regimen resolves |
| In | Legacy `/regimens` | `<Navigate to="/practice/regimens" replace />` (`App.jsx:111`); also `LEGACY_ROUTE_ALIASES` for metadata resolution | `resolveRouteMetadata('/regimens')` returns `isLegacyAlias: true` |
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the `AppShell` onboarding gate |
| Out | `Start` on any card | `Link` to `/practice/regimens/:id/run` | ACTIVE shell |
| Out | `← Practice menu` | `Link` to `/practice` | In-page, duplicates shell back |
| Out | Shell back control | `AppShell.handleBack()` → `/practice` | Section root |
| Out | `Sign out` | `signOut()` | Terminates the session |
| Out | PLAY tab re-tap | `TabBar` → `/practice` | |

There is **no** in-page link to `routine-builder` from this screen, and no Clone & Tweak action — both
exist only on `play-root`.

`preserveNestedState` is `false`, so returning from a run does not restore scroll position across shell
remounts.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Select Routine          [Resume] [bell]          | <- Shell header
+-------------------------------------------------------+
|  Putting Regimens                        Sign out     | <- Page header, second h1; see § 8
+-------------------------------------------------------+
|  <- Practice menu                                     | <- In-page back, duplicates shell back
+-------------------------------------------------------+
|  Classic drills                                       | <- Group heading; group omitted when empty
|  +-------------------------------------------------+  |
|  | ★★★  JYLY                         [Last time]   |  | <- pb-badge when this was the last run
|  | 100 putts: five 10-putt stations at 15 ft, ...  |  | <- description column
|  | 100 putts · score every make                    |  | <- rule summary, classic drills only
|  | [ Start ]                                       |  |
|  +-------------------------------------------------+  |
|  | ★★  Around the World                            |  |
|  | Make advances one station; miss steps back one. |  |
|  | 10 stations · 100 attempt cap                   |  |
|  | [ Start ]                                       |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  Scored regimens                                      |
|  +-------------------------------------------------+  |
|  | ★★  C1 Calibration Ladder                       |  |
|  | Four stages, 15ft to 33ft                       |  |
|  |  Base pts/make  10   Streak step        10%     |  | <- <dl>, scored/custom only
|  |  Clean set      25%  Completion bonus   50      |  |
|  | [ Start ]                                       |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  Custom routines                                      |
|  +-------------------------------------------------+  |
|  | ★★★  Morning C1 Calibration (copy)              |  |
|  |  Base pts/make  10   Streak step        10%     |  |
|  | [ Start ]                                       |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back -> /practice, title "Select Routine", activity pill, bell
Page header (.practice-header)
  hdr-title ............ h1, literal "Putting Regimens"
  hdr-signout .......... Sign out button
Back link
  nav-practice ......... "← Practice menu" -> /practice
Status
  st-loading ........... "Loading..." while the list resolves
  st-error ............. <p class="form-error">, inline and non-blocking
Group (repeats; only groups with ≥1 regimen render)
  grp-heading .......... h2: "Classic drills" | "Scored regimens" | "Custom routines"
  Card (repeats)
    card-difficulty .... "★" × regimen.difficulty
    card-name .......... h3
    card-lasttime ...... "Last time" badge on the most recently run regimen
    card-description ... optional paragraph
    card-rule .......... classic drills only: one-line rule summary
    card-stats ......... scored + custom only: <dl> of four scoring knobs
    card-start ......... Link "Start" -> /practice/regimens/:id/run
```

Group order is fixed by the literal array at `RegimenSelectPage.jsx:16`:
`['Classic drills', 'Scored regimens', 'Custom routines']`. Within a group, order is whatever
`fetchRegimensWithSets()` returned — `difficulty` ascending (`regimens.js:7`), or the Dexie fallback's
`difficulty ?? 99` ascending (`regimenRepository.js:33`).

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Putting Regimens` | — | — | — | always |
| `hdr-signout` | button | `Sign out` | default / pressed | `signOut()` | — | always; no confirmation |
| `nav-practice` | link | `← Practice menu` | default / pressed | navigate | `/practice` | always |
| `st-loading` | text | `Loading...` | present / absent | — | — | until `regimenRepository.list` settles (`finally`) |
| `st-error` | paragraph | error `message` | present / absent | — | — | inline; **the group list still renders** — unlike `play-root`, an error here does not blank the page |
| `grp-heading` | h2 | group label | — | — | — | group renders only when it has ≥1 regimen |
| `card-difficulty` | badge | `★` × `regimen.difficulty`, class `difficulty-{n}` | — | — | — | a null `difficulty` renders an empty badge and class `difficulty-null` |
| `card-lasttime` | badge | `Last time` | present / absent | — | — | `mostRecentRegimenId(runs) === regimen.id`; at most one card in the whole list |
| `card-rule` | text | JYLY → `100 putts · score every make`; Clutch → `One pressure putt · randomized 2–8 min rest`; Around the World → `10 stations · {rules_config.max_attempts ?? 100} attempt cap` | — | — | — | `drillKind` ∈ {`jyly`, `around_the_world`, `clutch`} |
| `card-stats` | definition list | `Base pts/make`, `Streak step` (%), `Clean set bonus` (%), `Completion bonus` | — | — | — | every non-classic regimen, including customs. `Math.round(streak_step * 100)` — a null column throws no error but renders `0%` |
| `card-start` | link | `Start` | default / pressed | navigate | `/practice/regimens/{id}/run` | **always** — including for archived routines and routines with zero sets; see § 6 Error |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| All visible regimens (system + own) | `regimenRepository.list(user.id)` | `lib/repository/regimenRepository` | Supabase, **Dexie fallback** | async |
| Last-run regimen id | direct `supabase.from('putting_regimen_runs').select('regimen_id, started_at').eq('user_id', …)` | inline (`RegimenSelectPage.jsx:34-39`) | Supabase | async |
| Suggestion derivation | `mostRecentRegimenId(rows)` | `lib/insights` | — | **pure** |
| Group assignment | `drillGroupLabel(regimen)` | `lib/drillEngine` | — | **pure** |
| Classic-drill detection | `drillKind(regimen)` against `DRILL_TYPES` | `lib/drillEngine` | — | **pure** |

Signatures in `LIB_API_INDEX.md`.

Two notes on the second read. First, it is a **raw Supabase call in a page component** — the only one in
this batch outside `HistoryDetailPage` — and the page's own comment (`RegimenSelectPage.jsx:29-32`)
justifies it: a full `fetchHistory` would pull sessions and distance logs this screen does not need.
Second, it has **no error handling**: `.then(({ data }) => setSuggestedId(mostRecentRegimenId(data ?? [])))`
with no `.catch`, so a rejection surfaces as an unhandled promise rejection and the `Last time` badge
simply never appears.

`regimenRepository.list()` ignores its `userId` argument on the remote path — `fetchRegimensWithSets()`
takes no parameters (`regimens.js:3`) and relies entirely on RLS (`layer1_foundation_schema.sql:123-129`:
own rows plus `user_id is null` system rows). The argument is used only by the Dexie cache filter
(`regimenRepository.js:4-6,30-34`).

**No `archived` filter is applied.** See § 6 Error and `_corrections/play-screens.md` P-6.

### Writes

**N/A** — this screen performs no mutations. `PHASE_A_ARCHITECTURE.md` § 14's transaction contract does
not bind it.

### Offline

Partially resilient. `regimenRepository.list` falls back to the Dexie `regimens` table when Supabase
fails and only rethrows when the cache is empty (`regimenRepository.js:47-51`), so a previously visited
account still sees its full grouped list offline. The `Last time` query has no cache and no fallback, so
the badge disappears offline.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered — an offline list is visually identical to
an online one. Tracked in § 12.

## 6. Flow paths

Shared state behavior is defined in `STATE_MATRIX.md`; this section cites row ids rather than restating
them, per `TEMPLATE.md` § 7.

**Happy path.** Arrive → `Loading...` → groups render → read a routine's scoring knobs → tap `Start` →
`/practice/regimens/:id/run` under the ACTIVE shell. The spinner is `S-LOAD` (`RegimenSelectPage.jsx:54`)
but **diverges** from the row's dominant shape: it is an in-body conditional keyed on an explicit
`loading` flag, not an early return, so the header and back link stay on screen while it shows. Like all
24 instances it carries no `aria-live`, `role="status"`, or `aria-busy`.

**First run / empty.** A new account sees Classic drills and Scored regimens (both seeded system rows
from `20260717003000_phase_d4_classic_drills.sql` and `20260717010000_phase_d4_clutch_simulator.sql`) and
**no Custom routines group at all** — the group is filtered out when empty (`RegimenSelectPage.jsx:18`).
There is no empty-state copy and no "build one" affordance, so a user who has never created a routine
gets no signal that custom routines exist. Contrast `play-root`, which shows
`No custom routines yet. Build one →`.

If `regimenRepository.list` resolves to `[]` (possible only if RLS returns nothing and the cache is
empty), the page renders the header, the back link, and **nothing else** — no empty state. This screen is
one of the fourteen page components that has **no** `S-EMPTY` branch at all; the row's grid marks it ❌,
and this document confirms it against `RegimenSelectPage.jsx:18`.

**Error.** `S-ERR-INLINE` (`RegimenSelectPage.jsx:55`). A list rejection renders `st-error` inline above
an empty group region; the header and back link survive, so the user can leave. No `S-ERR-BLOCK` instance
exists on this screen, which is better behavior than `play-root`'s full-page replacement. `S-RETRY` is
absent as it is everywhere: leaving and re-entering the route is the only way to re-issue the read.

A second error path is not surfaced at all: because archived routines are listed, a user can `Start` an
archived routine — including the empty orphan `createCustomRegimen` leaves behind when a set insert fails
(`regimens.js:39-41`). `validateDrillConfig` rejects a regimen with zero sets
(`drillEngine.js:17` — "A drill needs at least one station."), so the failure lands on
`regimen-active` rather than here.

**Offline.** As § 5. The list survives from cache — `S-OFFLINE-READ` is satisfied here through
`regimenRepository`'s Dexie fallback, one of the few PLAY routes for which it is — while the `Last time`
badge, which has no cache, does not. `S-STALE` is the gap: the cached list is presented as though it were
live, with none of § 12's four calm labels, so this screen is one of the fifteen that row names.

**Auth / guard.** `ProtectedRoute` gates the shell (`S-AUTH-REQUIRED`); `user.id` is dereferenced
unconditionally (`RegimenSelectPage.jsx:22,37`). `useOnboardingGate` runs first (`S-ONBOARD`).
`useCrashRecoveryRedirect` can redirect past this screen on a PWA relaunch (`S-RECOVERY`).

**Interlock.** **N/A** — no cap is enforced or displayed here, so `S-INTERLOCK-CAP` has no instance.
Notably the 100-putt ceiling is *invisible* on this screen: a routine's planned putt total is never
shown, even though `card-rule` displays it for JYLY.

**Destructive.** `Sign out` only, unguarded — no `S-CONFIRM` instance. There is no archive, delete, or
edit action on this screen; routine deletion is a soft archive with no UI anywhere in the app.

Shared-state rows: `S-LOAD`, **`S-ERR-INLINE`** — this screen is one of the few that gets it right, the
error sitting above a list that still renders — `S-EMPTY` (**absent**: no empty state exists here at
all), and `S-OFFLINE-READ` (satisfied through `regimenRepository`'s Dexie fallback). See
`STATE_MATRIX.md`.

## 7. Dependencies

### Schema

`putting_regimens` — `id`, `user_id`, `difficulty`, `name`, `description`, `base_points_per_make`,
`streak_step`, `no_miss_bonus_pct`, `completion_bonus`, `drill_type`, `rules_config`, `archived`.
`drill_type`, `rules_config`, `archived`, and `user_id` were added by `layer1_foundation_schema.sql:85-92`;
the column-level `UNIQUE` on `difficulty` in `putting_regimens_schema.sql:9` was dropped there
(`layer1_foundation_schema.sql:97-100`) and its replacement partial index was dropped again by
`20260717003000_phase_d4_classic_drills.sql:17` in favour of name-based system identity. Treat
`putting_regimens_schema.sql` as the historical reference it declares itself to be, not as current.

`putting_regimen_sets` is fetched by `fetchRegimensWithSets` and **discarded** —
`regimenRepository.list` returns `snapshot.regimens` only (`regimenRepository.js:46`), caching the sets
for `getWithSets` to use later. This is why no card shows a putt count.

`putting_regimen_runs` — `regimen_id`, `started_at`, `user_id` — for the `Last time` badge.

### Library

`lib/repository/regimenRepository` (`list`), `lib/regimens` (`fetchRegimensWithSets`, transitively),
`lib/insights` (`mostRecentRegimenId`), `lib/drillEngine` (`drillGroupLabel`, `drillKind`, `DRILL_TYPES`),
`lib/supabaseClient` (direct). Signatures in `LIB_API_INDEX.md`.

### Components

**None.** This page composes only HTML — no shared component is imported. The card markup
(`.regimen-card`, `.regimen-card-header`, `.difficulty-badge`) is duplicated from
`RegimenLaunchCard` in `PracticeMenuPage.jsx:28-46`, which renders the same classes with different
actions. See `COMPONENT_LIBRARY.md` § Gaps for the general pattern.

### Screens

Reached from `play-root`; launches into `regimen-active`. It has no link to `routine-builder`, so a user
who arrives here and wants a custom routine must go back first.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 11 (PLAY hierarchy places "select routine" third, after resume and Quick
Play), § 12, § 13. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Gap — two `<h1>`s.** Shell renders `<h1>Select Routine</h1>`; the page renders
  `<h1>Putting Regimens</h1>` (`RegimenSelectPage.jsx:44`). Different words for the same screen.
  `_corrections/play-screens.md` P-7.
- **Gap — two back controls.** The shell back arrow and `nav-practice` both navigate to `/practice`.
  Harmless visually, redundant to a screen-reader user tabbing the page.
- **Gap — `card-difficulty` can render as an empty element.** `difficulty` is nullable since
  `layer1_foundation_schema.sql:97`, and `'★'.repeat(null)` evaluates to `''` rather than throwing. A
  routine written outside `buildRegimenPayload` (which always sets 1–5) therefore renders an empty
  `<span class="difficulty-badge difficulty-null">` — invisible to sight and to assistive tech, with no
  fallback text.
- **Gap — the `<dl>` scoring block has no accessible relationship to the routine name.** Each `<dt>` is
  a bare label (`Base pts/make`) inside a card whose name is an `<h3>`; nothing associates them.
- **Good — the group structure is real headings** (`<h2>` per group, `<h3>` per routine), so heading
  navigation works within the page.
- `Start` is a link with a visible text label, not an icon, so it meets the § 12 secondary-target rule by
  construction.

## 9. Events and telemetry

**Metrics.** **N/A** — nothing on this screen is a metric readout. The four scoring knobs are
configuration values read straight from `putting_regimens` columns, not computed statistics, so the
Wilson-interval discipline does not apply here.

**Notifications.** None produced or consumed.

**Lifecycle events.** None written. The `Last time` badge reads `putting_regimen_runs` directly rather
than the `activities` lifecycle table, so it counts runs that were later hidden — a hidden activity's
`putting_regimen_runs` row still exists and still wins `mostRecentRegimenId`. This diverges from
`practice-history`, where `fetchHistory` filters hidden rows out.

## 10. Tests

### Existing coverage

`src/lib/repository/regimenRepository.test.js`, `src/lib/drillEngine.test.js`,
`src/lib/insights/insights.test.js` (covers `mostRecentRegimenId`). Confirmed by reading imports; this
adds `drillEngine` and `insights` to the `TEST_MAP.md` § PLAY row for `regimen-select`, which currently
lists only `repository/regimenRepository`.

**There is no component or page test for `RegimenSelectPage.jsx`.** Nothing asserts the group ordering,
the empty-group suppression, the classic-vs-scored branch, or the missing `archived` filter.

### Acceptance criteria

1. A regimen with `drill_type` of `jyly`, `around_the_world`, or `clutch` appears under
   **Classic drills** and renders `card-rule`, not `card-stats`.
2. A regimen with `drill_type: 'custom'` appears under **Custom routines** and renders `card-stats`.
3. A regimen with any other `drill_type` (including null) appears under **Scored regimens**.
4. A group with zero regimens renders no heading and no container.
5. The regimen whose id equals `mostRecentRegimenId(runs)` — and only that one — shows `Last time`.
6. Around the World's rule line reads the routine's own `rules_config.max_attempts`, falling back to
   `100`.
7. With Supabase unreachable and a warm Dexie cache, the full grouped list still renders.
8. **Known failing:** an archived custom routine still appears under Custom routines and its `Start`
   link is live.

### E2E critical paths

Navigate `/practice` → `Choose a routine…` → `/practice/regimens` → `Start` a classic drill → verify the
run page enforces that drill's rules. Visit `/regimens` and verify the redirect to `/practice/regimens`.
Run a regimen, return here, and verify the `Last time` badge moved. Archive a routine (currently only
possible via a failed save) and verify it is hidden — this last one fails today. No automated browser E2E
suite exists (`PHASE_A_ARCHITECTURE.md` § 9).

## 11. Tasks

#### T-regimen-select-1 — Exclude archived routines from the list

- **Capability:** `data-access`
- **Touches:** `src/lib/regimens.js`, `src/pages/RegimenSelectPage.jsx`
- **Done when:** A routine with `archived = true` does not appear in any group on `/practice/regimens`,
  matching `play-root`'s behavior (`PracticeMenuPage.jsx:127`) and the schema comment at
  `layer1_foundation_schema.sql:91` ("The app filters archived out of pickers").
- **Verify:** `npm test` with a `regimenRepository` case asserting archived rows are dropped, plus a
  manual check that a soft-archived routine disappears from both PLAY surfaces.
- **Commit:** `fix: hide archived routines from the regimen picker`

#### T-regimen-select-2 — Handle the `Last time` query's rejection

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RegimenSelectPage.jsx`
- **Done when:** The `putting_regimen_runs` query has a `.catch` that leaves `suggestedId` null instead
  of producing an unhandled rejection; the rest of the page is unaffected.
- **Verify:** `npm run lint`, plus a page-level test rejecting the query and asserting the group list
  still renders with no console error.
- **Commit:** `fix: swallow the last-run lookup failure on regimen select`

#### T-regimen-select-3 — Add an empty state for Custom routines

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RegimenSelectPage.jsx`
- **Done when:** A user with no custom routines sees a Custom routines heading with copy and a link to
  `/practice/regimens/new`, matching the `No custom routines yet. Build one →` string already used on
  `play-root`.
- **Verify:** `npm run dev` with a fresh account; the group appears with the link.
- **Commit:** `feat: offer routine creation from the regimen picker`

#### T-regimen-select-4 — Decide this screen's relationship to the launchpad

- **Capability:** `docs`
- **Touches:** `SCREEN_SPECS.md`, `docs/ui/SCREEN_INVENTORY.md`
- **Done when:** `SCREEN_SPECS.md:204-205` no longer claims this page "folds into Screen 4's 3-way
  launchpad," and one of the two surfaces is named canonical for launching a routine.
- **Verify:** manual review; `_corrections/play-screens.md` P-5 is resolved and removed.
- **Commit:** `docs: reconcile the regimen picker against the launchpad`
- **Blocked by:** § 12 open question 1.

## 12. Open questions

1. **Two routine pickers with different grouping rules.** `play-root` splits system vs. own
   non-archived; this screen splits by `drill_type` into three named groups. Neither is a subset of the
   other, and only this one exposes scoring knobs while only that one exposes Clone & Tweak. Which is
   canonical? Logged as `_corrections/play-screens.md` P-5.
2. **`Last time` counts hidden activities.** The badge reads `putting_regimen_runs` directly, bypassing
   the `activities` lifecycle filter that `fetchHistory` applies. Should a deleted (hidden) run still be
   "last time"? `PHASE_A_ARCHITECTURE.md` § 11's hide rule says a hidden activity leaves ordinary History
   and metrics — this badge is arguably neither.
3. **Planned putt count is not shown.** The blueprint's routine cards lead with `[ 40 / 100 PUTTS ]`
   (`MASTER_PROJECT_BLUEPRINT.md:296`). The set rows are already fetched and cached by
   `regimenRepository.list` and then discarded. Adding the total is a display change, not a query change.
4. `_corrections/play-screens.md` P-5 (folding claim), P-6 (archived filter), P-7 (double `<h1>`), and
   all touch this screen.

## 13. Blueprint divergence

`MASTER_PROJECT_BLUEPRINT.md` § 3 has **no Screen for a standalone routine picker** — routine selection
is Zone B of Screen 4. `SCREEN_SPECS.md:204-205` records the intent to fold this page into that launchpad:

> `src/pages/RegimenSelectPage.jsx` (folds into Screen 4's 3-way launchpad rather than staying a
> standalone page).

That fold did not happen. The launchpad shipped on `PracticeMenuPage.jsx:203-234` **and** this route
remains live with its own metadata entry (`routeMetadata.js:162-171`), its own legacy alias, and a link
from `play-root`. The two surfaces then diverged:

| Concern | `play-root` Zone B | `regimen-select` |
|---|---|---|
| Grouping | system vs. own non-archived | `drillGroupLabel` → Classic / Scored / Custom |
| Archived routines | excluded | **included** |
| Classic drills | mixed into Standard with no rule summary | own group with a rule summary |
| Scoring knobs | not shown | four-value `<dl>` |
| Clone & Tweak | present | absent |
| Build a routine | present | absent |
| Last-run marker | absent | `Last time` badge |
| Empty custom state | `No custom routines yet. Build one →` | none |

Standing divergences #1 (React/Vite) and #5 (four tabs) apply; see `SCREEN_SPECS.md`.

Because this screen has no blueprint counterpart of its own, § 13's normal question — "how does the
shipped screen differ from the drawn intent" — resolves to: **it should not exist, per the integration
layer, and it does.** Logged as `_corrections/play-screens.md` P-5.
