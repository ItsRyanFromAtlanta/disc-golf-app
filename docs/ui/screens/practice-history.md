# Practice History

| Field | Value |
|---|---|
| Route id | `practice-history` |
| URL pattern | `/practice/history` |
| Section | `play` |
| Shell | `standard` |
| Header title | `History` |
| Activity pill | shown |
| Scroll key | `play-history` |
| Preserves nested state | no |
| Page component | `src/pages/HistoryPage.jsx` (277 lines), rendered **without** props |
| Blueprint screen | none — post-blueprint; see § 13 |
| Verified against | `7351964` |

> **Shared component.** `HistoryPage.jsx` serves two routes. This one renders `<HistoryPage />`;
> `practice-history-deleted` renders `<HistoryPage deleted />` (`App.jsx:75-76`). The `deleted` prop is
> the **only** difference, and it is the only place in the app where one component backs two route ids
> (`SCREEN_INVENTORY.md` § Counts). Everything below describes the `deleted = false` branch. The other
> branch has its own document, `practice-history-deleted.md`; where the two diverge, this document says
> so explicitly rather than assuming the reader has both open.

## 1. Purpose

The full practice ledger: every freeform session and regimen run the player has completed or abandoned,
grouped by day, with a four-tile activity strip above it and five derived insight readouts below. It is
where a player answers "what have I actually been doing, and is it working," and the only route into a
single activity's detail report.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `View all` beside Recent activity | `Link` from `/practice` (`PracticeMenuPage.jsx:253`) | Primary path |
| In | `History` link on an activity report | `Link` from `/practice/history/:type/:id` (`HistoryDetailPage.jsx:163`) | |
| In | Post-hide redirect | `navigate('/practice/history')` (`HistoryDetailPage.jsx:115`) | After a successful hide |
| In | `History` link on the Recently Deleted screen | `Link` from `/practice/history/deleted` (`HistoryPage.jsx:203`) | The `deleted` branch's own header link |
| In | `sync_review` notification | `notificationDestination` → `/practice/history` (`notifications.js:27`) | Opened from the header notification sheet or `/notifications` |
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the onboarding gate |
| Out | Any day-group row with a loaded session or run | `Link` to `/practice/history/{type}/{id}` | `type` is `freeform` or `regimen` |
| Out | `Recently Deleted` | `Link` to `/practice/history/deleted` | Same component, `deleted` prop |
| Out | `Practice menu` | `Link` to `/practice` | In-page, duplicates shell back |
| Out | Shell back control | `AppShell.handleBack()` → `/practice` | Section root |
| Out | PLAY tab re-tap | `TabBar` → `/practice` | |

A row whose lifecycle activity has **no** matching `putt_sessions` or `putting_regimen_runs` row renders
as a plain `<div>`, not a `<Link>` (`HistoryPage.jsx:243-251`) — it is a lifecycle record whose practice
child has not synced down yet, and it is deliberately not navigable.

`preserveNestedState` is `false`, so returning from a detail report does not restore scroll position
across shell remounts.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  History                 [Resume] [bell]          | <- Shell header
+-------------------------------------------------------+
|  History                            Practice menu     | <- Page header, second h1; see § 8
+-------------------------------------------------------+
|  +--------+ +--------+ +--------+ +--------+          |
|  |   4    | |  140   | |  520   | |  4310  |          | <- .stat-strip, four tiles
|  | day    | | putts  | | this   | | life-  |          |
|  | streak | | this wk| | month  | | time   |          |
|  +--------+ +--------+ +--------+ +--------+          |
+-------------------------------------------------------+
|  [ All ](Actv) [ Freeform ] [ Regimens ]  Recently... | <- .history-toolbar: ChipGroup + link
+-------------------------------------------------------+
|  Mon, Jul 28                                          | <- Day group heading
|  Freeform   18-25 ft   12/16      [PB]  #2            | <- distance range, makes/attempts, badges
|  C1 Ladder  221 pts    [Completed]                    |
+-------------------------------------------------------+
|  Sun, Jul 27                                          |
|  Freeform   No synced putts  0/0  [Incomplete]        |
|             [Saved on device]                         | <- SyncBadge, pending only
+-------------------------------------------------------+
|  Insights                                             |
|  Current form (14-day weighted)   62% vs 58% lifetime |
|  Clutch factor            +7 pts (pressure 71% vs 64%)|
|  Fatigue curve            S1 74% · S2 66% · S3 58%    |
|  Time of day              morning 68% · evening 59%   |
|  Rest between sessions    0-1d 66% · 2-3d 61%         |
+-------------------------------------------------------+
|  Retry activity sync                                  | <- only when syncStatus === FAILED
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back -> /practice, title "History", activity pill, bell
Page header (.practice-header)
  hdr-title ............ h1, "History"                       [deleted branch: "Recently Deleted"]
  hdr-link ............. link "Practice menu" -> /practice   [deleted branch: "History"]
Stat strip (.stat-strip)                                     [deleted branch: NOT rendered]
  stat-streak .......... practiceStreak over entry timestamps
  stat-week ............ volumeLedger.week
  stat-month ........... volumeLedger.month
  stat-lifetime ........ volumeLedger.lifetime
Toolbar (.history-toolbar)                                   [deleted branch: NOT rendered]
  tb-filter ............ ChipGroup: All | Freeform | Regimens
  tb-deleted ........... link "Recently Deleted" -> /practice/history/deleted
Empty
  empty-copy ........... "No sessions yet."                  [deleted branch: "Nothing deleted recently."]
Day group (repeats, newest day first)
  day-label ............ h2, e.g. "Mon, Jul 28"
  Row (repeats within the day)
    row-link ........... <Link> to /practice/history/{type}/{id} when session||run is loaded
    row-static ......... <div> when neither is loaded (lifecycle-only record)
    EntryContents (shared by both branches)
      ec-kind .......... "Freeform" | regimen name || "Regimen"
      ec-measure ....... freeform: distance range or "No synced putts"
                         regimen: "{total_score} pts" or "Awaiting sync"
      ec-count ......... freeform only: "{makes}/{attempts}"
      ec-state ......... freeform: "Incomplete" badge when state is incomplete
                         regimen: "Completed" | "Incomplete" badge, always rendered
      ec-pb ............ "PB" badge
      ec-sync .......... SyncBadge: "Saved on device" | "Needs attention" | nothing
      ec-tags .......... "#{n}" when the child row carries tags
Insights (.insight-list)                                     [deleted branch: NOT rendered]
  ins-form ............. current form vs lifetime, with a Wilson band under n=30
  ins-clutch ........... pressure vs regular differential
  ins-fatigue .......... make % by set order
  ins-timeofday ........ make % by time-of-day bucket
  ins-rest ............. make % by days since last practice
Sync
  sync-retry ........... "Retry activity sync" button, only when syncStatus === FAILED
```

Day grouping is a single forward pass that merges **consecutive** entries sharing a local day key
(`HistoryPage.jsx:191-197`). It is correct only because `activityHistoryEntries` returns entries sorted
newest-first (`history.js:181`); it would silently produce duplicate day headings for an unsorted input.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `History` | — | — | — | always |
| `hdr-link` | link | `Practice menu` | default / pressed | navigate | `/practice` | always |
| `stat-streak` | tile | value + `day streak` | — | — | — | `practiceStreak(entries.map(e => e.at), now)` — counts back from today, or from yesterday if today has no entry |
| `stat-week` | tile | value + `putts this week` | — | — | — | `volumeLedger(...).week`; week starts **Monday**, local |
| `stat-month` | tile | value + `this month` | — | — | — | calendar month |
| `stat-lifetime` | tile | value + `lifetime` | — | — | — | all visible samples |
| `tb-filter` | chip group | `All`, `Freeform`, `Regimens` | active / inactive | local `setFilter` | component state | always. Filters the rendered rows only — the stat strip and insights are computed **before** the filter and never respond to it |
| `tb-deleted` | link | `Recently Deleted` | default / pressed | navigate | `/practice/history/deleted` | always |
| `empty-copy` | text | `No sessions yet.` | — | — | — | when the filtered list is empty; **an active filter with no matches shows the same copy as a genuinely empty history** |
| `day-label` | h2 | `Mon, Jul 28` (`weekday, month day`) | — | — | — | one per day group |
| `row-link` | link | composed by `EntryContents` | default / pressed | navigate | `/practice/history/{type}/{id}` | rendered when `entry.session \|\| entry.run` is truthy |
| `row-static` | div | same contents, not interactive | — | — | — | rendered otherwise — a lifecycle record with no synced practice child |
| `ec-measure` (freeform) | text | `18-25 ft`, or `20 ft` when min equals max, or `No synced putts` | — | — | — | from `sessionAggregate`; `null` min distance means no distance logs |
| `ec-measure` (regimen) | text | `{total_score} pts`, or `Awaiting sync` | — | — | — | `Awaiting sync` when the `putting_regimen_runs` row has not arrived |
| `ec-state` | badge | `Incomplete` / `Completed` | — | — | — | freeform renders a badge **only when incomplete**; regimen renders one always, `zone-badge` vs `abandoned-badge` |
| `ec-pb` | badge | `PB` | present / absent | — | — | regimen: `regimenPBRunIds` — a completed run that beat every earlier run of the same regimen. Freeform: `distancePBSessionIds` — needs `DISTANCE_PB_MIN_ATTEMPTS` (10) attempts at a distance |
| `ec-sync` | badge | `Saved on device` / `Needs attention` | pending / needs_attention / **nothing** | — | — | `synced` and `syncing` render `null` — see § 8 and `_corrections/play-screens.md` P-8 |
| `ec-tags` | text | `#{n}` | present / absent | — | — | when the session or run carries a non-empty `tags` array |
| `ins-form` | dl row | `{pct} vs {pct} ({lo}–{hi}) lifetime` | — | — | — | the lifetime figure carries a Wilson band **only when lifetime attempts < 30** |
| `ins-clutch` | dl row | `+7 pts (pressure 71% vs regular 64%)`, or `—` | — | — | — | `—` when `pressureDifferential(...).differential` is null |
| `ins-fatigue` | dl row | `S1 74% · S2 66% · …`, or `—` | — | — | — | `—` on an empty curve |
| `ins-timeofday` | dl row | `morning 68% · …`, or `—` | — | — | — | `—` when the bucket map is empty |
| `ins-rest` | dl row | `0-1d 66% · …`, or `—` | — | — | — | `—` when the gap map is empty |
| `sync-retry` | button | `Retry activity sync` | present / absent | `recovery.retrySync()` → `retryPoisoned()` then scheduler retry | activity outbox | rendered only when `recovery.syncStatus === SYNC_STATUS.FAILED` |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Activities + sessions + runs | `fetchHistory(user.id, { visibility: VISIBLE })` | `lib/history` | Supabase + Dexie mirror | async |
| Feed rows | `activityHistoryEntries(data)` | `lib/history` | — | **pure** |
| Flat samples | `allPuttSamples(data)` | `lib/history` | — | **pure** |
| Streak, volume | `practiceStreak`, `volumeLedger` | `lib/insights` | — | **pure** |
| Current form | `decayWeightedForm(samples, now)` | `lib/insights` | — | **pure** (14-day half-life) |
| Clutch factor | `pressureDifferential(runSets)` | `lib/insights` | — | **pure** |
| Fatigue curve | `fatigueCurve(runSets)` | `lib/insights` | — | **pure** |
| Cadence | `cadenceFingerprint(samples)` | `lib/insights` | — | **pure** |
| PB sets | `regimenPBRunIds`, `distancePBSessionIds` | `lib/insights` | — | **pure** |
| Confidence band | `wilsonInterval`, `WILSON_MIN_N_FOR_HIDING` | `lib/insights` | — | **pure** |
| Sync status + mutations | `useHistoryRecovery()` | `hooks/useHistoryRecovery` | Dexie + outbox scheduler | hook |

Signatures in `LIB_API_INDEX.md`.

`fetchHistory` is one call issuing three parallel Supabase queries, then hydrating the Dexie activity
mirror and re-reading it with sync state attached (`history.js:45-52`). If IndexedDB is unavailable it
degrades to the remote rows with `sync_state: 'synced'` rather than blanking the feed. The visibility
filter is applied client-side against `hidden_at` (`history.js:54-61`), and sessions and runs are then
narrowed to the surviving activity ids — so a practice child whose lifecycle parent is hidden never
reaches this screen.

`runSets` (`HistoryPage.jsx:129-136`) flattens every run's set rows into the camelCase shape
`pressureDifferential` and `fatigueCurve` expect. That reshaping is inline in the page rather than in
`lib/history`, which is why no test covers it.

**Statistical discipline.** Two mechanisms, both worth reading exactly:

- `pctWithBand(makes, attempts)` (`HistoryPage.jsx:32-38`) returns `—` at zero attempts, the bare
  percentage at `attempts >= WILSON_MIN_N_FOR_HIDING` (30), and the percentage **plus its 95% Wilson
  interval** below 30. The interval is shown precisely when the number is weakest — the opposite of
  hiding uncertainty.
- `wilsonInterval` returns `null` when `attempts <= 0` (`insights/wilson.js:6`). `pctWithBand`'s
  zero-attempt guard is what stops this screen from dereferencing that null.

The insight rows themselves render `—` for a null statistic rather than `Insufficient data`; see
`_corrections/play-screens.md` P-11 for why that is inconsistent with
`COPY_AND_TERMINOLOGY.md:179`.

**Metric eligibility.** This screen deliberately uses the **unfiltered** `fetchHistory`, not
`metricEligibleHistory`. Incomplete activities therefore contribute to the stat strip and to all five
insight rows. `history.js:71-73` states the intent — "History deliberately includes incomplete activities
so the player can review or repair them" — but the sentence immediately after it says derived metrics
have a stricter contract, and the insights on this screen are derived metrics that do not honour it.
`practice-stats` applies the filter; this screen does not. Recorded as an open question, § 12.

### Writes

| Mutation | Call | Idempotency key | Transaction boundary |
|---|---|---|---|
| Retry poisoned outbox rows | `recovery.retrySync()` → `historyRecoverySync.retryPoisoned()` then `scheduler.retry()` | n/a — replays existing rows | Repository-owned |

No activity mutation originates on this branch. `useHistoryRecovery` also exposes `hide`, `restore`, and
`correctPracticeDetails`, but this screen calls **only** `restore`, and only in the `deleted` branch
(`HistoryPage.jsx:169-176`). Hiding happens on `practice-history-detail`.

The repository/transaction contract is `PHASE_A_ARCHITECTURE.md` § 14.

### Offline

`fetchHistory` awaits Supabase directly and has **no cache fallback for the list itself** — the Dexie
mirror is hydrated *from* the response, not read in its place. Offline, the whole screen renders the
full-page error (§ 6).

The sync surface is partial. `useHistoryRecovery` starts a `createSyncScheduler` on mount, and the page
reloads history whenever the scheduler reports `SYNCED` (`HistoryPage.jsx:120-122`). Of the four calm
states in `PHASE_A_ARCHITECTURE.md` § 12, this screen can display **`Saved on Device`** (as
`Saved on device`) and **`Needs Attention`** (as `Needs attention`) per row, and neither `Syncing` nor
`Synced` anywhere; the badge returns `null` for those, reserving no layout space. Logged as
`_corrections/play-screens.md` P-8.

## 6. Flow paths

**Happy path.** Arrive from `View all` → `Loading...` → stat strip, filter chips, day-grouped rows, and
insights render → tap a row → `/practice/history/{type}/{id}`.

**First run / empty.** With no practice at all, `derived` still resolves (all the pure functions handle
empty input), so the stat strip renders four zeros, the filter chips render, `No sessions yet.` replaces
the row list, and all five insight rows render `—`. The screen is informative rather than blank, but it
does spend four tiles and five rows saying nothing — there is no dedicated first-run treatment.

**Filtered-empty.** Selecting `Regimens` with only freeform history shows `No sessions yet.` — the same
string as a genuinely empty history, with no hint that a filter is active. A real defect for a user who
forgot the chip is set.

**Error.** Any `fetchHistory` rejection renders `<p class="form-error">{message}</p>` **as the entire
page** (`HistoryPage.jsx:178`) — no header, no retry, no navigation. A `restore` failure in the `deleted`
branch routes into the same state, replacing a list the user was working in. Same defect class as
`play-root` and `disc-detail`.

**Offline.** As § 5: full-page error. Note the asymmetry — a *write* made offline survives (the outbox
holds it and `SyncBadge` shows `Saved on device` once the list can be fetched again), but the *read* does
not.

**Auth / guard.** `ProtectedRoute` gates the shell; `user.id` is dereferenced in `loadHistory`
(`HistoryPage.jsx:109`). No anonymous path.

**Interlock.** **N/A** — no cap is enforced here. The 30-day Recently Deleted window is a visibility
policy, not an interlock, and it governs the other branch.

**Destructive.** **N/A on this branch.** No delete, hide, or clear control renders when `deleted` is
false. Hiding is initiated from `practice-history-detail` behind a `window.confirm`; restoring is on
`practice-history-deleted`.

`STATE_MATRIX.md` does not exist (`_corrections/play-screens.md` P-10), so these states are described
inline.

## 7. Dependencies

### Schema

`activities` (`id`, `user_id`, `type`, `state`, `version`, `has_meaningful_fact`, `needs_review`,
`hidden_at`, `metadata`, timestamps, and the two idempotency-key columns) — introduced by
`20260712193922_phase_a_activity_lifecycle.sql`. `hidden_at` is what the 30-day window measures from.

`putt_sessions` + `putt_distance_logs` (freeform side), `putting_regimen_runs` +
`putting_regimen_run_sets` + `putting_regimen_sets` (regimen side, joined for `set_order` and the
distance range). `notes` and `tags` on both parents are read for the `#{n}` chip count.

The local Dexie mirror (`activities`, `auditEvents`, `outbox`) supplies `sync_state`; see
`src/lib/db/dexieDb.js`.

### Library

`lib/history` (`fetchHistory`, `HISTORY_VISIBILITY`, `activityHistoryEntries`, `allPuttSamples`),
`lib/insights` (nine exports — see § 5), `lib/instantLaunch/syncScheduler` (`SYNC_STATUS`),
`hooks/useHistoryRecovery`, `lib/repository/activityRepository` and `historyRecoverySync` transitively.
Signatures in `LIB_API_INDEX.md`.

### Components

`ChipGroup` only. `SyncBadge` and `EntryContents` are file-local components
(`HistoryPage.jsx:53-98`), not shared — which is why `SessionReport` renders a `Synced` badge and this
screen does not. Details in `COMPONENT_LIBRARY.md`.

### Screens

Reached from `play-root`, `practice-history-detail`, `practice-history-deleted`, and the `sync_review`
notification. Links out to `practice-history-detail` (per row) and `practice-history-deleted`.
Shares its component with `practice-history-deleted`.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 2 (lifecycle history), § 5 (metric registry — see § 12 open question 2),
§ 11 § "Hide, restore, and reports", § 12, § 14, and § 15 (Recently Deleted visibility, 30 days —
relevant here only as the destination of `tb-deleted`). No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Gap — two `<h1>`s.** Shell renders `<h1>History</h1>` and the page renders `<h1>History</h1>`
  (`HistoryPage.jsx:202`). Identical text this time, which is arguably worse: a screen-reader user hears
  the same title twice with no way to tell the shell heading from the page heading.
  `_corrections/play-screens.md` P-7.
- **Gap — `ec-sync` reserves no layout space and omits two of four states.**
  `PHASE_A_ARCHITECTURE.md:195-196` requires stable layout space and all four calm states; `SyncBadge`
  returns `null` for `synced` and never renders `Syncing`. Rows reflow as sync completes.
  `_corrections/play-screens.md` P-8.
- **Gap — `row-link` contains five to seven sibling `<span>`s with no internal structure.** The link's
  accessible name is the concatenation of all of them, e.g. "Freeform 18-25 ft 12/16 PB #2", read as one
  run-on string. No `aria-label` summarises it.
- **Gap — `tb-filter` has no `aria-pressed` or `role="tablist"`** (`ChipGroup` limitation,
  `COMPONENT_LIBRARY.md` § Gaps item 10), and no group label associates the chips with what they filter.
- **Gap — badges convey meaning through class plus short text.** `PB`, `Incomplete`, `Completed`, and the
  sync badges all carry text, so none is color-only — that part satisfies § 12's ghost-record rule — but
  `PB` is an unexpanded abbreviation with no `<abbr>` or title.
- **Gap — the insight `<dl>` renders `—` for missing statistics.** An em-dash is announced
  inconsistently across screen readers and carries no meaning; `Insufficient data` (used elsewhere in the
  app) would. `_corrections/play-screens.md` P-11.
- **Good — the day-group headings are real `<h2>`s**, so heading navigation walks the feed by day.
- **Good — the stat tiles pair a value with a text label** rather than relying on position.

## 9. Events and telemetry

**Metrics.** Five registry-relevant readouts render here, all computed as pure functions per
`PHASE_A_ARCHITECTURE.md` § 5's "compute individual views with tested pure functions initially":

| Readout | Registry key | Note |
|---|---|---|
| `stat-week` / `stat-month` / `stat-lifetime` | `practice.volume` | window set matches `['week','month','lifetime']` |
| `ins-form` | `putting.make_pct` | windows `14_day_decay` and `lifetime`; confidence `wilson_below_30` — honoured by `pctWithBand` |
| `ins-fatigue` | `putting.fatigue_curve` | `format: percentage_by_set_order` |
| `ins-clutch` | `putting.pressure_differential` | `format: percentage_point_delta` |
| `stat-streak`, `ins-timeofday`, `ins-rest` | **no registry entry** | `practiceStreak` and `cadenceFingerprint` have no `METRIC_DEFINITIONS` counterpart |

None of these goes through `metricDefinition()` or `filterMetricEligibleActivities()` — the registry is
not consulted at runtime anywhere in the app (`_corrections/play-screens.md` P-9). The registry's
declared exclusions (`hidden`, `no_meaningful_fact`, and *not* `incomplete`) therefore differ from what
this screen actually computes over.

**Notifications.** Consumed as a destination: `sync_review` notifications route here
(`notifications.js:27`). None produced. Note the mismatch — a `sync_review` notification is produced when
the outbox has poisoned rows (`notificationProducers.js:21-32`), and it lands on this screen, where the
matching `Retry activity sync` control appears only if `useHistoryRecovery`'s own scheduler has
independently reached `FAILED`. The two signals are not wired to each other.

**Lifecycle events.** None written on this branch. `PHASE_A_ARCHITECTURE.md` § 2's
`activity_state_events` are written by the capture screens and by the hide/restore paths on the other two
history screens.

## 10. Tests

### Existing coverage

`src/lib/history.test.js` (covers `activityHistoryEntries`, `metricEligibleHistory`, `sessionAggregate`),
`src/lib/insights/insights.test.js` (405 lines — streak, volume, form, cadence, fatigue, pressure, PBs,
Wilson), `src/lib/repository/historyRecoverySync.test.js`,
`src/lib/repository/activityRepository.test.js`, `src/lib/localPurge.test.js`. Confirmed by reading
imports; matches the `TEST_MAP.md` § PLAY row and adds `repository/activityRepository`.

**There is no component or page test for `HistoryPage.jsx`.** In particular, nothing covers the
consecutive-day grouping loop, the filter predicate, the `runSets` reshaping, `SyncBadge`'s state map, or
`pctWithBand`'s threshold behavior — all of which live in the page file rather than in `lib/`.

### Acceptance criteria

1. Entries are grouped under one heading per local day, newest day first.
2. A freeform session with distance logs shows its min–max range; with none, `No synced putts`.
3. A regimen run with no synced `putting_regimen_runs` row shows `Awaiting sync` and renders as a static
   row, not a link.
4. `Freeform` and `Regimens` filter the row list and leave the stat strip and insights unchanged.
5. Lifetime make % below 30 attempts shows a Wilson band; at or above 30 it does not.
6. Every insight row with no qualifying samples renders `—`, never `0%`.
7. Hidden activities never appear.
8. A pending write shows `Saved on device`; a poisoned one shows `Needs attention`.
9. **Known failing:** a synced row shows no badge at all, and the row reflows when sync completes.
10. **Known failing:** an active filter with zero matches is indistinguishable from an empty history.

### E2E critical paths

Complete a regimen run → open History → verify the row, its score, and its day heading. Record putts
offline → open History → verify `Saved on device` → reconnect → verify the list reloads on `SYNCED`.
Hide an activity from its detail report → verify it leaves this list and appears under Recently Deleted.
Poison an outbox row → verify `Retry activity sync` appears and clears. Filter by `Regimens` on a
freeform-only account → verify a distinguishable empty state (fails today). No automated browser E2E
suite exists (`PHASE_A_ARCHITECTURE.md` § 9).

## 11. Tasks

#### T-practice-history-1 — Render all four calm sync states with reserved space

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** `SyncBadge` renders `Saved on Device`, `Syncing`, `Synced`, and `Needs Attention` with
  the casing `PHASE_A_ARCHITECTURE.md:195-196` specifies, always occupying the same width so a row does
  not reflow on transition. `SessionReport`'s badge set is the reference.
- **Verify:** `npm run lint`, plus a manual check that a row's height and width are stable across a
  pending → synced transition.
- **Commit:** `fix: render every calm sync state in history rows`
- **Blocked by:** nothing; see `_corrections/play-screens.md` P-8.

#### T-practice-history-2 — Distinguish a filtered-empty list from an empty history

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** With a filter active and no matches, the copy names the filter and offers a reset; with
  no filter and no entries, `No sessions yet.` is unchanged.
- **Verify:** `npm test` with a page-level test asserting the two strings differ.
- **Commit:** `fix: explain an empty filtered history`

#### T-practice-history-3 — Keep a load failure from replacing the page

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** A `fetchHistory` rejection renders an inline error with a `Retry` control that re-runs
  `loadHistory()`; the header and any previously loaded list survive. A `restore` failure in the
  `deleted` branch likewise does not discard the list.
- **Verify:** `npm test` with a test that rejects `fetchHistory` once and asserts the retry succeeds
  without a reload.
- **Commit:** `fix: allow retry when history fails to load`

#### T-practice-history-4 — Move the run-set reshaping into `lib/history`

- **Capability:** `pure-logic`
- **Touches:** `src/lib/history.js`, `src/pages/HistoryPage.jsx`
- **Done when:** The `runSets` flattening at `HistoryPage.jsx:129-136` becomes an exported pure function
  (`runSetSamples(data)` or similar) with unit tests, and both this page and any future consumer call it.
- **Verify:** `npm test` with cases for a run with missing `putting_regimen_sets` joins.
- **Commit:** `refactor: extract run-set samples from the history page`

## 12. Open questions

1. **Should the stat strip and insights respect the filter?** Today `tb-filter` changes only the row
   list, so "Freeform" leaves a clutch factor computed from regimen pressure putts on screen. Either
   behavior is defensible; neither is documented.
2. **Should insights on this screen exclude incomplete activities?** `history.js:71-73` says History
   includes them on purpose and that derived metrics are stricter, but this screen's five insight rows
   are derived metrics computed over the unfiltered set. `practice-stats` filters; this one does not. See
   also `_corrections/play-screens.md` P-9, which records that the two eligibility rules in the codebase
   disagree with each other as well.
3. **`sync_review` notifications land here with nothing to act on.** The producer fires on a poisoned
   outbox row; the retry control appears on a different signal. Should the notification deep-link to a
   dedicated sync surface, or should this screen surface poisoned rows directly?
4. **The `deleted` branch computes five insights and a stat strip it never renders.** `derived`
   (`HistoryPage.jsx:124-167`) runs unconditionally. Harmless at current volume, wasteful in principle,
   and a source of confusion when reading the component.
5. `_corrections/play-screens.md` P-7 (double `<h1>`), P-8 (calm states), P-9 (metric eligibility), P-10
   (missing `STATE_MATRIX.md`), and P-11 (`—` vs `Insufficient data`) all touch this screen.

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 has no history ledger;
the nearest drawn surfaces are Screen 9 (*Session Summary*, which became `practice-history-detail`) and
Screen 10 (*Analytics Control Tower*, which was never built as a destination —
`_corrections/screen-specs-and-agents.md` C-2). This screen is a Phase A addition implementing
`PHASE_A_ARCHITECTURE.md` § 11's "unified history/correction/hide/restore" requirement, and it appears in
that section's PLAY ordering as the final item.

Standing divergences #1 (React/Vite) and #5 (four tabs, no STATS tab) apply; see `SCREEN_SPECS.md`.
