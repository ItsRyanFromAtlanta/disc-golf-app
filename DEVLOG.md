# Dev Log

Newest entries first. One entry per meaningful unit of work. Keep entries short: what, why, decisions, gotchas.

---

## 2026-07-04 — Disc locker + layouts schema/migration, Track 1B + 1.5 (schema/scripts done; migration execution pending)

**What:** Delivered the full 1B disc-locker + 1.5 layouts/provenance/aliases schema restructure as scripts (Opus 4.8, per plan). Not yet executed against the live DB — that's gated behind the user's backup + dry-run approval.
**Files:**
- `disc_locker_and_layouts_schema.sql` — additive/idempotent only: `disc_molds` (insert-open/update-closed RLS, unique lower(manufacturer)+lower(mold_name), nullable enrichment), `discs` alters (mold_id, nickname, weight_grams, color, override_* flight, photo_url, acquired_on, provenance, status lifecycle), `layouts`, `holes.layout_id`, `rounds.layout_id` + provenance, `courses` provenance, partial-unique external (source,ref) indexes, `course_aliases`. Zero data loss; safe to run anytime.
- `migrate_disc_locker_and_layouts.sql` — 3 gated sections: (1) read-only DRY RUN; (2) reversible BACKFILL (old columns retained); (3) irreversible DESTRUCTIVE CLEANUP (drops is_active + stock flight cols + holes.course_id + rounds.layout_name, tightens FKs).
- `verify_disc_locker_and_layouts.sql` — integrity checks, run between backfill and cleanup.
- `scripts/seed-disc-molds.mjs` → `disc_molds_seed.sql` — curated flagship MVP/Axiom/Streamline molds.
- `src/lib/discs.js` `effectiveFlightNumbers()` + 6 tests.
**Key decisions:**
- Introspected the LIVE DB first (PostgREST column probes): confirmed every target table still at base shape — no 1B/1.5 columns/tables exist, clean starting point. No app code references discs/holes/rounds/courses, so the destructive drops break no frontend.
- Effective flight numbers preserved by construction: mold stock = most-complete representative copy; a copy gets an override on an axis only when it has an explicit value differing from stock; null copies inherit stock (flight numbers are a mold property). `effectiveFlightNumbers` uses `??` not `||` so a 0 turn/fade override wins.
- Layouts promoted to first-class: default layout per course from `layout_name`, plus a non-default layout per distinct round `layout_name` so each round keeps the layout it was played on. holes → default layout; rounds → name-match else default.
- `is_active=false → status 'retired'` (neutral); reclassify to lost/sold in-app later. Kept `discs.manufacturer/mold` text as human labels; kept `rounds.course_id` (denormalized but safe).
- Migration split into safe-backfill vs irreversible-cleanup with a verification checkpoint between, so the destructive step only runs after integrity is proven AND a backup is confirmed.
**Gotchas / notes:**
- Seed: live scraping of MVP/Axiom/Streamline/Infinite Discs was investigated and rejected — flight data loads via JS/AJAX or inconsistent markup; a scraper would risk seeding wrong numbers. Curated bootstrap + always-available manual entry instead.
- `disc_molds` inserts require the authenticated/owner role (RLS), so the seed is delivered as SQL for the editor, not an anon-key script.
- Found the doc-drift culprit: a `.tmp.driveupload/` dir (Google Drive sync) — gitignored. Also restored canonical `supabase_schema.sql` to the repo (was only in Downloads).
- **Pending user action:** take a DB backup; run schema file; run migration Section 1 (dry run) and paste output; approve; run Section 2 + verification; then Section 3.

---

## 2026-07-03 — Deploy + PWA baseline, Track 1D (IN PROGRESS — code-ready, deploy pending)

**What:** `vite-plugin-pwa` added with a manifest (name, theme/background color, standalone display, 192/512/maskable icons) and a service worker configured for **app-shell caching only** — precaches the built JS/CSS/HTML/icons, no `runtimeCaching` entries, so Supabase reads/writes always hit the network. `vercel.json` added with a catch-all rewrite to `index.html` so client-side routes resolve on a hard refresh or direct link. `.env.example`, `.gitignore` (added `dev-dist`), and `README.md` (setup + deploy steps) brought up to date.
**Model:** Sonnet 5, per DEVELOPMENT_PLAN.md.
**Key decisions:**
- `registerType: 'autoUpdate'` with `skipWaiting`/`clientsClaim` — no update-prompt UI; simplest baseline for a solo-dev app that ships frequently.
- Icons are a placeholder: a simple flying-disc glyph on the app's brand purple (`#7e14ff`), generated from two source SVGs (`public/icon-source.svg` for standard icons with rounded corners, `public/icon-source-maskable.svg` full-bleed for the maskable icon's safe zone) via a one-off `scripts/generate-pwa-icons.mjs` (sharp). Swap the source SVGs and rerun the script whenever real branding exists.
- Confirmed via the production build (`vite preview`) that the service worker registers, the manifest links correctly, and a direct load of a nested route (`/practice/history`) falls through to the SPA shell rather than a raw 404 — validates the same behavior `vercel.json`'s rewrite provides on Vercel.
**Not done (needs the user, not code):** push to GitHub, connect + configure the Vercel project, set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in the Vercel dashboard, install-to-homescreen and full auth+logging test on cellular. Repo had zero commits and no git remote at the start of this session — flagged rather than assumed.

---

## 2026-07-03 — Confidence interval map, Track 2.1 (SHIPPED)

**What:** New view at `/practice/history` → `/practice/stats` (linked from the practice menu's stats-shortcut icon, now live instead of a placeholder). Buckets all putts — freeform logs at their exact distance, regimen sets at their range midpoint — into 10ft distance bands, and classifies each band as **lock-in**, **developing**, or **coin-flip** from its Wilson interval, not just its point estimate.
**Model:** Sonnet 5 (per DEVELOPMENT_PLAN.md recommendation for UI/CRUD work). Zero schema changes — pure frontend over the already-shipped insights lib, as scoped.
**Key decisions:**
- New pure module `lib/insights/confidenceMap.js` (`distanceBand`, `classifyZone`, `confidenceMap`) rather than inline page logic — matches the standing "new derived stats go in `lib/insights/` as tested pure functions" convention; 7 new unit tests (26 total in the suite).
- Zone rule: **lock-in** when the interval's lower bound clears 70% (even the pessimistic read says you're make-favored); **coin-flip** when the interval straddles 50% (genuinely unresolved); **developing** for everything in between. This is a new interpretive threshold (not pinned by an earlier spec) — the 70% cutoff and the three-zone scheme are the concrete choices worth knowing about if the feel needs tuning.
- 10ft band width chosen over 5ft to keep per-band attempt counts (and therefore Wilson intervals) meaningful; documented as a named constant (`DISTANCE_BAND_WIDTH_FT`).
- Band UI shows the full interval as a track + point marker (not just a color), with a 50% midline for visual reference to the coin-flip threshold, plus the raw n/interval whenever n < 30 (reusing the existing `WILSON_MIN_N_FOR_HIDING` convention from session history).
**Verified:** unit tests for all three zone outcomes against hand-computed Wilson intervals; end-to-end with a scripted browser pass seeding three distances chosen to land in each zone (20/20 @ 10ft → lock-in, 5/10 @ 30ft → coin-flip, 15/20 @ 50ft → developing) — all classified correctly, empty state renders, zero console errors.

---

## 2026-07-03 — Operational readiness pass (PLANNING)

**What:** Pre-execution audit surfaced three operational gaps; docs updated.
**Key decisions:**
- New task 1D (deploy + PWA baseline) inserted into execution order BEFORE the big schema session — practice features need on-phone, on-cellular validation; Vercel + vite-plugin-pwa, app-shell caching only
- Standing convention added: manual DB backup required before any migration/FK-restructuring session; Claude Code confirms backup exists before running migration SQL
- Connection resilience made a required part of 2.2: local buffering + batch sync + retry + sync-status indicator ("a dropped connection never loses a set"), explicitly not full offline-first
- Considered and deferred: password reset flows (near-free via Supabase, fold in anytime), Sentry (public phase), CI (overkill solo)

## 2026-07-03 — Round/course/import tandem groundwork (PLANNING)

**What:** Identified schema accommodations to fold into in-flight work ahead of confirmed destinations (course catalog, round management, UDisc import). Added Track 1.5 to DEVELOPMENT_PLAN.md.
**Key decisions:**
- Layouts promoted to first-class (layouts table; holes belong to layouts, not courses) — must land before real round data; rides with the 1B schema session under Opus 4.8
- Provenance pattern (external_source/external_ref) on rounds + courses for idempotent imports
- course_aliases table (insert-open/update-closed, same pattern as disc_molds, built in same session)
- bag_id FK on rounds (rides with 1C); round_hole_id FK on putt_events (rides with 2.2)
- UDisc import noted as score-only (no disc/putt data in their CSV); exact format to be verified at build time
- Deliberately NOT building round/catalog/importer UI in tandem — schema accommodations only, to avoid parallel-workstream merge pain on a young codebase

## 2026-07-03 — Comprehensive development plan (PLANNING)

**What:** Consolidated all work into DEVELOPMENT_PLAN.md (4 tracks); evaluated external sensor-fusion TDD (features_possibilities.md upload).
**Key decisions:**
- All native-iOS features (CV detection, Watch IMU, LiDAR, biometrics, thermal armor) → parked Native iOS Roadmap section in backlog; revisit only after Tracks 1-2 ship + acoustic spike results
- Web-viable TDD features ranked by value:ease and queued: confidence map → per-putt capture → drills (JYLY/ATW) → clutch sim → miss tendency → ghost pacing → voice callouts
- Per-putt capture layer identified as the single cross-cutting enabler; `input_source` field future-proofs for acoustic/CV inputs writing to the same records
- Acoustic-first inversion of the TDD's CV-first approach: Web Audio FFT spike with a >90%-agreement success gate before it becomes a real feature
- Adopted TDD's intervention-threshold principle (never coach off single events) as a standing design rule for all coaching/AI features
- Standing convention: every task states its recommended model (Sonnet 5 default; Opus 4.8 for migrations, schema design, rules engines, DSP)

## 2026-07-03 — Player & bag profile planning (PLANNING)

**What:** Full plan-mode design for player profile expansion and locker/bags/molds system. Phase A schema generated (phase_a_profile_schema.sql).
**Key decisions:**
- Locker + multiple bags model (bags + bag_discs join) over flat is_active — discs owned once, carried in subsets
- disc_molds shared reference table (insert-open, update-closed RLS); seed via manufacturer-site import, Infinite Discs fallback; unique on lowercased (manufacturer, mold)
- Disc rows = physical copies; flight overrides as nullable columns, null = stock; effective numbers via coalesce
- Status lifecycle (in_locker/lost/retired/sold) replaces is_active; lost/retired excluded from bag views, memberships preserved
- Value+source pattern (typed columns, not JSONB) for calibration fields — self_reported now, derived later
- Throws as profile columns (not child table); specialty shots as text[]
- injury_notes: optional, private-always, never selected in shared views
- Migration over re-entry for existing discs data; migration runs under Opus 4.8

## 2026-07-03 — Player profile expansion, Track 1A (SHIPPED)

**What:** Sectioned profile page at `/profile` (Identity / Throwing / Calibration / Goals), each section edit-in-place via a reusable `EditableSection` component; first-login nudge banner when the throwing profile is empty. Entry point added as a header icon on the practice menu.
**Key decisions:**
- One `profiles` upsert per section save, not one big form.
- Calibration fields always write `*_source: 'self_reported'` — `derived` is reserved for a future automated path.
- `specialty_shots` uses a fixed starter-vocab chip picker rather than free text.
- `injury_notes` rendered only on this screen; `fetchProfile`'s `select('*')` is annotated as safe only because it's always scoped to the caller's own row.
**Gotchas:**
- `phase_a_profile_schema.sql` was already applied to Supabase — confirmed by probing specific columns via PostgREST before writing any UI code.
- First-login nudge bug: the empty-throwing check compared against `'none'`, but a brand-new user has no `profiles` row at all (fields are `undefined`, not `'none'`) — nudge silently never showed for fresh accounts. Fixed to treat unset the same as `'none'`.

---

## 2026-07-03 — Session history v1 (SHIPPED)

**What:** Unified history feed at /practice/history + insights layer.
**Scope:** Feed (day-grouped, filter chips), detail views, notes + tag chips, practice streak, PB badges, volume ledger, and five zero-input derived insights (fatigue curve, pressure differential, decay-weighted current form, cadence fingerprint, confidence intervals).
**Schema:** `session_history_schema.sql` — tags[] on both session tables, notes on regimen runs. Everything else is derived read-only.
**Key decisions:**
- Unified timeline over per-mode history pages (matches real practice behavior; pattern will absorb round history later)
- Client-side merge of the two tables (fine at current volume; Postgres UNION view is the upgrade path if slow)
- Zero-input derived insights prioritized over diary-style inputs; all inputs optional and one-tap
- Confidence intervals: Wilson score interval, band shown until n ≥ 30 per distance
- Decay-weighted form: exponential decay, half-life 14 days (tunable constant, document in code)
- PB badge qualification: min 10 attempts at a distance for make-% PBs (prevents 2/2 = "100% PB" noise)
**Deferred:** distance heat profile + putter tracking (NEXT UP); full list in FEATURE_BACKLOG.md.
**Verified:** end-to-end with a scripted browser pass (signup → seed freeform + regimen data → feed/filters/PB badges/both detail views/notes+tags save) — 19 unit tests on the insights lib at the time, zero console errors.

---

## 2026-07-02 — Putting practice menu + nested routing (SHIPPED)

**What:** Card-list menu at /practice; moved freeform + regimens under nested routes.
**Routes:** /practice, /practice/freeform, /practice/regimens, /practice/regimens/:id/run
**Key decisions:**
- Card grid menu inside a (future) bottom-tab-bar app shell; cards scale as modes are added
- Reusable ModeCard component — new modes are one-line additions
- Recent activity strip on menu (last 2-3 entries from both session tables)
**Gotchas:** swept for hardcoded old route paths during migration.

---

## 2026-07-01 — Scored putting regimens (SHIPPED)

**What:** 5 fixed regimens (difficulty 1-5) with points scoring.
**Schema:** putting_regimens, putting_regimen_sets, putting_regimen_runs, putting_regimen_run_sets + seed data.
**Scoring:** base points = difficulty per make; +10% streak step per consecutive make (miss resets); pressure putt (last of set) at 2x instead of streak formula; +25% no-miss set bonus; flat completion bonus scaled by difficulty.
**Key decisions:**
- Difficulty defined by distance AND makes-required combined
- Streak multiplier, no-miss bonus, pressure putt as core three separators; fatigue weighting + distance ladders deferred to v2
- Regimen definitions stored as data (not code) so tuning is a DB edit
- Tap-by-tap make/miss entry recommended over self-reported summaries (integrity for future social comparison)

---

## 2026-07-01 — Auth + freeform putting log (SHIPPED) — v1 vertical slice

**What:** Email/password auth (Supabase), freeform putting log page, session persistence verified end to end.
**Schema:** putt_sessions, putt_distance_logs. Zone (C1/C2/Beyond C2) is a generated column from distance_feet (C1 ≤ 33ft, C2 ≤ 66ft).
**Key decisions:**
- Putting practice chosen as the thinnest vertical slice to prove auth → DB → UI before bigger features
- Session-summary granularity (makes/attempts per distance), not per-putt logging, for freeform mode

---

## 2026-06-30 — Project foundation (SHIPPED)

**What:** Environment setup, project scaffold, core schema, CLAUDE.md.
**Stack decisions:**
- React + Vite SPA, mobile-first, Capacitor-ready (PWA first, app stores later)
- Supabase (Postgres + auth + RLS): multi-tenant from day one because scale path is solo → group → public
- Claude API server-side only; Sonnet 5 for live/conversational features, Opus 4.8 for background/analysis jobs
- Claude Code CLI (native installer) as dev tool; CLAUDE.md as living architecture doc
**Schema:** profiles, discs, courses, holes, rounds, round_holes, live_sessions, caddie_recommendations. Courses/holes are shared community data; all user data RLS-scoped to auth.uid().
