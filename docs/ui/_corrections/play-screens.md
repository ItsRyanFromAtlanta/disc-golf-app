# Corrections — PLAY section screens

Contradictions found while writing the eight PLAY screen documents (`play-root`, `regimen-select`,
`routine-builder`, `practice-history`, `practice-history-deleted`, `practice-history-detail`,
`practice-stats`, `notifications`). **Recorded, not applied** — `docs/ui/README.md` § Working rules 5.

Verified against `7351964` (`src/` unchanged since `eb9fd2b`).

Already logged elsewhere and **not** repeated here:

- `ModeCard` is dead while `PracticeMenuPage` inlines its markup — `_corrections/component-library.md` § 2.
- Screens 10 and 11 never shipped as standalone destinations — `_corrections/screen-specs-and-agents.md` C-2.

---

## P-1 — `putting_regimens.total_putts` does not exist; the 100-putt ceiling is a row trigger

**Where:** `SCREEN_SPECS.md:212-213` (Screen 7 → Dependency) and `SCREEN_SPECS.md:76-77` (standing
divergence #6).

**Claims:**

> **Dependency:** Layer 1 schema — `putting_regimens.created_by`, `drill_type`, `rules_config jsonb`
> …, `total_putts` CHECK ≤ 100.

> **Interlocks:** both hard, as specified — 100-putt routine ceiling and 35-disc bag capacity, each
> with app-side disabling AND a DB `CHECK` constraint.

**Reality:**

- There is **no `total_putts` column** on `putting_regimens` or anywhere else. `grep -rn total_putts`
  across `*.sql`, `*.js`, `*.jsx` returns nothing. The columns Layer 1 actually added are `user_id`,
  `drill_type`, `rules_config`, and `archived` (`layer1_foundation_schema.sql:85-92`). `created_by`
  does not exist either — ownership is `user_id`.
- A `CHECK` constraint cannot express this rule: the ceiling is a **sum across sibling rows**
  (`sum(reps_required)` over one regimen's `putting_regimen_sets`), which row-level `CHECK` cannot see.
- What ships is a `BEFORE INSERT OR UPDATE … FOR EACH ROW` trigger,
  `regimen_sets_putt_cap_check` → `enforce_routine_putt_cap()`
  (`layer1_foundation_schema.sql:255-290`). It locks the parent regimen, **exempts system regimens**
  (`user_id is null` returns early — the fixed five and the classic drills are curated and can exceed
  100), sums the other sets, and raises with `errcode = 'check_violation'`.
- The same shape governs the 35-disc bag cap: `bag_discs_capacity_check` →
  `enforce_bag_capacity()` (`layer1_foundation_schema.sql:230-253`), also a trigger, also raising
  `check_violation`.

**Why it matters:** the observable *error code* is `23514`, which is why
`src/lib/regimens.js:44` tests `setsError.code === '23514'`. So "acts like a CHECK" is true; "is a
CHECK" is not. An agent told to "find the `total_putts` CHECK" will find nothing and may add a
redundant — and unenforceable — constraint. This also answers open question 1 in
`screens/disc-detail.md` § 12 ("bag capacity is not enforced here … needs verification against the live
constraint"): it **is** enforced, by `bag_discs_capacity_check`, and a violation surfaces to the user as
a raw Postgres exception message because no caller maps it.

**Proposed edit:** in `SCREEN_SPECS.md`, replace `total_putts` CHECK ≤ 100 with the trigger name and
its system-regimen exemption, and soften standing divergence #6 from "DB `CHECK` constraint" to
"database-enforced (row trigger raising `check_violation`)".

---

## P-2 — The app-side 100-putt interlock gates `Add next stage` but not `Save`

**Where:** `SCREEN_SPECS.md:208-209` ("100-putt totalizer + hard-disable interlock on
`[ ➕ ADD NEXT STAGE ]`") and `MASTER_PROJECT_BLUEPRINT.md:426` ("If a stage push exceeds 100 putts,
the `[ ➕ ADD NEXT STAGE ]` button dynamically disables").

**Claims:** the ceiling is enforced app-side.

**Reality:** it is enforced on exactly one control. `canAddStage()`
(`src/lib/routineBuilder.js:44-49`) disables `Add next stage`, and
`RoutineBuilderPage.jsx:99,150-153` wires it. But:

- `StageCard`'s putt stepper (`src/components/routineBuilder/StageCard.jsx:29-33`) is a free
  `ChipGroup` over `PUTT_OPTIONS = [5, 10, 15, 20]` with **no cap awareness**. Raising an existing
  stage from 10 to 20 putts is unguarded.
- `RoutineBuilderPage.jsx:160-162` explicitly renders the over-ceiling state —
  `<span className={putts > MAX_PUTTS ? 'form-error' : ''}>` — proving the state is reachable.
- `saveDisabled` (`RoutineBuilderPage.jsx:100`) is `saving || !name.trim() || stages.length === 0`.
  **It does not consider `putts`.** Both `Save & Launch` and `Save for later` stay enabled at 200 putts.

Reproduction: ten stages × 10 putts (allowed — `canAddStage` permits landing exactly on 100), then tap
`20` on each stage → 200 / 100 putts, red totalizer, Save enabled.

**Consequence:** the only remaining guard is the database trigger from P-1, and P-3 below records why
that guard's behavior against this particular write is unverified.

**Proposed edit:** none to a document — this is a code gap. Filed as
`T-routine-builder-1` in `screens/routine-builder.md` § 11.

---

## P-3 — The putt-cap trigger's behavior on a multi-row insert is unverified

**Where:** `src/lib/regimens.js:37-48` against `layer1_foundation_schema.sql:257-290`.

**Observation, not yet a proven defect.** `createCustomRegimen` inserts every set row in **one
statement**:

```js
const setsPayload = sets.map((s) => ({ ...s, regimen_id: created.id }))
const { error: setsError } = await supabase.from('putting_regimen_sets').insert(setsPayload)
```

`enforce_routine_putt_cap()` is a `BEFORE … FOR EACH ROW` trigger whose check is a `SELECT
sum(reps_required) … where regimen_id = new.regimen_id and id <> new.id`. Whether the rows already
processed by the *same* `INSERT` statement are visible to that `SELECT` depends on PostgreSQL
intra-statement visibility (command-counter/snapshot semantics inside a PL/pgSQL trigger). If they are
not visible, every row is checked in isolation against zero prior reps, and a routine of ten 20-putt
stages inserts cleanly at 200 planned putts — the ceiling silently does not hold for the exact write
path the builder uses.

There is **no test either way**: `src/lib/routineBuilder.test.js` covers only the pure `canAddStage`
guard, and no SQL/negative test exercises the trigger.

**Proposed action:** run the negative case against a real Postgres (a single multi-row insert summing
to >100 for a `user_id`-owned regimen). If it succeeds, the trigger must become a `CONSTRAINT TRIGGER
… DEFERRABLE INITIALLY DEFERRED` or a statement-level `AFTER` trigger. Filed as
`T-routine-builder-2`.

---

## P-4 — `/notifications` has no in-app entry point

**Where:** `SCREEN_INVENTORY.md:37-38` and `NAVIGATION_MAP.md:138-140`.

**Claims:**

> `notifications` carries `section: 'play'` but sits outside the `/practice` tree — it is the shared
> notification destination **reachable from the global header**.

**Reality:** the global header bell does not navigate. `GlobalHeader.jsx:22-30` renders a
`<button onClick={onNotifications}>`; `AppShell.jsx:95-110` handles it by calling
`setSheet({ title: 'Notifications', content: <NotificationSheet … /> })`. Nothing anywhere in `src/`
links or navigates to `/notifications` — the only non-test occurrences of the string are the route
definition (`App.jsx:68`), the route metadata regex (`routeMetadata.js:84`), and this correction's
subject line. `notificationDestination()` (`src/lib/notifications.js:24-30`) routes notifications to
`/practice/history/*` and `/profile`, never to `/notifications`.

The route is therefore reachable only by typed URL, bookmark, or an external deep link.

**Why it matters:** `PHASE_A_ARCHITECTURE.md:206-208` lists `/notifications` among canonical
destinations, so the route is contractually required to exist — but the shipped app treats the sheet
as the only surface. Both statements above describe an entry point that is not wired.

**Proposed edit:** correct `SCREEN_INVENTORY.md:37-38` and `NAVIGATION_MAP.md` § Sheet layer to say the
bell opens the sheet and the page is a deep-link/fallback destination, **or** wire an entry point (a
"See all" affordance in the sheet is the obvious one). Filed as `T-notifications-1`.

---

## P-5 — `SCREEN_SPECS.md` says `RegimenSelectPage` folds into the launchpad; both shipped

**Where:** `SCREEN_SPECS.md:204-205` (Screen 7 → REUSE).

**Claims:**

> `src/pages/RegimenSelectPage.jsx` (folds into Screen 4's 3-way launchpad rather than staying a
> standalone page).

**Reality:** the 3-way launchpad shipped on `PracticeMenuPage` (`PracticeMenuPage.jsx:203-234`) **and**
`RegimenSelectPage` remains a live standalone route: `routeMetadata.js:162-171` (id `regimen-select`,
title `Select Routine`), `App.jsx:72`, plus the legacy alias `/regimens` → `/practice/regimens`
(`routeMetadata.js:320-322`, `App.jsx:111`). It is linked from `PracticeMenuPage.jsx:247`.

The two surfaces group the same rows by **different rules**: the launchpad splits system vs. own
non-archived (`PracticeMenuPage.jsx:126-127`); `regimen-select` groups by `drillGroupLabel()` into
Classic drills / Scored regimens / Custom routines (`RegimenSelectPage.jsx:16-18`). Neither is a subset
of the other, so this is duplication rather than an unfinished migration.

**Proposed edit:** change the REUSE line to record that both shipped, and record which one is
canonical for launching a routine.

---

## P-6 — `RegimenSelectPage` does not filter archived routines

**Where:** `src/pages/RegimenSelectPage.jsx:16-18` against `src/pages/PracticeMenuPage.jsx:127` and
`layer1_foundation_schema.sql:88-92`.

**Reality:** archiving is the project's soft delete for routines — "The app filters archived out of
pickers" (`layer1_foundation_schema.sql:91`). `PracticeMenuPage` honours it
(`.filter((r) => r.user_id === user.id && !r.archived)`). `RegimenSelectPage` does not: it groups
everything `regimenRepository.list()` returns, and `fetchRegimensWithSets()`
(`src/lib/regimens.js:3-19`) applies no `archived` predicate. `fetchCustomRegimens()`
(`regimens.js:56-65`) is the filtered fetch and has no caller.

**Compounding case:** when a set insert fails, `createCustomRegimen` archives the just-created parent
as cleanup (`regimens.js:39-41`). That orphan is invisible on `play-root` and **visible and launchable**
under "Custom routines" on `regimen-select`, where it will fail to run — `validateDrillConfig` rejects
a regimen with zero sets (`src/lib/drillEngine.js:17`).

**Proposed action:** code fix, not a doc edit. Filed as `T-regimen-select-1`.

---

## P-7 — Every PLAY page renders a second `<h1>` and a second back control beneath the shell's

**Where:** `PHASE_A_ARCHITECTURE.md:203-204`.

**Claims:**

> Route metadata declares section, title/back behavior, shell type, activity-pill visibility, state
> preservation, and scroll key. **Pages must not manually duplicate shell decisions.**

**Reality:** `GlobalHeader.jsx:13` renders the route title as `<h1 className="global-header-title">`.
Twenty-two page components additionally render a `.practice-header` containing their own `<h1>` plus,
usually, their own back link. In this batch:

| Page | Shell `<h1>` | Page `<h1>` | Page back affordance |
|---|---|---|---|
| `PracticeMenuPage.jsx:141-152` | `Play` | `Putt Hub` | — (plus a `Sign out` button) |
| `RegimenSelectPage.jsx:43-52` | `Select Routine` | `Putting Regimens` | `← Practice menu` (plus `Sign out`) |
| `RoutineBuilderPage.jsx:104-109` | `Create Routine` | `Build Routine` | `Cancel` → `/practice` |
| `HistoryPage.jsx:201-206` | `History` / `Recently Deleted` | same strings | `Practice menu` / `History` |
| `ConfidenceMapPage.jsx:39-44` | `Practice Insights` | `Practice Insights` | `Practice menu` |
| `SessionReport.jsx:43-46` (via `HistoryDetailPage`) | `Activity Detail` | run/session name | `History` |

Consequences: two `<h1>` elements per screen with **different text** in four of the six rows; a
screen-reader user hears "Play" then "Putt Hub"; and the shell's back control (which navigates to the
section root, `AppShell.jsx:73-76`) sits next to an in-page link that frequently goes to the same
place.

Note this is not universally wrong — `disc-detail` deliberately uses an in-page `Locker` link because
shell Back does not return to the referrer (`NAVIGATION_MAP.md` § Back behavior). The duplication that
matters is the **second `<h1>`**.

**Proposed edit:** either demote the in-page heading to `<h2>` (or `<p class="page-eyebrow">`) across
these pages, or make `routeMetadata` titles authoritative and delete the in-page header. Either way it
is one systemic change, not per-screen. Filed as `T-play-root-2` with the other screens' documents
referencing it.

---

## P-8 — ~~`HistoryPage` never renders the `Synced` or `Syncing` calm states~~ (withdrawn)

**Superseded by `_corrections/state-matrix.md` C-2**, filed concurrently by the session authoring
`docs/ui/STATE_MATRIX.md`. That entry documents the same `HistoryPage.jsx:53-58` behavior (`null`
returned for `synced`, so the badge and its layout space vanish) inside a wider finding: five different
sync vocabularies across the app, and two underlying enums — `SYNC_STATUS`'s five members and
`activityRepository`'s three — neither of which is the contract's four.

The id is retained rather than reused; `STATE_MATRIX.md` row `S-SYNC` is the canonical description.
Task `T-practice-history-1` in `screens/practice-history.md` remains the PLAY-side fix and should be
scheduled behind whatever `state-matrix.md` C-2 resolves.

---

## P-9 — Two different metric-eligibility rules; the registry's is dead code

**Where:** `src/lib/history.js:74-85` against `src/lib/metrics/registry.js:100-107`, under
`PHASE_A_ARCHITECTURE.md` § 5.

**Reality:** two functions answer "may this activity contribute evidence," and they disagree:

| | `metricEligibleHistory` (history.js) | `isMetricEligibleActivity` (registry.js) |
|---|---|---|
| `state === 'completed'` | required | `completed` **or** `incomplete` |
| `hidden_at` | must be null | must be null |
| `has_meaningful_fact` | **not checked** | required |
| Production callers | `fetchPracticeInsights` (`history.js:102`) | **none** |

`grep -rn "filterMetricEligibleActivities\|isMetricEligibleActivity" src/` matches only
`src/lib/metrics/registry.test.js`. Every `METRIC_DEFINITIONS` entry lists exclusions
`['draft','active','paused','hidden','no_meaningful_fact']` — note `incomplete` is deliberately *not*
excluded — yet the shipped statistics path on `practice-stats` drops incomplete activities entirely.

**Why it matters:** § 5 makes the registry the version-controlled authority for metric semantics. Today
it is documentation that nothing executes, and the executing code applies a different (stricter on
state, looser on meaningfulness) rule.

**Proposed action:** make `metricEligibleHistory` delegate to `filterMetricEligibleActivities`, or
record in § 5 that the registry is descriptive-only for Phase A. Filed as `T-practice-stats-2`.

---

## P-10 — ~~`docs/ui/STATE_MATRIX.md` does not exist~~ (resolved)

**Resolved 2026-07-29.** The file was written concurrently by another session and now exists at
`docs/ui/STATE_MATRIX.md`, with stable row ids (`S-LOAD`, `S-EMPTY`, `S-EMPTY-FILTER`,
`S-INSUFFICIENT`, `S-ERR-BLOCK`, `S-ERR-INLINE`, `S-ERR-SILENT`, `S-RETRY`, `S-OFFLINE-READ`,
`S-OFFLINE-WRITE`, `S-SYNC`, `S-GHOST`, `S-INCOMPLETE`, `S-INTERLOCK-CAP`, `S-CONFIRM`, and others).

All eight PLAY screen documents cite those ids in their § 6 Flow paths rather than describing shared
state inline. The id is retained rather than reused. Task `T-play-root-3` is withdrawn.

---

## P-11 — `Insufficient data` vs `—` for null statistics

**Where:** `COPY_AND_TERMINOLOGY.md:179`.

**Claims:**

> **Percentages** rounded to whole numbers; `null` renders `Insufficient data`, never `0%`.

The line is attributed to `AGENTS.md` § Conventions; `grep -n "Insufficient" AGENTS.md` returns
nothing, so the attribution is unsupported.

**Reality:** `Insufficient data` appears in exactly two components, neither on a PLAY screen —
`DiscProfileContext.jsx:5,9,30,31` and `SkillRadar.jsx:25`. Every PLAY statistics readout uses an
em-dash: `HistoryPage.jsx:28-30` (`pct(null) → '—'`, used for current form, clutch factor, fatigue
curve, time of day, rest gap) and `SessionReport.jsx`'s drop-off rows (`no baseline yet`).

Both idioms are defensible — `COPY_AND_TERMINOLOGY.md:99-101` itself distinguishes "underpowered" from
"absent" — but line 179 states one rule that half the app does not follow.

**Proposed edit:** narrow line 179 to "a *computed but underpowered* percentage renders
`Insufficient data`; a percentage with no samples at all renders `—`", and drop the `AGENTS.md`
attribution.
