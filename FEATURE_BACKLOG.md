# Feature Backlog

Status values: `SHIPPED` | `IN PROGRESS` | `NEXT UP` | `BACKLOG` | `LATER (deliberate)` | `REJECTED`

## Session history & insights

| Feature | Status | Notes |
|---|---|---|
| Unified history feed (freeform + regimens interleaved, day-grouped, filter chips) | IN PROGRESS | v1 history build |
| Detail views per session/run | IN PROGRESS | Per-distance / per-set breakdowns |
| Session notes | IN PROGRESS | Optional free text, both session types |
| One-tap tag chips | IN PROGRESS | Starter vocab: windy, indoor, outdoor, tired, new-putter, pre-tournament, experimenting. Free-text tags allowed, lowercase-kebab |
| Practice streak counter | IN PROGRESS | Consecutive days with ≥1 session; shown at top of history |
| PB badges | IN PROGRESS | New best score on a regimen; new make-% high at a distance (min 10 attempts to qualify) |
| Volume ledger | IN PROGRESS | Putts this week / month / lifetime |
| Fatigue curve | IN PROGRESS | Make % by set position across all regimen runs |
| Pressure differential | IN PROGRESS | Pressure-putt make % vs regular make % ("clutch factor") |
| Decay-weighted current form | IN PROGRESS | Exponentially weighted recent make %; shown beside lifetime for trend gap |
| Cadence fingerprint | IN PROGRESS | Performance by time-of-day and by gap-since-last-session |
| Confidence intervals on make % | IN PROGRESS | Wilson interval; show band until n ≥ 30 per distance |
| Distance heat profile | NEXT UP | Practice volume vs weakness by distance; the gap = blind spot |
| Putter tracking (link sessions to discs table) | NEXT UP | "Did switching putters help" with data |
| Experiment markers | BACKLOG | First-class change markers (stance, grip, disc); before/after stat splits with sample-size honesty |
| Distance-weighted practice load (intensity) | BACKLOG | Athlete/periodization framing; correlate pre-tournament load with results once round data exists |
| Monthly narrative recaps | BACKLOG | Auto-generated chapter summaries of a season |
| "What moved the needle" attribution | BACKLOG | Which regimen difficulty correlates with subsequent improvement; needs months of data |
| Rust indicator | BACKLOG | Days-since-last-session nudge; correlate layoffs with dips |
| Session quality composite score | BACKLOG | Single comparable number per session; design carefully to avoid gaming |
| Before/after date-range comparison | BACKLOG | Generalization of experiment markers |
| Ghost comparison (race your past best mid-run) | LATER (deliberate) | Pays off more once social exists |
| Shareable session cards | LATER (deliberate) | Social-phase feature; organic marketing |
| Head-to-head / league leaderboards | LATER (deliberate) | Social phase; regimen scores already comparable across users by design |
| Post-session AI insight | LATER (deliberate) | Background AI (Opus 4.8); needs its own design pass: prompt, cost model, trigger rules |
| Weekly AI digest | LATER (deliberate) | Same design pass as above |
| Long-horizon AI pattern detection | LATER (deliberate) | Day-of-week effects, practice-vs-tournament correlation; needs round data |
| Conditions auto-capture (weather) | BACKLOG | Reuse planned round-weather integration |
| XP/levels gamification | REJECTED | Points system already provides stakes; avoids Duolingo-ification |
| Public-by-default social features | REJECTED | Social is opt-in, later phase |
| Dashboard sprawl (charts for everything) | REJECTED | Few high-signal views over widget walls |

## Other app areas (previously scoped, not yet built)

| Feature | Status | Notes |
|---|---|---|
| Round logging tree (/rounds: courses, holes, scores) | BACKLOG | Schema already exists (rounds, round_holes, courses, holes) |
| Live caddie chat (Sonnet 5, server-side) | BACKLOG | Schema exists (live_sessions, caddie_recommendations); needs server-side API layer |
| Course prep views | BACKLOG | |
| Stats tab (app-level) | BACKLOG | History insights may graduate into it |
| Bottom tab bar app nav | BACKLOG | Waiting until ≥2 feature areas exist |
| PWA deploy + on-course testing | BACKLOG | |
| Capacitor wrap (app stores, native GPS/camera) | LATER (deliberate) | Wider-audience phase |

## Player & bag profile (planned 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| Player profile expansion (throwing identity, calibration, goals) | NEXT UP | Phase A; schema generated. Value+source pattern on calibration fields |
| Disc molds reference table + locker migration | NEXT UP | Phase B; insert-open/update-closed RLS; seed via manufacturer-site import (Infinite Discs fallback); Opus 4.8 for migration |
| Multiple bags + membership + flight chart | SHIPPED | Phase C; locker/bag split; partial unique index for default bag |
| Bag & disc manager UI (inventory/loadout UX) + bottom tab bar | IN PROGRESS | 1E — locker=inventory, bags=loadouts; grid/list toggle; minimal cards v1; tab bar: Practice/Bag/Profile |
| Game-flair card mode (rarity borders, equip animations, stat-block cards) | BACKLOG | Deliberately deferred from 1E |
| Disc comparison view (side-by-side stats) | BACKLOG | Natural inventory extension |
| Disc universe: MVP/Axiom/Streamline + Innova seed | IN PROGRESS | Manufacturer-site import with attribution (source_url/source_name/scraped_at on disc_molds); Innova running via Claude Code addendum |
| Disc universe: full ingestion pipeline (1F) | BACKLOG | Per-manufacturer adapters w/ user-provided URL hints; raw payload staging; dedup review queue; check open datasets before scraping more brands; image URLs only (no copying manufacturer photos); polite crawling |
| Disc universe: remaining manufacturers (Discraft, Trilogy, Discmania, long tail) | BACKLOG | One bounded session per manufacturer; Opus for pipeline skeleton, Sonnet per adapter |
| Disc wear timeline (condition change history) | BACKLOG | Current-state-only in v1 |
| Slot analysis ("no stable fairway in this bag") | BACKLOG | Derived view over bag + effective flight numbers |
| Per-disc usage stats | BACKLOG | Needs round data linking discs to holes |
| Personal disc photos as lost-disc flyers | BACKLOG | Photo field ships in Phase B; flyer generation later |
| Community mold curation/moderation | BACKLOG | Needed at public scale; update-closed until then |
| PDGA rating auto-sync | BACKLOG | No official public API; manual entry for now |
| Grip styles, practice availability, season goals fields | BACKLOG | Profile v2 candidates |
| Height/weight/fitness metrics | REJECTED | Caddie, not a fitness app |
| Round-history import from other apps | REJECTED | Huge scope; separate product decision if ever |

## Practice depth — web-viable features from sensor/drills TDD (ranked 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| Confidence interval map (lock-in vs coin-flip zones) | SHIPPED | Pure frontend over shipped Wilson-interval stats |
| Sun-Drenched Topo theme system (app-wide) | SHIPPED | 2.2a — exact tokens in CLAUDE.md; self-hosted Oswald; every screen restyled |
| Dual-pace scoring canvas (gesture zone + batch ribbon) | SHIPPED | 2.2c — 3-gate swipe physics, make-territory growth, grid/carousel batch ribbon w/ auto-fill |
| Instant-launch FSM + crash recovery (TTFP <5s) | SHIPPED | 2.2c — unified localStorage subsystem, synchronous bootstrap, once-per-load crash-recovery redirect |
| Audio telemetry (pitch ladder, TTS stage announcements, silence pill) | SHIPPED | 2.2c — Web Audio + SpeechSynthesis; pre-builds 2.7 voice infrastructure |
| Smart prediction card (next drill/distance) | SHIPPED | 2.2c — suggestNextSession composes existing confidenceMap/decayWeightedForm, zero new queries |
| Web haptics (capability-detected, Android only) | SHIPPED | 2.2c — Vibration API; simplified patterns; silent no-op on iOS |
| Per-putt capture layer (tap entry, miss zones, timestamps, input_source) | SHIPPED | 2.2c — putt_events table live; THE enabler: drills, diagnostics, pacing, voice, and future sensor inputs all feed one table |
| Gamified drills: JYLY, Around the World | NEXT UP | Regimen engine generalization (drill_type + rules_config jsonb) |
| Clutch simulator (randomized rest timers) | NEXT UP | Adopts TDD's 2-8min randomization; existing pressure scoring |
| Miss tendency diagnostics (9-zone heat grid) | NEXT UP | Manual-input version of TDD's CV impact clustering; 80% of insight, 2% of cost |
| Ghost pacing engine | BACKLOG | Elevated from LATER; TDD's HistoricalPacingProfile concept, manual-timestamp version |
| Voice callouts / Match Mode coaching | BACKLOG | Browser SpeechSynthesis; adopts TDD intervention-threshold rule (never coach off single events) |
| Acoustic make-detection prototype (Web Audio FFT) | BACKLOG | Experimental spike; success gate >90% agreement with manual entry outdoors |
| Tournament noise overlay (cognitive load training) | BACKLOG | Background audio loops; cheap once drills exist |

## Master Blueprint integration (2026-07-05 — see MASTER_PROJECT_BLUEPRINT.md + SCREEN_SPECS.md)

Supersedes the earlier "front-door & screen-spec ideation" section below it (v1 SCREEN_SPECS ideation
for screens 3–10, now folded into the 21-screen blueprint integration). Full per-screen reuse mapping,
divergences, and reasoning: `SCREEN_SPECS.md`. Execution sequencing: `DEVELOPMENT_PLAN.md` Layers 0–5.

| Feature | Status | Notes |
|---|---|---|
| Dexie.js + TanStack Query staged local-first repository | NEXT UP | Layer 1; behind a repository interface, InstantLaunch folds in last |
| Discs: role (primary/backup/situational putter), wear_score, total_chain_hits | SHIPPED | Layer 1 schema; supersedes earlier profile-columns putter-role proposal |
| Bag 35-disc capacity hard interlock | SHIPPED | Layer 1 schema (CHECK) + Layer 3 UI (disabled Add + blue/orange/rust states) — capacityTier() in lib/bags.js |
| Routine 100-putt hard interlock + rules_config/drill_type | SHIPPED | Layer 1 schema — this IS the Track 2.3 regimen-engine generalization |
| 4-tab app nav (Play / Bags / Stats / Pro) | SHIPPED | Layer 1 |
| Splash + auth overhaul (email 6-digit OTP, Apple/Google SSO, anonymous guest) | SHIPPED | Layer 2, Screens 1–2; SSO + anonymous sign-in need enabling in Supabase dashboard — see DEVLOG 2026-07-05 |
| Zero-typing onboarding (goal cards, putter provisioning, haptic test) | SHIPPED | Layer 2, Screen 3 |
| Dashboard hub (instant-replay hero, 3-way STANDARD/CUSTOM/NEW launchpad) | SHIPPED | Layer 3, Screen 4 — CLONE & TWEAK and the planning drawer are disabled stubs pending Layer 4's builder |
| Bag manager (My Bags / Putters / Universe + ghost-slot wishlist) | SHIPPED | Layer 3, Screen 5; client-side tabs at `/bag`, no new routes; retail bridge (Ghost Slot → Pro-Shop) parked |
| Putter lineup (role swimlanes, Bézier flight curve, wear slider + odometer alert) | SHIPPED | Layer 3, Screen 6 |
| Custom routine builder (stage stacking, live max-score preview, 100-putt totalizer) | BACKLOG | Layer 4, Screen 7 |
| Scoring canvas: split-screen tap as primary input | BACKLOG | Layer 4, Screen 8 — pending explicit sign-off; shipped gesture engine demoted to alt mode, not removed |
| Scoring canvas: stack-tracker pips, weather→backup swap suggestion, panic toggle | BACKLOG | Layer 4, Screen 8; swap suggestion needs putt_events.putter_disc_id |
| Unified session report (putter matrix, drop-off vs 30-day baseline, replay) | BACKLOG | Layer 4, Screen 9 |
| Analytics tower (equipment-milestone chart markers, sync ledger, CSV export) | BACKLOG | Layer 5, Screen 10 |
| Player career hub (manual PDGA entry, skill radar, most-trusted-putter) | BACKLOG | Layer 5, Screen 11; PDGA scraper deferred, no official API |
| Trophy room (XP/levels, badge evaluator, pursuits carousel) | BACKLOG | Layer 5, Screen 12; bag-tag/QR challenge parked with Social |
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
| Layouts as first-class entities (layouts table; holes/rounds re-pointed) | NEXT UP | Track 1.5 — must land before real round data; mirrors UDisc model |
| Provenance columns on rounds/courses (external_source, external_ref) | NEXT UP | Track 1.5 — idempotent imports, native vs imported distinguishable |
| course_aliases table | NEXT UP | Track 1.5 — UDisc name matching + catalog search synonyms; insert-open/update-closed |
| bag_id on rounds | NEXT UP | Rides with 1C — per-bag performance stats, caddie context |
| round_hole_id on putt_events | NEXT UP | Rides with 2.2 — tournament vs practice putting in one insights system |
| UDisc CSV round import | BACKLOG | Score-only data; idempotent via provenance; verify current CSV format at build time |
| Course catalog UI | BACKLOG | Next planning cycle after current execution order |
| Round management UI (/rounds tree) | BACKLOG | Next planning cycle; weather auto-capture ships with it |
| Data export (own-your-data CSV) | BACKLOG | Cheap trust-builder; build as importer rehearsal |
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
