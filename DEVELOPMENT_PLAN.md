# Development Plan

Last updated: 2026-07-16
Companion docs: `CLAUDE.md` (architecture), `MASTER_PROJECT_BLUEPRINT.md` (21-screen design authority),
`SCREEN_SPECS.md` (integration layer: status + reuse mapping + divergences per screen),
`PRODUCT_ROADMAP.md` (current sequencing/disposition authority), `FEATURE_BACKLOG.md` (full feature
status), `DEVLOG.md` (work record)

## ACTIVE PLAN: 2026-07-11 product-wide reconciliation

`PRODUCT_ROADMAP.md` supersedes the execution order in the 2026-07-05 Layers below. Layers 1–4 are
shipped history; Layer 5's standalone Analytics/Career screens are replaced by contextual statistics
and the ME career dashboard. Current sequence: production/shared contracts → DISCS data foundation →
DISCS experience/intelligence → PLAY/ME/report integration → courses/rounds/interoperability. Every
parked item has an explicit revisit trigger in `PRODUCT_ROADMAP.md`.

The approved bottom navigation is **PLAY / DISCS / ME**; add **COURSES** when the course directory
ships. Do not build a standalone Stats tab.

Current model policy: **GPT-5.3-Codex medium** for normal UI/CRUD/tests and **GPT-5.6 high** for
architecture, migrations, RLS/security, synchronization, rules engines, and complex algorithms. Old
Sonnet/Opus labels below are preserved only as historical records of completed work.

Phase B item 5 complete (2026-07-16): immutable `disc_odometer_events`, RPC-maintained throws/chain-hit/
airball totals, permanent 300/1,000/5,000 chain-hit cosmetic unlocks, direct-total guards, Dexie v11
offline replay, and disc-detail odometer/history UI are live and verified. Rollback-only milestone,
idempotency, correction-retention, owner/foreign-user, direct-write, and zero-residue checks passed.
Phase B is complete. Phase C items 1–3 shipped 2026-07-16: collection-first DISCS/profile
consolidation, atomic grouped bag editing, and the accessible current-reality/official Flight Spectrum.
Phase C items 1–4 shipped 2026-07-16: collection-first DISCS/profile consolidation, atomic grouped
bag editing, accessible current-reality/official Flight Spectrum, and the schema-free Bag Resonance draft
with transparent component presets and capacity-neutral ghost gaps. Phase C item 5 disc/bag comparisons
shipped 2026-07-16. Phase D item 1 shipped 2026-07-16 with revised PLAY ordering, deterministic
Level-1 Quick Play fallback, a device-local default selector, and Dexie v12 regimen/set caching.
Phase D item 2 shipped 2026-07-16 with pattern-gated stage fatigue check-ins, canonical session
factors, perceived effort, weather context, immutable owner-scoped observations, Dexie v13 mirroring,
and a cross-device round-turn preference. Phase D item 3 checkpoint 1 shipped 2026-07-16:
notification-preference, goal lifecycle/event, and immutable timezone-windowed weekly-report contracts;
owner-scoped RLS/indexes/grants; atomic goal RPCs; Dexie v14 mirrors; and pure goal/report functions.
The ME career summary is shipped with evidence-backed practice telemetry, a sparse-data-safe five-axis
radar, rating/identity context, and a physical-disc trusted-putter audit. Profile/Settings separation
and contextual notification preferences are shipped. Goal creation, pause/resume/completion/
cancellation, optimistic version checks, and immutable history UI are shipped. Phase D item 3 is
complete: `/profile/reports` now generates the latest completed DST-aware Monday–Sunday window from
completed visible activity, inserts immutable superseding versions, and exposes remote-first/Dexie-
fallback version history. Phase D item 4 scope reconciliation is complete.
Phase D item 4 checkpoint 1 shipped 2026-07-16: `/practice/stats` now enforces completed-visible
metric eligibility and combines the shipped Wilson distance-confidence view with a 9-zone miss-
tendency grid over real-time diagnostic events. It exposes zoned/total capture coverage, never derives
miss direction from batch summaries, and requires three same-vector misses before naming a repeated
pattern. Phase D item 4 checkpoint 2 shipped 2026-07-16: longitudinal physical-putter comparison now
groups exact attributed discs, exposes attribution coverage and Wilson uncertainty, and limits its
distance-adjusted delta to shared distance bands with at least 10 attempts. Explicit immutable
new-putter experiment markers and a before/after engine shipped 2026-07-16 as checkpoint 3. Marker
windows end at the next marker, both sides require 10 attributed attempts, and small-sample Wilson
intervals remain visible. Schema-free best-run ghost pacing shipped as checkpoint 4 with a frozen,
crash-recoverable profile and a three-event intervention floor. Drill generalization is next.

## Phase A execution sessions — approved 2026-07-12

Authoritative behavior: `PHASE_A_ARCHITECTURE.md`. Implement in this order; each numbered session is a
reviewable checkpoint, not permission to perform later sessions early.

1. **A1 — shell audit and route contract** (`GPT-5.3-Codex`, medium, COMPLETE 2026-07-12): mapped
   routes, shell/scroll/recovery behavior; added tested `src/lib/routeMetadata.js` compatibility
   contract and retained the `/regimens` alias. No database work or rendered-navigation change.
2. **A2 — shared shell implementation** (`GPT-5.3-Codex`, medium, COMPLETE 2026-07-12): added
   GlobalHeader, ScreenScrollRegion, SheetHost, ToastHost, PLAY/DISCS/ME TabBar, ActiveActivityShell,
   safe-area layout, per-route scroll restoration, and current-tab scroll/root behavior. Existing URLs
   and feature pages remain compatible. Local browser smoke check passed; authenticated mobile/device
   verification remains required because anonymous auth is disabled in the connected environment.
3. **A3 — pure local lifecycle engine** (`GPT-5.6` high design; `GPT-5.3-Codex` medium build,
   COMPLETE 2026-07-12): added lifecycle/type/source/reason constants, named policies, an
   optimistic-concurrency-aware transition table/reducer, practice-replacement/round-confirmation
   planning, and exhaustive valid/invalid/idempotency tests. No migration or persistence work.
4. **A4 — Dexie repository and InstantLaunch bridge** (`GPT-5.6`, high, COMPLETE 2026-07-12):
   added Dexie v2 activity/state-event stores, ordered diagnostic lifecycle outbox storage, a
   transactional repository with the single-active invariant and atomic replacement, lossless
   InstantLaunch v1→v2 migration, and an unwired recovery bridge that preserves proven capture.
   Real IndexedDB upgrade/concurrency/rollback/retry tests use `fake-indexeddb`.
5. **A5 — live schema audit and migration design** (`GPT-5.6`, high, COMPLETE 2026-07-12): confirmed
   the manual backup; audited live schema/RLS/indexes/test data; drafted the unapplied append-only
   activity migration and recovery packet. No remote SQL was applied.
6. **A6 — server lifecycle and RLS** (`GPT-5.6`, high, COMPLETE 2026-07-12): applied the activity
   envelope/backfill, hardened serialized RPCs with public invoker wrappers, owner-FK indexes, and the
   replacement/concurrency contract. Live ownership/forgery/concurrency/retry tests and advisors pass;
   unrelated historical advisor findings remain baseline debt.
   Update handoff/docs, commit, push, and clear context.
7. **A7 — practice integration** (`GPT-5.3-Codex`, medium, COMPLETE 2026-07-12): freeform and regimen
   now mirror stable parent UUIDs into Dexie, finalize/mark incomplete offline-first, and flush lifecycle
   RPCs before typed parent/summary/gesture rows. Gesture-event versus batch-summary ownership remains
   unchanged; route pause/resume, stable installation IDs, active pill, and PLAY resume card are shipped.
8. **A8 — history and recovery** (`GPT-5.6` Sol high audit/metric review; Sol medium UI by user
   selection, COMPLETE 2026-07-12): audited visibility/correction RPCs are applied and live-verified;
   the metric registry fixes eligibility/capture contracts; unified activity history now ships local
   hide/restore/correction, incomplete and sync states, Recently Deleted, and metric exclusion/recovery.
9. **A9 — notifications** (`GPT-5.6 Terra`, medium, COMPLETE 2026-07-12): actionable notification persistence, bell/badge/
   overlay/dedup/deep links; activity-review and sync categories first; deterministic weekly-report hook.
10. **A10 — offline equivalence and release candidate** (`GPT-5.6 Sol`, high, COMPLETE 2026-07-12):
    crash/reload/reconnect and concurrent-device tests; remove only proven duplicate ownership; full
    unit/lint/build/RLS/browser/accessibility/device gates; final high-risk review and release documentation.
    The independent authenticated-session/real-device gate was reported passed by the user; Codex did not
    directly observe that second session or collect its device metadata. Phase A is now closed at the
    documentation and planning boundary; Phase B began with design review only, and the B1.7/B1.8
    candidate/artifact plus admin review/promotion checkpoints are now applied and verified.

Mandatory reviews: route contract before A2; transition table before A4; migration before and after
A6; the first practice mode before integrating the second; audit/statistics before closing A8; full
offline/security review before release. Push green branches after major checkpoints; merge only through
the reviewed production workflow.

## Historical active plan: Blueprint integration (Layers 0–5)

As of 2026-07-05 this supersedes Tracks 1–2's execution as the primary sequencing (Tracks 1–4 below are
kept as historical record; most of what they describe is either shipped or absorbed into a Layer).
Full context, user rulings, and per-screen detail: `SCREEN_SPECS.md`. Model recommendations per layer
are stated below — **confirm the active model matches before starting a layer.**

- **Layer 0 — Documentation alignment** (Sonnet 5, IN PROGRESS): blueprint into repo, `SCREEN_SPECS.md`
  rewrite, this doc + `CLAUDE.md` + `FEATURE_BACKLOG.md` + `DEVLOG.md` updated.
- **Layer 1 — Foundation** (Opus 4.8, COMPLETE): one append-only schema file (disc
  role/wear/odometer, bag capacity, profile PDGA/XP/level fields, weather columns, `putt_events.putter_disc_id`,
  routine `rules_config`/`drill_type`/100-putt CHECK, badges/badge_progress/xp_events tables, disc
  merge trigger); Dexie.js + TanStack Query repository skeleton (staged local-first, behind a
  repository interface — InstantLaunch folds in last, not first); shared zero-typing UI primitives;
  TabBar → 4-tab (PLAY/BAGS/STATS/PRO).
- **Layer 2 — Front-door slice** (Sonnet 5, COMPLETE): Screens 1–3 — Splash, Auth (email 6-digit OTP + Apple/Google
  SSO + anonymous guest + claim-progress conversion), Onboarding wizard (goal cards → putter
  provisioning with smart default + Practice Stack bag genesis → units + haptic test). Apple/Google SSO
  and anonymous sign-in need enabling in the Supabase dashboard before they work end-to-end — see
  DEVLOG 2026-07-05.
- **Layer 3 — Hubs** (Sonnet 5, COMPLETE): Screens 4–6 — Dashboard hub (instant-replay hero, 3-way launchpad),
  Bag manager (MY BAGS/PUTTERS/UNIVERSE + 35-disc interlock + ghost-slot wishlist), Putter lineup
  (role swimlanes, Bézier flight curve, wear slider + odometer alert).
- **Layer 4 — Execution engine** (Opus 4.8 for the routine rules engine, Sonnet 5 for UI, **COMPLETE**):
  Screens 7–9 — Custom Routine Builder (**SHIPPED** 2026-07-07, Opus 4.8: 100-putt interlock, live score
  preview reusing `regimenScoring.js` unmodified), Scoring Canvas (**SHIPPED** 2026-07-08, Sonnet 5:
  split-screen tap primary, gesture/panic alt modes, stack tracker, weather→backup swap suggestion,
  ad-hoc swap/edit; also fixed a pre-existing sync-scheduler race that could strand a parent-row update
  — see DEVLOG), Session Summary (**SHIPPED** 2026-07-08, Sonnet 5: one `SessionReport` component across
  History detail + regimen summary + a new freeform summary phase, putter breakdown, distance drop-off
  vs 30-day baseline, replay).
- **Layer 5 — Analytics + Progression** (Sonnet 5 for UI, Opus 4.8 for the UDisc parser + badge
  evaluator): Screens 10–13 — Analytics tower (equipment-milestone chart markers, sync ledger, CSV
  export), Career Hub (manual PDGA entry, skill radar, most-trusted-putter), Trophy Room (**SHIPPED**
  2026-07-11, Opus 4.8: XP ledger + 25-badge evaluator + Trophy Room UI, all writes hardened behind
  SECURITY DEFINER RPCs after a code-review pass — see DEVLOG), UDisc CSV ingestion (writes existing
  `rounds` table via
  Track 1.5 provenance).

**Parked this cycle** (see `SCREEN_SPECS.md` for full reasoning): Social (Screens 14–15, QR Beam,
virtual bag tags, competition engine), Hardware (16, 20 — needs native/BLE), Commerce (17 — needs
retail partnerships), Utilities (18, 19, 21 — natural companions of Layer 1, low urgency solo).

---

## Historical: Tracks 1–4 (pre-blueprint plan, 2026-07-03)

Superseded in sequencing by the Layers above as of 2026-07-05, but most Track 1/2 items are either
already shipped or directly absorbed into a Layer (noted inline where relevant). Kept for context.

## Guiding structure

Four tracks. Tracks 1–2 are sequential build work; Track 3 is an experimental spike run when convenient; Track 4 is parked until a native decision is made.

- **Track 1 — Foundation data:** player profile + disc locker/bags (already planned, Phase A schema generated)
- **Track 2 — Practice depth:** the web-viable features from the sensor/drills TDD, sorted by value:ease ratio
- **Track 3 — Experimental:** acoustic make-detection prototype
- **Track 4 — Native iOS roadmap:** parked sensor-fusion features (see FEATURE_BACKLOG.md § Native iOS Roadmap)

**Cross-cutting dependency:** the **per-putt capture layer** (Track 2, item 2) is the single enabler for drills, miss diagnostics, ghost pacing, voice coaching, AND any future sensor input (acoustic/CV results write to the same records as manual taps). Design once, feed from many sources.

---

## Track 1 — Foundation data (committed, in flight)

### 1A. Player profile expansion — SHIPPED
- **Schema:** `phase_a_profile_schema.sql` (generated) — handedness, per-throw confidence + max distance (value+source pattern), C1 comfort, specialty_shots[], target_rating, units, private injury_notes
- **UI:** sectioned profile page at `/profile` (Identity / Throwing / Calibration / Goals), edit-in-place per section; first-login nudge when throwing profile empty
- **Rules:** injury_notes never selected in any shared/social view (convention + query discipline)
- **Model:** Sonnet 5 · **Effort:** S · **Test:** save/reload each section; check constraints reject bad enums

### 1B. Disc molds reference + locker migration — SHIPPED

> **⚠️ Population policy (decided 2026-07-13): automated catalog ingestion is SCRAPPED.**
> Do NOT build, extend, run, or re-plan a manufacturer-site scraper / server ingestion pipeline to
> populate `disc_molds`. The owner will populate discs **manually, later**. Standing instructions for
> any future session touching this section:
> - **Populate canonical catalog rows by hand**, when the owner is ready — through an owner-supplied,
>   reviewed seed/data migration. Ordinary clients are read-only and no longer insert `disc_molds`.
>   There is no seed-import dependency and no scraping step anymore.
> - **The migration step below is still valid** (it derives molds from discs the owner already entered),
>   but it is no longer blocked on or preceded by any automated seed.
> - **The Phase B catalog-ingestion surface was torn down on 2026-07-14.** Its append-only migration
>   history remains, but the Edge Functions, staging/admin client code, and ingestion-only live tables
>   are gone. Do not revive them without a new owner decision.

- **Schema (to generate):** `disc_molds` (shared; insert-open, update-closed RLS; unique on lower(manufacturer), lower(mold_name); nullable enrichment: image_url, pdga_approved_date, production_status, plastics[], diameter, rim width) + `discs` alterations (mold_id FK, nickname, weight_grams, color, override flight numbers, photo_url, acquired_on, provenance, status lifecycle)
- **Migration:** script creating molds from distinct (manufacturer, mold) pairs in existing discs, linking copies, moving manual numbers to overrides where they differ from stock. **Model: Opus 4.8** — destructive-adjacent data work
- **Seed:** ~~import script pulling mold specs from manufacturer sites~~ **(scrapped — see population policy above).** Canonical rows are populated manually by the owner through reviewed data changes.
- **UI:** `/bag/locker`, `/bag/discs/new` (search approved molds → pick → customize), `/bag/discs/:id`
- **B2 repository — SHIPPED 2026-07-15:** read-only normalized catalog snapshot behind TanStack Query
  and Dexie v6, with offline fallback for mold picker, Universe search, onboarding, and URL handoff.
- **Effort:** M–L · **Test:** migration dry-run against copy of data; effective-flight-number coalesce unit tests

### 1C. Bags + membership + flight chart — SHIPPED
- **Schema (to generate):** `bags` (name, description, bag_type, is_default via partial unique index, capacity) + `bag_discs` join (unique pair, RLS via bag ownership)
- **Tandem accommodation:** add nullable `bag_id` FK to `rounds` ("which bag was I carrying") — enables per-bag performance stats and caddie context later
- **Rules:** disc can be in multiple bags; lost/retired/sold excluded from bag views, memberships preserved
- **UI:** `/bag` (default bag + switcher + flight chart scatter: speed × turn+fade using effective numbers), `/bag/manage`
- **Model:** Sonnet 5 · **Effort:** M · **Test:** default-bag uniqueness; status filtering

### 1.5 Round/course groundwork (schema-only, rides with 1B session)
Cheap accommodations that make the confirmed course-catalog / round-management / UDisc-import destinations cheap. No UI in this phase.
- **Promote layouts to first-class:** new `layouts` table (course_id, name, is_default); `holes.course_id` → `holes.layout_id`; `rounds.layout_name` text → `rounds.layout_id` FK. Must land BEFORE any real round data exists — this is the highest-priority item in the phase. Mirrors UDisc's course/layout model for clean import mapping.
- **Provenance columns:** nullable `external_source` + `external_ref` on `rounds` and `courses` — makes future imports idempotent (re-import updates, never duplicates) and keeps native vs imported data distinguishable forever
- **`course_aliases` table:** (alias → course_id), insert-open/update-closed RLS, same pattern as disc_molds (build both in the same session). Solves UDisc name matching ("East Roswell Park" vs "East Roswell Park DGC") and doubles as catalog search synonyms
- **Sparse-round comfort check:** imported rounds are score-only (UDisc CSV exports scores, not discs/putts) — confirm round_holes fields beyond score are all nullable (they are; keep it that way)
- **Model:** Opus 4.8 (schema restructure touching FKs) · **Effort:** S–M · **Test:** layout migration dry-run; alias uniqueness

### 1D. Deploy + PWA baseline — CRITICAL PATH
- **What:** get the app off localhost and onto your phone. Vercel (or Netlify) deploy of the Vite app + minimal PWA manifest (name, icons, theme color, standalone display) so it installs to the home screen.
- **Why now:** every practice feature's purpose is being used standing at a basket; nothing gets real-world validation on localhost. Deploying while surface area is small also surfaces mobile UX issues early.
- **Needs:** Vercel account + GitHub repo connection (auto-deploy on push to main); env vars (Supabase URL/anon key) set in Vercel dashboard; `vite-plugin-pwa` for manifest + basic service worker (app-shell caching only — NOT offline data, that's 2.2's buffering)
- **Model:** Sonnet 5 · **Effort:** S · **Test:** install to phone home screen; full auth + logging flow on cellular, not just wifi

### 1E. Bag & Disc Manager UI + app-level navigation — SHIPPED
- **Concept:** game-inventory mental model — **locker = inventory** (all owned discs), **bags = loadouts** (equipped subsets), **profile = character sheet**, **flight chart = stat coverage**. Future round tracking selects a loadout whose disc attributes are all referenceable.
- **App nav:** bottom tab bar ships now — Practice / Bag / Profile — replacing header-icon navigation. Rounds and Caddie tabs added as those areas are built (5-tab cap matches full roadmap; "More" tab absorbs overflow if ever needed).
- **Locker UI:** grid ⇄ list toggle via peripheral icon (persist preference). Cards are clean/minimal in v1: name/nickname, flight numbers, photo thumbnail, stability accent, status. Search + filter (manufacturer, speed class, stability, status) + sort (speed, stability, recently added).
- **Disc detail:** inspect view — full attributes, effective vs stock numbers, condition, bag memberships with one-tap equip/unequip per bag.
- **Bag view:** loadout screen — disc list + flight chart coverage + capacity indicator if set; bag switcher; add-from-locker flow.
- **Game flair:** delivered in the J3 jump-ahead checkpoint below; cosmetic unlock events remain deferred to
  roadmap Phase B item 5.
- **Model:** Sonnet 5 · **Effort:** M · **Test:** grid/list toggle persists; equip/unequip reflects in both locker and bag views; search/filter correct on effective numbers
- **Note:** 1C shipped schema + possibly partial UI with no navigation entry point — session must first audit what exists at /bag routes and wire or build accordingly.

---

## Jump-ahead features — out of roadmap sequence (owner decision 2026-07-14)

These three were selected by the owner to build **ahead of their `PRODUCT_ROADMAP.md` phase**, a
deliberate, documented jump (not a sequencing violation). Each is safe to build now because its schema is
already live and it is self-contained. **1A/1B/1C/1E above are SHIPPED** — do not rebuild them; the older
"NEXT UP / to generate" wording was stale. Detailed handoff plan: `~/.claude/plans/1a-2yes-bright-pelican.md`.
Recommended build order: J1 → J2 → J3 (J2/J3 are independent). Each feature runs the full per-session
gate (build + lint + `vitest run` + `graphify update .` + DEVLOG entry + working-checkpoint commit on a
feature branch; `main` auto-deploys). State + verify the recommended model at the start of each.

### J1. Round logging + quick-course (new COURSES tab) — SHIPPED 2026-07-14; front-runs roadmap Phase E
- **Model: GPT-5.6 high** (round state + schema/RLS) · **Effort:** L
- **Schema:** already exists, all tables empty, **no new columns** — `courses`, `layouts`, `holes`,
  `rounds`, `round_holes`, `course_aliases` (1.5 groundwork applied: `rounds.layout_id/external_source/
  external_ref/bag_id`, first-class `layouts`, `holes.layout_id`, sparse-nullable `round_holes`). Only DB
  work is a new **RLS-policy migration**: `courses`/`layouts`/`holes` =
  community read-all-authenticated, insert-open (`created_by = auth.uid()`), update-creator-only (mirror
  `disc_molds`); `rounds`/`round_holes` = owner-scoped to `auth.uid()`; `course_aliases` = insert-open/
  update-closed.
- **Data layer (mirror the shipped offline-first pattern):** new `src/lib/roundLog.js` (Supabase query
  functions, single source of query shape — mirrors `src/lib/discLocker.js`) with `fetchRounds`,
  `fetchRound` (join `round_holes`+`holes`+optional disc), `createRound`, `updateRound`, `upsertRoundHole`,
  and course helpers `fetchCourses`, `fetchCourse`, `createCourseWithLayout({name,location,holes})`
  (quick-course: course + default layout + N holes), `fetchLayoutHoles`. Use client-id upsert on
  `onConflict:'id'` for idempotent replay (copy `upsertDisc`). New `src/lib/repository/roundRepository.js`
  mirroring `discRepository.js` (`useRoundList/useCreateRound/useUpdateRound`). `dexieDb.js`: add
  `version(5)` carrying v4 tables unchanged + `rounds: 'id, user_id, course_id, status, [user_id+status]'`
  and `roundHoles: 'id, round_id, hole_id'`.
- **Pure logic:** `src/lib/rounds.js` (+ `rounds.test.js`): `roundTotal`, `parTotal`, `relativeToPar`
  (handle sparse rounds), `formatRelativeToPar` (`E`/`+3`/`-2`).
- **Routes** under the new COURSES tab (inside `AppShell`): `/courses` (root: directory + Add course + My
  rounds), `/courses/new` (quick-course), `/courses/:courseId` (detail + Start round), `/rounds` (history),
  `/rounds/new` (pick course/layout + bag), `/rounds/:roundId` (active scorecard), `/rounds/:roundId/summary`
  (finalize). New pages: `CoursesPage`, `CourseFormPage`, `CourseDetailPage`, `RoundsPage`, `RoundStartPage`,
  `RoundScorecardPage`, `RoundSummaryPage`.
- **Shell/nav:** add a **COURSES** tab to `src/components/AppShell.jsx` (between DISCS and ME → PLAY /
  DISCS / COURSES / ME; Tabler outline icon); register routes in `src/App.jsx` like the `/bag` tree.
- **Reuse:** `fetchBags` for bag pick; `useDiscList`/`DiscCard` for per-hole disc; field-screen ergonomics
  (primary controls in viewport, secondary in sheets; TTFP not network-gated).
- **Verify:** create quick course → start round → enter scores → finalize; total + relative-to-par correct
  and match unit tests; reload mid-round persists (Dexie); second user can't read the round (RLS).
  **Completed:** live policy migration applied, rollback-only authenticated RLS smoke passed, full local
  test/build/lint gate passed, graph refreshed, and browser route smoke reached the auth gate without
  console errors. The deployed composite round/activity FK is satisfied by the repository's matching
  activity-parent lifecycle bridge.

### J2. Disc comparison view — SHIPPED 2026-07-15; front-runs roadmap Phase C item 5
- **Model: GPT-5.3-Codex medium** · **Effort:** S · **No new schema.**
- Add a **Compare multi-select mode** to `src/pages/BagLockerPage.jsx` (reuse the existing `addToBag`
  picker toggle) → "Compare (n)" navigates to `/bag/compare?ids=…` (cap 2–4). New `/bag/compare` route +
  `src/pages/DiscComparePage.jsx`.
- Reuse `effectiveFlightNumbers` (`src/lib/discs.js`), `stabilityClass`/`stabilityColor`
  (`src/lib/discFilters.js`), and overlaid `FlightCurve` (`src/components/putterLineup/FlightCurve.jsx`).
  Side-by-side table + curves. Pure `src/lib/discCompare.js` (+ test) for per-axis min/max highlight and
  near-identical-disc "gap" flags — derived only, no opaque composite (roadmap rule).
- **Verify:** select 2–3 discs → numbers equal `effectiveFlightNumbers`, curves overlay, override axis shows.
  **Completed:** locker selection, capped compare route, pure comparison rules/tests, per-axis
  min/max highlights, explicit override markers, stability labels, current-reality curve overlay, and
  near-identical/no-gap flags are shipped. Full tests/build/lint gate passed, graph refreshed, and the
  browser route smoke reached the auth gate without console errors.

### J3. Game-flair disc cards — SHIPPED 2026-07-15; front-runs roadmap Phase B item 5 / deferred backlog
- **Model: GPT-5.3-Codex medium** · **Effort:** S.
- Extend `src/components/DiscCard.jsx` with a `flair` variant (default OFF → today's minimal card is
  byte-identical): rarity border, stat-block layout, subtle mount/equip animation. Pure `src/lib/discFlair.js`
  (+ test) `discTier(disc)` from an available signal for v1 (role/wear_score/status) — note the real
  cosmetic-tier **unlock events (Phase B item 5) are unbuilt** and are the eventual backing source.
- Opt-in via a **Profile preferences toggle** stored through the `src/lib/viewPreference.js` pattern. CSS in
  `src/App.css` honoring "Sun-Drenched Topo" (no pure black/white, ≥2px borders, Oswald, theme-correct).
- **Completed:** archived status → legendary primary putter → epic situational weather → rare wear score ≥7 →
  common fallback precedence is pure-tested; all locker card modes receive the persisted preference; the Profile
  preferences checkbox stores the opt-in flag; flair-on cards render tier borders, Tier/Signal stat blocks, and
  reduced-motion-safe mount animation. No schema changes. Full tests/build/lint gate passed and the graph refreshed.
  Browser smoke reached the existing `/login` gate from `/profile`; the available guest action did not navigate,
  so an authenticated toggle/card interaction could not be exercised. The current app contract is light-only, so
  verification uses the existing Sun-Drenched Topo tokens rather than adding a dark-theme variant.

---

## Track 2 — Practice depth (ranked by value : ease)

### 2.1 Confidence interval map — ratio: ★★★★★ (H value / S effort)
- **What:** distance-band visualization of shipped Wilson-interval stats — "lock-in" vs "coin-flip" zones colored by make % and certainty
- **Needs:** pure frontend; new view under `/practice/history` or stats shortcut; zero schema
- **Model:** Sonnet 5 · **Prereqs:** none (insights lib shipped)

### 2.2 Per-putt capture layer — ratio: ★★★★★ (enabler; expanded to three sessions)
Absorbs the "Dual-Pace Scoring Canvas" interaction spec (velocity-gated gestures, batch ribbon, audio telemetry, instant-launch FSM) and the Sun-Drenched Topo design system. Sequenced as three sessions:

**2.2a — Theme system (Sonnet 5, runs first)**
- Sun-Drenched Topo (Oswald edition) design tokens as CSS variables, exact hexes per CLAUDE.md § Design tokens; Oswald via Google Fonts, self-hosted/preloaded for offline shell
- Restyle ALL existing screens (tab bar, practice menu, locker/bags, profile, history); 2px minimum borders; no pure black/white; no default grays/blues surviving
- Acceptance: every screen legible in direct sunlight

**2.2b — Design review (Opus 4.8, output = approvable spec, no build)**
- Original questions: parent reference design (polymorphic vs nullable FKs), batch-retry idempotency (client UUIDs), no-backfill rule confirmation
- FSM: BOOTSTRAP → READY_DEFAULT / ACTIVE_SESSION (crash-recovery auto-resume from local buffer, <200ms synchronous local read)
- InstantLaunchPayload merged with the offline sync buffer — one localStorage subsystem, not two (profile defaults, smart-prediction card, quick-mod presets, crash recovery buffer)
- Gesture engine thresholds normalized for devicePixelRatio; thresholds (120px travel, 350ms velocity gate, 45° cone, 400ms debounce) as named tunable constants
- Data split rule: batch-ribbon entry writes summary tables ONLY; putt_events rows come exclusively from real-time gesture mode (no synthesized events)
- Diagnostic-mode toggle: per-session opt-in; when on, quick 9-zone tap after each miss; when off, frictionless swipes only

**2.2c — Build (Sonnet 5, after spec approval)**
- Zoned canvas: context bar (top 10%) / fluid gesture zone (65%, make territory grows +5% per consecutive make to 60% cap) / batch ribbon (25%)
- 3-gate swipe physics (up=make, down=miss, left=undo), long-press rapid fire, 400ms debounce lockout, shockwave + rejection-flash visuals
- Batch ribbon: static grid ≤10 putts; adaptive scrub carousel 15-20 with CSS scroll-snap detents, smart-centering on historical average, 1.25x predictive anchor, edge-pinned [0]/[MAX]; complementary auto-fill (makes entered → misses computed); 3s auto-advance
- Audio: Web Audio pitch-escalating make ladder (440→493→554Hz, miss thud resets), SpeechSynthesis stage-completion announcements; two-tier silence pill (UI toggle only — hardware override is native-only)
- Haptics: Vibration API where supported (Android Chrome), capability-detected, simplified patterns; no-op on iOS
- Session start: optional putter picker from locker, persisted as default in InstantLaunchPayload
- READY_DEFAULT smart-prediction card (next drill/distance from history + progression rules)
- Offline buffering + idempotent batch sync + sync-status indicator
- Acceptance: airplane-mode full set syncs exactly once on reconnect; TTFP <5s measured on true cold start (killed PWA) on-device

**Deferred to Capacitor/native roadmap:** hardware volume-button silence override; full haptic vocabulary (frequency/intensity patterns); any iOS haptics.
- **Tandem accommodation (unchanged):** nullable `round_hole_id` FK on putt_events
- **Design rule (unchanged):** summary tables stay authoritative for existing stats; putt_events feeds new diagnostics; backfill nothing

### 2.3 Gamified drills: JYLY + Around the World — ratio: ★★★★☆ (VH value / M effort)
- **What:** classic known drills as new structured modes with their real scoring rules, step-back/advance logic
- **Schema:** generalize regimen engine — add `rules_config jsonb` + `drill_type` to `putting_regimens` (fixed-set regimens = one drill_type; JYLY laddering = another); runs/run_sets tables reused
- **UI:** drills appear in regimen selection grouped by type; run-through UI driven by rules_config state machine
- **Model:** Sonnet 5; Opus 4.8 for the rules-engine design pass · **Prereqs:** 2.2 (per-putt entry makes drill state machines clean)

### 2.4 Clutch simulator — ratio: ★★★★☆ (H value / S–M effort)
- **What:** randomized rest timers (2–8 min) then a "putt now" alert for a single pressure putt; scored with existing pressure mechanics
- **Needs:** drill_type in 2.3's engine; browser Notification permission + fallback in-app alarm; logs to putt_events with pressure flag
- **Model:** Sonnet 5 · **Prereqs:** 2.2, 2.3 engine

### 2.5 Miss tendency diagnostics — ratio: ★★★★☆ (H value / S effort once 2.2 exists)
- **What:** quadrant/zone clustering of misses by distance band ("low-left at 25ft+"); rendered as a 9-zone heat grid
- **Needs:** pure derived view over putt_events.miss_zone; add to insights lib with unit tests; simple frequency analysis first, clustering later only if needed
- **Model:** Sonnet 5 · **Prereqs:** 2.2 (and data accumulation — show honestly-small-sample states, reuse Wilson-interval discipline)

### 2.6 Ghost pacing — ratio: ★★★☆☆ (M value / S–M effort)
- **What:** live "vs your best run" delta during regimen/drill runs
- **Needs:** per-set timestamps already implied by putt_events.occurred_at; comparison logic in run-through UI
- **Model:** Sonnet 5 · **Prereqs:** 2.2; elevated from LATER in backlog

### 2.7 Voice callouts (Match Mode) — ratio: ★★★☆☆ (M value / S effort)
- **What:** browser SpeechSynthesis announcing running %, pace deltas, and pattern-triggered coaching
- **Design rule (adopted from TDD):** intervention threshold — never coach off a single event; require ≥3 consecutive same-vector misses or a sustained drop
- **Model:** Sonnet 5 · **Prereqs:** 2.5 (needs miss data to say anything smart)

---

## Track 3 — Experimental spike

### 3.1 Acoustic make-detection prototype
- **What:** Web Audio API FFT monitoring 2.5–6.5 kHz chain-resonance band; hands-free make counting writing to putt_events with input_source='acoustic'
- **Approach:** prototype-and-measure, not spec-and-ship. Calibration flow (sample your basket + ambient floor), accuracy logging vs manual truth for ≥5 sessions before promoting to a real feature. Noise floor check (from TDD's preflight concept) decides acoustic vs manual per session.
- **Success gate:** >90% make-detection agreement with manual entry outdoors; otherwise stays a toy
- **Model:** Opus 4.8 for the DSP design, Sonnet 5 for UI · **Prereqs:** 2.2

---

## Track 4 — Native iOS roadmap (parked)

Full CV make/miss + trajectory, Watch IMU throw counting, LiDAR/AR distance, biometric fatigue, thermal/tripod armor, spatial audio, haptic vocabulary, CV disc recognition. Documented with rationale in FEATURE_BACKLOG.md § Native iOS Roadmap. Trigger for revisiting: Tracks 1–2 shipped, acoustic spike results known, and a deliberate platform decision (native companion "sensor mode" app vs waiting on browser ML maturity).

---

## Recommended execution order

1. **1A** player profile (quick win, unblocks caddie context later)
2. **2.1** confidence map (one-session win on shipped data)
3. **1D** deploy + PWA baseline (get it on your phone BEFORE the big schema work; validate on cellular)
4. **1B + 1.5** molds/locker migration + round/course groundwork (one big schema session, Opus 4.8)
5. **1C** bags (+ bag_id on rounds)
6. **1E** bag & disc manager UI + bottom tab bar (inventory/loadout experience; audits + completes 1C's UI)
7. **2.2** per-putt capture (the enabler, + round_hole_id accommodation, + local buffering)
8. **2.3 → 2.4 → 2.5** drills, clutch, miss tendency (the practice-depth payoff)
9. **2.6 → 2.7** ghost pacing, voice
10. **3.1** acoustic spike (anytime after 2.2, as an interest project)

**Confirmed future destination (next planning cycle after the above):** course catalog, round management, and UDisc CSV import — the Track 1.5 groundwork exists specifically so these land on prepared schema. Import design notes: UDisc exports score-only CSVs (per-hole scores + par row per layout, no disc/putt data); importer must be idempotent via external_source/external_ref; course matching via course_aliases; verify exact current CSV format at build time. Related backlog: data export (own-your-data CSV — build as importer rehearsal), weather auto-capture shipping WITH round management v1 (round creation is the natural capture point), same-day practice↔round linkage (derivable, insights lib join).

## Standing conventions (apply to every work session)
- State the current OpenAI model/reasoning recommendation at task start; see `CODEX_WORKFLOW.md`.
- End every Codex session updating `DEVLOG.md` and `FEATURE_BACKLOG.md` statuses when work changes them.
- Schema files are append-only; new file per change
- New derived stats go in `lib/insights/` as tested pure functions
