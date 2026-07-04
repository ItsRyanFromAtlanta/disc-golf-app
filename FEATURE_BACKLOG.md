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
| Player profile expansion (throwing identity, calibration, goals) | SHIPPED | Phase A (Track 1A); sectioned `/profile` page, edit-in-place, first-login nudge, value+source pattern, injury_notes private-only |
| Disc molds reference table + locker migration | IN PROGRESS | Track 1B. Schema/migration/verification/seed scripts + flight-number coalesce tested (Opus 4.8). Migration NOT yet executed — gated on user DB backup + dry-run approval |
| Multiple bags + membership + flight chart | IN PROGRESS | Track 1C. Schema (`bags`/`bag_discs`/`rounds.bag_id`) additive/independent of 1B, safe to run now. UI built. Blocked on the same 1B migration for `discs.status`/`mold_id` to actually work end-to-end |
| Bag & disc manager UI (inventory/loadout UX) + bottom tab bar | IN PROGRESS | Track 1E — built: bottom tab bar (Practice/Bag/Profile, data-driven for easy Rounds/Caddie additions), locker rebuilt as inventory (grid/list toggle persisted, search/filter/sort on effective numbers), disc detail (inspect) page with equip/unequip, bag capacity indicator + add-from-locker picker. Verified live: tab bar active-state + mobile safe-area, toggle persists across reload. Equip/unequip and all disc-data views still blocked on the 1B migration |
| Game-flair card mode (rarity borders, equip animations, stat-block cards) | BACKLOG | Deliberately deferred from 1E |
| Disc comparison view (side-by-side stats) | BACKLOG | Natural inventory extension |
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
| Confidence interval map (lock-in vs coin-flip zones) | NEXT UP | Pure frontend over shipped Wilson-interval stats |
| Per-putt capture layer (tap entry, miss zones, timestamps, input_source) | NEXT UP | THE enabler: drills, diagnostics, pacing, voice, and future sensor inputs all feed one table |
| Gamified drills: JYLY, Around the World | NEXT UP | Regimen engine generalization (drill_type + rules_config jsonb) |
| Clutch simulator (randomized rest timers) | NEXT UP | Adopts TDD's 2-8min randomization; existing pressure scoring |
| Miss tendency diagnostics (9-zone heat grid) | NEXT UP | Manual-input version of TDD's CV impact clustering; 80% of insight, 2% of cost |
| Ghost pacing engine | BACKLOG | Elevated from LATER; TDD's HistoricalPacingProfile concept, manual-timestamp version |
| Voice callouts / Match Mode coaching | BACKLOG | Browser SpeechSynthesis; adopts TDD intervention-threshold rule (never coach off single events) |
| Acoustic make-detection prototype (Web Audio FFT) | BACKLOG | Experimental spike; success gate >90% agreement with manual entry outdoors |
| Tournament noise overlay (cognitive load training) | BACKLOG | Background audio loops; cheap once drills exist |

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
