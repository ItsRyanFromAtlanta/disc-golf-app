# Feature Backlog

Status values: `SHIPPED` | `IN PROGRESS` | `NEXT UP` | `BACKLOG` | `LATER (deliberate)` | `REJECTED`

Current sequencing, merge/rejection decisions, and revisit triggers are authoritative in
`PRODUCT_ROADMAP.md` (2026-07-11 reconciliation). Historical sections remain for the reasoning trail;
entries marked `SUPERSEDED` or `OBSOLETE` must not be revived without updating that roadmap.

## Engineering and production operations

| Feature | Status | Notes |
|---|---|---|
| GitHub CI (test, lint, build) | IN PROGRESS | Workflow added; enable protected-branch required checks after the first successful remote run |
| Browser E2E baseline | SHIPPED | Phase A A10 browser, authenticated-route, reload, and notification smoke gates passed 2026-07-12 |
| Phase A release candidate and independent-session field gate | SHIPPED | A10 closed 2026-07-12; the independent authenticated-session/real-device result is user-reported, with Codex-observation limits recorded in CURRENT_WORK.md |
| Existing React lint-warning cleanup | BACKLOG | Four pre-existing warnings: three hook dependency findings and one Fast Refresh export finding; address as touched or in a bounded cleanup review |
| Production bundle code splitting | BACKLOG | Current main JS is ~740 KB minified / ~213 KB gzip; profile routes and split meaningful feature trees before public/mobile beta |
| Native privacy manifest and SDK audit | LATER (deliberate) | Required at Capacitor/iOS build phase; reconcile every SDK and actual collection before TestFlight |
| Protected `main` + required PR review/checks | NEXT UP | Configure after the CI workflow succeeds remotely; `main` auto-deploys to Vercel |

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
| Decay-weighted current form | SHIPPED | Contextual recent-vs-lifetime metric; no opaque composite score |
| Cadence fingerprint | SHIPPED | Integrate into ME/weekly reports when supported by samples |
| Confidence intervals on make % | SHIPPED | Wilson band until n ≥ 30 per distance/split |
| Distance heat profile | NEXT UP | Practice volume vs weakness by distance; the gap = blind spot |
| Putter tracking (link sessions to discs table) | NEXT UP | "Did switching putters help" with data |
| Experiment markers | BACKLOG | First-class new-putter markers only for now; grip experiments deferred by product decision |
| Distance-weighted practice load (intensity) | BACKLOG | Athlete/periodization framing; correlate pre-tournament load with results once round data exists |
| Monthly narrative recaps | BACKLOG | Auto-generated chapter summaries of a season |
| "What moved the needle" attribution | BACKLOG | Which regimen difficulty correlates with subsequent improvement; needs months of data |
| Rust indicator | BACKLOG | Days-since-last-session nudge; correlate layoffs with dips |
| Session quality composite score | REJECTED | Opaque composite conflicts with interpretable, takeaway-first metric policy |
| Before/after date-range comparison | BACKLOG | Generalization of experiment markers |
| Ghost comparison (race your past best mid-run) | LATER (deliberate) | Pays off more once social exists |
| Shareable session cards | LATER (deliberate) | Social-phase feature; organic marketing |
| Head-to-head / league leaderboards | LATER (deliberate) | Social phase; regimen scores already comparable across users by design |
| Post-session AI insight | LATER (deliberate) | Future OpenAI background analysis; needs prompt, cost, privacy, trigger, and eval design |
| Weekly AI digest | REJECTED | Deterministic weekly reports ship first; optional AI narrative may be reconsidered later |
| Long-horizon AI pattern detection | LATER (deliberate) | Day-of-week effects, practice-vs-tournament correlation; needs round data |
| Conditions auto-capture (weather) | BACKLOG | Reuse planned round-weather integration |
| XP/levels gamification (historical rejection) | SUPERSEDED | Later blueprint decision shipped XP/levels/Trophy Room; retained to preserve decision history |
| Public-by-default social features | REJECTED | Social is opt-in, later phase |
| Dashboard sprawl (charts for everything) | REJECTED | Few high-signal views over widget walls |

## Other app areas (previously scoped, not yet built)

| Feature | Status | Notes |
|---|---|---|
| Round logging tree (/rounds: courses, holes, scores) | SHIPPED | J1 shipped 2026-07-14: COURSES tab, quick-course, offline-first scorecard/history/finalization, activity-parent FK bridge, and live owner-scoped RLS. |
| Live caddie chat (OpenAI Responses API, server-side) | BACKLOG | Schema exists; build after rounds/course prep and approve safety/cost/context policy |
| Course prep views | BACKLOG | |
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
| Sun-Drenched Topo theme system (app-wide) | SHIPPED | 2.2a — exact tokens in CLAUDE.md; self-hosted Oswald; every screen restyled |
| Dual-pace scoring canvas (gesture zone + batch ribbon) | SHIPPED | 2.2c — 3-gate swipe physics, make-territory growth, grid/carousel batch ribbon w/ auto-fill |
| Instant-launch FSM + crash recovery (TTFP <5s) | SHIPPED | 2.2c — unified localStorage subsystem, synchronous bootstrap, once-per-load crash-recovery redirect |
| Audio telemetry (pitch ladder, TTS stage announcements, silence pill) | SHIPPED | 2.2c — Web Audio + SpeechSynthesis; pre-builds 2.7 voice infrastructure |
| Smart prediction card (next drill/distance) | SHIPPED | 2.2c — suggestNextSession composes existing confidenceMap/decayWeightedForm, zero new queries |
| Web haptics (capability-detected, Android only) | SHIPPED | 2.2c — Vibration API; simplified patterns; silent no-op on iOS |
| Per-putt capture layer (tap entry, miss zones, timestamps, input_source) | SHIPPED | 2.2c — putt_events table live; THE enabler: drills, diagnostics, pacing, voice, and future sensor inputs all feed one table |
| Gamified drills: JYLY, Around the World | NEXT UP | Regimen engine generalization (drill_type + rules_config jsonb) |
| Clutch simulator (randomized rest timers) | NEXT UP | Adopts TDD's 2-8min randomization; existing pressure scoring |
| Miss tendency diagnostics (9-zone heat grid) | SHIPPED | D4 checkpoint 1: completed-visible real-time events only, capture coverage shown, and repeated-vector callouts require three matching misses |
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
| Dexie.js + TanStack Query staged local-first repository | IN PROGRESS | Discs and D1 regimen metadata/sets exercise it; extend entity-by-entity, InstantLaunch folds in last |
| Discs: role (primary/backup/situational putter), wear_score, total_chain_hits | SHIPPED | Layer 1 schema; supersedes earlier profile-columns putter-role proposal |
| Bag 35-disc capacity hard interlock | SHIPPED | Layer 1 schema (CHECK) + Layer 3 UI (disabled Add + blue/orange/rust states) — capacityTier() in lib/bags.js |
| Routine 100-putt hard interlock + rules_config/drill_type | SHIPPED | Layer 1 schema — this IS the Track 2.3 regimen-engine generalization |
| 4-tab app nav (Play / Bags / Stats / Pro) | SUPERSEDED | Replace with PLAY / DISCS / ME; add COURSES when directory ships |
| Splash + auth overhaul (email 6-digit OTP, Apple/Google SSO, anonymous guest) | SHIPPED | Layer 2, Screens 1–2; SSO + anonymous sign-in need enabling in Supabase dashboard — see DEVLOG 2026-07-05 |
| Zero-typing onboarding (goal cards, putter provisioning, haptic test) | SHIPPED | Layer 2, Screen 3 |
| Dashboard hub (instant-replay hero, 3-way STANDARD/CUSTOM/NEW launchpad) | SHIPPED | D1 revision shipped 2026-07-16: true resume → Quick Play → select/create → suggestion → recent/history order, device-local default selector, Level-1 fallback, and offline regimen/set cache |
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
| round_hole_id on putt_events | NEXT UP | Rides with 2.2 — tournament vs practice putting in one insights system |
| UDisc CSV round import | BACKLOG | Score-only data; idempotent via provenance; verify current CSV format at build time |
| Course catalog UI | SHIPPED | J1 COURSES directory, quick-course form, layout/hole detail |
| Round management UI (/rounds tree) | SHIPPED | J1 round setup, offline scorecard, history, and finalization; weather remains future work |
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
# 2026-07-12 checkpoint note

The Phase B catalog-ingestion pipeline now has the transactional staging RPC, authenticated
allowlist preflight, exact-byte Storage/RPC store, and protected `catalog-ingestion` function
source, now deployed live (JWT-protected, confirmed 401 on an unauthenticated request) after the
earlier Codex platform usage-limit rejection cleared. Full test/build/lint/graphify gates re-ran
clean; canonical review/promotion remains separate and no admin allowlist row was added.
