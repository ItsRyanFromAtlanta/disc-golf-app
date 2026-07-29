# Practice Insights (Confidence Map)

| Field | Value |
|---|---|
| Route id | `practice-stats` |
| URL pattern | `/practice/stats` |
| Section | `play` |
| Shell | `standard` |
| Header title | `Practice Insights` |
| Activity pill | shown |
| Scroll key | `play-stats` |
| Preserves nested state | no |
| Page component | `src/pages/ConfidenceMapPage.jsx` (98 lines) |
| Blueprint screen | Screen 10 — *Global Analytics & Settings Control Tower*, partially; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

The player-wide evidence surface for putting: which distances are genuinely reliable rather than merely
lucky, where misses cluster, which physical putter actually performs better, and whether a new putter
changed anything. Its organising idea is stated on the page itself — a distance band is only trustworthy
when its *pessimistic* estimate clears the bar, so a small sample never gets promoted on a flattering
point estimate.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Chart icon in the `play-root` page header | `Link` from `/practice` (`PracticeMenuPage.jsx:145`), `title="Confidence map"` | **The only in-app link to this screen**, and it is icon-only with no accessible name |
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the onboarding gate |
| Out | `Practice menu` | `Link` to `/practice` | In-page, duplicates shell back |
| Out | Shell back control | `AppShell.handleBack()` → `/practice` | Section root |
| Out | PLAY tab re-tap | `TabBar` → `/practice` | |

There is no link from `practice-history`, from `me-root`, or from anywhere in ME — despite this being the
app's analytics surface and `SCREEN_SPECS.md:38-39` placing analytics under ME. See § 13.

`preserveNestedState` is `false`. The `ExperimentMarkerPanel` form's local state is therefore lost on any
navigation away, including a stray tab tap.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Practice Insights       [Resume] [bell]          | <- Shell header
+-------------------------------------------------------+
|  Practice Insights                  Practice menu     | <- Page header, second h1; see § 8
+-------------------------------------------------------+
|  Distance confidence                                  |
|  Make % by distance band, colored by how sure we can  |
|  be. A band only turns lock-in once its worst-case    | <- LOCK_IN_LOWER_BOUND interpolated
|  estimate still clears 70% — small samples stay       |
|  coin-flip even at a high point estimate.             |
|  +-------------------------------------------------+  |
|  | 10-20ft                              Lock-in    |  |
|  |     |========[#]==========|          |          |  | <- interval bar, point marker, 50% midline
|  | 84/96 (88%)                                     |  |
|  +-------------------------------------------------+  |
|  | 30-40ft                              Coin-flip  |  |
|  |  |=================[#]============|  |          |  |
|  | 6/11 (55%)   n=11 — interval 28%-79%            |  | <- caveat shown only below n=30
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  Miss tendency                                        |
|  Diagnostic misses only. Heat shows where real-time   |
|  misses landed; batch totals never invent direction.  |
|  Zone captured for 41 of 63 real-time misses (65%).   |
|  +-------------------------------------------------+  |
|  | 30-40ft                          14/22 zoned    |  |
|  | Repeated pattern: low left (6 misses)           |  | <- only at >= 3 misses in a zone
|  | [high left ][high center][high right]           |  |
|  | [ mid left ][  center   ][ mid right]           |  | <- 3x3 heat grid, opacity by share
|  | [ low left ][low center ][ low right]           |  |
|  | Small sample: n=14. Counts are evidence, not     |  |
|  | coaching.                                        |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  Physical putter comparison                           |
|  Physical disc captured for 180 of 240 attempts (75%).|
|  +-------------------------------------------------+  |
|  | Cosmic Pilot            [ primary putter ]      |  |
|  | 78%  102/131 overall                            |  |
|  | +4 pts  shared-distance delta · n=96            |  |
|  | > Distance evidence (4)                         |  | <- <details> disclosure
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  New-putter experiments                               |
|  [ Physical putter    v ] [ Started using it      ]   |
|  [ Marker label       ] [ Notes (optional)         ]  |
|  [ Save experiment marker ]                           |
|  +-------------------------------------------------+  |
|  | Switched to Pilot     [ Evidence ready ]        |  |
|  |  64% Before · 44 att   71% After · 38 att       |  |
|  |  +7 pts Change                                  |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back -> /practice, title "Practice Insights", activity pill, bell
Page header (.practice-header)
  hdr-title ............ h1, literal "Practice Insights"
  hdr-practice ......... link "Practice menu" -> /practice
Distance confidence
  dc-heading ........... h2 "Distance confidence"
  dc-intro ............. explanatory paragraph, interpolating LOCK_IN_LOWER_BOUND
  dc-empty ............. "No putts logged yet — the map fills in as you practice."
  Band (repeats, ascending by band start)
    band-label ......... e.g. "10-20ft"
    band-zone .......... "Lock-in" | "Developing" | "Coin-flip"
    band-interval ...... absolutely positioned Wilson interval bar
    band-point ......... point-estimate marker
    band-midline ....... fixed 50% reference line
    band-counts ........ "{makes}/{attempts} ({pct})"
    band-caveat ........ "n={attempts} — interval {lo}–{hi}", only below n=30
Miss tendency (MissTendencyGrid)
  mt-heading ........... h2 "Miss tendency", id="miss-tendency-title"
  mt-intro ............. capture-discipline paragraph
  mt-empty ............. "No real-time misses in completed visible sessions yet."
  mt-coverage .......... "Zone captured for {n} of {m} real-time misses ({pct})."
  mt-nozones ........... "Turn on Diagnostic during a live session to populate the heat grid."
  Band (repeats; bands with zero zoned misses are filtered out)
    mtb-label .......... h3, band label + "{zoned}/{total} zoned"
    mtb-pattern ........ "Repeated pattern: <zones> ({n} misses)" or
                         "No repeated three-miss vector yet."
    mtb-grid ........... 9 cells, opacity 0.1 + share*0.25; aria-label per cell
    mtb-caveat ......... "Small sample: n={n}. Counts are evidence, not coaching."
Putter comparison (PutterComparison)
  pc-heading ........... h2 "Physical putter comparison", id="putter-comparison-title"
  pc-intro ............. adjusted-delta explanation
  pc-empty ............. "No real-time attempts in completed visible sessions yet."
  pc-coverage .......... "Physical disc captured for {n} of {m} real-time attempts ({pct})."
  pc-notready .......... "Use at least two selected physical putters to unlock a comparison."
  Card (repeats, most attempts first)
    pcc-name ........... h3, "{nickname} · {mold}" or the mold alone
    pcc-role ........... status chip from discs.role
    pcc-overall ........ "{pct}" + "{makes}/{attempts} overall"
    pcc-delta .......... shared-distance delta or "—", with n
    pcc-caveat ......... overall 95% interval, only below n=30
    pcc-needs .......... "Needs 10 attempts at distances shared with another disc."
    pcc-evidence ....... <details> "Distance evidence (n)" with per-band rows
Experiments (ExperimentMarkerPanel)
  ex-heading ........... h2 "New-putter experiments", id="experiment-marker-title"
  ex-intro ............. before/after methodology paragraph
  ex-form ............. disc select, datetime-local, label, notes, submit
  ex-error ............ inline form error
  ex-empty ............ "No experiment markers yet."
  Card (repeats, newest first)
    exc-label .......... h3, marker label
    exc-ready .......... "Evidence ready" chip
    exc-result ......... before %, after %, delta — only when ready
    exc-needs .......... "Needs 10 attributed attempts before and after this marker."
    exc-caveat ......... before/after intervals, shown while either side is below n=30
    exc-notes .......... optional free text
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Practice Insights` | — | — | — | always |
| `hdr-practice` | link | `Practice menu` | default / pressed | navigate | `/practice` | always |
| `dc-intro` | paragraph | interpolates `pct(LOCK_IN_LOWER_BOUND)` → `70%` | — | — | — | always. The one place the app explains its own statistical policy to the user |
| `dc-empty` | text | `No putts logged yet — the map fills in as you practice.` | — | — | — | `bands.length === 0` |
| `band-zone` | text | `Lock-in` / `Developing` / `Coin-flip` | three states | — | — | `classifyZone(interval.lower, interval.upper)`: `lower >= 0.7` → lock-in; `lower <= 0.5 && upper >= 0.5` → coin-flip; else developing. **Classified from the interval, never from the point estimate** |
| `band-interval` | bar | — | — | — | — | `left: lower×100%`, `width: (upper − lower)×100%` |
| `band-point` | marker | — | — | — | — | `left: makePct×100%` |
| `band-caveat` | text | `n={attempts} — interval {lo}–{hi}` | present / absent | — | — | only when `attempts < WILSON_MIN_N_FOR_HIDING` (30). Uncertainty is surfaced precisely when the number is weakest |
| `mt-coverage` | text | `Zone captured for {n} of {m} real-time misses ({pct}).` | — | — | — | always inside the non-empty branch. Names its own denominator rather than presenting a bare percentage |
| `mtb-pattern` | text | `Repeated pattern: {zones} ({n} misses)` or `No repeated three-miss vector yet.` | pattern / no pattern | — | — | a zone must reach `MISS_TENDENCY_MIN_PATTERN_MISSES` (3) to be named. **This is the intervention threshold** — see § 5 |
| `mtb-grid` | 3×3 grid | zone label + count per cell | — | — | — | opacity `0.1 + share × 0.25`, `0` at zero count; each cell carries `aria-label="{zone}: {count}"` |
| `mtb-caveat` | text | `Small sample: n={n}. Counts are evidence, not coaching.` | present / absent | — | — | when the band's zoned misses are below 30. The copy states the house rule out loud |
| `pcc-delta` | stat | `+4 pts` / `-3 pts` / `—` | value / null | — | — | `null` until `sharedBandAttempts >= PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS` (10). Compares each disc against the **pooled** result at distances both discs actually played, so a disc used only at 15 ft cannot beat one used only at 33 ft |
| `pc-notready` | text | `Use at least two selected physical putters to unlock a comparison.` | present / absent | — | — | `rows.length < 2` |
| `pcc-evidence` | disclosure | `Distance evidence ({n})` | collapsed / expanded | native `<details>` | — | always; per-band rows carry their own sub-30 intervals |
| `ex-form` disc select | select | `Physical putter`, options `{nickname} · {mold}` | — | `setDiscId` | local | `required`; options are **all discs** not `lost`/`retired`/`sold` — not only putters, despite the label |
| `ex-form` effective-at | datetime-local | `Started using it` | — | `setEffectiveAt` | local | `required`; defaults to now in local time |
| `ex-form` label | text | `Marker label`, default `New putter` | — | `setLabel` | local | `maxLength 120`; empty falls back to `New putter` |
| `ex-form` notes | textarea | `Notes` + `optional` | — | `setNotes` | local | `maxLength 1000`; empty becomes `null` |
| `ex-submit` | button | `Save experiment marker` / `Saving…` | idle / saving / disabled | direct `supabase.from('practice_experiment_markers').insert(...)` | `practice_experiment_markers` | disabled while saving or when `discId` matches no eligible disc |
| `exc-ready` | chip | `Evidence ready` | present / absent | — | — | both sides have at least `EXPERIMENT_MIN_SIDE_ATTEMPTS` (10) attributed attempts |
| `exc-result` | stat trio | before %, after %, delta | present / absent | — | — | only when ready; otherwise `exc-needs` explains what is missing |
| `exc-caveat` | text | before/after 95% intervals | present / absent | — | — | while either side is below n=30; renders `—` for a `null` interval, which is how the `attempts <= 0` case is handled |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Everything on the screen | `fetchPracticeInsights(user.id)` | `lib/history` | Supabase + Dexie mirror | async |
| Distance samples | `distanceSamples(data)` | `lib/history` | — | **pure** |
| Confidence bands | `confidenceMap(samples)` | `lib/insights` | — | **pure** |
| Miss distribution | `missTendency(data.puttEvents)` | `lib/insights` | — | **pure** |
| Putter head-to-head | `putterComparison(data.puttEvents, data.discs)` | `lib/insights` | — | **pure** |
| Experiment before/after | `experimentComparison(data.experimentMarkers, data.puttEvents, data.discs)` | `lib/insights` | — | **pure** |
| Thresholds | `WILSON_MIN_N_FOR_HIDING`, `LOCK_IN_LOWER_BOUND`, `MISS_TENDENCY_MIN_PATTERN_MISSES`, `PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS`, `EXPERIMENT_MIN_SIDE_ATTEMPTS` | `lib/insights` | — | consts |

Signatures in `LIB_API_INDEX.md`. Four `useMemo`s derive the four panels from one fetch; the page issues
exactly one network round of work on mount and one more if a marker is created.

**`fetchPracticeInsights` is the only read in the app that filters for metric eligibility.**
`history.js:102` wraps `fetchHistory` in `metricEligibleHistory`, which keeps only activities that are
`completed` **and** not hidden, then narrows sessions, runs, and the subsequent `putt_events` queries to
those ids (`history.js:74-85, 101-124`). Every other PLAY screen computes over unfiltered history. This
is why the panel copy can honestly say "completed visible sessions."

Note the codebase contains a *second*, different eligibility rule —
`isMetricEligibleActivity` in `src/lib/metrics/registry.js:100-103`, which admits `incomplete`
activities and additionally requires `has_meaningful_fact`. It has no production callers. The two rules
disagree; `_corrections/play-screens.md` P-9.

### The house statistical discipline, as implemented here

This screen is where the project's statistical rules are most visible, and they are worth stating
precisely because every other analytics surface should follow them:

1. **`wilsonInterval(makes, attempts)` returns `null` when `attempts <= 0`** (`insights/wilson.js:6`).
   Callers must handle it. On this screen: `confidenceMap` never produces a zero-attempt band
   (`confidenceMap.js:31` skips them), `missTendency` passes `null` through explicitly
   (`missTendency.js:35`), and `ExperimentMarkerPanel.jsx:61` renders `—` for a null interval. Nothing
   dereferences it.
2. **Classification uses the interval, not the point estimate.** `classifyZone`
   (`confidenceMap.js:20-24`) promotes a band to `lock-in` only when its *lower* bound clears 70%. A
   3-for-3 band reads 100% and is still `coin-flip`. The intent is written into the code comment and
   restated to the user in `dc-intro`.
3. **The interval is shown when the sample is weak, not hidden.** `WILSON_MIN_N_FOR_HIDING = 30` is a
   *display* threshold: below it, the band, the putter card, the per-distance row, and the experiment
   card all print their interval alongside the percentage.
4. **Coaching requires a pattern, never a single event.** `MISS_TENDENCY_MIN_PATTERN_MISSES = 3` gates
   `mtb-pattern`; below it the copy reads `No repeated three-miss vector yet.` and, when the sample is
   small, `Counts are evidence, not coaching.` This is `AGENTS.md:284`'s intervention threshold — "never
   surface coaching feedback off a single event; require a statistically meaningful pattern (e.g. ≥3
   consecutive same-vector misses)" — implemented literally.
5. **Batch totals never become direction data.** `missTendency` and `putterComparison` read only
   `putt_events`, which exist for real-time capture only; both panels lead with a coverage line naming
   how many attempts were actually attributed. This is `PHASE_A_ARCHITECTURE.md` § 5's capture split
   ("Never synthesize per-putt sequence, timing, streak, miss-zone, or putter attribution from batch
   totals").
6. **Comparisons are like-for-like.** `putterComparison`'s delta uses only bands where two or more discs
   both played, and expects each band's pooled rate (`putterComparison.js:48-57`) — so the number answers
   "better at the same distances," not "used at easier distances."

### Writes

| Mutation | Call | Idempotency key | Transaction boundary |
|---|---|---|---|
| Create an experiment marker | `supabase.from('practice_experiment_markers').insert(marker)` (`ExperimentMarkerPanel.jsx:37`) | `idempotency_key: crypto.randomUUID()` — a fresh UUID per submit, so it **deduplicates nothing** | Single statement; no repository, no outbox, no Dexie transaction |

`practice_experiment_markers` carries `unique (user_id, idempotency_key)`
(`20260716230000_phase_d4_experiment_markers.sql:25`) — a real exactly-once guard that the client
defeats by generating a new key on every attempt. A double submit creates two markers. Markers are
append-only by design ("immutable ... evidence boundaries", migration header): there is **no delete or
edit control anywhere in the app**, so a mistaken marker is permanent and permanently reshapes every
before/after window after it.

On success the panel calls `onCreated`, which refetches `fetchPracticeInsights` wholesale
(`ConfidenceMapPage.jsx:94`).

This is a raw Supabase write, so `PHASE_A_ARCHITECTURE.md` § 14's contract does not apply and is not met.

### Offline

**Not offline-capable in either direction.** `fetchPracticeInsights` awaits Supabase directly with no
cache fallback, so the screen renders the full-page error offline; the marker insert has no outbox, so it
simply fails. None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 renders anywhere on this
screen — there is no sync indicator at all.

## 6. Flow paths

**Happy path.** Arrive from the `play-root` chart icon → `Loading...` → four panels render → read the
bands, expand a putter's distance evidence, add an experiment marker → the page refetches and the marker
appears.

**First run / empty.** Every panel has its own empty state and they are unusually well written:
`No putts logged yet — the map fills in as you practice.`,
`No real-time misses in completed visible sessions yet.`,
`No real-time attempts in completed visible sessions yet.`, and `No experiment markers yet.` The
experiment form still renders and is usable — but its disc `<select>` will be empty for a user with no
discs, and `ex-submit` is then disabled with no explanation of why.

**Partially-populated.** The screen's most common real state, and the one it handles best: bands exist
but sit in `coin-flip` with visible intervals; misses are recorded but unzoned, so `mt-nozones` explains
how to fix that (`Turn on Diagnostic during a live session`); one putter is attributed so `pc-notready`
explains that two are needed; a marker exists but `exc-needs` names the 10-attempt requirement. Each
panel says what is missing and how to get it. This is the model for empty-state copy elsewhere in the
app.

**Error.** A `fetchPracticeInsights` rejection renders `<p class="form-error">{message}</p>` **as the
entire page** (`ConfidenceMapPage.jsx:34`) — no header, no retry. The refetch after creating a marker
routes into the same state, so a transient failure there replaces a page the user was reading.
A marker *insert* failure is handled better: `ExperimentMarkerPanel.jsx:38,55` renders it inside the form
and preserves the entered values.

**Offline.** As § 5: full-page error.

**Auth / guard.** `ProtectedRoute` gates the shell; `user.id` is dereferenced on mount
(`ConfidenceMapPage.jsx:26`) and passed to `ExperimentMarkerPanel` for the marker's `user_id`. No
anonymous path.

**Interlock.** **N/A** — no cap. The five thresholds on this screen are *evidence* gates, not
interlocks: they withhold a claim rather than blocking an action.

**Destructive.** **N/A** — nothing on this screen deletes. Worth noting the inverse risk: marker
creation is irreversible with no confirmation, which is a one-way action even though it is not a
destructive one. See § 12.

`STATE_MATRIX.md` does not exist (`_corrections/play-screens.md` P-10), so these states are described
inline.

## 7. Dependencies

### Schema

`activities` (via `fetchHistory` → `metricEligibleHistory`: only `completed`, non-hidden rows survive),
`putt_sessions` + `putt_distance_logs`, `putting_regimen_runs` + `putting_regimen_run_sets` +
`putting_regimen_sets` (range midpoints become distance samples), and:

`putt_events` — `id`, `regimen_run_id`, `freeform_session_id`, `outcome`, `miss_zone`, `distance_ft`,
`occurred_at`, `putter_disc_id`. `miss_zone` holds 1–9 per `MISS_ZONES`
(`src/lib/gestureEngine/missZones.js`); `putter_disc_id` is the Layer 1 attribution column.

`discs` + `disc_molds` — `id`, `nickname`, `manufacturer`, `mold`, `plastic`, `role`, `status`,
`moldInfo`.

`practice_experiment_markers` — introduced by `20260716230000_phase_d4_experiment_markers.sql`:
`id`, `user_id`, `disc_id` (FK to `discs`), `marker_type` (CHECK: only `'new_putter'`), `effective_at`,
`label` (CHECK: 1–120 trimmed chars), `notes` (CHECK: 1–1000 when present), `created_at`,
`idempotency_key`, `unique (user_id, idempotency_key)`. Select and insert policies are owner-scoped;
**there is no update or delete policy**, which is what makes markers immutable.

### Library

`lib/history` (`fetchPracticeInsights`, `distanceSamples`), `lib/insights` (`confidenceMap`,
`missTendency`, `putterComparison`, `experimentComparison`, plus five threshold constants),
`lib/gestureEngine/missZones` transitively, `lib/supabaseClient` (direct, inside
`ExperimentMarkerPanel`). Signatures in `LIB_API_INDEX.md`.

### Components

`MissTendencyGrid`, `PutterComparison`, `ExperimentMarkerPanel`. All three are single-consumer components
used only here. Details in `COMPONENT_LIBRARY.md`.

The distance-confidence panel is **not** a component — it is inline JSX
(`ConfidenceMapPage.jsx:46-87`), unlike its three siblings.

### Screens

Reached only from `play-root`. Depends on capture quality from `freeform-active` and `regimen-active`
(diagnostic mode and putter selection determine how much of this screen has data) and on the DISCS
section for disc identity and `role`.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 5 (metric registry, and the capture split this screen honours), § 12, § 13.
`AGENTS.md` § Documentation conventions — the intervention threshold at `AGENTS.md:284`.
`SCREEN_SPECS.md` Screen 10 and `_corrections/screen-specs-and-agents.md` C-2. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Good — every panel is a labelled landmark.** `MissTendencyGrid`, `PutterComparison`, and
  `ExperimentMarkerPanel` each use `<section aria-labelledby="…-title">` with a matching `<h2 id>`.
  This is the best sectioning in the codebase.
- **Good — heat-grid cells carry text alternatives.** Each cell has
  `aria-label="{zone label}: {count}"` (`MissTendencyGrid.jsx:28`) and also renders the label and count
  visually, so the chart is not opacity-only. `PHASE_A_ARCHITECTURE.md` § 12 requires text alternatives
  for charts; this panel meets it.
- **Good — `pcc-evidence` uses native `<details>`**, which is keyboard-accessible and announced without
  custom ARIA.
- **Good — the form fields in `ExperimentMarkerPanel` are wrapped in `<label>` elements**, so each
  control has a programmatic name.
- **Gap — two `<h1>`s with identical text.** Shell renders `<h1>Practice Insights</h1>`; the page renders
  `<h1>Practice Insights</h1>` (`ConfidenceMapPage.jsx:40`). `_corrections/play-screens.md` P-7.
- **Gap — the confidence band chart has no text alternative for its geometry.** `band-interval`,
  `band-point`, and `band-midline` are absolutely positioned `<div>`s with inline percentage styles, no
  `role`, no `aria-label`, and no `<title>`. The *numbers* are present in `band-counts` and
  `band-caveat`, so no information is strictly lost — but the caveat, and therefore the interval, is
  hidden above n=30, at which point a screen-reader user gets the point estimate and the zone word with
  no interval at all. This is the one panel that does not meet § 12's chart-alternative rule.
- **Gap — the zone word is the only non-color signal of confidence.** `zone-{lock-in|developing|coin-flip}`
  classes color the band; the word `Lock-in` is present, so it is not color-only — but the *bar geometry*,
  which is the actual argument, is visual-only.
- **Gap — `hdr-practice` and the shell back control both go to `/practice`** (redundant), and the only
  route *into* this screen is an icon-only link with no accessible name
  (`PracticeMenuPage.jsx:145` — see `screens/play-root.md` § 8). A screen-reader user has no discoverable
  path here.
- **Gap — no `aria-live` on the refetch.** After saving a marker the whole page re-renders with no
  announcement.

## 9. Events and telemetry

**Metrics.** This is the app's densest metric surface. Mapping to
`PHASE_A_ARCHITECTURE.md` § 5's registry (`src/lib/metrics/registry.js`):

| Readout | Registry key | Declared confidence | Honoured? |
|---|---|---|---|
| Confidence bands | `putting.make_pct` | `wilson_below_30` | Yes — and extended: the *zone* is derived from the interval, which the registry does not describe |
| Miss tendency | `putting.miss_tendency` | `minimum_pattern_threshold`, `minimumSamples: 3`, `captureRequirement: ORDERED_EVENTS_REQUIRED`, sources limited to `live_capture` and `sensor` | Yes — `MISS_TENDENCY_MIN_PATTERN_MISSES` is 3 and only `putt_events` feed it |
| Putter comparison | **no registry entry** | — | `PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS` is an undeclared threshold |
| Experiment before/after | **no registry entry** | — | `EXPERIMENT_MIN_SIDE_ATTEMPTS` is an undeclared threshold |

Two of the four panels compute metrics the registry does not define, and **the registry is not consulted
at runtime anywhere in the app** — `metricDefinition`, `sourceIsAccepted`, `summariesAreAdequate`, and
`filterMetricEligibleActivities` have no production callers. § 5 says "Define version-controlled
JavaScript metric definitions before database materialization"; the definitions exist and are tested, but
nothing enforces them. `_corrections/play-screens.md` P-9.

**Notifications.** None produced or consumed. The `coaching` notification category exists in the schema
CHECK (`20260712213000_phase_a_notifications.sql:13`) and in
`NOTIFICATION_PREFERENCE_CATEGORIES` (`notificationPreferences.js:8` — "Pattern-supported practice
suggestions"), and this screen is where such a pattern would be detected. Nothing produces one today.

**Lifecycle events.** None written. Creating an experiment marker writes a row to
`practice_experiment_markers` with no lifecycle or audit event — it is evidence metadata, not an
activity.

## 10. Tests

### Existing coverage

`src/lib/insights/insights.test.js` (Wilson, `confidenceMap`, `classifyZone`),
`src/lib/insights/missTendency.test.js`, `src/lib/insights/putterComparison.test.js`,
`src/lib/insights/experimentComparison.test.js`, `src/lib/history.test.js` (`metricEligibleHistory`),
`src/lib/metrics/registry.test.js`. Confirmed by reading imports; matches the `TEST_MAP.md` § PLAY row
and adds `insights/experimentComparison`, `history`, and `metrics/registry`.

The statistics layer is thoroughly tested — four dedicated suites for four panels. **There is no
component or page test for `ConfidenceMapPage.jsx`, `MissTendencyGrid.jsx`, `PutterComparison.jsx`, or
`ExperimentMarkerPanel.jsx`,** so nothing asserts that the interval bar's geometry matches the interval
it claims to draw, or that the marker insert carries the right columns.

### Acceptance criteria

1. A band with 3 makes from 3 attempts reads `100%` and is classified `Coin-flip`, not `Lock-in`.
2. A band's zone flips to `Lock-in` only once its Wilson lower bound reaches 0.7.
3. A band below 30 attempts shows its interval; at or above 30 it does not.
4. A miss zone with 2 misses produces `No repeated three-miss vector yet.`; a third miss names the
   pattern.
5. Bands with zero zoned misses are omitted from the heat list entirely.
6. A putter with fewer than 10 shared-band attempts shows `—` for its delta plus the explanatory line.
7. With one attributed putter, `Use at least two selected physical putters…` renders.
8. An experiment with 9 attempts on either side is not `ready` and shows the requirement.
9. Hidden and incomplete activities contribute nothing to any panel.
10. A batch-entered session contributes to the confidence map (summary-adequate) but to neither the miss
    grid nor the putter comparison (ordered events required).
11. **Known failing:** a double-tapped `Save experiment marker` creates two markers.

### E2E critical paths

Record real-time putts with diagnostic capture and a selected putter → open `/practice/stats` → verify
coverage lines, band zones, and the heat grid. Record the same volume by batch entry → verify the
confidence map fills but the miss and putter panels stay empty with their coverage copy. Hide an activity
→ verify every panel's numbers drop. Create an experiment marker, record putts on both sides → verify the
before/after unlocks at 10 attempts per side. Attempt a load offline → verify a comprehensible state
(fails today). No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9).

## 11. Tasks

#### T-practice-stats-1 — Add a retry to the load error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/ConfidenceMapPage.jsx`
- **Done when:** A failed `fetchPracticeInsights` renders the error plus a `Retry` control that re-runs
  the fetch, and a failed post-marker refetch leaves the already-rendered panels in place.
- **Verify:** `npm test` with a page-level test that rejects the fetch once then resolves.
- **Commit:** `fix: allow retry when practice insights fail to load`

#### T-practice-stats-2 — Reconcile the two metric-eligibility rules

- **Capability:** `pure-logic`
- **Touches:** `src/lib/history.js`, `src/lib/metrics/registry.js`
- **Done when:** One function decides metric eligibility. Either `metricEligibleHistory` delegates to
  `filterMetricEligibleActivities`, or `PHASE_A_ARCHITECTURE.md` § 5 records that the registry is
  descriptive-only for Phase A and the registry's helpers are removed. The decision covers both the
  `incomplete` question and the `has_meaningful_fact` question.
- **Verify:** `npm test`; `grep -rn "isMetricEligibleActivity" src/` shows a production caller or no
  definition at all.
- **Commit:** `fix: one metric eligibility rule`
- **Blocked by:** § 12 open question 2. See `_corrections/play-screens.md` P-9.

#### T-practice-stats-3 — Make the experiment marker insert idempotent

- **Capability:** `data-access`
- **Touches:** `src/components/ExperimentMarkerPanel.jsx`
- **Done when:** `idempotency_key` is derived from the form's own content (disc, `effective_at`, label)
  and stays stable across retries of the same submission, so the existing
  `unique (user_id, idempotency_key)` constraint actually prevents duplicates; a duplicate submission
  reports "already recorded" rather than creating a second marker.
- **Verify:** `npm test` with a component-level or repository-level test asserting one row after two
  submits.
- **Commit:** `fix: make experiment markers exactly-once`

#### T-practice-stats-4 — Give the confidence bands a text alternative

- **Capability:** `ui-routine`
- **Touches:** `src/pages/ConfidenceMapPage.jsx`
- **Done when:** Each band exposes its interval to assistive tech regardless of sample size — e.g.
  `role="img"` with an `aria-label` naming the band, the point estimate, the interval, and the zone —
  satisfying `PHASE_A_ARCHITECTURE.md` § 12's chart-alternative rule. Visual output unchanged.
- **Verify:** `npm run lint` plus a VoiceOver pass on `/practice/stats` with bands above and below n=30.
- **Commit:** `fix: describe confidence bands to assistive tech`

#### T-practice-stats-5 — Give this screen a discoverable entry point

- **Capability:** `ui-routine`
- **Touches:** `src/pages/PracticeMenuPage.jsx`, and/or `src/pages/HistoryPage.jsx`,
  `src/pages/CareerHubPage.jsx`
- **Done when:** `/practice/stats` is reachable from at least one text-labelled link, and the existing
  icon-only shortcut has an `aria-label`.
- **Verify:** manual pass; `grep -rn "practice/stats" src/pages/` shows more than one entry point.
- **Commit:** `feat: make practice insights discoverable`

## 12. Open questions

1. **Extract the confidence-band panel into a component.** Three of the four panels are components; the
   band list is inline. If Screen 10's Analytics surface is ever reconsidered (see § 13), the band list
   is the piece that would need to move.
2. **Should incomplete activities contribute evidence?** The registry says yes (`incomplete` is not in
   any `exclusions` list); `metricEligibleHistory` says no. Two rules exist and only one runs.
   `_corrections/play-screens.md` P-9; task `T-practice-stats-2`.
3. **Experiment markers are permanent with no confirmation.** No delete or edit policy exists on
   `practice_experiment_markers`, and no UI offers one. A mis-dated marker permanently mis-slices every
   before/after window after it. Should marker creation confirm, or should a soft-delete policy be added?
4. **The experiment form says "Physical putter" but lists every disc.**
   `ExperimentMarkerPanel.jsx:19` filters only on `status`, not on `role` or category. A user can mark a
   driver as a new putter.
5. **Two panels compute thresholds the metric registry does not declare.** `putterComparison` and
   `experimentComparison` have no `METRIC_DEFINITIONS` entries, so their minimum-sample and confidence
   behavior is not version-controlled the way § 5 requires.
6. **This screen has no sync or offline indicator at all**, unlike `practice-history` and
   `practice-history-detail`. A user cannot tell whether they are looking at stale numbers.
7. `_corrections/screen-specs-and-agents.md` C-2 (Screens 10 and 11 never shipped as standalone
   destinations) and `_corrections/play-screens.md` P-7, P-9, P-10 all touch this screen.

## 13. Blueprint divergence

Blueprint Screen 10 is *Global Analytics & Settings Control Tower*
(`MASTER_PROJECT_BLUEPRINT.md:574-640`). `SCREEN_SPECS.md:264-287` expected `ConfidenceMapPage` to
**embed as a panel** inside that tower — "this screen is its expansion, moves under the STATS tab." The
tower was never built and the STATS tab does not exist (standing divergence #5). The confidence map
therefore stayed a standalone destination and absorbed three additional panels that the blueprint did not
draw at all.

That non-construction is already logged as `_corrections/screen-specs-and-agents.md` C-2 (the
`SCREEN_SPECS.md:38-39` status table still marks Screens 10 and 11 `IN SCOPE` while the note eighteen
lines above says their content is distributed). Not re-logged here.

Where the tower's content actually went:

| Blueprint Screen 10 feature | Shipped location |
|---|---|
| Time-series accuracy chart with 7/30/90-day chips | **Not built.** No time-series windowing function exists in `lib/insights/` |
| Equipment-milestone ★ injections on the trend chart | **Reinterpreted.** `practice_experiment_markers` + `experimentComparison` deliver the same *question* ("did the gear change help?") as a before/after panel rather than as chart annotations — arguably a stronger answer, since it reports an interval instead of a visual correlation |
| Dexie/Supabase sync ledger, `[ 🔄 SYNC NOW ]` | `settings` and the per-row sync badges on `practice-history` / `practice-history-detail` |
| Behavioral toggles (units, stack size, haptics) | `settings` (`/profile/settings`) |
| CSV export, zipped | `settings` — Phase E1 shipped the export slice there rather than blocking on the tower (`SCREEN_SPECS.md:281-284`) |
| 2-step `[ CLEAR CACHE ]` | `settings`, via `localPurge` |
| `[ ⌚ WEARABLES HUB ]` shortcut | Parked with Screen 16 (hardware) |
| Embedded confidence-map panel | **This screen, standalone** |
| — | **Added, with no blueprint counterpart:** miss-tendency heat grid, physical putter comparison, and the experiment marker panel — all three shipped in Phase D4 |

Standing divergences #1 (React/Vite) and #5 (four tabs, no STATS tab) apply; see `SCREEN_SPECS.md`.

The practical consequence for a reader of `SCREEN_SPECS.md`: its Screen 10 REUSE line describes embedding
this page into a screen that does not exist, and its NET-NEW list describes a time-series chart that was
never built — while omitting the three panels that were. `SCREEN_INVENTORY.md` § "Not in this inventory"
already records the disposition correctly.
