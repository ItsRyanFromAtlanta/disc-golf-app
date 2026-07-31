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
No single file describes the live schema. `supabase_schema.sql` is the Layer 1 *initial* schema and
carries annotated SUPERSEDED blocks where later work re-parented tables (most importantly `holes`);
the per-track root `*_schema.sql` files and `supabase/migrations/` own everything after it. Read the
banner at the top of `supabase_schema.sql` before writing a migration against it, and confirm shapes
against the live database when it matters. Key tables:
- `profiles` — user profile, extends auth.users
- `discs` — user's bag
- `courses` / `layouts` / `holes` — shared community course data (not user-owned); a course has one
  or more layouts and a hole belongs to a **layout**, not directly to a course
- `rounds` / `round_holes` — user-owned round data
- `round_players` — owner-scoped private markers for who else was on a round's card (a name, a seat,
  an optional stated total). Never another account's data; see the E2 group-scorecard note below
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
- `putt_events` (see `putt_events_schema.sql`) — per-putt real-time capture, owner-scoped
  (`auth.uid() = user_id`), client-generated `id` for idempotent offline sync. Parent is an exclusive
  arc across three nullable FKs — `regimen_run_id` / `freeform_session_id` / `round_hole_id` — exactly
  one non-null via a CHECK, rather than a polymorphic type+id pair. All three, including
  `round_hole_id` (references `round_holes(id)`, indexed), shipped together 2026-07-05 (Track 2.2c);
  no client capture surface writes the `round_hole_id` arm yet — `RoundScorecardPage` records per-hole
  strokes, not per-putt events — so it stays unreached in practice even though the column, FK, and
  index have been live since the table was created. `src/lib/repository/puttEventRepository.js`'s
  `buildPuttEventRow` is the exclusive-arc row-shaper for all three arms; only the regimen/freeform
  arms currently have a caller (`useInstantLaunchSession.js`)
- **Removed 2026-07-14 — do not rebuild.** The B1.7/B1.8 automated ingestion surface
  (`catalog_import_batches` / `catalog_import_artifacts` / `catalog_import_candidates` /
  `catalog_import_candidate_reviews`, the `catalog_review_candidate` / `catalog_promote_import_batch` /
  `catalog_stage_import` / `catalog_ensure_source` / `catalog_assert_ingestion_admin` RPCs, the
  `catalog-ingestion` and `catalog-ingestion-admin` Edge Functions, the `/admin/catalog` route, and the
  `private.catalog_ingestion_admins` allowlist) was torn down in migration `20260714120000` after the
  first live crawl staged 0 batches. `disc_molds` is populated manually by the owner. The migration
  files that created these objects remain as append-only history, and the empty `catalog-import-raw`
  Storage bucket is a pending dashboard cleanup. See `docs/development/CURRENT_WORK.md`.

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
/courses/:courseId/prep  → per-layout pre-round prep sheet (?layoutId= selects the layout)
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
- Card-list menu: each mode is a card with an icon (Tabler outline icons), title, one-line description, and chevron.
  **Corrected 2026-07-29** (was `docs/ui/_corrections/component-library.md` item 2): this rule was
  written as "Cards are a reusable `ModeCard`-style component so adding a mode is a one-line addition."
  That is not true of the shipped page. `src/components/ModeCard.jsx` exists and produces exactly this
  markup but has **zero importers**; `PracticeMenuPage.jsx:239-244` hand-writes the same class names
  inline (`.mode-card`, `.mode-card-body`, `.mode-card-title`, `.mode-card-description`,
  `.mode-card-chevron`), drops the Tabler icon, and substitutes a literal `›` for `IconChevronRight`.
  `PracticeMenuPage` is the only consumer of the `.mode-card` class family. **Until the two are
  reconciled, read this bullet as a CSS convention, not a component contract** — adding a mode is a
  markup addition. Deciding between migrating `PracticeMenuPage` to `ModeCard` and deleting the unused
  component is registered work in `docs/ui/DEFECT_REGISTER.md`, not settled here.
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
- Hard interlocks (adopted 2026-07-05, from `MASTER_PROJECT_BLUEPRINT.md`): a routine's total planned putts is capped at 100 and a bag's disc count is capped at 35. Both enforced app-side AND at the DB layer — never just one.
  **Corrected 2026-07-29** (was `docs/ui/_corrections/capture-screens.md` C-9 and `play-screens.md` P-1;
  ~~"DB CHECK backs it up"~~): neither is a `CHECK` constraint and neither can be — both count *sibling*
  rows, which row-level `CHECK` cannot see. Both are `before` row triggers that take a parent row lock
  and raise `errcode = 'check_violation'` (hence the `23514` test at `src/lib/regimens.js:44`):
  `enforce_routine_putt_cap()` / `regimen_sets_putt_cap_check` on `putting_regimen_sets`, which
  **exempts system regimens** (`user_id is null`), and `enforce_bag_capacity()` /
  `bag_discs_capacity_check` on `bag_discs` (both `layer1_foundation_schema.sql:230-290`). Do not add a
  `CHECK` to "back them up" — it would be a second, weaker, unenforceable guard. The app-side half is
  also weaker than this bullet implies: the 100-putt cap gates `Add next stage` but not `Save`, and the
  35-disc cap is pre-empted only on `/bag/manage`. See `SCREEN_SPECS.md` standing divergence #6 and
  `docs/ui/DEFECT_REGISTER.md`.

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

Phase D D4 checkpoint 3 adds append-only `practice_experiment_markers` for new-putter boundaries.
Markers are owner-scoped, tied to a physical disc, and insert-only; corrections create a new marker.
Before/after evidence uses only attributed events from completed-visible activities, treats each marker's
window as ending at the next marker, requires 10 attempts on both sides, and shows Wilson intervals for
small samples. Batch summaries and unselected events never become experiment evidence.

Phase D D4 checkpoint 4 adds schema-free best-run ghost pacing to active regimen runs. A background
completed-visible history read selects the highest-scoring same-regimen run with at least five timed
real-time events (newest completion breaks score ties). The profile freezes at Start and InstantLaunch
v3 retains it plus current diagnostic progress across recovery without duplicating sporting facts.
Comparison begins after three current real-time attempts; batch summaries never receive invented timing.

Phase D D4 checkpoint 5 generalizes the regimen engine for versioned classic drills. JYLY is a fixed
100-putt, one-point-per-make drill; Around the World advances on a make, steps back on a miss, and is
bounded at 100 attempts. Both reuse owner-scoped regimen runs and append-only run-set facts, including
repeated station visits. The active station, running score, and attempt count remain in the local
InstantLaunch stage snapshot for offline recovery; batch capture still writes summaries only.

Phase D D4 checkpoint 6 adds a one-attempt Clutch Simulator with selectable 15/20/25/33-foot
distances and a frozen randomized 2–8 minute deadline. The in-app deadline/recovery alarm is
authoritative; optional system notifications are permission-gated and best-effort while browser
execution remains available. Clutch capture is real-time only, writes `putt_events.is_pressure = true`,
and hides batch/edit paths so no pressure event is synthesized from a summary.

Phase D D4 checkpoint 7 adds opt-in, device-local Match Mode voice coaching to regimen and freeform
capture. The preference freezes at Start and InstantLaunch v4 retains diagnostic-only real-time events
plus callout cursors across recovery. Informational make-rate/ghost callouts occur every five genuine
events; interventions require three consecutive same-zone/same-distance-band misses or a 30-point drop
across consecutive five-attempt windows, with a five-attempt cooldown. Batch summaries never become
coaching evidence, undo retracts evidence, and the shared silence control cancels/suppresses speech.

Phase E E1 adds structured own-your-data export under `/profile/settings`. It reads the authoritative
Supabase account through the signed-in user's RLS session in ordered 500-row pages, includes only
referenced shared course/regimen/catalog rows, and produces deterministic formula-safe UTF-8 CSV files
inside a ZIP with a versioned manifest. It never falls back to a partial Dexie cache: offline, failed,
or unavailable table reads abort the whole export. The manifest explicitly excludes unsynced/device-only
facts and private photo binaries while retaining `disc_photos` metadata and Storage paths. Phase D's
server migrations and E1's authenticated preview export smoke passed before release.

Phase E field/platform hardening (2026-07-27) fixes defects found auditing the iOS story. The service
worker no longer self-activates: `registerType` is `prompt` with no `skipWaiting`/`clientsClaim`, so a
deploy can never reload an active capture session — `PwaUpdatePrompt` asks, and suppresses itself on
ACTIVE shell routes. `PuttingCanvas` holds a screen wake lock for the whole of active putting capture
(rounds deliberately do not; the phone is pocketed between holes). `usePuttAudio` declares a playback
audio session so the iOS ring switch stops silently muting feedback, and resumes a context suspended by
backgrounding. `requestPersistentStorage()` runs at start so the InstantLaunch buffer and Dexie outbox
are not evictable. `AuthPage` states honestly that Apple/Google sign-in leaves an installed iOS PWA and
may not carry the session back, steering to the in-app email code; detection lives in pure
`src/lib/platform.js`. Account deletion is a real privacy purge, not a soft delete: the
`delete_own_account()` security-definer RPC derives its subject from `auth.uid()`, releases community
attribution on `courses`/`course_aliases`/`disc_molds` to null so shared rows survive, removes private
Storage objects no foreign key reaches, then deletes the `auth.users` row that every owner-scoped table
cascades from. The client purges device storage only after the server confirms.

Phase E2 adds round weather as one concept with practice weather, not a second one. `rounds` gains
`weather_condition` and `wind_mph` (migration `20260730205654_phase_e_round_weather.sql`) carrying the
identical vocabulary and CHECK constraints D2 put on `putt_sessions`/`putting_regimen_runs`; the
pre-existing free-text `rounds.weather_summary` is kept as the optional note beside them, not
overloaded to carry structure. Every write goes through `roundWeatherFields()` in
`src/lib/roundWeather.js`, which is also the seam a future auto-capture provider plugs into — a
fetched observation is the same fact as a typed one and must stay equally correctable. Conditions are
editable on both `/rounds/:roundId` and `/rounds/:roundId/summary`, including after finalization.
`lib/insights/roundConditions.js` compares scoring by condition **within a single layout only** and
withholds any average until two conditions each have three complete rounds; below that it reports a
count with its coverage, never a claim. `PGRST204`/`42703` joined `DEPLOY_LAG_CODES` for this: a
client that writes a column before its migration lands must wait for it, not poison the round.

Phase E2 also adds course preparation at `/courses/:courseId/prep`, **on the existing schema — no
migration**. It is a prep sheet, not a caddie. `lib/insights/coursePrep.js` holds all of it as pure
functions: `layoutBrief` reads the shape of a layout out of `holes` and reports its own coverage
(distances are usually missing on a quick course, and a total that silently covers half the holes is
worse than no total); `holePrep` adds the player's own completed rounds **on that exact layout**, the
same single-layout rule `roundConditions.js` follows; `priorityHoles` ranks what has actually cost
strokes; `lockerCoverage` prints hole-distance bands beside `disc_molds.category` counts as two
facts, not a verdict. Counts, best scores and totals print at any sample size because they are facts;
averages are withheld below `COURSE_PREP_MIN_ROUNDS = 3`. The disc half is a **record, not a
recommendation** — "thrown here" from `round_holes.disc_id`, never "throw this". Nothing in the schema
records how far a player throws anything, so a flight-number→distance model would be exactly the
opaque composite the roadmap rejects; a real recommendation waits for the separately-approved
server-side caddie. Zero courses and zero rounds are the primary design case, not an afterthought.

Phase E2 adds **activity-only rounds**: a round logged as having happened without a scorecard.
`rounds.scoring_mode` (`20260730212900_phase_e_activity_only_rounds.sql`, `hole_by_hole` |
`activity_only`, NOT NULL defaulting to the former) records the player's intent at creation rather
than inferring it from the absence of `round_holes` — a card on the first tee, an abandoned card and a
deliberately unscored round all have zero scored holes, and only the third is this. The round is still
a `disc_golf_round` activity on the same `rounds(id, user_id) → activities(id, user_id)` bridge; it is
not an eighth activity type. `course_id` stays NOT NULL (a round has a place) and `layout_id` becomes
optional (without per-hole scoring the tee set changes nothing, though naming one is what lets an
optional stated total become a relative-to-par). `total_score` is the same column carrying a *stated*
number instead of a derived one, and `roundScoreSummary()` in `src/lib/roundScoring.js` returns the
source alongside every number so no screen prints one as the other — it also returns `null` rather
than the `relativeToPar([], holes)` zero that used to render an unscored round as even par. The rule
across metrics is: **anything counting rounds counts these; anything averaging strokes excludes them**
— `insights/roundVolume.js` counts them for volume and streak, `insights/roundConditions.js` excludes
them from per-layout scoring splits explicitly and still counts them in its ledger. Switching a round
between modes is deliberately not offered: that is a correction, and corrections here owe an audit
trail with previous/new values that the round layer does not have yet.

Phase E2 adds **bag snapshot verification**, and it adds **no schema**: `rounds.bag_id` /
`rounds.bag_version_id` and the immutable `bag_versions` / `bag_version_discs` snapshots already
exist, and what was missing was any way to know whether the recorded pointer means what it appears
to. `verifyRoundBag()` in `src/lib/roundBagVerification.js` answers that from the version timeline —
because a new `bag_versions` row is written on *every* grouped save, the version list for a bag is a
complete edit history, so "was this snapshot still current at the first tee?" and "was the bag saved
again during play?" are real questions with real answers. The round window comes from the activity
bridge rather than a new column: a round's activity is stored under the round's own id, and
`updated_at` on a terminal activity is its finalization time (`roundEndedAt()` in
`repository/roundBagRepository.js`). Seven statuses, and the distinctions are the feature: `unknown`
(history unreadable) is never reported as `snapshot_missing` (history read, version absent), and
neither is reported as `not_snapshotted` (no version recorded at all) — a bad connection must not
look like bad record-keeping. **Nothing is ever repaired**: no version id is written onto a round
that lacks one and no plausible snapshot is substituted, per the raw-events-are-authoritative rule.
`insights/bagSnapshotCoverage.js` aggregates the statuses and keeps `unknown` rounds out of the
coverage fraction so it recovers on its own once reads succeed. The motivating case is real and is
recorded as F2 in `docs/development/E2_ROUND_COURSE_AUDIT.md`: `useCreateRound`'s offline fallback
records the newest *locally known* version, which can be weeks old.

Phase E2 adds **group-scorecard groundwork**, and the word is exact: it builds the ownership model a
later group feature cannot be retrofitted with, and stops. `round_players`
(`20260730234500_phase_e_round_players.sql`, **written, NOT applied**) records who else was on the
card — a seat, a free-text name, an optional stated total — and **a companion's card is a marker
owned by the round's creator, not a row owned by the companion**. The alternative breaks four things
at once: the single-active invariant (`activities_one_current_per_user_idx` is unique per user, and
the person beside you is usually keeping their own card), the `auth.uid() = user_id` RLS shape
(writing their row means someone who is not them can write their data), soft deletion (hiding my
round would leave their half behind), and the ordinary case where they have no account. So a
companion row is a private observation in one account, the same kind of fact as
`rounds.weather_summary` — which makes the plain owner policy both sufficient and complete, keeps
`activities` untouched (a group round is still one activity), and satisfies the privacy rule by
construction rather than by policy: a third party's name is readable by exactly one account, joined
to no shared table, and aggregated nowhere. There is deliberately **no `player_user_id`**: linking a
seat to a real account is a *claim*, and the future `round_player_claims` must be owned by the
**claimant** so RLS can enforce the consent instead of trusting the writer. `(round_id, position)` is
the natural key a write upserts on, for the reason audit finding 1 taught — a replay whose local id
changed must converge, not poison — and the seat cap is enforced in the CHECK *and* in
`ROUND_PLAYER_LIMIT`, never one layer only. `insights/groupScorecard.js` builds the card in seat
order and **never ranks, never crowns a winner, and never averages a companion's total into
anything**; one sort call is the whole distance to a leaderboard, which is parked. Per-hole companion
scores are deliberately not built: the decided shape is a **separate `round_player_holes` table**,
never a nullable `round_holes.round_player_id`, because six consumers read `round_holes` and the
first one that forgets the filter folds someone else's 6 into the owner's stroke average. Read and
write both degrade in the deploy window: `isMissingRelationError` (`PGRST205` / `42P01`) resolves
`available: false` so the panel says the feature is not deployed rather than queueing writes forever,
and those codes stay transient so a companion added early waits for the migration. `round_players` is
the first `optionalUntilDeployed` source in E1's export — skipped with a manifest note only for those
two codes, aborting the export for anything else.

## Gamification (shipped, Layer 5)
XP/leveling/badges **are** pure, unit-tested functions in `lib/gamification/` (mirrors the
`lib/insights/` discipline) — XP payout constants, `calculateXpForLevel` (`1000 × 1.15^(level-1)`), and
a `BadgeEvaluatorService` run post-scoring/post-inventory/post-ingestion. Full spec:
`MASTER_PROJECT_BLUEPRINT.md` § `GAMIFICATION_AND_XP_LEDGER.md`.

**Status qualifier corrected 2026-07-29** (was `docs/ui/_corrections/lib-api-index.md` item 2): this
heading read `(planned, Layer 5)` and the body was future-tense. The module ships with exactly the API
described — nine files (`xp.js`, `constants.js`, `badgeCatalog.js` with 25 badges, `metrics.js`,
`evaluateBadges.js`, `playerStats.js`, `celebration.js`, `trophyRoom.js`, `badgeEvaluatorService.js`),
covered by `src/lib/gamification/gamification.test.js`, with the Trophy Room route live
(`src/lib/routeMetadata.js:293`). Only the status word was stale; the API facts were correct all along.
Two constants in this module — `XP_PER_IMPORTED_PUTT` and `IMPORT_XP_CAP` — are deliberately dead
pending Screen 13's parser and must not be removed as unused (`SCREEN_SPECS.md` Screen 13).

## Documentation conventions (maintain throughout dev)
- `MASTER_PROJECT_BLUEPRINT.md` — **design authority** for the 21-screen product vision: full wireframes, ergonomic rules, logic-governance specs (competition engine, UDisc parser, XP ledger), and the reference `DATABASE_SCHEMA.md`/`TASKS.md` (written for a greenfield Expo stack — this repo absorbs its screens/rules/schema concepts into the shipped Vite+Supabase stack, it does not execute that TASKS.md literally). Added 2026-07-05.
- `PRODUCT_ROADMAP.md` — **current sequencing and feature-disposition authority** after the 2026-07-11 whole-product reconciliation; read before starting any feature or reviving a parked item.
- `PHASE_A_ARCHITECTURE.md` — approved lifecycle/event/metric/shell/offline/E2E contracts for the current phase.
- `CODEX_WORKFLOW.md` — current OpenAI model policy, token-efficient workflow, commands, and plugin/MCP setup.
- `SCREEN_SPECS.md` — the **integration layer** over the blueprint: per-screen status (in-scope/parked), REUSE vs NET-NEW file mapping, and explicit divergences from the blueprint's literal spec (stack, schema, OTP digit count, PDGA scraping, Screen 8 input model, etc.), with reasoning. Read this before building any of the 21 screens.
- `AGENTS.md` (this file) — living architecture doc; update whenever routes, schema, or conventions change
- `docs/ui/README.md` — index of the screen-level documentation set (33 screens); start here for anything screen-specific, and read its working rules before adding to `docs/ui/`.
- `docs/ui/SCREEN_INVENTORY.md` — the **canonical route/status table**: every route, its component, shell, and documentation status. Screen status lives here and nowhere else.
- `docs/ui/DEFECT_REGISTER.md` — code defects found by the screen documentation pass. These are tracked work, not applied edits; check it before "fixing" something a screen document describes as broken.
- `docs/ui/EXECUTION_PLAN.md` — the sequencing artifact for that registered work; read it with `PRODUCT_ROADMAP.md` when choosing what to build next.
- `docs/decisions/` — ADRs for durable cross-cutting choices; see its README for when one is warranted.
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
Executing `PRODUCT_ROADMAP.md` Phase E, beginning with the E1 own-your-data export release gate before
course/round hardening and interoperability. Bottom navigation is
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
- **UI that calls a new RPC must degrade when the RPC is absent.** `main` auto-deploys and a
  migration cannot land in the same atomic step as the client that calls it, so there is always a
  window where the button is live and the function is not. Map the failure to a real message rather
  than rendering the raw PostgREST string — `PGRST202` and `42883` both mean "not deployed yet". See
  `src/lib/accountDeletion.js` for the pattern. This is what keeps merge order from being
  load-bearing: without it, shipping the client before the migration is a production defect rather
  than a temporary gap.
- When adding a new data table: state the ideal column format (types, constraints, indexes) in
  the schema file's header comment before writing DDL, and seed representative test data where
  feasible — assigned to the project's actively-exercised test account (the one with real
  session/round history, not just a signed-up profile; check which account has real activity
  before assuming) rather than a placeholder with nothing to render against.

## Not yet decided / open questions

**All three long-standing entries closed 2026-07-29.** Each now has an **accepted** ADR; the bullets are
replaced by pointers rather than deleted, so the questions stay traceable. Reopening any of them means
flipping that ADR's `Status`, not editing this list.

- ~~Exact UI/UX flow for live round mode (chat interface vs structured prompts)~~ → **decided**,
  `docs/decisions/0001-live-round-interaction-model.md`. The structured per-hole scorecard is the sole
  primary capture surface; conversational assistance is admitted only as a secondary bottom sheet, and
  only after E2. Ratifies what J1 already shipped, so it changes no code.
- ~~Whether group/league features are a v1 or v2 concern~~ → **decided**,
  `docs/decisions/0002-group-and-league-scope.md`. Schema-shaped groundwork in v1 only. This also
  supplies the definition E2 was missing: "group-scorecard groundwork" means ensuring nothing in the
  round schema or repository layer permanently assumes a single scorer — it authorizes **no** widened
  RLS, **no** shared-round UI, and **no** Social surface. Screens 14/15 stay parked.
- ~~Native GPS/camera integration timeline (Capacitor addition)~~ → **decided**,
  `docs/decisions/0003-native-capability-timeline.md`. Stay PWA-first; there is no date. Four normative
  triggers reopen the question: a required capability with no adequate web API; a decision to distribute
  through the App Store; the Track 4 sensor-mode platform decision landing; or field testing showing
  PWA-specific failures unfixable in the web layer.

Add a new bullet here whenever a genuinely open cross-cutting question appears, and retire it the same
way — into an ADR under `docs/decisions/`.

## graphify

Graphify builds a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file
relationships. **The directory is gitignored and is not present in a fresh clone** — it is a local,
disposable artifact, never product documentation. Everything below applies only when the graph has
actually been built on this machine; otherwise use `rg` and ignore this section.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
