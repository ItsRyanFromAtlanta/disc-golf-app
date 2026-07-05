# Dev Log

Newest entries first. One entry per meaningful unit of work. Keep entries short: what, why, decisions, gotchas.

---

## 2026-07-04 — Sun-Drenched Topo (Oswald) theme, shipped app-wide (Track 2.2a)

**What:** Implemented the design system from CLAUDE.md § Design system across every screen, per `TASK_BRIEFS_2.2.md` 2.2a.
**Model:** Sonnet 5.
**Done:**
- All tokens (backgrounds, text, interactive, borders) as CSS custom properties in `src/index.css`, plus alpha-derived `-soft` tint variants for badge/chip fills — no new hues, just alpha versions of the fixed hexes. Removed the old Vite-template dark-mode block entirely: the palette is deliberately one fixed high-luminance look for sunlight legibility, not theme-variable.
- Oswald (variable, latin-subset, 400–700) downloaded from Google Fonts and self-hosted at `public/fonts/oswald-variable-latin.woff2` (21KB, one file covers all four weights), preloaded in `index.html`. Applied as the display face on headings, buttons, and stat/score numbers; body copy and form inputs stay on the system sans stack for small-size legibility.
- Restyled every screen (tab bar, practice menu, freeform log, regimens + run-through, history + detail, confidence map, locker, bag views, disc detail, profile) onto the token set. Global `button`/`input`/`select`/`textarea` base styles added so no control falls back to browser-default white/gray/blue (this closed a real gap: `MoldPicker`'s raw inputs and native checkboxes had no themed styling before and would otherwise still show default white fields / OS-blue checkmarks — added `accent-color` for checkbox/radio too). All borders bumped to the 2px minimum; primary CTAs (`start-button`, `save-button`, submit buttons) got 80px min-height tap targets. Replaced the last hardcoded hex holdouts (`discFilters.js` stability-swatch colors, `pb-badge` gold, error/success text colors) with tokens.
- **Contrast verification (WCAG relative-luminance math, not eyeballed):** text-primary on all three background tokens is 10.9–15.1:1 and text-secondary is 5.2–7.2:1 — both comfortably clear AA everywhere, confirmed rather than assumed.
- **Contrast finding, flagged rather than silently patched (tokens are fixed):** `--color-highlight` (sunburst orange) only works as a solid fill with dark text on top (~5.9:1, e.g. `pb-badge`) — as a foreground/text/icon color it fails against every background token (1.85–2.57:1, need 3–4.5:1), despite CLAUDE.md naming it for "active tab indicators." Used text-primary + bold weight for the active tab state instead, with a small canyon-blue accent bar (~5.3:1) carrying the color cue; same substitution applied to the confidence-map "developing" zone badge and CI point marker. Separately, `--color-positive` (terracotta) as a button fill tops out at ~3.9:1 with either text token — below normal-text AA (4.5:1) though above the large-text/UI-component floor (3:1); mitigated with bold 17px labels but not fully resolved by design since the hex values are fixed. Both are real, permanent properties of this exact palette, not implementation bugs.
- Verified: production build succeeds, all 52 existing unit tests pass unchanged, Playwright screenshot pass at 390px width across all ten routes (login, practice menu, freeform, regimens, history, confidence map, profile, bag, locker, bag-manage) using a locally-injected fake session + mocked Supabase REST responses (no real test-user credentials were available) to see real card/badge content rather than just empty/error states.
**Gotcha:** Google's `css2` endpoint served one shared variable-font file across all four requested weights (same URL for 400/500/600/700) rather than four separate static files — expected behavior for variable fonts, just meant one download instead of four.

## 2026-07-04 — Scoring canvas + theme planning (PLANNING)

**What:** Absorbed two uploaded specs — the Dual-Pace Scoring Canvas interaction design and the Sun-Drenched Topo (Oswald) design system — into an expanded 2.2 (now three sessions: 2.2a theme, 2.2b design review, 2.2c build).
**Key decisions:**
- Theme conflict resolved: Sun-Drenched Topo wins everywhere including scoring zones (Make = burnt terracotta #CC4E3C, Miss = deep rust #8C2D19); doc 1 contributes interaction spec only
- Batch ribbon writes summary tables ONLY; putt_events exclusively from real-time gesture mode — never synthesize per-putt events from batch totals
- Miss-zone capture via per-session "diagnostic mode" toggle (quick 9-zone tap after misses when on; frictionless swipes when off)
- Theme ships as its own session BEFORE the canvas build (canvas built in-theme, not themed after)
- Putter picker (light version): optional locker-sourced selection at session start, persisted in InstantLaunchPayload
- InstantLaunchPayload and offline sync buffer merged into one localStorage subsystem
- Web constraints accepted: haptics Android-only simplified (no iOS vibration support); hardware volume override impossible in web — both on Capacitor roadmap
- Gesture thresholds are named tunable constants, devicePixelRatio-normalized; field tuning expected
- New standing rule: plan-first — always prompt for approval before generating files

## 2026-07-04 — Bag & disc manager UX + app navigation (PLANNING)

**What:** Field testing revealed /bag routes have no navigation entry point (1C shipped schema, UI status unaudited). Designed 1E: game-inventory UX + app-level nav.
**Key decisions:**
- Bottom tab bar over hamburger/expanding menu: one-tap access, visible state, 5-tab cap matches full roadmap (Practice/Bag/Rounds/Caddie/Profile); ships now with three tabs
- Inventory mental model: locker=inventory, bags=loadouts, profile=character sheet, flight chart=stat coverage
- Locker: grid⇄list toggle (peripheral icon, persisted preference); search/filter/sort
- Minimal clean cards v1; game flair (rarity borders, equip animations) deliberately deferred to backlog
- 1E session must audit what 1C actually built at /bag before wiring or building

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

---

## 2026-07-03 — Session history v1 (IN PROGRESS)

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
