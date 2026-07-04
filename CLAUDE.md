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
- `discs` — user's bag (physical copies; see disc locker below)
- `courses` / `holes` — shared community course data (not user-owned)
- `rounds` / `round_holes` — user-owned round data
- `live_sessions` — active caddie chat state (JSONB log) during a round
- `caddie_recommendations` — logged AI suggestions per hole, tagged with model used

See `disc_locker_and_layouts_schema.sql` + `migrate_disc_locker_and_layouts.sql` for the disc locker (Track 1B) and layout/provenance groundwork (Track 1.5):
- `disc_molds` — shared reference of mold designs (manufacturer + mold_name unique case-insensitive; stock flight numbers; nullable enrichment). Insert-open / update-closed RLS, like a community catalog.
- `discs` — a physical copy links to a mold via `mold_id`; per-copy `override_{speed,glide,turn,fade}` (null = use mold stock — compute with `effectiveFlightNumbers` in `src/lib/discs.js`, which uses `??` so a 0 override wins); `status` lifecycle (`in_locker`/`lost`/`retired`/`sold`) replaces `is_active`; plus nickname, weight_grams, color, photo_url, acquired_on, provenance.
- `layouts` — first-class (a course has ≥1 layout; `holes` and `rounds` reference `layout_id`, not the course directly). One default layout per course (partial unique index).
- provenance: `external_source`/`external_ref` on `rounds` and `courses` (partial-unique together) make future imports (e.g. UDisc) idempotent. `course_aliases` (insert-open/update-closed) resolves import name variants + search synonyms.
- Migration is gated: additive schema is safe anytime; the data backfill + destructive column drops run in separate approved steps behind a DB backup (`migrate_*.sql` sections 2 and 3, with `verify_*.sql` between).

See `putting_practice_schema.sql` for the putting practice feature:
- `putt_sessions` — a practice session (user-owned, freeform date/notes)
- `putt_distance_logs` — session-summary makes/attempts per distance; `zone` (C1/C2/Beyond C2) is a generated column derived automatically from `distance_feet`, so the app only ever needs to submit distance + makes + attempts

See `putting_regimens_schema.sql` + `putting_regimens_seed.sql` for the scored practice regimen feature:
- `putting_regimens` — fixed set of 5 (difficulty 1-5), each with base points/make, streak step, no-miss bonus %, completion bonus
- `putting_regimen_sets` — the sets within a regimen (distance range, reps required, pressure multiplier for last putt)
- `putting_regimen_runs` — a user's attempt at a full regimen (total score, completed flag)
- `putting_regimen_run_sets` — per-set result within a run (makes, attempts, longest streak, clean set, pressure putt made, points earned)

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
App-level navigation will eventually be a bottom tab bar (Putting / Rounds / Caddie / Stats); not built yet — only one feature area exists.

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

## Documentation conventions (maintain throughout dev)
- `CLAUDE.md` (this file) — living architecture doc; update whenever routes, schema, or conventions change
- `DEVELOPMENT_PLAN.md` — the four-track execution plan with per-feature dev needs and sequencing; consult before starting any new feature
- `DEVLOG.md` — one entry per meaningful unit of work: what, why, key decisions, gotchas. Newest first. Update at the end of every Claude Code work session.
- `FEATURE_BACKLOG.md` — all ideated features with status (SHIPPED / IN PROGRESS / NEXT UP / BACKLOG / LATER / REJECTED). Move items as status changes; never delete rejected items — the reasoning is part of the record.
- Schema files are append-only history; never edit a previously-run schema file, add a new one.
- Commit at every working checkpoint within a session; push to GitHub at session end (Vercel auto-deploys from main).
- **Before any migration or FK-restructuring session: take a manual database backup** (Supabase dashboard backup or pg_dump). Claude Code must confirm the backup exists before running migration SQL.
- Every task states its recommended model up front: **Sonnet 5** default for UI/CRUD work; **Opus 4.8** for migrations, schema design passes, rules engines, and DSP/algorithmic work.
- Coaching/AI design rule: intervention threshold — never surface coaching feedback off a single event; require a statistically meaningful pattern (e.g. ≥3 consecutive same-vector misses).

## Current build focus
Executing DEVELOPMENT_PLAN.md in order: 1A player profile → 2.1 confidence interval map → 1B/1C molds, locker, bags → 2.2 per-putt capture layer → practice-depth features (drills, clutch simulator, miss tendency). Session history v1 is SHIPPED. Native sensor-fusion features are parked on the Native iOS Roadmap in FEATURE_BACKLOG.md.

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
