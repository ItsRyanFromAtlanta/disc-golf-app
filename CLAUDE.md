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
- **AI:** Claude API called server-side only (never client-side — protects API keys)
  - Live-round chat: **Sonnet 5** — fast, conversational, cost-effective for real-time use
  - Background jobs (course data prep, post-round analysis): **Opus 4.8** — deeper reasoning, latency-tolerant
- **Dev tool:** Claude Code CLI

## Data model
See `supabase_schema.sql` for full schema. Key tables:
- `profiles` — user profile, extends auth.users
- `discs` — user's bag
- `courses` / `holes` — shared community course data (not user-owned)
- `rounds` / `round_holes` — user-owned round data
- `live_sessions` — active caddie chat state (JSONB log) during a round
- `caddie_recommendations` — logged AI suggestions per hole, tagged with model used

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
```

Future putting modes (games, challenges, drills) slot in as `/practice/<mode>`.
Future feature areas (rounds, caddie, fieldwork) become sibling trees with the same pattern (e.g. `/rounds/...`).

**App-level nav is a 4-tab bottom bar: PLAY / BAGS / STATS / PRO** (adopted from
`MASTER_PROJECT_BLUEPRINT.md`, 2026-07-05). `/practice` becomes the PLAY tab's dashboard hub;
`/practice/stats` (confidence map + analytics) moves under STATS; profile + settings live under PRO.
Bags keeps its own tree unchanged. Build order for this migration: see `DEVELOPMENT_PLAN.md` Layer 1.

### Practice menu design
- Card-list menu: each mode is a card with an icon (Tabler outline icons), title, one-line description, and chevron. Cards are a reusable `ModeCard`-style component so adding a mode is a one-line addition.
- Header includes a stats shortcut icon (top-right) reserved for a future stats view.
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

## Gamification (planned, Layer 5)
XP/leveling/badges land as pure, unit-tested functions in `lib/gamification/` (mirrors the
`lib/insights/` discipline) — XP payout constants, `calculateXpForLevel` (`1000 × 1.15^(level-1)`), and
a `BadgeEvaluatorService` run post-scoring/post-inventory/post-ingestion. Full spec:
`MASTER_PROJECT_BLUEPRINT.md` § `GAMIFICATION_AND_XP_LEDGER.md`.

## Documentation conventions (maintain throughout dev)
- `MASTER_PROJECT_BLUEPRINT.md` — **design authority** for the 21-screen product vision: full wireframes, ergonomic rules, logic-governance specs (competition engine, UDisc parser, XP ledger), and the reference `DATABASE_SCHEMA.md`/`TASKS.md` (written for a greenfield Expo stack — this repo absorbs its screens/rules/schema concepts into the shipped Vite+Supabase stack, it does not execute that TASKS.md literally). Added 2026-07-05.
- `SCREEN_SPECS.md` — the **integration layer** over the blueprint: per-screen status (in-scope/parked), REUSE vs NET-NEW file mapping, and explicit divergences from the blueprint's literal spec (stack, schema, OTP digit count, PDGA scraping, Screen 8 input model, etc.), with reasoning. Read this before building any of the 21 screens.
- `CLAUDE.md` (this file) — living architecture doc; update whenever routes, schema, or conventions change
- `DEVELOPMENT_PLAN.md` — the tracks/layers execution plan with per-feature dev needs and sequencing; consult before starting any new feature
- `DEVLOG.md` — one entry per meaningful unit of work: what, why, key decisions, gotchas. Newest first. Update at the end of every Claude Code work session.
- `FEATURE_BACKLOG.md` — all ideated features with status (SHIPPED / IN PROGRESS / NEXT UP / BACKLOG / LATER / REJECTED). Move items as status changes; never delete rejected items — the reasoning is part of the record.
- Schema files are append-only history; never edit a previously-run schema file, add a new one. New concepts from the blueprint are absorbed as additive columns/tables on the existing schema (e.g. `discs.role`, `discs.wear_score`), never as a wholesale schema replacement.
- Commit at every working checkpoint within a session; push to GitHub at session end (Vercel auto-deploys from main).
- **Before any migration or FK-restructuring session: take a manual database backup** (Supabase dashboard backup or pg_dump). Claude Code must confirm the backup exists before running migration SQL.
- Every task states its recommended model up front: **Sonnet 5** default for UI/CRUD work; **Opus 4.8** for migrations, schema design passes, rules engines, and DSP/algorithmic work. When resuming a plan that spans multiple work sessions, confirm the active model matches the recommendation for the current section before proceeding.
- Plan-first rule: iterate and agree on designs in conversation BEFORE generating files, schemas, or prompts. Always prompt for approval before file generation.
- Coaching/AI design rule: intervention threshold — never surface coaching feedback off a single event; require a statistically meaningful pattern (e.g. ≥3 consecutive same-vector misses).

## Current build focus
Executing the blueprint integration plan (see `SCREEN_SPECS.md` + `DEVELOPMENT_PLAN.md` Layers 0–5):
Layer 0 docs alignment (in progress) → Layer 1 foundation (schema absorption, Dexie/TanStack skeleton,
4-tab bar) → Layer 2 front-door (Splash/Auth/Onboarding) → Layer 3 hubs (Dashboard/Bag/Putter lineup) →
Layer 4 execution engine (routine builder, scoring canvas, session summary) → Layer 5 analytics +
progression (analytics tower, career hub, trophy room, UDisc ingestion). Social, hardware, and utility
screens (14–21 minus what's absorbed into Layer 5) are deliberately parked — see `SCREEN_SPECS.md`.
Session history v1 is SHIPPED. Native sensor-fusion features remain parked on the Native iOS Roadmap in
FEATURE_BACKLOG.md.

## Conventions
- All user-owned tables use Row Level Security scoped to `auth.uid()`
- Course/hole data is shared/community — readable by all authenticated users
- Never commit Supabase keys or Anthropic API keys — use environment variables
- Prefer small, composable React components over large page files
- Distance in feet, scores relative to par unless stated otherwise

## Not yet decided / open questions
- Exact UI/UX flow for live round mode (chat interface vs structured prompts)
- Whether group/league features are a v1 or v2 concern
- Native GPS/camera integration timeline (Capacitor addition)
