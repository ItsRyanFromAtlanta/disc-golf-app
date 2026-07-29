# Freeform Log (active capture)

> Sibling of `regimen-active.md`. The two share the entire capture stack — 15 components, one hook, one
> FSM. **Read `regimen-active.md` first**; this document records only what differs, per the link-never-
> restate rule, and marks shared behavior as such rather than duplicating it.

| Field | Value |
|---|---|
| Route id | `freeform-active` |
| URL pattern | `/practice/freeform` |
| Section | `play` |
| Shell | **`active`** |
| Header title | `Quick Play` (unused; the active shell renders no shell header) |
| Activity pill | **hidden** |
| Scroll key | `null` |
| Preserves nested state | yes |
| Page component | `src/pages/FreeformLogPage.jsx` (659 lines) |
| Blueprint screen | Screen 8 — shares the Scoring Canvas spec with `regimen-active` |
| Verified against | `eb9fd2b` |

## 1. Purpose

Log putts with no predetermined structure: pick a distance, throw as many as you like, move to another
distance, end when you want. The unstructured counterpart to a routine — same capture surface, no plan
to conform to.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Practice menu | `Link` from `/practice` | |
| In | Activity pill | `AppShell` maps `putting_freeform` → `/practice/freeform` | |
| In | Crash recovery | `useCrashRecoveryRedirect` | |
| In | **Pursuit drill deep link** | `?distance=<ft>` via `useSearchParams` | Read as `pursuitDistance` and used as the starting distance. This is the Trophy Room's `LAUNCH PURSUIT DRILL` contract — a badge-closing drill pre-configures the distance |
| Out | `Practice menu` link | `Link` to `/practice` | Header link, visible throughout — unlike `regimen-active` |
| Out | `End session` | `handleEndSession` | |
| Out | Context bar exit | `handleEndSession` | Same handler — no separate abandon concept |
| Out | Report `onDashboard` / `onReplay` | `navigate('/practice')` / `handleStart` | |

**Document the `?distance=` parameter when touching Trophy Room.** It is the only cross-section deep-link
contract in the app besides `/bag/lost-found?disc=`.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  Freeform Log                        [ Practice menu ] | <- Page header, present throughout
+-------------------------------------------------------+
|  20 ft  ·  1 of 1              [🔇] [◎] [tap|gest|pnc] | <- CanvasContextBar (stage 1 of 1, always)
|  7 / 10                              Saved on Device   |
+-------------------------------------------------------+
|  [ putter ]  [ weather ]  [ 📝 EDIT ]                  | <- CanvasToolbar
+-------------------------------------------------------+
|  ◆ ◆ ● ◆ ◆ ◆ ● ◆ · ·                                  | <- StackTracker
+-------------------------------------------------------+
|          MADE            |          MISSED             | <- Same three input modes
+-------------------------------------------------------+
|  [ batch ribbon, while volume remains ]                |
|  Next distance (ft) [ 25 ] [ New distance ][ End ]     | <- Freeform-only distance control
+-------------------------------------------------------+
|  TODAY'S SESSION                                       | <- Freeform-only log list
|  [C1] 20 ft   7/10 (70%)                       3:42 PM |
|  [C1] 10 ft   9/10 (90%)                       3:31 PM |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Page header .................. present in BOTH FSM states, unlike regimen-active
  hdr-title .................. "Freeform Log"
  hdr-menu ................... link to /practice
err-inline ................... error paragraph, above the launcher

READY_DEFAULT
  SessionLauncher ............ same component as regimen-active
    launch-presets ........... QUICK_DISTANCE_PRESETS: 10 ft, 20 ft, 33 ft (C1 edge)
                               selecting one sets pendingDistance
    launch-suggestion ........ from suggestNextSession
    launch-putter, launch-matchmode, launch-start .. shared behavior

ACTIVE_SESSION
  PuttingCanvas .............. shared; holds the wake lock
    contextBar ............... stageIndex hardcoded 1, stageCount hardcoded 1
    toolbar .................. onEdit always enabled (no clutch mode here)
    stackTracker ............. hasPressureLast always false
    gestureZone .............. TapZone | GestureZone | PanicZone, identical to regimen-active
    batchRibbon
      ribbon ................. while remaining > 0 or confirming
      next-distance .......... number input, label "Next distance (ft)"
      btn-new-distance ....... handleNewDistance
      btn-end ................ handleEndSession
  ghostPace .................. NOT passed — freeform has no ghost pacing
  Overlays ................... DiagnosticZonePicker, EditTallyDrawer, FatigueCheckin (shared)

Today's session .............. renders in BOTH states, below everything
  logs-loading ............... "Loading..."
  logs-empty ................. "No putts logged yet today."
  log-row .................... zone badge, distance, makes/attempts + percent, local time

phase === 'summary'
  SessionReport .............. completed={null}, totalScore={null} — freeform has neither
```

## 4. Element catalog

Shared elements are documented in `regimen-active.md` § 4. Freeform-only:

| id | Type | States | Action | Notes |
|---|---|---|---|---|
| `launch-presets` | pills | selected / not | sets `pendingDistance` | Three fixed distances; unlike regimen presets these are distances, not quick-mods |
| `next-distance` | number input | — | `setNextDistanceInput` | `min="1"`, no maximum |
| `btn-new-distance` | button | — | `handleNewDistance` | Closes the current distance's summary row and opens another at the new distance |
| `btn-end` | button | — | `handleEndSession` | |
| `log-row` | list row | — | — | Zone badge, distance, `makes/attempts (pct)`, `toLocaleTimeString` |
| `logs-empty` | text | — | — | `No putts logged yet today.` — idiom A per `COPY_AND_TERMINOLOGY.md` § 2 |

`DEFAULT_VOLUME = 10` is a **nominal target, not a gate.** The code comment is explicit: freeform has no
fixed next distance, so the user can always move on or end early. The batch ribbon therefore never
blocks progress the way it shapes a regimen stage.

## 5. Data contract

### Reads

`fetchHistory` → `suggestNextSession` for the launcher suggestion; `fetchUserDiscs` for the putter label
and swap suggestion; a direct `putt_sessions` query for today's log list, selecting
`id, distance_feet, makes, attempts, zone, created_at`. All best-effort except the log list.

### Writes

Same adapter shape as `regimen-active`, different parent table:

| Mutation | Adapter call | Table |
|---|---|---|
| Session parent | `syncParentWrites` | **`putt_sessions`** (vs `putting_regimen_runs`) |
| Distance summary | `syncSummaryWrites` | session summary rows |
| Per-putt events | `syncPuttEvents` | `putt_events`, keyed by `freeform_session_id` |
| Undo | `deletePuttEvent` | `putt_events` |

Notes, tags, and context edits update `putt_sessions` directly from the report. Fatigue check-ins carry
`putt_session_id` with `regimen_run_id: null` and an idempotency key of
`fatigue:<freeformSessionId>:<stageIndex>` — the mirror of the regimen key.

XP is awarded through `awardPostSession` with a freeform `XP_SOURCE`, idempotent by session id.

### Offline

Identical to `regimen-active` — same hook, same outbox, same calm states. See that document § 5.

## 6. Flow paths

**Happy path.** `READY_DEFAULT` → pick a distance preset or accept the suggestion → `handleStart`
mints a session id → `ACTIVE_SESSION` → capture → optionally `handleNewDistance` any number of times →
`handleEndSession` → `phase = 'summary'`.

**New distance.** The freeform-only lifecycle move. Closes the current distance as a summary row and
opens another within the same parent session — the reason a freeform session yields multiple summary
rows without a predetermined plan.

**Pursuit deep link.** Arrive with `?distance=33`, and `pursuitDistance` seeds the starting distance.
Trophy Room's badge-closing drill depends on this; changing the parameter name breaks it silently.

**Crash recovery, diagnostic miss, offline, fatigue.** All identical to `regimen-active` § 6.

**Error.** An error renders inline **above** the launcher rather than replacing the page — better than
`regimen-active`'s pre-start full-page error, and the pattern worth standardizing on.

**No abandon concept.** A freeform session has nothing to complete, so ending is always just ending.
`SessionReport` receives `completed={null}` and `totalScore={null}` and omits both.

## 7. Dependencies

Identical to `regimen-active` § 7 **minus**: `regimenScoring`, `drillEngine`, `clutchTimer`,
`ghostPacing`, `regimenRepository`, `GhostPaceCard`, `ClutchTimerPanel`, `SessionLauncher`'s clutch
variant. **Plus**: `insights.suggestNextSession`, `useSearchParams`.

Schema: `putt_sessions` (`distance_feet`, `makes`, `attempts`, `zone`, `weather_condition`, `wind_mph`,
`external_factors`, `perceived_effort`, `notes`, `tags`), `putt_events.freeform_session_id`.

Contracts: `PHASE_A_ARCHITECTURE.md` §§ 1–4, 12, 14. No blocking ADR.

## 8. Accessibility

Shared capture-surface notes are in `regimen-active.md` § 8 and apply unchanged. Freeform-only:

- `next-distance` has a proper `htmlFor`/`id` label pair.
- **Contract divergence:** `PHASE_A_ARCHITECTURE.md` § 12 states the active shell "is non-scrolling for
  primary field controls," yet this page renders a page header and an unbounded `Today's session` list
  below the canvas. With enough distances logged, the primary capture surface can be pushed off-screen.
  `regimen-active` has no such tail. This is the most concrete active-shell contract divergence found
  while documenting the app — see § 12.
- **Gap:** the log row conveys zone through a badge and percentage through parentheses; no
  `aria-label` summarizes a row, so a screen reader reads four disconnected fragments.

## 9. Events and telemetry

Same as `regimen-active` § 9 except: no clutch notifications, no completion bonus, and XP is keyed to
the freeform session. Match mode coaching is identical and identically gated.

## 10. Tests

### Existing coverage

The same library-layer suite as `regimen-active` minus the regimen-specific modules:
`instantLaunch/*`, `scoringCanvas`, `gestureEngine/classify`, `matchModeCoach`, `fatigueCheckin`,
`insights/insights`, `a10Equivalence`.

No page test. **No test covers `handleNewDistance`** — the one lifecycle transition unique to this
screen and the one most likely to produce orphaned or mis-attributed summary rows.

### Acceptance criteria

1. Arriving with `?distance=33` starts at 33 ft.
2. `New distance` closes the current summary row and opens another under the same session id.
3. Ending a session with several distances produces one parent row and one summary row per distance.
4. `Today's session` lists only today's rows, in local time.
5. Batch-ribbon fills never create `putt_events` rows.
6. The report omits score and completion, since freeform has neither.
7. Crash recovery restores distance, tally, and session id with no network read.

### E2E critical paths

Offline capture then exactly-once flush (Priority 1 in `TEST_MAP.md`). Multi-distance session integrity:
three distances, verify three summary rows against one parent. Pursuit deep link from Trophy Room.

## 11. Tasks

#### T-freeform-active-1 — Cover the multi-distance lifecycle

- **Capability:** `pure-logic`
- **Touches:** new test alongside `src/lib/instantLaunch/sessionReducer.test.js`
- **Done when:** Three distances in one session produce exactly three summary rows sharing one parent id,
  with events attributed to the correct distance.
- **Verify:** `npm test`
- **Commit:** `test: cover freeform multi-distance sessions`

#### T-freeform-active-2 — Resolve the active-shell scroll divergence

- **Capability:** `ui-interaction`
- **Touches:** `src/pages/FreeformLogPage.jsx`
- **Done when:** `Today's session` no longer competes with the capture surface — moved into a toolbar
  sheet, collapsed by default, or bounded — and the capture zone cannot be pushed off-screen.
- **Verify:** Manual check with 8+ logged distances at 320px width and 200% text scaling.
- **Commit:** `fix: keep freeform capture surface in view`
- **Blocked by:** § 12 open question 1.

#### T-freeform-active-3 — Document and test the pursuit deep-link contract

- **Capability:** `pure-logic`
- **Touches:** `src/pages/FreeformLogPage.jsx`, Trophy Room launch site
- **Done when:** The `?distance=` parameter has a single named constant shared by producer and consumer,
  and a test asserts the round trip.
- **Verify:** `npm test`
- **Commit:** `refactor: share the pursuit drill distance parameter`

## 12. Open questions

1. **Does the active shell permit a scrolling tail?** `PHASE_A_ARCHITECTURE.md` § 12 says the active
   shell is non-scrolling for primary field controls and that secondary tasks open in sheets. This screen
   renders a header and an unbounded list in the same view as the capture surface. Either the contract
   admits an exception here, or this screen violates it. Needs a ruling, not a patch.
2. **`DEFAULT_VOLUME = 10` is invisible.** The batch ribbon sizes itself against it, but nothing tells
   the user where the number came from or that it is not a target they must hit.
3. **`handleEndSession` serves both the explicit End button and the context bar exit.** In
   `regimen-active` those are distinct concepts (finish vs abandon). Whether freeform should distinguish
   "ended deliberately" from "backed out" is undecided, and today history cannot tell them apart.

## 13. Blueprint divergence

Shares blueprint Screen 8 with `regimen-active`; the input-model decision recorded in that document
§ 13 applies identically and is not repeated here.

Freeform-specific: the blueprint did not describe an unstructured logging mode at all. This screen is a
project addition, and its `Today's session` list, `New distance` control, and pursuit deep link have no
blueprint counterpart. `SCREEN_SPECS.md` does not mention it either — the freeform path predates the
blueprint integration and was folded into the shared canvas during Track 2.2c rather than being
specified.
