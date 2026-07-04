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
- **PWA/deploy:** `vite-plugin-pwa` (manifest + app-shell-only service worker, see Track 1D) deployed to Vercel; `vercel.json` rewrites all paths to `index.html` for client-side routing. Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are set in the Vercel dashboard, same values as local `.env`.

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

See `putting_regimens_schema.sql` for the scored practice regimen feature (tables + content pre-exist in Supabase from an earlier session; the file documents the live schema, no seeding needed):
- `putting_regimens` — fixed set of 5 (difficulty 1-5), each with base points/make, streak step, no-miss bonus %, completion bonus
- `putting_regimen_sets` — the sets within a regimen (`distance_feet_min`/`distance_feet_max`, reps required, pressure multiplier for last putt)
- `putting_regimen_runs` — a user's attempt at a full regimen (total score, completed flag)
- `putting_regimen_run_sets` — per-set result within a run (makes, attempts, longest streak, clean set, pressure putt made, points earned); no `user_id` — ownership is scoped via `run_id` → `putting_regimen_runs.user_id`

See `phase_a_profile_schema.sql` for the player profile expansion (Track 1A, applied to `profiles`):
- Handedness, per-throw (backhand/forehand) confidence + max distance (value+source pattern: `*_ft` paired with `*_source` of `self_reported`/`derived`), C1 comfort distance (same pattern), `specialty_shots[]`, `target_rating`, `units`, private `injury_notes`

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
/practice/stats                    → confidence interval map (distance bands, lock-in/coin-flip zones)

/profile                           → sectioned player profile (top-level, sibling of /practice)
```

Future putting modes (games, challenges, drills) slot in as `/practice/<mode>`.
Future feature areas (rounds, caddie, fieldwork) become sibling trees with the same pattern (e.g. `/rounds/...`). `/profile` is the first such sibling.
App-level navigation will eventually be a bottom tab bar (Putting / Rounds / Caddie / Stats); not built yet — only one feature area exists. Until then, `/profile` and `/practice/stats` are reached via header icons on the practice menu.

### Practice menu design
- Card-list menu: each mode is a card with an icon (Tabler outline icons), title, one-line description, and chevron. Cards are a reusable `ModeCard`-style component so adding a mode is a one-line addition.
- Header includes a profile icon and a stats icon (top-right) linking to `/profile` and `/practice/stats`.
- Below the cards: a "Recent activity" strip showing the last 2-3 entries pulled from `putt_sessions` and `putting_regimen_runs`.
- Mobile-first: single-column cards, thumb-friendly tap targets.

### Player profile (see phase_a_profile_schema.sql)
Sectioned, edit-in-place page at `/profile`: Identity (username, PDGA number, division, handedness), Throwing (backhand/forehand confidence, specialty shots), Calibration (max distances + C1 comfort, each with a value+source pair; units), Goals (target rating, private injury notes). Each section saves independently via upsert. A nudge banner appears when the throwing profile is empty (both confidence fields unset and no max distances recorded), linking down to that section.
- `injury_notes` is private: rendered only on this screen, never selected by any shared/social view. Any future profile query written for another user's eyes must use an explicit column list excluding it — never `select('*')`.
- `*_source` columns are always written as `'self_reported'` by this UI; `'derived'` is reserved for a future automated path.

### Confidence interval map (see lib/insights/confidenceMap.js)
Pure-frontend view at `/practice/stats` over already-shipped data — zero schema. Buckets all putts (freeform logs at their exact distance; regimen sets at their distance-range midpoint) into 10ft bands (`DISTANCE_BAND_WIDTH_FT`), then classifies each band from its Wilson interval rather than the raw make %:
- **lock-in** — the interval's lower bound clears `LOCK_IN_LOWER_BOUND` (70%): even the pessimistic read is make-favored
- **coin-flip** — the interval straddles 50%: genuinely unresolved regardless of the point estimate
- **developing** — trending above 50% but not yet a settled lock-in
Each band shows the interval as a track + point marker, plus the raw n/interval whenever n < 30 (same threshold as session history's Wilson-interval display).

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
- **Before any migration or FK-restructuring session: take a manual database backup** (Supabase dashboard backup or pg_dump). Claude Code must confirm the backup exists before running migration SQL.
- Every task states its recommended model up front: **Sonnet 5** default for UI/CRUD work; **Opus 4.8** for migrations, schema design passes, rules engines, and DSP/algorithmic work.
- Coaching/AI design rule: intervention threshold — never surface coaching feedback off a single event; require a statistically meaningful pattern (e.g. ≥3 consecutive same-vector misses).

## Current build focus
Executing DEVELOPMENT_PLAN.md in order: 1A player profile → 2.1 confidence interval map → 1D deploy/PWA baseline → 1B+1.5 molds/locker + round/course groundwork → 1C bags → 2.2 per-putt capture layer → practice-depth features (drills, clutch simulator, miss tendency). Session history v1, 1A player profile, and 2.1 confidence interval map are SHIPPED. 1D (deploy + PWA baseline) is code-ready — PWA manifest/service worker and Vercel config are done — but not yet deployed; pushing to GitHub, connecting Vercel, and the on-phone/cellular test are outstanding and need the user. Native sensor-fusion features are parked on the Native iOS Roadmap in FEATURE_BACKLOG.md.

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
