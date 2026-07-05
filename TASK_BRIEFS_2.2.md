# Task Briefs — 2.2a / 2.2b / 2.2c

Run in order. Do not start 2.2c until the 2.2b spec is approved. /clear between sessions.

---

## 2.2a — Theme System (paste into Claude Code)

Recommended model: Sonnet 5. Consult DEVELOPMENT_PLAN.md § 2.2a and CLAUDE.md § Design system.

Implement the Sun-Drenched Topo (Oswald edition) design system app-wide:
1. Define all design tokens from CLAUDE.md as CSS variables in a single theme file; remove any hardcoded colors elsewhere in the app in favor of the variables.
2. Add Oswald from Google Fonts, self-hosted in the repo and preloaded so it works in the offline app shell; apply as the display/heading face with a sensible fallback stack.
3. Restyle every existing screen — bottom tab bar, practice menu, freeform log, regimen selection + run-through, history feed + details, confidence map, locker, bag views, disc detail, profile — onto the new palette. No pure black/white anywhere, no default platform grays/blues, borders 2px minimum, 80pt minimum tap targets on primary actions.
4. Verify contrast: text primary on all three background tokens must remain comfortably readable; flag anything that fails rather than silently adjusting token values (tokens are exact and fixed).
Test: visual pass on every route at mobile width; production build succeeds.
Session close per CLAUDE.md: push + confirm empty origin/main..main; DEVLOG + backlog updates.

---

## 2.2b — Per-Putt Capture Design Review (paste into Claude Code)

Recommended model: Opus 4.8. Consult DEVELOPMENT_PLAN.md § 2.2b fully. Do NOT build anything — output is a short approvable spec.

Draft and present, with reasoning:
1. putt_events schema: parent reference design (polymorphic type+id vs separate nullable FKs for regimen_run / freeform_session / round_hole) — recommend one with tradeoffs; columns: sequence, outcome, nullable miss_zone, distance_ft, occurred_at, input_source default 'manual', nullable round_hole_id; client-generated UUIDs for batch-retry idempotency.
2. The unified localStorage subsystem: InstantLaunchPayload (user profile defaults incl. favorite putter, smart prediction card state, quick-mod presets, crash_recovery_buffer) merged with the offline putt-event sync buffer. Define the structure, batch sync trigger points, retry policy, sync-status surfacing, and behavior when the app is killed mid-set with unsynced events.
3. FSM: BOOTSTRAP (synchronous local read <200ms) → ACTIVE_SESSION auto-resume when crash_recovery_buffer.has_active_session, else READY_DEFAULT with prediction card; READY_DEFAULT → ACTIVE_SESSION via 1-tap CTA; quick-tweak modal path. No network gating before the start button (TTFP <5s cold start).
4. Gesture engine constants: travel/velocity/cone/debounce as named tunable constants normalized for devicePixelRatio; document starting values (120px, 350ms, 45°, 400ms) and where tuning lives.
5. Confirm the data split rule: batch ribbon → summary tables only; putt_events exclusively from gesture mode; no backfill, no synthesized events. Diagnostic-mode toggle design: per-session opt-in, 9-zone quick tap after misses when enabled.
Wait for my approval of the spec before any implementation.

---

## 2.2c — Scoring Canvas Build (paste after approving the 2.2b spec)

Recommended model: Sonnet 5. Implement the approved 2.2b spec plus DEVELOPMENT_PLAN.md § 2.2c:
1. Schema (append-only file) applied via Supabase MCP and verified per session-close convention.
2. Instant-launch FSM + unified localStorage subsystem + crash-recovery resume.
3. Zoned canvas in the active session: context bar (stage X/Y, distance, volume, silence pill) / fluid gesture zone with make-territory growth (+5% per consecutive make, 60% cap) / batch quick-fill ribbon.
4. 3-gate swipe physics (up=make, down=miss +160px/400ms left=undo), long-press rapid fire (600ms hold, +1 make per 200ms), 400ms post-registration debounce, shockwave animation on accept + crimson-border flash on reject.
5. Batch ribbon: static grid for ≤10-putt stages; adaptive scrub carousel for 15-20 with CSS scroll-snap magnetic detents, smart-centering on historical average for the distance, 1.25x predictive anchor block, edge-pinned [0] and [MAX]; complementary auto-fill (misses = volume − makes); success feedback + 3s auto-advance.
6. Audio: Web Audio pitch-escalating make ladder (440→493→554Hz, low thud on miss resets ladder); SpeechSynthesis stage-completion announcement ("Stage cleared: X of Y. Move to Z feet."); silence pill toggles both instantly.
7. Haptics: Vibration API behind capability detection (Android), simplified patterns for make/miss/undo; silent no-op on iOS.
8. Session start flow: optional putter picker from locker; persist choice in InstantLaunchPayload defaults.
9. READY_DEFAULT smart-prediction card (last regimen, suggested next distance from history + progression rules, one-tap start) + quick-mod preset pills.
10. Diagnostic-mode toggle per spec.
Tests: airplane-mode a full set → reconnect → every event syncs exactly once (client UUIDs); TTFP measured on true cold start (killed PWA) on-device; gesture thresholds respond correctly at different devicePixelRatios (test desktop + phone).
Session close per CLAUDE.md convention.
