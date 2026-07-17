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

## Status legend

- **IN SCOPE** — building this cycle, per the execution layers below
- **PARKED** — designed in the blueprint, deliberately deferred; reasoning given, not abandoned

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
| 10 | Global Analytics & Settings Control Tower | IN SCOPE | 5 |
| 11 | Player Career Hub | IN SCOPE | 5 |
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
5. **Navigation:** **PLAY / DISCS / ME**, adding **COURSES** when the course directory ships. The
   standalone Stats tab is obsolete: player-wide summaries live in ME and disc/bag/routine/session/
   course statistics live with their subject.
6. **Interlocks:** both hard, as specified — 100-putt routine ceiling and 35-disc bag capacity, each
   with app-side disabling AND a DB `CHECK` constraint.
7. **PDGA:** manual entry (zero-typing numeric keypad) — the blueprint's `fetch-pdga-profile` scraper
   Edge Function is deferred (PDGA has no official public API; scraping is ToS-gray).
8. **Bag tags / QR Beam / P2P:** parked with the Social module wherever they appear inside an
   in-scope screen (Screen 12's Trophy Room ships without them).

---

## Screen 1: Welcome Landing

**Blueprint ref:** `WelcomeLandingView`, Section 3 Screen 1. Build as specified — this screen already
matches the earlier-approved front-door plan almost exactly (offline badge, social-proof strip, GET
STARTED CTA, guest escape hatch).

- **REUSE:** Sun-Drenched Topo theme tokens (shipped 2.2a), `btn-primary` pattern, topo-background CSS
  treatment already used elsewhere.
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
  checkbox, sync-status pill); `src/lib/supabaseClient.js` — confirm `persistSession: true` /
  `autoRefreshToken: true`.
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
  ready-made gate + `units` field for Step 3), `src/lib/discLocker.js` (`searchMolds`, `upsertDisc`,
  `fetchBags`, `createBag`, `addDiscToBag`), `src/hooks/usePuttHaptics.js`
  (`supported`/`vibrateMake`/`vibrateMiss`/`vibrateUndo`), InstantLaunch profile defaults
  (`favoritePutterDiscId`). **MVP / Axiom / Streamline are exactly the manufacturers already seeded**
  (1B catalog import) — the brand selector and mold list are real catalog queries, not hardcoded data.
- **NET-NEW:** `src/pages/OnboardingPage.jsx` + 3 step components; progress bar; brand-segment/mold-
  radio/weight-stepper components; goal cards; "Practice Stack" default-bag genesis on confirm.
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

- **REUSE:** `src/pages/BagPage.jsx` (MY BAGS tab content: switcher, disc list, `FlightChart`),
  `src/pages/BagLockerPage.jsx` (locker content, filters/sort/grid-list), `src/pages/DiscFormPage.jsx`
  (ADD TO BAG target), `src/lib/discFilters.js` (`filterDiscs`/`sortDiscs`), `src/lib/discLocker.js`
  (`searchMolds`, `fetchBagDiscs`, `fetchUserDiscs`), `src/lib/bags.js` (`bagViewDiscs`,
  `flightChartPoints`).
- **NET-NEW:** 3-way segmented hub shell (MY BAGS / PUTTERS / UNIVERSE) replacing the flat page
  siblings; PUTTERS tab = the Screen 6 lineup filtered view; UNIVERSE tab = vertical accordion browse
  over `disc_molds` (Mold → Plastic → Run) — first read-only destination for the catalog outside the
  add-disc picker; 35-disc capacity interlock (blue→orange→rust bar + disabled Add at 35); ghost-slot
  wishlist card component (dashed border, stability-gap detection).
- **Divergence:** Ghost Slot's `[ FIND ]` action would bridge to Screen 17 (Pro-Shop) — **parked**.
  This cycle, `[ FIND ]` is hidden/disabled; the wishlist card still renders (it's pure gap detection
  over owned discs' flight numbers, zero dependency on retail). QR Beam bag-share is parked with
  Social — no `[ 🔗 BEAM QR ]` button this cycle.
- **Dependency:** 35-disc interlock needs the Layer 1 `bags.capacity` default/CHECK migration.

## Screen 6: Putter Lineup Manager & Live Flight Curve Editor

**Blueprint ref:** `PutterLineupView`, Section 3 Screen 6. Build as specified — role swimlanes, sticky
Bézier flight canvas, wear slider with odometer alert, retirement workflow.

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
  (folds into Screen 4's 3-way launchpad rather than staying a standalone page).
- **NET-NEW:** builder page; stage-card/stepper/milestone-toggle components; 100-putt totalizer +
  hard-disable interlock on `[ ➕ ADD NEXT STAGE ]`; difficulty auto-estimator (unit-tested pure fn).
- **Divergence:** QR Beam routine sharing is **parked** with Social — no `[ 🔗 BEAM ]` button this
  cycle. Editing a routine with recorded runs versions (new row, old retired) rather than mutating —
  this is a project convention (append-only history), not in the blueprint, and is preserved.
- **Dependency:** Layer 1 schema — `putting_regimens.created_by`, `drill_type`, `rules_config jsonb`
  (this IS the Track 2.3 generalization the project already planned), `total_putts` CHECK ≤ 100.
  Recommendation carried from v1: typed columns stay authoritative for the 5 fixed regimens;
  `rules_config` holds the stage array for builder-created and future ladder-type routines.

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
- **Divergence (flagged for explicit sign-off, not yet built pending your read):** the shipped, tested,
  validated canvas (Track 2.2c) uses **gesture swipes** (up/down/left cones) as primary input. The
  blueprint specifies **static split-screen tap zones** as primary. Recommendation: **adopt split-screen
  tap as primary** (blueprint-as-master, since it's simpler, faster to relearn, and matches "zero
  visual focus" better than a gesture cone does) — demote the existing gesture engine to an **alternate
  input mode** toggle (same value proposition as v1's "Tap Mode" idea, just inverted which one is
  default). Same classification→event pipeline underneath either way; `GESTURE_CONFIG` thresholds and
  `classifyGesture` are preserved for the alt mode. **This is the one build decision in this batch
  that most changes shipped, tested UI — confirm before Layer 4 starts.**
- **Dependency:** weather swap drawer's data value needs `putt_events.putter_disc_id` (Layer 1).
  Stack tracker, panic toggle, and Speech pacing have zero schema dependency.

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

**Blueprint ref:** `AnalyticsControlView`, Section 3 Screen 10. Build as specified — time-series chart
with equipment-milestone injections, sync/storage controls, behavioral toggles, CSV export, 2-step
clear-cache.

- **REUSE:** `src/pages/ConfidenceMapPage.jsx` (embeds as a panel — this screen is its expansion, moves
  under the STATS tab), `src/lib/insights/` (`decayWeightedForm`, `confidenceMap`, `cadenceFingerprint`,
  `fatigueCurve`, `pressureDifferential`, `wilsonInterval`), `src/lib/history.js`
  (`allPuttSamples`/`distanceSamples`), InstantLaunch outbox state + `retrySync`.
- **NET-NEW:** time-series windowing function (`lib/insights/`, unit-tested) with 7/30/90-day range
  chips; **equipment-milestone ★ injections** — vertical markers on the trend chart at the exact
  timestamp a disc's `role` changed to PRIMARY_PUTTER (reads the same role column Screen 6 writes);
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
- **Dependency:** Layer 1 — `profiles.pdga_number/division/current_rating/target_rating`;
  `discs.total_chain_hits` for the trusted-putter query; weather columns for the wind-mastery radar
  axis (degrades gracefully to "insufficient data" without them, per house Wilson-interval discipline).

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
- **Dependency:** **verify Track 1.5 landed** — `external_source`/`external_ref` on `rounds`/`courses`
  and the `course_aliases` table were planned to ride with the 1B migration; confirm at Layer 1 start,
  fold in if missing.

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
**Layer 1** (schema + Dexie/TanStack skeleton + 4-tab bar, Opus 4.8, manual DB backup first) →
**Layer 2** (Screens 1–3, front-door) → **Layer 3** (Screens 4–6, hubs) → **Layer 4** (Screens 7–9,
execution engine — **Screen 8's input-model divergence needs explicit sign-off before this layer
starts**) → **Layer 5** (Screens 10–13, analytics + progression).
