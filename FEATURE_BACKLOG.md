# Feature Backlog

Status values: `SHIPPED` | `IN PROGRESS` | `NEXT UP` | `BACKLOG` | `LATER (deliberate)` | `REJECTED`

Current sequencing, merge/rejection decisions, and revisit triggers are authoritative in
`PRODUCT_ROADMAP.md` (2026-07-11 reconciliation). Historical sections remain for the reasoning trail;
entries marked `SUPERSEDED` or `OBSOLETE` must not be revived without updating that roadmap.

## Engineering and production operations

| Feature | Status | Notes |
|---|---|---|
| GitHub CI (test, lint, build) | SHIPPED | `.github/workflows/ci.yml` runs green on pull requests and `main` pushes since 2026-07-16 |
| Browser E2E baseline | IN PROGRESS | Shipped 2026-07-28: Playwright, `e2e/` with 32 specs over two viewport projects, authenticated via a seeded session with the backend intercepted in-page, plus an `e2e` CI job. Covered: route guards, shell, tab scroll/root, notification sheet/Back, 320px reflow, offline shell boot, keyboard tab operation, soft-delete/restore, pause/navigation/resume, and exactly-once reconnect across both reconnect shapes. Round-close confirmation moved to Covered on 2026-07-29 once the prompt was built. Still Partial: onboarding/Quick Play, single-active auto-close, completed edit/audit — the last two because the app has no surface to assert against, not because the harness cannot reach them. Coverage table in `PHASE_A_ARCHITECTURE.md` § 9; harness limits in `e2e/README.md` |
| Activity-lifecycle E2E fixtures | SHIPPED | 2026-07-28. Terminal activities seed via the `activities` table (hydrated into Dexie by `fetchHistory`); current activities via `seedLocalActivity`, writing straight to IndexedDB. Closed the soft-delete/restore and resume rows |
| Live-capture E2E fixtures | SHIPPED | 2026-07-28. `capture.spec.js` drives a real session through the launcher's Start button — the only browser path to `planActivityStart`. Moved pause/navigation/resume to Covered and the other four § 9 rows to honest Partial; two of those found real app defects, and fixing one (the reconnect double-send) later moved exactly-once reconnect to Covered as well |
| Reconnect double-send in syncScheduler | SHIPPED | `handleOnline`/`handleVisibility` guard only on `status !== FAILED` while `notifyOutboxChanged` guards on `!== SYNCING`, so an `online` event can start a second concurrent flush and every queued operation is sent twice (~1 run in 3). Idempotency keys absorb it server-side, so this is wasted reconnect traffic rather than corruption — but it defeats wire-level exactly-once. Found by the reconnect spec and fixed 2026-07-28: a real in-flight guard replaces the `status` check, with a rerun queue so a trigger arriving mid-flush is deferred rather than dropped. 11 unit tests plus a dedicated `online`-event E2E spec |
| History Detail "Saved" confirmation never shows | SHIPPED | `SessionReport` keys `NotesTagsEditor` on `notes`/`tags`, so a successful save changes the key and remounts the editor, discarding the confirmation. Fixed 2026-07-28 by keying on the entry id instead — which still resets the editor between entries, the thing the original key was protecting |
| ChipGroup selection is not exposed to assistive tech | SHIPPED | Selection is a CSS class only — no `aria-pressed` — so a selected tag cannot be announced or asserted by role and name. Fixed 2026-07-28 with `aria-pressed`. Deliberately not `role="radio"` for the single-select rows: a radiogroup owes the user roving tabindex and arrow-key traversal, and claiming the role without the keyboard contract would be a regression |
| Phase A release candidate and independent-session field gate | SHIPPED | A10 closed 2026-07-12; the independent authenticated-session/real-device result is user-reported, with Codex-observation limits recorded in CURRENT_WORK.md |
| Existing React lint-warning cleanup | SHIPPED | 2026-07-28: the three hook-dependency findings fixed via `useCallback`, following HistoryPage's pattern. The fourth was cleared later the same day by moving `useAuth` (and the context handle it needs) to `src/hooks/useAuth.js` across 37 importers. A re-export shim was rejected as suppressing the warning without fixing Fast Refresh. Lint is now at zero warnings |
| Production bundle code splitting | SHIPPED | 2026-07-30. Profiled first via a sourcemap byte-attribution pass, not by guessing: the 1,014.60 kB / 290.32 kB gzip single chunk was 57% `node_modules` (react-dom 175.7, dexie 93.1, the Supabase client tree ~197, react-router 40.6, query-core 32.1) and 37% `src/`, spread thin across 30 route pages. So the win was route boundaries, not one fat module. All 30 pages are now `React.lazy` except the three on the boot path (SplashPage, AuthPage, PracticeMenuPage — the `/` redirect target, kept eager so a cold start is not a two-round-trip waterfall). Suspense sits inside `AppShell`, below the header and above the tab bar, so chrome never unmounts; the fallback is the app's own `<p className="loading">` treatment, identical to what these screens already render while their queries resolve. Framework vendor is pinned into `vendor-react`/`vendor-query` so a one-line app fix no longer re-hashes ~240 kB of unchanged runtime in the SW precache. Cold boot 1,014.60 → 677.98 kB raw (−33%) and 290.32 → 200.31 kB gzip (−31%); the >500 kB warning is gone. Deliberately NOT split: the shell, guards and splash path (blank-frame risk), and the Supabase/Dexie boot chunks (`SupabaseClient` constructs its realtime/storage/functions subclients eagerly, and `AppShell` reads local activity/notification state on mount — both are genuinely needed before first paint). Total precache grew 1,082.54 → 1,102.61 KiB (+1.9%), the expected cost of per-chunk boilerplate |
| In-app account deletion (privacy purge) | SHIPPED | Client plus `delete_own_account()`; App Store Guideline 5.1.1(v) requirement. Migrations applied and verified 2026-07-29: security definer with `search_path=""`, zero arguments, `anon` cannot execute, community and moderation attribution released to null rather than deleted, private photo objects purged by prefix. The button still degrades to "temporarily unavailable" if the function is ever absent (`src/lib/accountDeletion.js`) |
| iOS/PWA field defects (OAuth breakout, SW mid-session reload, wake lock, silent-switch audio, storage eviction) | SHIPPED | 2026-07-27; see `docs/mobile/IOS_READINESS.md` |
| Onboarding Step-1 goal, persisted (`docs/ui/DEFECT_REGISTER.md` D-15) | SHIPPED | 2026-07-31. The wizard required a goal, held it in state, and never wrote it — persisted now on `profiles.onboarding_goal`, not the Phase D3 `goals` table: that feature's `GOAL_TYPES` are measurable targets (value, unit, dates, a create/pause/complete/cancel lifecycle) and `GOAL_OPTIONS` are three dashboard-focus tags with neither, so a `goals` row would mean fabricating a target the user never gave. Written at Finish (after Step 3's units write, so wizard writes to `profiles` land in wizard order) via the existing `upsertProfileFields` path, fire-and-forget so a write failure can never strand a user past the last step. Migration `20260731120000_phase_e_onboarding_goal.sql` is **written but NOT applied**; the client degrades silently on the column-missing and grant-missing codes both (`isGoalColumnUnavailable` in `src/lib/onboarding.js`) |
| Bag capacity guard on the two unguarded add surfaces (`docs/ui/DEFECT_REGISTER.md` D-19) | SHIPPED | 2026-07-31. `/bag/locker?addToBag=` and the disc-detail bag chips called `addDiscToBag` with no pre-check and surfaced the `enforce_bag_capacity()` trigger's raw Postgres string (`layer1_foundation_schema.sql:230-253` — a `before insert` trigger, not a CHECK, so it can count sibling rows; the DB stays authoritative). Both now guard client-side against the same 35-disc count the trigger uses and translate the trigger's own `check_violation` (23514) into the same readable copy if the guard loses a race. Shared pure logic in new `src/lib/bagCapacity.js` (kept out of the two page modules themselves — exporting non-component values from a page trips the project's `only-export-components` lint rule). Does not touch the separate count-mismatch the register also names at `/bag` (`BagPage.jsx` counts `in_locker` members only, against the trigger's all-rows count) — out of scope for this fix |
| Native privacy manifest and SDK audit | LATER (deliberate) | Required at Capacitor/iOS build phase; reconcile every SDK and actual collection before TestFlight |
| Protected `main` + required PR review/checks | NEXT UP | CI now succeeds remotely, so the blocker is cleared; configure branch protection in GitHub settings. `main` auto-deploys to Vercel |

## Session history & insights

| Feature | Status | Notes |
|---|---|---|
| Unified history feed (freeform + regimens interleaved, day-grouped, filter chips) | SHIPPED | Extend with auto-closed activities, soft deletion, corrections, provenance, and audit recovery |
| Detail views per session/run | SHIPPED | Extend into the complete activity-history model |
| Session notes | SHIPPED | Optional free text, both session types |
| One-tap tag chips | SHIPPED | Canonical session factors and editable weather context shipped in D2 |
| Practice streak counter | SHIPPED | Consecutive days with ≥1 session; shown contextually in ME/PLAY |
| PB badges | SHIPPED | New best score on a regimen; new make-% high at a distance (min 10 attempts) |
| Volume ledger | SHIPPED | Putts this week / month / lifetime |
| Fatigue curve | SHIPPED | D2 adds pattern-gated adaptive stage check-ins and a user-disableable round-turn prompt |
| Pressure differential | SHIPPED | Contextual metric; no standalone Stats tab |
| Make-% trend chart over time | SHIPPED | 2026-07-30 at `/practice/stats` as `insights/trend` + `TrendChart`. Re-derived from `775543c`, not merged: the 2026-07-14 version bucketed by UTC day at every range and plotted bare point estimates, so a 90-day view drew ~90 confident-looking dots of a dozen putts each. Buckets now widen with the window (1/5/15 days), every point carries a Wilson interval, thin points render hollow, and the direction verdict is only claimed when the window's two halves have non-overlapping 95% intervals with ≥20 attempts each. Milestone ★ markers moved from `disc_role_history` to the append-only `practice_experiment_markers` that superseded it |
| Decay-weighted current form | SHIPPED | Contextual recent-vs-lifetime metric; no opaque composite score |
| Cadence fingerprint | SHIPPED | Integrate into ME/weekly reports when supported by samples |
| Confidence intervals on make % | SHIPPED | Wilson band until n ≥ 30 per distance/split |
| Distance heat profile | SHIPPED | 2026-07-30 at `/practice/stats` as `insights/distanceProfile` + `DistanceHeatProfile`. The mismatch is the product, not the volume: each band is classified on two separately-displayed axes — share of practice against an even split, and strength read off the Wilson interval against the confidence map's existing lock-in bound — and the named gap is where they disagree (`blind-spot` weak+neglected, `grinding` weak+over-practised, `over-drilled` owned+over-practised). Deliberately not one priority score. Untouched bands inside the practised range surface separately as coverage gaps; a band under 10 attempts stays `untested`, and no mismatch is claimed below 2 qualified bands |
| Putter tracking (link sessions to discs table) | SHIPPED | D4 checkpoint 2 compares exact physical discs, exposes attribution coverage/Wilson uncertainty, and adjusts only across shared distance bands with sufficient evidence |
| Experiment markers | SHIPPED | D4 checkpoint 3: append-only new-putter boundaries, 10-attempt before/after floor, and Wilson intervals; grip experiments deferred by product decision |
| Distance-weighted practice load (intensity) | BACKLOG | Athlete/periodization framing; correlate pre-tournament load with results once round data exists |
| Monthly narrative recaps | BACKLOG | Auto-generated chapter summaries of a season |
| "What moved the needle" attribution | BACKLOG | Which regimen difficulty correlates with subsequent improvement; needs months of data |
| Rust indicator | BACKLOG | Days-since-last-session nudge; correlate layoffs with dips |
| Session quality composite score | REJECTED | Opaque composite conflicts with interpretable, takeaway-first metric policy |
| Before/after date-range comparison | SHIPPED | D4 checkpoint 3: marker-window comparison shipped; arbitrary date-range generalization remains a later extension |
| Ghost comparison (race your past best mid-run) | LATER (deliberate) | Pays off more once social exists |
| Shareable session cards | LATER (deliberate) | Social-phase feature; organic marketing |
| Head-to-head / league leaderboards | LATER (deliberate) | Social phase; regimen scores already comparable across users by design. **Still parked after E2's group-scorecard groundwork (2026-07-30)**, which records several players' totals on one private card and deliberately does not rank them: `insights/groupScorecard.js` returns seat order and has explicit tests asserting it exposes no rank, winner, gap or field average. The distance between that card and a leaderboard is one sort call, which is precisely why the sort is where the line was drawn |
| Post-session AI insight | LATER (deliberate) | Future OpenAI background analysis; needs prompt, cost, privacy, trigger, and eval design |
| Weekly AI digest | REJECTED | Deterministic weekly reports ship first; optional AI narrative may be reconsidered later |
| Long-horizon AI pattern detection | LATER (deliberate) | Day-of-week effects, practice-vs-tournament correlation; needs round data |
| Conditions auto-capture (weather) | BACKLOG | Manual/editable round weather shipped in E2 (2026-07-30); auto-capture still needs a weather provider, an API key, and a network policy that permits it. The seam is `roundWeatherFields()` in `src/lib/roundWeather.js` — a fetched observation normalizes through the same function a typed one does, so a provider adds no second write path. Provenance rides in later as an additive `weather_source` column, per the migration header |
| XP/levels gamification (historical rejection) | SUPERSEDED | Later blueprint decision shipped XP/levels/Trophy Room; retained to preserve decision history |
| Public-by-default social features | REJECTED | Social is opt-in, later phase |
| Dashboard sprawl (charts for everything) | REJECTED | Few high-signal views over widget walls |

## Other app areas (previously scoped, not yet built)

| Feature | Status | Notes |
|---|---|---|
| Round/course offline hardening (E2) | IN PROGRESS | 2026-07-28 audit in `docs/development/E2_ROUND_COURSE_AUDIT.md`. Checkpoint 1 fixed a silent permanent outbox poisoning (round-hole upsert resolved on the surrogate id, not the `unique (round_id, hole_id)` natural key) and added the first 8 tests to a ~600-line layer that had none. Checkpoint 2 (2026-07-29) makes course creation atomic via a `security invoker` RPC, proved against a local Postgres cluster including a contrast case reproducing the orphan-course defect. Checkpoint 3 (2026-07-29) gives the round outbox the § 8 retry/poison record by reusing the activity path, collapsing two duplicate queue implementations into one shared module, and surfacing unsynced rounds to the user. Checkpoint 4 (2026-07-29) gives course creation an offline path through the shared outbox. Open: finding 9 — `isPermanentError` knows only four Postgres codes and `PostgrestError` carries no `status`, so an RLS denial or a validation error on a queued write classifies as transient and retries forever; fixed at the course send site, unaudited on the activity and round paths. Also finding 8 (duplicate hole numbers on a quick course) plus findings 5–7, low or deferred |
| Round logging tree (/rounds: courses, holes, scores) | SHIPPED | J1 shipped 2026-07-14: COURSES tab, quick-course, offline-first scorecard/history/finalization, activity-parent FK bridge, and live owner-scoped RLS. |
| Live caddie chat (OpenAI Responses API, server-side) | BACKLOG | Schema exists; build after rounds/course prep and approve safety/cost/context policy |
| Course prep views | SHIPPED (v1) | E2 (2026-07-30): `/courses/:courseId/prep`, a per-layout prep sheet built entirely on existing schema — no migration. Three grounded parts: a layout brief from `holes` that reports its own coverage (`3 holes · par 10 · 720 ft`, plus "distance recorded on 2 of 3"), hole-by-hole cards carrying `par`/`distance_feet`/`tee_type`/`hazards`/`strategy_notes`, and a scouting half derived from the player's completed rounds **on that exact layout**. Logic is pure in `src/lib/insights/coursePrep.js`. Sample discipline mirrors `roundConditions.js`: counts, best score and total-over-par print at any size because they are facts; averages are withheld below `COURSE_PREP_MIN_ROUNDS = 3`, so `priorityHoles` returns nothing until a hole has earned a claim. Disc content is deliberately a **record, not a recommendation** — "Thrown here: Wraith ×3" from `round_holes.disc_id` — because nothing in the schema records how far this player throws, and a flight-number→distance model would be the opaque composite the roadmap rejects. Deferred: course-aware loadouts (bag-scoped rather than locker-scoped), editing hazards/strategy notes from the app, per-hole notes carried forward from prep into the scorecard, and offline course reads |
| Stats tab (app-level) | REJECTED | Statistics are contextual; ME is the career-wide summary |
| Bottom tab bar app nav | SHIPPED | Approved PLAY/DISCS/ME shell extended to PLAY/DISCS/COURSES/ME when the J1 course directory shipped |
| PWA deploy + on-course testing | BACKLOG | |
| Capacitor wrap (app stores, native GPS/camera) | LATER (deliberate) | Wider-audience phase |

## Player & bag profile (planned 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| Player profile expansion (throwing identity, calibration, goals) | SHIPPED | D3 checkpoint 3 splits editable player fields from device and cross-device Settings |
| ME career summary | SHIPPED | Takeaway-first identity/rating context, lifetime practice telemetry, sparse-data-safe skill radar, and attributed trusted-putter audit shipped in D3 checkpoint 2 |
| Goal pause/resume/history contracts | SHIPPED | D3 checkpoint 4 adds measurable creation, valid lifecycle actions, version-conflict protection, and immutable event history UI |
| Immutable deterministic weekly reports | SHIPPED | D3 checkpoint 5 adds DST-aware latest-completed-week generation, lifecycle eligibility filtering, immutable superseding versions, and ME history UI with Dexie fallback |
| Contextual notification preferences | SHIPPED | Owner-scoped Settings UI hydrates before optional producers; critical sync/data-safety alerts remain mandatory |
| Disc molds reference table + locker migration | SHIPPED | Extend with normalized plastic/run/stamp variants and moderation |
| Multiple bags + membership + flight chart | SHIPPED | Phase C; locker/bag split; partial unique index for default bag |
| Flight Spectrum | SHIPPED | Phase C item 3 (2026-07-16): wear-adjusted current-reality default, official manufacturer toggle, deterministic proximity clusters, accessible capacity-neutral ghost diamonds, legend/details, and missing-data states |
| Bag Resonance | SHIPPED | Phase C item 4 (2026-07-16): schema-free transparent coverage/speed-ladder/separation scores, weighting presets, current-reality inputs, and capacity-neutral ghost-gap targets |
| Disc/bag comparison cohorts | SHIPPED | Phase C item 5 (2026-07-16): personal effective vs official catalog source toggle, eligibility-gated community state, graceful official fallback, and transparent bag context summary |
| Bag & disc manager UI (inventory/loadout UX) + bottom tab bar | SHIPPED | 1E — locker=inventory, bags=loadouts; grid/list toggle; minimal cards v1; tab bar shipped. Scope met; see DEVELOPMENT_PLAN §1E |
| Collection-first DISCS hub + rich physical-disc profile | SHIPPED | Phase C item 1 (2026-07-16): Collection/Bags/Putters/Universe hierarchy, inventory summary, atomic 1–10 copy creation, genuine-event contextual performance, and unified lifecycle/photo/odometer history |
| Game-flair card mode (rarity borders, equip animations, stat-block cards) | SHIPPED | J3 shipped 2026-07-15. Opt-in DiscCard flair variant, pure role/wear/status tier logic, Profile preferences toggle, reduced-motion-safe Topo styling; cosmetic unlock events remain Phase B work |
| Disc comparison view (side-by-side stats) | SHIPPED | J2 (2026-07-15). Personal-cohort v1: /bag/compare, effective-flight comparison, per-axis highlights, override markers, curve overlay, and no-gap flags |
| Disc universe: read-only offline catalog repository | SHIPPED | B2 shipped 2026-07-15: Dexie v6 normalized caches + TanStack offline-first snapshot; mold picker, Universe, onboarding, and URL handoff migrated; canonical client inserts removed |
| Disc universe: manual disc/mold population | BACKLOG | REPLACES the scrapped automated seed. Owner populates canonical rows later through a reviewed data migration. No ordinary-client canonical writes, scraping, or attribution-import pipeline. See DEVELOPMENT_PLAN.md §1B population policy. |
| Disc universe: MVP/Axiom/Streamline + Innova seed (automated import) | REJECTED | SCRAPPED 2026-07-13. Was: manufacturer-site import with attribution; bounded official MVP snapshot adapter covering four molds. Abandoned — owner will populate discs manually instead. Live crawl proved the pipeline works end-to-end but the parser can't read MVP's current live page format (flight numbers moved to prose, no `data-flight` attr); not worth maintaining a scraper against a site we don't control. |
| Disc universe: full ingestion pipeline (1F) | REJECTED | SCRAPPED 2026-07-13 and torn down 2026-07-14. Append-only migration history remains; ingestion-only code, functions, and live tables were removed. Reason: manual population chosen over maintaining automated ingestion. |
| Disc universe: remaining manufacturers (Discraft, Trilogy, Discmania, long tail) | REJECTED | SCRAPPED 2026-07-13 with the ingestion pipeline it depended on. Manual population covers any manufacturer without per-manufacturer adapter work. |
| Opt-in community mold statistics | LATER (deliberate) | Aggregate anonymized performance by catalog mold only after explicit consent; personal physical-disc data stays private by default. Apply minimum-sample/privacy thresholds and keep community benchmarks separate from personal recommendations. |
| Disc wear timeline (condition change history) | SHIPPED | Phase B 2A (2026-07-15): trigger-backed immutable status/role/wear/condition and bag membership events |
| Bag configuration versions + restore preview | SHIPPED | Phase B 2A foundation + Phase C item 2 consolidation (2026-07-16): atomic grouped metadata/membership/default save, exactly one version per save, named restore changes/unavailable placeholders, metadata restore, and protected main-bag replacement |
| Persisted bag ghost slots | SHIPPED | Phase B 2B (2026-07-15): owner-scoped, capacity-neutral target flight gaps with reversible removal and Dexie v8 mirror |
| Physical-disc shot tags + tombstones | SHIPPED | Phase B 2B (2026-07-15): 10 curated tags, private custom tags, active-only uniqueness, and append-preserving removal tombstones |
| Private physical-disc photos | SHIPPED | B3 (2026-07-15): three private slots, compression, signed URLs, Dexie v9 upload queue, immutable replacement history, owner-scoped Storage/RLS, and 30-day recovery |
| Private Lost & Found timeline | SHIPPED | B4 (2026-07-15): owner-only cases/immutable updates, optional course/GPS/notes/contact, Dexie v10 replay, and atomic lost/recovered status transitions |
| Physical-disc odometers + permanent cosmetic tiers | SHIPPED | B5 (2026-07-16): immutable throws/chain-hit/airball deltas, guarded totals, correction provenance, Dexie v11 replay, and permanent 300/1,000/5,000 unlocks |
| Slot analysis ("no stable fairway in this bag") | BACKLOG | Derived view over bag + effective flight numbers |
| Per-disc usage stats | BACKLOG | Needs round data linking discs to holes |
| Personal disc photos as lost-disc flyers | BACKLOG | Photo field ships in Phase B; flyer generation later |
| Community mold curation/moderation | BACKLOG | Needed at public scale; update-closed until then |
| PDGA rating auto-sync | BACKLOG | No official public API; manual entry for now |
| Grip styles, practice availability, season goals fields | BACKLOG | Profile v2 candidates |
| Height/weight/fitness metrics | REJECTED | Caddie, not a fitness app |
| Generic round-history import from other apps | LATER (deliberate) | UDisc is approved separately; other providers require explicit format/provenance review |

## Practice depth — web-viable features from sensor/drills TDD (ranked 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| Confidence interval map (lock-in vs coin-flip zones) | SHIPPED | Pure frontend over shipped Wilson-interval stats |
| Sun-Drenched Topo theme system (app-wide) | SHIPPED | 2.2a — exact tokens in AGENTS.md § Design system; self-hosted Oswald; every screen restyled |
| Dual-pace scoring canvas (gesture zone + batch ribbon) | SHIPPED | 2.2c — 3-gate swipe physics, make-territory growth, grid/carousel batch ribbon w/ auto-fill |
| Instant-launch FSM + crash recovery (TTFP <5s) | SHIPPED | 2.2c — unified localStorage subsystem, synchronous bootstrap, once-per-load crash-recovery redirect |
| Audio telemetry (pitch ladder, TTS stage announcements, silence pill) | SHIPPED | 2.2c — Web Audio + SpeechSynthesis; pre-builds 2.7 voice infrastructure |
| Smart prediction card (next drill/distance) | SHIPPED | 2.2c — suggestNextSession composes existing confidenceMap/decayWeightedForm, zero new queries |
| Web haptics (capability-detected, Android only) | SHIPPED | 2.2c — Vibration API; simplified patterns; silent no-op on iOS |
| Per-putt capture layer (tap entry, miss zones, timestamps, input_source) | SHIPPED | 2.2c — putt_events table live; THE enabler: drills, diagnostics, pacing, voice, and future sensor inputs all feed one table |
| Gamified drills: JYLY, Around the World | SHIPPED | D4 checkpoint 5: versioned rules_config state machine, grouped selection, repeated-station history, 100-attempt guard, and offline progress recovery |
| Clutch simulator (randomized rest timers) | SHIPPED | D4 checkpoint 6: selectable distance, frozen 2–8min deadline, resume-safe in-app alarm, optional system alert, and genuine pressure-event attribution |
| Miss tendency diagnostics (9-zone heat grid) | SHIPPED | D4 checkpoint 1: completed-visible real-time events only, capture coverage shown, and repeated-vector callouts require three matching misses |
| Ghost pacing engine | SHIPPED | D4 checkpoint 4: frozen highest-score same-regimen profile, InstantLaunch v3 recovery, three-event floor, and real-time-only attempt/time/make deltas |
| Voice callouts / Match Mode coaching | SHIPPED | D4 checkpoint 7: opt-in recovery-safe SpeechSynthesis, five-attempt information cadence, three-vector/30-point-drop interventions, cooldown, undo, and silence gating |
| Acoustic make-detection prototype (Web Audio FFT) | BACKLOG | Experimental spike; success gate >90% agreement with manual entry outdoors |
| Tournament noise overlay (cognitive load training) | BACKLOG | Background audio loops; cheap once drills exist |

## Master Blueprint integration (2026-07-05 — see MASTER_PROJECT_BLUEPRINT.md + SCREEN_SPECS.md)

Supersedes the earlier "front-door & screen-spec ideation" section below it (v1 SCREEN_SPECS ideation
for screens 3–10, now folded into the 21-screen blueprint integration). Full per-screen reuse mapping,
divergences, and reasoning: `SCREEN_SPECS.md`. Execution sequencing: `DEVELOPMENT_PLAN.md` Layers 0–5.

| Feature | Status | Notes |
|---|---|---|
| Dexie.js + TanStack Query staged local-first repository | IN PROGRESS | Discs and D1 regimen metadata/sets exercise it; extend entity-by-entity, InstantLaunch folds in last |
| Discs: role (primary/backup/situational putter), wear_score, total_chain_hits | SHIPPED | Layer 1 schema; supersedes earlier profile-columns putter-role proposal |
| Bag 35-disc capacity hard interlock | SHIPPED | Layer 1 schema (CHECK) + Layer 3 UI (disabled Add + blue/orange/rust states) — capacityTier() in lib/bags.js |
| Routine 100-putt hard interlock + rules_config/drill_type | SHIPPED | Layer 1 schema — this IS the Track 2.3 regimen-engine generalization |
| 4-tab app nav (Play / Bags / Stats / Pro) | SUPERSEDED | Replace with PLAY / DISCS / ME; add COURSES when directory ships |
| Splash + auth overhaul (email 6-digit OTP, Apple/Google SSO, anonymous guest) | SHIPPED | Layer 2, Screens 1–2; SSO + anonymous sign-in need enabling in Supabase dashboard — see DEVLOG 2026-07-05 |
| Zero-typing onboarding (goal cards, putter provisioning, haptic test) | SHIPPED | Layer 2, Screen 3 |
| Dashboard hub (instant-replay hero, 3-way STANDARD/CUSTOM/NEW launchpad) | SHIPPED | D1 revision shipped 2026-07-16: true resume → Quick Play → select/create → suggestion → recent/history order, device-local default selector, Level-1 fallback, and offline regimen/set cache |
| D-20: RegimenSelectPage surfaced archived routines as startable orphans | SHIPPED | 2026-07-31. Fixed with `selectableRegimens()` (`src/lib/regimens.js`), applied at render in `RegimenSelectPage.jsx` — mirrors `PracticeMenuPage.jsx`'s `!r.archived`. Deliberately did NOT filter `fetchRegimensWithSets`/`regimenRepository.list`: `cacheList` bulk-deletes any cached routine absent from the remote snapshot, so an `archived` predicate on the query would have purged archived routines from the offline mirror the builder's clone/edit paths read. `fetchCustomRegimens` (`regimens.js`) still has zero callers post-fix — it duplicates `selectableRegimens` filtering for one user's rows specifically, which nothing needs while the shared `regimenRepository.list` + page-level filter pattern covers both STANDARD and CUSTOM tabs. Leaving it as unresolved dead code rather than wiring or deleting it in this pass; worth a follow-up to either give it a caller or remove it |
| Bag manager (My Bags / Putters / Universe + ghost-slot wishlist) | SHIPPED | Layer 3, Screen 5; client-side tabs at `/bag`, no new routes; retail bridge (Ghost Slot → Pro-Shop) parked |
| Putter lineup (role swimlanes, Bézier flight curve, wear slider + odometer alert) | SHIPPED | Layer 3, Screen 6 |
| Custom routine builder (stage stacking, live max-score preview, 100-putt totalizer) | SHIPPED | Layer 4, Screen 7 — reuses regimenScoring.js engine unmodified; blueprint per-stage First bonus omitted (no engine column) |
| Scoring canvas: split-screen tap as primary input | SHIPPED | Layer 4, Screen 8 — TapZone primary, gesture/panic are opt-in alt modes via CanvasContextBar toggle |
| Scoring canvas: stack-tracker pips, weather→backup swap suggestion, panic toggle | SHIPPED | Layer 4, Screen 8 — swap suggestion uses putt_events.putter_disc_id (now actually written) + discs.role backup_putter |
| Unified session report (putter matrix, drop-off vs 30-day baseline, replay) | SHIPPED | Layer 4, Screen 9 — one SessionReport component, 3 entry points (History detail, regimen summary, new freeform summary) |
| Analytics tower (equipment-milestone chart markers, sync ledger, CSV export) | BACKLOG | Layer 5, Screen 10 |
| Player career hub (manual PDGA entry, skill radar, most-trusted-putter) | BACKLOG | Layer 5, Screen 11; PDGA scraper deferred, no official API |
| Trophy room (XP/levels, badge evaluator, pursuits carousel) | SHIPPED | Layer 5, Screen 12 — XP ledger + 25-badge evaluator + filtered trophy wall, writes hardened behind SECURITY DEFINER RPCs post-review; bag-tag/QR challenge parked with Social |
| UDisc CSV ingestion (writes existing rounds table via Track 1.5 provenance) | BACKLOG | Layer 5, Screen 13 |
| Course practice hubs + leaderboards | LATER (deliberate) | Screen 14 — Social module, parked this cycle |
| Putting league bracket manager + P2P competition engine | LATER (deliberate) | Screen 15 — Social module; depends on 14 |
| Smartwatch companion + wearables hub | LATER (deliberate) | Screen 16 — needs native companion app (Track 4 decision) |
| Pro-shop / gear discovery engine | LATER (deliberate) | Screen 17 — needs real retail partnerships first |
| Offline sync conflict resolution center | LATER (deliberate) | Screen 18 — merge trigger ships in Layer 1; UI once conflicts are actually observed |
| Privacy & data sovereignty hub (legal accordions, total purge) | LATER (deliberate) | Screen 19 — export already covered by Screen 10; purge waits for real external users |
| Firmware & BLE sensor diagnostics | LATER (deliberate) | Screen 20 — no sensors exist yet to diagnose |
| Emergency panic recovery overlay | LATER (deliberate) | Screen 21 — sequenced after Layer 1's Dexie layer exists |

## Front-door & screen-spec ideation v1 (specced 2026-07-05, superseded same day — see above)

Historical record only — screens 3–10 ideation before the 21-screen Master Blueprint arrived. Kept for
the reasoning trail (some ideas, e.g. instant-replay hero and "one report, two doors," carried forward
into the blueprint integration and are cross-referenced there).

| Feature | Status | Notes |
|---|---|---|
| Play/Putt Hub (smart UP NEXT hero, streak chip, gear strip) | SUPERSEDED | Folded into Screen 4 dashboard hub above |
| Bag 3-tab hub (Bag / Locker / Catalog) + catalog destination | SUPERSEDED | Folded into Screen 5 (My Bags/Putters/Universe) above |
| Putter lineup (primary/backup depth chart, profile-column proposal) | SUPERSEDED | Blueprint's discs.role model adopted instead — see Screen 6 in SCREEN_SPECS.md |
| Canvas: opt-in Tap Mode (accessibility input mapping) | SUPERSEDED | Blueprint inverts this — split-screen tap becomes PRIMARY, gesture becomes the alt mode |
| Unified session report (score hero, drop-off curve, RUN IT BACK replay) | SUPERSEDED | Folded into Screen 9 above, same design |
| Analytics home (form-over-time chart, takeaway-first panels) | SUPERSEDED | Folded into Screen 10 above |

## Round management, course catalog & import groundwork (planned 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| Layouts as first-class entities (layouts table; holes/rounds re-pointed) | SHIPPED | Track 1.5 groundwork consumed by J1 course/layout detail and scorecard |
| Provenance columns on rounds/courses (external_source, external_ref) | SHIPPED | Track 1.5 groundwork retained for future imports; native J1 rows leave provenance nullable |
| course_aliases table | SHIPPED | Track 1.5 groundwork; J1 applies authenticated insert-open/update-closed RLS |
| bag_id on rounds | SHIPPED | J1 round setup optionally records the selected bag |
| Bag snapshot verification | SHIPPED | E2 (2026-07-30): **no migration** — the columns and the immutable snapshots already existed; what was missing was any way to tell whether the recorded pointer means what it appears to. `verifyRoundBag()` reads the bag's version timeline (a new `bag_versions` row per grouped save makes it a complete edit history) and reports seven statuses, keeping "history unreadable" strictly separate from "version absent" and from "never snapshotted". The round window comes from the activity parent's finalization time, not a new `finished_at` column. Nothing is repaired: no version id is written onto a round that lacks one. Surfaced read-only on `/rounds/:id/summary` |
| Honest `reason` on round-start bag snapshots | SHIPPED (migration unapplied) | E2 F3, closed 2026-07-31: `roundRepository.captureRoundStartBagVersion` now sends `reason: 'round_start'`. Migration `20260731020000_phase_e_bag_version_round_start_reason.sql` widens both the `bag_versions.reason` CHECK and `capture_bag_version`'s own guard and is **written but NOT applied**. Until it is, every deployment hits the deploy-lag window this was built for: the RPC rejects `'round_start'` with `'Invalid snapshot reason'`, which the client recognises (`isUnrecognizedBagVersionReasonError`) and degrades from — one retry with the old `'grouped_save'` reason, so a round still gets a real snapshot rather than none. Verification does not depend on the reason either way — it reads the timeline, not the labels |
| Bag-versus-scoring analysis | BACKLOG | The obvious next question ("do I score better with the tournament bag?") and deliberately not built yet: it is only worth building once `bagSnapshotLedger` shows real coverage. With 0 live rounds there is nothing to measure, and a claim built on one verifiable round would be measuring that round |
| round_hole_id on putt_events | SHIPPED (stale entry corrected 2026-07-31) | This entry was stale, not next up: the nullable `round_hole_id uuid references round_holes(id)` FK, its exclusive-arc CHECK against `regimen_run_id`/`freeform_session_id`, `idx_putt_events_round_hole_id`, and the unique `(round_hole_id, sequence)` index all shipped 2026-07-05 as part of Track 2.2c's `putt_events` table creation (`putt_events_schema.sql` always documented it) — applied live via Supabase MCP, same as the rest of that table, never as a tracked migration file. Re-verified live on 2026-07-31 via `list_tables`/`execute_sql` (columns, FK, both indexes, and the CHECK all present; RLS unchanged, still `auth.uid() = user_id`) before writing a redundant migration for it. What was still missing, and is now added: `src/lib/repository/puttEventRepository.js`'s pure, tested `buildPuttEventRow` — the exclusive-arc row-shaper `useInstantLaunchSession.js` now delegates to for its existing regimen/freeform writes, and the seam a future round-putting capture surface would call for the `'round'` arm. No such surface exists today (`RoundScorecardPage` records per-hole strokes, not per-putt gesture events) and building one is a product decision nobody has made, so nothing calls that arm yet — tournament vs practice putting comparison in one insights system is still open, now unblocked at the repository layer rather than the schema layer |
| UDisc CSV round import | BACKLOG | Score-only data; idempotent via provenance; verify current CSV format at build time |
| Course catalog UI | SHIPPED | J1 COURSES directory, quick-course form, layout/hole detail |
| Round management UI (/rounds tree) | SHIPPED | J1 round setup, offline scorecard, history, and finalization; E2 hardened the write/sync path and added round weather |
| Round weather context | SHIPPED | E2 (2026-07-30): editable conditions on the scorecard and summary, mirroring D2's practice weather rather than inventing a second concept. Additive `rounds.weather_condition`/`wind_mph` with D2's identical vocabulary and CHECKs; the pre-existing `weather_summary` stays the free-text note. Migration `20260730205654_phase_e_round_weather.sql` is **written but NOT applied** |
| Activity-only rounds | SHIPPED | E2 (2026-07-30): a round logged as having happened, with no scorecard. `rounds.scoring_mode` records the intent at creation rather than inferring it from an empty card — three different situations produce zero scored holes and only one of them is this. Still a `disc_golf_round` on the existing activity bridge, not a new activity type; `layout_id` becomes optional, `course_id` does not. An optional stated total is labelled as stated everywhere it appears. Counts for volume and streak (`insights/roundVolume.js`); explicitly excluded from per-layout scoring splits. Migration `20260730212900_phase_e_activity_only_rounds.sql` is **written but NOT applied** |
| Group-scorecard groundwork | SHIPPED | E2 (2026-07-30): the ownership model, and deliberately nothing more. `round_players` records who else was on the card as a **marker owned by the round's creator** — never a row owned by the companion, which would collide with the single-active invariant, need cross-account RLS, orphan on soft delete, and require the person you played with to have an account. Seat `(round_id, position)` is the natural key; the cap is in the CHECK and in `ROUND_PLAYER_LIMIT`. `insights/groupScorecard.js` builds the card in seat order and never ranks or averages. Read and write both degrade in the deploy window. Migration `20260730234500_phase_e_round_players.sql` is **written but NOT applied**, and its RLS negative tests (`verify_round_players_rls.sql`) are **written and unproven** |
| Per-hole scores for the other players on the card | BACKLOG | The additive next step, with its shape already decided so it is not a rewrite: a **new `round_player_holes` table** keyed `(round_player_id, hole_id)`, explicitly NOT a nullable `round_holes.round_player_id` — six consumers read `round_holes` and the first to forget the filter folds a companion's score into the owner's stroke average. It also needs its own provenance discriminator (as `rounds.scoring_mode` did) rather than inferring "stated" from the absence of hole rows, and its own delete policy: unlike a name, a score is a sporting fact |
| Linking a recorded companion to a real account | LATER (deliberate) | The entire social surface, parked behind `PRODUCT_ROADMAP.md`'s Social revisit trigger. When it is built, `round_player_claims` must be owned by the **claimant** — the person says "that seat is me" — not by the round's owner asserting who somebody is, because only that direction lets RLS enforce the consent. This is why `round_players` deliberately has no `player_user_id` |
| Rounds played somewhere not in the course catalog | BACKLOG | Distinct from activity-only rounds, which still name a course. Needs a nullable `rounds.course_id` plus a free-text place name, and a decision about what an uncatalogued course means for the community directory — deliberately not smuggled into the activity-only migration |
| Correcting a round's scoring mode after the fact | BACKLOG | Switching a round between scorecard and activity-only is a correction, and corrections in this project owe previous/new values, effective/recorded time, source and reason. The round layer has no audit path yet (`audit_events` exists and only the activity repository writes to it), so the UI deliberately does not offer the switch rather than offering it without a trail |
| Data export (own-your-data CSV) | SHIPPED | E1: remote-authoritative paginated RLS reads, referenced shared rows, and deterministic formula-safe CSV ZIP + manifest in ME settings; Phase D rollout and authenticated preview export smoke passed 2026-07-17 |
| Same-day practice↔round linkage | BACKLOG | Derivable by date; insights lib join, no schema |

## Native iOS Roadmap (parked — requires platform decision)

All features below assume native Swift/iOS (Vision, CoreML, ARKit, watchOS, HealthKit) and are incompatible with the current cross-platform web strategy without a native companion app. Revisit trigger: Tracks 1-2 of DEVELOPMENT_PLAN.md shipped + acoustic spike results known.

| Feature | Notes |
|---|---|
| Full CV make/miss detection + trajectory tracking | YOLO/CoreML at 60fps; anchor feature of a hypothetical native "sensor mode" companion |
| Watch IMU throw counting | Requires watchOS app; iOS-only by definition |
| LiDAR/AR automatic distance mapping | iPhone-Pro-only hardware |
| Biometric fatigue analytics (HealthKit HR) | Set-position fatigue curve already proxies this from free data |
| Thermal defense protocol + tripod bump recovery + environmental preflight | Armor for the CV system; parked with it |
| Spatial audio miss panning (AirPods) | Garnish on unbuilt systems |
| Haptic watch vocabulary | watchOS dependency |
| CV disc variant recognition (stamp/color masking) | Bag system + manual selection solves this at 2% of cost |
| Hardware volume-button silence override | Web cannot intercept volume buttons; on-screen pill ships in 2.2c |
| Full haptic vocabulary (frequency/intensity-specific patterns, iOS haptics) | Vibration API too crude; requires native haptic engines via Capacitor |
# 2026-07-12 checkpoint note

The Phase B catalog-ingestion pipeline now has the transactional staging RPC, authenticated
allowlist preflight, exact-byte Storage/RPC store, and protected `catalog-ingestion` function
source, now deployed live (JWT-protected, confirmed 401 on an unauthenticated request) after the
earlier Codex platform usage-limit rejection cleared. Full test/build/lint/graphify gates re-ran
clean; canonical review/promotion remains separate and no admin allowlist row was added.
