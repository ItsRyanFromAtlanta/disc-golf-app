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

See `bags_schema.sql` + `migrate_bag_locker.sql` for bags (Track 1C) — additive/independent of 1B (references `discs.id`, not `discs.status`):
- `bags` — user-owned (name, description, bag_type, capacity); one default bag per user via a partial unique index. `bag_discs` join (a disc can be in multiple bags; no `user_id` column — ownership via `bag_id` → `bags.user_id`, same pattern as regimen run sets). `rounds.bag_id` nullable FK (which bag was carried).
- Setting a new default bag is two client-side updates (unset the old default, then set the new one) — required by the partial unique index. Pure selection logic in `src/lib/bags.js` (`bagIdsToUnsetForNewDefault`).
- Bag views (`/bag`, the switcher) show only `status = 'in_locker'` discs (`bagViewDiscs`); lost/retired/sold discs keep their bag membership rows but drop out of the view. The locker view (`/bag/locker`) intentionally shows everything with a status filter.
- Flight chart plots effective numbers (`flightChartPoint`/`flightChartPoints` in `src/lib/bags.js`, speed × turn+fade), not stock — always goes through `effectiveFlightNumbers`.
- `migrate_bag_locker.sql`'s real prerequisite is `discs.status` existing, i.e. 1B's schema + Section 2 (backfill) — not 1B's destructive Section 3.

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
/practice/stats                    → confidence interval map (distance bands, lock-in/coin-flip zones)

/profile                           → sectioned player profile (top-level, sibling of /practice)

/bag                                → default bag view + switcher + flight chart (top-level)
/bag/locker                         → all disc copies, all statuses, with filters
/bag/manage                         → bag CRUD + disc-to-bag assignment
/bag/discs/new                      → add a disc (mold search/create, then customize)
/bag/discs/:discId                  → disc detail: inspect (effective vs stock numbers), edit attributes, equip/unequip per bag
```

Future putting modes (games, challenges, drills) slot in as `/practice/<mode>`.
Future feature areas (rounds, caddie, fieldwork) become sibling trees with the same pattern (e.g. `/rounds/...`).

### App-level navigation (Track 1E)
A bottom tab bar (`src/components/TabBar.jsx`) is the app shell, not header icons — `src/components/AppShell.jsx` wraps every authenticated route once (auth guard + persistent tab bar) instead of each route group wrapping its own `ProtectedRoute`. Tabs today: Practice / Bag / Profile. `TABS` is a plain data array in `TabBar.jsx`, so Rounds and Caddie are one-line additions when those feature areas exist. Active state matches by path prefix, so nested routes (`/practice/history`) keep their parent tab lit. Safe-area aware: `viewport-fit=cover` in `index.html` + `env(safe-area-inset-bottom)` in the tab bar and the content wrapper's bottom padding, for notched/home-indicator phones.

### Practice menu design
- Card-list menu: each mode is a card with an icon (Tabler outline icons), title, one-line description, and chevron. Cards are a reusable `ModeCard`-style component so adding a mode is a one-line addition.
- Header includes a stats icon (top-right) linking to `/practice/stats` — Profile and Bag moved to the tab bar and no longer live here.
- Below the cards: a "Recent activity" strip showing the last 2-3 entries pulled from `putt_sessions` and `putting_regimen_runs`.
- Mobile-first: single-column cards, thumb-friendly tap targets.

### Bag & disc manager UX (Track 1E, see lib/discFilters.js)
Inventory/loadout mental model: the locker is inventory (every owned disc), bags are loadouts (equipped subsets). All filtering/sorting/search operates on **effective** numbers (`effectiveFlightNumbers`, override-aware), never mold stock.
- Locker (`/bag/locker`): `DiscCard` grid⇄list toggle, persisted to `localStorage` (`src/lib/viewPreference.js`) — survives reload, has zero DB dependency by design. Search (nickname/manufacturer/mold) + filters (manufacturer, speed class, stability, status) + sort (speed, stability, recently added), all in `filterDiscs`/`sortDiscs`. Speed class and stability (understable/stable/overstable, from turn+fade) are named thresholds documented in code — tune there if the feel is off.
- The locker's toolbar renders even when the disc fetch fails (sets `discs: []` alongside the error) — the grid/list toggle and filter chrome have value independent of whether data loaded; only the result list itself goes empty.
- Disc detail (`/bag/discs/:discId`): effective vs. stock numbers shown side by side; attributes edit via `EditableSection`; bag memberships are one-tap equip/unequip toggles, immediately reflected (each page re-fetches on mount, so there's no stale-cache risk between locker/detail/bag views).
- Bag view (`/bag`): capacity indicator (progress bar, flags over-capacity) when `bags.capacity` is set. "Add from locker" reuses the locker page in a picker mode via `?addToBag=<bagId>` (no separate route) — Add/Added toggle per disc instead of navigating to detail.
- Deliberately deferred (backlog): game-flair mode (rarity borders, equip animations, stat-block cards).

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
Executing DEVELOPMENT_PLAN.md in order: 1A player profile → 2.1 confidence interval map → 1D deploy/PWA baseline → 1B+1.5 molds/locker + round/course groundwork → 1C bags → 1E bag/disc manager UX + tab bar → 2.2 per-putt capture layer → practice-depth features (drills, clutch simulator, miss tendency). Session history v1, 1A player profile, and 2.1 confidence interval map are SHIPPED. 1D is code-ready but not deployed. 1B/1.5 (disc molds, layouts), 1C (bags/locker/flight chart), and 1E (inventory UX, bottom tab bar) are all code-complete — schema, migration scripts, UI, and unit tests all written and the app-nav/UX layer is verified live — but the 1B migration has not been executed against the live database yet, so no disc/bag feature actually works end-to-end (all fail gracefully) until that happens; see DEVLOG.md for the exact run order. Native sensor-fusion features are parked on the Native iOS Roadmap in FEATURE_BACKLOG.md.

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
