# Disc Golf Manager & Caddie App

## What this is
A mobile-first web app (React + Vite, Capacitor-ready) with three core pillars:
1. **Live round mode** — active caddie assistance during a round (club/shot picks, hole strategy)
2. **Stats & history** — round logging, scoring trends, performance analytics
3. **Course prep** — pre-round strategy, hole-by-hole info, disc recommendations

## Audience & scale trajectory
Starts as a solo app, will expand to a small group/league, then potentially public.
Built multi-tenant from day one (Supabase auth + RLS) to avoid a rebuild later.

## Tech stack
- **Frontend:** React + Vite, mobile-first responsive CSS, structured to add Capacitor later for App/Play Store distribution
- **Backend:** Supabase (Postgres, auth, storage, RLS)
- **AI:** OpenAI Responses API called server-side only (never client-side — protects API keys)
  - Live-round chat: **GPT-5.6 Luna, low reasoning** — prioritize responsiveness and cost
  - Background jobs (course data prep, post-round analysis): **GPT-5.6 Sol, high reasoning**
- **Dev tool:** Codex desktop/CLI

## Data model
See `supabase_schema.sql` for full schema. Key tables:
- `profiles` — user profile, extends auth.users
- `discs` — user's bag
- `courses` / `holes` — shared community course data (not user-owned)
- `rounds` / `round_holes` — user-owned round data
- `live_sessions` — active caddie chat state (JSONB log) during a round
- `caddie_recommendations` — logged AI suggestions per hole, tagged with model used
- `disc_state_events` — immutable owner-scoped physical-disc status/role/wear/condition/bag timeline
- `bag_versions` / `bag_version_discs` — immutable bag metadata/membership snapshots; restores create
  a new current version and rounds may retain the exact `bag_version_id` selected at start
- `bag_ghost_slots` — private capacity-neutral desired flight slots with reversible removal
- `shot_tags` / `disc_shot_tag_assignments` — curated/private physical-disc taxonomy with assignment
  tombstones; removing a tag never deletes its historical assignment row
- `disc_photos` — owner-scoped immutable front/back/side photo versions; private Storage paths,
  replacement history, and 30-day recoverable deletion
- `lost_found_cases` / `lost_found_updates` — private owner-scoped recovery envelopes and immutable
  location/sighting/contact timelines; atomic RPCs synchronize physical-disc lost/recovered status
- `disc_odometer_events` / `disc_cosmetic_unlocks` — immutable owner-scoped throws/chain-hits/airballs
  deltas and permanent 300/1,000/5,000 chain-hit tier unlocks; cached disc totals are RPC-maintained
- `catalog_import_batches` / `catalog_import_artifacts` / `catalog_import_candidates` /
  `catalog_import_candidate_reviews` — server-only B1.7 ingestion evidence and review staging;
  RLS-enabled with no ordinary-client policies or grants, backed by the private
  `catalog-import-raw` Storage bucket and `private.catalog_ingestion_admins` allowlist. B1.8 adds
  service-only `catalog_review_candidate` / `catalog_promote_import_batch` RPCs, an authenticated
  `catalog-ingestion-admin` Edge Function, and candidate/alias/actor links on
  `catalog_entity_sources`; canonical promotion remains explicit, dependency-ordered, and atomic.

See `putting_practice_schema.sql` for the putting practice feature:
- `putt_sessions` — a practice session (user-owned, freeform date/notes)
- `putt_distance_logs` — session-summary makes/attempts per distance; `zone` (C1/C2/Beyond C2) is a generated column derived automatically from `distance_feet`, so the app only ever needs to submit distance + makes + attempts

See `putting_regimens_schema.sql` + `putting_regimens_seed.sql` for the scored practice regimen feature:
- `putting_regimens` — fixed set of 5 (difficulty 1-5), each with base points/make, streak step, no-miss bonus %, completion bonus
- `putting_regimen_sets` — the sets within a regimen (distance range, reps required, pressure multiplier for last putt)
- `putting_regimen_runs` — a user's attempt at a full regimen (total score, completed flag)
- `putting_regimen_run_sets` — per-set result within a run (makes, attempts, longest streak, clean set, pressure putt made, points earned)

**Scoring formula** (compute client-side or in a Supabase Edge Function, not stored as raw logic in the DB):
- Each make scores `base_points_per_make × (1 + streak_step × (consecutive_position - 1))`, where consecutive_position resets to 1 after any miss
- The last putt in a set (pressure putt) scores at `pressure_multiplier` instead of the streak formula
- A clean set (no misses) adds `no_miss_bonus_pct × set's total base value` (sum of makes × base_points_per_make, pre-streak)
- Completing all sets in a run adds the regimen's flat `completion_bonus`

## Navigation & route structure
The app uses nested feature trees. Putting practice is the first tree:

```
/practice                          → putting practice menu (card list)
/practice/freeform                 → freeform log (makes/attempts by distance)
/practice/regimens                 → regimen selection (5 fixed regimens by difficulty)
/practice/regimens/:id/run         → active regimen run-through with live scoring
/practice/history                  → unified session history feed
/practice/history/:type/:id        → session/run detail view (type = 'freeform' | 'regimen')
/bag/lost-found                    → private offline-ready disc recovery cases and update timelines
```

Future putting modes (games, challenges, drills) slot in as `/practice/<mode>`.
Future feature areas (rounds, caddie, fieldwork) become sibling trees with the same pattern (e.g. `/rounds/...`).

J1 ships the first sibling tree under the COURSES section:

```
/courses                 → course directory + recent rounds
/courses/new             → quick-course builder
/courses/:courseId       → layout and hole detail
/rounds                  → round history
/rounds/new              → course/layout/bag selection
/rounds/:roundId         → offline-first scorecard
/rounds/:roundId/summary → total, relative-to-par, and finalization
/profile                 → ME career summary
/profile/details         → editable player profile
/profile/settings        → device/cross-device preferences and optional notification categories
/profile/goals           → measurable goals, lifecycle actions, and immutable status history
/profile/reports         → deterministic weekly snapshots and immutable version history
```

**App-level nav is PLAY / DISCS / COURSES / ME** after the J1 directory shipped (the approved base
shell remains PLAY / DISCS / ME; COURSES was added at its documented trigger). `/practice` remains
compatible while PLAY routes are introduced; statistics live with their subject and ME provides the
career-wide summary. The earlier PLAY/BAGS/STATS/PRO blueprint navigation is historical, not current.

### Practice menu design
- Card-list menu: each mode is a card with an icon (Tabler outline icons), title, one-line description, and chevron. Cards are a reusable `ModeCard`-style component so adding a mode is a one-line addition.
- Header uses the shared activity pill and notification bell; contextual analytics links live with
  their subject rather than in a standalone Stats destination.
- Below the cards: a "Recent activity" strip showing the last 2-3 entries pulled from `putt_sessions` and `putting_regimen_runs`.
- Mobile-first: single-column cards, thumb-friendly tap targets.

## Session history feature (see session_history_schema.sql)
Unified reverse-chronological feed merging `putt_sessions` and `putting_regimen_runs`, grouped by day, with All/Freeform/Regimens filter chips. Client-side merge of two queries (fine at current volume; a Postgres UNION view is the upgrade path if it ever gets slow).

- Freeform rows: distance range + aggregate makes/attempts (join putt_distance_logs)
- Regimen rows: regimen name, total score, completed/abandoned badge, PB badge when applicable
- Detail views: per-distance breakdown (freeform); per-set breakdown — makes, attempts, longest streak, clean set, pressure putt (regimen)
- Notes: optional free text on both session types
- Tags: text[] on both tables; UI presents one-tap chips (starter vocab: windy, indoor, outdoor, tired, new-putter, pre-tournament, experimenting) plus free-text; normalize to lowercase-kebab in the app layer
- Header strip above the feed: practice streak (consecutive days with ≥1 session) + volume ledger (putts this week / month / lifetime)

### Derived insights (zero-input, computed from existing data)
Implement as pure functions in a `lib/insights/` module with unit tests — these have exact definitions:
- **Fatigue curve:** make % grouped by set_order across all regimen runs
- **Pressure differential:** pressure-putt make % minus regular make % at comparable distances ("clutch factor")
- **Decay-weighted current form:** exponentially weighted make %, half-life 14 days (named constant, documented); display beside lifetime make % — the gap indicates trend direction
- **Cadence fingerprint:** make % by time-of-day bucket (morning/afternoon/evening) and by days-since-previous-session bucket
- **Confidence intervals:** Wilson score interval on any displayed make %; show the band whenever n < 30 for that distance/split
- **PB rules:** regimen PB = new best total_score on that regimen; distance PB = new best make % at a distance with ≥ 10 attempts in the session (prevents small-sample noise)

## Design system — "Sun-Drenched Topo" (Oswald edition)
High-luminance warm earth palette, legible in direct sunlight. Typography: Oswald (condensed, high-impact), self-hosted/preloaded. No pure black (#000) or pure white (#FFF) anywhere; no default platform grays/blues. Borders 2px minimum. Exact tokens (CSS variables):
- Background: primary `#F4F1EA` (warm sand), surface `#E2DED4` (desert clay), surface_alt `#D6CEBF` (deep sand)
- Text: primary `#1A1D1A` (deep slate), secondary `#4A524A` (muted slate), inverse `#F4F1EA`
- Interactive: positive/Make `#CC4E3C` (burnt terracotta), secondary accent `#2B5F6C` (canyon blue), negative/Miss `#8C2D19` (deep rust), highlight `#E87A30` (sunburst orange)
- Borders: default `#C8C0B0`, focus `#1A1D1A`
Field-use interaction rules: minimum 80pt tap targets on primary actions; one-thumb operability on active-practice screens; TTFP (time-to-first-putt) < 5s from cold start — no network gating before the start button.

## Data rules for putt capture
- Batch-ribbon entry writes summary tables ONLY. `putt_events` rows come exclusively from real-time gesture/tap mode. Never synthesize per-putt events from batch totals.
- Gesture thresholds (travel px, velocity ms, cone degrees, debounce ms) are named tunable constants, normalized for devicePixelRatio.
- Hard interlocks (adopted 2026-07-05, from `MASTER_PROJECT_BLUEPRINT.md`): a routine's total planned putts is capped at 100 (builder disables adding stages past the cap; DB CHECK backs it up) and a bag's disc count is capped at 35 (Add-to-bag disables at capacity; DB CHECK backs it up). Both enforced app-side AND at the DB layer — never just one.

## Offline architecture (staged adoption, in progress)
The InstantLaunch localStorage subsystem (FSM + idempotent outbox, `src/lib/instantLaunch/`) is the
currently-shipped offline layer, scoped to active-session capture. Per the 2026-07-05 blueprint
integration, the project is staging in a **Dexie.js (IndexedDB) + TanStack Query** repository layer
(`networkMode: 'offlineFirst'`) behind a repository interface — new screens read/write through it first,
existing screens migrate as they're touched, and the InstantLaunch buffer folds in last. This is NOT a
big-bang rewrite; Supabase-direct calls remain valid until a screen is migrated. See
`DEVELOPMENT_PLAN.md` Layer 1 for the build session and `MASTER_PROJECT_BLUEPRINT.md`'s
`TECH_STACK.md`/`DATABASE_SCHEMA.md` sections for the reference architecture (schema is absorbed
append-only, not adopted verbatim — see below).

Phase A A4 adds Dexie v2 `activities`/`activityStateEvents` stores and an ordered diagnostic lifecycle
outbox behind `src/lib/repository/activityRepository.js`. Its InstantLaunch bridge is deliberately
unwired until A7: InstantLaunch remains authoritative for live putt capture, batch summaries, and its
proven putt outbox; lifecycle mirroring must never synthesize or relocate those facts.

Phase D D1 adds Dexie v12 `regimenSets` beside the existing `regimens` store and the scoped
`src/lib/repository/regimenRepository.js` remote-first/local-fallback boundary. Quick Play stores its
device-local `quickPlayRegimenId` in InstantLaunch profile defaults; a missing/archived preference falls
back to the system Level-1 regimen, then the lowest system level. Active recovery remains local and must
never wait for history or regimen network reads.

Phase D D2 adds Dexie v13 `practiceFatigueCheckins` and the immutable owner-scoped
`practice_fatigue_checkins` table. Check-ins occur only at stage boundaries after three trailing misses
or a sampled 20-point stage drop; skipping never blocks scoring. Practice parent rows retain canonical
external factors and optional 1–10 perceived effort. `profiles.round_turn_prompt_enabled` is the
cross-device round-turn preference; a one-round dismissal remains local UI state.

Phase D D3 checkpoint 1 adds Dexie v14 mirrors for `notificationPreferences`, `goals`, `goalEvents`,
and `weeklyReportSnapshots`. Server contracts use owner-scoped `notification_preferences`, mutable goal
parents plus immutable `goal_events`, and immutable versioned `weekly_report_snapshots` that store the
Monday–Sunday calendar window, IANA timezone, exact UTC bounds, calculation version, source cutoff,
sample counts, metrics, and deterministic highlights. Goal create/transition RPCs are atomic,
idempotent, version-checked, and preserve pause/resume/completion history.

Phase D D3 checkpoint 3 splits editable player identity/calibration at `/profile/details` from
preferences at `/profile/settings`. Device-only disc-card flair remains local; round-turn prompt,
reporting timezone, and optional notification categories persist cross-device. Preference hydration
runs before notification production, while critical sync/data-safety alerts cannot be disabled.

Phase D D3 checkpoint 4 adds `/profile/goals`. Reads are remote-first with Dexie fallback; creation and
pause/resume/completion/cancellation use only the atomic public RPCs. Every transition sends the
currently-read version and the UI reloads authoritative goal parents plus immutable `goal_events`.

Phase D D3 checkpoint 5 adds `/profile/reports`. Generation uses the profile's IANA timezone to freeze
the latest completed Monday–Sunday window into exact DST-aware UTC bounds, includes only completed,
visible lifecycle sources, and inserts a new immutable snapshot version with an explicit supersession
link. Report history reads remote-first with Dexie fallback; generation never relies on a partial local
cache and never overwrites an earlier version.

Phase D D4 checkpoint 1 consolidates contextual practice analytics at `/practice/stats`. Distance
confidence and miss-tendency evidence include only completed, visible lifecycle parents. The 9-zone
miss grid reads genuine real-time `putt_events.miss_zone` facts, reports zone-capture coverage, never
infers direction from batch summaries, and withholds a repeated-vector callout until at least three
same-zone misses occur within a distance band.

Phase D D4 checkpoint 2 adds longitudinal physical-putter comparison to `/practice/stats`. It groups
only completed-visible real-time events by exact `putter_disc_id`, reports attribution coverage and
Wilson intervals, and computes a transparent distance-adjusted delta only from distance bands shared
by at least two putters. The adjusted delta remains withheld until a putter has 10 shared-distance
attempts; batch summaries are never attributed or synthesized, and the UI never crowns a winner.

## Gamification (planned, Layer 5)
XP/leveling/badges land as pure, unit-tested functions in `lib/gamification/` (mirrors the
`lib/insights/` discipline) — XP payout constants, `calculateXpForLevel` (`1000 × 1.15^(level-1)`), and
a `BadgeEvaluatorService` run post-scoring/post-inventory/post-ingestion. Full spec:
`MASTER_PROJECT_BLUEPRINT.md` § `GAMIFICATION_AND_XP_LEDGER.md`.

## Documentation conventions (maintain throughout dev)
- `MASTER_PROJECT_BLUEPRINT.md` — **design authority** for the 21-screen product vision: full wireframes, ergonomic rules, logic-governance specs (competition engine, UDisc parser, XP ledger), and the reference `DATABASE_SCHEMA.md`/`TASKS.md` (written for a greenfield Expo stack — this repo absorbs its screens/rules/schema concepts into the shipped Vite+Supabase stack, it does not execute that TASKS.md literally). Added 2026-07-05.
- `PRODUCT_ROADMAP.md` — **current sequencing and feature-disposition authority** after the 2026-07-11 whole-product reconciliation; read before starting any feature or reviving a parked item.
- `PHASE_A_ARCHITECTURE.md` — approved lifecycle/event/metric/shell/offline/E2E contracts for the current phase.
- `CODEX_WORKFLOW.md` — current OpenAI model policy, token-efficient workflow, commands, and plugin/MCP setup.
- `SCREEN_SPECS.md` — the **integration layer** over the blueprint: per-screen status (in-scope/parked), REUSE vs NET-NEW file mapping, and explicit divergences from the blueprint's literal spec (stack, schema, OTP digit count, PDGA scraping, Screen 8 input model, etc.), with reasoning. Read this before building any of the 21 screens.
- `AGENTS.md` (this file) — living architecture doc; update whenever routes, schema, or conventions change
- `DEVELOPMENT_PLAN.md` — the tracks/layers execution plan with per-feature dev needs and sequencing; consult before starting any new feature
- `DEVLOG.md` — one entry per meaningful unit of work: what, why, key decisions, gotchas. Newest first. Update at the end of every Codex work session.
- `FEATURE_BACKLOG.md` — all ideated features with status (SHIPPED / IN PROGRESS / NEXT UP / BACKLOG / LATER / REJECTED). Move items as status changes; never delete rejected items — the reasoning is part of the record.
- Schema files are append-only history; never edit a previously-run schema file, add a new one. New concepts from the blueprint are absorbed as additive columns/tables on the existing schema (e.g. `discs.role`, `discs.wear_score`), never as a wholesale schema replacement.
- Commit at every working checkpoint. Push coherent green stages to a feature branch and use a reviewed
  pull request for `main` because `main` auto-deploys; direct production pushes require explicit approval.
- Database changes use append-only migrations, reviewed rollback notes, ownership/RLS negative tests,
  and post-apply smoke checks. Do not run automated backup commands or block migrations on manual
  backup confirmation; the owner manages production backup policy outside Codex sessions.
- Every task states its recommended model up front: **GPT-5.3-Codex medium** for normal UI/CRUD/test work; **GPT-5.6 high** for architecture, migrations, RLS/security, rules engines, synchronization, and complex algorithms. Use **GPT-5.4 mini low** only for bounded mechanical work with normal verification. Confirm the active model/reasoning level before starting a section.
- Plan-first rule: iterate and agree on designs in conversation BEFORE generating files, schemas, or prompts. Always prompt for approval before file generation.
- Coaching/AI design rule: intervention threshold — never surface coaching feedback off a single event; require a statistically meaningful pattern (e.g. ≥3 consecutive same-vector misses).

## Current build focus
Executing `PRODUCT_ROADMAP.md`: production/shared contracts → DISCS data foundation → DISCS
experience/intelligence → PLAY/ME/reports → courses/rounds/interoperability. Bottom navigation is
PLAY / DISCS / COURSES / ME now that the course directory ships; no standalone Stats tab. Existing
Layers 1–4 and Trophy Room are shipped foundations to extend, not rebuild. Social, commerce,
native/hardware, experimental capture, AI narrative, advanced sync UI, and PDGA automation remain
parked only until their documented revisit triggers are satisfied.

## Conventions
- All user-owned tables use Row Level Security scoped to `auth.uid()`
- Course/hole data is shared/community — readable by all authenticated users
- Never commit Supabase or OpenAI API keys — use environment variables
- Prefer small, composable React components over large page files
- Distance in feet, scores relative to par unless stated otherwise
- When adding a new data table: state the ideal column format (types, constraints, indexes) in
  the schema file's header comment before writing DDL, and seed representative test data where
  feasible — assigned to the project's actively-exercised test account (the one with real
  session/round history, not just a signed-up profile; check which account has real activity
  before assuming) rather than a placeholder with nothing to render against.

## Not yet decided / open questions
- Exact UI/UX flow for live round mode (chat interface vs structured prompts)
- Whether group/league features are a v1 or v2 concern
- Native GPS/camera integration timeline (Capacitor addition)

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
