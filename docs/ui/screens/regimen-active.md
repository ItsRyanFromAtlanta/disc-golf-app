# Regimen Run (active capture)

> **The most complex screen in the app.** 827 lines of page code composing 19 `puttingCanvas`
> components, three input modes, a persisted FSM, and five drill variants. Read § 3b and § 6 before
> changing anything here.

| Field | Value |
|---|---|
| Route id | `regimen-active` |
| URL pattern | `/practice/regimens/:regimenId/run` |
| Section | `play` |
| Shell | **`active`** — no header, no scroll region, no tab bar |
| Header title | `Routine` (unused; the active shell renders no header) |
| Activity pill | **hidden** — you are inside the activity |
| Scroll key | `null` — nothing scrolls |
| Preserves nested state | yes |
| Page component | `src/pages/RegimenRunPage.jsx` |
| Blueprint screen | Screen 8 — Rapid-Fire Scoring Canvas & Mid-Round Swaps |
| Verified against | `eb9fd2b` |

## 1. Purpose

Capture every putt of a structured routine at speed, one-thumb, in sunlight, without looking at the
screen — then score, persist, and report it. This is the screen the whole app exists to serve, and the
only one whose failure loses user data that cannot be reconstructed.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Launch from routine select | `Link` from `/practice/regimens` | Ordinary path |
| In | Activity pill in the global header | `AppShell` computes `/practice/regimens/:regimenId/run` from `activeActivity.metadata.regimenId` | Returns the user to a running session from anywhere |
| In | Crash recovery | `useCrashRecoveryRedirect`, once per app load | A killed and relaunched PWA reopens here |
| Out | `Regimens` link in page header | `Link` to `/practice/regimens` | Only visible pre-start; the canvas covers it once active |
| Out | Exit control on the context bar | `handleAbandon` | Voluntary early exit — finalizes as abandoned, not completed |
| Out | Finish final stage | `handleFinishStage` → `phase = 'summary'` | Replaces the page with `SessionReport` |
| Out | `onDashboard` in the report | `navigate('/practice')` | |
| Out | `onReplay` in the report | `handleStart` | Relaunches the identical config in place — no navigation |

There is **no shell back control and no tab bar** while active. Leaving is a deliberate act through one
of the paths above. That is the point: an accidental swipe must not end a session.

## 3. Layout

The screen is three different layouts selected by FSM state and `phase`, not one layout with variants.

### 3a. Frame (illustrative) — ACTIVE_SESSION, tap mode

```
+-------------------------------------------------------+
|  Set 2 of 4  ·  20 ft        [🔇] [◎] [tap|gest|panic] | <- CanvasContextBar
|  7 / 10                            Saved on Device     |    (silence, diagnostic, input mode, sync)
+-------------------------------------------------------+
|  [ putter: Pixel ]  [ weather ]  [ 📝 EDIT ]           | <- CanvasToolbar (sheets)
+-------------------------------------------------------+
|  ◆ ◆ ● ◆ ◆ ◆ ● ◆ · · ·                                | <- StackTracker pips
+-------------------------------------------------------+
|                          |                            |
|                          |                            |
|          MADE            |          MISSED            | <- TapZone: fixed 50/50
|                          |                            |    (GestureZone grows the make
|                          |                            |     territory on streaks; TapZone
|                          |                            |     deliberately does not)
|                          |                            |
+-------------------------------------------------------+
|  [ batch ribbon: how did the remaining 3 go? ]         | <- BatchRibbon, or the finish button
+-------------------------------------------------------+
```

Overlays that can cover this: `DiagnosticZonePicker` (9-zone miss picker), `EditTallyDrawer`,
`FatigueCheckin`, and `ClutchTimerPanel` — the last of which *replaces* the canvas entirely while a
clutch stage is resting.

### 3b. Region outline (normative)

```
READY_DEFAULT
  clutch-setup ............. only when drillKind === CLUTCH
    clutch-distance ........ one button per set distance, aria-pressed
  SessionLauncher
    launch-title ........... "Ready when you are" | "Start the randomized rest" (clutch)
    launch-form ............ currentFormPct suggestion line, omitted on fetch failure
    launch-putter .......... favorite putter select -> writes profile defaults
    launch-presets ......... quick-mod preset pills
    launch-matchmode ....... toggle; enabling also forces diagnosticModeDefault on
    launch-start ........... handleStart

ACTIVE_SESSION, clutchStatus === 'resting'
  ClutchTimerPanel ......... replaces the canvas entirely
    clutch-due ............. randomized deadline from createClutchDeadline
    clutch-ready ........... handleClutchReady -> haptic + notification + stage advance
    clutch-exit ............ handleAbandon

ACTIVE_SESSION, otherwise
  PuttingCanvas (holds the wake lock)
    contextBar (CanvasContextBar)
      ctx-stage ............ label, index/count, distance
      ctx-tally ............ makes/attempts against volumePlanned
      ctx-silence .......... audio mute toggle
      ctx-diagnostic ....... 9-zone miss capture toggle
      ctx-inputmode ........ tap | gesture | panic
      ctx-sync ............. syncStatus
      ctx-factors .......... external factor chips
      ctx-exit ............. handleAbandon
    toolbar (CanvasToolbar)
      tb-putter ............ active putter, sheet
      tb-weather ........... condition + windMph, sheet
      tb-swap .............. suggested backup, accept or dismiss
      tb-edit .............. EditTallyDrawer; null when clutch
    ghostPace (GhostPaceCard)
    stackTracker (StackTracker) .. pip row, pressure-last marker
    gestureZone .............. exactly one of:
      TapZone ................ fixed 50/50 MADE | MISSED (default)
      GestureZone ............ swipe cones, make territory grows with streak
      PanicZone .............. whole screen: tap = make, long-press = miss
    batchRibbon .............. BatchRibbon while volume remains, else the finish button
                               clutch: instruction text, then "Finish pressure putt"
  Overlays
    DiagnosticZonePicker ..... when pendingMiss
    EditTallyDrawer .......... when showEditDrawer
    FatigueCheckin ........... when fatiguePrompt

phase === 'summary'
  SessionReport ............. replaces the entire page
```

## 4. Element catalog

| id | Type | States | Action | Notes |
|---|---|---|---|---|
| `launch-start` | button | idle / starting | `handleStart` | Validates via `validateDrillConfig` first; an invalid contract sets `error` and does not start |
| `clutch-distance` | button | pressed / not | sets `clutchDistanceFt` | `aria-pressed` correctly applied — one of the few places in the app that does this |
| `ctx-inputmode` | chip group | tap / gesture / panic | `setInputMode` | Seeded from `profileDefaults.inputModeDefault` |
| `ctx-diagnostic` | toggle | on / off | `setDiagnosticMode` | On: a miss defers its `putt_events` row until a zone is picked |
| `ctx-silence` | toggle | on / off | `audio.setSilenced` | |
| `ctx-exit` | button | — | `handleAbandon` | **No confirmation.** See § 12 |
| `TapZone` | capture surface | idle / accept-flash | `handleGestureMake` / `handleGestureMiss` | Fixed 50/50 split; `ACCEPT_FLASH_MS = 220` |
| `GestureZone` | capture surface | idle / accept-flash | same | Make territory grows with `makeTerritoryPct(consecutiveMakes)`, capped by `GESTURE_CONFIG.ZONE_GROWTH_CAP_PCT` |
| `PanicZone` | capture surface | idle / accept-flash | same | Tap = make, long-press = miss. Cold hands, low battery, gloves |
| `undo` | action | — | `handleUndo` | Haptic, then `session.undo()`. Available in tap and gesture zones |
| `BatchRibbon` | control | active / confirming | `session.batchComplete` then `handleFinishStage` | A tap accounts for the **entire** remaining volume, not a partial fill |
| `tb-swap` | suggestion | shown / dismissed | `handleAcceptSwap` | Only appears when `suggestBackupSwap` returns a disc for the current weather |
| finish button | button | — | `handleFinishStage` | Label varies: `Resolve station` (Around the World), `Finish regimen` (last set), else `Finish set & next` |

## 5. Data contract

### Reads

| Data | Function | Backing | Notes |
|---|---|---|---|
| Regimen + sets | `regimenRepository.getWithSets` | repository | **Skipped entirely when resuming** from `activeRegimenSnapshot` — crash recovery must not depend on the network |
| Current form | `fetchHistory` → `decayWeightedForm` | Supabase | Best-effort; the launcher omits the line on failure |
| Ghost profile | `fetchGhostPacingProfile` | repository | Best-effort and non-gating. Whatever is available at Start is frozen into crash recovery — a late response never changes a running session's opponent |
| User discs | `fetchUserDiscs` | Supabase | Best-effort; swap suggestion and putter label degrade silently |
| Summary putter rows | direct `supabase.from('putt_events')` | Supabase | Only at `phase === 'summary'` |

Four of five primary reads are explicitly best-effort with empty `.catch(() => {})` handlers. That is
deliberate — **nothing may block Start.**

### Writes

All capture writes go through `useInstantLaunchSession` and its write adapter, never directly:

| Mutation | Adapter call | Table |
|---|---|---|
| Run parent | `syncParentWrites` | `putting_regimen_runs` |
| Stage summary | `syncSummaryWrites` | `putting_regimen_run_sets` |
| Per-putt events | `syncPuttEvents` | `putt_events` |
| Undo | `deletePuttEvent` | `putt_events` |

Non-capture writes that bypass the adapter: notes/tags and context edits in the report write
`putting_regimen_runs` directly; fatigue check-ins go through `fatigueCheckinRepository` with an
idempotency key of `fatigue:<runId>:<stageIndex>`; XP and badges go through `awardPostSession`.

**The data-split rule:** only genuine tap/gesture capture produces `putt_events` rows. Batch-ribbon
fills stay summary-only. This is why the report's putter breakdown reflects only gesture-captured putts
(`DEVLOG.md:1529`) — a real and intended asymmetry, not a bug.

### Offline

This is the app's strongest offline surface and the reference implementation for every other screen.
Capture never touches the network synchronously; events queue through the InstantLaunch outbox with
backoff and idempotent replay. `syncStatus` renders in the context bar using the calm states from
`PHASE_A_ARCHITECTURE.md` § 12. A finish while offline under-counts the report's putter breakdown until
the outbox flushes; the same run later viewed through History shows the complete picture.

## 6. Flow paths

Shared state behavior is defined in `STATE_MATRIX.md`; this section cites row ids rather than restating
them, per `TEMPLATE.md` § 7. One row bears on this screen without appearing in any path below:
`S-INTERLOCK-ACTIVE` names `regimen-active` as an affected screen, and its single-active confirmation is
fully built in `activityRepository.start` yet reaches no component — starting a run during a live round
shows no dialog here, because there is nothing in this page to show one.

**Happy path.** `READY_DEFAULT` → configure putter/presets/match mode → `handleStart` validates the
drill contract, mints a run id, and calls `session.startSession` with a frozen regimen snapshot →
`ACTIVE_SESSION` → capture putts → `handleFinishStage` scores the stage synchronously, computes the
next transition via `nextDrillStage`, and either advances or ends → `phase = 'summary'` → `SessionReport`.

Scoring is computed **synchronously from `session.sessionState`**, never from a `setState` value read
back later, so the summary row and the final `total_score` are built from the real final numbers within
the same call.

**Crash recovery.** `S-RECOVERY`, and this screen is that row's strongest instance. A killed PWA
relaunches, `useCrashRecoveryRedirect` routes here, and `activeRegimenSnapshot` rehydrates regimen, sets,
stage, running total, and `regimenRunId` from the persisted buffer with **zero network reads**. Drill
progress rides inside the stage snapshot precisely so the attempt cap and score survive. The row's one
gap applies unchanged: nothing explains *why* the session paused, as § 11 requires. `S-PAUSE` is the
adjacent gap — `useActivityNavigationLifecycle` pauses this route on navigation away and tells the user
nothing, because the toast § 11 specifies cannot fire (`S-TOAST`).

**Abandon.** `handleAbandon` finalizes the current partial stage as a normal summary row but marks the
run `completed: false` — the same status History already renders. A stage with zero attempts skips the
summary row entirely. That flag is `S-INCOMPLETE`'s input: it surfaces downstream as the `Incomplete`
badge and an `ACTIVE`-actionable notification, but per that row the sibling `activities.needs_review`
column this run can set is never rendered anywhere.

**Offline.** As § 5. Capture continues unaffected — `S-OFFLINE-WRITE` is satisfied by the InstantLaunch
outbox, and this screen is the reference implementation for it. Two divergences on the same path:
`S-SYNC` is **not met** — `CanvasContextBar` (`RegimenRunPage.jsx:728`) renders `Synced` / `Pending` /
`Syncing...` / `Retrying...` / `Sync failed`, five states against § 12's four labels, only one of which
is a contract word, and `.canvas-sync-pill` reserves no `min-width`, so the pill reflows as the status
changes. And the fatigue check-in path is the one `S-OFFLINE-WRITE` hole that row marks `data-risk`; see
the Fatigue path below.

**Diagnostic miss.** Audio and haptics fire immediately regardless of diagnostic mode — feel must not
wait on the picker. The `putt_events` row is deferred until a zone is picked or dismissed, rather than
written now and patched after.

**Fatigue.** `fatigueCheckinTrigger` inspects stage outcomes and prior stages; a trigger prompts only
between stages, never mid-capture, and only on an advance — never on the final stage. **Diverges from
`S-OFFLINE-WRITE`:** the recorded check-in is the app's one repository write with no outbox and no flush.
`fatigueCheckinRepository.record` returns `{ sync_state: 'pending' }` and the call site
(`RegimenRunPage.jsx:529`) discards it, so an offline check-in is stranded on-device permanently and is
never labelled `Saved on Device`. `listForParent`'s `data ?? local` compounds it — a successful empty
remote response hides the local rows.

**Clutch.** A randomized rest deadline; `ClutchTimerPanel` replaces the canvas; `handleClutchReady`
fires a haptic and a notification, then advances the stage to `Putt now`. Editing is disabled during
clutch (`onEdit` is `null`).

**Error.** `S-ERR-BLOCK` (`RegimenRunPage.jsx:320`), and this is the row's **one binding
contract-violation**: because `regimen-active` is an `active`-shell route, § 12's prohibition applies by
the letter here and nowhere else. A pre-start load failure renders `<p className="form-error">` as the
whole page — same pattern, and the same missing `S-RETRY` control, as `disc-detail`. The row's precise
finding holds on re-reading the page: `error` is set only from the initial regimen load (`:231`) and from
`handleStart`'s config validation (`:335`), never from a capture-time network failure, so the prohibited
sequence does not occur today and the page is one `setError` call away from it. Once active, no error can
replace the capture surface. `S-LOAD` sits immediately above it at `:319` and shares the row's a11y gap —
no `aria-live`, no `role="status"`.

`S-EMPTY` has no instance on this page: `RegimenRunPage.jsx` contains no `length === 0` branch and no
empty copy, and its sub-components render `S-INSUFFICIENT` rather than empty states — `GhostPaceCard`
returns `null` with no profile and otherwise renders `N more real-time attempts to compare.`,
`SessionReport` renders `no baseline yet` (`:132`). See `_corrections/state-citations.md`.

## 7. Dependencies

### Schema
`putting_regimens`, `putting_regimen_sets` (`set_order` denormalized onto each `putt_events` row so
miss-tendency diagnostics group without re-joining), `putting_regimen_runs` (`completed`, `total_score`,
`weather_condition`, `wind_mph`, `external_factors`, `perceived_effort`, `notes`, `tags`),
`putting_regimen_run_sets`, `putt_events` (`outcome`, `miss_zone`, `putter_disc_id`, `is_pressure`),
fatigue check-ins, XP and badge tables.

### Library
`instantLaunch/*` (FSM, session reducer, sync, backoff, crash recovery), `regimenScoring`,
`drillEngine`, `clutchTimer`, `matchModeCoach`, `ghostPacing`, `scoringCanvas`, `fatigueCheckin`,
`gestureEngine/config`, `insights`, `history`, `gamification/*`, `regimenRepository`,
`fatigueCheckinRepository`, `ghostPacingRepository`, `discLocker`.

### Components
`SessionLauncher`, `PuttingCanvas`, `CanvasContextBar`, `CanvasToolbar`, `StackTracker`, `TapZone`,
`GestureZone`, `PanicZone`, `BatchRibbon`, `DiagnosticZonePicker`, `EditTallyDrawer`, `FatigueCheckin`,
`GhostPaceCard`, `ClutchTimerPanel`, `SessionReport`.

### Hooks
`useInstantLaunchSession`, `usePuttAudio`, `usePuttHaptics`, and `useWakeLock` — held by
`PuttingCanvas`, added 2026-07-27 because iOS auto-locked mid-routine.

### Screens
`regimen-select` enters. `practice-history-detail` renders the same `SessionReport` component — one
component, two entry points, a rule carried from the v1 spec. `freeform-active` shares the entire
capture stack.

### Contracts
`PHASE_A_ARCHITECTURE.md` §§ 1–4, 12, 14. No blocking ADR.

## 8. Accessibility

- `clutch-distance` applies `aria-pressed` correctly, and the option group carries
  `aria-label="Pressure putt distance"`. This is the pattern other chip groups in the app should copy —
  `COMPONENT_LIBRARY.md` records that `ChipGroup` emits no selection semantics.
- Every required gesture has a visible alternative: gesture mode is opt-in, tap is default, and panic
  mode exists for degraded conditions. This satisfies § 12's gesture-alternative rule better than any
  other screen.
- The wake lock is an accessibility feature in practice — a screen that sleeps mid-routine forces the
  user to re-authenticate one-handed outdoors.
- **Gap:** the capture zones convey accept state through a 220ms flash and audio/haptics. With audio
  silenced and haptics unsupported (iOS Safari), a low-vision user has only the flash.
- **Gap:** overlays (`DiagnosticZonePicker`, `EditTallyDrawer`, `FatigueCheckin`) are page-level
  conditional renders, not `SheetHost` sheets, so they do not inherit its focus-return and inert
  background behavior.

## 9. Events and telemetry

Writes lifecycle events through the InstantLaunch activity bridge (`PHASE_A_ARCHITECTURE.md` § 2).
`putt_events` rows carry outcome, distance, miss zone, putter, and pressure flag — only genuine
tap/gesture capture sets `is_pressure = true`. Clutch stages fire a browser notification through
`showClutchNotification`. Match mode speaks coaching callouts through `usePuttAudio.speakCallout`,
gated by `evaluateMatchMode` and the house intervention threshold — never off a single event. Post-run,
`awardPostSession` grants XP keyed by run id and evaluates badges by `earned_at`, both idempotent, so an
offline finish or a strict-mode double-invoke cannot double-count.

## 10. Tests

### Existing coverage

`instantLaunch/*` (8 files: fsm, stateReducer, sessionReducer, crashRecovery, backoff,
errorClassification, installationId, activityBridge), `regimenScoring`, `drillEngine`, `clutchTimer`,
`matchModeCoach`, `ghostPacing`, `scoringCanvas`, `fatigueCheckin`, `gestureEngine/classify`,
`a10Equivalence`.

The most heavily tested surface in the app — **at the library layer only.** There is no test of
`RegimenRunPage.jsx` itself, so nothing verifies that these tested pieces are wired together correctly.

### Acceptance criteria

1. Start validates the drill contract; an invalid config shows the reason and does not start.
2. A make in tap mode fires audio, haptics, and one `putt_events` row.
3. In diagnostic mode a miss defers its row until a zone is picked or dismissed.
4. Undo removes the last event and deletes its row.
5. A batch-ribbon tap accounts for all remaining volume and does not create `putt_events` rows.
6. Finishing the last stage adds the completion bonus; abandoning does not.
7. Killing and relaunching mid-stage restores stage, tally, running total, and run id with no network.
8. Offline capture queues and flushes exactly once on reconnect.
9. Clutch resting replaces the canvas and disables editing.
10. Match mode never speaks off a single event.

### E2E critical paths

Priority 1 in `TEST_MAP.md` — all three of the data-loss flows live on this screen: crash recovery
resume, offline capture and exactly-once flush, and finalize-to-history integrity. These are the highest
value E2E specs in the repository.

## 11. Tasks

#### T-regimen-active-1 — Add a page-level test for the capture wiring

- **Capability:** `ui-interaction`
- **Touches:** new `src/pages/RegimenRunPage.test.jsx`
- **Done when:** Start → three makes → one miss → finish produces the expected summary row and event
  count, with the write adapter mocked.
- **Verify:** `npm test`
- **Commit:** `test: cover regimen run capture wiring`

#### T-regimen-active-2 — Confirm before abandoning a session with recorded attempts

- **Capability:** `ui-interaction`
- **Touches:** `src/pages/RegimenRunPage.jsx`, `CanvasContextBar.jsx`
- **Done when:** `ctx-exit` with `attempts > 0` requires a confirmation; with zero attempts it exits
  immediately as today.
- **Verify:** `npm test` plus manual mid-session exit.
- **Commit:** `fix: confirm before abandoning a session with recorded putts`
- **Note:** § 12 open question 1 — confirm the interaction cost is acceptable in the field first.

#### T-regimen-active-3 — Route capture overlays through SheetHost

- **Capability:** `ui-interaction`
- **Touches:** `DiagnosticZonePicker.jsx`, `EditTallyDrawer.jsx`, `FatigueCheckin.jsx`
- **Done when:** Each overlay enters focus, returns it to its trigger, and renders the background inert,
  matching `PHASE_A_ARCHITECTURE.md` § 12.
- **Verify:** `npm run lint` plus manual keyboard and VoiceOver pass.
- **Commit:** `fix: give capture overlays proper sheet semantics`

## 12. Open questions

1. **Abandon has no confirmation.** `ctx-exit` ends a session immediately. On a screen explicitly
   designed to be operated without looking, a mis-tap discards the stage. Against that: a confirmation
   step is exactly the friction this screen exists to avoid. Needs a field judgment, not a code opinion.
2. **`ACCEPT_FLASH_MS = 220` is declared three times** — once in each capture zone.
   `COMPONENT_LIBRARY.md` flags this as intentional under the Screen 8 divergence, but a fourth input
   mode would copy it a fourth time.
3. **`SESSION_FACTORS` is declared verbatim twice** — `CanvasContextBar.jsx:10` and
   `SessionContextSummary.jsx:1` — unlike every other option list, which lives in `src/lib/`.

## 13. Blueprint divergence

Blueprint Screen 8 specified **static split-screen tap zones** as primary input while the shipped Track
2.2c canvas used **gesture swipe cones**. `SCREEN_SPECS.md:233-241` flagged this as the one build
decision needing explicit sign-off before Layer 4.

**It was decided and built.** Split-screen tap is primary; gesture demoted to an opt-in mode; panic
added as a third (`DEVLOG.md:1561,1635`). `TapZone` deliberately does **not** grow its hit zones on a
streak the way `GestureZone` does — tap targets do not need it.

`SCREEN_SPECS.md` still describes this as pending. Logged as C-1 in
`docs/ui/_corrections/screen-specs-and-agents.md`.

Also divergent from the blueprint: QR Beam and peer challenge are parked with Social (standing
divergence #8); the weather-swap drawer ships and is data-backed by `putt_events.putter_disc_id` as the
spec required.
