# Activity Detail (Session Report)

| Field | Value |
|---|---|
| Route id | `practice-history-detail` |
| URL pattern | `/practice/history/:type/:id` |
| Section | `play` |
| Shell | `standard` |
| Header title | `Activity Detail` |
| Activity pill | shown |
| Scroll key | `play-history-detail` |
| Preserves nested state | no |
| Page component | `src/pages/HistoryDetailPage.jsx` (189 lines) |
| Blueprint screen | Screen 9 — *Session Summary & Progress Report*; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

The full diagnostic report for one practice activity: hero scoreboard, per-set or per-distance
breakdown, accuracy by physical putter, today's distances against a rolling 30-day baseline, session
context, and editable notes and tags. It is where a player answers "how did that session actually go, and
was the gear swap worth it," and it is the only place an activity can be corrected or deleted.

It renders `SessionReport` — the same component the freeform and regimen capture screens show at
finish — so a just-finished session and the same session viewed later tell one story rather than two
(`SessionReport.jsx:5-9`, `SCREEN_SPECS.md:249-250`).

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | A row in the History feed | `Link` to `/practice/history/{type}/{id}` (`HistoryPage.jsx:244`) | Only rows whose session or run has loaded are links |
| In | `activity_review` notification | `notificationDestination` → `/practice/history/{payload.type ?? 'freeform'}/{payload.activityId}` (`notifications.js:26`) | From the header sheet or `/notifications`; `notificationProducers.js:13` sets `type` to `regimen` or `freeform` |
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the onboarding gate |
| Out | `History` link (SessionReport `headerAction`) | `Link` to `/practice/history` | |
| Out | `🔄 Replay` | `navigate('/practice/freeform')` or `navigate('/practice/regimens/{regimen_id}/run')` | Starts a **new** activity with the same configuration; does not reopen this one |
| Out | `🏠 Dashboard` | `navigate('/practice')` | |
| Out | `Hide from History` | `window.confirm` → `recovery.hide` → `navigate('/practice/history')` | See § 6 Destructive |
| Out | Shell back control | `AppShell.handleBack()` → `/practice` | Section root, **not** `/practice/history` — which is why the in-page `History` link exists |
| Out | PLAY tab re-tap | `TabBar` → `/practice` | |

**URL parameter contract.** `:type` is compared against the single literal `'freeform'`
(`HistoryDetailPage.jsx:29`); **any other value — including a typo, or `regimens`, or garbage — is
treated as a regimen run.** There is no validation and no 404 path for a bad `:type`. `:id` is the
lifecycle activity id, which is also the primary key of the `putt_sessions` or `putting_regimen_runs`
row — the app deliberately shares one id across the lifecycle parent and its practice child.

`preserveNestedState` is `false`.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Activity Detail         [Resume] [bell]          | <- Shell header; back -> /practice
+-------------------------------------------------------+
|  C1 Calibration Ladder                     History    | <- SessionReport header, second h1; see § 8
|  Monday, July 28                     [ Completed ]    | <- .detail-date; badge only for regimen runs
|  [ Completed ]  [ Synced ]                            | <- .activity-detail-status, lifecycle + sync
+-------------------------------------------------------+
|  42 / 50 putts made                        221 pts    | <- hero scoreboard
|  🔥 Streak peak: 14                                   |    (streak line only when non-null)
|  [██████████████████████████░░░░░░]                    |
+-------------------------------------------------------+
|  Session context                                      | <- omitted entirely when no factors, no effort
|  outdoor · tired · Effort 7/10                        |
|  Weather: windy · 12 mph wind                         | <- only when a weather field is present
+-------------------------------------------------------+
|  Putter performance                                   | <- omitted when no attributed putt_events
|  Cosmic Pilot                        24/28 (86%)      |
|  Electron Pilot                      11/15 (73%)      |
+-------------------------------------------------------+
|  Distance vs 30-day baseline                          | <- omitted when no bands were played
|  10-20ft   18/20 (90%)            baseline 88%        |
|  30-40ft    5/10 (50%)            baseline 72% ⚠️     | <- warn at >10 percentage points
+-------------------------------------------------------+
|  Breakdown                                            | <- always rendered, even when empty
|  Set 1   15 ft    10/10   [Clean]   171 pts           |
|  Set 2   20 ft     9/10             90 pts            |
+-------------------------------------------------------+
|  Notes                                                |
|  [ How did it feel?                                ]  |
|  Tags                                                 |
|  [ windy ] [ tired ](Actv) [ new-putter ]             |
|  [ Add a tag        ] [ Add ]                         |
|  [ Save notes & tags ]                                |
+-------------------------------------------------------+
|  [ 🔄 Replay ]              🏠 Dashboard               |
+-------------------------------------------------------+
|  Hide from History                                    | <- window.confirm, then redirect
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

Every region below except the URL contract is rendered by `SessionReport`; this page supplies the props.

```
Shell header (AppShell-owned)
  back -> /practice, title "Activity Detail", activity pill, bell
Celebration overlay
  celebration .......... CelebrationOverlay — renders NOTHING here; no events are passed
Report header (.practice-header)
  rpt-title ............ h1: "Freeform session" | regimen name || "Regimen run"
  rpt-history .......... link "History" -> /practice/history (the headerAction prop)
Date line (.detail-date)
  date-text ............ "Monday, July 28"
  date-completed ....... "Completed" | "Abandoned" badge — regimen runs only
Status cluster (.activity-detail-status, aria-label "Activity status")
  st-lifecycle ......... "Completed" | "Incomplete", from activities.state
  st-sync .............. "Saved on device" | "Needs attention" | "Synced"
  st-retry ............. "Retry sync" button, only when the scheduler is FAILED
Hero scoreboard
  hero-count ........... "{makes} / {attempts} putts made"
  hero-score ........... "{total_score} pts" — regimen runs only
  hero-streak .......... "🔥 Streak peak: {n}" — regimen runs only
  hero-bar ............. fill width = round(makes/attempts × 100)%
Session context (SessionContextSummary)
  ctx-line ............. factors joined by "·" plus "Effort n/10"; whole section omitted when empty
  ctx-weather .......... "Weather: {condition} · {n} mph wind"
Putter performance
  putter-row ........... one per attributed physical disc: label, "{makes}/{attempts} ({pct}%)"
Distance vs 30-day baseline
  drop-row ............. one per band played in THIS activity: today's figures, baseline, ⚠️
Breakdown
  brk-row .............. freeform: zone label + "{distance} ft" + makes/attempts
                         regimen: "Set {n}" + distance range + makes/attempts + Clean + points
Notes and tags (NotesTagsEditor)
  nt-notes ............. <textarea id="notes">, labelled "Notes"
  nt-tags .............. ChipGroup over STARTER_TAGS plus any existing custom tags
  nt-custom ............ text input + "Add" button; Enter also adds
  nt-save .............. "Save notes & tags" / "Saving..." / "Saved"
Footer (.session-report-footer)
  cta-replay ........... "🔄 Replay"
  cta-dashboard ........ "🏠 Dashboard"
Destructive
  cta-hide ............. "Hide from History"
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `celebration` | overlay | — | **always empty** | — | — | `celebrationEvents` defaults to `[]` and this page passes none; `CelebrationOverlay` returns `null`. It is a Layer 5 stub (`CelebrationOverlay.jsx:1-4`) |
| `rpt-title` | h1 | `Freeform session`, or the regimen name, falling back to `Regimen run` | — | — | — | always |
| `rpt-history` | link | `History` | default / pressed | navigate | `/practice/history` | always |
| `date-completed` | badge | `Completed` / `Abandoned` | — | — | — | rendered only when `completed != null`, i.e. regimen runs. **Note the vocabulary split:** this badge says `Abandoned` while `st-lifecycle` two lines below says `Incomplete` for the same activity |
| `st-lifecycle` | badge | `Completed` / `Incomplete` | — | — | — | from `activity.state`; `zone-badge` vs `abandoned-badge` |
| `st-sync` | badge | `Saved on device` / `Needs attention` / `Synced` | three states | — | — | derived at `HistoryDetailPage.jsx:150-157`: scheduler `FAILED` → `needs_attention`; else activity `pending` + scheduler `SYNCED` → `synced`; else `pending`; else the stored `sync_state`. **`Syncing` is never produced** |
| `st-retry` | button | `Retry sync` | present / absent | `recovery.retrySync()` | activity outbox | only when `recovery.syncStatus === SYNC_STATUS.FAILED` |
| `hero-count` | text | `{makes} / {attempts} putts made` | — | — | — | freeform from `sessionAggregate`, regimen from `regimenRunAggregate` |
| `hero-score` | text | `{n} pts` | present / absent | — | — | regimen runs only (`totalScore` is `null` for freeform) |
| `hero-streak` | text | `🔥 Streak peak: {n}` | present / absent | — | — | `hero.longestStreak != null` — only `regimenRunAggregate` supplies it; freeform's `putt_distance_logs` has no streak column |
| `hero-bar` | progress | width `%` | — | — | — | `0%` at zero attempts (guarded), not `NaN` |
| `ctx-line` | text | factors joined by ` · ` plus `Effort n/10` | present / absent | — | — | the entire `SessionContextSummary` returns `null` when not editable **and** there are no factors **and** effort is null. `contextEditable` is not passed here, so context is **read-only on this screen** — it can only be set during capture |
| `ctx-weather` | text | `Weather: {condition} · {n} mph wind` | present / absent | — | — | when either `weather_condition` or `wind_mph` is present; a missing condition prints `unspecified` |
| `putter-row` | list row | disc label, `{makes}/{attempts} ({pct}%)` | — | — | — | one per `putter_disc_id`, most attempts first. Label is `nickname \|\| moldInfo.mold_name \|\| mold`, or `Unknown disc` when the disc is not in the user's locker |
| `drop-row` | list row | band label, today's figures, `baseline {pct}%` or `no baseline yet`, `⚠️` | normal / warn | — | — | one per 10 ft band **played in this activity**; `warn` when the baseline exceeds today by more than `DROP_OFF_WARN_THRESHOLD_PCT` (10 percentage points); a band with no baseline never warns |
| `brk-row` | list row | freeform: `{zone}`, `{distance} ft`, `{makes}/{attempts}`; regimen: `Set {n}`, distance range, makes/attempts, `Clean` badge, `{n} pts` | — | — | — | regimen rows are sorted by `putting_regimen_sets.set_order` and then **re-labelled by index**, so a gap in `set_order` renumbers silently |
| `nt-notes` | textarea | labelled `Notes`, placeholder `How did it feel?` | — | local state | — | always |
| `nt-tags` | chip group | `STARTER_TAGS` plus any non-starter tags already on the record | active / inactive | toggle | local state | always; no `aria-pressed` |
| `nt-custom` | text + button | placeholder `Add a tag`, button `Add` | — | `normalizeTag` then append | local state | Enter submits; an empty or unnormalizable value is ignored silently |
| `nt-save` | button | `Save notes & tags` / `Saving...` / `Saved` | idle / saving / saved / error | `onSaveNotesTags` → `recovery.correctPracticeDetails` | `activities` + audit + outbox | disabled only while saving; **notes are trimmed and empty becomes `null`** |
| `cta-replay` | button | `🔄 Replay` | default / pressed | `navigate` | `/practice/freeform` or `/practice/regimens/{regimen_id}/run` | always. Starts a **new** activity — it does not resume or reopen this one |
| `cta-dashboard` | button | `🏠 Dashboard` | default / pressed | `navigate` | `/practice` | always |
| `cta-hide` | button | `Hide from History` | default / pressed | `window.confirm` then `recovery.hide` | `activities.hidden_at` | always; see § 6 Destructive |

## 5. Data contract

### Reads

Four requests are issued as one `Promise.all` (`HistoryDetailPage.jsx:61-62`):

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| The entry itself | inline `supabase.from('putt_sessions'\|'putting_regimen_runs').select(…).eq('id', id).single()` | page-local | Supabase | async |
| Putt events for putter attribution | inline `supabase.from('putt_events').select('outcome, putter_disc_id').eq('freeform_session_id'\|'regimen_run_id', id)` | page-local | Supabase | async |
| The user's discs | `fetchUserDiscs(user.id)` | `lib/discLocker` | Supabase | async |
| Full history, for the lifecycle row and the baseline | `fetchHistory(user.id)` | `lib/history` | Supabase + Dexie | async |
| Hero aggregates | `sessionAggregate` / `regimenRunAggregate` | `lib/history` | — | **pure** |
| Baseline / today samples | `distanceSamples` | `lib/history` | — | **pure** |
| Putter accuracy | `putterBreakdown(puttEvents)` | `lib/insights` | — | **pure** |
| Drop-off matrix | `distanceDropOff(today, baseline)` | `lib/insights` | — | **pure** |
| Sync status + mutations | `useHistoryRecovery()` | `hooks/useHistoryRecovery` | Dexie + scheduler | hook |

Signatures in `LIB_API_INDEX.md`. Two of these are **raw Supabase calls in a page component** — the only
other page in this batch doing that is `regimen-select`.

**The rolling baseline is anchored to the entry, not to today.** `BASELINE_WINDOW_DAYS = 30`
(`HistoryDetailPage.jsx:12`), and the window is `[entryTime − 30 days, entryTime]`, excluding the entry
itself (`HistoryDetailPage.jsx:83-95`). The page comment states the intent plainly: "an old history entry
compares against its own contemporaneous window, not today's." This is the right call and is worth
preserving — it makes the report stable over time instead of drifting as new practice accumulates.

**The lifecycle row is required.** `allHistory.activities.find(row => row.id === id)`
(`HistoryDetailPage.jsx:74`); a miss sets the error `Activity history record was not found.` Because
`fetchHistory` defaults to `HISTORY_VISIBILITY.VISIBLE`, **a hidden activity's detail URL always errors
with that message** — which is why `practice-history-deleted` offers no link to this screen. The message
does not say the activity was deleted, so a stale bookmark reads as data loss.

**Statistical discipline.** `distanceDropOff` never warns on a band with no baseline
(`dropOff.js:35-44`) — the absence of evidence is not evidence of a drop. `putterBreakdown` counts **only
real-time `putt_events`**; batch-ribbon fills create no events, so an activity scored by batch entry
shows fewer attempts in the putter table than in the hero scoreboard. That is the capture split
`PHASE_A_ARCHITECTURE.md` § 5 mandates ("Never synthesize per-putt sequence, timing, streak, miss-zone, or
putter attribution from batch totals"), documented at `putterBreakdown.js:1-8`. Neither table renders at
all when it would be empty (`SessionReport.jsx:105,121`), so an unattributed session shows no misleading
zero rows. **No Wilson interval renders on this screen** — a single session's counts are presented as
raw counts, not as estimates, which is the honest treatment for n of one session.

### Writes

| Mutation | Call | Idempotency key | Transaction boundary |
|---|---|---|---|
| Save notes and tags | `recovery.correctPracticeDetails(activity, previous, next)` → `activityRepository.correctPracticeDetails` | `activity-history:{id}:correct-practice-details:{uuid}` | One Dexie `rw` transaction: replay check → version guard → activity write with `version + 1` → audit event with previous/new values → outbox row |
| Hide the activity | `recovery.hide(activity)` → `activityRepository.hide` → `setHidden(id, true, mutation)` | `activity-history:{id}:hide:{uuid}` | Same shape; `reason: 'user_hide'` |
| Retry poisoned rows | `recovery.retrySync()` | replays existing rows | Repository-owned |

Every mutation carries expected state, expected version, occurred/recorded times,
`source: MANUAL_CORRECTION`, installation id, reason, and metadata `{ client: 'history_ui' }` — the full
envelope `PHASE_A_ARCHITECTURE.md` § 14 requires. Tags are validated as non-empty strings before the
transaction opens (`activityRepository.js:553-555`).

After a successful notes/tags save the page patches its own state optimistically
(`HistoryDetailPage.jsx:106-107`) rather than refetching, and replaces `activity` with the returned row
plus its sync state.

### Offline

Writes survive; reads do not. Both mutations commit to Dexie and enqueue outbox rows, so editing notes or
deleting an activity works with no network and syncs later. The four-way `Promise.all` awaits Supabase
directly with no cache fallback, so the screen cannot be *opened* offline — it renders the full-page
error.

This screen displays **three** of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 —
`Saved on Device` (as `Saved on device`), `Needs Attention` (as `Needs attention`), and `Synced` — inside
a labelled status cluster. It is the only PLAY screen that renders `Synced` at all; `practice-history`
renders nothing for that state (`STATE_MATRIX.md` `S-SYNC`). `Syncing` is never produced by the
derivation at `HistoryDetailPage.jsx:150-157`.

## 6. Flow paths

Shared state behavior is defined in `STATE_MATRIX.md`; this section cites row ids rather than restating
them, per `TEMPLATE.md` § 7.

**Happy path.** Arrive from a History row → `S-LOAD` (`HistoryDetailPage.jsx:121`, keyed on
`!entry || !activity` rather than an explicit flag, which is the majority shape that row describes) → all
four requests resolve → the report renders → add a tag → `Save notes & tags` → `S-SAVING`, then the
button reads `Saved` and the audit event is queued.

**First run / empty.** `S-EMPTY` is **not applicable** — this is a detail view of a single record, and
the row's grid marks it ➖. A minimal activity — no putt events, no distance logs, no notes, no tags, no
context — still renders: the header, the date line, the status cluster, a `0 / 0 putts made` hero with a
`0%` bar, an **empty `Breakdown` list with its heading** (`SessionReport.jsx:141-154` renders the heading
unconditionally), the notes editor, and the footer. The putter table, drop-off table, and session-context
block all omit themselves. The empty `Breakdown` heading over nothing is the one rough edge. Where a
panel *does* have data but too little of it, the honest `S-INSUFFICIENT` treatment appears instead —
`SessionReport.jsx:132` renders `no baseline yet` rather than a fabricated comparison.

**Error.** `S-ERR-BLOCK` (`HistoryDetailPage.jsx:120`), unguarded — one of the thirteen instances with no
`&& !data` fallback — and `S-RETRY` has no read instance, so there is no exit but the tab bar. Four
distinct failures collapse into that one presentation, `<p class="form-error">{message}</p>` **as the
entire page**:

1. the entry query fails or the id does not exist (`.single()` rejects);
2. the putt-events query fails;
3. any of the four promises rejects (caught at `HistoryDetailPage.jsx:97`);
4. the lifecycle row is missing or hidden → `Activity history record was not found.`

Case 4 is the common one in practice and its copy is misleading; see § 12.

A `hideActivity` failure is handled differently and better: it sets the error state
(`HistoryDetailPage.jsx:116`) — which still replaces the page, so it is a *mutation* landing in
`S-ERR-BLOCK`, a divergence beyond that row's read-failure definition — but at least does not navigate
away. A `NotesTagsEditor` save failure is handled best of all: `S-ERR-INLINE` (`NotesTagsEditor.jsx:77`),
the editor catching it and rendering `<p class="form-error">` **inside itself**, leaving the report
intact. That is the pattern the page should adopt, and it is this screen's only `S-ERR-INLINE` instance.

**Offline.** As § 5. `S-OFFLINE-READ` **fails outright** — `lib/history` is one of the eight uncached
modules that row names, and this is one of the four routes it takes down. `S-OFFLINE-WRITE` is intact
underneath: the hide/restore path is `activityRepository`-mediated and outbox-backed.

**Sync labelling.** `S-SYNC` via `SessionReport.jsx:67-71`, and this is the fullest vocabulary any
surface renders — `Saved on device` / `Needs attention` / `Synced`. It is still a divergence: three of
§ 12's four labels, with no `Syncing` state and no reserved layout space. `S-SYNC-ATTENTION` is reachable
from here through `onRetrySync` (`HistoryDetailPage.jsx:184`), which per `S-RETRY` is a sync retry and
not a read retry.

**Auth / guard.** `ProtectedRoute` gates the shell (`S-AUTH-REQUIRED`); `user.id` is used for
`fetchUserDiscs` and `fetchHistory`. The entry query itself is **not** user-scoped in the client — it
filters on `id` alone and relies on RLS to prevent reading another user's session. That is correct but
implicit.

**Interlock.** **N/A** — no cap is enforced here, so `S-INTERLOCK-CAP` has no instance.

**Destructive.** `S-CONFIRM`, and `HistoryDetailPage.jsx:111` is one of that row's three
`window.confirm()` calls. `Hide from History` is the app's user-facing Delete; the confirmation reads
*"Hide this activity from History and statistics? You can restore it for 30 days."* On accept,
`recovery.hide` commits locally and the page navigates to `/practice/history`. Three things to note:

- `window.confirm` is an unstyled OS dialog that bypasses the design system entirely, and behaves
  differently in a Capacitor/WKWebView shell. Per the row it satisfies none of § 12's sheet clauses —
  no focus entry or return, no inert background, no reduced-motion or 320px control — even though
  `SheetHost` is shell-owned and available. One of three such calls in the app
  (`COMPONENT_LIBRARY.md` § Gaps item 8).
- The `30 days` in that sentence is a **third independent literal** of the same policy, alongside
  `RECENTLY_DELETED_DAYS` (`history.js:10`) and the copy on `practice-history-deleted`
  (`HistoryPage.jsx:209`). `PHASE_A_ARCHITECTURE.md` § 15 asks for exactly this to be centralized.
- There is no undo toast after the redirect — `S-TOAST` is inert app-wide, so it cannot exist, and
  `S-UNDO` is scoped to unsynced capture input and does not cover a committed hide. Recovery requires
  finding `/practice/history/deleted`, which is reachable only from the History toolbar. What *is*
  produced is the `S-GHOST` presentation on that other route.

Shared-state rows: `S-LOAD`, `S-ERR-BLOCK`, `S-ERR-INLINE` (inside `NotesTagsEditor` only), `S-RETRY`
(sync-retry only, never a read retry), `S-SAVING`, `S-SYNC` — this screen renders the fullest vocabulary
of any surface — `S-INCOMPLETE`, `S-OFFLINE-WRITE`, and **`S-CONFIRM`**, of whose three
`window.confirm()` calls `HistoryDetailPage.jsx:111` is one. See `STATE_MATRIX.md`.

## 7. Dependencies

### Schema

`putt_sessions` — `id`, `session_date`, `notes`, `tags`, `external_factors`, `perceived_effort`,
`weather_condition`, `wind_mph`, `created_at`, plus `putt_distance_logs` (`distance_feet`, `makes`,
`attempts`, `zone`).

`putting_regimen_runs` — `id`, `regimen_id`, `started_at`, `completed`, `total_score`, `notes`, `tags`,
the same context columns, `putting_regimens(name)`, and `putting_regimen_run_sets`
(`makes`, `attempts`, `longest_streak`, `clean_set`, `pressure_putt_made`, `points_earned`) joined to
`putting_regimen_sets` (`set_order`, `distance_feet_min`, `distance_feet_max`, `reps_required`,
`pressure_multiplier`).

`putt_events` — `outcome`, `putter_disc_id`, keyed by `freeform_session_id` or `regimen_run_id`.
`putter_disc_id` is the Layer 1 column the putter table depends on (`SCREEN_SPECS.md:261`).

`activities` — `state`, `version`, `hidden_at`, `sync_state` (local), and the idempotency-key columns.
The session-context columns (`external_factors`, `perceived_effort`, weather) arrived in
`20260716213000_phase_d_session_context_fatigue.sql`.

`discs` + `disc_molds` via `fetchUserDiscs`, for putter labels.

### Library

`lib/history` (`fetchHistory`, `sessionAggregate`, `regimenRunAggregate`, `distanceSamples`),
`lib/insights` (`putterBreakdown`, `distanceDropOff`), `lib/discLocker` (`fetchUserDiscs`),
`lib/supabaseClient` (direct), `lib/instantLaunch/syncScheduler` (`SYNC_STATUS`),
`hooks/useHistoryRecovery`, `lib/repository/activityRepository` transitively. Signatures in
`LIB_API_INDEX.md`.

### Components

`SessionReport`, which composes `CelebrationOverlay` (inert here), `SessionContextSummary` (read-only
here), and `NotesTagsEditor` (which itself composes `ChipGroup`). Details in `COMPONENT_LIBRARY.md`.

`SessionReport` has three consumers — this page, `RegimenRunPage.jsx:36`, and `FreeformLogPage.jsx:31` —
so any change here changes the post-session summary too. That is the point of the component; it is also
the risk.

### Screens

Reached from `practice-history` and from `activity_review` notifications. Links back to
`practice-history`, forward to `freeform-active` or `regimen-active` via Replay, and to `play-root` via
Dashboard. Hiding sends the activity to `practice-history-deleted`.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 2 (lifecycle history), § 4 (facts, audit, provenance — the correction path
writes previous/new values), § 5 (the capture split governing `putterBreakdown`), § 11 § "Lifecycle
interaction details" and § "Hide, restore, and reports", § 12, § 14, § 15. `SCREEN_SPECS.md` Screen 9. No
blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Good — the status cluster is labelled.** `aria-label="Activity status"` on
  `.activity-detail-status` (`SessionReport.jsx:61`), and all three calm states carry text.
- **Good — `nt-notes` has a real `<label htmlFor="notes">`** (`NotesTagsEditor.jsx:45`).
- **Good — the putter and drop-off tables omit themselves rather than rendering empty**, so assistive
  tech never encounters a heading over nothing there.
- **Gap — two `<h1>`s.** The shell renders `<h1>Activity Detail</h1>` and `SessionReport` renders the
  activity's own name as an `<h1>` (`SessionReport.jsx:44`). `COMPONENT_LIBRARY.md:1435-1436` already
  notes that `SessionReport`'s headings are `<h2>` "inside a `<section>` that already contains an
  `<h1>`" — it is the shell's `<h1>` that makes two. `_corrections/play-screens.md` P-7.
- **Gap — `Breakdown` renders its heading over an empty list.** Unlike its neighbours it is
  unconditional (`SessionReport.jsx:141`).
- **Gap — two vocabularies for one state on one screen.** `date-completed` says `Abandoned`;
  `st-lifecycle`, two lines below, says `Incomplete` for the same activity. `COPY_AND_TERMINOLOGY.md`
  § T-3 covers the session/run/activity split but not this one.
- **Gap — `brk-row` keys and labels are positional.** Rows use the array index as the React key
  (`SessionReport.jsx:144`) and regimen sets are re-labelled `Set {i + 1}` after sorting, so the
  displayed set number can differ from the stored `set_order`.
- **Gap — `nt-tags` chips have no `aria-pressed`** (`ChipGroup` limitation,
  `COMPONENT_LIBRARY.md` § Gaps item 10), and `nt-custom`'s input has no `<label>` — only a placeholder.
- **Gap — `cta-hide` is a destructive action confirmed by `window.confirm`**, which is unstyled, not
  focus-managed by the app, and inconsistent with `SheetHost`'s otherwise-good dialog semantics.
- **Gap — `hero-bar` is a `<div>` with a percentage width and no `role="progressbar"`,
  `aria-valuenow`, or text alternative.** The numeric `{makes} / {attempts}` line above it carries the
  same information, so it is not a data loss — but § 12 requires text alternatives for charts and this is
  the closest thing on the screen.

## 9. Events and telemetry

**Metrics.** Two registry-relevant computations render here:

| Readout | Registry key | Note |
|---|---|---|
| Hero make percentage | `putting.make_pct` | window `session`; presented as raw counts, no interval |
| `drop-row` | **no registry entry** | `distanceDropOff` has no `METRIC_DEFINITIONS` counterpart |
| `putter-row` | closest to `putting.miss_tendency`'s capture rule | `captureRequirement: ORDERED_EVENTS_REQUIRED` — honoured, since only `putt_events` feed it |

The registry is not consulted at runtime (`_corrections/play-screens.md` P-9). Note also that this screen
reads `fetchHistory` **unfiltered** for its baseline, so a 30-day baseline includes incomplete activities
— consistent with `practice-history`, inconsistent with `practice-stats`.

**Notifications.** Consumed as a destination: `activity_review` notifications route here
(`notifications.js:26`), produced for every non-hidden `incomplete` activity in the local Dexie mirror
(`notificationProducers.js:5-19`). Nothing on this screen resolves that notification — reviewing an
activity does not clear its badge; only the sheet's checkmark (for destination-less notifications) or the
`read_at` write on open does. See § 12.

**Lifecycle events.** Both mutations write **audit events**, not `activity_state_events` rows: the
lifecycle `state` never changes here, only `notes`/`tags` (correction) or `hidden_at` (hide), plus
`version`. `applyHistoryMutation` (`activityRepository.js:475-517`) records previous and new values and
chains `dependencyKey` to the activity's prior idempotency key so replays stay ordered.
`PHASE_A_ARCHITECTURE.md` § 2 covers the lifecycle stream; § 4 covers this audit chain.

## 10. Tests

### Existing coverage

`src/lib/history.test.js`, `src/lib/insights/insights.test.js` (drop-off), `src/lib/discLocker.test.js`,
`src/lib/repository/activityRepository.test.js` (correction and hide paths, idempotency, version
guards), `src/lib/repository/historyRecoverySync.test.js`. Confirmed by reading imports. The
`TEST_MAP.md` § PLAY row for this route lists `insights/putterComparison`,
`insights/missTendency`, and `insights/experimentComparison` — **those three are not used by this
screen**; they belong to `practice-stats`. The row should name `insights/insights` (for `dropOff`),
`discLocker`, and `repository/activityRepository` instead. `putterBreakdown` is covered inside
`insights/insights.test.js`.

**There is no component or page test for `HistoryDetailPage.jsx` or `SessionReport.jsx`.** Nothing
asserts the entry-anchored baseline window, the freeform/regimen branch, the sync-state derivation, or
the hidden-activity error path.

### Acceptance criteria

1. A freeform session shows distance-log rows, no score, no streak line, and no `Completed`/`Abandoned`
   badge on the date line.
2. A regimen run shows `Set n` rows ordered by `set_order`, its total score, its streak peak, and both
   badges.
3. The drop-off baseline is computed from the 30 days **before this entry's own timestamp**, excluding
   the entry, and does not change as new practice is recorded later.
4. A band with no baseline reads `no baseline yet` and never warns.
5. A band more than 10 percentage points below baseline shows `⚠️`.
6. An activity with only batch-entered putts renders no putter table.
7. Saving notes with only whitespace stores `null`, not `""`.
8. Saving notes offline succeeds locally and shows `Saved on device` in the status cluster.
9. `Hide from History` requires confirmation, then removes the activity from History and lands the user
   on `/practice/history`.
10. **Known failing:** opening a hidden activity's URL shows `Activity history record was not found.`
    rather than explaining that it was deleted.
11. **Known failing:** any load failure replaces the page with a bare string and no retry.

### E2E critical paths

Finish a regimen run → open its History row → verify the report matches what the run page showed at
finish (this is the "one report, two doors" guarantee `SessionReport` exists to provide). Edit notes and
tags → reload → verify persistence and an audit event. Edit offline → reconnect → verify exactly-once
sync. Hide → confirm → verify the redirect, the disappearance from History, and the appearance under
Recently Deleted. Open a hidden activity's URL directly → verify a comprehensible message. Open an
`activity_review` notification → verify it lands on the right activity.
`PHASE_A_ARCHITECTURE.md` § 9 lists "completed edit/audit/recalculation" and "soft-delete/restore" among
the required E2E flows and records that no suite was built.

## 11. Tasks

#### T-practice-history-detail-1 — Explain a hidden or missing activity

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryDetailPage.jsx`
- **Done when:** Opening the detail URL of an activity that exists but is hidden renders copy naming it
  as deleted, with a link to `/practice/history/deleted`; an id that does not exist at all renders a
  distinct not-found state. Neither replaces the shell header.
- **Verify:** `npm test` with a page-level test for each case, using `HISTORY_VISIBILITY.ALL` to
  distinguish them.
- **Commit:** `fix: explain hidden activities on the detail screen`

#### T-practice-history-detail-2 — Replace `window.confirm` with an in-app confirmation

- **Capability:** `ui-interaction`
- **Touches:** `src/pages/HistoryDetailPage.jsx`, `src/components/AppShell.jsx` or a shared dialog
- **Done when:** `Hide from History` confirms through the app's own sheet/dialog with focus management
  and background inertness per `PHASE_A_ARCHITECTURE.md` § 12, and the retention window in its copy is
  interpolated from `RECENTLY_DELETED_DAYS`.
- **Verify:** manual pass on `/practice/history/:type/:id` in a mobile browser and an installed PWA;
  `npm run lint`.
- **Commit:** `feat: confirm activity deletion in-app`
- **Blocked by:** § 12 open question 3 — whether a shared confirmation component lands first.

#### T-practice-history-detail-3 — Add a retry to the load error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/HistoryDetailPage.jsx`
- **Done when:** A failed load renders the error plus a `Retry` control that re-runs `load()`, and a
  `hideActivity` failure renders inline without discarding the report.
- **Verify:** `npm test` with a test that rejects the entry query once then resolves.
- **Commit:** `fix: allow retry when the activity report fails to load`

#### T-practice-history-detail-4 — Reconcile `Abandoned` and `Incomplete`

- **Capability:** `docs`
- **Touches:** `src/components/sessionReport/SessionReport.jsx`, `docs/ui/COPY_AND_TERMINOLOGY.md`
- **Done when:** One word describes a non-completed activity everywhere on this screen, and
  `COPY_AND_TERMINOLOGY.md` records the decision alongside its existing T-3 entry.
- **Verify:** `grep -rn "Abandoned" src/` returns only the chosen usage.
- **Commit:** `fix: one word for an incomplete activity`

#### T-practice-history-detail-5 — Resolve `activity_review` notifications on review

- **Capability:** `data-access`
- **Touches:** `src/pages/HistoryDetailPage.jsx`, `src/lib/repository/notificationRepository.js`
- **Done when:** Opening an activity that has an unresolved `activity_review` notification marks that
  notification resolved, so the header badge clears once the user has actually reviewed it.
- **Verify:** `npm test` covering the repository call; manual check that the bell badge decrements.
- **Commit:** `feat: resolve activity-review notifications on open`
- **Blocked by:** § 12 open question 4.

## 12. Open questions

1. **`:type` is unvalidated.** Anything other than `freeform` is treated as a regimen run, so a mistyped
   URL produces a confusing Supabase error rather than a 404. Should the route reject unknown types?
2. **The baseline includes incomplete activities.** `fetchHistory` is used unfiltered, so a partially
   abandoned session contributes to the 30-day comparison that this activity is judged against. That is
   consistent with `practice-history` and inconsistent with `practice-stats`, which filters through
   `metricEligibleHistory`. See `_corrections/play-screens.md` P-9.
3. **Three unstyled `window.confirm` calls remain in the app** — here, `BagManagePage.jsx:103`, and
   `GoalsPage.jsx:38` (`COMPONENT_LIBRARY.md` § Gaps item 8). Should a shared confirmation component land
   before this screen's is replaced individually?
4. **Nothing resolves an `activity_review` notification.** The notification points here; reviewing the
   activity marks it `read_at` (done by the sheet before navigating) but never `resolved_at`, and
   `isBadgeEligible` only checks `resolved_at` (`notifications.js:16-22`). The badge therefore persists
   after the user has done what it asked.
5. **`CelebrationOverlay` is wired but permanently empty here.** Layer 5's gamification ledger ships
   (`_corrections/lib-api-index.md` § 2 records that `src/lib/gamification/` is complete), so the
   remaining work is passing events — but this screen is *history*, and re-celebrating an old session on
   every view is probably wrong. Is the overlay meant for the capture screens only?
6. **Session context is read-only here.** `contextEditable` is not passed, so factors and perceived
   effort can be set during capture and never corrected afterwards — while notes and tags can be.
   `PHASE_A_ARCHITECTURE.md` § 11 says "Old incomplete activities may be corrected"; this asymmetry
   restricts what correction means.
7. `_corrections/play-screens.md` P-7 (double `<h1>`), P-9 (metric eligibility), and P-11 (`—` vs
   `Insufficient data`) touch this screen, as does `_corrections/state-matrix.md` C-2 (sync labels).

## 13. Blueprint divergence

Blueprint Screen 9 is *Session Summary & Progress Report* (`MASTER_PROJECT_BLUEPRINT.md:513-570`).
`SCREEN_SPECS.md:245-262` records "none of substance," and that is largely accurate — this is the
closest match between drawn intent and shipped screen in the PLAY section. Differences:

| Blueprint Screen 9 feature | Shipped reality |
|---|---|
| Hero scoreboard: `🟢 42 / 50 PUTTS MADE  🔥 STREAK PEAK: 14` + 84% bar | Shipped, with the streak line **regimen-only** — freeform's `putt_distance_logs` has no per-row streak column, so `sessionAggregate` cannot supply one (`history.js:139-142`) |
| Putter performance breakdown with per-disc bars | Shipped as text rows (`{makes}/{attempts} ({pct}%)`), no bar. Populated only from real-time `putt_events` |
| Distance drop-off matrix vs 30-day baseline with `⚠️` above a 10% dip | Shipped exactly, and improved: the baseline is anchored to the entry's own date rather than to today |
| `🎉 LEVEL UP!` / `🏆 NEW TROPHY UNLOCKED` celebration overlay | `CelebrationOverlay` exists as a component but receives no events from this screen and renders nothing |
| `🎁 MILESTONE & BONUS RECAP` block (first-putt bonus, clean sweep) | **Not built as a block.** Clean sets surface as a per-row `Clean` badge inside `Breakdown`; there is no bonus recap section |
| Dual-action footer: `🔄 REPLAY ROUTINE` and `🏠 DASHBOARD` | Shipped, both as buttons rather than full-width blocks |
| `[ ⚙️ ]` header affordance | Replaced by a `History` link |
| — | **Added:** session context (factors, perceived effort, weather), lifecycle and sync status badges, notes and tags editing, and `Hide from History`. All are Phase A additions with no blueprint counterpart |

The "one component, two entry points" rule (`SCREEN_SPECS.md:249-250`) is genuinely honoured, and in fact
went further than specified: `SessionReport` has **three** consumers, not two — this page,
`RegimenRunPage`, and `FreeformLogPage` (`_corrections/component-library.md` § "Checked and found
accurate").

Standing divergences #1 (React/Vite) and #5 (four tabs) apply; see `SCREEN_SPECS.md`.
