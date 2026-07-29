# Routine Builder (Build Routine)

| Field | Value |
|---|---|
| Route id | `routine-builder` |
| URL pattern | `/practice/regimens/new` |
| Section | `play` |
| Shell | `standard` |
| Header title | `Create Routine` |
| Activity pill | shown |
| Scroll key | `play-routine-builder` |
| Preserves nested state | **yes** — the only PLAY screen outside the ACTIVE shell with `preserveNestedState: true` |
| Page component | `src/pages/RoutineBuilderPage.jsx` (176 lines) |
| Blueprint screen | Screen 7 — *Custom Routine Builder*; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

Compose a multi-stage custom putting routine from zero-typing steppers — distance and putt count per
stage, an optional pressure putt per stage, three routine-level scoring bonuses — under a hard 100-putt
ceiling, with a live max-score preview computed by the real scoring engine. It exists so a player can
engineer a routine in under a minute without typing anything but its name.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `➕ Build a custom routine` (New tab) | `Link` from `/practice` (`PracticeMenuPage.jsx:230`) | |
| In | `Build one →` (empty Custom tab) | `Link` from `/practice` (`PracticeMenuPage.jsx:224`) | |
| In | `👯 Clone & Tweak` on a routine card | `Link` to `/practice/regimens/new?clone={id}` (`PracticeMenuPage.jsx:40`) | **Query-parameter contract** — see below |
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the onboarding gate |
| Out | `Save & Launch` | `navigate('/practice/regimens/{newId}/run', { replace: true })` | ACTIVE shell; the builder is **replaced**, not stacked |
| Out | `Save for later` | `navigate('/practice', { replace: true })` | Same replacement |
| Out | `Cancel` | `Link` to `/practice` | Discards without confirmation — see § 6 Destructive |
| Out | Shell back control | `AppShell.handleBack()` → `/practice` | Also discards without confirmation |
| Out | PLAY tab re-tap | `TabBar` → `/practice` | Also discards |

**`?clone=<regimenId>`** is the one query parameter this screen accepts (`RoutineBuilderPage.jsx:46`).
On mount it calls `fetchRegimenWithSets(cloneId)` and reconstructs builder state through
`builderStateFromRegimen` (`RoutineBuilderPage.jsx:26-40`), prefixing the name with `(copy)`. There is
**no ownership check in the page** — RLS is the gate (`layer1_foundation_schema.sql:123-149`), and a
non-visible id makes `.single()` reject into the inline error.

`preserveNestedState: true` means the shell keeps this route's nested state and scroll offset for
resumable/unfinished edits (`PHASE_A_ARCHITECTURE.md` § 11) — but the *builder's own React state* lives
in the page component and is destroyed on unmount regardless. The metadata flag does not save the draft.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Create Routine          [Resume] [bell]          | <- Shell header
+-------------------------------------------------------+
|  Build Routine                             Cancel     | <- Page header, second h1; see § 8
+-------------------------------------------------------+
|  (form-error, when a save or a clone fetch fails)     | <- Inline, non-blocking
+-------------------------------------------------------+
|  Routine name                                         |
|  [ Morning C1 Calibration                          ]  | <- The only free-text field on the screen
+-------------------------------------------------------+
|  Scoring bonuses                                      |
|  [ 🔥 Streak bonus ] [ ✨ Clean-set ] [ 🏁 Completion ] | <- Routine-level, not per-stage
+-------------------------------------------------------+
|  Stage 1                                       [ 🗑 ]  | <- trash hidden when only 1 stage
|  Distance                                             |
|  [ 15 ft ] [ 20 ft ](Actv) [ 25 ft ] [ 33 ft ]        |
|  Putts                                                |
|  [  5  ]  [ 10 ](Actv)  [ 15 ]  [ 20 ]                | <- No cap awareness here; see § 4
|  [ 🎯 Pressure last putt ]                            |
+-------------------------------------------------------+
|  Stage 2                                       [ 🗑 ]  |
|  ...                                                  |
+-------------------------------------------------------+
|  [ + Add next stage ]                                 | <- disabled -> "+ Add next stage (100-putt max)"
+-------------------------------------------------------+
|  2 stages     20 / 100 putts     ≈ 221 pts max        | <- Totalizer; putt count turns red above 100
|  [ Save & Launch ]          Save for later            |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

The totalizer is a normal block in document flow (`.routine-totalizer`), **not** a sticky footer. The
blueprint drew it anchored above the CTA in a fixed bottom 40% zone; see § 13.

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back -> /practice, title "Create Routine", activity pill, bell
Page header (.practice-header)
  hdr-title ............ h1, literal "Build Routine"
  hdr-cancel ........... link "Cancel" -> /practice
Error
  err-inline ........... <p class="form-error">, from a clone fetch or a save failure
Name
  name-label ........... <label for="routine-name">, "Routine name"
  name-input ........... text input, placeholder "Morning C1 Calibration"
Bonuses
  bonus-label .......... <span class="editor-label">, "Scoring bonuses" (NOT a <label>)
  bonus-chip ........... three chips: streak | clean | completion — routine-level
Stages (repeats, 1..20)
  stage-index .......... "Stage {n}"
  stage-delete ......... icon button, aria-label "Delete stage {n}"; hidden when only one stage
  stage-distance ....... ChipGroup over DISTANCE_OPTIONS [15, 20, 25, 33] ft
  stage-putts .......... ChipGroup over PUTT_OPTIONS [5, 10, 15, 20]
  stage-pressure ....... toggle chip "🎯 Pressure last putt"
Add
  add-stage ............ "+ Add next stage", with " (100-putt max)" appended when disabled
Totalizer
  tot-stages ........... "{n} stage(s)"
  tot-putts ............ "{putts} / 100 putts"; class form-error when putts > 100
  tot-preview .......... "≈ {n} pts max"
  cta-save-launch ...... "Save & Launch" / "Saving..."
  cta-save-later ....... "Save for later"
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Build Routine` | — | — | — | always |
| `hdr-cancel` | link | `Cancel` | default / pressed | navigate | `/practice` | always; **no unsaved-changes guard** |
| `err-inline` | paragraph | error `message` | present / absent | — | — | set by a `fetchRegimenWithSets` rejection or a `createCustomRegimen` rejection; cleared at the start of each save |
| `name-input` | text | placeholder `Morning C1 Calibration` | empty / filled | `setName` | local state | always; **whitespace-only is rejected by `saveDisabled`** via `!name.trim()` |
| `bonus-chip` | chip ×3 | `🔥 Streak bonus`, `✨ Clean-set bonus`, `🏁 Completion bonus` | active / inactive | `toggleBonus(key)` | local state | always. Each maps to one typed column via `SCORING_DEFAULTS`: `streak_step` 0.1, `no_miss_bonus_pct` 0.25, `completion_bonus` 50 — or 0 when off |
| `stage-distance` | chip group | `15 ft`, `20 ft`, `25 ft`, `33 ft` | active / inactive | `onChange({ ...stage, distanceFt })` | local state | always. A cloned stage whose distance is outside this set shows **no active chip** and the value is unrecoverable once changed |
| `stage-putts` | chip group | `5`, `10`, `15`, `20` | active / inactive | `onChange({ ...stage, putts })` | local state | **always — this is the interlock hole.** No option is disabled when selecting it would exceed 100 |
| `stage-pressure` | chip | `🎯 Pressure last putt` | active / inactive | `onChange({ ...stage, pressure })` | local state | always. Sets `pressure_multiplier` to 2 for that set |
| `stage-delete` | icon button | `IconTrash`, `aria-label="Delete stage {n}"` | present / absent | `deleteStage(index)` | local state | rendered only when `stages.length > 1`; **no confirmation** |
| `add-stage` | button | `+ Add next stage`, plus ` (100-putt max)` when disabled | enabled / disabled | `addStage()` — duplicates the **last** stage's settings | local state | disabled when `!canAddStage(stages)`: `stages.length >= 20`, **or** `totalPutts(stages) + lastStage.putts > 100` |
| `tot-putts` | text | `{putts} / 100 putts` | normal / over-limit | — | — | `class="form-error"` when `putts > MAX_PUTTS` — the page explicitly renders an over-ceiling state |
| `tot-preview` | text | `≈ {n} pts max` | — | — | — | `maxScorePreview({ stages, bonuses })`, recomputed every render |
| `cta-save-launch` | button | `Save & Launch` / `Saving...` | idle / saving / disabled | `handleSave(true)` | `putting_regimens` + `putting_regimen_sets` | disabled when `saving \|\| !name.trim() \|\| stages.length === 0`. **`putts` is not consulted** |
| `cta-save-later` | button | `Save for later` | idle / disabled | `handleSave(false)` | same | same rule |

### The 100-putt ceiling, precisely

Three layers were specified (`SCREEN_SPECS.md:76-77, 208-213`). Two exist, and the one that exists
app-side is partial.

| Layer | Specified | Shipped |
|---|---|---|
| Disable `ADD NEXT STAGE` | yes | **yes** — `canAddStage()` (`routineBuilder.js:44-49`), wired at `RoutineBuilderPage.jsx:99,150` |
| Prevent the total from exceeding 100 by any means | implied | **no** — `stage-putts` is uncapped and `saveDisabled` (`RoutineBuilderPage.jsx:100`) ignores `putts` |
| DB `CHECK` on `putting_regimens.total_putts` | yes | **no such column and no such CHECK.** A `BEFORE INSERT OR UPDATE … FOR EACH ROW` trigger `regimen_sets_putt_cap_check` → `enforce_routine_putt_cap()` (`layer1_foundation_schema.sql:255-290`) enforces `sum(reps_required) <= 100` per regimen, raising `errcode = 'check_violation'`. **System regimens (`user_id is null`) are exempt** by an early return, which is how JYLY's 100 and the curated drills stay editable |

Reproduction of the app-side hole: ten stages at 10 putts each (allowed — `canAddStage` permits landing
exactly on 100), then tap `20` on every stage. The totalizer reads `200 / 100 putts` in red and both save
buttons remain enabled.

What happens on save then depends on the trigger, and **its behavior against this write is unverified**:
`createCustomRegimen` inserts every set row in a *single* multi-row statement
(`regimens.js:37-38`), and whether a `BEFORE … FOR EACH ROW` trigger's aggregate `SELECT` sees the other
rows of the same statement is a PostgreSQL visibility question with no test in this repo either way. See
`_corrections/play-screens.md` P-3. If the trigger fires, the user sees the friendly message
`This routine exceeds the 100-putt ceiling.` (`regimens.js:45`) and an **archived orphan regimen row is
left behind** (`regimens.js:40`) — which then appears on `regimen-select`, because that screen does not
filter archived (`_corrections/play-screens.md` P-6).

`MAX_STAGES = 20` is app-only, with no database counterpart — and it is never the *sole* binding
constraint, because 20 stages × the smallest `PUTT_OPTIONS` value (5) is exactly 100 putts. That is why
the disabled label reads `(100-putt max)` even when the stage count is what stopped you.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Clone source regimen + its sets | `fetchRegimenWithSets(cloneId)` | `lib/regimens` | Supabase | async |
| Builder state from a clone | `builderStateFromRegimen` | inline (`RoutineBuilderPage.jsx:26-40`) | — | **pure** |
| Running putt total | `totalPutts(stages)` | `lib/routineBuilder` | — | **pure** |
| Add-stage interlock | `canAddStage(stages)` | `lib/routineBuilder` | — | **pure** |
| Max-score preview | `maxScorePreview({ stages, bonuses })` | `lib/routineBuilder` | — | **pure** |
| Stepper options | `DISTANCE_OPTIONS`, `PUTT_OPTIONS`, `MAX_PUTTS` | `lib/routineBuilder` | — | consts |

Signatures in `LIB_API_INDEX.md`.

**`maxScorePreview` deliberately calls the shipped scoring engine.** It runs the same
`buildRegimenPayload` the save path runs, then scores a hypothetical perfect run — every putt made, so
the whole stage is one clean streak and the pressure putt lands — through `computeSetScore` from
`lib/regimenScoring`, summed across stages, plus `computeCompletionBonus`
(`routineBuilder.js:104-125`). The preview therefore **cannot drift from what the run page will award**:
if scoring changes, the preview changes with it. `routineBuilder.test.js:117-133` pins this by scoring the
same routine twice — once through `maxScorePreview`, once by calling `computeSetScore` directly — and
asserting equality (221 pts for one 10-putt pressure stage with all three bonuses on: 171 set points + 50
completion). This is the design pattern worth copying anywhere a preview mirrors a computation.

The clone fetch goes to `lib/regimens` **directly, not through `regimenRepository`**, so it has no Dexie
fallback — unlike `regimenRepository.getWithSets`, which does (`regimenRepository.js:67-73`).

### Writes

| Mutation | Call | Idempotency key | Transaction boundary |
|---|---|---|---|
| Create the routine | `createCustomRegimen(user.id, { regimen, sets })` (`lib/regimens:29-51`) | **none** | **Two independent statements, no transaction.** Insert `putting_regimens`, then insert all `putting_regimen_sets` rows |
| Compensating cleanup | `supabase.from('putting_regimens').update({ archived: true })` | none | Fired only when the sets insert fails; RLS has no DELETE policy on `putting_regimens` (`layer1_foundation_schema.sql:110-112`), so soft-archive is the only cleanup available |

This is a **raw Supabase write path, not a repository write**, so `PHASE_A_ARCHITECTURE.md` § 14's
contract — expected state/version, occurred time, source, installation id, idempotency key, one local
Dexie transaction — does not apply and is not met. There is no outbox: saving offline fails outright. The
double-submit risk is real: `saving` guards the button but a rejected save resets `saving` to false with
the routine possibly already created.

### Offline

**Not offline-capable.** Both the clone prefill and the save await Supabase directly. Offline, `Cancel`
and the steppers work; `Save & Launch` rejects and renders `err-inline`, and the composed routine is lost
as soon as the page unmounts. None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 is
rendered. This is the least offline-tolerant screen in the PLAY section, which is notable given
`preserveNestedState: true` advertises it as a resumable edit surface.

## 6. Flow paths

**Happy path.** Arrive → Stage 1 seeded from `blankStage()` (20 ft, 10 putts, no pressure) → type a name
→ toggle bonuses → adjust or add stages → totalizer updates live → `Save & Launch` → routine and sets
insert → `navigate` replaces this route with the run route.

**Clone path.** Arrive with `?clone=<id>` → `fetchRegimenWithSets` → name becomes `{name} (copy)`, one
stage per set, `distanceFt = distance_feet_min`, `putts = reps_required`,
`pressure = (pressure_multiplier ?? 1) > 1`, and the three bonus toggles are inferred from whether the
source's `streak_step` / `no_miss_bonus_pct` / `completion_bonus` are greater than zero. Lossy in three
documented ways:

1. **Distance ranges collapse to their minimum.** The module comment (`RoutineBuilderPage.jsx:22-25`)
   calls this lossless for builder-created routines (which store `min == max`) and "a faithful
   approximation for the fixed 5."
2. **Off-grid values become unselectable.** Around the World and Clutch stations have
   `reps_required = 1`, which is not in `PUTT_OPTIONS`; a clone of either renders stages with **no active
   putt chip**. The value still saves correctly if untouched, but the user cannot restore it after
   changing it.
3. **Drill type is dropped.** `buildRegimenPayload` always writes `drill_type: 'custom'` and
   `base_points_per_make: 10` (`routineBuilder.js:81-83`). Cloning a classic drill therefore converts a
   `makes`-scored drill (`scoreDrillStage` in `drillEngine.js:41-47` returns `points = makes`) into a
   10-points-per-make scored regimen with different completion semantics. The clone is not the same drill.

**First run / empty.** With no `?clone`, state starts as one `blankStage()`. The screen is never empty.
`stages.length === 0` is unreachable through the UI — `stage-delete` renders only when
`stages.length > 1` — so the `stages.length === 0` term in `saveDisabled` and the `stages.length === 0`
guard in `canAddStage` are both defensive. Note that if the array *could* empty,
`addStage()` would spread `undefined` (`RoutineBuilderPage.jsx:77`) and push `{}` — a stage with
undefined `distanceFt` and `putts`, which would make `totalPutts` return `NaN`.

**Error.** Both failure modes render inline above the form; the form remains fully editable and the
user's work is preserved. This is the correct pattern and is better than `play-root`'s full-page
replacement. A clone-fetch failure leaves the default single blank stage in place, so the user silently
gets a new routine instead of a copy — the only signal is the error text.

**Offline.** As § 5.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is read only inside `handleSave`
(`RoutineBuilderPage.jsx:88`), so the form renders before auth matters — but there is no anonymous path
because the shell already requires a session.

**Interlock.** The 100-putt ceiling, dissected in § 4. Summary: `add-stage` is correctly gated;
`stage-putts` and both save buttons are not; the database backstop is a trigger whose multi-row behavior
is untested.

**Destructive.** Three unconfirmed destructive paths: `stage-delete` removes a stage immediately;
`Cancel`, shell Back, and a PLAY tab re-tap all discard the entire draft with no prompt.
`PHASE_A_ARCHITECTURE.md` § 12 requires that "unsaved text survives accidental dismissal" — that rule is
scoped to sheets, so it does not strictly bind here, but the spirit is unmet: the only free-text field in
the routine is lost on a stray back tap.

`STATE_MATRIX.md` does not exist (`_corrections/play-screens.md` P-10), so these states are described
inline.

## 7. Dependencies

### Schema

`putting_regimens` — writes `user_id`, `name`, `drill_type` (always `'custom'`), `difficulty` (from
`estimateDifficulty`), `base_points_per_make`, `streak_step`, `no_miss_bonus_pct`, `completion_bonus`,
`archived`, `rules_config`. `user_id`, `drill_type`, `rules_config`, and `archived` were added by
`layer1_foundation_schema.sql:85-92`, which also dropped the column-level `UNIQUE` on `difficulty`
(`:97-100`) — without that relaxation two custom routines could never share a difficulty band.

`putting_regimen_sets` — writes `set_order`, `distance_feet_min`, `distance_feet_max` (equal, always),
`reps_required`, `pressure_multiplier`. Constraints that bind this screen:
`reps_required > 0`, `distance_feet_max >= distance_feet_min`, `pressure_multiplier >= 1`,
`unique (regimen_id, set_order)` (`putting_regimens_schema.sql:19-28`), plus the
`regimen_sets_putt_cap_check` trigger.

`rules_config` stores `{ version: 1, stages }` as a reconstruction snapshot for "a future edit flow"
(`routineBuilder.js:89-91`). **No edit flow exists** — nothing reads that key back; the clone path
rebuilds from the set rows instead.

### Library

`lib/routineBuilder` (`blankStage`, `totalPutts`, `canAddStage`, `estimateDifficulty`,
`buildRegimenPayload`, `maxScorePreview`, `MAX_PUTTS`, `MAX_STAGES`, `DISTANCE_OPTIONS`, `PUTT_OPTIONS`,
`SCORING_DEFAULTS`), `lib/regimenScoring` (`computeSetScore`, `computeCompletionBonus`, transitively),
`lib/regimens` (`createCustomRegimen`, `fetchRegimenWithSets`). Signatures in `LIB_API_INDEX.md`.

### Components

`StageCard` (`src/components/routineBuilder/StageCard.jsx`), which itself composes `ChipGroup` twice.
Details in `COMPONENT_LIBRARY.md`.

### Screens

Reached from `play-root` (three entry points, one of them the Clone & Tweak deep link). Exits into
`regimen-active` or back to `play-root`. Newly created routines surface on `play-root`'s Custom tab and
on `regimen-select` under Custom routines.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 11 (PLAY hierarchy puts "create routine" fourth), § 12, § 13, and § 14 —
the last of which this screen's write path does not satisfy (see § 5). `SCREEN_SPECS.md` Screen 7 and
standing divergence #6. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Good — `name-input` has a real `<label htmlFor="routine-name">`** (`RoutineBuilderPage.jsx:113-116`).
- **Good — `stage-delete` is an icon-only button with `aria-label="Delete stage {n}"`**
  (`StageCard.jsx:14`), and the icon itself contributes no text. This is the pattern to copy.
- **Gap — two `<h1>`s.** Shell renders `Create Routine`; the page renders `Build Routine`
  (`RoutineBuilderPage.jsx:105`). Different words again. `_corrections/play-screens.md` P-7.
- **Gap — `bonus-label` and the stage field labels are `<span class="editor-label">` / 
  `<span class="stage-card-field-label">`, not `<label>` or `<fieldset><legend>`.** Nothing associates
  "Scoring bonuses", "Distance", or "Putts" with the chip group beneath it, so a screen-reader user
  hears three unlabelled buttons.
- **Gap — no `aria-pressed` on any chip.** `ChipGroup` emits plain buttons with a `chip-active` class
  (`COMPONENT_LIBRARY.md` § Gaps item 10), and `bonus-chip` and `stage-pressure` are hand-rolled with the
  same omission. Every toggle on this screen is silent about its state.
- **Gap — the over-ceiling state is conveyed by color and a CSS class only.** `tot-putts` swaps to
  `class="form-error"` (`RoutineBuilderPage.jsx:160`) with no `role="alert"`, no `aria-live`, and no text
  change. The reading `200 / 100 putts` is technically self-describing, but the *transition* is
  unannounced.
- **Gap — the disabled `add-stage` reason is a visual suffix.** The `(100-putt max)` text is inside the
  `disabled` button, so most assistive tech will not read it after focus skips the disabled control.
- Both save buttons are text-labelled and meet the § 12 secondary-target rule; `cta-save-launch` carries
  `.start-button`, the primary-action token.

## 9. Events and telemetry

**Metrics.** **N/A** — nothing here is a metric readout. `tot-preview` is a *deterministic projection*
of the scoring engine, not a statistic over samples, so the Wilson-interval discipline and
`PHASE_A_ARCHITECTURE.md` § 5's minimum-sample rules do not apply.

**Notifications.** None produced or consumed.

**Lifecycle events.** None. Creating a routine is configuration, not an activity; no `activities` row and
no `activity_state_events` row is written. The lifecycle begins on `regimen-active`, after `Save &
Launch` navigates.

## 10. Tests

### Existing coverage

`src/lib/routineBuilder.test.js` (140 lines — `totalPutts`, `blankStage`, `canAddStage` including the
exactly-100 boundary and the 20-stage ceiling, `estimateDifficulty` bands and clamping,
`buildRegimenPayload` column mapping, and the three `maxScorePreview` cases including the
engine-equality assertion), `src/lib/regimenScoring.test.js`, `src/lib/drillEngine.test.js`. Confirmed by
reading imports; matches the `TEST_MAP.md` § PLAY row.

**There is no component or page test for `RoutineBuilderPage.jsx` or `StageCard.jsx`,** and **no test at
all covers `createCustomRegimen`** — neither the two-statement write, the compensating archive, nor the
`23514` error mapping. The 100-putt trigger has no negative test in any language.

### Acceptance criteria

1. A fresh load shows exactly one stage at 20 ft / 10 putts / no pressure.
2. `Add next stage` duplicates the **last** stage's settings, not stage 1's.
3. With nine 10-putt stages (90 total), `Add next stage` is enabled; with ten (100 total), it is disabled
   and labelled `(100-putt max)`.
4. `≈ N pts max` equals `computeSetScore` summed over the stages plus `computeCompletionBonus` for the
   same builder state — verified by test, not by inspection.
5. Toggling `🏁 Completion bonus` changes the preview by exactly 50.
6. Saving with a whitespace-only name is impossible; the name is trimmed before insert.
7. Cloning a builder-created routine round-trips its stages exactly.
8. **Known failing:** raising every stage to 20 putts past a 100 total leaves both save buttons enabled.
9. **Unverified:** a save that exceeds 100 putts is rejected by the database and leaves no usable routine.

### E2E critical paths

Build a three-stage routine → `Save & Launch` → confirm the run page's stage list matches. Build the same
routine → `Save for later` → confirm it appears on `play-root`'s Custom tab and on `regimen-select`.
Clone & Tweak a system regimen → change one stage → save → confirm the original is unmodified. Drive the
totalizer past 100 and attempt to save → assert a clear rejection with no orphan row. Attempt a save
offline → assert the draft survives. No automated browser E2E suite exists
(`PHASE_A_ARCHITECTURE.md` § 9).

## 11. Tasks

#### T-routine-builder-1 — Close the app-side 100-putt hole

- **Capability:** `pure-logic`
- **Touches:** `src/lib/routineBuilder.js`, `src/components/routineBuilder/StageCard.jsx`,
  `src/pages/RoutineBuilderPage.jsx`
- **Done when:** A putt option that would push the routine over 100 is disabled in `stage-putts`, **and**
  both save buttons are disabled while `totalPutts(stages) > MAX_PUTTS`, with the totalizer explaining
  why. A new pure helper (`canSetStagePutts(stages, index, putts)` or equivalent) carries the rule so it
  is unit-testable in isolation, matching how `canAddStage` is already factored.
- **Verify:** `npm test` with cases for the ten-stage escalation described in § 4 and for the
  exactly-100 boundary.
- **Commit:** `fix: enforce the 100-putt ceiling on every builder control`

#### T-routine-builder-2 — Prove the database putt-cap trigger holds for multi-row inserts

- **Capability:** `schema`
- **Touches:** `layer1_foundation_schema.sql`, a new negative test
- **Done when:** A single multi-row `insert into putting_regimen_sets` summing to more than 100 for a
  `user_id`-owned regimen is rejected. If the current `BEFORE … FOR EACH ROW` trigger does not reject it,
  it is replaced by a deferred constraint trigger or a statement-level `AFTER` trigger, and the system
  regimen exemption is preserved.
- **Verify:** the negative test fails before the change and passes after, against a real Postgres.
- **Commit:** `fix: enforce the routine putt cap across multi-row set inserts`
- **Blocked by:** nothing; see `_corrections/play-screens.md` P-3.

#### T-routine-builder-3 — Make routine creation atomic

- **Capability:** `data-access`
- **Touches:** `src/lib/regimens.js`, a new migration
- **Done when:** Creating a custom routine is one authenticated RPC that writes the regimen and its sets
  together, carrying an idempotency key, per `PHASE_A_ARCHITECTURE.md` § 14. A failure leaves no row —
  archived or otherwise — and a retried save with the same key does not create a duplicate.
- **Verify:** `npm test` covering a failing set insert (no regimen row remains) and a duplicated save
  (one routine).
- **Commit:** `feat: create custom routines through an idempotent RPC`
- **Blocked by:** `T-routine-builder-2` — fix the constraint before relying on it inside a transaction.

#### T-routine-builder-4 — Confirm before discarding a draft

- **Capability:** `ui-interaction`
- **Touches:** `src/pages/RoutineBuilderPage.jsx`
- **Done when:** `Cancel`, shell Back, and a PLAY tab re-tap prompt for confirmation when the routine has
  a name or more than one stage; an untouched builder leaves silently.
- **Verify:** manual pass on `/practice/regimens/new` covering all three exits (`field-verify`-adjacent;
  shell Back is not interceptable from the page today, so this task may reveal a shell change is needed).
- **Commit:** `feat: guard unsaved routine drafts`

#### T-routine-builder-5 — Label the chip groups

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoutineBuilderPage.jsx`, `src/components/routineBuilder/StageCard.jsx`,
  `src/components/ChipGroup.jsx`
- **Done when:** "Scoring bonuses", "Distance", and "Putts" are programmatically associated with their
  chip groups (`role="group"` + `aria-labelledby`, or a `<fieldset><legend>`), and every chip exposes
  `aria-pressed`. Visual output unchanged.
- **Verify:** `npm run lint` plus a VoiceOver pass on `/practice/regimens/new`.
- **Commit:** `fix: expose builder chip groups to assistive tech`

## 12. Open questions

1. **Does the database trigger actually hold for the write path the app uses?** The single largest
   unknown on this screen. `_corrections/play-screens.md` P-3; task `T-routine-builder-2`.
2. **What should Clone & Tweak do with a classic drill?** Cloning JYLY, Around the World, or Clutch
   silently converts a `makes`-scored drill into a 10-points-per-make custom regimen with a different
   completion model, and their `reps_required = 1` stations land off the `PUTT_OPTIONS` grid. Options:
   hide Clone & Tweak on classic drills, preserve `drill_type` in the clone, or warn.
3. **`rules_config.stages` is written and never read.** It exists for an edit flow that
   `SCREEN_SPECS.md:210` describes ("Editing a routine with recorded runs versions (new row, old
   retired) rather than mutating") and that was not built. Is the snapshot still the right shape for that
   flow, or should it be dropped until the flow exists?
4. **`preserveNestedState: true` promises resumability this screen does not provide.** The flag is
   route-level; the draft is component-level and dies on unmount. Either the draft should persist (the
   InstantLaunch `localStorage` buffer is the obvious home) or the flag is misleading.
5. **Should `estimateDifficulty`'s output be visible?** The builder writes a 1–5 difficulty that shows up
   as a star badge on both picker screens, but never shows the user what it will be.
6. `_corrections/play-screens.md` P-1 (no `total_putts` CHECK), P-2 (partial app-side interlock), P-3
   (trigger unverified), P-6 (archived orphans), P-7 (double `<h1>`), and P-10 (missing
   `STATE_MATRIX.md`) all touch this screen.

## 13. Blueprint divergence

Blueprint Screen 7 is *Custom Routine Builder* (`MASTER_PROJECT_BLUEPRINT.md:417-462`).
`SCREEN_SPECS.md:198-215` records one intended divergence (QR Beam parked) plus a project convention
(versioned edits). The shipped screen matches the blueprint's core — modular stage cards, segmented
steppers, a totalizer, a hard ceiling on `ADD NEXT STAGE` — with these differences:

| Blueprint Screen 7 feature | Shipped reality |
|---|---|
| Four **per-stage** milestone toggles: `[✓ First]` `[✓ Last]` `[✓ Streak]` `[✓ Clean]` | Three **routine-level** bonus chips (Streak / Clean-set / Completion) plus one per-stage `Pressure last putt`. Deliberate and documented: `routineBuilder.js:20-24` explains that the shipped engine scores streak/clean/completion at the routine level and pressure per set, so the builder exposes the knobs at the level the engine reads them |
| `[ 🔗 BEAM ]` QR routine share | Parked with Social — `SCREEN_SPECS.md:209`, standing divergence #8 |
| Sticky totalizer footer anchored in a fixed bottom 40% zone | `.routine-totalizer` is an ordinary block at the end of the document flow; it scrolls away |
| `[ ✕ ]` close plus `⬅️` back in the header | One `Cancel` link; the shell supplies back |
| Routine name as a "Zero-Typing Preset Picker" with an ✏️ affordance | A plain free-text `<input>` with a placeholder. **The only typing on the screen** — a real gap against the zero-typing thesis |
| `ADD NEXT STAGE (DUPLICATES STAGE 1 SETTINGS)` | Duplicates the **last** stage, not stage 1 (`RoutineBuilderPage.jsx:76-78`). Better behavior for building a ladder; the code comment cites the blueprint line while doing something else |
| "up to 20 stages" | `MAX_STAGES = 20`, but unreachable as an independent limit — see § 4 |
| Ceiling enforced so the total cannot exceed 100 | Enforced on one control only; see § 4 and `_corrections/play-screens.md` P-2 |
| `putting_regimens.total_putts` CHECK ≤ 100 (`SCREEN_SPECS.md:213`) | **The column does not exist.** A row trigger enforces the rule instead; `_corrections/play-screens.md` P-1 |
| Versioned edits (new row, old retired) — `SCREEN_SPECS.md:210` | Not built. There is no edit flow at all; `rules_config` holds a snapshot for one |

Standing divergences #1 (React/Vite, not Expo — the "massive touch grids" are `ChipGroup` rows), #6
(interlocks, now qualified by P-1), and #8 (QR Beam parked) apply; see `SCREEN_SPECS.md`.
