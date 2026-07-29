# Me (Career Hub)

| Field | Value |
|---|---|
| Route id | `me-root` |
| URL pattern | `/profile` |
| Section | `me` |
| Shell | `standard` |
| Header title | `Me` |
| Activity pill | shown |
| Scroll key | `me-root` |
| Preserves nested state | no |
| Page component | `src/pages/CareerHubPage.jsx` (57 lines) |
| Blueprint screen | Screen 11 — distributed, not standalone; see § 13 |
| Verified against | `7351964` |

**`/profile` renders `CareerHubPage`, not `ProfilePage`.** This is the single most counter-intuitive
fact in the ME section and it trips up every reader who assumes the URL names the component. The ME
tab opens on a takeaway-first analytics summary; the editable identity fields live one level down at
`/profile/details` (`src/App.jsx:80-87`, `docs/ui/screens/profile-details.md`).

## 1. Purpose

The career-wide summary: who the player is, how much they have putted in total, how their five skill
axes score on personal evidence, and which physical putter has earned the most trust. It is the
answer to "how am I doing overall," and the launchpad to every other ME destination.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | ME tab press from another section | `TabBar` → `resolveSectionRoot('me')` | Primary path |
| In | ME tab press while already on a nested ME route and scrolled to top | `TabBar` three-state press | Returns to this route; see `NAVIGATION_MAP.md` § Tab press behavior |
| In | Shell back control from any nested ME route | `GlobalHeader` → `handleBack()` → section root | Back is **not** history; it always lands here |
| In | `Pro` link in the Trophy Room page header | `Link` from `/profile/trophies` | `TrophyRoomPage.jsx:64-66`. The label reads `Pro`, not `Profile` — see § 12 |
| In | Weekly-report notification with no `payload.href` | `notificationDestination()` → `/profile` | `src/lib/notifications.js:28`. Lands here, **not** on `/profile/reports` — see § 12 |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; a never-onboarded user is intercepted by `useOnboardingGate` first |
| Out | `Trophies` | `Link` to `/profile/trophies` | `CareerHubPage.jsx:30` |
| Out | `Edit profile` | `Link` to `/profile/details` | `CareerHubPage.jsx:31` |
| Out | `Settings` | `Link` to `/profile/settings` | `CareerHubPage.jsx:32` |
| Out | `Goals` | `Link` to `/profile/goals` | `CareerHubPage.jsx:33` |
| Out | `Reports` | `Link` to `/profile/reports` | `CareerHubPage.jsx:34` |
| Out | Any other tab | `TabBar` | Standard |

No back control renders here: `isRoot` is true because `resolveSectionRoot('me') === '/profile'`
(`AppShell.jsx:41,89`).

`preserveNestedState` is `false`. The scroll position is still stored under `me-root` in the shell's
ref map and restored within a single shell mount, but is not treated as resumable state.

**There is no link to History and no link to contextual analytics** (`/practice/stats`), both of which
`PRODUCT_ROADMAP.md:28-29` says ME links to. Logged as C-1 in
`docs/ui/_corrections/me-screens.md`.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  Me                                    [activity pill]| <- Shell header, no back (section root)
+-------------------------------------------------------+
|  [Trophies][Edit profile][Settings][Goals][Reports]   | <- .career-actions, 5 link-buttons, one row
+-------------------------------------------------------+
|  ( 🥏 )  RYANFROMATLANTA                    [Linked]  | <- h1 = username || email prefix || "Player"
|          PDGA #142899 · MA2                           | <- or "PDGA number not linked"
|          Current —          Target 900                | <- Current is ALWAYS "—"; see § 12
|          [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  0%        | <- progress always 0; see § 12
+-------------------------------------------------------+
|  Career telemetry                                     |
|  +-------------+ +-------------+ +-------------+      |
|  |   14,250    | |    84%      | |     212     |      | <- .career-stat-grid, 3 articles
|  | Lifetime    | | Lifetime    | | Practice    |      |
|  | putts       | | conversion  | | sessions    |      |
|  +-------------+ +-------------+ +-------------+      |
+-------------------------------------------------------+
|  Skill radar                                          |
|  Personal evidence only; division benchmarks remain   | <- .career-note, permanent caveat
|  unavailable.                                         |
|         C1 accuracy                                   |
|            /\                                         |
|   Wind    /  \    C2 putting                          | <- SkillRadar, 5 fixed axes
|      \   /____\   /                                   |
|       \ /      \ /                                    |
|  Endurance    Bag balance                             |
|  C1 accuracy .......... 82/100                        | <- text legend, "Insufficient data" when null
|  C2 putting ........... Insufficient data             |
+-------------------------------------------------------+
|  Most trusted putter                                  |
|  Axiom Cosmic Pilot                                   |
|  4,820 chain hits · 88% across 512 attributed putts   | <- or the batch-attribution caveat copy
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  title "Me", activity pill, notification bell; no back control
Page (section.career-page)
  Action row (.career-actions)
    act-trophies ......... link → /profile/trophies, label "Trophies"
    act-profile .......... link → /profile/details, label "Edit profile"
    act-settings ......... link → /profile/settings, label "Settings"
    act-goals ............ link → /profile/goals, label "Goals"
    act-reports .......... link → /profile/reports, label "Reports"
  Identity (section.career-identity, aria-labelledby="career-player-name")
    id-avatar ............ 🥏 glyph, aria-hidden
    id-name .............. h1#career-player-name
    id-pdga .............. PDGA number + division line
    id-linked ............ "Linked" badge, rendered only when pdga_number is truthy
    id-current ........... "Current <current_rating ?? —>"
    id-target ............ "Target <target_rating ?? —>"
    id-progress .......... .career-progress bar with aria-label
  Career telemetry
    tel-heading .......... h2 "Career telemetry"
    tel-attempts ......... lifetime putt attempts
    tel-accuracy ......... lifetime conversion percentage
    tel-sessions ......... practice session count (sessions + regimen runs)
  Skill radar (section.career-panel)
    rad-heading .......... h2 "Skill radar"
    rad-note ............. benchmark caveat copy
    rad-svg .............. SkillRadar pentagon
    rad-legend ........... one row per axis: label + score or "Insufficient data"
  Most trusted putter (section.career-panel)
    putt-heading ......... h2 "Most trusted putter"
    putt-card ............ disc name + chain hits + attributed accuracy
    putt-empty ........... attribution caveat copy when no putter qualifies
Page-replacing states (mutually exclusive with everything above)
  state-error .......... p.form-error "Career summary unavailable: <message>"
  state-loading ........ p.loading "Loading career summary…"
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `act-trophies` | link | `Trophies` | default / pressed | navigate | `/profile/trophies` | always |
| `act-profile` | link | `Edit profile` | default / pressed | navigate | `/profile/details` | always |
| `act-settings` | link | `Settings` | default / pressed | navigate | `/profile/settings` | always |
| `act-goals` | link | `Goals` | default / pressed | navigate | `/profile/goals` | always |
| `act-reports` | link | `Reports` | default / pressed | navigate | `/profile/reports` | always |
| `id-avatar` | glyph | `🥏` | — | — | — | always; `aria-hidden="true"` |
| `id-name` | h1 | `profile.username` ‖ email local-part ‖ `Player` | — | — | — | always; three-step fallback at `CareerHubPage.jsx:38` |
| `id-pdga` | text | `PDGA #<n>` ‖ `PDGA number not linked`, then ` · <division>` when set | linked / unlinked | — | — | always |
| `id-linked` | badge | `Linked` | present / absent | — | — | rendered only when `profile.pdga_number` is truthy |
| `id-current` | text | `Current <value>` | value / `—` | — | — | **always `—` in the shipped app** — reads `profile.current_rating`, a column that does not exist. § 12 |
| `id-target` | text | `Target <value>` | value / `—` | — | — | `profiles.target_rating`, editable at `/profile/details` |
| `id-progress` | meter | inline `width: <pct>%`; `aria-label` is `Rating progress <n>%` or `Rating progress unavailable` | filled / unavailable | — | — | **always unavailable** — depends on `current_rating`. § 12 |
| `tel-attempts` | stat | `<n>` + `Lifetime putts` | — | — | — | `toLocaleString()`; `0` when there is no practice history |
| `tel-accuracy` | stat | `<n>%` + `Lifetime conversion` | value / `—` | — | — | `—` when attempts is 0 |
| `tel-sessions` | stat | `<n>` + `Practice sessions` | — | — | — | counts `sessions.length + runs.length` |
| `rad-note` | text | `Personal evidence only; division benchmarks remain unavailable.` | — | — | — | always — a permanent honesty caveat, not an empty state |
| `rad-svg` | chart | `role="img"`, `aria-label="Five-axis career skill radar"` | — | — | — | always; geometry hardcoded to 5 axes |
| `rad-legend` | list | per axis: label + `<score>/100` or `Insufficient data` | scored / insufficient | — | — | `null` score plots at the pentagon center |
| `putt-card` | card | disc name, `<n> chain hits · <n>% across <n> attributed putts` | present / absent | — | — | requires a disc with `role` in `primary_putter`/`backup_putter` **and** ≥1 attributed `putt_events` row |
| `putt-empty` | text | `Log real-time putts with a selected putter to unlock this audit. Batch totals cannot be attributed to a physical disc.` | — | — | — | shown when no putter qualifies |
| `state-error` | page | `Career summary unavailable: <message>` | — | — | — | replaces the entire page; no retry control. § 6 |
| `state-loading` | page | `Loading career summary…` | — | — | — | replaces the entire page until `fetchCareerData` settles |

The five action links are plain `.link-button` anchors laid out in one `.career-actions` row. They are
not chips and carry no selected state.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Profile row, practice sessions, regimen runs, discs, attributed putt events | `fetchCareerData` | `lib/repository/careerRepository` | Supabase (5 parallel queries) | async |
| Lifetime totals, 5 radar axes, session count, trusted putter | `buildCareerSummary` | `lib/careerSummary` | — | **pure** |
| Per-distance make/attempt samples | `distanceSamples` | `lib/history` | — | **pure**, called by `buildCareerSummary` |
| Per-putter accuracy | `putterBreakdown` | `lib/insights/putterBreakdown` | — | **pure**, called by `buildCareerSummary` |

Signatures in `LIB_API_INDEX.md`. `fetchCareerData` issues one `Promise.all` over `profiles`,
`putt_sessions` (with nested `putt_distance_logs`), `putting_regimen_runs` (with nested run sets and
set definitions), `discs` (with `moldInfo` joined from `disc_molds`), and `putt_events` filtered to
rows with a non-null `putter_disc_id`. Any query error rejects the whole call.

The effect re-runs on `user.id` change only (`CareerHubPage.jsx:16-18`). There is no refetch on focus,
no polling, and no cache — navigating away and back re-mounts and re-fetches.

### Writes

**N/A** — this screen is read-only. Every mutation it implies is performed on another screen:
`target_rating` at `/profile/details`, XP and badges by `evaluateAndPersistBadges` on save paths and
in `/profile/trophies`, disc roles on `/bag`.

### Offline

`fetchCareerData` awaits Supabase directly with no Dexie mirror
(`LIB_API_INDEX.md` classifies `repository/careerRepository.js` as **Supabase only**). With no network
the promise rejects and the page renders `state-error` as the whole page. Nothing is queued, nothing is
cached, and none of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`,
`Syncing`, `Synced`, `Needs Attention`) is displayed anywhere on this screen. Since this is not active
capture, § 12's "a network failure never replaces active capture with a full-screen error" does not
strictly bind — but the absence of any retry affordance is a real gap. See § 11 T-me-root-1.

## 6. Flow paths

**Happy path.** ME tab press → `CareerHubPage` mounts → `fetchCareerData(user.id)` resolves →
`buildCareerSummary` derives → identity, telemetry, radar, and trusted-putter panels render → the user
taps one of the five action links into a nested ME screen.

**First run / empty.** A brand-new account has a `profiles` row (or `{}` if the query returned no row —
`careerRepository.js` coerces `profile.data ?? {}`), zero sessions, zero discs. Result: `id-name` falls
back to the email local-part, `id-pdga` reads `PDGA number not linked`, both rating values read `—`,
telemetry reads `0` / `—` / `0`, all five radar axes read `Insufficient data` and plot at the center,
and `putt-empty` renders. Nothing crashes and no section is hidden — the page is uniformly honest about
having no evidence.

Most of that is `S-INSUFFICIENT`, not `S-EMPTY`, and the distinction is the row's whole point.
`SkillRadar.jsx:25` and `CareerHubPage.jsx:50` (`Personal evidence only; division benchmarks remain
unavailable.`) are both named instances, and the `—` readouts are the row's `pct()`-helper pattern. The
row rates this the strongest state in the codebase and records no divergence; this screen is a clean
example of it rather than an exception.

**Error.** `S-ERR-BLOCK` — any of the five queries failing renders `<p className="form-error">Career
summary unavailable: {error}</p>` **as the entire page** — no header content, no retry (`S-RETRY`), no
navigation other than the shell tab bar. `CareerHubPage.jsx:20` is one of the thirteen **unguarded**
instances: there is no `&& !data` test, so an error wins over an already-resolved summary. Recovering
requires a tab round-trip or a reload. This screen has no `S-ERR-INLINE` path at all — every failure is
total.

**Offline.** `S-OFFLINE-READ`, and this screen is the row's sharpest instance: `careerRepository` has
**no cache**, so the ME landing screen cannot render offline at all. Identical to the Error path; no
cached rendering exists, so `S-STALE` never arises and none of `S-SYNC`'s four calm labels is
displayable. As § 5.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the whole shell and redirects to `/login`
with no explanatory copy and no preserved return destination, per the row. `user.id` is dereferenced
unconditionally at `CareerHubPage.jsx:17-18`, so there is no anonymous rendering path. A Supabase
anonymous ("guest") session is a real user with a real id and renders normally — consistent with
`S-GUEST`, whose single consumer is `AuthPage`: no screen in ME branches on `isGuest`, so a guest sees
an ordinary career hub with no conversion nudge. `S-ONBOARD` — `useOnboardingGate` redirects a
never-onboarded user to `/onboarding` before this route paints, and fails open on a fetch rejection.

**Interlock.** **N/A** — no cap or constraint is enforced or displayed on this screen.

**Destructive.** **N/A** — no destructive action exists here. Account deletion lives on
`/profile/settings`.

## 7. Dependencies

### Schema

`profiles` (`username`, `pdga_number`, `division`, `target_rating`; the page also reads
`current_rating`, **which does not exist** — the shipped column is `pdga_rating`,
`layer1_foundation_schema.sql:50`). `putt_sessions` + `putt_distance_logs`,
`putting_regimen_runs` + `putting_regimen_run_sets` + `putting_regimen_sets`, `discs`
(`role`, `status`, `total_chain_hits`, `mold_id` → `disc_molds`), `putt_events.putter_disc_id`
(added by `layer1_foundation_schema.sql:58`, nullable — batch-logged putts never populate it, which is
exactly why the trusted-putter audit can be empty).

### Library

`lib/repository/careerRepository` (`fetchCareerData`), `lib/careerSummary` (`buildCareerSummary`),
`lib/history` (`distanceSamples`), `lib/insights/putterBreakdown` (`putterBreakdown`). Signatures in
`LIB_API_INDEX.md`.

### Components

`SkillRadar` — the only component this page imports. Details in `COMPONENT_LIBRARY.md`.

### Screens

Links out to all five other ME screens. Linked in from `trophy-room` (the `Pro` link) and from the
notification sheet for `weekly_report` notifications. Depends on `/bag`'s role assignment
(`PutterLineup`) for the trusted-putter audit to have candidates at all, and on real-time putting
capture (`freeform-active`, `regimen-active`) writing `putt_events.putter_disc_id` for it to have
evidence.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 5 (metric registry — the radar axes are computed by tested pure functions,
exactly the "compute individual views with tested pure functions initially" rule), § 12
(presentation/accessibility), § 13 (shell boundaries). No blocking ADR.

The distributed-Screen-10/11 ruling (owner, 2026-07-29) is recorded as C-2 in
`docs/ui/_corrections/screen-specs-and-agents.md`; this screen depends on it and does not re-argue it.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- The radar SVG carries `role="img"` and `aria-label="Five-axis career skill radar"` **and** a full
  text legend listing every axis with its score or `Insufficient data`. This satisfies § 12's
  "text/data alternatives for charts" — it is the best chart alternative in the ME section and the
  pattern other screens should copy.
- `.career-progress` carries a real `aria-label` that switches between `Rating progress <n>%` and
  `Rating progress unavailable` rather than exposing a bare decorative bar.
- `career-identity` is `aria-labelledby="career-player-name"`.
- **Gap — duplicate `<h1>`.** `GlobalHeader.jsx:13` renders the route title as an `<h1>`, and
  `CareerHubPage.jsx:38` renders a second `<h1>` for the player name. Every screen reached through the
  standard shell has two level-1 headings.
- **Gap — no `<main>` landmark.** The page renders a bare `<section className="career-page">` into the
  shell's scroll region; § 12 requires "logical landmarks/focus" and no landmark distinguishes page
  content from the header.
- **Gap — the five action links are visually a chip row but semantically five sibling anchors with no
  grouping element or accessible group name.**
- The `Linked` badge conveys state through a badge plus the text `Linked`, so it does not rely on color
  alone.

## 9. Events and telemetry

**N/A** — this screen emits no metrics, writes no lifecycle events (`PHASE_A_ARCHITECTURE.md` § 2), and
produces no notifications (§ 7). It *consumes* one indirectly: a `weekly_report` notification with no
`payload.href` navigates here (`src/lib/notifications.js:28`).

The five radar axes are computed views over existing facts, not registered metrics — they have no
`calculation_version` and are not in the § 5 registry. Sample sizes are computed in
`buildCareerSummary` (`axes[].sampleSize`) but **the page never renders them**; only the score and the
`Insufficient data` fallback reach the UI. § 5's "expose sample size/provenance" is therefore only
half-met here. See § 11 T-me-root-3.

## 10. Tests

### Existing coverage

`src/lib/careerSummary.test.js` — two cases: honest axes plus strongest-evidence putter selection, and
null axes with no putter crowned when attributions are absent. Transitively,
`src/lib/history.test.js` covers `distanceSamples`.

**There is no component or page test for `CareerHubPage.jsx`**, and no test for
`careerRepository.fetchCareerData`. Consistent with `TEST_MAP.md` § The headline: all 74 test files are
under `src/lib/`. Nothing asserts that this page reads the fields it displays — which is precisely how
the `current_rating` defect in § 12 shipped undetected.

### Acceptance criteria

1. An account with no practice history renders every panel with an honest empty readout: `0` lifetime
   putts, `—` conversion, five `Insufficient data` axes, and the trusted-putter caveat copy.
2. A profile with no `username` renders the email local-part as the heading; a profile with neither
   renders `Player`.
3. A profile with a `pdga_number` renders both the `PDGA #<n>` line and the `Linked` badge; without one
   it renders `PDGA number not linked` and no badge.
4. The trusted-putter card appears only for a disc whose `role` is `primary_putter` or `backup_putter`
   **and** which has at least one attributed `putt_events` row; a batch-only history never crowns one.
5. Every one of the five action links navigates to its stated route.
6. A failed load renders `Career summary unavailable: <message>`; **currently there is no way to retry
   without leaving and returning to the route.**
7. *Currently failing.* A profile with a stored current rating and a target rating renders the rating
   and a non-zero progress bar. Today `id-current` always renders `—`. See § 12.

### E2E critical paths

- ME tab press from `/practice` → career hub renders with a seeded account's real totals.
- Each of the five action links → correct destination → shell back control → returns to `/profile`.
- Offline load → error state → reconnect → recovery (currently only via re-navigation).
- Trusted-putter attribution: log real-time putts with a selected putter, then confirm the card
  appears; log a batch session only, and confirm it does not.

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not
existing coverage. See `TEST_MAP.md` § E2E backlog.

## 11. Tasks

#### T-me-root-1 — Fix the current-rating field to read the shipped column

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CareerHubPage.jsx`
- **Done when:** `id-current` and `id-progress` read `profiles.pdga_rating`; a profile with
  `pdga_rating = 850` and `target_rating = 900` renders `Current 850` and a bar at 94% with
  `aria-label="Rating progress 94%"`.
- **Verify:** `npm test` with a new `careerSummary`-adjacent test, or a page-level test asserting the
  rendered value from a fixture profile.
- **Commit:** `fix: read pdga_rating on the career hub rating card`
- **Blocked by:** § 12 open question 1 — confirm `pdga_rating` is the intended field rather than a
  missing `current_rating` column.

#### T-me-root-2 — Add a retry affordance to the career hub error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CareerHubPage.jsx`
- **Done when:** A failed load renders the error plus a `Retry` control that re-runs `fetchCareerData`;
  a succeeding retry renders the summary without a route change or reload.
- **Verify:** `npm test` with a page-level test that rejects `fetchCareerData` once then resolves.
- **Commit:** `fix: allow retry when the career hub fails to load`

#### T-me-root-3 — Surface radar axis sample sizes

- **Capability:** `ui-routine`
- **Touches:** `src/components/SkillRadar.jsx`, `src/pages/CareerHubPage.jsx`
- **Done when:** Each legend row shows its `sampleSize` alongside the score, so a 100/100 built on four
  putts is visibly distinguishable from one built on four hundred.
- **Verify:** `npm run lint` plus a legend assertion in a new component test.
- **Commit:** `feat: show sample size on the career skill radar legend`

#### T-me-root-4 — Add the missing History and analytics links

- **Capability:** `ui-routine`
- **Touches:** `src/pages/CareerHubPage.jsx`
- **Done when:** The action row links to `/practice/history` and `/practice/stats` as
  `PRODUCT_ROADMAP.md:28-29` specifies, or the roadmap line is amended.
- **Verify:** `npm run dev`, manual check of both destinations from `/profile`.
- **Commit:** `feat: link History and Practice Insights from ME`
- **Blocked by:** `docs/ui/_corrections/me-screens.md` C-1 — the roadmap and the code must be
  reconciled in one direction before this lands.

## 12. Open questions

1. **`profile.current_rating` does not exist.** `CareerHubPage.jsx:24,25,41` reads
   `profile.current_rating`. No migration or schema file defines that column; the shipped column is
   `profiles.pdga_rating` (`layer1_foundation_schema.sql:50`, also named in the grant list at
   `layer5_gamification_hardening.sql:175`). Consequences, all currently live: `Current` always renders
   `—`, `ratingProgress` is always `null`, the progress bar always has `width: 0%`, and its
   `aria-label` always reads `Rating progress unavailable`. Compounding it, **no UI anywhere writes
   `pdga_rating`** — `ProfilePage` edits `target_rating` but never a current rating — so even after the
   read is fixed the field has no entry point. Logged as C-2 in `docs/ui/_corrections/me-screens.md`.
2. **`putterBreakdown` is keyed on discs whose `role` is set, but role assignment lives on `/bag`.** A
   player who never opened `PutterLineup` has no `role` on any disc and therefore can never see the
   trusted-putter card, no matter how much real-time evidence exists. Is that intended, or should the
   audit fall back to any disc with attributed putts?
3. **Radar axis scoring mixes units without saying so.** `c1`, `c2`, and `wind` are percentages clamped
   to 0–100; `endurance` is raw attempts-per-session clamped to 0–100 (so 100 attempts per session
   pegs the axis); `bag` is `activeRoles.size / 4 × 100`. Four different meanings share one 0–100
   pentagon. `buildCareerSummary` keeps the raw `value` separately from `score`, but the UI shows only
   `score`. Should the legend distinguish them?
4. **No refetch strategy.** The effect depends on `user.id` alone. Recording a session, then returning
   to ME within the same shell mount, shows stale totals until the component re-mounts. Whether that
   matters depends on whether ME is expected to be live; nothing states an intent.

## 13. Blueprint divergence

Blueprint Screen 11 is *Player Career Hub* (`MASTER_PROJECT_BLUEPRINT.md:633`). This page implements
most of it, but Screen 11 does not exist as a standalone destination — it **is** the ME root, and its
sibling Screen 10 content is scattered across `settings` and `practice-stats`. `SCREEN_SPECS.md:38-39`
still marks Screens 10 and 11 `IN SCOPE`, contradicting its own 2026-07-11 note eighteen lines above;
the owner ruled on 2026-07-29 that the roadmap's distributed model is authoritative. Logged as C-2 in
`docs/ui/_corrections/screen-specs-and-agents.md` — referenced here, not re-logged.

| Blueprint Screen 11 feature | Shipped reality |
|---|---|
| Verified PDGA identity card with a green verified badge | Ships as a plain `Linked` text badge. There is no verification — the badge means only "a number was typed in" |
| Tap the card to open a zero-typing numeric keypad for PDGA entry | **Not built.** PDGA number is an ordinary text `<input>` on `/profile/details` (`ProfilePage.jsx:92-98`) |
| `fetch-pdga-profile` Edge Function scraping official results | Not built — standing divergence #7, PDGA has no public API |
| Current rating (850) vs target (900) with a Canyon Blue fill bar | Bar ships; **the current-rating value never populates.** § 12 open question 1 |
| `⚡ 24 Career Events · 1,420 Official Points` | **Not built.** No event or points data exists in the schema |
| 5-axis radar measured *against division averages* | Radar ships with 5 axes on personal evidence only; the page states so explicitly in `rad-note`. Division benchmarking would need a data source the app does not have |
| Career telemetry: lifetime putts + C1 conversion (last 90d) | Ships as three tiles — lifetime putts, **lifetime** conversion (not 90-day), and practice sessions |
| Most Trusted Putter as a "reactive Dexie.js query" | Ships as a pure derivation over a Supabase fetch; there is no Dexie mirror for career data |
| Header shortcuts to Screen 12 (Trophies) and Screen 13 (UDisc) | Trophies ships in the action row. **UDisc does not exist** — Screen 13 is unbuilt (`SCREEN_INVENTORY.md` § Not in this inventory) |
| Bottom tab bar `PLAY / BAGS / STATS / PRO` | Ships as `PLAY / DISCS / COURSES / ME` — standing divergence #5 |

Standing divergences #1 (React/Vite, not Expo), #3 (append-only schema), #5 (four-tab navigation), and
#7 (manual PDGA entry) apply; see `SCREEN_SPECS.md` § Standing divergences.
