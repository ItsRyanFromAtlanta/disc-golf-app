# Development Plan

Last updated: 2026-07-03
Companion docs: `CLAUDE.md` (architecture), `FEATURE_BACKLOG.md` (full feature status), `DEVLOG.md` (work record)

## Guiding structure

Four tracks. Tracks 1–2 are sequential build work; Track 3 is an experimental spike run when convenient; Track 4 is parked until a native decision is made.

- **Track 1 — Foundation data:** player profile + disc locker/bags (already planned, Phase A schema generated)
- **Track 2 — Practice depth:** the web-viable features from the sensor/drills TDD, sorted by value:ease ratio
- **Track 3 — Experimental:** acoustic make-detection prototype
- **Track 4 — Native iOS roadmap:** parked sensor-fusion features (see FEATURE_BACKLOG.md § Native iOS Roadmap)

**Cross-cutting dependency:** the **per-putt capture layer** (Track 2, item 2) is the single enabler for drills, miss diagnostics, ghost pacing, voice coaching, AND any future sensor input (acoustic/CV results write to the same records as manual taps). Design once, feed from many sources.

---

## Track 1 — Foundation data (committed, in flight)

### 1A. Player profile expansion — NEXT UP
- **Schema:** `phase_a_profile_schema.sql` (generated) — handedness, per-throw confidence + max distance (value+source pattern), C1 comfort, specialty_shots[], target_rating, units, private injury_notes
- **UI:** sectioned profile page at `/profile` (Identity / Throwing / Calibration / Goals), edit-in-place per section; first-login nudge when throwing profile empty
- **Rules:** injury_notes never selected in any shared/social view (convention + query discipline)
- **Model:** Sonnet 5 · **Effort:** S · **Test:** save/reload each section; check constraints reject bad enums

### 1B. Disc molds reference + locker migration
- **Schema (to generate):** `disc_molds` (shared; insert-open, update-closed RLS; unique on lower(manufacturer), lower(mold_name); nullable enrichment: image_url, pdga_approved_date, production_status, plastics[], diameter, rim width) + `discs` alterations (mold_id FK, nickname, weight_grams, color, override flight numbers, photo_url, acquired_on, provenance, status lifecycle)
- **Migration:** script creating molds from distinct (manufacturer, mold) pairs in existing discs, linking copies, moving manual numbers to overrides where they differ from stock. **Model: Opus 4.8** — destructive-adjacent data work
- **Seed:** import script pulling mold specs from manufacturer sites (MVP/Axiom/Streamline first), Infinite Discs as fallback; one-time seed, not ongoing scraping; manual entry always available
- **UI:** `/bag/locker`, `/bag/discs/new` (search molds → pick/create → customize), `/bag/discs/:id`
- **Effort:** M–L · **Test:** migration dry-run against copy of data; effective-flight-number coalesce unit tests

### 1C. Bags + membership + flight chart
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

---

## Track 2 — Practice depth (ranked by value : ease)

### 2.1 Confidence interval map — ratio: ★★★★★ (H value / S effort)
- **What:** distance-band visualization of shipped Wilson-interval stats — "lock-in" vs "coin-flip" zones colored by make % and certainty
- **Needs:** pure frontend; new view under `/practice/history` or stats shortcut; zero schema
- **Model:** Sonnet 5 · **Prereqs:** none (insights lib shipped)

### 2.2 Per-putt capture layer — ratio: ★★★★★ (enabler; M effort)
- **What:** tap-by-tap putt entry: make/miss + optional one-tap 9-zone miss direction + timestamp per putt
- **Schema:** new `putt_events` table (session_or_run ref, sequence, outcome, miss_zone nullable, distance_ft, occurred_at, input_source text default 'manual') — input_source future-proofs for 'acoustic'/'cv'
- **Tandem accommodation:** nullable `round_hole_id` FK on putt_events — real-round putting (tournament C1X conversion vs practice) will use the same event table and same insights lib. One column now vs a parallel system later.
- **Connection resilience (required, not optional):** practice areas have spotty signal. Buffer putt events locally (in-memory + localStorage), sync in batches with retry + visible sync-status indicator. Not offline-first architecture — just "a dropped connection never loses a set." Matters more once sensor inputs exist (events arrive whether or not you have bars).
- **UI:** big-button tap entry integrated into regimen run-through (replaces summary entry there); optional in freeform
- **Design rule:** summary tables stay authoritative for existing stats; putt_events feeds new diagnostics. Backfill nothing.
- **Model:** Sonnet 5 (schema review with Opus 4.8 before running — this table underpins everything downstream)

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
4. **1B + 1.5** molds/locker migration + round/course groundwork (one big schema session, Opus 4.8; MANUAL DB BACKUP FIRST)
5. **1C** bags (+ bag_id on rounds)
6. **2.2** per-putt capture (the enabler, + round_hole_id accommodation, + local buffering)
7. **2.3 → 2.4 → 2.5** drills, clutch, miss tendency (the practice-depth payoff)
8. **2.6 → 2.7** ghost pacing, voice
9. **3.1** acoustic spike (anytime after 2.2, as an interest project)

**Confirmed future destination (next planning cycle after the above):** course catalog, round management, and UDisc CSV import — the Track 1.5 groundwork exists specifically so these land on prepared schema. Import design notes: UDisc exports score-only CSVs (per-hole scores + par row per layout, no disc/putt data); importer must be idempotent via external_source/external_ref; course matching via course_aliases; verify exact current CSV format at build time. Related backlog: data export (own-your-data CSV — build as importer rehearsal), weather auto-capture shipping WITH round management v1 (round creation is the natural capture point), same-day practice↔round linkage (derivable, insights lib join).

## Standing conventions (apply to every work session)
- State recommended model at task start: **Sonnet 5** default for UI/CRUD; **Opus 4.8** for migrations, schema design passes, rules engines, DSP
- End every Claude Code session updating `DEVLOG.md` and `FEATURE_BACKLOG.md` statuses
- Schema files are append-only; new file per change
- New derived stats go in `lib/insights/` as tested pure functions
