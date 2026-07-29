# Weekly Reports

| Field | Value |
|---|---|
| Route id | `weekly-reports` |
| URL pattern | `/profile/reports` |
| Section | `me` |
| Shell | `standard` |
| Header title | `Weekly Reports` |
| Activity pill | shown |
| Scroll key | `me-weekly-reports` |
| Preserves nested state | no |
| Page component | `src/pages/WeeklyReportsPage.jsx` (77 lines) |
| Blueprint screen | none — post-blueprint |
| Verified against | `7351964` |

## 1. Purpose

Immutable Monday–Sunday recaps of completed practice and rounds, with their full version history.
Regeneration never overwrites: it appends a new version that supersedes the last, so a snapshot the
user already read can never silently change under them. It answers "what did last week actually look
like, and what was that number computed from."

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Reports` link on the ME root | `Link` from `/profile` | `CareerHubPage.jsx:34`. The only in-app entry point |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` runs first |
| Out | Shell back control | `GlobalHeader` → `handleBack()` | Goes to `/profile`, the ME section root |
| Out | Tab re-tap on ME | `TabBar` → `resolveSectionRoot('me')` | Returns to `/profile` |
| Out | Any other tab | `TabBar` | Standard |

**A `weekly_report` notification does not land here.** `notificationDestination()` maps it to
`payload.href ?? '/profile'` (`src/lib/notifications.js:28`), so with no explicit `href` the user is
taken to the ME root instead of the reports screen. It is moot today — no producer emits a
`weekly_report` notification at all (`src/lib/notificationProducers.js` emits only `activity_review`
and `sync_review`) — but the default destination is wrong for the day one is added. See § 12.

`preserveNestedState` is `false`, so this route is not treated as resumable. The `<details>` disclosure
state for earlier versions is local and resets on every mount.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Weekly Reports                    [activity pill]| <- Shell header, Title Case
+-------------------------------------------------------+
|  Weekly reports          [ Generate last week ]       | <- page h1, sentence case (duplicate h1)
|  Deterministic Monday-Sunday recaps. Regeneration     |
|  creates a new version and never overwrites history.  |
+-------------------------------------------------------+
|  Weekly reports unavailable: <message>                | <- p.form-error, inline
+-------------------------------------------------------+
|  Jul 20, 2026-Jul 26, 2026                            | <- h2#week-<week_start>, en-dash-less
|  +-------------------------------------------------+  |
|  | Version 2                     [ manual ]        |  | <- h3 + .status-chip = generation_reason
|  | Current version                                 |  |
|  |   412        78%        3                       |  |
|  |   Putts   Conversion  Rounds                    |  |
|  |  · 78% putting across 412 putts                 |  | <- highlights, or the no-activity note
|  |  · 5 practice sessions                          |  |
|  |  · 3 completed rounds                           |  |
|  |  Samples ....... 5 practice · 4 round rows      |  | <- audit dl
|  |  Timezone ...... America/New_York               |  |
|  |  Calculation ... weekly-report-v1               |  |
|  |  Source cutoff . 7/29/2026, 9:14:02 AM          |  |
|  +-------------------------------------------------+  |
|  > Earlier versions (1)                               | <- <details>, collapsed
|      +---------------------------------------------+  |
|      | Version 1        [ correction regeneration ]|  |
|      | Superseded snapshot                         |  |
|      +---------------------------------------------+  |
+-------------------------------------------------------+
|  Jul 13, 2026-Jul 19, 2026                            |
|  ...                                                  |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+

Empty list instead of the week sections:
|  No reports yet. Generate the latest completed week   | <- .career-note
|  when you are online.                                 |
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Weekly Reports", activity pill
Page (section.weekly-reports-page)
  Intro (header.weekly-reports-intro)
    intro-title ........ h1 "Weekly reports"
    intro-copy ......... "Deterministic Monday–Sunday recaps. Regeneration creates a new
                          version and never overwrites history."
    intro-generate ..... button "Generate last week" / "Generating…"
  err-inline ........... p.form-error "Weekly reports unavailable: <message>"
  reports-empty ........ "No reports yet. Generate the latest completed week when you are online."
  Week group ........... one section per distinct week_start, aria-labelledby="week-<week_start>"
    week-heading ....... h2#week-<week_start>, "<week_start>–<week_end>" formatted in UTC
    week-current ....... ReportVersion for the highest version, latest = true
    week-history ....... <details> "Earlier versions (<n>)" wrapping the remaining versions
ReportVersion (article.weekly-report-card — rendered once per version)
  ver-number ........... h3 "Version <n>"
  ver-standing ......... "Current version" | "Superseded snapshot"
  ver-reason ........... span.status-chip, generation_reason with underscores replaced by spaces
  ver-attempts ......... metrics.attempts, labelled "Putts"
  ver-conversion ....... metrics.makePct as a percentage, labelled "Conversion"
  ver-rounds ........... metrics.completedRounds, labelled "Rounds"
  ver-highlights ....... ul of rendered highlight strings
  ver-nohighlights ..... "No completed activity was recorded in this window."
  ver-samples .......... "<practiceSessions> practice · <rounds> round rows"
  ver-timezone ......... report.timezone
  ver-calculation ...... report.calculation_version
  ver-cutoff ........... <time dateTime={source_cutoff}> localized
Page-replacing state
  state-loading ........ p.loading "Loading weekly reports…", only while reports and error
                         are both absent
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `intro-title` | h1 | `Weekly reports` | — | — | — | always. Sentence case, against the route title's Title Case `Weekly Reports` — the mismatch `COPY_AND_TERMINOLOGY.md` § 4 asks screen documents to record |
| `intro-copy` | text | `Deterministic Monday–Sunday recaps. Regeneration creates a new version and never overwrites history.` | — | — | — | always. States the immutability contract to the user, which is unusual and good |
| `intro-generate` | button (`.btn-primary`) | `Generate last week` / `Generating…` | idle / busy | `weeklyReportRepository.generate(user.id)` then reload | `weekly_report_snapshots` | `disabled` while busy. **Always enabled otherwise** — it does not check whether the last completed week already has a version, so a second tap creates version 2 |
| `err-inline` | text | `Weekly reports unavailable: <message>` | present / absent | — | — | Inline, non-blocking; the report list stays rendered |
| `reports-empty` | text | `No reports yet. Generate the latest completed week when you are online.` | — | — | — | shown when zero snapshots exist. Names the online requirement explicitly |
| `week-heading` | h2 | `<week start>–<week end>`, each `MMM D, YYYY` formatted with `timeZone: 'UTC'` | — | — | — | one per distinct `week_start`, newest first |
| `week-history` | `<details>` | `Earlier versions (<n>)` | collapsed / expanded | — | — | rendered **only** when a week has more than one version |
| `ver-number` | h3 | `Version <n>` | — | — | — | always |
| `ver-standing` | text | `Current version` \| `Superseded snapshot` | — | — | — | `latest` is passed only to the first (highest-version) card in each week |
| `ver-reason` | chip | `manual` \| `correction regeneration` \| `scheduled` | — | — | — | `generation_reason.replaceAll('_', ' ')`. **`scheduled` is unreachable** — no scheduler exists; see § 12 |
| `ver-attempts` | stat | `<n>` + `Putts` | — | — | — | `metrics.attempts ?? 0` |
| `ver-conversion` | stat | `<n>%` + `Conversion` | value / `—` | — | — | `—` when `metrics.makePct` is null (zero attempts) |
| `ver-rounds` | stat | `<n>` + `Rounds` | — | — | — | `metrics.completedRounds ?? 0` |
| `ver-highlights` | list | `<n>% putting across <n> putts`, `<n> practice session(s)`, `<n> completed round(s)` | 0–3 entries | — | — | Renderers keyed by `item.key`; an unknown key falls back to `` `${item.key}: ${item.value}` `` |
| `ver-nohighlights` | text | `No completed activity was recorded in this window.` | — | — | — | shown when `highlights` is empty |
| `ver-samples` | `dd` | `<n> practice · <n> round rows` | — | — | — | **`sample_counts.putts` is stored but never rendered** — see § 12 |
| `ver-timezone` | `dd` | the timezone the window was computed in | — | — | — | pinned per snapshot, not read live from the profile |
| `ver-calculation` | `dd` | `weekly-report-v1` | — | — | — | `WEEKLY_REPORT_CALCULATION_VERSION`; the provenance token `PHASE_A_ARCHITECTURE.md` § 5 asks derived metrics to carry |
| `ver-cutoff` | `dd`/`time` | localized `source_cutoff` with a machine-readable `dateTime` | — | — | — | the instant the source data was read, distinct from `generated_at` |
| `state-loading` | page | `Loading weekly reports…` | — | — | — | replaces the page only while `reports` and `error` are both falsy |

`ReportVersion` is a module-local component in `WeeklyReportsPage.jsx:15-38`, **not** a shared
component under `src/components/`, so it is not in `COMPONENT_LIBRARY.md`.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| All snapshots for the user | `weeklyReportRepository.list(user.id)` | `lib/repository/weeklyReportRepository` | Supabase-first, **Dexie fallback** | async |
| Week grouping and version ordering | `useMemo` in the page (`:49-53`) | — | — | **pure** |
| Reporting timezone (during generation only) | `reportingTimezone` → `profiles.timezone` | same module | Supabase | async |
| The last complete Monday–Sunday window | `latestCompletedWeekWindow({ now, timezone })` | `lib/weeklyReport` | — | **pure** (clock defaulted) |

`list` orders remotely by `week_start desc, version desc`, mirrors into Dexie
`weeklyReportSnapshots`, and returns the remote rows; on failure it reads the cache, sorts it with the
same comparator, and returns it if non-empty, otherwise rethrows
(`weeklyReportRepository.js:18-28`). Signatures in `LIB_API_INDEX.md`.

### Writes

| Mutation | Call | Idempotency / boundary |
|---|---|---|
| Generate a snapshot | `weeklyReportRepository.generate(user.id)` | `idempotency_key = 'weekly-report:<userId>:<weekStart>:<version>:<uuid>'`; a `23505` unique violation retries **once** with a freshly read `latestVersion`, then rethrows; two failed attempts raise `weekly_report_generation_failed` |

`generate` is a five-step sequence (`weeklyReportRepository.js:62-90`):

1. Read `profiles.timezone` (defaulting to `UTC`).
2. Compute the window with `latestCompletedWeekWindow` — always the **last complete** Monday–Sunday,
   never the current week.
3. Stamp `source_cutoff = now`.
4. Read source rows: `activities` (ids only, `state = 'completed'`, `hidden_at is null`),
   `putt_sessions`, `putting_regimen_runs`, and `rounds` within the window; **each of the latter three
   is filtered to ids present in the visible-activity set** (`:46-51`). Soft-deleted or incomplete
   activities are therefore excluded by construction.
5. Read the current highest version, build the pure snapshot, and insert with
   `supersedes_id = previous?.id ?? null` and
   `generation_reason = previous ? 'correction_regeneration' : 'manual'`.

The pure core is `buildWeeklyReportSnapshot` (`lib/weeklyReport.js:66-106`), which throws
`week_start_must_be_monday` on a non-Monday and `invalid_week_window` on an unusable window, then
computes `sample_counts`, `metrics`, and `highlights` deterministically from the rows given.

**Snapshots are immutable by grant, not by convention.** The migration grants `select, insert` on
`weekly_report_snapshots` to `authenticated` and nothing else
(`20260716220000_...:136`), and `phaseD3ContractsMigration.test.js` asserts that no update or delete
grant exists. The client physically cannot rewrite history.

`PHASE_A_ARCHITECTURE.md` § 14 owns the transaction contract; this write carries an idempotency key
and a version but no Dexie transaction, no outbox, and no expected-state check — it is a direct remote
insert with a single retry.

### Offline

**Reads survive; generation does not.** `list` falls back to the Dexie mirror
(`LIB_API_INDEX.md` classifies the repository **Both — remote-first, local fallback**), so an offline
visit shows every previously synced snapshot with full version history. `generate` performs four
sequential/parallel Supabase reads plus an insert with no outbox, so it fails offline and renders
`err-inline`. `reports-empty` tells the user this in advance — "Generate the latest completed week
**when you are online**" — which is a rare case of an empty state that pre-explains a constraint.

None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 is displayed, so a cached snapshot
list is visually indistinguishable from a live one.

## 6. Flow paths

**Happy path.** Arrive from ME → `list` resolves → snapshots group by week, newest first → tap
`Generate last week` → the repository resolves the timezone, computes the window, reads visible
sources, inserts version 1 → `load()` re-reads → the new week section renders with a
`Current version` card and a `manual` reason chip.

**Regeneration.** Tapping `Generate last week` again for a week that already has versions inserts
version *n+1* with `supersedes_id` pointing at version *n* and reason `correction regeneration`. The
previous card moves into `Earlier versions (n)` and is relabelled `Superseded snapshot`. Nothing is
mutated or removed.

**First run / empty.** `list` returns `[]`; `reports-empty` renders below the intro. The generate
button is fully enabled, so the empty state is one tap from resolution — provided the last completed
week contains any activity. If it does not, generation still succeeds and produces a version-1 card
whose highlights list is replaced by `No completed activity was recorded in this window.` — an empty
report, not an absent one. That is the correct behavior for a deterministic snapshot and worth not
"fixing."

**Error.** Every failure — load, generation, timezone read, or the two-attempt insert — renders inline
via `err-inline` and leaves the page usable. The loading guard is `if (!reports && !error)`, so a load
failure falls through to a page with the intro, the generate button, and the error, rather than a
blank screen. `busy` clears in a `finally`, so a failed generation never leaves the button stuck.

Messages are raw: a Supabase error string, or `weekly_report_generation_failed` from the repository,
or `week_start_must_be_monday` / `invalid_week_window` from the pure builder. See § 12.

**Offline.** As § 5.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced unconditionally
(`WeeklyReportsPage.jsx:46`), so there is no anonymous rendering path. RLS restricts both select and
insert to the owner (`20260716220000_...:126-129`).

**Interlock.** **N/A** — no cap or capacity constraint applies. The `unique (user_id, week_start,
version)` constraint is a correctness guard, not a user-facing interlock: the repository's retry
handles the race silently.

**Destructive.** **N/A** — nothing on this screen deletes, retires, or overwrites. Regeneration is
explicitly additive, and the grant set makes deletion impossible from the client. This is the only
ME screen with no destructive path at all.

## 7. Dependencies

### Schema

From `20260716220000_phase_d3_goal_report_contracts.sql`:

- `weekly_report_snapshots` (`:79-105`) — `week_start` CHECK `extract(isodow) = 1` (Monday only),
  `week_end` generated as `week_start + 6`, `timezone`, `window_start`/`window_end` with a CHECK that
  end exceeds start, `version > 0`, `calculation_version`, `source_cutoff` with a CHECK that it is
  **at or after** `window_end` (so a snapshot can never be built from data read before the window
  closed), `sample_counts`/`metrics` JSONB objects, `highlights` JSONB array, `supersedes_id` with a
  composite owner-checked self-FK, unique `idempotency_key`, `unique (user_id, week_start, version)`,
  and a `generation_reason` CHECK over `scheduled | manual | correction_regeneration`.
- `weekly_reports_user_window_idx` on `(user_id, week_start desc, version desc)` (`:107-108`).
- RLS select-own and insert-own only; grant `select, insert` only (`:129,136`).
- `profiles.timezone` (`:9-11`) — set on `/profile/settings`, read here during generation.
- Source tables read during generation: `activities` (`state`, `hidden_at`), `putt_sessions` +
  `putt_distance_logs`, `putting_regimen_runs` + `putting_regimen_run_sets`, `rounds` (`played_at`,
  `status`).

Dexie mirror: `weeklyReportSnapshots` (`src/lib/db/dexieDb.js:262`), indexed on `[user_id+week_start]`
and `[week_start+version]`.

### Library

`lib/repository/weeklyReportRepository` (`list`, `generate`), and transitively `lib/weeklyReport`
(`latestCompletedWeekWindow`, `buildWeeklyReportSnapshot`, `zonedMidnightUtc`,
`WEEKLY_REPORT_CALCULATION_VERSION`). The page itself imports only the repository. Signatures in
`LIB_API_INDEX.md`.

### Components

**N/A** — this page imports no components from `src/components/`. `ReportVersion` is defined inline in
the page file.

### Screens

- `me-root` links in.
- `settings` owns `profiles.timezone`, which determines the Monday–Sunday boundaries every future
  generation uses, and owns the `Weekly report` notification toggle.
- `practice-history` and the activity lifecycle determine what is *visible* to a report: only
  activities in state `completed` with `hidden_at is null` contribute. Hiding an activity after a
  snapshot was generated does **not** change that snapshot — it changes what a regeneration would
  produce, which is precisely why versioning exists.
- `round-scorecard` / `round-summary` supply the `rounds` rows, via the round's activity parent.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 5 (metric registry — `calculation_version`, sample counts, and provenance
are all present and surfaced, making this the closest any screen comes to satisfying § 5), § 12
(presentation/accessibility), § 14 (repository/transaction contract — partially met, see § 5), § 15
(tunable policies — the visible-state filter). No blocking ADR.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- Each week group is a `<section aria-labelledby="week-<week_start>">` whose heading names the date
  range, so a screen-reader user can navigate week by week.
- The audit block is a real `<dl>`/`<dt>`/`<dd>`, so `Samples`, `Timezone`, `Calculation`, and
  `Source cutoff` are programmatically paired with their values.
- `<time dateTime={source_cutoff}>` gives a machine-readable timestamp alongside localized text.
- Earlier versions use a native `<details>`/`<summary>` with a count in the label — keyboard-operable,
  self-announcing, and correctly sized as a disclosure rather than a modal.
- `intro-generate` changes its accessible name to `Generating…` while busy, so the state change is
  announced. This is the **only** busy-state label in the ME section; `goals`' create button and
  `settings`' toggles do not do it.
- **Gap — duplicate `<h1>`.** `GlobalHeader.jsx:13` renders `Weekly Reports` as an `<h1>` and
  `WeeklyReportsPage.jsx:64` renders `Weekly reports` as a second one — the same screen named twice,
  in two different cases, at the same heading level.
- **Gap — `err-inline` has no `role="alert"`.** A failed generation is announced only if the user
  navigates to the message.
- **Gap — the metrics grid is three unlabeled `<div>`s** holding a `<strong>` value and a `<span>`
  label with no programmatic association. § 12 requires text alternatives for data displays; the text
  is present but the value/label pairing is visual only. The `<dl>` pattern already used ten lines
  below in the same component would fix it.
- **Gap — the "current version" distinction is text-only inside the card**, and the superseded cards
  sit inside a collapsed disclosure. That is fine, but nothing marks the superseded cards as
  historical in their own accessible name — `Version 1` reads identically whether it is current or
  superseded, and `Superseded snapshot` is a separate sibling `<span>`.

## 9. Events and telemetry

**Metrics:** this screen is the app's clearest realization of `PHASE_A_ARCHITECTURE.md` § 5's
discipline, even though weekly reports are not in the § 5 registry proper. Every snapshot carries a
`calculation_version` (`weekly-report-v1`), a `source_cutoff` recording when the inputs were read,
`sample_counts` recording how much evidence there was, and an explicit `timezone` — and the UI
**renders all four**. Where `me-root`'s radar computes sample sizes and discards them, this screen
shows its work. It is the pattern other derived-metric surfaces should copy.

**Notifications:** none produced. The `weekly_report` category exists in
`NOTIFICATION_PREFERENCE_CATEGORIES` and is toggleable on `/profile/settings`, and
`notificationDestination` has a `weekly_report` branch — but `src/lib/notificationProducers.js` emits
only `activity_review` and `sync_review`, so **no `weekly_report` notification is ever created**. The
toggle controls nothing and the destination branch is unreachable. See § 12.

**Lifecycle events:** none written (§ 2). Snapshots are their own append-only record; there is no
separate event table for them.

## 10. Tests

### Existing coverage

| Test file | What it covers |
|---|---|
| `src/lib/weeklyReport.test.js` | The pure core: Monday anchoring, DST-safe zoned midnight, window computation, snapshot determinism, the two thrown errors |
| `src/lib/repository/weeklyReportRepository.test.js` | `list` remote/cache behavior and `generate`'s versioning and retry |
| `src/lib/phaseD3ContractsMigration.test.js` | The migration contract, including `grant select, insert on ... weekly_report_snapshots` and the assertion that **no** update or delete grant exists |

Confirmed by reading the page's imports. `TEST_MAP.md` § ME's row for `weekly-reports` is accurate.

**Not covered:** no page or component test (consistent with `TEST_MAP.md` § The headline). Nothing
asserts that `ReportVersion` renders the fields it is given, that version grouping puts the highest
version first, or that a week with one version omits the `Earlier versions` disclosure.

### Acceptance criteria

1. A fresh account renders the intro, the generate button, and `No reports yet. Generate the latest
   completed week when you are online.`
2. Generating for a week with no activity produces a version-1 card whose highlights are replaced by
   `No completed activity was recorded in this window.` and whose metrics read `0`, `—`, `0`.
3. Generating twice for the same week produces two versions; the second is `Current version` with
   reason `correction regeneration`, and the first moves under `Earlier versions (1)` labelled
   `Superseded snapshot`.
4. The week heading renders the Monday and the Sunday of the window, formatted in UTC, regardless of
   device timezone.
5. `Calculation` reads `weekly-report-v1` and `Timezone` reads the value that was in
   `profiles.timezone` **at generation time**, not the current one.
6. Changing the reporting timezone on `/profile/settings` and regenerating produces a snapshot whose
   `Timezone` and window boundaries reflect the new zone, while the earlier version keeps the old one.
7. A soft-deleted (`hidden_at` set) or non-`completed` activity does not contribute to a newly
   generated snapshot, and does not alter any existing snapshot.
8. An offline visit renders cached snapshots; an offline generation fails inline and leaves the page
   usable.
9. Generation while the last completed week's data has not finished syncing produces a snapshot whose
   `source_cutoff` documents exactly what was read.

### E2E critical paths

- Log practice → wait for the week to close → generate → verify the numbers against the raw sessions.
- Regenerate after hiding an activity → verify version 2 differs and version 1 is unchanged.
- Timezone change → regenerate → verify boundary shift, especially for a user near a date line.
- Offline: cached list renders; generation fails cleanly.
- Concurrency: two tabs generating the same week simultaneously → one retry path → exactly two
  versions or one, never a crash or a duplicate `(user_id, week_start, version)`.

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries. See
`TEST_MAP.md` § E2E backlog.

## 11. Tasks

#### T-weekly-reports-1 — Point weekly-report notifications at this screen

- **Capability:** `pure-logic`
- **Touches:** `src/lib/notifications.js`
- **Done when:** `notificationDestination` returns `payload.href ?? '/profile/reports'` for
  `weekly_report`, and a test pins both the explicit-href and default cases.
- **Verify:** `npm test` (`src/lib/notifications.test.js`)
- **Commit:** `fix: send weekly report notifications to the reports screen`

#### T-weekly-reports-2 — Decide the fate of the unproduced weekly-report notification

- **Capability:** `data-access`
- **Touches:** `src/lib/notificationProducers.js`, `src/lib/notificationPreferences.js`
- **Done when:** Either a producer emits a `weekly_report` notification when a snapshot is generated
  (respecting the user's category preference), or the category is removed from the settings list so
  users are not offered a toggle that controls nothing.
- **Verify:** `npm test` covering the producer or the reduced category list.
- **Commit:** `feat: notify when a weekly report is generated`
- **Blocked by:** § 12 open question 2.

#### T-weekly-reports-3 — Surface the stored putt sample count

- **Capability:** `ui-routine`
- **Touches:** `src/pages/WeeklyReportsPage.jsx`
- **Done when:** `ver-samples` renders `sample_counts.putts` alongside the practice and round counts,
  so all three stored sample dimensions are visible.
- **Verify:** `npm run lint` plus a rendering assertion in a new page test.
- **Commit:** `feat: show the putt sample count on weekly reports`

#### T-weekly-reports-4 — Fix the duplicate, case-mismatched page heading

- **Capability:** `ui-routine`
- **Touches:** `src/pages/WeeklyReportsPage.jsx`
- **Done when:** The page renders no second `<h1>`; the intro copy and generate button remain. The
  screen has exactly one accessible name, matching the route title.
- **Verify:** `npm run lint` plus a VoiceOver rotor check showing one level-1 heading.
- **Commit:** `fix: remove the duplicate weekly reports heading`

#### T-weekly-reports-5 — Pair metric values with their labels semantically

- **Capability:** `ui-routine`
- **Touches:** `src/pages/WeeklyReportsPage.jsx`
- **Done when:** The three-tile metrics grid uses `<dl>`/`<dt>`/`<dd>` like the audit block below it,
  so each value is programmatically associated with its label.
- **Verify:** `npm run lint` plus a VoiceOver pass on one report card.
- **Commit:** `fix: associate weekly report metrics with their labels`

## 12. Open questions

1. **Nothing generates reports automatically.** `generation_reason` admits `scheduled`
   (`20260716220000_...:100-101`) and it is the column's **default**, but the repository only ever
   writes `manual` or `correction_regeneration` (`weeklyReportRepository.js:79`). There is no cron, no
   Edge Function (`supabase/functions/` does not exist), and no client scheduler. A user who never
   taps `Generate last week` never has a weekly report. Was scheduled generation deferred, or
   abandoned?
2. **The `Weekly report` notification category controls nothing.** It is offered on
   `/profile/settings`, it exists in the `notification_preferences` CHECK, and
   `notificationDestination` handles it — but no producer emits one
   (`src/lib/notificationProducers.js`). Combined with question 1, the whole "your weekly recap
   arrives" story is unbuilt: nothing generates, nothing notifies, and the notification that would
   arrive would land on the wrong screen. Logged as C-5 in `docs/ui/_corrections/me-screens.md`.
3. **`sample_counts.putts` is computed, stored, and never shown.** `buildWeeklyReportSnapshot`
   (`lib/weeklyReport.js:102`) writes `{ practiceSessions, putts, rounds }`; `ver-samples` renders only
   the first and third. The one number that would let a reader judge the conversion percentage's
   reliability is the one omitted.
4. **`Rounds` in metrics and `round rows` in samples count different things.**
   `metrics.completedRounds` counts rounds with `status === 'completed'`, while
   `sample_counts.rounds` counts every round row in the window that passed the visible-activity filter
   — including in-progress ones. The card shows both, twelve lines apart, with no explanation of why
   they differ.
5. **A round whose activity parent stayed a draft is invisible to reports.**
   `roundRepository.ensureRoundActivity` (`roundRepository.js:127-160`) deliberately leaves the round's
   lifecycle parent in `draft` when another activity is already current, "without bypassing the
   invariant." `generate`'s source filter admits only activities in state `completed`
   (`weeklyReportRepository.js:38`), so such a round — even one the user finished and marked
   `status = 'completed'` on the round row itself — never reaches a weekly report. Nothing in the UI
   indicates this.
6. **Raw error strings.** `weekly_report_generation_failed`, `week_start_must_be_monday`, and
   `invalid_week_window` render verbatim in `err-inline`. The first is reachable by an ordinary user
   through a double-race on generation; the other two should be unreachable but would be unreadable if
   they surfaced.
7. **`Generate last week` is always enabled.** There is no indication that the last completed week
   already has a version, and no confirmation before creating a superseding snapshot. A user tapping
   twice out of uncertainty silently produces version 2 and pushes version 1 into a collapsed
   disclosure. Given that the intro copy promises versioning, this may be intended — but the button
   label does not distinguish "generate" from "regenerate."

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 has no weekly report
screen among its 21. The nearest relatives are Screen 9 (*Session Summary & Progress Report*), which is
per-session rather than per-week and ships as `SessionReport`, and Screen 10's time-series analytics,
which shipped on `practice-stats`.

This screen is a Phase D3 addition (`PRODUCT_ROADMAP.md:124-125`, "weekly deterministic report
snapshots/version history", COMPLETE 2026-07-16), built under the same migration as goals and
notification preferences. Its design authority is that migration's contract plus
`PHASE_A_ARCHITECTURE.md` § 5's provenance discipline, not the blueprint.

Standing divergences #1 (React/Vite, not Expo) and #3 (append-only schema — of which this screen is
the purest expression: snapshots are insert-only by grant) apply; see `SCREEN_SPECS.md` § Standing
divergences.
