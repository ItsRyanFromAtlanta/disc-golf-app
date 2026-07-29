# Play Root (Putt Hub)

| Field | Value |
|---|---|
| Route id | `play-root` |
| URL pattern | `/practice` |
| Section | `play` |
| Shell | `standard` |
| Header title | `Play` |
| Activity pill | shown |
| Scroll key | `play-root` |
| Preserves nested state | no |
| Page component | `src/pages/PracticeMenuPage.jsx` (279 lines) |
| Blueprint screen | Screen 4 — *Main Dashboard Hub & Routine Launchpad*; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

The PLAY tab's landing screen and the app's launch surface: resume whatever is already running, start
Quick Play in one tap, pick or build a routine, and glance at streak, weekly volume, and the last three
activities. The job the user came to do is *start putting*, so every zone above the fold terminates in a
launch action rather than in navigation.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | PLAY tab tap from any other section | `TabBar` → `resolveSectionRoot('play')` | Primary path |
| In | PLAY tab re-tap while already at `/practice`, at top | `resolveTabPressAction` → navigate to section root | No-op in practice; see `NAVIGATION_MAP.md` § Tab press behavior |
| In | Shell back control from any nested PLAY route | `AppShell.handleBack()` → `/practice` | Back is section-root, not history |
| In | Authenticated visit to `/` | `<Navigate to="/practice" replace />` (`App.jsx:49`) | Sign-in lands here |
| In | `Dashboard` button on a session report | `navigate('/practice')` (`HistoryDetailPage.jsx:186`) | |
| In | Save-for-later from the builder | `navigate('/practice', { replace: true })` (`RoutineBuilderPage.jsx:90`) | `replace: true` — the builder is not left on the stack |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` diverts a zero-bag user to `/onboarding` first |
| Out | Hero resume card | `Link` to `/practice/regimens/:regimenId/run` or `/practice/freeform` | Only rendered for `crash-recovery` / `active-activity` hero kinds |
| Out | `Start Quick Play` | `Link` to `/practice/regimens/:id/run` | Disabled-looking `<span>` when no routine resolves |
| Out | `Free Play` | `Link` to `/practice/freeform` | ACTIVE shell |
| Out | `Launch` on a routine card | `Link` to `/practice/regimens/:id/run` | ACTIVE shell |
| Out | `👯 Clone & Tweak` | `Link` to `/practice/regimens/new?clone=:id` | Query-parameter contract; see § 4 |
| Out | `➕ Build a custom routine` / `Build one →` | `Link` to `/practice/regimens/new` | |
| Out | Suggested-session card | `Link` to `/practice/regimens/:id/run` | |
| Out | Suggested-session fallback | `Link` to `/practice/regimens` | The only in-app link to `regimen-select` |
| Out | Confidence-map shortcut (header icon) | `Link` to `/practice/stats` | |
| Out | `View all` | `Link` to `/practice/history` | |
| Out | `Sign out` | `signOut()` from `AuthContext` | Terminates the session; not navigation |
| Out | Shell back control | — | **Not rendered.** `isRoot` is true here (`AppShell.jsx:41`) |

`preserveNestedState` is `false`; scroll offset is still stored under `play-root` and restored within a
single shell mount (`AppShell.jsx:49-58`).

`useActivityNavigationLifecycle` observes navigation away from an active activity, but this screen is
not itself capture, so nothing here is intercepted.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  Play                        [Resume] [bell 3]        | <- Shell header; no back (section root)
+-------------------------------------------------------+
|  Putt Hub        🔥 4-day streak  [📊]  Sign out      | <- Page header, second h1; see § 8
+-------------------------------------------------------+
|  ZONE A                                               |
|  +-------------------------------------------------+  |
|  | ▶️ Resume session in progress                    |  | <- hero-card-resume; only when hero.kind
|  +-------------------------------------------------+  |    is crash-recovery or active-activity
|  +-------------------------------------------------+  |
|  | (target) Quick Play                             |  |
|  |          C1 Calibration Ladder                  |  |
|  | Default on this device                          |  |
|  | [ Level 1: C1 Calibration Ladder            v ] |  | <- native <select>, per-device default
|  | [          Start Quick Play                   ] |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  ZONE B                                               |
|  Select routine                            Free Play  |
|  [ ★ Standard ](Actv) [ 🛠️ Custom ] [ ➕ New ]         | <- ChipGroup, local state only
|  +-------------------------------------------------+  |
|  | ★★★  C1 Calibration Ladder                      |  |
|  | Four stages, 15ft to 33ft                       |  |
|  | [ Launch ]              [ 👯 Clone & Tweak ]     |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  ZONE C                                               |
|  Suggested next session                               |
|  +-------------------------------------------------+  |
|  | C1 Calibration Ladder                         › |  | <- inline .mode-card markup, not ModeCard
|  | Suggested target: 20 ft                         |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  Recent activity                          View all    |
|  This week: 140 putts                                 |
|  Freeform session                    12/16 · Jul 28   |
|  C1 Calibration Ladder              221 pts · Jul 27  |
|  Regimen run                     In progress · Jul 26 |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  title "Play", activity pill, notification bell — no back control
Page header (.practice-header)
  hdr-title ............ h1, literal "Putt Hub"
  hdr-streak ........... streak pill, rendered only when streak > 0
  hdr-stats ............ icon link to /practice/stats, title "Confidence map"
  hdr-signout .......... Sign out button
Error state (replaces the entire page)
  err-page ............. <p class="form-error">, rendered instead of everything below
Zone A (.dashboard-zone-a)
  hero-resume .......... one card, or nothing; target depends on hero.kind
  qp-name .............. resolved Quick Play routine name, or "No routine available"
  qp-select ............ <select id="quick-play-default">, labelled "Default on this device"
  qp-start ............. Link "Start Quick Play", or a disabled <span>
Zone B (.dashboard-zone-b)
  zb-heading ........... h2 "Select routine"
  zb-freeplay .......... link "Free Play" -> /practice/freeform
  zb-tabs .............. ChipGroup: ★ Standard | 🛠️ Custom | ➕ New
  zb-loading ........... "Loading..." until the regimen list resolves
  zb-card .............. RegimenLaunchCard, one per regimen in the active tab
    zbc-difficulty ..... star badge, difficulty-N class
    zbc-name ........... h3
    zbc-description .... optional
    zbc-launch ......... Link "Launch"
    zbc-clone .......... Link "👯 Clone & Tweak"
  zb-custom-empty ...... "No custom routines yet. Build one →"
  zb-new ............... Link "➕ Build a custom routine" (New tab only)
Zone C (.dashboard-zone-c.play-suggestion-card)
  zc-heading ........... h2 "Suggested next session"
  zc-card .............. inline .mode-card link to the suggested regimen's run route
  zc-fallback .......... link "Choose a routine to establish your baseline" -> /practice/regimens
Recent activity
  ra-heading ........... h2 "Recent activity" + link "View all" -> /practice/history
  ra-loading ........... "Loading..." until history resolves
  ra-empty ............. "No practice logged yet — pick a mode above to get started."
  ra-volume ............ "This week: N putts"
  ra-row ............... up to 3 rows, newest first: label + detail + date
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Putt Hub` | — | — | — | always |
| `hdr-streak` | badge | `🔥 {n}-day streak` | present / absent | — | — | rendered only when `practiceStreak(...) > 0` |
| `hdr-stats` | icon link | `IconChartBar`, `title="Confidence map"` | default / pressed | navigate | `/practice/stats` | always. **No accessible name** — see § 8 |
| `hdr-signout` | button | `Sign out` | default / pressed | `signOut()` | — | always; no confirmation |
| `err-page` | paragraph | error `message` from either fetch | present / absent | — | — | **Replaces the whole page** when either load rejects |
| `hero-resume` | link card | `▶️ Resume session in progress` (crash-recovery) or `▶️ Resume active practice` + `Paused safely for later` \| `In progress` | absent / crash-recovery / active-activity | navigate | regimen run route when a `regimenId` is known, else `/practice/freeform` | `heroCardState()` returns `crash-recovery` or `active-activity`; the `resume-last`, `no-target`, and `first-session` kinds render **nothing** |
| `qp-name` | text | routine name, or `No routine available` | — | — | — | always |
| `qp-select` | select | options `Level {difficulty}: {name}` (system) or `Custom: {name}` | enabled / disabled | `setQuickPlayDefault` → `updateInstantLaunchState(applySetProfileDefaults, …)` | `localStorage` (`discgolf.instantLaunch.v1`) | `disabled` when `quickPlayChoices.length === 0` |
| `qp-start` | link | `Start Quick Play` | enabled / unavailable | navigate | `/practice/regimens/{id}/run` | when `quickPlay.regimen` is null it renders a `<span class="start-button" aria-disabled="true">Quick Play unavailable</span>` — a non-interactive element, not a disabled button |
| `zb-tabs` | chip group | `★ Standard`, `🛠️ Custom`, `➕ New` | active / inactive | local `setZoneBTab` | component state | always; no `aria-pressed` (`ChipGroup` limitation) |
| `zbc-difficulty` | badge | `★` repeated `difficulty` times | — | — | — | `difficulty` may be null for a custom routine → renders empty |
| `zbc-launch` | link | `Launch` | default / pressed | navigate | `/practice/regimens/{id}/run` | always |
| `zbc-clone` | link | `👯 Clone & Tweak` | default / pressed | navigate | `/practice/regimens/new?clone={id}` | always; `routine-builder` consumes `?clone` |
| `zb-custom-empty` | text + link | `No custom routines yet. Build one →` | — | navigate | `/practice/regimens/new` | Custom tab with zero non-archived own routines |
| `zb-new` | link | `➕ Build a custom routine` | default / pressed | navigate | `/practice/regimens/new` | New tab only |
| `zc-card` | link card | regimen name + `Suggested target: {n} ft` | present / fallback | navigate | `/practice/regimens/{id}/run` | rendered when `suggestion.lastRegimenId` matches a regimen in the list |
| `zc-fallback` | link | `Choose a routine to establish your baseline` | — | navigate | `/practice/regimens` | otherwise |
| `ra-volume` | text | `This week: {n} putts` | present / absent | — | — | rendered when `volumeLedger` resolved, inside the non-empty branch |
| `ra-row` | list row | freeform → `Freeform session`; regimen → routine name (or `Regimen run`); detail `{score} pts` or `In progress` | — | — | — | max 3, sorted by timestamp descending |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Sessions, runs, lifecycle activities | `fetchHistory(user.id)` | `lib/history` | Supabase + Dexie mirror | async |
| Regimen list (system + own) | `regimenRepository.list(user.id)` | `lib/repository/regimenRepository` | Supabase, **Dexie fallback** | async |
| Active/paused activity | `useActiveActivity(user.id)` | `hooks/useActiveActivity` | Dexie `liveQuery` | subscription |
| Crash-recovery buffer + profile defaults | `readInstantLaunchState()` | `lib/instantLaunch/storage` | `localStorage` | sync |
| Hero card kind | `heroCardState(state, hasHistory, activeActivity)` | `lib/dashboardHero` | — | **pure** |
| Quick Play resolution + options | `resolveQuickPlayRegimen`, `quickPlayOptions` | `lib/playLaunch` | — | **pure** |
| Streak | `practiceStreak(dates, now)` | `lib/insights` | — | **pure** |
| Weekly / monthly / lifetime volume | `volumeLedger(samples, now)` | `lib/insights` | — | **pure** |
| Suggested next session | `suggestNextSession(runs, distanceSamples, allPuttSamples, now)` | `lib/insights` | — | **pure** |
| Sample shaping | `allPuttSamples`, `distanceSamples` | `lib/history` | — | **pure** |

Signatures in `LIB_API_INDEX.md`. Two independent `useEffect`s fire on `user.id`; they are *not*
combined into a `Promise.all`, so the regimen list and the history feed resolve and render
independently (Zone B and Recent activity each show their own `Loading...`).

`regimenRepository.list()` is the only offline-capable read here: on remote failure it falls back to the
cached Dexie snapshot and only rethrows if the cache is empty (`regimenRepository.js:42-52`).

**Statistical discipline.** `suggestNextSession` composes `confidenceMap`, which classifies a distance
band from its Wilson interval rather than its point estimate — a high make percentage on a small sample
stays `coin-flip`. `wilsonInterval` returns `null` at `attempts <= 0`; on this screen that path is
unreachable because `confidenceMap` skips zero-attempt samples, and `suggestWarmupDistance` falls back
to `DEFAULT_STARTING_DISTANCE_FT` (10) when there are no bands at all.

### Writes

| Mutation | Call | Notes |
|---|---|---|
| Quick Play device default | `updateInstantLaunchState(applySetProfileDefaults, { quickPlayRegimenId })` | `localStorage` only, **per device** — no Supabase row, no outbox, no cross-device sync |
| Sign out | `signOut()` from `AuthContext` | Not a screen mutation |

No repository write path is exercised, so `PHASE_A_ARCHITECTURE.md` § 14's transaction contract does not
bind this screen.

### Offline

Mixed. `regimenRepository.list` serves Zone B from Dexie when the network is gone, and
`useActiveActivity` is a local `liveQuery`, so the resume hero and the launchpad still work. `readInstantLaunchState`
is `localStorage` and always works. But `fetchHistory` awaits Supabase directly, so Recent activity,
the streak badge, the weekly volume line, and the suggested-session card all fail — and because
`PracticeMenuPage.jsx:62` routes that rejection into the same `error` state as the regimen load, `err-page`
**replaces the entire screen**, including the parts that would have worked offline.

None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 is rendered anywhere on this screen.
Tracked in § 12.

## 6. Flow paths

**Happy path.** Arrive from the PLAY tab → both effects resolve → hero (if any), Quick Play, launchpad,
suggestion, and recent activity render → tap `Start Quick Play` → `/practice/regimens/:id/run` under the
ACTIVE shell.

**First run / empty.** A brand-new account has zero runs and zero sessions but a non-empty regimen list
(system regimens seeded by migration). So: no hero card (`heroCardState` returns `first-session`, which
this page renders as nothing), Quick Play resolves to the Level 1 system regimen via
`resolveQuickPlayRegimen`'s `level-1` reason, Standard tab lists the system regimens, Custom tab shows
`No custom routines yet. Build one →`, Zone C shows `zc-fallback`, and Recent activity shows
`No practice logged yet — pick a mode above to get started.` The screen is never blank.

**Error.** Either rejection renders `<p class="form-error">{message}</p>` as the whole page — no header,
no retry, no tab-bar-reachable content beyond the shell. Recovery requires navigating away and back, or
reloading. This is the same defect recorded for `disc-detail` (`screens/disc-detail.md` § 6), and here it
is worse because a *partial* failure (history down, regimens cached) still blanks the launchpad.

**Offline.** As § 5: the screen degrades to the full-page error rather than to a cached launchpad.
§ 12's rule that "a network failure never replaces active capture with a full-screen error" does not
strictly bind — this is not capture — but the calm-state contract in the same section is unmet.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced unconditionally
(`PracticeMenuPage.jsx:60,67`), so there is no anonymous rendering path. `useOnboardingGate` diverts a
never-onboarded (zero-bag) user to `/onboarding` before this screen mounts.
`useCrashRecoveryRedirect` may redirect a relaunched PWA past this screen into an active capture route.

**Interlock.** **N/A** — this screen enforces no cap. The 100-putt ceiling belongs to `routine-builder`
and the 35-disc cap to the DISCS section.

**Destructive.** `Sign out` is the only irreversible control and has no confirmation step. It sits in the
page header, one tap away, beside the stats shortcut. Not a § 12 violation on its face (§ 12's rule is
that destructive actions do not sit beside *scoring* actions), but it is the only destructive control in
the PLAY section and it is unguarded.

Shared state behavior would normally be referenced by id from `STATE_MATRIX.md`; that file does not exist
(`_corrections/play-screens.md` P-10), so the states above are described inline.

## 7. Dependencies

### Schema

`putting_regimens` (`user_id` null = system, `difficulty`, `name`, `description`, `archived`,
`drill_type`, `rules_config` — all added by `layer1_foundation_schema.sql:85-92`), `putting_regimen_runs`,
`putt_sessions`, `putt_distance_logs`, `putting_regimen_run_sets`, and `activities` (read through
`fetchHistory`). No writes.

### Library

`lib/history` (`fetchHistory`, `allPuttSamples`, `distanceSamples`), `lib/insights`
(`practiceStreak`, `volumeLedger`, `suggestNextSession`), `lib/dashboardHero` (`heroCardState`),
`lib/playLaunch` (`quickPlayOptions`, `resolveQuickPlayRegimen`), `lib/instantLaunch/storage` +
`stateReducer` (`readInstantLaunchState`, `updateInstantLaunchState`, `applySetProfileDefaults`),
`lib/repository/regimenRepository`, `hooks/useActiveActivity`. Signatures in `LIB_API_INDEX.md`.

### Components

`ChipGroup` only. `RegimenLaunchCard` is a file-local component
(`PracticeMenuPage.jsx:28-46`), not a shared one. **`ModeCard` is not used** even though Zone C
hand-writes its markup — see § 12.

### Screens

Links out to `freeform-active`, `regimen-active`, `routine-builder`, `regimen-select`,
`practice-history`, and `practice-stats`. It is the shell-back destination for every nested PLAY route
and the post-authentication landing screen.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 11 (PLAY hierarchy — "PLAY orders: resume active/paused activity; Quick
Play; select routine; create routine; suggested next session; recent activity; History", and "Quick Play
uses Level 1 unless the profile default or its adjacent selector changes it"), § 12, § 13. No blocking
ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Gap — two `<h1>`s.** The shell renders `<h1>Play</h1>` (`GlobalHeader.jsx:13`) and the page renders
  `<h1>Putt Hub</h1>` (`PracticeMenuPage.jsx:142`). A screen-reader user hears two different page
  titles. Systemic across the PLAY section; logged as `_corrections/play-screens.md` P-7.
- **Gap — `hdr-stats` has no accessible name.** It is a `<Link>` wrapping only `<IconChartBar>`, with a
  `title` attribute and no `aria-label`. `title` on a link is announced inconsistently, and the Tabler
  icon contributes no text.
- **Gap — `qp-start`'s unavailable state is a `<span aria-disabled="true">`** styled as a button
  (`PracticeMenuPage.jsx:198`). It is not focusable and has no role, so assistive tech encounters
  unlabelled text where sighted users see a disabled primary action.
- **Gap — `zb-tabs` conveys selection by class only.** `ChipGroup` emits plain `<button>`s with a
  `chip-active` class and no `aria-pressed`/`role="tab"` (`COMPONENT_LIBRARY.md` § Gaps item 10).
- **Good — `qp-select` has a real `<label htmlFor="quick-play-default">`** (`PracticeMenuPage.jsx:180`).
  This is the pattern to copy.
- **Good — the Quick Play icon is `aria-hidden="true"`** and the Zone C chevron is a literal `›` marked
  `aria-hidden`, so neither is announced.
- The streak badge and the difficulty badge both carry text (`4-day streak`, repeated `★`), so neither
  relies on color alone.

## 9. Events and telemetry

**Metrics.** None emitted. The screen *consumes* computations that correspond to registry entries
`practice.volume` (the `This week: N putts` line) and `putting.make_pct` (indirectly, through
`suggestNextSession` → `decayWeightedForm`), per `PHASE_A_ARCHITECTURE.md` § 5 — but it does so through
`lib/insights` directly, without going through `metricEligibleHistory`. **`fetchHistory` is used raw
here**, so hidden activities are excluded (they are filtered inside `fetchHistory`) but *incomplete*
activities do contribute to streak, volume, and the recent list. That is intentional for a "what have I
been doing" surface and is a divergence from how `practice-stats` computes.

**Notifications.** None produced or consumed by the page. The shell's bell (badge count via
`useNotifications`) renders above it but belongs to `AppShell`.

**Lifecycle events.** None written. `useActiveActivity` subscribes to the local mirror read-only.

## 10. Tests

### Existing coverage

`src/lib/dashboardHero.test.js`, `src/lib/playLaunch.test.js`, `src/lib/insights/insights.test.js`,
`src/lib/history.test.js`, `src/lib/instantLaunch/stateReducer.test.js`,
`src/lib/repository/regimenRepository.test.js`. Confirmed by reading the page's imports; matches
`TEST_MAP.md` § PLAY and adds `history`, `stateReducer`, and `regimenRepository` to that row.

**There is no component or page test for `PracticeMenuPage.jsx`.** Nothing asserts the zone ordering,
the hero priority chain's *rendering*, the Standard/Custom filter predicates, or the three-row cap on
recent activity.

### Acceptance criteria

1. With an active `putting_regimen` activity carrying a `regimenId`, the hero links to that regimen's
   run route; with an active `putting_freeform` activity it links to `/practice/freeform`.
2. With `crashRecoveryBuffer.hasActiveSession` true, the crash-recovery hero wins over the
   active-activity hero.
3. With neither, **no hero renders at all** — `resume-last`, `no-target`, and `first-session` are
   silently dropped by the page's ternary chain.
4. `Custom` lists only routines where `user_id === user.id && !archived`; `Standard` lists only
   `user_id == null`.
5. Choosing a Quick Play default persists across reload on the same device and does **not** appear on a
   second device.
6. With zero launchable regimens, `qp-select` is disabled and `Quick Play unavailable` renders.
7. Recent activity shows at most three rows, newest first, mixing sessions and runs.
8. A `fetchHistory` rejection blanks the entire page — **currently there is no way to retry without a
   reload.**

### E2E critical paths

Sign in → land on `/practice` → Quick Play → record a putt → navigate away → return to `/practice` and
see the resume hero. Set a Quick Play default → reload → verify persistence. Kill the tab mid-session →
relaunch → verify the crash-recovery hero. Offline load with a warm Dexie regimen cache → verify (today,
*fail to* verify) that the launchpad still renders. No automated browser E2E suite exists
(`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing coverage.

## 11. Tasks

#### T-play-root-1 — Stop a history failure from blanking the launchpad

- **Capability:** `ui-routine`
- **Touches:** `src/pages/PracticeMenuPage.jsx`
- **Done when:** A `fetchHistory` rejection renders an inline, dismissible error inside the Recent
  activity region while Zone A, Zone B, and Zone C continue to render from the regimen list; a
  `regimenRepository.list` rejection likewise degrades only Zone B. Neither replaces the page.
- **Verify:** `npm test` with a new page-level test that rejects `fetchHistory` and asserts
  `Start Quick Play` is still present.
- **Commit:** `fix: degrade practice menu regions independently on load failure`

#### T-play-root-2 — Remove the duplicate page-level `<h1>` across PLAY

- **Capability:** `ui-routine`
- **Touches:** `src/pages/PracticeMenuPage.jsx`, `src/pages/RegimenSelectPage.jsx`,
  `src/pages/RoutineBuilderPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/ConfidenceMapPage.jsx`,
  `src/components/sessionReport/SessionReport.jsx`
- **Done when:** Each PLAY screen exposes exactly one `<h1>`; the shell's route title is authoritative
  and in-page headings are `<h2>` or non-heading eyebrow text. Visual layout is unchanged.
- **Verify:** `npm run lint`, plus a manual pass with VoiceOver rotor set to Headings on each of the six
  routes.
- **Commit:** `fix: one h1 per screen in the PLAY section`
- **Blocked by:** nothing; see `_corrections/play-screens.md` P-7.

#### T-play-root-3 — Write `docs/ui/STATE_MATRIX.md` or drop its references

- **Capability:** `docs`
- **Touches:** `docs/ui/STATE_MATRIX.md`, `docs/ui/TEMPLATE.md`, `docs/ui/README.md`,
  `docs/ui/TASK_FORMAT.md`
- **Done when:** Either the file exists with ids the screen documents can cite (starting with the
  `S-EMPTY` id `TASK_FORMAT.md:93` already references), or all three references are removed and
  `TEMPLATE.md` § 7 tells authors to describe states inline.
- **Verify:** `grep -rn STATE_MATRIX docs/` resolves to an existing file, or returns nothing.
- **Commit:** `docs: add the UI state matrix`

#### T-play-root-4 — Give the confidence-map shortcut an accessible name

- **Capability:** `ui-routine`
- **Touches:** `src/pages/PracticeMenuPage.jsx`
- **Done when:** `hdr-stats` exposes `aria-label="Practice insights"`; the visual icon-only treatment is
  unchanged.
- **Verify:** `npm run lint` and a manual VoiceOver pass on `/practice`.
- **Commit:** `fix: label the practice insights shortcut`

## 12. Open questions

1. **Three `heroCardState` kinds render nothing.** `dashboardHero.js` returns `resume-last`,
   `no-target`, and `first-session`, and `PracticeMenuPage.jsx:155-170` handles only `crash-recovery`
   and `active-activity`. `resume-last` in particular is the blueprint's "Instant Replay" hero. The
   page's own comment (`PracticeMenuPage.jsx:75-80`) explains that `smartPredictionCard` is never
   written, so `resume-last` is unreachable today — but `no-target` and `first-session` are reachable and
   deliberately blank. Is the blank state intended, or is copy missing?
2. **Quick Play's default is device-local by design or by omission?** `applySetProfileDefaults` writes
   to `localStorage` under a key named `profileDefaults`, and the label reads `Default on this device`.
   `PHASE_A_ARCHITECTURE.md` § 11 says "Quick Play uses Level 1 unless **the profile default** or its
   adjacent selector changes it," which reads as a server-side profile setting. Needs a decision before
   multi-device sync work.
3. **`ModeCard` is dead while Zone C inlines its markup.** Already logged —
   `_corrections/component-library.md` § 2 (`AGENTS.md:106` claims mode cards are a reusable component
   and that adding a mode is a one-line addition; `PracticeMenuPage.jsx:239-244` hand-writes the markup,
   drops the Tabler icon, and substitutes a literal `›`). Not re-logged here. The decision it blocks:
   migrate Zone C to `ModeCard`, or delete `ModeCard` and restate `AGENTS.md:106` as a CSS convention.
4. **`Sign out` lives on two PLAY pages and nowhere else in the section.** Here and on
   `regimen-select` (`RegimenSelectPage.jsx:45`). Settings owns account actions elsewhere. Is this
   deliberate or leftover?
5. `_corrections/play-screens.md` P-7 (double `<h1>`) and P-10 (missing `STATE_MATRIX.md`) both touch
   this screen.

## 13. Blueprint divergence

Blueprint Screen 4 is *Main Dashboard Hub & Routine Launchpad* (`MASTER_PROJECT_BLUEPRINT.md:263-315`).
`SCREEN_SPECS.md:134-152` records "no divergence of substance." The shipped page matches the *shape*
closely — streak badge, Zone A hero, 3-way segmented launchpad with Clone & Tweak, Zone C creation entry,
4-tab bar — with these differences:

| Blueprint Screen 4 feature | Shipped reality |
|---|---|
| `⚡ QUICK START: FREE PLAY` as a saturated Zone A action block | Free Play demoted to a `.link-button` in the Zone B heading row (`PracticeMenuPage.jsx:206`). Zone A's second card is **Quick Play (a routine)**, which the blueprint did not have |
| `▶️ RESUME LAST: <routine> / Target: <disc>` reading the last config from Dexie | Only *live* resume ships. The last-config hero (`resume-last`) is implemented in `dashboardHero.js` but unreachable and unrendered; no target disc is shown |
| Standard cards display total putts (`[ 40 / 100 PUTTS ]`) | Cards show a difficulty star badge and description; **no putt count** — `RegimenLaunchCard` never reads the set rows |
| Zone C = *Custom Planning Drawer*, a bottom sheet with numeric steppers | Zone C is a **suggested next session** card. The planning drawer was not built; the suggestion card is a post-blueprint addition driven by `suggestNextSession` |
| Tab bar `[ 🏠 PLAY ] [ 💼 BAGS ] [ 📊 STATS ] [ 👤 PRO ]` | `PLAY / DISCS / COURSES / ME` — standing divergence #5; the STATS tab is obsolete |
| Streak pill tap opens a milestone modal | Streak pill is inert text |
| `[⚙️]` settings affordance in the top header | Replaced by a stats shortcut and a `Sign out` button |

Standing divergences #1 (React/Vite, not Expo) and #5 (four tabs, no STATS tab) apply; see
`SCREEN_SPECS.md` § Standing divergences.

The Zone C substitution is the one worth flagging: `SCREEN_SPECS.md:147` lists the "planning drawer
bottom sheet" as NET-NEW and unqualified, so a reader of that document expects a sheet that does not
exist.
