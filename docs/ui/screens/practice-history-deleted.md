# Recently Deleted

| Field | Value |
|---|---|
| Route id | `practice-history-deleted` |
| URL pattern | `/practice/history/deleted` |
| Section | `play` |
| Shell | `standard` |
| Header title | `Recently Deleted` |
| Activity pill | shown |
| Scroll key | `play-history-deleted` |
| Preserves nested state | no |
| Page component | `src/pages/HistoryPage.jsx` (277 lines), rendered as `<HistoryPage deleted />` |
| Blueprint screen | none — post-blueprint; see § 13 |
| Verified against | `7351964` |

> **Shared component.** This route and `practice-history` are the **same component**, distinguished by a
> single boolean prop: `App.jsx:75-76` mounts `<HistoryPage />` at `/practice/history` and
> `<HistoryPage deleted />` at `/practice/history/deleted`. It is the only one-component-two-routes case
> in the app (`SCREEN_INVENTORY.md` § Counts). This document describes the `deleted = true` branch
> completely and on its own terms; `practice-history.md` describes the other. Where the branches share
> code, this document states what that code does here rather than pointing at the sibling.

## 1. Purpose

The recovery surface for practice the player deleted: every hidden activity still inside the retention
window, rendered as a ghost row with a one-tap Restore. Deletion in this app is never destructive — it
sets `hidden_at` and removes the activity from ordinary History and from metrics — and this screen is the
only place that state is visible or reversible.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Recently Deleted` link in the History toolbar | `Link` from `/practice/history` (`HistoryPage.jsx:220`) | **The only in-app link to this screen** |
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the onboarding gate |
| Out | `History` link in the page header | `Link` to `/practice/history` (`HistoryPage.jsx:203`) | The header link's label and target both flip on the `deleted` prop |
| Out | Shell back control | `AppShell.handleBack()` → `/practice` | **Section root, not `/practice/history`** — back does not return to the screen you came from (`NAVIGATION_MAP.md` § Back behavior). The in-page `History` link exists precisely because of this |
| Out | `Restore` on a row | stays on this screen; the row disappears after the reload | See § 6 |
| Out | PLAY tab re-tap | `TabBar` → `/practice` | |

Rows on this screen are **not** links. Unlike ordinary History, a hidden activity has no route to its
detail report — `HistoryPage.jsx:234-242` renders a static ghost `<div>` plus a `Restore` button, never a
`<Link>`. To inspect a deleted activity you must restore it first.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Recently Deleted        [Resume] [bell]          | <- Shell header; back goes to /practice
+-------------------------------------------------------+
|  Recently Deleted                          History    | <- Page header, second h1; see § 8
+-------------------------------------------------------+
|  Hidden activities remain restorable here for 30 days.|  <- .log-time, the only policy copy
+-------------------------------------------------------+
|  Fri, Jul 25                                          | <- Day group heading (same grouping as History)
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
|  | ◌ Hidden                                        |  | <- ::before label, dashed border, 0.72 opacity
|  | Freeform   18-25 ft   12/16   [PB]              |  |
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
|  Restore                                              | <- .link-button, below the ghost row
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
|  | ◌ Hidden                                        |  |
|  | C1 Ladder  221 pts  [Completed]  [Saved on dev.]|  |
|  +- - - - - - - - - - - - - - - - - - - - - - - - -+  |
|  Restore                                              |
+-------------------------------------------------------+
|  Retry activity sync                                  | <- only when syncStatus === FAILED
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

No stat strip, no filter chips, no insights panel. All three are inside `{!deleted && …}` guards
(`HistoryPage.jsx:208-223, 259-270`).

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back -> /practice, title "Recently Deleted", activity pill, bell
Page header (.practice-header)
  hdr-title ............ h1, "Recently Deleted"
  hdr-history .......... link "History" -> /practice/history
Policy note
  policy-copy .......... "Hidden activities remain restorable here for 30 days."
Empty
  empty-copy ........... "Nothing deleted recently."
Day group (repeats, newest day first)
  day-label ............ h2, e.g. "Fri, Jul 25"
  Row (repeats within the day)
    ghost-row .......... static <div>, classes putt-log-row history-row history-row-ghost
      EntryContents (identical markup to ordinary History)
        ec-kind ........ "Freeform" | regimen name || "Regimen"
        ec-measure ..... freeform: distance range or "No synced putts"
                         regimen: "{total_score} pts" or "Awaiting sync"
        ec-count ....... freeform only: "{makes}/{attempts}"
        ec-state ....... "Incomplete" / "Completed" badge
        ec-pb .......... "PB" badge
        ec-sync ........ SyncBadge: "Saved on device" | "Needs attention" | nothing
        ec-tags ........ "#{n}" when the child row carries tags
    row-restore ........ button "Restore"
Sync
  sync-retry ........... "Retry activity sync" button, only when syncStatus === FAILED
```

Day grouping is the same forward pass as ordinary History (`HistoryPage.jsx:191-197`), keyed on the local
day of `entry.at` — the activity's **practice timestamp**, not its `hidden_at`. So a session recorded in
June and deleted yesterday files under June, and the list is ordered by when the practice happened rather
than by when it was deleted. That is not obviously the right order for a recovery screen; see § 12.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Recently Deleted` | — | — | — | always |
| `hdr-history` | link | `History` | default / pressed | navigate | `/practice/history` | always |
| `policy-copy` | text | `Hidden activities remain restorable here for 30 days.` | — | — | — | always. The 30 in this string and the 30 in `RECENTLY_DELETED_DAYS` are **two independent literals**; see § 12 |
| `empty-copy` | text | `Nothing deleted recently.` | — | — | — | when zero hidden activities fall inside the window |
| `day-label` | h2 | `Fri, Jul 25` | — | — | — | one per day group of practice timestamps |
| `ghost-row` | div | composed by `EntryContents` | static | — | — | never interactive; the `<Link>` branch is unreachable when `deleted` is true |
| `ec-state` | badge | `Incomplete` / `Completed` | — | — | — | freeform renders a badge only when incomplete; regimen renders one always |
| `ec-pb` | badge | `PB` | present / absent | — | — | PB sets are computed over the **hidden** activities only, because `fetchHistory(HIDDEN)` returns nothing else — so a "PB" here means best among deleted items, not a real personal best. See § 12 |
| `ec-sync` | badge | `Saved on device` / `Needs attention` | pending / needs_attention / nothing | — | — | `synced` and `syncing` render `null` (`STATE_MATRIX.md` `S-SYNC`) |
| `row-restore` | button | `Restore` | idle | `handleRestore(entry.activity)` → `recovery.restore` then `loadHistory()` | `activities.hidden_at` → null, plus an audit event and an outbox row | **always enabled — no confirmation, no per-row pending state, no disabled state while the await is in flight.** Double-tapping issues two mutations |
| `sync-retry` | button | `Retry activity sync` | present / absent | `recovery.retrySync()` | activity outbox | only when `recovery.syncStatus === SYNC_STATUS.FAILED` |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Hidden activities + their sessions and runs | `fetchHistory(user.id, { visibility: HISTORY_VISIBILITY.HIDDEN })` | `lib/history` | Supabase + Dexie mirror | async |
| Feed rows | `activityHistoryEntries(data)` | `lib/history` | — | **pure** |
| PB sets | `regimenPBRunIds`, `distancePBSessionIds` | `lib/insights` | — | **pure** |
| Sync status + `restore` | `useHistoryRecovery()` | `hooks/useHistoryRecovery` | Dexie + outbox scheduler | hook |

Signatures in `LIB_API_INDEX.md`.

**The visibility window.** `fetchHistory`'s `HIDDEN` branch (`history.js:54-59`) keeps an activity when
`activity.hidden_at` is set **and** `hidden_at >= now − RECENTLY_DELETED_DAYS × 86 400 000`, where
`RECENTLY_DELETED_DAYS = 30` (`history.js:10`). The `now` is injectable for tests and defaults to
`new Date()`. This implements the Recently Deleted visibility policy in
`PHASE_A_ARCHITECTURE.md` § 15 — cited, not restated here; § 11's "Hide, restore, and reports" paragraph
is the accompanying behavioral contract, and it is explicit that **audit retention continues past the
visibility window**. Nothing is deleted when a row ages out; it simply stops being listed, and there is
no surface anywhere in the app that can reach it afterwards.

Everything else this branch computes is **discarded**. The `derived` memo
(`HistoryPage.jsx:124-167`) unconditionally computes streak, volume, decay-weighted form, pressure
differential, fatigue curve, and cadence over the hidden set, and the `deleted` branch renders none of
them. Two consequences worth stating: the work is wasted, and if it were ever rendered it would be
computing statistics over deleted practice — exactly the data `PHASE_A_ARCHITECTURE.md` § 11 says leaves
metrics.

**Statistical discipline.** `wilsonInterval` returns `null` at `attempts <= 0`
(`insights/wilson.js:6`), and the one place this branch could hit that — `pctWithBand` — is not rendered
here (it belongs to the Insights panel). The Wilson threshold `WILSON_MIN_N_FOR_HIDING` is imported but
unused on this branch. The only statistic that reaches the screen is the `PB` badge, and its sample scope
is wrong; see § 12.

### Writes

| Mutation | Call | Idempotency key | Transaction boundary |
|---|---|---|---|
| Restore an activity | `recovery.restore(activity)` → `activityRepository.restore(id, mutation)` → `setHidden(id, false, mutation)` | `activity-history:{id}:restore:{uuid}` (`useHistoryRecovery.js:17`) | **One Dexie `rw` transaction** over the history tables: idempotency replay check → version/state guard → write the activity with `version + 1` → append the audit event → enqueue the outbox row (`activityRepository.js:475-546`) |
| Retry poisoned rows | `recovery.retrySync()` | replays existing rows | Repository-owned |

Every mutation carries expected state, expected version, occurred/recorded time,
`source: MANUAL_CORRECTION`, the installation id, a reason (`user_restore`), and metadata
`{ client: 'history_ui' }` — the full envelope `PHASE_A_ARCHITECTURE.md` § 14 requires. The write is
local-first and returns `syncState: 'pending'`; the scheduler drains the outbox afterwards. Restoring an
already-visible activity short-circuits to `outcome: 'idempotent'` with no new event
(`activityRepository.js:527-535`).

The guard at `activityRepository.js:453-472` requires a terminal (`completed` or `incomplete`) activity
and a matching `version`; hidden activities are explicitly allowed (`allowHidden = true` by default), and
a stale version fails with `INVALID_MUTATION` rather than silently overwriting.

This is the transaction contract done properly, and it is the model the routine builder's raw write path
(`screens/routine-builder.md` § 5) should follow.

### Offline

The **write** path is fully offline-capable: `restore` commits to Dexie and enqueues an outbox row, and
the scheduler flushes when connectivity returns. The **read** path is not: `fetchHistory` awaits Supabase
directly and has no cache fallback, so offline this screen renders the full-page error and the user
cannot reach the Restore buttons at all.

Of the four calm states in `PHASE_A_ARCHITECTURE.md` § 12, rows here can display `Saved on Device` (as
`Saved on device`) and `Needs Attention` (as `Needs attention`); `Syncing` and `Synced` render nothing
and reserve no space (`STATE_MATRIX.md` `S-SYNC`). Immediately after a restore the row is gone
from the list, so its `pending` state is never actually seen on this screen.

## 6. Flow paths

Shared state behavior is defined in `STATE_MATRIX.md`; this section cites row ids rather than restating
them, per `TEMPLATE.md` § 7.

**Happy path.** Arrive from the History toolbar → `S-LOAD` (`HistoryPage.jsx:179`) → day-grouped ghost
rows → tap `Restore` → `activityRepository.restore` commits locally → `loadHistory()` re-runs with
`HIDDEN` visibility → the row is gone. The user gets no confirmation message; the disappearance is the
only feedback — `S-TOAST` would be the mechanism and it is permanently inert, so this screen cannot
acknowledge a restore even in principle.

**Ghost rows.** `S-GHOST`, and this screen is that row's only implementation. `.history-row-ghost`
(applied at `HistoryPage.jsx:236`) supplies all four required signals — `opacity: 0.72`, a dashed
outline, and a `::before` carrying `◌ Hidden` as both icon and label. The row's single caveat applies
here and only here: the icon and label are CSS `content:` on a pseudo-element rather than DOM text, so
they are unselectable, untranslatable, and their announcement depends on the screen reader. Do not
confuse this with `S-GHOST-SLOT`, which is an unrelated DISCS concept sharing the word.

**First run / empty.** `S-EMPTY` (`HistoryPage.jsx:226`) — `Nothing deleted recently.` With nothing
deleted, the normal case, the screen renders the header, the 30-day policy line, and that string. It is a
bare `<p>` rather than the shared `.empty-state` block, which is the row's documented defect, but the
copy itself is a complete and honest empty state and unlike ordinary History it cannot be confused with
`S-EMPTY-FILTER` — this branch has no filter chips.

**Aged-out.** An activity hidden more than 30 days ago is silently absent. There is no "older items are
no longer shown" copy, no count, and no way to reach it. `policy-copy` is the only hint, and it is
phrased as a promise ("remain restorable here for 30 days") rather than as an explanation of what is
missing.

**Error.** Two paths land in the same place. A `fetchHistory` rejection renders
`<p class="form-error">{message}</p>` **as the entire page** (`HistoryPage.jsx:178`). A `restore`
rejection does the same thing (`HistoryPage.jsx:169-176` → `setError`), which is worse: the list the user
was working in is replaced by a bare error string with no retry and no way back except the shell tab bar.
A version conflict — restoring an activity that another device already restored — is exactly this case.

**Offline.** As § 5: the read fails, so the screen is unusable offline even though the write it offers
would have worked.

**Auth / guard.** `ProtectedRoute` gates the shell; `user.id` is dereferenced in `loadHistory`
(`HistoryPage.jsx:109`). No anonymous path.

**Interlock.** **N/A** — no cap. The 30-day window is a visibility policy
(`PHASE_A_ARCHITECTURE.md` § 15), not an interlock: nothing is blocked when it elapses, an item simply
stops being listed.

**Destructive.** **N/A** — this screen is the *opposite* of destructive. It contains no delete, purge, or
"empty recently deleted" control. Deletion is initiated on `practice-history-detail` behind a
`window.confirm` (`HistoryDetailPage.jsx:111`). Restoration here is non-destructive and, per
`PHASE_A_ARCHITECTURE.md` § 11, "performs scoped recalculation" with immutable reward-ledger rules
preventing duplicate rewards — that recalculation is server-side and not observable on this screen.

Shared-state rows: **`S-GHOST`** — this screen is that row's only implementation, and the one place in
the app where all four required ghost signals are present — plus `S-LOAD`, `S-EMPTY`, `S-ERR-BLOCK`,
`S-OFFLINE-WRITE` (correctly implemented here), and `S-SYNC`. See `STATE_MATRIX.md`.

## 7. Dependencies

### Schema

`activities` — `hidden_at` is the column this entire screen is about, plus `state`, `version`,
`last_history_idempotency_key`, and the create/lifecycle idempotency keys the audit chain depends on. All
introduced by `20260712193922_phase_a_activity_lifecycle.sql`; the history-recovery RPC arrived in
`20260712205102_phase_a_history_recovery_rpc.sql`.

`putt_sessions` + `putt_distance_logs` and `putting_regimen_runs` + `putting_regimen_run_sets` +
`putting_regimen_sets` supply the row contents. Note these child rows are **never hidden themselves** —
visibility is entirely a property of the lifecycle parent, and `fetchHistory` filters children by the
surviving parent ids (`history.js:62-68`).

Local Dexie tables `activities`, `auditEvents`, and `outbox` carry the restore transaction
(`src/lib/db/dexieDb.js`).

### Library

`lib/history` (`fetchHistory`, `HISTORY_VISIBILITY`, `RECENTLY_DELETED_DAYS`, `activityHistoryEntries`,
`allPuttSamples`), `lib/insights` (imported wholesale by the shared component; only the PB helpers are
used on this branch), `lib/instantLaunch/syncScheduler` (`SYNC_STATUS`), `hooks/useHistoryRecovery`,
`lib/repository/activityRepository`, `lib/repository/historyRecoverySync`. Signatures in
`LIB_API_INDEX.md`.

### Components

`ChipGroup` is imported by the shared component but **not rendered on this branch**. `SyncBadge` and
`EntryContents` are file-local (`HistoryPage.jsx:53-98`). Details in `COMPONENT_LIBRARY.md`.

### Screens

Reached only from `practice-history`. Returns to `practice-history` by its own header link and to
`play-root` by the shell back control. Shares its component with `practice-history`. Restoring here makes
an activity reappear on `practice-history` and become reachable at `practice-history-detail`.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 11 § "Hide, restore, and reports" (the behavioral contract: Delete hides from
ordinary History and metrics; Restore returns it and performs scoped recalculation; immutable
reward-ledger rules prevent duplicate rewards), § 12, § 14 (the transaction contract this screen
satisfies), and § 15 (the Recently Deleted visibility policy — cited, not restated). No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Good — the ghost treatment satisfies § 12's ghost-record rule.** § 12 requires "opacity plus an icon,
  label, and outline; color or opacity alone is insufficient." `.history-row-ghost`
  (`src/App.css:1128-1139`) applies `opacity: 0.72`, a **dashed** border, and a `::before` carrying the
  icon-and-label `◌ Hidden`. All four elements are present. This is the best ghost-record implementation
  in the codebase and the one to copy.
- **Caveat on the same point:** `◌ Hidden` is CSS generated content. Screen-reader support for
  `::before` `content` is inconsistent, so the label is reliable visually and unreliable
  programmatically. A `<span class="visually-hidden">Hidden</span>` inside the row would close that gap
  without changing the visuals.
- **Gap — two `<h1>`s.** The shell renders `<h1>Recently Deleted</h1>` and the page renders
  `<h1>Recently Deleted</h1>` (`HistoryPage.jsx:202`) — the same words twice.
  `_corrections/play-screens.md` P-7.
- **Gap — `row-restore` has no per-row accessible name.** Every button on the screen is labelled
  `Restore`, with nothing associating it to the activity above it. A screen-reader user tabbing through
  hears "Restore, Restore, Restore." `aria-label={\`Restore ${title}\`}` would fix it; `StageCard`'s
  `aria-label="Delete stage {n}"` (`StageCard.jsx:14`) is the in-repo precedent.
- **Gap — `row-restore` gives no in-flight or success feedback.** It is never disabled, never shows a
  pending label, and success is signalled only by the row vanishing. Nothing is announced.
- **Gap — `ec-sync` omits two calm states and reserves no space**
  (`STATE_MATRIX.md` `S-SYNC`; `_corrections/state-matrix.md` C-2).
- **Gap — `ec-pb` is an unexpanded abbreviation** with no `<abbr>` or title, and on this branch its
  meaning is additionally wrong (§ 12).
- **Good — day-group headings are real `<h2>`s.**

## 9. Events and telemetry

**Metrics.** **N/A as output** — no metric readout renders on this branch. What matters here is the
*input* side: hiding an activity is precisely how a player removes it from every metric surface. Every
`METRIC_DEFINITIONS` entry in `src/lib/metrics/registry.js` lists `hidden` among its exclusions, and
`metricEligibleHistory` (`history.js:74-85`) enforces it for `practice-stats`. Restoring reverses that,
and `PHASE_A_ARCHITECTURE.md` § 11 requires the resulting recalculation to be scoped and
reward-idempotent.

Note the registry is not consulted at runtime anywhere in the app, and the two eligibility helpers in the
codebase disagree — `_corrections/play-screens.md` P-9.

**Notifications.** None produced or consumed. No notification points at this screen;
`notificationDestination` (`notifications.js:24-30`) routes only to `/practice/history/*` and `/profile`.

**Lifecycle events.** `restore` writes an **audit event**, not an `activity_state_events` row: the
lifecycle `state` is unchanged (a restored activity stays `completed` or `incomplete`) and only
`hidden_at` and `version` move. `applyHistoryMutation` (`activityRepository.js:475-517`) appends to
`database.auditEvents` with previous and new values, and enqueues a `set_visibility` outbox operation
whose `dependencyKey` chains to the activity's previous history/lifecycle/create idempotency key — so
replays stay ordered. `PHASE_A_ARCHITECTURE.md` § 2 covers the lifecycle event stream; § 4 covers the
audit chain this uses.

## 10. Tests

### Existing coverage

`src/lib/history.test.js`, `src/lib/repository/activityRepository.test.js` (the `setHidden` /
idempotency / version-guard paths), `src/lib/repository/historyRecoverySync.test.js`,
`src/lib/repository/activitySync.test.js`, `src/lib/localPurge.test.js`,
`src/lib/insights/insights.test.js` (the PB helpers). Confirmed by reading imports; matches the
`TEST_MAP.md` § PLAY row for this route and adds the two repository suites.

**There is no component or page test for `HistoryPage.jsx` on either branch.** Nothing asserts that the
`deleted` prop suppresses the stat strip, toolbar, and insights; that rows render as static ghosts rather
than links; or that `handleRestore` reloads the list. The 30-day cutoff is tested only at the
`fetchHistory` level, not through the screen.

### Acceptance criteria

1. An activity hidden today appears here and does **not** appear on `/practice/history`.
2. An activity hidden 31 days ago appears on neither screen.
3. Rows render as static ghosts with the `◌ Hidden` treatment and are not navigable.
4. No stat strip, no filter chips, and no Insights panel render.
5. `Restore` removes the row from this list and the activity reappears on `/practice/history`.
6. `Restore` on an already-restored activity is idempotent — no duplicate audit event, no error.
7. `Restore` while offline succeeds locally and syncs later without duplicating.
8. With nothing deleted, `Nothing deleted recently.` renders.
9. **Known failing:** a `restore` rejection replaces the entire list with a bare error string.
10. **Known failing:** every `Restore` button shares one accessible name.

### E2E critical paths

Hide an activity from its detail report → confirm it leaves History and appears here → Restore → confirm
it returns to History with its totals intact and no duplicated rewards. Hide offline → reconnect → confirm
exactly-once sync. Restore the same activity from two devices → confirm the version guard rejects the
second cleanly rather than corrupting state. Age an activity past 30 days (with an injected `now`) →
confirm it leaves this list while its audit rows survive. `PHASE_A_ARCHITECTURE.md` § 9 lists
"soft-delete/restore" among the required E2E flows and records that no suite was ever built; these are
backlog entries, not existing coverage.

## 11. Tasks

#### T-practice-history-deleted-1 — Keep a restore failure from destroying the list

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** A `recovery.restore` rejection renders an inline, dismissible error beside the affected
  row while the rest of the list stays rendered and usable; a version-conflict error reloads the list
  rather than blanking it.
- **Verify:** `npm test` with a page-level test that rejects `restore` once and asserts the other rows
  survive.
- **Commit:** `fix: keep the recently-deleted list on a failed restore`

#### T-practice-history-deleted-2 — Name and guard each Restore button

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** Each `Restore` exposes an accessible name identifying its activity, is disabled while
  its own mutation is in flight, and announces completion; visual layout is unchanged.
- **Verify:** `npm run lint` plus a VoiceOver pass on `/practice/history/deleted` with three rows.
- **Commit:** `fix: label and guard the restore controls`

#### T-practice-history-deleted-3 — Scope PB badges out of the deleted list

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** The `PB` badge does not render on the `deleted` branch, or is computed against the full
  history rather than the hidden subset. A deleted activity never claims a personal best it does not
  hold.
- **Verify:** `npm test` with a case asserting no `PB` badge on a hidden-only data set.
- **Commit:** `fix: stop deleted activities claiming personal bests`

#### T-practice-history-deleted-4 — Skip the unused derived computation on this branch

- **Capability:** `pure-logic`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** `derived` no longer computes streak, volume, form, pressure, fatigue, and cadence when
  `deleted` is true; the rendered output is byte-identical.
- **Verify:** `npm test`; the existing suite must be unchanged.
- **Commit:** `perf: skip history insights on the deleted branch`

#### T-practice-history-deleted-5 — Bind the policy copy to `RECENTLY_DELETED_DAYS`

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryPage.jsx`
- **Done when:** `policy-copy` interpolates `RECENTLY_DELETED_DAYS` (already imported into scope via
  `lib/history`) instead of hardcoding `30`, so the sentence and the cutoff cannot diverge.
- **Verify:** `npm run lint`; changing the constant changes the sentence.
- **Commit:** `fix: derive the recently-deleted copy from its policy constant`

## 12. Open questions

1. **`PB` badges are computed over the hidden subset only.** `regimenPBRunIds` and
   `distancePBSessionIds` receive whatever `fetchHistory` returned, which on this branch is *only* hidden
   activities. A badge here therefore means "best among your deleted practice," which is meaningless to
   the user and actively misleading. Should the badge be suppressed, or computed against full history?
   Task `T-practice-history-deleted-3`.
2. **Rows are ordered by practice date, not deletion date.** A session from three months ago that was
   deleted yesterday sorts to the bottom under a three-month-old day heading, while the retention window
   it is subject to is measured from `hidden_at`. For a recovery screen, "recently deleted" ordering is
   arguably the point.
3. **Nothing communicates the window elapsing.** Items vanish silently at day 31 with no count, no
   warning, and no "older items" affordance — even though `PHASE_A_ARCHITECTURE.md` § 11 says audit
   retention continues. Should a row approaching the boundary say so?
4. **The 30 in the copy and the 30 in `RECENTLY_DELETED_DAYS` are independent literals.**
   `HistoryPage.jsx:209` hardcodes the sentence; `history.js:10` defines the constant. § 15 calls this a
   *tunable* policy and says to "centralize and test these initial values rather than scattering
   literals." Task `T-practice-history-deleted-5`.
5. **A deleted activity cannot be inspected before restoring it.** There is no read-only route to its
   detail report, so a user with several similar rows must restore to identify, then re-delete.
6. `_corrections/play-screens.md` P-7 (double `<h1>`) and P-9 (metric eligibility) touch this screen, as
   does `_corrections/state-matrix.md` C-2 (the five sync vocabularies).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no
soft-delete or recovery surface; the closest drawn idea is parked Screen 19 (*Privacy & Data Sovereignty
Hub*), whose legal/purge half `SCREEN_SPECS.md:284-285` explicitly keeps parked. This screen is a Phase A
addition implementing `PHASE_A_ARCHITECTURE.md` § 11's hide/restore contract and § 15's Recently Deleted
visibility policy.

Standing divergences #1 (React/Vite) and #5 (four tabs) apply; see `SCREEN_SPECS.md`.
