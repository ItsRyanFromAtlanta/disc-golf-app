# Trophy Room

| Field | Value |
|---|---|
| Route id | `trophy-room` |
| URL pattern | `/profile/trophies` |
| Section | `me` |
| Shell | `standard` |
| Header title | `Trophy Room` |
| Activity pill | shown |
| Scroll key | `me-trophies` |
| Preserves nested state | no |
| Page component | `src/pages/TrophyRoomPage.jsx` (87 lines) + five components under `src/components/trophyRoom/` |
| Blueprint screen | Screen 12 — partial; ships without the Social half. See § 13 |
| Verified against | `7351964` |

## 1. Purpose

The progression surface: current RPG level and XP bar with a 30-day ledger, the three badges closest to
unlocking with a one-tap drill launcher, and the full 25-badge wall behind a four-way filter. It is
also the app's **badge reconciliation point** — opening it re-runs the evaluator, so an award that
failed or never ran catches up before anything renders.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Trophies` link on the ME root | `Link` from `/profile` | `CareerHubPage.jsx:30`. The only in-app entry point |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` runs first |
| Out | `Pro` link in the page header | `Link` to `/profile` | `TrophyRoomPage.jsx:64-66`. The label is `Pro`, which appears nowhere else in the app's vocabulary — see § 12 |
| Out | `Launch pursuit drill` on a pursuit card | `navigate('/practice/freeform?distance=<ft>')` | `TrophyRoomPage.jsx:52-55`. **Cross-section navigation into the ACTIVE shell** |
| Out | `Launch pursuit drill` in the inspect drawer | same | Same handler, same query contract |
| Out | Shell back control | `GlobalHeader` → `handleBack()` | Goes to `/profile`, the ME section root |
| Out | Tab re-tap on ME | `TabBar` → `resolveSectionRoot('me')` | Returns to `/profile` |

**Query-parameter contract.** `launchPursuit(distanceFt)` navigates to `/practice/freeform` with
`?distance=<n>` when the badge implies a distance, and with no query string when it does not.
`FreeformLogPage.jsx:62-66` reads it (`Number(searchParams.get('distance')) || null`) and seeds the
launcher's pending distance. This is the **second** query-parameter contract in the shipped app, after
`/bag/lost-found?disc=:discId`; `NAVIGATION_MAP.md:169-172` documents only the first, and in fact
eight parameter contracts ship across seven routes.
Logged as C-6 in `docs/ui/_corrections/me-screens.md`.

The destination is an **active-shell** route (`freeform-active`), so the launch discards the header,
scroll region, and tab bar. Nothing warns the user that a "drill" is a full activity, and nothing
returns them here afterwards.

`preserveNestedState` is `false`. Filter selection, ledger-open state, and the inspected badge are all
component-local and reset on every mount.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Trophy Room                       [activity pill]| <- Shell-owned header
+-------------------------------------------------------+
|  Trophy Room                              [ Pro ]     | <- page h1 (duplicate) + link to /profile
+-------------------------------------------------------+
|  Level 12                            [ 📜 Ledger ]    | <- XpLevelBar
|  [██████████████████░░░░░░░░░░░░░░░░]                 |
|  2,140 / 4,652 XP · 2,512 to Level 13                 | <- or "Max level — N XP" at level 50
+-------------------------------------------------------+
|  Active pursuits                                      | <- ActivePursuits; renders NOTHING when empty
|  +-----------------------+ +-----------------------+  |
|  | 🌪️ Gale Force    82% | | 🔭 Sniper Rifle  60% |  | <- horizontal carousel, top 3
|  | Make 25 putts in     | | Make a putt beyond   |  |
|  | winds above 15 mph.  | | 60 ft.               |  |
|  | [███████████░░░]     | | [████████░░░░░░]     |  |
|  | [ ▶️ Launch pursuit  | | [ ▶️ Launch pursuit  |  |
|  |   drill ]            | |   drill · 60 ft ]    |  | <- distance suffix only when derivable
|  +-----------------------+ +-----------------------+  |
+-------------------------------------------------------+
|  Trophy wall                                          | <- TrophyWall
|  [All (25)][🔓 Unlocked (7)][🎯 In progress (3)]      | <- role=tablist, live counts
|  [🔒 Locked (15)]                                     |
|  +---------+ +---------+ +---------+                  |
|  |   👣    | |   🔥    | |   🎶    |                  | <- badge squares, tier-classed
|  | First   | | Getting | | Chain   |                  |
|  | Steps ✓ | | Warm    | | Music   |                  | <- ✓ when unlocked
|  |         | | [███░░] | | (dim)   |                  | <- inline bar when in progress
|  +---------+ +---------+ +---------+                  |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+

Empty wall under a filter with no matches:
|  Nothing here yet.                                    | <- .trophy-empty

XpLedgerModal (overlay, hand-rolled — not SheetHost):
+-------------------------------------------------------+
|  XP Ledger                              [ Close ]     |
|  +10 XP / make · +50 XP / clean stage · badge unlocks |
|  award bonus XP                                       |
|  Last 30 days                                         |
|  Freeform session    Jul 28        +240 XP            |
|  Badge unlocked      Jul 26      +1,000 XP            |
+-------------------------------------------------------+

BadgeInspectDrawer (overlay, same hand-rolled pattern):
+-------------------------------------------------------+
|  🌪️ Gale Force                          [ Close ]     |
|  gold tier                                            |
|  Make 25 putts in winds above 15 mph.                 |
|  [███████████░░░]  82% complete                       |
|  [ ▶️ Launch pursuit drill ]                          | <- absent when unlocked
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Trophy Room", activity pill
Page (section.trophy-room-page)
  Page header (header.practice-header)
    hdr-title .......... h1 "Trophy Room"
    hdr-pro ............ link → /profile, label "Pro"
  XP card (XpLevelBar)
    xp-level ........... "Level <n>"
    xp-ledger-open ..... chip button "📜 Ledger"
    xp-bar ............. track + fill, width = round(pct × 100)%
    xp-caption ......... "<into> / <span> XP · <toNext> to Level <n+1>" | "Max level — <xp> XP"
  Active pursuits (ActivePursuits) — entire section absent when there are none
    pur-heading ........ h2 "Active pursuits"
    pur-card ........... up to 3 articles, most-complete first
      pur-icon ......... badge emoji, aria-hidden
      pur-name ......... badge name
      pur-pct .......... "<n>%"
      pur-desc ......... badge description
      pur-bar .......... track + fill
      pur-launch ....... button "▶️ Launch pursuit drill" + optional " · <n> ft"
  Trophy wall (TrophyWall)
    wall-heading ....... h2 "Trophy wall"
    wall-filter ........ role="tablist" of 4 role="tab" chips with live counts
    wall-empty ......... "Nothing here yet."
    wall-square ........ one button per visible badge
      sq-icon .......... badge emoji, aria-hidden
      sq-name .......... badge name
      sq-bar ........... inline progress track, in_progress only
      sq-check ......... "✓", unlocked only
Overlays (conditional siblings, never both at once in practice)
  XP ledger (XpLedgerModal) — rendered when ledgerOpen
    led-backdrop ....... .modal-backdrop, click closes
    led-title .......... h2 "XP Ledger"
    led-close .......... link-button "Close"
    led-guide .......... "+10 XP / make · +50 XP / clean stage · badge unlocks award bonus XP"
    led-heading ........ h3 "Last 30 days"
    led-row ............ one per xp_events row: source label, date, signed amount
    led-empty .......... "No XP earned in the last 30 days."
  Badge inspect (BadgeInspectDrawer) — rendered when inspecting is set
    ins-backdrop ....... .modal-backdrop, click closes
    ins-title .......... h2, icon + badge name
    ins-close .......... link-button "Close"
    ins-tier ........... "<tier> tier"
    ins-desc ........... badge description
    ins-earned ......... "🔓 Unlocked <date>", unlocked only
    ins-bar ............ track + fill, non-unlocked only
    ins-pct ............ "<n>% complete", non-unlocked only
    ins-launch ......... button "▶️ Launch pursuit drill" + optional " · <n> ft", non-unlocked only
Page-replacing states (mutually exclusive with everything above)
  state-error ........ p.form-error with the raw message
  state-loading ...... p.loading "Loading..."
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Trophy Room` | — | — | — | always. Duplicates the shell header's `<h1>` — see § 8 |
| `hdr-pro` | link | `Pro` | default / pressed | navigate | `/profile` | always. Almost certainly a truncated `Profile`; the word appears nowhere else in the app — see § 12 |
| `xp-level` | text | `Level <n>` | — | — | — | Derived from lifetime XP by `xpProgressInLevel`, **not** read from the `profiles.level` cache, so a lagging cache cannot show a wrong level |
| `xp-ledger-open` | chip button | `📜 Ledger` | default / pressed | opens `XpLedgerModal` | local | always |
| `xp-bar` | meter | inline `width: <pct>%` | 0–100% / full at cap | — | — | always. No `role`, no `aria-valuenow` — see § 8 |
| `xp-caption` | text | `<into> / <span> XP · <toNext> to Level <n+1>` or `Max level — <xp> XP` | normal / capped | — | — | capped when `levelSpan === 0`, i.e. level 50 (`MAX_LEVEL`) |
| `pur-card` | article | badge icon, name, `<n>%`, description | — | — | — | up to 3, from `activePursuits(viewModels)`: `status === 'in_progress'`, sorted by progress desc then name asc |
| `pur-launch` | button (`.start-button`) | `▶️ Launch pursuit drill` + ` · <n> ft` when derivable | default / pressed | `navigate('/practice/freeform' + query)` | `freeform-active` | always. **No confirmation, and it leaves the section and the shell** |
| `wall-filter` | tab ×4 | `All (<n>)`, `🔓 Unlocked (<n>)`, `🎯 In progress (<n>)`, `🔒 Locked (<n>)` | selected / unselected | `setFilter` | local | always. `role="tab"` + `aria-selected`; counts from `filterCounts` and always reflect the full 25, not the filtered view |
| `wall-empty` | text | `Nothing here yet.` | — | — | — | shown when the active filter matches zero badges |
| `wall-square` | button | icon + name, plus `✓` or an inline bar | `unlocked` / `in_progress` / `locked` (dimmed) | `setInspecting(badge)` | opens `BadgeInspectDrawer` | always |
| `led-row` | list item | source label, `MMM D` date, signed `<n> XP` | positive / negative | — | — | `SOURCE_LABELS` maps `regimen_run`, `session`, `badge`, `import`; unknown types render raw. Negative amounts get `abandoned-badge` styling — though the DB constrains amounts, see § 12 |
| `led-empty` | text | `No XP earned in the last 30 days.` | — | — | — | shown when the 30-day window is empty |
| `ins-earned` | text | `🔓 Unlocked <long date>` | — | — | — | unlocked badges only; renders `🔓 Unlocked ` with a trailing space when `earnedAt` is null |
| `ins-launch` | button (`.start-button`) | `▶️ Launch pursuit drill` + optional distance | default / pressed | same as `pur-launch` | `freeform-active` | rendered for `in_progress` **and `locked`** badges — a 0%-progress badge still offers a drill |
| `state-error` | page | raw `err.message` | — | — | — | replaces the entire page; no retry control |
| `state-loading` | page | `Loading...` | — | — | — | replaces the entire page until reconciliation **and** the fetch settle |

Neither overlay closes on Escape, and neither traps focus. Both close on backdrop click and on their
`Close` button.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Profile XP/level, all badge definitions, the user's progress rows, the 30-day XP ledger | `fetchTrophyRoomData(user.id)` | `lib/gamification/trophyRoom` | Supabase (4 parallel queries) | async |
| Badge view models (status, icon, progress) | `buildBadgeViewModels(badges, progressRows)` | same | — | **pure** |
| Top 3 near-complete badges | `activePursuits(viewModels)` | same | — | **pure** |
| Filter counts | `filterCounts(viewModels)` | same | — | **pure** |
| Visible badges | `applyFilter(viewModels, filter)` | same | — | **pure** |
| Drill distance from criteria | `pursuitDistanceFor(criteria)` | same | — | **pure**, called inside the two components |
| Level, bar fill, XP to next | `xpProgressInLevel(xp)` | `lib/gamification/xp` | — | **pure** |

`fetchTrophyRoomData` runs one `Promise.all` over `profiles` (`xp, level`), `badges` (unscoped — the
catalog is shared), `badge_progress` (user-scoped), and `xp_events` (user-scoped, `created_at >= now −
30 days`, newest first). A missing profile row coerces to `{ xp: 0, level: 1 }`. Any query error
rejects the whole call. The four pure derivations are `useMemo`'d on `data` and `filter`
(`TrophyRoomPage.jsx:42-48`). Signatures in `LIB_API_INDEX.md`.

### Writes

**This screen writes on load, before it renders anything.** `TrophyRoomPage.jsx:30-40` calls
`evaluateAndPersistBadges(user.id)` first, `.catch(() => {})` best-effort, then chains
`fetchTrophyRoomData`. The page comment states the intent plainly: this is "the actual reconciliation
point the save-path comments promise it is — not just a plain read of whatever's already persisted."

| Mutation | Call | Idempotency / boundary |
|---|---|---|
| Persist badge progress | `supabase.rpc('upsert_badge_progress', { p_badge_id, p_progress, p_earned })`, one per changed badge, in parallel | Server-owned; the client has no direct write access to `badge_progress` |
| Append badge XP | `supabase.rpc('append_xp_event', { p_amount, p_source_type, p_source_ref })`, **sequential** | `ON CONFLICT DO NOTHING` on `(user_id, source_type, source_ref)` — a retry after a partial failure converges rather than double-counting. Returns the fresh lifetime total |
| Refresh the level cache | `supabase.rpc('set_profile_level', { p_level: levelForXp(xpAfter) })` | The only path allowed to write `profiles.level` |

`layer5_gamification_hardening.sql` revokes direct client write access to `xp_events`,
`badge_progress`, and `profiles.xp`/`level`, so amount bounds, `source_type` validity, and the
`(user_id, source_type, source_ref)` uniqueness are **enforced by the database, not re-implemented
app-side**. The XP appends are sequential by necessity — each RPC reads-then-writes `profiles.xp`.

Malformed badge rows are isolated by `evaluateBadges` and logged via `console.error`
(`badgeEvaluatorService.js:94-96`) precisely because both call sites swallow the promise.

`PHASE_A_ARCHITECTURE.md` § 14 owns the transaction contract. These writes carry idempotency (via the
RPC's unique constraint) but no expected version, no occurred time, no installation id, and no Dexie
transaction.

### Offline

**Nothing works offline.** `lib/gamification/trophyRoom.fetchTrophyRoomData` and
`badgeEvaluatorService.js` are both classified **Supabase only — no local mirror** in
`LIB_API_INDEX.md`. With no network:

1. `evaluateAndPersistBadges` rejects and is swallowed by the `.catch(() => {})`.
2. `fetchTrophyRoomData` then rejects.
3. `state-error` replaces the entire page with a raw network message and no retry control.

There is no cached badge wall, no cached XP total, and none of the four calm states from
`PHASE_A_ARCHITECTURE.md` § 12. This is the least offline-capable screen in the ME section — `goals`
and `weekly-reports` both render from Dexie, and even `settings` renders cached preferences (until its
profile read fails).

The design compensates elsewhere: because the evaluator is idempotent and re-runnable, an offline
session that finished without awarding its badges is reconciled the next time this page opens with a
connection. The offline gap is in *viewing*, not in *correctness*.

## 6. Flow paths

**Happy path.** Arrive from ME → `evaluateAndPersistBadges` catches up any missed awards → 
`fetchTrophyRoomData` resolves → XP bar, up to three pursuit cards, and the 25-badge wall render → tap
a square → the inspect drawer opens → `Launch pursuit drill` → `/practice/freeform?distance=50`.

**First run / empty.** A brand-new account has `xp = 0`, no `badge_progress` rows, and an empty
ledger. Result: `Level 1`, a 0%-filled bar, `0 / 1,000 XP · 1,000 to Level 2`; **the entire Active
Pursuits section is absent** (`ActivePursuits` returns `null` at zero pursuits — no heading, no empty
state); and the wall renders all 25 badges as `locked` with counts `All (25) / Unlocked (0) /
In progress (0) / Locked (25)`. Opening the ledger shows `No XP earned in the last 30 days.`

Two `S-EMPTY` instances, both bare `<p>` rather than `.empty-state`: `TrophyWall.jsx:36`
(`Nothing here yet.`) and `XpLedgerModal.jsx:34`. The wall's is also one of the row's three named
`S-EMPTY-FILTER` misreports (`TrophyWall.jsx:35`): the `All / Unlocked / In progress / Locked` chips
filter the same grid, so selecting `Unlocked` on a new account produces `Nothing here yet.` — a
statement about the account when it is a statement about the filter.

The missing pursuits section is a real hole and is **not** an `S-EMPTY` divergence but the absence of
the state entirely: `ActivePursuits` returns `null` at zero pursuits, so there is no heading and no
empty affordance to diverge from. The one moment a player most needs "here is what to chase next" is
their first visit, and the screen says nothing.

**Error.** `S-ERR-BLOCK` — any `fetchTrophyRoomData` rejection renders `<p className="form-error">
{error}</p>` as the **entire page** (`TrophyRoomPage.jsx:57`) — no header, no retry (`S-RETRY`), no
navigation but the shell. It is one of the thirteen **unguarded** instances, with no `&& !data` test.
Identical to `disc-detail`'s and `me-root`'s pre-load failure posture, and worse than `goals` /
`weekly-reports`, which contain their errors inline; this screen has no `S-ERR-INLINE` path at all.

`S-ERR-SILENT` — an evaluator failure is invisible: `evaluateAndPersistBadges` is swallowed, so the user
sees a stale but complete wall with no indication reconciliation did not run. The row rates most
swallow sites `cosmetic` and defensible; this one is closer to its two `data-risk` cases in effect, in
that a silently un-run reconciliation is indistinguishable from a correct one, and the badges are the
screen's entire content.

**Offline.** `S-OFFLINE-READ`, on the failing side: `lib/gamification/trophyRoom` is one of the eight
modules with no cache, so the screen collapses into `S-ERR-BLOCK`. Identical to the Error path;
`S-STALE` never arises and no `S-SYNC` label is displayable. As § 5.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell. `user.id` is dereferenced
unconditionally (`TrophyRoomPage.jsx:35`), so there is no anonymous rendering path. The RPCs derive their subject from
`auth.uid()` independently of the client.

**Interlock.** Level is capped at 50 (`MAX_LEVEL`, `lib/gamification/xp.js:14`). At the cap the XP bar
reads full and the caption switches to `Max level — <n> XP`; XP continues to accrue in the ledger but
stops minting levels. This is the only cap on the screen and it is handled correctly and visibly.
`S-INTERLOCK-CAP` surveys three ceilings and does not include this one; it is the only ceiling in the
app that is reached passively rather than by a user action, so the row's "pre-emptive disable" criterion
does not apply — there is no control to disable, only a readout to relabel, and it is relabelled.

`IMPORT_XP_CAP = 10000` exists in `constants.js` to stop a large UDisc backlog vaulting a user to the
ceiling, but Screen 13 (ingestion) is unbuilt, so no code path applies it.

**Destructive.** **N/A** — nothing here deletes, retires, or overwrites, so neither `S-CONFIRM` nor
`S-CONFIRM-PHRASE` applies and neither is a gap. `xp_events` is an immutable ledger and the modal says
so; `badge_progress` is upsert-only and monotonic in practice.

## 7. Dependencies

### Schema

- `badges` — the shared 25-row catalog (`id`, `code`, `name`, `description`, `tier`, `criteria`),
  seeded by `layer5_gamification_seed.sql` to match `src/lib/gamification/badgeCatalog.js`. Read
  **unscoped** by `fetchTrophyRoomData`.
- `badge_progress` — user-scoped `(badge_id, progress, earned_at)`. Client-writable only through
  `upsert_badge_progress`.
- `xp_events` — immutable ledger `(id, amount, source_type, source_ref, created_at)`, with a unique
  `(user_id, source_type, source_ref)` constraint providing idempotency. Client-writable only through
  `append_xp_event`.
- `profiles.xp` (`bigint not null default 0 check (xp >= 0)`) and `profiles.level`
  (`integer not null default 1 check (level >= 1)`), added by `layer1_foundation_schema.sql:48-52`.
  Both are **caches**; the ledger is the source of truth. Direct UPDATE is revoked from
  `authenticated` (`layer5_gamification_hardening.sql:170-176`) and only `append_xp_event` /
  `set_profile_level` may write them.
- Read during evaluation (not display): `putt_sessions` + `putt_distance_logs`,
  `putting_regimen_runs` + `putting_regimen_run_sets` + `putting_regimen_sets`, `discs`
  (`role`, `total_chain_hits`), and the weather columns (`weather_condition`, `wind_mph`) badges
  depend on.

No Dexie mirror exists for any of these.

### Library

`lib/gamification/trophyRoom` (`fetchTrophyRoomData`, `buildBadgeViewModels`, `activePursuits`,
`filterCounts`, `applyFilter`, `pursuitDistanceFor`, `TROPHY_FILTERS`),
`lib/gamification/badgeEvaluatorService` (`evaluateAndPersistBadges`), and transitively
`lib/gamification/xp`, `constants`, `badgeCatalog`, `metrics`, `evaluateBadges`, `playerStats`.
Signatures in `LIB_API_INDEX.md`.

### Components

`XpLevelBar`, `XpLedgerModal`, `ActivePursuits`, `TrophyWall`, `BadgeInspectDrawer` — all five under
`src/components/trophyRoom/`, all five consumed only by this page. Details in
`COMPONENT_LIBRARY.md`.

### Screens

- `me-root` links in; this page links back with `hdr-pro`.
- `freeform-active` is the drill destination and must honor the `?distance=` parameter — it does
  (`FreeformLogPage.jsx:62-66`).
- `regimen-active` and `freeform-active` both call `awardPostSession` on finish, which is the primary
  XP and badge write path; this screen is the reconciliation backstop for when that call fails.
- `/bag`'s role assignment feeds putter-scoped badge metrics.
- `settings` owns the `achievement` notification category, which nothing currently produces.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 12 (presentation/accessibility — the two overlays fall short, see § 8),
§ 13 (shell boundaries), § 14 (transaction contract — partially met). `SCREEN_SPECS.md` standing
divergence #8 (bag tags / QR Beam / P2P parked with Social). No blocking ADR.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- Every badge emoji is `aria-hidden="true"` with the badge name in adjacent text, so no meaning is
  carried by an emoji alone. Consistently applied across all four components that render one.
- Progress is always carried in **text** (`82%`, `82% complete`, `<n> / <n> XP`) beside every bar, so a
  bar's fill is never the only representation of a value.
- The filter bar is `role="tablist"` with `role="tab"` + `aria-selected` children — the only tablist in
  the component tree, and the only ME control that exposes selection state to assistive technology at
  all.
- **Gap — the two overlays are hand-rolled modals with materially weaker semantics than `SheetHost`.**
  `BadgeInspectDrawer.jsx:11-12` and `XpLedgerModal.jsx:20-21` are structurally identical:
  `.modal-backdrop` with `onClick={onClose}` wrapping a `.modal-sheet` with `stopPropagation`,
  `role="dialog"`, and an `aria-label`. **Neither sets `aria-modal`, traps focus, nor closes on
  Escape**, and the backdrop is a click-handling `<div>` rather than `role="presentation"`. Meanwhile
  `SheetHost` implements the same idea correctly (`aria-modal="true"`, `aria-labelledby`,
  `role="presentation"` backdrop) and `AppShell.jsx:86` marks the background `aria-hidden` when its
  sheet is open — none of which applies to these two, because they are rendered by the page, not by
  the shell. So the trophy-room overlays leave the entire page behind them focusable and reachable.
  These are the app's only two `.modal-sheet` users; `COMPONENT_LIBRARY.md` § Gaps item 4 records the
  finding and notes that migrating them to `SheetHost` would delete the weaker pattern entirely.
  A backdrop `<div>` with an `onClick` and no keyboard equivalent is also not dismissible by keyboard
  at all except via the `Close` button.
- **Gap — the tablist has no tabpanel.** The four tabs carry no `aria-controls`, and the badge grid
  below is not marked `role="tabpanel"`. A screen-reader user is told they are on a tab without being
  told what it controls.
- **Gap — `xp-bar`, `pur-bar`, `sq-bar`, and `ins-bar` are all styled `<div>`/`<span>` pairs** with no
  `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, or `aria-valuemax`. The adjacent text
  mitigates this for three of the four; `sq-bar` on a wall square has **no** text percentage, so an
  in-progress badge's progress is visual only.
- **Gap — duplicate `<h1>`.** `GlobalHeader.jsx:13` renders `Trophy Room` as an `<h1>`, and
  `TrophyRoomPage.jsx:63` renders a second identical one.
- **Gap — `hdr-pro` has an unintelligible accessible name.** `Pro` is the entire link text; screen
  readers announce "Pro, link" with no indication it returns to the ME summary.
- **Gap — the page-replacing error has no `role="alert"` and no focus move.**
- `ActivePursuits` returning `null` on empty means an assistive-technology user gets no signal that a
  section exists at all on a fresh account.

## 9. Events and telemetry

**XP ledger.** `xp_events` is the app's append-only progression ledger, written only through
`append_xp_event`. Sources are enumerated in `XP_SOURCE`: `regimen_run`, `session`, `badge`, `import`.
Payouts are single-sourced in `constants.js` — `XP_PER_MAKE = 10`, `XP_PER_CLEAN_STAGE = 50`,
`XP_PER_IMPORTED_PUTT = 10`, and `BADGE_XP_BY_TIER = { bronze: 100, silver: 300, gold: 1000 }` — and
`XpLedgerModal` renders the first two straight from those constants, so the multiplier guide can never
drift from the economy.

**Badge evaluation.** 25 badges across three tiers, each with a `criteria.metric` keyed into
`metrics.js` and a `threshold`; progress is `min(current / threshold, 1)`. Evaluation is a pure pass
(`evaluateBadges`) over a pure snapshot (`buildPlayerStats`), with the impure fetch and persist
isolated in `badgeEvaluatorService`. The service is explicitly designed to be re-runnable, which is
what makes this page a safe reconciliation point.

**Level curve.** `1000 × 1.15^(n−1)` per rung, capped at level 50 — one formula, `xp.js`, from which
`calculateXpForLevel`, `cumulativeXpForLevel`, `levelForXp`, and `xpProgressInLevel` all derive.

**Metrics registry:** badge metrics are **not** registered in `PHASE_A_ARCHITECTURE.md` § 5. They carry
no `calculation_version` and expose no sample size, unlike `weekly-reports`. A badge's progress bar is
an unversioned derived number.

**Notifications:** none produced or consumed on this screen. The `achievement` category exists in
`NOTIFICATION_PREFERENCE_CATEGORIES` and is toggleable on `/profile/settings`, but
`src/lib/notificationProducers.js` emits only `activity_review` and `sync_review`, so a badge unlock
never notifies. Celebration is handled in-session by `celebrationEventsFor` on the scoring screens,
not here.

**Lifecycle events:** none written (§ 2).

## 10. Tests

### Existing coverage

`src/lib/gamification/gamification.test.js` — a single file covering the whole module, and the most
thorough test in the ME section:

- XP math: the `1000 × 1.15^(n−1)` curve, cumulative sums, `levelForXp` as its inverse, negative-XP
  clamping, the level-50 cap, bar fill within a level, and full-at-cap.
- Metrics: zone bucketing against the DB's `<=33` / `<=66` bounds, longest-made ignoring zero-make
  distances, inclusive `makes_beyond_ft` boundary, wind floors including the null-wind case, rain
  sessions, and a throw on an unknown metric (which catches catalog typos).
- `evaluateBadges`: unlock-and-emit-XP, idempotence for an already-earned badge, and churn-free skip.
- `buildPlayerStats`: cross-parent aggregation, abandoned runs not counting as flawless, putter-scoped
  chain hits ignoring non-putters.
- `celebrationEventsFor`: level-up first, one banner per new badge, nothing when neither changed.
- **Trophy Room view models**: `buildBadgeViewModels` classification, `activePursuits` ordering,
  `filterCounts`/`applyFilter` agreement, and `pursuitDistanceFor`'s distance-shaped-criteria rule.
- Catalog integrity: exactly 25 badges, unique codes, every criteria referencing a real metric with a
  positive threshold, and every badge having a known tier with a defined XP payout and an icon.

Confirmed by reading the page's imports. `TEST_MAP.md` § ME's row for `trophy-room` is accurate.

**Not covered:** no page or component test for any of the five components (consistent with
`TEST_MAP.md` § The headline); `fetchTrophyRoomData` and `evaluateAndPersistBadges` — the two impure
functions — are untested; and there is **no migration contract test** for
`layer5_gamification_hardening.sql`, despite it carrying the security-critical revokes that make the
whole XP economy tamper-resistant. Given the repo already has this pattern
(`phaseD2Migration.test.js`, `phaseD3ContractsMigration.test.js`), that is a notable omission.

### Acceptance criteria

1. A fresh account renders `Level 1`, a 0% bar, `0 / 1,000 XP · 1,000 to Level 2`, no Active Pursuits
   section at all, and 25 locked squares with counts `25 / 0 / 0 / 25`.
2. Each of the four filters shows the correct count and renders exactly the matching squares; a filter
   with no matches renders `Nothing here yet.`
3. An unlocked badge shows a `✓` and no progress bar; an in-progress badge shows a bar; a locked badge
   is dimmed.
4. Active Pursuits shows at most three in-progress badges, most complete first, ties broken by name.
5. `Launch pursuit drill` on a distance-shaped badge navigates to `/practice/freeform?distance=<n>`
   and the freeform launcher opens preconfigured to that distance; on a non-distance badge it
   navigates with no query string.
6. Opening the ledger shows the last 30 days newest-first, with `+10 XP / make · +50 XP / clean stage`
   rendered from the constants.
7. Finishing a session offline, then opening this page online, awards the badges that session earned —
   exactly once, even if the page is opened repeatedly.
8. A user at level 50 sees `Max level — <n> XP` and a full bar.
9. *Currently failing.* Pressing Escape closes an open overlay, and focus is trapped inside it while
   open. Neither happens today — see § 8.

### E2E critical paths

- Fresh account → practice until a badge unlocks → open the Trophy Room → the badge is unlocked and
  the XP ledger shows the award.
- Reconciliation: simulate a failed post-session award, then open this page and confirm it catches up.
- Idempotence: open the page five times in a row and confirm the XP total and ledger row count do not
  change.
- Filter round-trip across all four tabs with a mixed-status account.
- Pursuit launch → freeform opens at the stated distance → complete the drill → return and confirm
  progress moved.
- Keyboard-only: open the ledger, close it with Escape, and confirm focus returns to the Ledger button
  (currently expected to fail).

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries. See
`TEST_MAP.md` § E2E backlog.

## 11. Tasks

#### T-trophy-room-1 — Migrate both overlays to `SheetHost`

- **Capability:** `ui-interaction`
- **Touches:** `src/components/trophyRoom/XpLedgerModal.jsx`,
  `src/components/trophyRoom/BadgeInspectDrawer.jsx`, `src/pages/TrophyRoomPage.jsx`
- **Done when:** Both overlays open through the shell's single sheet layer: `aria-modal`, focus enters
  the sheet and returns to its trigger on close, Escape closes, and the background is inert. No
  `.modal-sheet` or `.modal-backdrop` remains in `src/`.
- **Verify:** `npm run lint` plus a keyboard and VoiceOver pass on both overlays at
  `/profile/trophies`.
- **Commit:** `fix: open trophy room overlays through the shared sheet host`
- **Note:** `COMPONENT_LIBRARY.md` § Gaps item 4 is the source finding; this task closes it.

#### T-trophy-room-2 — Rename the `Pro` link

- **Capability:** `ui-routine`
- **Touches:** `src/pages/TrophyRoomPage.jsx`
- **Done when:** The header link reads a word the app uses elsewhere — `Me` (matching the route title
  and the tab label) or `Profile` — and its accessible name says where it goes.
- **Verify:** `npm run lint`; `grep -rn ">Pro<" src/` returns nothing.
- **Commit:** `fix: name the trophy room header link`
- **Blocked by:** § 12 open question 1.

#### T-trophy-room-3 — Give a fresh account something to pursue

- **Capability:** `ui-routine`
- **Touches:** `src/components/trophyRoom/ActivePursuits.jsx`
- **Done when:** An account with zero in-progress badges renders the section with an empty state that
  names the nearest achievable badge, rather than rendering nothing at all.
- **Verify:** `npm test` with a component test for the zero-pursuit case.
- **Commit:** `feat: show a first-pursuit prompt on an empty trophy room`

#### T-trophy-room-4 — Expose progress semantics on every bar

- **Capability:** `ui-routine`
- **Touches:** the four bar-rendering components under `src/components/trophyRoom/`
- **Done when:** Each bar is a `role="progressbar"` with `aria-valuenow`/`min`/`max`, and `sq-bar` on
  the wall gains a text percentage so an in-progress square is not visual-only.
- **Verify:** `npm run lint` plus a VoiceOver pass over the wall.
- **Commit:** `fix: expose trophy room progress to assistive tech`

#### T-trophy-room-5 — Add a retry affordance to the load error

- **Capability:** `ui-routine`
- **Touches:** `src/pages/TrophyRoomPage.jsx`
- **Done when:** A failed load renders the error plus a `Retry` that re-runs reconciliation and the
  fetch; and a *silently swallowed* evaluator failure is surfaced as a non-blocking notice rather than
  hidden entirely.
- **Verify:** `npm test` with a page-level test rejecting the fetch once then resolving.
- **Commit:** `fix: allow retry when the trophy room fails to load`

#### T-trophy-room-6 — Pin the gamification hardening migration contract

- **Capability:** `security`
- **Touches:** `src/lib/layer5GamificationMigration.test.js` (new)
- **Done when:** A test in the style of `phaseD3ContractsMigration.test.js` asserts from the SQL text:
  `revoke update on profiles from authenticated`, the explicit re-grant list excluding `xp` and
  `level`, `append_xp_event`'s conflict handling, and the `set_profile_level` revoke/grant pair.
- **Verify:** `npm test`
- **Commit:** `test: pin the gamification hardening migration contract`
- **Note:** the same test should catch the `timezone` / `round_turn_prompt_enabled` grant gap recorded
  in `docs/ui/screens/settings.md` § 12 open question 2.

## 12. Open questions

1. **The header link is labelled `Pro`.** `TrophyRoomPage.jsx:64-66` renders
   `<Link to="/profile" className="link-button">Pro</Link>`. `Pro` appears nowhere else in the app's
   vocabulary — the tab is `Me`, the route title is `Me`, and `COPY_AND_TERMINOLOGY.md` does not list
   it. The blueprint's Screen 11 and 12 wireframes both draw a `[ 👤 PRO ]` **tab**
   (`MASTER_PROJECT_BLUEPRINT.md:697`, `:735`), which is the likely origin — a label from an
   abandoned four-tab naming that survived into a link. Should it read `Me`, `Profile`, or something
   else?
2. **Locked badges offer a pursuit drill; in-progress badges are the only ones the carousel shows.**
   `BadgeInspectDrawer.jsx:32-42` renders `Launch pursuit drill` for any badge that is not `unlocked`,
   including one at 0% whose criteria (a 30-day streak, an inventory count) no single drill can
   advance. `pursuitDistanceFor` returns `null` for those, so the drill launches at the freeform
   default — a button that promises progress it cannot deliver.
3. **`filterCounts` counts all 25 badges but the wall may show fewer.** Counts are computed from the
   full `viewModels` set while squares come from `applyFilter`. That is correct and intended, but the
   `All (25)` chip beside a wall showing three squares reads as a discrepancy without explanation.
4. **The ledger styles negative XP but the schema may forbid it.** `XpLedgerModal.jsx:44-47` branches
   on `e.amount >= 0` and applies `abandoned-badge` styling to negatives, implying corrections or
   clawbacks. `append_xp_event` is the only write path and `profiles.xp` carries `check (xp >= 0)`;
   whether a negative amount is admissible needs checking against the deployed function's bounds. If
   it is not, the branch is dead code that suggests a feature that does not exist.
5. **Badge progress is an unversioned derived metric.** Unlike `weekly-reports`, which pins a
   `calculation_version` per snapshot, `badge_progress.progress` carries no calculation version. If a
   metric's definition changes, every stored progress value silently means something different, and a
   re-evaluation could move a bar backwards with no audit trail.
6. **Reconciliation runs on every mount, unconditionally.** Opening the Trophy Room issues three
   full-table user reads (sessions with nested logs, runs with nested sets, discs) plus two catalog
   reads, then up to *n* parallel progress RPCs and *n* sequential XP RPCs, then a level RPC, then
   four more reads for display. For an account with years of history that is a substantial cost on
   every visit, with no throttle, no `since` filter, and no "already reconciled recently" check.
7. **A swallowed evaluator failure is invisible.** `.catch(() => {})` at `TrophyRoomPage.jsx:36` is
   deliberate — it must not block display — but the user is then shown a wall that may be missing a
   badge they earned, with nothing indicating reconciliation did not run. Only `console.error` records
   it, and only for malformed-badge errors.

## 13. Blueprint divergence

Blueprint Screen 12 is *Trophy Room & Social Gamification Hub*
(`MASTER_PROJECT_BLUEPRINT.md:694`). Most of it shipped; the Social half did not.

**Ships without the Virtual Bag Tag card, the peer challenge, and the QR Beam.** These are parked with
the Social module under `SCREEN_SPECS.md` **standing divergence #8**, which states the rule once for
every in-scope screen and names this screen explicitly: "Screen 12's Trophy Room ships without them."
The tag-swap contract in `COMPETITION_ENGINE.md` is reference material for when Social unparks, not
built now. The page's own file comment records the same decision at `TrophyRoomPage.jsx:18-20`.
Concretely, three drawn elements are absent: the `🏷️ ACTIVE VIRTUAL BAG TAG: [ #14 ]` card, the
`[ ⚔️ DEFEND ]` / `[ ⚔️ CHALLENGE PEER ]` action, and the `lz-string` QR Beam challenge loop with its
deterministic offline tie-break (sudden death at 33 ft → streak peak).

| Blueprint Screen 12 feature | Shipped reality |
|---|---|
| RPG level 1–50 with a Burnt Terracotta XP bar | Ships. `xp.js` implements the exact `1000 × 1.15^(n−1)` curve and the level-50 cap |
| Level *title* (`LEVEL 34: ADVANCED FIELDWORKER`) | **Not built.** `xp-level` renders `Level <n>` only; there is no title table |
| `🔥 4-DAY STRK` streak readout on the XP card | **Not built** on this card. A `practice_day_streak` metric exists and drives three badges, but it is not surfaced as a standalone stat |
| `[ 📜 LEDGER ]` slide-up audit of the last 30 days plus a multiplier guide | Ships, including the 30-day window and a guide rendered from the payout constants. Implemented as a hand-rolled modal rather than the shell sheet — see § 8 |
| Active Pursuits carousel, top 3 closest to unlocking | Ships, ordering by progress desc then name |
| `[ ▶️ LAUNCH PURSUIT DRILL (+500 XP REWARD) ]` | Ships **without the XP figure in the label.** Rewards are tier-based (`bronze 100 / silver 300 / gold 1000`), so a fixed `+500` would be wrong for every badge |
| Pre-configures Screen 8 parameters to close the badge gap | Ships as `?distance=<ft>` into the freeform canvas, derived by `pursuitDistanceFor` — distance only. Wind, streak, and inventory criteria cannot be preconfigured |
| 4-way filtered wall with live counts and inline progress bars | Ships exactly, with `All / 🔓 Unlocked / 🎯 In progress / 🔒 Locked` |
| **3-column** badge grid | Column count is CSS (`.trophy-grid`), not fixed in the component; the frame above is illustrative |
| 50 ms haptic pulse on tapping a square | **Not built.** No haptic call exists on this screen |
| Inspection drawer with timestamps or launch recommendations | Ships, with the unlock date for earned badges and a progress bar plus drill for the rest |
| `BadgeEvaluatorService` as pure unit-tested functions run post-scoring / post-inventory / post-ingestion | Ships, plus a fourth trigger the blueprint did not specify: **on Trophy Room load**, as the reconciliation backstop |
| 25 seeded badge definitions | Ships, pinned by a catalog-integrity test |
| Virtual Bag Tag card, `[ ⚔️ CHALLENGE PEER ]`, QR Beam | **Parked with Social** — standing divergence #8 |
| Bottom tab bar `PLAY / BAGS / STATS / PRO` | `PLAY / DISCS / COURSES / ME` — standing divergence #5. The stray `Pro` link in this page's header is the last residue of that naming; see § 12 |

Standing divergences #1 (React/Vite, not Expo), #3 (append-only schema), #5 (four-tab navigation), and
**#8 (bag tags / QR Beam / P2P parked with Social)** apply; see `SCREEN_SPECS.md` § Standing
divergences.
