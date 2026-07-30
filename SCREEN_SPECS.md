# SCREEN_SPECS.md — Integration Layer

**Design authority for wireframes, visual specs, and logic-governance:** `MASTER_PROJECT_BLUEPRINT.md`
(21 screens, full ASCII wireframes, ergonomic rules, schema, TASKS.md). **This document does not repeat
those wireframes.** Its job is reconciliation: for each screen, what status it has this cycle, what in
the shipped codebase already satisfies it (REUSE), what's genuinely new (NET-NEW), and where this app's
build **diverges** from the blueprint's literal spec — with the reasoning, so nobody re-litigates it.

Authored 2026-07-05, superseding the v1 `SCREEN_SPECS.md` (ideation specs for screens 3–10, commit
`da62bc5`) after the user supplied the full 21-screen Master Blueprint. v1's Build Notes content is
folded into this doc; its Screen 6 "putter role on `profiles`" proposal is **superseded** by the
blueprint's `discs.role` model (see Screen 6 below).

**2026-07-11 reconciliation:** `PRODUCT_ROADMAP.md` is now the current sequencing authority. Screens
10 and 11 no longer ship as overlapping standalone destinations: their analytics/career content is
distributed contextually, with ME as the career-wide summary. Expansion Screens 22–25 are adapted into
DISCS Collection/Rich Profile/Lost & Found and the shared notification sheet rather than creating a
parallel application tree.

**2026-07-29 correction to the line above (`docs/ui/` reconciliation pass, was `_corrections/discs-screens.md` D-5):**
"Expansion Screens 22–25" have **no source document in this repository**.
`MASTER_PROJECT_BLUEPRINT.md:113` is titled "THE COMPLETE 21-SCREEN MASTER ARCHITECTURE" and its § 3
defines Screens 1–21 and no more; `grep -rn "Screen 2[2-5]" *.md` matches only the sentence above.
The shipped provenance for DISCS Collection / Rich Profile / Lost & Found and the shared notification
sheet is `PRODUCT_ROADMAP.md` Phase B item 4 and Phase C item 1 — read those, not a 22–25 appendix that
does not exist. The design intent is preserved; only the citation was wrong. Screen documents for these
surfaces (`docs/ui/screens/lost-found.md` § 13 in particular) record that they have no drawn intent to
diverge from.

**2026-07-29 reconciliation pass.** Entries dated 2026-07-29 throughout this document were applied from
the quarantined corrections under `docs/ui/_corrections/`, filed by the 33-screen documentation pass.
Superseded text is marked rather than deleted, per house convention. Per-screen detail lives in
`docs/ui/screens/`; `docs/ui/SCREEN_INVENTORY.md` is the canonical route/status table and
`docs/ui/DEFECT_REGISTER.md` holds the code defects this pass found but did not fix.

## Status legend

- **IN SCOPE** — building this cycle, per the execution layers below
- **PARKED** — designed in the blueprint, deliberately deferred; reasoning given, not abandoned
- **DISTRIBUTED** — the blueprint screen's content shipped, but spread across several real surfaces
  instead of one destination. Added 2026-07-29 so the table can agree with the 2026-07-11 note above,
  which it previously contradicted (was `_corrections/screen-specs-and-agents.md` C-2).

## Screen status summary

| # | Screen | Status | Layer |
|---|---|---|---|
| 1 | Welcome Landing | IN SCOPE | 2 |
| 2 | Account Authentication & Recovery | IN SCOPE | 2 |
| 3 | Zero-Typing Onboarding Wizard | IN SCOPE | 2 |
| 4 | Main Dashboard Hub | IN SCOPE | 3 |
| 5 | Unified Bag Management & Disc Universe | IN SCOPE | 3 |
| 6 | Putter Lineup Manager & Flight Curve Editor | IN SCOPE | 3 |
| 7 | Custom Routine Builder | IN SCOPE | 4 |
| 8 | Rapid-Fire Scoring Canvas & Mid-Round Swaps | IN SCOPE | 4 |
| 9 | Session Summary & Progress Report | IN SCOPE | 4 |
| 10 | Global Analytics & Settings Control Tower | DISTRIBUTED (was IN SCOPE, Layer 5) | 5 |
| 11 | Player Career Hub | DISTRIBUTED (was IN SCOPE, Layer 5) | 5 |
| 12 | Trophy Room & Social Gamification Hub | IN SCOPE (minus bag-tag/QR) | 5 |
| 13 | Frictionless UDisc Ingestion Center | IN SCOPE | 5 |
| 14 | Course Practice Hubs & Leaderboards | PARKED (Social) | — |
| 15 | Putting League Bracket Manager | PARKED (Social) | — |
| 16 | Smartwatch Companion & Wearables Hub | PARKED (Hardware — needs native) | — |
| 17 | Pro-Shop & Gear Discovery Engine | PARKED (Commerce — needs retail partnerships) | — |
| 18 | Offline Sync & Conflict Resolution Center | PARKED (Utilities) | — |
| 19 | Privacy & Data Sovereignty Hub | PARKED (Utilities) | — |
| 20 | Firmware & Sensor Diagnostics | PARKED (Hardware — needs BLE/native) | — |
| 21 | Emergency Panic Recovery Overlay | PARKED (Utilities) | — |

## Standing divergences from the blueprint (apply across all in-scope screens)

These were decided once, in plan mode, and apply everywhere the blueprint assumes otherwise — no
per-screen re-justification needed:

1. **Stack:** React + Vite (JSX), not Expo/React Native/NativeWind. Every blueprint UI primitive
   (`OswaldText`, `TouchTarget48`, `SegmentedGridChip`, `OtpInputGrid`, `HapticTestPad`) is built as a
   plain React component styled with the existing CSS-variable theme system, not Tailwind/NativeWind.
2. **Offline layer:** staged Dexie.js + TanStack Query adoption (Layer 1), not a big-bang local-first
   rewrite. `src/lib/instantLaunch/` (the shipped localStorage FSM/outbox) folds into the Dexie
   repository last, not first.
3. **Schema:** append-only additive columns/tables on the existing Supabase schema (see Layer 1 in
   `DEVELOPMENT_PLAN.md`), not the blueprint's from-scratch 8-table `DATABASE_SCHEMA.md`. Disc molds
   stay a shared FK catalog (`disc_molds`) — the blueprint's freetext `brand`/`mold` columns are a
   regression from what's already shipped and are not adopted.
4. **Auth:** OTP is **email, 6-digit** (Supabase native, free) — UI renders 6 blocks, not the
   blueprint's 4. Guest mode is **Supabase anonymous sign-in** (survives device loss, converts via
   `linkIdentity`), not an Expo/Dexie-only shadow profile.
5. **Navigation:** **PLAY / DISCS / COURSES / ME** — the approved PLAY / DISCS / ME base shell plus
   COURSES, added at its documented trigger when the J1 directory shipped 2026-07-14. The
   standalone Stats tab is obsolete: player-wide summaries live in ME and disc/bag/routine/session/
   course statistics live with their subject.
6. **Interlocks:** both hard, as specified — 100-putt routine ceiling and 35-disc bag capacity, each
   with app-side disabling AND database enforcement.
   **Corrected 2026-07-29 (was `_corrections/capture-screens.md` C-9 + `play-screens.md` P-1; this
   supersedes the earlier "DB `CHECK` constraint" wording, which was never accurate):** neither
   interlock is — or can be — a `CHECK` constraint. Both are counts across *sibling* rows, which
   row-level `CHECK` cannot see. Both ship as `before` row triggers that take a parent row lock and
   raise with `errcode = 'check_violation'` (which is why `src/lib/regimens.js:44` tests for `23514`,
   and presumably where the "CHECK" description came from):
   - 35-disc bag capacity — `enforce_bag_capacity()` / `bag_discs_capacity_check`, `before insert` on
     `bag_discs` (`layer1_foundation_schema.sql:230-253`). It fires on **every** insert regardless of
     which app path issued it, so unguarded add paths fail loudly rather than silently overfilling.
   - 100-putt routine ceiling — `enforce_routine_putt_cap()` / `regimen_sets_putt_cap_check`,
     `before insert or update` on `putting_regimen_sets` (`layer1_foundation_schema.sql:255-290`). It
     sums `reps_required` across the regimen's other sets and **exempts system regimens**
     (`user_id is null` returns early — the fixed five and the classic drills are curated and may
     exceed 100). This exemption is not in the blueprint and is not otherwise documented.

   Two caveats a reader must carry forward, both registered as work in `docs/ui/DEFECT_REGISTER.md`
   rather than fixed here:
   - **"Hard" describes the database, not the app.** App-side pre-emption is inconsistent — the
     35-disc cap is enforced app-side only on `/bag/manage`, and the 100-putt cap only on
     `Add next stage`, not on `Save`. Neither raw Postgres exception is mapped to user-facing copy.
   - **`bags.capacity` is not the interlock.** The schema comment is explicit: it is "a separate,
     user-set soft target," while the hard 35 ceiling lives in the trigger. Two concepts, one word.

   Everything above is read from the applied schema files in this repository. Nothing has verified the
   **live** database; confirm the triggers exist in the deployed project before acting on capacity
   behavior.
7. **PDGA:** manual entry (zero-typing numeric keypad) — the blueprint's `fetch-pdga-profile` scraper
   Edge Function is deferred (PDGA has no official public API; scraping is ToS-gray).
8. **Bag tags / QR Beam / P2P:** parked with the Social module wherever they appear inside an
   in-scope screen (Screen 12's Trophy Room ships without them).
9. **Course prep has no blueprint screen.** The 21-screen set covers course *social* (Screen 14,
   parked) and UDisc ingestion (Screen 13) but never the pre-round preparation `AGENTS.md` names as a
   core pillar. `/courses/:courseId/prep` (E2, 2026-07-30) is therefore net-new rather than a
   blueprint build, and it is a **prep sheet, not a caddie**: the layout brief and hole cards are the
   course record read back, and the scoring/disc content is the player's own completed rounds on that
   exact layout. It makes no disc recommendation. Nothing in this schema records how far a given
   player throws a given disc, so a flight-number→distance suggestion would be an invented composite
   score — rejected by `PRODUCT_ROADMAP.md` and out of scope until the live caddie's server-side AI
   policy is approved separately. Pure logic lives in `src/lib/insights/coursePrep.js`; averages stay
   withheld below `COURSE_PREP_MIN_ROUNDS = 3`, matching `roundConditions.js`.

---

## Screen 1: Welcome Landing

**Blueprint ref:** `WelcomeLandingView`, Section 3 Screen 1. Build as specified — this screen already
matches the earlier-approved front-door plan almost exactly (offline badge, social-proof strip, GET
STARTED CTA, guest escape hatch).

- **REUSE:** Sun-Drenched Topo theme tokens (shipped 2.2a), `btn-primary` pattern. ~~topo-background
  CSS treatment already used elsewhere~~ — **struck 2026-07-29** (was `_corrections/preshell-screens.md`
  C-4): no such treatment exists. A case-insensitive search for `topo` across `src/` returns exactly one
  hit, the theme-name comment at `src/index.css:1`. There is no `.topo-background` class, no topographic
  asset, and nothing applying one. "Sun-Drenched Topo" is the theme's *name*; the treatment it implies
  was never built. The other two REUSE items are real and are used by this screen. If the treatment is
  still wanted it is NET-NEW, not REUSE.
- **NET-NEW:** `src/pages/SplashPage.jsx`; social-proof metric (static copy for v1 — "142,000+ putts"
  is illustrative, not a live aggregate query this cycle).
- **Divergence:** guest tap → Supabase anonymous sign-in (standing divergence #4), not a Dexie shadow
  DB.

## Screen 2: Account Authentication & Recovery

**Blueprint ref:** `AuthRecoveryView`, Section 3 Screen 2. Build as specified with the OTP-digit and
guest-mode divergences below.

- **REUSE:** `src/context/AuthContext.jsx` (extend, don't replace — existing `signIn`/`signUp` for the
  password fallback path).
- **NET-NEW:** `signInWithOtp` + `verifyOtp` (Supabase email OTP), `signInWithOAuth('apple'|'google')`,
  `signInAnonymously`, guest→account conversion (`updateUser`/`linkIdentity` preserving local progress);
  `AuthPage.jsx` rewrite (toggle, 6-digit OTP block component, SSO buttons, offline-persistence
  checkbox, ~~sync-status pill~~); `src/lib/supabaseClient.js` — confirm `persistSession: true` /
  `autoRefreshToken: true`.
- **Shipped-state corrections, 2026-07-29** (was `_corrections/preshell-screens.md` C-2 and C-3). The
  NET-NEW list above reads as a shipped-feature inventory; two of its items do not hold:
  - **The sync-status pill was never built** (struck above). The blueprint draws it as
    `[🟢 CLOUD SYNC: READY]` (`MASTER_PROJECT_BLUEPRINT.md:175`), but `AuthPage.jsx` renders no status
    pill, takes no `syncStatus` prop, imports no sync component, and `src/App.css` defines no auth-page
    pill class. A pre-session screen has no sync state to report, so this is arguably correct as built —
    but the entry must not claim it shipped. The other four items in that parenthetical did ship.
  - **Guest→account conversion ships but is unreachable in the UI.** `AuthContext.jsx:59-62` exports
    `convertGuestWithOtp`, `verifyGuestConversion`, and `linkGuestWithOAuth`, and `AuthPage.jsx`
    branches on `isGuest` to render the `Save Your Progress` variant. But **nothing in the application
    navigates a signed-in user to `/login`**: `ProtectedRoute.jsx:8` redirects only when `!user` (a
    guest *is* a user), `src/App.jsx:47-50` sends any session at `/` to `/practice`, and neither
    Settings, Career Hub, nor Profile offers a conversion affordance. A guest reaches the screen only
    by editing the URL; every guest who does not is permanently a guest. The conversion *mechanism* is
    correct — same `user.id` throughout, identity added rather than user recreated, exactly what
    standing divergence #4 promises. What is missing is an entry point, tracked as `T-login-6` in
    `docs/ui/screens/login.md`, blocked on where it belongs (`me-root` or `settings`).
- **Divergence:** 6-digit OTP blocks (standing #4). "365-Day Offline Guarantee" is a UX label over
  Supabase's refresh-token persistence, not a literal 365-day server token — same honesty note as the
  original front-door plan.
- **Dependency:** written SSO setup checklist (Google Cloud OAuth client, Apple Services ID + Sign-in
  key, Supabase provider config, anonymous sign-in toggle, redirect URLs) delivered in DEVLOG at build
  time — user-side dashboard work, not app code.

## Screen 3: 3-Step Zero-Typing Onboarding Wizard

**Blueprint ref:** `OnboardingWizardView`, Section 3 Screen 3. Build as specified — goal cards → brand/
mold/weight putter provisioning with smart default → units + haptic test.

- **REUSE:** `src/lib/profile.js` (`fetchProfile`, `upsertProfileFields`, `isThrowingProfileEmpty` —
  ready-made gate + `units` field for Step 3), `src/lib/discLocker.js` (`upsertDisc`,
  `fetchBags`, `createBag`, `addDiscToBag`), `src/lib/repository/catalogRepository.js`
  (`filterCatalogMolds`, `useCatalog`) for mold search, `src/hooks/usePuttHaptics.js`
  (`supported`/`vibrateMake`/`vibrateMiss`/`vibrateUndo`), InstantLaunch profile defaults
  (`favoritePutterDiscId`). **MVP / Axiom / Streamline are exactly the manufacturers already seeded**
  (1B catalog import) — the brand selector and mold list are real catalog queries, not hardcoded data.
- **NET-NEW:** `src/pages/OnboardingPage.jsx` + 3 step components; progress bar; brand-segment/mold-
  radio/weight-stepper components; goal cards; "Practice Stack" default-bag genesis on confirm.
- **Divergence added 2026-07-29 — goal-card *capture* shipped, goal-card *persistence* did not**
  (was `_corrections/preshell-screens.md` C-1). The blueprint says the goal cards "tag the user profile
  in Dexie.js to customize default dashboard layouts" (`MASTER_PROJECT_BLUEPRINT.md:218`). The shipped
  wizard asks the question in Step 1, gates `Continue` on the answer, and then **discards it**:
  `OnboardingPage.jsx:17` holds the selection in `useState(null)`, passes it to `GoalStep` at `:28`, and
  reads it nowhere else. `PutterStep` and `CalibrationStep` never receive it. No column, table,
  localStorage key, or repository call takes it — `src/lib/onboarding.js` exports `GOAL_OPTIONS` and
  nothing that writes a goal, and `profiles` has no goal column (`phase_a_profile_schema.sql`). The
  `goals` table from `20260716220000_phase_d3_goal_report_contracts.sql` is a **different concept**
  (Phase D3 measurable targets owned by the `goals` screen); its values do not overlap `GOAL_OPTIONS`.
  No agent should assume a stored goal is available to personalize a dashboard. Detail and the open
  question: `docs/ui/screens/onboarding.md` § 12 and § 13.
- **Divergence:** the blueprint names "Axiom Cosmic Pilot" as the default mold; confirm the exact mold
  name present in the seeded `disc_molds` catalog at build time (may be "Axiom Pixel" or similar — pick
  whichever putter mold is actually seeded, not a literal string match to the blueprint prose).
  Vibration API no-ops on iOS Safari — detect `supported === false` and show the honest fallback line
  (never a dead haptic pad).
- **Dependency:** none beyond shipped 1A profile schema.

## Screen 4: Main Dashboard Hub & Routine Launchpad

**Blueprint ref:** `DashboardHubView`, Section 3 Screen 4. Build as specified — streak badge, Instant
Replay hero, 3-way STANDARD/CUSTOM/NEW launchpad with CLONE & TWEAK, planning drawer, 4-tab bar.

- **REUSE:** `src/pages/PracticeMenuPage.jsx` (this screen is its full evolution, route `/practice`
  becomes PLAY), `src/lib/insights/` — `practiceStreak`/`volumeLedger` (`activity.js`),
  `suggestNextSession`/`suggestWarmupDistance`/`DEFAULT_STARTING_DISTANCE_FT`
  (`nextSessionSuggestion.js`), `mostRecentRegimenId`; InstantLaunchPayload (hero resume config +
  crash-recovery detection + `favoritePutterDiscId`); `src/lib/history.js` fetchers;
  `src/components/puttingCanvas/PutterPicker.jsx` (bottom-sheet putter change).
- **NET-NEW:** hero replay card + priority-chain logic (crash-recovery > last-config > first-session,
  unit-testable pure function); 3-way segmented launchpad (STANDARD/CUSTOM/NEW) listing the 5 fixed
  regimens as STANDARD presets + user's custom regimens (Layer 4) as CUSTOM; CLONE & TWEAK (duplicates
  a regimen's config into the Screen 7 builder pre-filled); planning drawer bottom sheet; streak badge.
- **Divergence:** none of substance — this screen's blueprint spec and the earlier front-door plan's
  ideation converged independently on the same "instant replay hero" pattern, which is a good sign.
- **Dependency:** CLONE & TWEAK needs Screen 7 (Layer 4) to exist; ships as a disabled/hidden action
  until then.

## Screen 5: Unified Bag Management & Disc Universe Hub

**Blueprint ref:** `BagManagerView`, Section 3 Screen 5. Build as specified — MY BAGS / PUTTERS /
UNIVERSE segmented header, 35-disc capacity interlock, vertical accordion catalog, ghost-slot wishlist
cards.

- **REUSE:** `src/pages/BagPage.jsx` (MY BAGS tab content: switcher, disc list, `FlightSpectrum`),
  `src/pages/BagLockerPage.jsx` (locker content, filters/sort/grid-list), `src/pages/DiscFormPage.jsx`
  (ADD TO BAG target), `src/lib/discFilters.js` (`filterDiscs`/`sortDiscs`), `src/lib/discLocker.js`
  (`fetchBagDiscs`, `fetchUserDiscs`), `src/lib/repository/catalogRepository.js` (`filterCatalogMolds`,
  `useCatalog`) for mold search, `src/lib/bags.js` (`bagViewDiscs`, `buildFlightSpectrum`).
- **REUSE corrections, 2026-07-29** (was `_corrections/component-library.md` item 1 and
  `_corrections/lib-api-index.md` item 1). Three identifiers in the line above were wrong and have been
  replaced; recorded so the substitution is not re-litigated:
  - ~~`FlightChart`~~ / ~~`flightChartPoints`~~ → `FlightSpectrum` / `buildFlightSpectrum`.
    `src/components/FlightChart.jsx` has **zero importers** repo-wide and `flightChartPoints()`
    (`src/lib/bags.js:64`) has no non-test caller. The shipped bag-level chart is `FlightSpectrum`
    (`BagPage.jsx:6,216`), which additionally handles clustering, ghost slots, and the Official/Current
    toggle. An agent following the old line would have extended a dead component and a dead helper.
    Whether to delete the retired pair is registered work, not decided here.
  - ~~`discLocker.searchMolds`~~ → `catalogRepository.filterCatalogMolds` + `useCatalog()`.
    `searchMolds` was removed from `src/lib/discLocker.js` in `6c88410` ("feat: add offline catalog
    repository"); `grep -rn "searchMolds" src/` returns nothing. Mold search is now
    `filterCatalogMolds(catalog, { query, manufacturer, category })`
    (`src/lib/repository/catalogRepository.js:86`) over the offline catalog snapshot. Both screens this
    document cites for it already consume the new API (`MoldPicker.jsx:8`,
    `discUniverse/UniverseBrowser.jsx:15`, `onboarding/PutterStep.jsx:28`).
- **NET-NEW:** 3-way segmented hub shell (MY BAGS / PUTTERS / UNIVERSE) replacing the flat page
  siblings; PUTTERS tab = the Screen 6 lineup filtered view; UNIVERSE tab = vertical accordion browse
  over `disc_molds` (Mold → Plastic → Run) — first read-only destination for the catalog outside the
  add-disc picker; 35-disc capacity interlock (blue→orange→rust bar + disabled Add at 35); ghost-slot
  wishlist card component (dashed border, stability-gap detection).
- **Divergence:** Ghost Slot's `[ FIND ]` action would bridge to Screen 17 (Pro-Shop) — **parked**.
  This cycle, `[ FIND ]` is hidden/disabled; the wishlist card still renders (it's pure gap detection
  over owned discs' flight numbers, zero dependency on retail). QR Beam bag-share is parked with
  Social — no `[ 🔗 BEAM QR ]` button this cycle.
- **Dependency:** ~~35-disc interlock needs the Layer 1 `bags.capacity` default/CHECK migration.~~
  **Resolved and reworded 2026-07-29** (was `_corrections/capture-screens.md` C-9): the dependency
  landed, but not as described. The interlock is `enforce_bag_capacity()` /
  `bag_discs_capacity_check`, a `before insert` row trigger on `bag_discs`
  (`layer1_foundation_schema.sql:230-253`) — see standing divergence #6 for why a `CHECK` constraint
  could never have expressed it. It is **not** `bags.capacity`, which remains a nullable, user-set soft
  target with no default and no constraint. Do not go looking for a missing `CHECK` to add: adding one
  would be a second, weaker, and unenforceable guard.

## Screen 6: Putter Lineup Manager & Live Flight Curve Editor

**Blueprint ref:** `PutterLineupView`, Section 3 Screen 6. Build as specified — role swimlanes, sticky
Bézier flight canvas, wear slider with odometer alert, retirement workflow.

**Superseded as a single-screen plan, 2026-07-29** (was `_corrections/screen-specs-and-agents.md` C-3).
The plan below assumed the whole feature set would land on `DiscDetailPage.jsx`. It shipped **split
across three surfaces**, and `DiscDetailPage` received none of it:

| Blueprint element | Where it actually ships |
|---|---|
| Role swimlanes, 1–10 wear slider | `PutterLineup.jsx`, rendered on `/bag` by `BagPage.jsx:132` |
| Bézier flight curve | `FlightCurveOverlay`, consumed by `DiscComparePage.jsx:197` |
| 300-putt odometer alert proposing a wear step-down | **Not built.** The 300 threshold exists, but as `COSMETIC_TIER_THRESHOLDS` in `lib/discOdometer.js:9`: 300 chain hits unlocks a cosmetic `rare` tier. It proposes no wear adjustment. |
| Retirement workflow | An ordinary `status` select. No dedicated workflow; `PutterLineup.jsx:133` retires with no confirmation at all. |

The plan text is kept below because its schema reasoning (the `discs.role` model) is still what shipped
and is still authoritative. Read it as design rationale, not as a map of the code. Current per-surface
behavior: `docs/ui/screens/disc-detail.md` (§ 13 carries the full analysis) and
`docs/ui/screens/discs-root.md`.

- **REUSE:** `src/pages/DiscDetailPage.jsx` (details/overrides/bag-membership sections extend rather
  than get replaced), `src/lib/discs.js` (`effectiveFlightNumbers` feeds the curve), `disc.status`
  lifecycle (`in_locker`/`lost`/`retired`/`sold` — retirement workflow maps directly onto setting
  `status='retired'`, no new state machine needed).
- **NET-NEW:** role swimlane UI (PRIMARY/BACKUP/SITUATIONAL swimlanes reading `discs.role`); `FlightCurve`
  SVG component + `flightPath()` pure function rendering factory-baseline (dotted) vs custom-reality
  (solid) curves from flight numbers adjusted by wear; 1–10 wear slider; 300-putt odometer alert
  (reads `total_chain_hits`, proposes wear step-down, `[ APPLY ]` writes it); manual flight-number
  override touch blocks (existing pattern, restyled to zero-typing steppers).
- **Divergence (supersedes v1 SCREEN_SPECS):** v1 proposed putter roles as nullable FK columns on
  `profiles`. **This is superseded** by the blueprint's cleaner model: `discs.role` enum
  (`PRIMARY_PUTTER`/`BACKUP_PUTTER`/`SITUATIONAL_WEATHER`/`STANDARD`) with a partial unique index
  enforcing one PRIMARY per user and an app-side cap of 3 for SITUATIONAL. This reads better for "which
  disc is my gamer" than a profile-side pointer and matches the swimlane UI directly.
- **Dependency:** Layer 1 schema — `discs.wear_score`, `discs.total_chain_hits`, `discs.role` + partial
  unique index, and the disc merge trigger (MAX odometer / MIN wear) for multi-device conflicts.

## Screen 7: Custom Routine Builder

**Blueprint ref:** `RoutineBuilderView`, Section 3 Screen 7. Build as specified — modular stage cards,
segmented steppers, milestone bonus toggles, 100-putt hard ceiling, QR Beam share (parked).

- **REUSE:** `src/lib/regimenScoring.js` (`computeSetScore`, `computeCompletionBonus` — the live
  max-score preview IS these functions, unmodified), `src/pages/RegimenRunPage.jsx` + full canvas stack
  (custom routines run through the shipped engine unmodified), `src/pages/RegimenSelectPage.jsx`
  (~~folds into Screen 4's 3-way launchpad rather than staying a standalone page~~ — **corrected
  2026-07-29**, was `_corrections/play-screens.md` P-5: **both shipped**. The 3-way launchpad is on
  `PracticeMenuPage.jsx:203-234`, *and* `regimen-select` remains a live standalone route
  (`routeMetadata.js:162-171`, `App.jsx:72`, plus the legacy alias `/regimens` → `/practice/regimens`),
  linked from `PracticeMenuPage.jsx:247`. The two surfaces group the same rows by different rules —
  the launchpad splits system vs. own non-archived (`PracticeMenuPage.jsx:126-127`), `regimen-select`
  groups by `drillGroupLabel()` into Classic drills / Scored regimens / Custom routines
  (`RegimenSelectPage.jsx:16-18`) — and neither is a subset of the other, so this is duplication, not
  an unfinished migration. **The launchpad is canonical for launching a routine**; `regimen-select` is
  the browse-by-category surface. It also does not filter archived routines, which the launchpad does —
  registered as `T-regimen-select-1`, not fixed here).
- **NET-NEW:** builder page; stage-card/stepper/milestone-toggle components; 100-putt totalizer +
  hard-disable interlock on `[ ➕ ADD NEXT STAGE ]`; difficulty auto-estimator (unit-tested pure fn).
- **Divergence:** QR Beam routine sharing is **parked** with Social — no `[ 🔗 BEAM ]` button this
  cycle. Editing a routine with recorded runs versions (new row, old retired) rather than mutating —
  this is a project convention (append-only history), not in the blueprint, and is preserved.
- **Dependency:** Layer 1 schema — `putting_regimens.user_id`, `drill_type`, `rules_config jsonb`
  (this IS the Track 2.3 generalization the project already planned), and the 100-putt ceiling trigger.
  Recommendation carried from v1: typed columns stay authoritative for the 5 fixed regimens;
  `rules_config` holds the stage array for builder-created and future ladder-type routines.
  **Corrected 2026-07-29** (was `_corrections/play-screens.md` P-1); two identifiers in the original
  line named things that do not exist:
  - ~~`putting_regimens.created_by`~~ → `user_id`. Ownership is `user_id`
    (`layer1_foundation_schema.sql:85-92`); `created_by` was never added. `DEVLOG.md` records a latent
    Screen 4 bug from exactly this confusion — Zone B's STANDARD/CUSTOM filters tested `r.created_by`
    and would have mis-filed the first saved routine.
  - ~~`total_putts` CHECK ≤ 100~~ → `enforce_routine_putt_cap()` / `regimen_sets_putt_cap_check`.
    There is **no `total_putts` column** anywhere; `grep -rn total_putts` across `*.sql`, `*.js`, and
    `*.jsx` returns nothing. The ceiling is `sum(reps_required)` across a regimen's
    `putting_regimen_sets` rows, enforced by a `before insert or update` row trigger that exempts
    system regimens (`user_id is null`). See standing divergence #6.

  Two open items behind that trigger, both registered rather than fixed: the app-side interlock gates
  `Add next stage` but **not** `Save` (`T-routine-builder-1`), and the trigger's behavior against
  `createCustomRegimen`'s single multi-row insert is untested — if rows in the same statement are not
  visible to the trigger's `SELECT`, the ceiling does not hold on the exact write path the builder uses
  (`T-routine-builder-2`).

## Screen 8: Rapid-Fire Scoring Canvas & Mid-Round Swaps

**Blueprint ref:** `ScoringCanvasView`, Section 3 Screen 8. **Primary input model changes** — read the
divergence carefully before building.

- **REUSE (unchanged plumbing):** `src/lib/instantLaunch/` (FSM, storage, reducer, idempotent sync),
  `src/hooks/useInstantLaunchSession.js`, offline outbox, crash-recovery auto-resume, audio pitch
  ladder + SpeechSynthesis, Android haptics, diagnostic 9-zone miss picker, data-split rule
  (`putt_events` from real-time entry only, batch stays summary-only) — **all of this is input-mode
  agnostic and carries over unchanged**.
- **NET-NEW / restructured:** split-screen MADE (left) / MISSED (right) tap zones become the **primary**
  input surface (blueprint-as-master call — see divergence); visual stack tracker (◆/● pips, top zone,
  flash green/red on score); Web Speech API pacing announcements ("Stage 2. 20 feet. 10 putts. Begin.");
  weather-detection banner → backup-putter swap suggestion (needs `putter_disc_id`, see dependency);
  ad-hoc `[ 🔄 SWAP ]` + `[ 📝 EDIT ]` shortcuts; low-battery/cold-hands panic toggle (whole-screen
  single tap = made, long-press = missed).
- **Divergence — DECIDED AND BUILT 2026-07-08.** The shipped, tested, validated canvas (Track 2.2c)
  used **gesture swipes** (up/down/left cones) as primary input; the blueprint specified **static
  split-screen tap zones**. The blueprint-as-master recommendation was **adopted**: split-screen
  MADE|MISSED tap is the primary scoring input, and the swipe-cone `GestureZone` is demoted to an
  opt-in "gesture mode." Same classification→event pipeline underneath either way; `GESTURE_CONFIG`
  and `classifyGesture` are preserved for the alt mode and nothing tested was deleted.
  Decision recorded at `DEVLOG.md:1635`; the build shipped the same batch (`DEVLOG.md:1558-1571`) —
  `TapZone.jsx` (fixed 50/50, deliberately without `GestureZone`'s streak-driven zone growth),
  `PanicZone.jsx`, `StackTracker.jsx`, and a Tap/Gesture/Panic mode `ChipGroup` on `CanvasContextBar`,
  wired symmetrically into `RegimenRunPage.jsx` and `FreeformLogPage.jsx`.
  **Sign-off language struck 2026-07-29** (was `_corrections/screen-specs-and-agents.md` C-1): this
  bullet previously read "flagged for explicit sign-off, not yet built pending your read" and closed
  "confirm before Layer 4 starts." Layer 4 has shipped. The gate is closed and nothing is blocked on it.
- **This canvas serves two entry points, not one** — added 2026-07-29 (was
  `_corrections/capture-screens.md` C-7). Two shipped routes use the ACTIVE shell and the same capture
  stack: `/practice/regimens/:regimenId/run` (the regimen run this entry describes) and
  `/practice/freeform`. The freeform path predates the blueprint integration and was folded into the
  shared canvas during Track 2.2c; it appears nowhere else in this document, so a reader working only
  from here would not know a second capture screen exists. It also carries a deep-link contract this
  document alludes to without naming: `/practice/freeform?distance=<ft>` is the mechanism behind
  Screen 12's `LAUNCH PURSUIT DRILL` "pre-configures Screen 8 params." Detail:
  `docs/ui/screens/freeform-active.md` and `docs/ui/screens/regimen-active.md`.
- **Dependency:** weather swap drawer's data value needs `putt_events.putter_disc_id` (Layer 1).
  Stack tracker, panic toggle, and Speech pacing have zero schema dependency.
- **Shared with rounds (E2, 2026-07-30):** this drawer's five-value vocabulary
  (`clear`/`headwind`/`tailwind`/`crosswind`/`rain`) is no longer practice-only. `/rounds/:id` and
  `/rounds/:id/summary` record the same condition plus `wind_mph` on `rounds`, through
  `src/lib/roundWeather.js` and `src/components/RoundWeatherPanel.jsx`. Adding a sixth value now means
  three CHECK constraints (`putt_sessions`, `putting_regimen_runs`, `rounds`) and one constant, not a
  local edit here.

- **Bag context on rounds (E2, 2026-07-30):** `/rounds/:id/summary` now carries a read-only bag panel
  (`src/components/RoundBagPanel.jsx`) reporting whether the round's `bag_version_id` snapshot can be
  confirmed against the bag's version timeline. Two tones only — confirmed, and everything else
  stated with its reason — because most reasons a snapshot cannot be confirmed are ordinary and none
  are the player's mistake; the error treatment is reserved so it keeps meaning something. It offers
  no way to attach a snapshot to a round that lacks one: that is a correction, and corrections here
  owe previous/new values.

- **Who else played, on rounds (E2, 2026-07-30):** `/rounds/:id/summary` carries a third panel
  (`src/components/RoundPlayersPanel.jsx`) recording the other players on the card. It is **not** a
  group scorecard screen and must not become one by accretion: every row is a private marker in this
  account, there is no invitation, link, share or notification, and the person named cannot see,
  confirm or contest the entry. The list is rendered in seat order with the owner first and carries
  no medal, highlight, rank or gap — `insights/groupScorecard.js` has tests asserting it exposes
  none of those, because ranking a private card is one sort call from the leaderboard parked under
  Screens 14/15. Companion totals are labelled *Entered by you*, never printed like a scorecard.
  Blueprint Screens 14 (Course Practice Hubs) and 15 (League Bracket Manager) remain PARKED and are
  not unblocked by this: what they need is the account-linking claim, which is deliberately not
  built.

## Screen 9: Session Summary & Progress Report

**Blueprint ref:** `SessionSummaryView`, Section 3 Screen 9. Build as specified — hero scoreboard,
putter performance breakdown, distance drop-off matrix vs. 30-day baseline, celebration overlay,
REPLAY/DASHBOARD footer.

- **REUSE:** `src/pages/HistoryDetailPage.jsx` (per-set/per-distance breakdown rows, `NotesTagsEditor`
  — this screen absorbs and replaces the run page's inline summary phase), `src/lib/insights/`
  (`wilsonInterval`, `pbs.js` PB rules), `src/lib/history.js` fetchers, InstantLaunchPayload (REPLAY
  wiring — re-launch identical config).
- **NET-NEW:** unified `SessionReport` component (one component, two entry points: post-session AND
  history detail — avoids two half-truths, a rule carried from v1); putter-performance-breakdown table
  (needs `putter_disc_id`); distance drop-off matrix vs. rolling 30-day baseline with `⚠️` at >10% dip
  (new pure function, unit-tested); celebration overlay hook (fires on XP/level-up events from Layer 5).
- **Divergence:** none of substance — matches v1's "one report, two doors" ideation almost exactly; the
  blueprint's putter breakdown and drop-off matrix formalize what v1 already proposed.
- **Dependency:** `putt_events.putter_disc_id` (Layer 1) for the putter matrix to have more than one
  row; XP/level celebration needs Layer 5's gamification ledger.

## Screen 10: Global Analytics & Settings Control Tower

**Status: DISTRIBUTED, not a destination** (status table corrected 2026-07-29; was
`_corrections/screen-specs-and-agents.md` C-2, ruled by the owner 2026-07-29 in favor of the
`PRODUCT_ROADMAP.md` model recorded in the 2026-07-11 note at the top of this file). No Control Tower
screen exists or will. This screen's content ships as separate surfaces under ME —
`ConfidenceMapPage.jsx` (practice insights), `SettingsPage.jsx` (behavioral toggles, export, account
controls), and `CareerHubPage.jsx` — plus statistics living with their subject.
`PRODUCT_ROADMAP.md:124-125` records the ME/Profile/Settings split as complete. The entry below is
retained as the design source for those surfaces.

**Blueprint ref:** `AnalyticsControlView`, Section 3 Screen 10. Build as specified — time-series chart
with equipment-milestone injections, sync/storage controls, behavioral toggles, CSV export, 2-step
clear-cache.

- **REUSE:** `src/pages/ConfidenceMapPage.jsx` (embeds as a panel — this screen is its expansion, moves
  under the STATS tab), `src/lib/insights/` (`decayWeightedForm`, `confidenceMap`, `cadenceFingerprint`,
  `fatigueCurve`, `pressureDifferential`, `wilsonInterval`), `src/lib/history.js`
  (`allPuttSamples`/`distanceSamples`), InstantLaunch outbox state + `retrySync`.
- **NET-NEW:** ~~time-series windowing function (`lib/insights/`, unit-tested) with 7/30/90-day range
  chips; **equipment-milestone ★ injections**~~ — **SHIPPED 2026-07-30** as `lib/insights/trend.js` +
  `components/TrendChart.jsx` inside `/practice/stats`, with two deliberate divergences from this
  spec: bucket width scales with the range (1/5/15 days) instead of always being a calendar day, so a
  90-day point is not a dozen putts pretending to be a trend; and the ★ markers read
  `practice_experiment_markers` rather than a `discs.role` change timestamp, because D4 checkpoint 3
  made that append-only table the recorded equipment boundary for metrics. The chart also states a
  direction verdict, gated on the window's two halves having non-overlapping Wilson intervals. The
  **distance heat profile** shipped alongside it (`lib/insights/distanceProfile.js` +
  `components/DistanceHeatProfile.jsx`): practice share and interval-derived strength as two separate
  axes per distance band, with the named mismatch between them — blind spot, not converting,
  over-drilled — as the takeaway, plus untouched bands inside the practised range as coverage gaps;
  sync ledger (pending writes, last-sync time, `[ SYNC NOW ]`); behavioral toggles (units, default
  stack size, haptics); CSV export module (client-side, zipped); 2-step `[ CLEAR CACHE ]` confirmation
  modal (clears the Dexie/InstantLaunch buffer only, never server data; blocked while writes pending).
- **Divergence:** "local database sync controls" = the staged Dexie/TanStack repository + InstantLaunch
  buffer (Layer 1), not a separate concept — same honesty note as v1. Data export here also covers
  Screen 19's export use case; the legal/purge half of Screen 19 stays parked. Phase E E1 ships the
  export slice first inside existing `/profile/settings` rather than blocking data portability on the
  rest of this control tower. Its ZIP contains remote-authoritative, paginated, deterministic CSVs and
  a versioned manifest; unsynced local facts and private photo binaries are explicit exclusions.
- **Dependency:** equipment-milestone markers need `discs.role` change timestamps (Layer 1); sync
  ledger needs the Layer 1 Dexie/TanStack skeleton to have something real to report.

## Screen 11: Player Career Hub

**Status: DISTRIBUTED, not a standalone destination** (status table corrected 2026-07-29; same C-2
ruling as Screen 10). The career content ships as `CareerHubPage.jsx` (`me-root`) with
`ProfilePage.jsx`, `SettingsPage.jsx`, `TrophyRoomPage.jsx`, and the goals/reports screens as siblings
under ME, rather than as one overlapping Career Hub destination. The entry below is retained as the
design source.

**Blueprint ref:** `PlayerCareerHubView`, Section 3 Screen 11. Build as specified minus the PDGA
scraper — verified identity card, target rating bar, skill radar, most-trusted-putter audit.

- **REUSE:** `src/lib/profile.js` (extend with PDGA fields), `src/lib/insights/` outputs feed the
  5-axis radar (C1 accuracy from `confidenceMap`, endurance from `volumeLedger`, wind mastery from
  weather-tagged sessions once Layer 1's weather columns exist), `src/lib/discs.js`
  (`effectiveFlightNumbers`) + `total_chain_hits`/accuracy join for the most-trusted-putter query.
- **NET-NEW:** career hub page; verified-identity card with zero-typing numeric keypad for PDGA number
  entry; target-rating progress bar (manual rating updates, not scraped); SVG pentagon skill radar
  component; most-trusted-putter card (pure query: highest `total_chain_hits × accuracy` combination).
- **Divergence:** `fetch-pdga-profile` Supabase Edge Function scraper is **not built this cycle**
  (standing divergence #7) — rating/points are manually entered and editable, same card layout either
  way, so the scraper can slot in later without a UI change.
- **Dependency:** Layer 1 — `profiles.pdga_number/division/pdga_rating/target_rating`;
  `discs.total_chain_hits` for the trusted-putter query; weather columns for the wind-mastery radar
  axis (degrades gracefully to "insufficient data" without them, per house Wilson-interval discipline).
  **Corrected 2026-07-29** (was `_corrections/me-screens.md` C-2): the column shipped as
  ~~`current_rating`~~ **`pdga_rating`** (`layer1_foundation_schema.sql:50`, re-granted at
  `layer5_gamification_hardening.sql:175`). `grep -rn "current_rating" --include=*.sql .` matches
  nothing — the identifier exists in no schema or migration file.
  **This is also a live shipped defect, not only a doc error.** `CareerHubPage.jsx:24,25,41` reads
  `profile.current_rating`, which is therefore always `undefined`: the identity card's `Current` value
  always renders `—`, `ratingProgress` is always `null` so the target-rating bar always has
  `width: 0%`, and its `aria-label` always reads `Rating progress unavailable`. Compounding it,
  **no UI anywhere writes `pdga_rating`** (`grep -rn "pdga_rating" src/` returns nothing);
  `ProfilePage.jsx:296-303` edits `target_rating` only. So correcting the read is necessary but not
  sufficient — the field needs an entry point (`/profile/details` is the obvious home) or the bar is
  permanently inert. Registered as `T-me-root-1` in `docs/ui/screens/me-root.md`; it went undetected
  because there is no page test for `CareerHubPage.jsx`.

## Screen 12: Trophy Room & Social Gamification Hub

**Blueprint ref:** `TrophyRoomGamificationView`, Section 3 Screen 12. Build **minus** the Virtual Bag
Tag card and QR Beam challenge — those are Social module and parked.

- **REUSE:** `src/lib/insights/pbs.js` (PB detection feeds badge-unlock triggers), existing
  history/regimen-run data as the event source for badge evaluation.
- **NET-NEW:** RPG level/XP bar + ledger modal (`lib/gamification/` — `calculateXpForLevel`,
  1000 × 1.15^(n−1)); Active Pursuits carousel with 1-tap `[ ▶️ LAUNCH PURSUIT DRILL ]` (pre-configures
  Screen 8 params to close the gap on a near-complete badge); 4-way filtered trophy wall
  (ALL/UNLOCKED/IN PROGRESS/LOCKED) with inline progress bars; `BadgeEvaluatorService` — pure,
  unit-tested evaluation functions run post-scoring/post-inventory/post-ingestion (mirrors the
  event-evaluation matrix in the blueprint's `GAMIFICATION_AND_XP_LEDGER.md`); 25 seeded badge
  definitions.
- **Divergence:** Virtual Bag Tag card + `[ ⚔️ CHALLENGE PEER ]` + QR Beam are **parked with Social**
  (standing divergence #8) — this screen ships without them; the tag-swap contract in
  `COMPETITION_ENGINE.md` is reference material for when Social unparks, not built now.
- **Dependency:** Layer 1 — `profiles.rpg_level/current_xp`, new `badges`/`badge_progress`/`xp_events`
  tables (ledger persisted server-side, not just localStorage, so it survives device changes).

## Screen 13: Frictionless UDisc Ingestion Center

**Blueprint ref:** `UDiscDataIngestionView`, Section 3 Screen 13, governed by
`MASTER_PROJECT_BLUEPRINT.md`'s `INGESTION_PARSER_SPEC.md`. Build as specified, targeting existing
tables.

- **REUSE:** existing `rounds`/`round_holes`/`courses` tables and the Track 1.5 provenance pattern
  (`external_source`/`external_ref` — designed specifically for idempotent imports like this).
- **NET-NEW:** 1-tap CSV drop zone + native file-picker/share-sheet entry; async Web Worker parser
  (column-mapping per the governance spec: `CourseName`→course, `Date`+`Time`→ISO round date,
  `Total`/`+-`→score, `Putts C1`/`Putts C2`→odometer increments); dedupe via compound lookup on
  `(external_source='udisc', external_ref)` rather than the blueprint's raw date+course check (more
  robust — survives course-name variance via the existing `course_aliases` table); capped retroactive
  XP (`min(totalParsedPutts * 10, 10000)`); `[ 🗑️ CLEAR IMPORTED HISTORY ]` guardrail scoped to
  `external_source='udisc'` rows only.
- **Divergence:** writes the **existing shared schema** (`rounds`, not a bespoke `UDiscRoundLog`
  table) — this is the whole reason Track 1.5 groundwork was built ahead of time.
- **Interaction with activity-only rounds (E2, 2026-07-30):** `rounds.scoring_mode` now distinguishes
  a round with a scorecard from one logged without. An import carrying per-hole scores writes
  `hole_by_hole`, which is the column default, so the importer needs no change to be correct. A
  provider row that carries only a total is the case to decide deliberately: it is `activity_only`
  with a **stated** `total_score`, and it must not be written as a `hole_by_hole` round with an empty
  card — that is the exact ambiguity `scoring_mode` exists to remove. Import provenance stays on
  `external_source`/`external_ref`; scoring mode is a separate fact from where the round came from.
- **Dependency: none outstanding — ~~verify Track 1.5 landed~~ VERIFIED 2026-07-29** (was
  `_corrections/screen-13.md` C-10). The original instruction ("confirm at Layer 1 start, fold in if
  missing") is closed; leaving it would send an agent to redo a completed audit. Everything landed, and
  four pieces of scaffolding the old note did not mention exist too:

  | Piece | Evidence |
  |---|---|
  | `rounds.external_source` / `external_ref` | `disc_locker_and_layouts_schema.sql:105-106` |
  | `courses.external_source` / `external_ref` | `:109-110` |
  | Partial unique index making re-import idempotent, `rounds` | `:117-118` |
  | Same, `courses` | `:120-121` |
  | `course_aliases` + unique case-insensitive alias index | `:128-138` |
  | `ACTIVITY_SOURCES.UDISC_IMPORT` | `activityLifecycle/types.js:32` |
  | Import source registered as metric-eligible | `metrics/registry.js:15` |
  | `XP_PER_IMPORTED_PUTT = 10` | `gamification/constants.js:12` |
  | `IMPORT_XP_CAP = 10000`, with a comment naming Screen 13 | `gamification/constants.js:14-17` |
  | `UDisc import` XP-ledger label | `trophyRoom/XpLedgerModal.jsx:11` |

  **Only the parser and the UI remain.** The XP economy and the activity source already ship.
  Consequently `IMPORT_XP_CAP` and `XP_PER_IMPORTED_PUTT` are currently **dead constants** whose only
  stated consumer is this unbuilt screen — they must not be removed as unused.
  Full design document: `docs/ui/screens/_planned/udisc-ingestion.md`.

---

## Parked screens (designed in blueprint, not built this cycle)

Full wireframes and rationale live in `MASTER_PROJECT_BLUEPRINT.md`; only the parking reason is
recorded here.

| # | Screen | Reason parked |
|---|---|---|
| 14 | Course Practice Hubs & Leaderboards | Social module — geo-fenced check-ins, local leaderboards, kudos feed; no dependency blocking it, just sequencing (Screens 1–13 first) |
| 15 | Putting League Bracket Manager | Social module — depends on 14's peer/leaderboard concepts and the parked Competition Engine (match state machine, tie-break protocol) |
| 16 | Smartwatch Companion & Wearables Hub | Hardware — needs a native companion app decision (Track 4, parked pending platform decision) |
| 17 | Pro-Shop & Gear Discovery Engine | Commerce — needs real retail partnerships/affiliate deals before the UI has anything to point at |
| 18 | Offline Sync & Conflict Resolution Center | Utilities — natural companion of the Layer 1 local-first layer, but the merge trigger (MAX odometer/MIN wear) ships in Layer 1's schema without needing this UI yet; build once conflicts are observed in practice |
| 19 | Privacy & Data Sovereignty Hub | Utilities — data export is already covered by Screen 10; the legal-accordion + total-purge half waits for when the app has real external users needing it |
| 20 | Firmware & Sensor Diagnostics | Hardware — BLE smart-basket sensors are a Track-4-adjacent future decision, no sensors exist to diagnose yet |
| 21 | Emergency Panic Recovery Overlay | Utilities — genuinely cheap to build later; sequenced after the Dexie layer exists (Layer 1) so there's something to recover from |

## Suggested build order

Matches `DEVELOPMENT_PLAN.md`'s execution layers: **Layer 0** (this doc + companion doc updates) →
**Layer 1** (schema + Dexie/TanStack skeleton + 4-tab bar) →
**Layer 2** (Screens 1–3, front-door) → **Layer 3** (Screens 4–6, hubs) → **Layer 4** (Screens 7–9,
execution engine — ~~**Screen 8's input-model divergence needs explicit sign-off before this layer
starts**~~ signed off and built 2026-07-08, see Screen 8) → **Layer 5** (Screens 10–13, analytics +
progression; 10 and 11 shipped DISTRIBUTED rather than as destinations, and 13's parser/UI is the only
Layer 5 item still unbuilt).

**Current sequencing authority is `PRODUCT_ROADMAP.md`, and the screen-level resume point is
`docs/ui/EXECUTION_PLAN.md`.** The build order above is the original Layer 0–5 plan and is retained as
the record of how the cycle was sequenced.
