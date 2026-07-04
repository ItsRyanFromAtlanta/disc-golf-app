# Feature Backlog

Status values: `SHIPPED` | `IN PROGRESS` | `NEXT UP` | `BACKLOG` | `LATER (deliberate)` | `REJECTED`

## Session history & insights

| Feature | Status | Notes |
|---|---|---|
| Unified history feed (freeform + regimens interleaved, day-grouped, filter chips) | SHIPPED | v1 history build |
| Detail views per session/run | SHIPPED | Per-distance / per-set breakdowns |
| Session notes | SHIPPED | Optional free text, both session types |
| One-tap tag chips | SHIPPED | Starter vocab: windy, indoor, outdoor, tired, new-putter, pre-tournament, experimenting. Free-text tags allowed, lowercase-kebab |
| Practice streak counter | SHIPPED | Consecutive days with ≥1 session; shown at top of history |
| PB badges | SHIPPED | New best score on a regimen; new make-% high at a distance (min 10 attempts to qualify) |
| Volume ledger | SHIPPED | Putts this week / month / lifetime |
| Fatigue curve | SHIPPED | Make % by set position across all regimen runs |
| Pressure differential | SHIPPED | Pressure-putt make % vs regular make % ("clutch factor") |
| Decay-weighted current form | SHIPPED | Exponentially weighted recent make %; shown beside lifetime for trend gap |
| Cadence fingerprint | SHIPPED | Performance by time-of-day and by gap-since-last-session |
| Confidence intervals on make % | SHIPPED | Wilson interval; show band until n ≥ 30 per distance |
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
| PWA deploy + on-course testing | IN PROGRESS | Track 1D. Code-ready: `vite-plugin-pwa` (manifest, app-shell-only caching), `vercel.json` SPA rewrite, icon set generated, `.env.example` documents required vars. Remaining (user-side): push to GitHub, connect + configure Vercel project, set env vars in dashboard, install-to-homescreen + cellular test |
| Capacitor wrap (app stores, native GPS/camera) | LATER (deliberate) | Wider-audience phase |

## Player & bag profile (planned 2026-07-03)

| Feature | Status | Notes |
|---|---|---|
| Player profile expansion (throwing identity, calibration, goals) | SHIPPED | Phase A (Track 1A); sectioned `/profile` page (Identity/Throwing/Calibration/Goals), edit-in-place, first-login nudge, value+source pattern on calibration fields, injury_notes private-only |
| Disc molds reference table + locker migration | IN PROGRESS | Track 1B. Schema/migration/verification/seed scripts written + flight-number coalesce tested (Opus 4.8). Migration NOT yet executed — gated on user DB backup + dry-run approval. Live scraping rejected (JS/AJAX sources); curated bootstrap seed + manual entry instead. Locker/disc UI (`/bag/*`) still to build |
| Layouts first-class + round/course provenance + course_aliases | IN PROGRESS | Track 1.5. Schema/migration written alongside 1B (layouts table, holes/rounds → layout_id, external_source/ref on rounds+courses, course_aliases). Pending same migration execution. No UI this phase |
| Multiple bags + membership + flight chart | NEXT UP | Phase C / Track 1C; locker/bag split; partial unique index for default bag; `bag_id` FK on rounds |
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
| Confidence interval map (lock-in vs coin-flip zones) | SHIPPED | Track 2.1; `/practice/stats`, 10ft distance bands, zone classified from the Wilson interval (lock-in/developing/coin-flip) |
| Per-putt capture layer (tap entry, miss zones, timestamps, input_source) | NEXT UP | THE enabler: drills, diagnostics, pacing, voice, and future sensor inputs all feed one table |
| Gamified drills: JYLY, Around the World | NEXT UP | Regimen engine generalization (drill_type + rules_config jsonb) |
| Clutch simulator (randomized rest timers) | NEXT UP | Adopts TDD's 2-8min randomization; existing pressure scoring |
| Miss tendency diagnostics (9-zone heat grid) | NEXT UP | Manual-input version of TDD's CV impact clustering; 80% of insight, 2% of cost |
| Ghost pacing engine | BACKLOG | Elevated from LATER; TDD's HistoricalPacingProfile concept, manual-timestamp version |
| Voice callouts / Match Mode coaching | BACKLOG | Browser SpeechSynthesis; adopts TDD intervention-threshold rule (never coach off single events) |
| Acoustic make-detection prototype (Web Audio FFT) | BACKLOG | Experimental spike; success gate >90% agreement with manual entry outdoors |
| Tournament noise overlay (cognitive load training) | BACKLOG | Background audio loops; cheap once drills exist |

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
