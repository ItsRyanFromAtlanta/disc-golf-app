# Lib & Hooks API Index

The exported API surface of `src/lib/` and `src/hooks/`, grouped by domain.

**This index exists to prevent reimplementation.** Before you write any new pure function or data
accessor — a flight-number derivation, a percentage, a streak, a filter, a Supabase fetch, a Dexie
read — **search this document first.** Most of what a screen needs already exists, is already
unit-tested, and already handles the edge case you are about to get wrong (null flight axes, zero
attempts, DST boundaries, offline fallback, idempotent replay). Writing a second copy is the single
most common failure mode in this codebase, and the duplicate always drifts.

## Scope and rules

- **Exported APIs only.** Module-internal helpers are deliberately absent. If a function is not in
  this index, it is not part of any module's contract — import the module's exported entry point
  instead of reaching for the internal, or the internal will be renamed out from under you.
- **`*.test.js` files are excluded** from the module map, but their existence populates the
  **Tested** column.
- **Code is ground truth.** Where an existing document disagrees with an export listed here, the
  code is right; the contradiction is logged in
  [`_corrections/lib-api-index.md`, now `CORRECTIONS_LEDGER.md`](CORRECTIONS_LEDGER.md), never fixed in place.
- **Link, never restate.** Design tokens live in `AGENTS.md` § Design system. Lifecycle, metric,
  shell, offline, and repository/transaction contracts live in `PHASE_A_ARCHITECTURE.md`. This
  index describes *what is callable*, not *what the architecture requires*.

## Column conventions

| Column | Meaning |
|---|---|
| **Signature** | `name(args) → return`. `→ Promise<T>` marks an async function or one that returns a promise. Params after `=` are defaults. |
| **Purity** | **Pure** = deterministic, no I/O, no ambient reads. Anything else names its impurity: `Supabase`, `Dexie`, `localStorage`, `Storage API`, `DOM`, `crypto`, `time` (reads `Date.now()`/`new Date()` without a threaded-in clock), `React`. |
| **Tested** | ✅ = covered by a `*.test.js`. `~` = partially covered or covered only indirectly through another module's test. `—` = no test. |

A **Pure** function is safe to call from a render, safe to unit-test with plain objects, and safe to
compose. An impure one is not — check the impurity marker before reaching for it in a component.

---

# 1. Disc domain

The single source of truth for what a disc *is*, how it flies, and how it is classified.

## `src/lib/discs.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `effectiveFlightNumbers` | `(disc, mold) → { speed, glide, turn, fade }` (each `number \| null`) | **The** flight-number accessor. Per-axis `disc.override_*` wins over `mold.{speed,glide,turn,fade}` via `??`, so a `0` override survives. | Pure | ✅ |
| `discIdsToUnsetForNewPrimary` | `(discs, targetDiscId) → string[]` | Ids of other `primary_putter` discs that must be demoted before promoting `targetDiscId` (partial unique index). | Pure | ✅ |
| `SITUATIONAL_ROLE_CAP` | `3` | App-side cap on `situational_weather` discs (no DB constraint backs it). | Pure const | ✅ |
| `situationalRoleCount` | `(discs, excludeDiscId = null) → number` | Count of `situational_weather` discs excluding one id. | Pure | ✅ |

## `src/lib/discFilters.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `speedClass` | `(speed) → 'putter' \| 'midrange' \| 'fairway' \| 'distance' \| null` | Speed banding (≤3 / ≤5 / ≤9 / 10+). `null` in → `null` out. | Pure | ✅ |
| `stabilityClass` | `(turnFadeSum) → 'understable' \| 'stable' \| 'overstable' \| null` | Stability banding from `turn + fade` (< −1 / ≤ 1 / > 1). | Pure | ✅ |
| `STABILITY_COLORS` | `{ understable, stable, overstable }` → CSS var strings | Swatch-only colors (border/fill, never text). | Pure const | ✅ |
| `stabilityColor` | `(cls) → string` | `STABILITY_COLORS` lookup with a `--color-text-secondary` fallback. | Pure | ✅ |
| `filterDiscs` | `(discs, { query, manufacturer, speedClass, stability, status }) → disc[]` | Filters on **effective** numbers (uses `disc.moldInfo`). `'all'` is a no-op for each facet. | Pure | ✅ |
| `sortDiscs` | `(discs, sortKey) → disc[]` | New array sorted by `'speed'` (desc), `'stability'` (asc, nulls last), or `'recent'` (default, `created_at` desc). | Pure | ✅ |

## `src/lib/flightCurve.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `flightPath` | `({ speed, glide, turn, fade }, { width = 200, height = 300 }) → string \| null` | SVG cubic-Bézier `d` path approximating a top-down flight. `null` if any axis is missing. Not a physics sim. | Pure | ✅ |
| `ODOMETER_ALERT_THRESHOLD` | `300` | Chain-hit count at which a wear step-down is proposed. | Pure const | ✅ |
| `proposeWearStepDown` | `(wearScore) → number` | `min(10, (wearScore ?? 1) + 1)`. | Pure | ✅ |
| `wearAdjustedFlightNumbers` | `(effective, wearScore) → { speed, glide, turn, fade }` | Applies beat-in drift: `turn` more negative, `fade` reduced. `wearScore == null` returns input unchanged. | Pure | ✅ |

## `src/lib/flightSpectrum.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `FLIGHT_SPECTRUM_MODES` | `{ CURRENT: 'current', OFFICIAL: 'official' }` | Mode enum. | Pure const | ✅ |
| `SPECTRUM_CLUSTER_THRESHOLD` | `{ speed: 0.75, stability: 0.75 }` | Cluster merge distance. | Pure const | ✅ |
| `spectrumFlightNumbers` | `(disc, mode = CURRENT) → { speed, glide, turn, fade }` | `OFFICIAL` = raw `disc.moldInfo`; `CURRENT` = effective + wear-adjusted. Non-finite coerced to `null`. | Pure | ✅ |
| `discSpectrumPoint` | `(disc, mode = CURRENT) → { id, type:'disc', x, y, numbers, disc, label, overriddenAxes, wearAdjusted } \| null` | Scatter point: `x` = speed, `y` = turn+fade. `null` when unplottable. | Pure | ✅ |
| `ghostSpectrumPoint` | `(slot) → { id, type:'ghost', x, y, label, slot } \| null` | Same point shape for a desired ghost slot. | Pure | ✅ |
| `clusterSpectrumPoints` | `(points, threshold = SPECTRUM_CLUSTER_THRESHOLD) → cluster[]` | Greedy clustering; each cluster is `{ id, x, y, members }` with running-mean centroid. | Pure | ✅ |
| `buildFlightSpectrum` | `(discs = [], ghostSlots = [], mode = CURRENT) → { mode, clusters, ghostPoints, missingDiscCount, capacityCount }` | Full spectrum view model. Filters ghost slots to active. | Pure | ✅ |

## `src/lib/discCompare.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `FLIGHT_AXES` | `['speed','glide','turn','fade']` | Canonical axis order. | Pure const | ✅ |
| `COMPARE_MIN` / `COMPARE_MAX` | `2` / `4` | Comparison tray bounds. | Pure const | ✅ |
| `NEAR_IDENTICAL_AXIS_DELTA` | `1` | Per-axis delta below which two discs are "near-identical". | Pure const | ✅ |
| `COMMUNITY_MIN_SAMPLE` | `10` | Minimum cohort sample size. | Pure const | ✅ |
| `COMPARISON_SOURCES` | `{ personal, official, community }` (each `{ id, label }`) | Comparison source registry. | Pure const | ✅ |
| `findNearIdenticalDiscPairs` | `(discs, threshold = 1, source = 'personal') → { discIds, deltas, maxDelta }[]` | Pairwise redundancy detection. Any missing axis disqualifies a pair. | Pure | ✅ |
| `buildDiscComparison` | `(discs, { source = 'personal' }) → { source, rows, extremes, nearIdenticalPairs }` | `rows[]` = `{ disc, discId, numbers }`; `extremes[axis]` = `{ min, max, minIds, maxIds }`. | Pure | ✅ |
| `resolveCommunityCohort` | `(candidates = [], minimumSample = 10) → { status:'ready'\|'unavailable', label, reason, candidate }` | Picks the largest eligible cohort or explains why none qualifies. | Pure | ✅ `discCompareCohorts.test.js` |
| `buildBagComparison` | `(discs, capacity = null) → { discCount, capacity, headroom, speedClasses, occupiedCells, missingFlightProfiles, nearIdenticalPairs }` | Bag-level rollup composing `resonanceComponents` + `buildDiscComparison`. | Pure | ✅ |

## `src/lib/discFlair.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DISC_TIERS` | `['common','rare','epic','legendary','archived']` | Ordered tier vocabulary. | Pure const | ✅ |
| `discTier` | `(disc = {}) → string` | Priority: archived status → highest cosmetic unlock → `primary_putter` (legendary) → `situational_weather` (epic) → `wear_score ≥ 7` (rare) → common. | Pure | ✅ |
| `discFlairSignal` | `(disc = {}) → string` | Human label for the tier line ("Primary putter", "Wear 7/10", …). | Pure | ✅ |

## `src/lib/discOdometer.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DISC_ODOMETER_METRICS` | `['throws','chain_hits','airballs']` | Valid metric keys. | Pure const | ✅ |
| `DISC_ODOMETER_LABELS` | `{ throws, chain_hits, airballs }` | Display labels. | Pure const | ✅ |
| `COSMETIC_TIER_THRESHOLDS` | `{ rare: 300, epic: 1000, legendary: 5000 }` | Chain-hit unlock thresholds. | Pure const | ✅ |
| `highestUnlockedTier` | `(unlocks = []) → 'common'\|'rare'\|'epic'\|'legendary'` | Accepts either tier strings or `{ tier }` rows. | Pure | ✅ |
| `nextCosmeticMilestone` | `(chainHits, unlocks = []) → { tier, threshold, remaining } \| null` | Next unlockable tier and distance to it. | Pure | ✅ |
| `validateOdometerInput` | `({ metric, delta, source='manual_entry', reason }) → { metric, delta, source, reason }` — **throws** | Non-zero integer ≤10 000; negatives require `manual_correction` + a reason. | Pure (throws) | ✅ |

## `src/lib/discPhotos.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DISC_PHOTO_BUCKET` | `'disc-private-photos'` | Supabase Storage bucket. | Pure const | ✅ |
| `DISC_PHOTO_SLOTS` | `['front','back','side']` | Valid slots. | Pure const | ✅ |
| `DISC_PHOTO_MAX_SOURCE_BYTES` | `15 MiB` | Upload input ceiling. | Pure const | ✅ |
| `DISC_PHOTO_MAX_DERIVATIVE_BYTES` | `5 MiB` | Compressed output ceiling. | Pure const | ✅ |
| `DISC_PHOTO_MAX_EDGE_PX` | `1600` | Longest-edge downscale target. | Pure const | ✅ |
| `DISC_PHOTO_WEBP_QUALITY` | `0.82` | WebP quality. | Pure const | ✅ |
| `DISC_PHOTO_SIGNED_URL_SECONDS` | `3600` | Signed-URL TTL. | Pure const | ✅ |
| `discPhotoStoragePath` | `(userId, discId, slot, photoId, extension='webp') → string` — **throws** on bad slot | `{userId}/{discId}/{slot}/{photoId}.{ext}`. | Pure | ✅ |
| `currentDiscPhotos` | `(rows) → rows[]` | Not superseded, not deleted. | Pure | ✅ |
| `recoverableDiscPhotos` | `(rows, now = Date.now()) → rows[]` | Deleted but still inside `recoverable_until`. | Pure (defaulted clock) | ✅ |
| `photoBySlot` | `(rows, slot) → row \| null` | Current photo for one slot. | Pure | ✅ |
| `validateDiscPhotoFile` | `(file) → void` — **throws** | MIME must be `image/*`, size ≤ 15 MB. | Pure | ✅ |
| `compressDiscPhoto` | `(file) → Promise<{ blob, width, height, mimeType, extension }>` | Canvas downscale → WebP. Throws if still >5 MB. | **DOM** (`createImageBitmap`, `<canvas>`) | ~ (validation only) |

## `src/lib/discProfile.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `buildDiscPerformance` | `({ puttEvents = [], roundHoles = [] }) → { putting: { makes, attempts, pct, interval }, rounds: { holesPlayed, averageScore, averageToPar, lastUsedAt } }` | Per-disc stats. `interval` is a Wilson interval only when `0 < attempts < 30`, else `null`. | Pure | ✅ |
| `buildDiscHistory` | `({ stateEvents, odometerEvents, lostFoundUpdates, photos }) → { id, type, at, title, detail }[]` | Merged, newest-first disc timeline across four sources. | Pure | ✅ |

## `src/lib/discTaxonomy.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `activeGhostSlots` | `(rows = []) → rows[]` | Rows with no `removed_at`. | Pure | ✅ |
| `activeShotTagAssignments` | `(rows = []) → rows[]` | Rows with no `removed_at`. | Pure | ✅ |
| `assignedShotTags` | `(tags = [], assignments = []) → tags[]` | Non-retired tags with an active assignment. | Pure | ✅ |
| `normalizeShotTag` | `(value) → string` | lowercase-kebab slug. | Pure | ✅ |

## `src/lib/wishlist.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `stabilityGaps` | `(discs, { limit = 3 }) → { speedClass, stabilityClass, exampleFlightNumbers }[]` | Ghost-slot suggestions: for each speed class the player carries `in_locker`, the stability classes with zero coverage. | Pure | ✅ |

## `src/lib/lostFound.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `LOST_FOUND_EVENT_LABELS` | `Record<eventType, label>` | Display labels for the 7 event types. | Pure const | ✅ |
| `LOST_FOUND_UPDATE_TYPES` | `['location_updated','sighting','contact_updated','note_added']` | Event types a user may append directly. | Pure const | ✅ |
| `discDisplayName` | `(disc) → string` | `nickname` → `moldInfo.mold_name` → `mold` → `'Unknown disc'`. | Pure | ✅ |
| `normalizeLostFoundFields` | `(fields = {}) → { courseId, areaText, latitude, longitude, notes, contactName, contactValue }` — **throws** | Trims, nulls empties, validates lat/lng range and pairing. | Pure | ✅ |
| `sortLostFoundCases` | `(cases) → cases[]` | Open cases first, then newest `latest_update_at`. New array. | Pure | ✅ |

---

# 2. Bags

## `src/lib/bags.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `bagIdsToUnsetForNewDefault` | `(bags, targetBagId) → string[]` | Other default bags to flip off first (partial unique index). | Pure | ✅ |
| `bagDisplayName` | `(bag, { external = false }) → string` | `'Main Bag'` for the default when `external`, else `bag.name`. | Pure | ✅ |
| `buildBagDraft` | `(bag, discIds = []) → { name, description, bagType, capacity, makeDefault, discIds }` | Row → editable draft. | Pure | ✅ |
| `bagDraftHasChanges` | `(bag, currentDiscIds, draft) → boolean` | Dirty check including set-equality on membership. | Pure | ✅ |
| `isVisibleInBagView` | `(disc) → boolean` | `status === 'in_locker'`. | Pure | ✅ |
| `bagViewDiscs` | `(discs) → discs[]` | Filter by `isVisibleInBagView`. | Pure | ✅ |
| `flightChartPoint` | `(disc, mold) → { x, y, disc, mold } \| null` | `x` = effective speed, `y` = turn+fade. `null` when unplottable. | Pure | ✅ |
| `flightChartPoints` | `(discsWithMolds) → point[]` | Maps `{ disc, mold }[]`, drops nulls. | Pure | ✅ |
| `capacityTier` | `(discCount, cap = 35) → 'ok' \| 'warn' \| 'full'` | 35-disc interlock; `warn` in the last 5 slots. | Pure | ✅ |

## `src/lib/bagHistory.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `previewBagRestore` | `({ currentDiscIds, snapshotDiscIds, availableDiscIds }) → { additions, removals, unavailable, targetDiscIds }` | Pure diff for a version restore. | Pure | ✅ |
| `latestBagVersion` | `(versions = []) → version \| null` | Row with the highest `version`. | Pure | ✅ |
| `describeRestoreDiscIds` | `(preview, discs = []) → { additions, removals, unavailable }` (each `{ id, label }[]`) | Labels a preview for display. | Pure | ✅ |

## `src/lib/bagResonance.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `RESONANCE_PRESETS` | `{ balanced, coverage, minimal }` (each `{ id, label, coverage, speedLadder, separation }`) | Weighting presets. | Pure const | ✅ |
| `resonanceComponents` | `(discs = []) → { coverage, speedLadder, separation, validDiscCount, missingDiscCount, occupiedCells, occupiedSpeedClasses, overlapPairs }` | 0–100 sub-scores plus supporting counts. | Pure | ✅ |
| `buildBagResonance` | `(discs = [], ghostSlots = [], presetId = 'balanced', capacity = 35) → { preset, components, overall, discCount, capacity, headroom, activeGapCount, ghostGapLabels }` | Weighted overall score + ghost-gap labels. Unknown preset falls back to `balanced`. | Pure | ✅ |

---

# 3. Practice, scoring, and drills

## `src/lib/regimenScoring.js` — the shipped scoring engine

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `isCleanSet` | `(makes, attempts) → boolean` | `attempts > 0 && makes === attempts`. | Pure | ✅ |
| `computeSetScore` | `(regimen, regimenSet, { makes, attempts, longestStreak, pressurePuttMade }) → { points, cleanSet }` | Streak-escalating base + flat makes + pressure multiplier + clean bonus, rounded to 2dp. **The** per-set score. | Pure | ✅ |
| `computeCompletionBonus` | `(regimen, allSetsCompleted) → number` | `regimen.completion_bonus` or `0`. | Pure | ✅ |
| `inferPressurePuttMade` | `(makes, attempts) → boolean` | Only clean sets infer `true`; every other mix conservatively returns `false` (documented simplification). | Pure | ✅ |

## `src/lib/routineBuilder.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DISTANCE_OPTIONS` | `[15, 20, 25, 33]` | Segmented-stepper distances (ft). | Pure const | ✅ |
| `PUTT_OPTIONS` | `[5, 10, 15, 20]` | Segmented-stepper putt counts. | Pure const | ✅ |
| `MAX_PUTTS` / `MAX_STAGES` | `100` / `20` | Hard interlocks (DB trigger backs `MAX_PUTTS`). | Pure const | ✅ |
| `SCORING_DEFAULTS` | `{ basePointsPerMake, streakStep, noMissBonusPct, completionBonus, pressureMultiplier }` | Knobs the engine actually reads. | Pure const | ✅ |
| `blankStage` | `() → { distanceFt: 20, putts: 10, pressure: false }` | New stage. | Pure | ✅ |
| `totalPutts` | `(stages) → number` | Sum of `putts`. | Pure | ✅ |
| `canAddStage` | `(stages) → boolean` | False at 20 stages or when duplicating the last stage would breach 100 putts. | Pure | ✅ |
| `estimateDifficulty` | `(stages) → 1..5` | Putt-weighted distance band, bumped for volume ≥60 and any pressure stage. | Pure | ✅ |
| `buildRegimenPayload` | `(userId, { name, stages, bonuses }) → { regimen, sets }` | Builder state → insertable `putting_regimens` + `putting_regimen_sets` rows. | Pure | ✅ |
| `maxScorePreview` | `({ stages, bonuses }) → number` | Perfect-run score via the real `computeSetScore` — preview and reality cannot drift. | Pure | ✅ |

## `src/lib/drillEngine.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DRILL_TYPES` | `{ FIXED_SET, CUSTOM, JYLY, AROUND_THE_WORLD, CLUTCH }` | Drill kind enum. | Pure const | ✅ |
| `drillKind` | `(regimen) → string` | `regimen.drill_type` or `fixed_set`. | Pure | ✅ |
| `validateDrillConfig` | `(regimen, sets) → { valid: true, kind } \| { valid: false, reason }` | Per-kind structural rules (JYLY = exactly 100 putts, ATW/Clutch = 1 rep per station, …). | Pure | ✅ |
| `scoreDrillStage` | `(regimen, stageResult, fallbackScore) → { points, cleanSet }` | Classic drills score `points = makes`; everything else defers to `fallbackScore()`. | Pure (calls the supplied thunk) | ✅ |
| `nextDrillStage` | `({ regimen, currentIndex, setCount, makes, attemptsSoFar }) → { completed, exhausted, nextIndex }` | Advance rules, including Around-the-World's step-back-on-miss and attempt ceiling. | Pure | ✅ |
| `drillGroupLabel` | `(regimen) → string` | Grouping header: "Classic drills" / "Custom routines" / "Scored regimens". | Pure | ✅ |

## `src/lib/scoringCanvas.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `WIND_SWAP_THRESHOLD_MPH` | `15` | Wind above which a backup swap is suggested. | Pure const | ✅ |
| `suggestBackupSwap` | `({ weatherCondition, windMph, discs, activePutterDiscId }) → disc \| null` | Rain or >15 mph → first non-active `backup_putter`. | Pure | ✅ |
| `stackPips` | `(volumePlanned, events, attemptsTotal, hasPressureLast = false) → { state, bonus }[]` | Pip states: real event outcome → `'filled'` (batch) → `'pending'`. Last pip flagged `bonus` for a pressure stage. | Pure | ✅ |

## `src/lib/clutchTimer.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `CLUTCH_MIN_REST_MS` / `CLUTCH_MAX_REST_MS` | `2 min` / `8 min` | Rest window bounds. | Pure const | ✅ |
| `createClutchDeadline` | `(nowMs, randomValue = Math.random()) → { dueAt: ISO string, durationMs }` | Randomized rest deadline; inject `randomValue` for determinism. | Pure when `randomValue` is supplied | ✅ |
| `clutchTimerState` | `(dueAt, nowMs) → { status: 'invalid'\|'resting'\|'putt_now', remainingMs }` | Countdown state. | Pure | ✅ |
| `formatClutchCountdown` | `(remainingMs) → 'M:SS'` | Ceiling-to-second countdown label. | Pure | ✅ |
| `requestClutchNotificationPermission` | `(notificationApi = globalThis.Notification) → Promise<'unsupported'\|'granted'\|'denied'\|'default'>` | Never re-prompts an already-decided permission. | **Notification API** | ✅ |
| `showClutchNotification` | `({ serviceWorker = navigator.serviceWorker }) → Promise<boolean>` | Fires the "Putt now" SW notification; `false` when unavailable/ungranted. | **SW + Notification API** | ✅ |

## `src/lib/fatigueCheckin.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `FATIGUE_TRAILING_MISS_COUNT` | `3` | Trailing misses that trigger a check-in. | Pure const | ✅ |
| `FATIGUE_STAGE_DROP_PCT` | `0.2` | Make-rate drop against the sampled baseline. | Pure const | ✅ |
| `FATIGUE_MIN_STAGE_ATTEMPTS` | `5` | Minimum attempts before a stage counts. | Pure const | ✅ |
| `fatigueCheckinTrigger` | `({ outcomes = [], stage, previousStages = [] }) → 'trailing_misses' \| 'stage_drop' \| null` | Stage-boundary check-in decision. | Pure | ✅ |

## `src/lib/ghostPacing.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `MIN_GHOST_PROFILE_EVENTS` | `5` | Minimum events for a historical ghost run. | Pure const | ✅ |
| `MIN_CURRENT_GHOST_EVENTS` | `3` | Minimum live events before comparing. | Pure const | ✅ |
| `buildHistoricalGhostProfile` | `(runs = [], events = [], minEvents = 5) → { sourceRunId, sourceScore, sourceCompletedAt, eventCount, durationMs, points } \| null` | Best completed run's normalized attempt/elapsed curve. | Pure | ✅ |
| `compareGhostPace` | `(currentEvents = [], profile, minCurrentEvents = 3) → { ready: false, currentAttempts, attemptsNeeded } \| { ready: true, currentAttempts, currentElapsedMs, attemptDelta, timeDeltaMs, makeDelta, ghostEventCount, sourceScore } \| null` | Live-vs-ghost pace delta. | Pure | ✅ |

## `src/lib/matchModeCoach.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `MATCH_MODE_MILESTONE_ATTEMPTS` | `5` | Milestone callout cadence. | Pure const | ✅ |
| `MATCH_MODE_PATTERN_MISSES` | `3` | Same-zone misses that trigger an intervention. | Pure const | ✅ |
| `MATCH_MODE_DROP_WINDOW` | `5` | Window size for drop detection. | Pure const | ✅ |
| `MATCH_MODE_DROP_THRESHOLD` | `0.30` | Make-rate drop that triggers an intervention. | Pure const | ✅ |
| `MATCH_MODE_INTERVENTION_COOLDOWN` | `5` | Attempts between interventions. | Pure const | ✅ |
| `evaluateMatchMode` | `({ events = [], lastSpokenAttempt = 0, lastInterventionAttempt = null, ghostComparison = null }) → { attempt, kind: 'miss_pattern'\|'sustained_drop'\|'milestone', intervention, message } \| null` | The whole coaching decision, one call. Returns `null` when nothing to say. | Pure | ✅ |

## `src/lib/playLaunch.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DEFAULT_QUICK_PLAY_DIFFICULTY` | `1` | Preferred fallback difficulty. | Pure const | ✅ |
| `resolveQuickPlayRegimen` | `(regimens = [], preferredRegimenId = null) → { regimen, reason: 'profile-default'\|'level-1'\|'lowest-system-level'\|'first-available'\|'unavailable' }` | Quick Play selection chain; skips archived regimens. | Pure | ✅ |
| `quickPlayOptions` | `(regimens = []) → regimens[]` | Launchable regimens, system-first then difficulty then name. | Pure | ✅ |

## `src/lib/rounds.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `roundTotal` | `(roundHoles = []) → number` | Sum of entered scores only. | Pure | ✅ |
| `parTotal` | `(holes = []) → number` | Sum of `par` across a layout. | Pure | ✅ |
| `relativeToPar` | `(roundHoles = [], holes = []) → number` | Score-to-par over **played** holes only (sparse cards report current position). Reads `roundHole.hole.par` or the `holes` lookup. | Pure | ✅ |
| `formatRelativeToPar` | `(value) → string` | `'E'`, `'+3'`, `'-2'`, or `'—'` for null. | Pure | ✅ |

## `src/lib/onboarding.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `GOAL_OPTIONS` | `{ id, label, description }[]` | Step-1 goal cards. | Pure const | ✅ |
| `PUTTER_BRANDS` | `['MVP','Axiom','Streamline']` | Seeded brands (real catalog manufacturers). | Pure const | ✅ |
| `DEFAULT_BRAND` / `DEFAULT_MOLD_NAME` | `'Axiom'` / `'Envy'` | Smart default putter. | Pure const | ✅ |
| `MIN_WEIGHT_GRAMS` / `MAX_WEIGHT_GRAMS` / `WEIGHT_STEP_GRAMS` / `DEFAULT_WEIGHT_GRAMS` | `150` / `180` / `1` / `174` | Weight stepper bounds. | Pure const | ✅ |
| `PRACTICE_STACK_BAG_NAME` | `'Practice Stack'` | Bag provisioned at Step 2. | Pure const | ✅ |
| `UNIT_OPTIONS` | `[{ value:'feet' }, { value:'meters' }]` | Step-3 unit choice. | Pure const | ✅ |
| `pickDefaultMold` | `(molds) → mold \| null` | Prefers `DEFAULT_MOLD_NAME`, else first result. | Pure | ✅ |
| `clampWeight` | `(grams) → number` | Clamp to 150–180. | Pure | ✅ |
| `needsOnboarding` | `(bags) → boolean` | Zero bags = never onboarded. | Pure | ✅ |
| `buildPutterDiscFields` | `({ moldId, manufacturer, moldName, weightGrams }) → discFields` | Insertable disc row with `role: 'primary_putter'`. | Pure | ✅ |

---

# 4. History, insights, and reports

## `src/lib/history.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `HISTORY_VISIBILITY` | `{ VISIBLE, HIDDEN, ALL }` | Visibility filter enum. | Pure const | ✅ |
| `RECENTLY_DELETED_DAYS` | `30` | Recently-deleted retention window. | Pure const | ✅ |
| `fetchHistory` | `(userId, { visibility = VISIBLE, now = new Date() }) → Promise<{ activities, sessions, runs }>` | One fetch for the feed, header strip, and insights. Hydrates the Dexie activity mirror and attaches `sync_state`; degrades to remote rows if IndexedDB is unavailable. | **Supabase + Dexie** | — |
| `metricEligibleHistory` | `({ activities, sessions, runs }) → { activities, sessions, runs }` | Narrows to `completed` + not hidden parents. **Every derived metric must pass through this.** | Pure | ✅ |
| `fetchPracticeInsights` | `(userId) → Promise<{ activities, sessions, runs, puttEvents, discs, experimentMarkers }>` | `fetchHistory` + metric filter + putt events + discs + experiment markers. | **Supabase + Dexie** | — |
| `sessionAggregate` | `(session) → { makes, attempts, minDistance, maxDistance }` | Freeform session rollup from `putt_distance_logs`. | Pure | ✅ |
| `regimenRunAggregate` | `(run) → { makes, attempts, cleanSets, totalSets, longestStreak }` | Regimen-run rollup from `putting_regimen_run_sets`. | Pure | ~ (via `activityHistoryEntries`) |
| `activityHistoryEntries` | `({ activities, sessions, runs }) → { type:'freeform'\|'regimen', id, at, activity, session\|run, aggregate }[]` | Newest-first feed rows joining lifecycle parents to their practice children. | Pure | ✅ |
| `allPuttSamples` | `({ sessions, runs }) → { makes, attempts, at }[]` | Flat time-series samples for form/cadence/volume. | Pure | ~ |
| `distanceSamples` | `({ sessions, runs }) → { distanceFeet, makes, attempts }[]` | Flat distance samples. Regimen sets use their range midpoint. | Pure | ~ |

## `src/lib/insights/` — statistics

`src/lib/insights/index.js` is a **re-export barrel** covering everything below except
`missTendency`'s and `putterComparison`'s neighbours; prefer `import { … } from '../lib/insights'`.

### `wilson.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `WILSON_MIN_N_FOR_HIDING` | `30` | Show the interval whenever `n < 30`. | Pure const | ✅ |
| `wilsonInterval` | `(makes, attempts, z = 1.96) → { lower, upper } \| null` | Wilson score interval, clamped to `[0,1]`. **Returns `null` when `attempts <= 0`** — callers must handle it. | Pure | ✅ |

### `activity.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `practiceStreak` | `(dates, now) → number` | **The** practice streak. Consecutive local days with ≥1 entry, counting back from today or yesterday (a streak breaks only after a full missed day). | Pure (clock threaded in) | ✅ |
| `volumeLedger` | `(samples, now) → { week, month, lifetime }` | Attempt totals; week starts Monday, local time. | Pure (clock threaded in) | ✅ |

### `confidenceMap.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DISTANCE_BAND_WIDTH_FT` | `10` | Canonical band width — reused by drop-off, miss tendency, and putter comparison. | Pure const | ✅ |
| `distanceBand` | `(distanceFeet, width = 10) → { start, end, label }` | Band bucketing (`'20-30ft'`). | Pure | ✅ |
| `LOCK_IN_LOWER_BOUND` | `0.7` | Lower-bound threshold for a "lock-in" zone. | Pure const | ✅ |
| `classifyZone` | `(lower, upper) → 'lock-in' \| 'coin-flip' \| 'developing'` | Zone from the **interval**, not the point estimate. | Pure | ✅ |
| `confidenceMap` | `(samples, width = 10) → { start, end, label, makes, attempts, makePct, interval, zone }[]` | Distance-banded confidence, ascending. Input is `distanceSamples()` shape. | Pure | ✅ |

### `form.js` · `cadence.js` · `fatigue.js` · `pressure.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DECAY_HALF_LIFE_DAYS` | `14` | Form decay half-life. | Pure const | ✅ |
| `decayWeightedForm` | `(samples, now, halfLifeDays = 14) → { currentFormPct, lifetimePct, lifetimeMakes, lifetimeAttempts }` | Exponentially weighted current form beside unweighted lifetime. | Pure (clock threaded in) | ✅ |
| `GAP_BUCKETS` | `['0-1','2-3','4-7','8+']` | Rest-gap buckets. | Pure const | ✅ |
| `cadenceFingerprint` | `(samples) → { byTimeOfDay, byGap }` (each `Record<key, { makes, attempts, makePct }>`) | Make % by time-of-day and by days since last practice day. | Pure | ✅ |
| `fatigueCurve` | `(runSets) → { setOrder, makes, attempts, makePct }[]` | Make % by `setOrder`, ascending. Input uses camelCase `setOrder`. | Pure | ✅ |
| `pressureDifferential` | `(runSets) → { pressurePct, regularPct, differential, pressureN, regularN }` | Clutch factor: pressure-putt make % minus regular make %. | Pure | ✅ |

### `pbs.js` · `dropOff.js` · `tags.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DISTANCE_PB_MIN_ATTEMPTS` | `10` | Attempts at a distance before a session can mint a distance PB. | Pure const | ✅ |
| `regimenPBRunIds` | `(runs) → Set<runId>` | Completed runs that beat every earlier run of the same regimen. Input is camelCase `{ id, completed, regimenId, totalScore, at }`. | Pure | ✅ |
| `distancePBSessionIds` | `(sessions) → Set<sessionId>` | Sessions that set a per-distance make-% PB. Input `{ id, at, logs: [{ distanceFeet, makes, attempts }] }`. | Pure | ✅ |
| `DROP_OFF_WARN_THRESHOLD_PCT` | `10` | Percentage-point drop that raises the ⚠ badge. | Pure const | ✅ |
| `distanceDropOff` | `(todaySamples, baselineSamples, width = 10) → { label, todayMakes, todayAttempts, todayPct, baselinePct, dropPct, warn }[]` | Only bands played today; no baseline → never warns. | Pure | ✅ |
| `STARTER_TAGS` | `string[]` | One-tap tag chips. | Pure const | ✅ |
| `normalizeTag` | `(raw) → string` | lowercase-kebab normalization for free-text tags. | Pure | ✅ |

### `putterBreakdown.js` · `putterComparison.js` · `missTendency.js` · `experimentComparison.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `putterBreakdown` | `(puttEvents) → { putterDiscId, makes, attempts, pct }[]` | Accuracy per physical disc, most attempts first. Real gesture events only. | Pure | ✅ |
| `PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS` | `10` | Minimum shared-band attempts for a distance-adjusted delta. | Pure const | ✅ |
| `putterComparison` | `(puttEvents = [], discs = [], width = 10) → { totalRealTimeAttempts, attributedAttempts, attributionCoverage, comparisonReady, rows }` | Head-to-head putter comparison with per-band Wilson intervals and a distance-adjusted delta. | Pure | ✅ |
| `MISS_TENDENCY_MIN_PATTERN_MISSES` | `3` | Misses in one zone before it counts as a pattern. | Pure const | ✅ |
| `missTendency` | `(puttEvents = [], width = 10) → { totalMisses, zonedMisses, captureCoverage, bands }` | 9-zone miss distribution per distance band with dominant-zone detection. | Pure | ✅ |
| `EXPERIMENT_MIN_SIDE_ATTEMPTS` | `10` | Attempts per side before a before/after verdict is `ready`. | Pure const | ✅ |
| `experimentComparison` | `(markers = [], puttEvents = [], discs = [], minAttempts = 10) → { totalRealTimeAttempts, attributedAttempts, attributionCoverage, experiments }` | Before/after each practice experiment marker, newest first. | Pure | ✅ |

### `nextSessionSuggestion.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `DEFAULT_STARTING_DISTANCE_FT` | `10` | Fallback with no history. | Pure const | ✅ |
| `mostRecentRegimenId` | `(runs) → string \| null` | Latest `started_at` run's `regimen_id`. Takes raw `fetchHistory().runs`. | Pure | ✅ |
| `suggestWarmupDistance` | `(bands) → number \| null` | Nearest `developing` band → nearest `coin-flip` → past the farthest `lock-in`. Input is `confidenceMap()` output. | Pure | ✅ |
| `suggestNextSession` | `(runs, distanceSamples, allSamples, now) → { lastRegimenId, suggestedDistanceFt, currentFormPct, computedAt }` | Composes `confidenceMap` + `decayWeightedForm`. Zero new queries. | Pure (clock threaded in) | ✅ |

## `src/lib/careerSummary.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `buildCareerSummary` | `({ sessions, runs, discs, puttEvents }) → { lifetime, sessionCount, axes, trustedPutter }` | Career radar: 5 scored axes (C1, C2, endurance, wind, bag balance) plus the most-trusted putter. | Pure | ✅ |

## `src/lib/weeklyReport.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `WEEKLY_REPORT_CALCULATION_VERSION` | `'weekly-report-v1'` | Stamped into every snapshot. | Pure const | ✅ |
| `zonedMidnightUtc` | `(dateString, timezone) → ISO string` | Local midnight → UTC instant, DST-safe (offset resolved twice). | Pure | ✅ |
| `latestCompletedWeekWindow` | `({ now = new Date(), timezone }) → { weekStart, weekEnd, windowStart, windowEnd, timezone }` | Last complete Monday–Sunday window in the user's zone. | Pure (clock defaulted) | ✅ |
| `buildWeeklyReportSnapshot` | `({ sessions, runs, rounds, weekStart, timezone, windowStart, windowEnd, version, sourceCutoff }) → snapshotRow` — **throws** on a non-Monday `weekStart` or an invalid window | Deterministic insertable snapshot: `sample_counts`, `metrics`, `highlights`. | Pure | ✅ |

## `src/lib/dashboardHero.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `heroCardState` | `(instantLaunchState, hasHistory, activeActivity = null) → { kind: 'crash-recovery'\|'active-activity'\|'resume-last'\|'no-target'\|'first-session', … }` | Zone-A hero priority chain. | Pure | ✅ |

---

# 5. Gamification

All of `src/lib/gamification/` is pure except `badgeEvaluatorService.js` and
`trophyRoom.fetchTrophyRoomData`. Covered by `gamification/gamification.test.js`.

## `xp.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `XP_LEVEL_BASE` / `XP_LEVEL_GROWTH` / `MAX_LEVEL` | `1000` / `1.15` / `50` | The whole economy derives from these. | Pure const | ✅ |
| `calculateXpForLevel` | `(level) → number` | Cost to go level → level+1: `round(1000 × 1.15^(level−1))`. | Pure | ✅ |
| `cumulativeXpForLevel` | `(level) → number` | Total XP to *reach* a level (level 1 = 0). | Pure | ✅ |
| `levelForXp` | `(totalXp) → number` | Level for a lifetime XP total, capped at 50. | Pure | ✅ |
| `xpProgressInLevel` | `(totalXp) → { level, intoLevel, levelSpan, toNext, pct }` | Everything the XP bar needs, one call. | Pure | ✅ |

## `constants.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `XP_PER_MAKE` / `XP_PER_CLEAN_STAGE` / `XP_PER_IMPORTED_PUTT` | `10` / `50` / `10` | Payout rates. | Pure const | ✅ |
| `IMPORT_XP_CAP` | `10000` | Retroactive import ceiling. | Pure const | ✅ |
| `BADGE_XP_BY_TIER` | `{ bronze:100, silver:300, gold:1000 }` | Badge unlock rewards. | Pure const | ✅ |
| `XP_SOURCE` | `{ REGIMEN_RUN, FREEFORM_SESSION, BADGE, IMPORT }` | `xp_events.source_type` vocabulary. | Pure const | ✅ |
| `badgeXpForTier` | `(tier) → number` | Tier lookup, `0` for unknown. | Pure | ✅ |

## `badgeCatalog.js` · `metrics.js` · `evaluateBadges.js` · `playerStats.js` · `celebration.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `BADGE_CATALOG` | `{ code, name, tier, icon, description, criteria }[]` | The 25 badge definitions — single source of truth for the DB seed, the evaluator, and the UI. | Pure const | ✅ |
| `BADGE_ICONS` | `Record<code, emoji>` | Derived from the catalog. | Pure const | ✅ |
| `BADGE_BY_CODE` | `Record<code, definition>` | Derived from the catalog. | Pure const | ✅ |
| `METRICS` | `Record<metricKey, (stats, params) => number>` | The 17 badge metric readers over a PlayerStats snapshot. | Pure const | ✅ |
| `metricValue` | `(stats, criteria) → number` — **throws** on unknown metric | Evaluate one badge's criteria. | Pure | ✅ |
| `evaluateBadges` | `({ stats, badges, progressByBadgeId, now }) → { progressUpdates, newlyEarned, xpEvents, errors }` | The whole badge pass, no I/O. Already-earned badges are skipped; a malformed badge is isolated into `errors`. | Pure | ✅ |
| `buildPlayerStats` | `({ sessions, runs, discs }, now) → PlayerStats` | Fetched rows → the snapshot `METRICS` reads. Reuses `distanceSamples`/`practiceStreak`/`regimenPBRunIds`/`isCleanSet`. Counts from **summary** tables, never `putt_events`. | Pure (clock threaded in) | ✅ |
| `celebrationEventsFor` | `({ leveledUp, newLevel, newlyEarned = [] }) → { message }[]` | Award result → celebration banners. Empty array = render nothing. | Pure | ✅ |

## `trophyRoom.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `TROPHY_FILTERS` | `['all','unlocked','in_progress','locked']` | Filter-bar vocabulary. | Pure const | ✅ |
| `buildBadgeViewModels` | `(badges, progressRows) → viewModel[]` | Merges DB badges with user progress into `{ id, code, name, description, tier, icon, criteria, progress, earnedAt, status }`. | Pure | ✅ |
| `activePursuits` | `(viewModels, count = 3) → viewModel[]` | Closest-to-unlocking in-progress badges. | Pure | ✅ |
| `filterCounts` | `(viewModels) → { all, unlocked, in_progress, locked }` | Chip counts. | Pure | ✅ |
| `applyFilter` | `(viewModels, filter) → viewModel[]` | Status filter. | Pure | ✅ |
| `pursuitDistanceFor` | `(criteria) → number \| null` | Preconfigured drill distance from badge criteria; `null` for streak/inventory badges. | Pure | ✅ |
| `fetchTrophyRoomData` | `(userId) → Promise<{ profile, badges, progressRows, ledger }>` | Everything the Trophy Room page needs, one shot (30-day XP ledger window). | **Supabase + time** | — |

## `badgeEvaluatorService.js` — the only impure gamification module

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `fetchGamificationData` | `(userId) → Promise<{ sessions, runs, discs }>` | Practice + inventory fetch shaped to match `fetchHistory` so `distanceSamples` works unchanged. | **Supabase** | — |
| `evaluateAndPersistBadges` | `(userId, now = new Date()) → Promise<{ newlyEarned, xpAfter }>` | Runs the pure pass and persists diffs via the `upsert_badge_progress` / `append_xp_event` / `set_profile_level` RPCs. Safely re-runnable. | **Supabase RPC** | — |
| `awardPostSession` | `({ userId, sourceType, sourceRef, makes, cleanStages, now }) → Promise<{ newlyEarned, previousLevel, newLevel, leveledUp, xpAfter }>` | The single call every save path makes when a session ends. Idempotent by `sourceRef`. | **Supabase RPC** | — |

---

# 6. Activity lifecycle and metric registry

Contract: `PHASE_A_ARCHITECTURE.md` §§ 1–5. This section lists the callable surface only.

## `src/lib/activityLifecycle/` (barrel: `index.js` re-exports all three files)

### `types.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `ACTIVITY_STATES` | `{ DRAFT, ACTIVE, PAUSED, COMPLETED, INCOMPLETE }` | State enum. | Pure const | ✅ |
| `ACTIVITY_TYPES` | `{ PUTTING_FREEFORM, PUTTING_REGIMEN, DISC_GOLF_ROUND, PUTTING_GAME, FIELDWORK, COURSE_PRACTICE, LEAGUE_MATCH }` | Type enum. | Pure const | ✅ |
| `LIFECYCLE_COMMANDS` | `{ START, PAUSE, RESUME, FINALIZE_COMPLETED, MARK_INCOMPLETE }` | Command enum. | Pure const | ✅ |
| `ACTIVITY_SOURCES` | 9 provenance values (`live_capture` … `admin_repair`) | Source enum. | Pure const | ✅ |
| `ACTIVITY_STATE_REASONS` | 10 reason codes | Reason enum. | Pure const | ✅ |
| `CURRENT_ACTIVITY_STATES` / `TERMINAL_ACTIVITY_STATES` / `PRACTICE_ACTIVITY_TYPES` | frozen arrays | Grouped state/type sets. | Pure const | ✅ |
| `isCurrentActivityState` | `(state) → boolean` | active or paused. | Pure | ✅ |
| `isTerminalActivityState` | `(state) → boolean` | completed or incomplete. | Pure | ✅ |
| `isPracticeActivityType` | `(type) → boolean` | Any of the 5 practice types. | Pure | ✅ |
| `isRoundActivityType` | `(type) → boolean` | Round or league match. | Pure | ✅ |

### `reducer.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `LIFECYCLE_ERROR_CODES` | `{ INVALID_ACTIVITY, INVALID_COMMAND, INVALID_TRANSITION, STATE_CONFLICT, VERSION_CONFLICT }` | Error code enum. | Pure const | ✅ |
| `LifecycleTransitionError` | `class(code, message, details)` | Thrown by the reducer; carries `code` + `details`. | Pure | ✅ |
| `LIFECYCLE_TRANSITION_TABLE` | `Record<state, Record<command, nextState \| null>>` | `null` = already satisfied (idempotent); missing = invalid. | Pure const | ✅ |
| `createDraftLifecycle` | `({ id, type }) → { id, type, state:'draft', version:0 }` — **throws** | Validated draft seed. | Pure | ✅ |
| `reduceActivityLifecycle` | `(activity, command) → { outcome:'applied'\|'idempotent', activity, stateEvent }` — **throws** | The lifecycle reducer. Enforces `expectedState`/`expectedVersion` optimistic concurrency and builds the append-only state event. | Pure | ✅ |
| `planActivityStart` | `({ existingActivity, replacementActivity }) → { kind, closeExisting, closeExistingOnConfirm?, requiresConfirmation }` — **throws** | Single-current-activity replacement policy (rounds need confirmation; practice replaces silently). | Pure | ✅ |

### `policies.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `BACKGROUND_AUTO_PAUSE_GRACE_MS` | `60_000` | Background grace before auto-pause. | Pure const | ✅ |
| `MEANINGFUL_DRAFT_RETENTION_DAYS` | `7` | Draft retention. | Pure const | ✅ |
| `RECENTLY_DELETED_VISIBILITY_DAYS` | `30` | Recently-deleted window. | Pure const | ✅ |
| `shouldAutoPause` | `({ backgroundedAtMs, nowMs }) → boolean` | Grace elapsed. | Pure | ✅ |
| `canUndoReplacement` | `({ replacementHasMeaningfulFact }) → boolean` | Undo only before the first meaningful fact. | Pure | ✅ |

## `src/lib/metrics/registry.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `METRIC_REGISTRY_VERSION` | `1` | Registry version. | Pure const | ✅ |
| `METRIC_CAPTURE_REQUIREMENTS` | `{ SUMMARY_ADEQUATE, ORDERED_EVENTS_REQUIRED }` | Capture-requirement enum. | Pure const | ✅ |
| `METRIC_DEFINITIONS` | `Record<metricKey, definition>` for `practice.volume`, `putting.make_pct`, `putting.fatigue_curve`, `putting.pressure_differential`, `putting.miss_tendency` | Windows, minimum samples, confidence rule, exclusions, accepted sources, required inputs. | Pure const | ✅ |
| `metricDefinition` | `(key) → definition \| null` | Lookup. | Pure | ✅ |
| `isMetricEligibleActivity` | `(activity) → boolean` | Terminal + not hidden + has a meaningful fact. | Pure | ✅ |
| `filterMetricEligibleActivities` | `(activities) → activities[]` | Array form. | Pure | ✅ |
| `sourceIsAccepted` | `(metricKey, source) → boolean` | Provenance gate. | Pure | ✅ |
| `summariesAreAdequate` | `(metricKey) → boolean` | Whether summary rows suffice (vs ordered events). | Pure | ✅ |

---

# 7. InstantLaunch — live capture subsystem

The shipped offline layer for active-session capture: a `localStorage` blob plus an idempotent outbox.
`stateReducer.js` holds every pure transition; `storage.js` is the only module that touches
`localStorage`. See `AGENTS.md` § Offline architecture.

## `stateReducer.js` — pure transitions over the persisted blob

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `INSTANT_LAUNCH_SCHEMA_VERSION` | `4` | Current blob schema version. | Pure const | ✅ |
| `defaultInstantLaunchState` | `() → state` | Full default shape: `profileDefaults`, `smartPredictionCard`, `crashRecoveryBuffer`, `outbox`. | Pure | ✅ |
| `migrateOrResetState` | `(rawParsed) → state` | Migrates v1–v4 preserving recovery snapshots and pending writes; anything else resets. | Pure | ✅ |
| `applySetProfileDefaults` | `(state, partial) → state` | Merge profile defaults. | Pure | ✅ |
| `applySetSmartPredictionCard` | `(state, card) → state` | Merge the prediction card. | Pure | ✅ |
| `applySetCrashRecoveryBuffer` | `(state, buffer) → state` | Merge the crash-recovery buffer. | Pure | ✅ |
| `applyAppendGhostCurrentEvent` / `applyRemoveGhostCurrentEvent` | `(state, event \| eventId) → state` | Ghost-pacing diagnostic events (append no-ops without a profile). | Pure | ✅ |
| `applyAppendCoachingEvent` / `applyRemoveCoachingEvent` | `(state, event \| eventId) → state` | Match Mode diagnostic events (append no-ops when disabled). | Pure | ✅ |
| `applyMarkCoachingCallout` | `(state, { attempt, intervention }) → state` | Advance callout cursors. | Pure | ✅ |
| `applyClearCrashRecoveryBuffer` | `(state) → state` | Reset the buffer to defaults. | Pure | ✅ |
| `applyEnqueueParentWrite` / `applyEnqueueSummaryWrite` / `applyEnqueuePuttEvent` | `(state, row) → state` | Outbox enqueues. | Pure | ✅ |
| `applyDequeueOutboxEntries` | `(state, { parentIds, summaryWriteIds, puttEventIds }) → state` | Remove confirmed-synced rows by client id. | Pure | ✅ |
| `applyRemovePendingPuttEvent` | `(state, eventId) → state` | Undo path for a not-yet-synced putt event. | Pure | ✅ |

## `storage.js` · `sessionReducer.js` · `fsm.js` · `backoff.js` · `errorClassification.js` · `installationId.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `readInstantLaunchState` | `() → state` | Read + migrate; falls back to defaults on any throw. | **localStorage** | — |
| `writeInstantLaunchState` | `(state) → void` | Persist; swallows quota/private-mode errors. | **localStorage** | — |
| `updateInstantLaunchState` | `(applyFn, ...args) → state` | Read-modify-write in one step; returns the new state. | **localStorage** | — |
| `initialSessionState` | `(stage) → { stage, events, consecutiveMakes, longestStreak, tally, nextSequence }` | In-memory state for the current stage (not itself persisted). | Pure | ✅ |
| `makeTerritoryPct` | `(consecutiveMakes, config = GESTURE_CONFIG) → number` | Make-zone growth fraction, capped. | Pure | ✅ |
| `sessionReducer` | `(state, action) → state` | Actions: `GESTURE_MAKE`, `GESTURE_MISS`, `UNDO`, `BATCH_COMPLETE`. UNDO restores the exact pre-event streak. Batch fills touch the tally only — never `events`. | Pure | ✅ |
| `FSM_STATES` | `{ BOOTSTRAP, READY_DEFAULT, ACTIVE_SESSION }` | Launch FSM states. | Pure const | ✅ |
| `initialFsmState` | `() → { status: 'BOOTSTRAP' }` | Seed. | Pure | ✅ |
| `resolveBootstrapState` | `(crashRecoveryBuffer) → FSM_STATES` | Where to land after the synchronous bootstrap read. | Pure | ✅ |
| `fsmReducer` | `(state, action) → state` | `START_SESSION` / `RESUME_SESSION` / `END_SESSION`. | Pure | ✅ |
| `nextBackoffDelayMs` | `(attempt, { baseMs = 2000, capMs = 60000 }) → number` | Exponential backoff, 0-based attempt. **The** retry delay — used by every sync adapter. | Pure | ✅ |
| `isPermanentError` | `(error) → boolean` | Postgres `23505/23514/23503/22P02` or HTTP 4xx ⇒ never retry. | Pure | ✅ |
| `INSTALLATION_ID_STORAGE_KEY` | `'discgolf.installationId.v1'` | Storage key. | Pure const | ✅ |
| `getInstallationId` | `(storage = localStorage) → string` | Stable per-installation diagnostic id; memory fallback in private mode. Never an identity token. | **localStorage + crypto** | ✅ |
| `resetInstallationIdForTests` | `() → void` | Clears the memo. Test-only. | Impure (module state) | ✅ |

## `crashRecovery.js` · `activityBridge.js` · `syncScheduler.js` · `supabaseSync.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `routeSessionTypeFromPath` | `(pathname) → { sessionType: 'freeform'\|'regimen'\|null, regimenId? }` | Parses the two session-hosting routes. | Pure | ✅ |
| `resolveCrashRecoveryRedirect` | `(crashRecoveryBuffer, currentRoute) → path \| null` | Redirect target to resume a buffered session, or `null`. Deliberately does **not** yank a user off a non-session page. | Pure | ✅ |
| `INSTANT_LAUNCH_ACTIVITY_WARNINGS` | `{ MISSING_PARENT_ID, UNSUPPORTED_SESSION_TYPE, TERMINAL_ACTIVITY }` | Bridge warning codes. | Pure const | ✅ |
| `activityTypeForSessionType` | `(sessionType) → ACTIVITY_TYPES value \| null` | `'freeform'`/`'regimen'` → lifecycle type. | Pure | ✅ |
| `activityIdForCrashRecoveryBuffer` | `(buffer) → string \| null` | Reuses the existing parent UUID as the activity id. | Pure | ✅ |
| `attachActivityMirror` | `(instantLaunchState, activityId) → state` | Writes `activityId` into the buffer. | Pure | ✅ |
| `mirrorInstantLaunchActivity` | `({ repository, instantLaunchState, userId, occurredAt, recordedAt, installationId, source }) → Promise<{ instantLaunchState, activity, outcome, warnings }>` | Creates/starts the lifecycle mirror for a live session. `outcome ∈ no_active_session \| not_mirrored \| confirmation_required \| mirrored`. | **Repository (Dexie)** | ✅ |
| `SYNC_STATUS` | `{ SYNCED, PENDING, SYNCING, ERROR_RETRYING, FAILED }` | `FAILED` is terminal — needs a manual retry. | Pure const | ✅ |
| `createSyncScheduler` | `({ flush, onStatusChange }) → { start, stop, notifyOutboxChanged, retry }` | Orchestrates *when* to flush (online + visibility events, backoff). Agnostic about *what*. Not unit-testable in this repo's node test env. | **window/document + timers** | ~ (via `a10Equivalence.test.js`) |
| `syncRows` | `(table, rows) → Promise<{ succeededIds, permanentFailureIds }>` | Generic outbox row executor: `_op:'insert'` upserts with `ignoreDuplicates`, `_op:'update'` plain-updates. | **Supabase** | — |
| `deleteRowById` | `(table, id) → Promise<void>` | Undo-after-sync fallback. | **Supabase** | — |

---

# 8. Gesture engine

| Export | Module | Signature | Description | Purity | Tested |
|---|---|---|---|---|---|
| `GESTURE_CONFIG` | `config.js` | `{ TRAVEL_PX, REJECT_MIN_TRAVEL_PX, VELOCITY_MS, CONE_DEGREES, DEBOUNCE_MS, UNDO_TRAVEL_PX, UNDO_VELOCITY_MS, LONG_PRESS_MS, RAPID_FIRE_INTERVAL_MS, ZONE_GROWTH_PER_MAKE_PCT, ZONE_GROWTH_CAP_PCT }` | Named tunable thresholds in CSS px / ms. | Pure const | ~ |
| `MISS_ZONES` | `missZones.js` | `{ id: 1..9, row, col, label }[]` | The shared 9-zone grid. Ids are persisted in `putt_events.miss_zone` — **never renumber.** | Pure const | ~ |
| `gestureAngleDegrees` | `classify.js` | `(dx, dy) → 0..360` | 0° = up, 90° = right. | Pure | ✅ |
| `isWithinCone` | `classify.js` | `(angleDeg, targetDeg, coneHalfAngleDeg) → boolean` | Shortest angular distance. | Pure | ✅ |
| `gestureTravelPx` | `classify.js` | `(samples) → number` | First-to-last displacement. | Pure | ✅ |
| `gestureDurationMs` | `classify.js` | `(samples) → number` | First-to-last time. | Pure | ✅ |
| `rapidFireTickCount` | `classify.js` | `(elapsedMs, config = GESTURE_CONFIG) → number` | Ticks that *should* have fired by now — diff against emitted count to survive timer drift. | Pure | ✅ |
| `classifyGesture` | `classify.js` | `(samples, config = GESTURE_CONFIG) → { type: 'make'\|'miss'\|'undo'\|'rejected'\|'none' }` | Samples are `{ x, y, t }` from `PointerEvent.clientX/clientY/timeStamp`. `'rejected'` = real attempt that missed the gate; `'none'` = incidental touch. | Pure | ✅ |

---

# 9. Data access layer

> **The repository/transaction contract — local-first writes, the ordered outbox, dependency keys,
> poison rows, and idempotency — is defined in `PHASE_A_ARCHITECTURE.md` § 14 (*Repository and
> transaction contract*). Read it before writing any new repository. This section only maps which
> module talks to which backend.**

## Who talks to what

| Backend | Modules |
|---|---|
| **Supabase only** (no local mirror) | `supabaseClient.js`, `profile.js`, `regimens.js`, `roundLog.js`, `discLocker.js`, `history.js` (reads; hydrates the Dexie activity mirror as a side effect), `gamification/badgeEvaluatorService.js`, `gamification/trophyRoom.fetchTrophyRoomData`, `repository/careerRepository.js`, `repository/ghostPacingRepository.js`, `repository/dataExportRepository.js`, `instantLaunch/supabaseSync.js` |
| **Dexie only** (no network) | `db/dexieDb.js`, `repository/activityRepository.js`, `repository/activityOutbox.js`, `repository/historyRecoveryOutbox.js`, `repository/notificationRepository.js`, `notificationProducers.js` |
| **Both** (remote-first, local fallback / local-first write-through) | `repository/catalogRepository.js`, `repository/regimenRepository.js`, `repository/goalRepository.js`, `repository/settingsRepository.js`, `repository/weeklyReportRepository.js`, `repository/fatigueCheckinRepository.js`, `repository/roundRepository.js`, `repository/bagHistoryRepository.js`, `repository/lostFoundRepository.js`, `repository/discOdometerRepository.js`, `repository/discPhotoRepository.js`, `repository/discTaxonomyRepository.js`, `repository/discProfileRepository.js` |
| **Sync adapters** (drain a Dexie outbox into Supabase RPCs) | `repository/activitySync.js`, `repository/historyRecoverySync.js`, `repository/notificationSync.js` |
| **localStorage** | `instantLaunch/storage.js`, `instantLaunch/installationId.js`, `viewPreference.js`, `localPurge.js` (purges) |
| **Browser Storage API** | `storagePersistence.js` |

**Abstractions, from most to least general:**

1. `offlineFirstRepository.js` — framework-free primitives (`readThroughCache`, `writeThrough`,
   `flushOutbox`). Works against any object exposing the Dexie `Table` subset. **Start here** for a
   new simple entity.
2. `createRepository.js` — TanStack Query wrapper over those primitives; produces
   `useList`/`useCreate`/`useUpdate`/`useRemove` hooks. `discRepository.js` is the reference instance.
3. `activityRepository.js` — the lifecycle repository. Transactional Dexie writes coupled to an
   append-only event log and an ordered, dependency-aware outbox with idempotency replay. Anything
   touching activity state goes through this, never through raw Dexie.
4. Bespoke per-entity repositories (odometer, photos, lost & found, …) — remote-first reads with a
   local fallback and their own outbox tables, for entities whose write path needs a Supabase RPC.

## `src/lib/supabaseClient.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `supabase` | `SupabaseClient` | The single client. Throws at import time if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing — which is why pure modules must never import it. `persistSession` + `autoRefreshToken` are pinned on. | **Network + env** | — |

## `src/lib/db/dexieDb.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `AppDatabase` | `class extends Dexie` | Schema versions 1→14. Cache tables + the shared `outbox` (`++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]`) plus per-feature outboxes. | **IndexedDB** | ✅ |
| `createAppDatabase` | `(name) → AppDatabase` | Named instance — use this in tests with `fake-indexeddb`. | **IndexedDB** | ✅ |
| `db` | `AppDatabase` | The app-wide singleton (`'DiscGolfAppDB'`). | **IndexedDB** | ✅ |

## `src/lib/repository/offlineFirstRepository.js` — the primitives

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `readThroughCache` | `(cacheTable, fetchRemote) → Promise<rows[]>` | Remote read → mirror into cache **and prune rows absent remotely**; on failure return the cache, or rethrow if empty. | **Table I/O** | ✅ |
| `writeThrough` | `({ outboxTable, entityName, op, payload, remoteFn }) → Promise<result>` | Queue **before** the remote call so a dropped connection leaves a durable retry; delete on success; rethrow on failure with the entry still queued. | **Table I/O** | ✅ |
| `flushOutbox` | `({ outboxTable, entityName, remoteFns }) → Promise<void>` | Replays queued mutations for one entity; failures stay queued. | **Table I/O** | ✅ |

## `src/lib/repository/createRepository.js` / `discRepository.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `createRepository` | `({ entityName, cacheTable, fetchRemote, createRemote, updateRemote, removeRemote }) → { useList, useCreate?, useUpdate?, useRemove? }` | One call per entity. Only the hooks whose remote fn was supplied are exposed. `useCreate` mints a stable `clientId` per mount so a retried create upserts. | **React + Dexie + network** | — |
| `useDiscList` | `(userId) → UseQueryResult<disc[]>` | Offline-first disc locker list. | **React hook** | — |
| `useCreateDisc` | `() → UseMutationResult` | `mutate({ userId, fields })`. | **React hook** | — |
| `useUpdateDisc` | `(userId) → UseMutationResult` | `mutate({ userId, discId, fields })`. No `useRemove` — discs use a status lifecycle. | **React hook** | — |

## `src/lib/repository/activityRepository.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `ACTIVITY_OUTBOX_TABLE` | `'activity_lifecycle'` | Re-exported from `activityOutbox.js`. | Pure const | ✅ |
| `ACTIVITY_REPOSITORY_ERROR_CODES` | `{ ACTIVITY_NOT_FOUND, ACTIVITY_ID_CONFLICT, IDEMPOTENCY_KEY_CONFLICT, INVALID_MUTATION, INVALID_ACTIVITY_STATE, SINGLE_ACTIVE_INVARIANT }` | Error codes. | Pure const | ✅ |
| `ActivityRepositoryError` | `class(code, message, details)` | Thrown by every method below. | Pure | ✅ |
| `createActivityRepository` | `({ database = db, eventIdFactory, auditIdFactory, faultInjector }) → repository` | Factory. `faultInjector(stage, ctx)` exists for crash-consistency tests. | **Dexie** | ✅ |
| `activityRepository` | repository singleton | The app-wide instance. | **Dexie** | ✅ |

**Repository methods** (all `→ Promise<{ outcome, activity, stateEvent \| auditEvent, replacedActivity?, syncState, warnings }>` unless noted). `outcome ∈ 'applied' \| 'idempotent' \| 'confirmation_required'`; `syncState ∈ 'synced' \| 'pending' \| 'local' \| 'needs_attention'`.

| Method | Signature | Description |
|---|---|---|
| `createDraft` | `({ id, userId, type, mutation, metadata })` | Creates a draft + outbox `create_draft`. Retries must reuse the original idempotency key. |
| `start` | `(activityId, mutation, { confirmRoundReplacement = false })` | Enforces the single-current-activity invariant via `planActivityStart`; may close a replaced practice activity or return `confirmation_required` for a round. |
| `pause` / `resume` / `finalize` / `markIncomplete` | `(activityId, mutation)` | Lifecycle transitions through `reduceActivityLifecycle`. |
| `hide` / `restore` | `(activityId, mutation)` | History visibility. Requires a terminal activity and `mutation.expectedVersion`; writes an audit event + history outbox row. |
| `correctPracticeDetails` | `(activityId, { previousNotes, previousTags, notes, tags }, mutation)` | Notes/tags correction on a finalized, visible practice activity. Requires `source: 'manual_correction'`. |
| `hydrateActivities` | `(remoteRows) → Promise<void>` | Merges remote rows into Dexie without clobbering pending local writes. |
| `getActive` | `(userId) → Promise<activity \| null>` | The one active/paused activity; throws `SINGLE_ACTIVE_INVARIANT` if there are two. |
| `getById` | `(activityId) → Promise<activity \| null>` | Local lookup. |
| `listHistory` | `(userId, { includeHidden = false }) → Promise<activity[]>` | Terminal activities, newest `updated_at` first. |
| `listHistoryWithSync` | `(userId, { includeHidden }) → Promise<activity[]>` | Same, each row annotated with `sync_state`. |
| `subscribeToActive` | `(userId, listener, onError) → Subscription` | Dexie `liveQuery` subscription. |

## Outboxes and sync adapters

| Export | Module | Signature | Description | Purity | Tested |
|---|---|---|---|---|---|
| `ACTIVITY_OUTBOX_TABLE` | `activityOutbox.js` | `'activity_lifecycle'` | Outbox discriminator. | Pure const | ~ |
| `createActivityOutbox` | `activityOutbox.js` | `({ database }) → { listReady, recordFailure, acknowledge }` | `listReady(nowMs)` honours poison flags, `nextRetryAt`, and `dependencyKey` ordering. | **Dexie** | ~ |
| `HISTORY_RECOVERY_OUTBOX_TABLE` | `historyRecoveryOutbox.js` | `'activity_history'` | Outbox discriminator. | Pure const | ~ |
| `createHistoryRecoveryOutbox` | `historyRecoveryOutbox.js` | `({ database }) → { rows, listReady, recordFailure, acknowledge, retryPoisoned }` | Adds `retryPoisoned()` — the manual "Retry sync" path. | **Dexie** | ~ |
| `isPermanentActivitySyncError` | `activitySync.js` | `(error) → boolean` | `isPermanentError` plus 11 lifecycle RPC error messages. | Pure | ✅ |
| `activityCreateRpcArgs` / `activityTransitionRpcArgs` | `activitySync.js` | `(row) → rpcArgs` | Outbox row → `activity_create_draft` / `activity_transition` RPC args. | Pure | ✅ |
| `createActivitySyncAdapter` | `activitySync.js` | `({ database, client, outbox }) → { flush(nowMs) → Promise<{ hasPending, error, permanentFailureIds }> }` | Drains lifecycle rows in dependency waves; classifies permanent vs transient, poisons the permanent ones. | **Supabase + Dexie** | ✅ |
| `isPermanentHistoryRecoveryError` | `historyRecoverySync.js` | `(error) → boolean` | Same shape, 8 history RPC error messages. | Pure | ✅ |
| `visibilityRpcArgs` / `correctionRpcArgs` | `historyRecoverySync.js` | `(row) → rpcArgs` | Args for `activity_set_visibility` / `activity_correct_practice_details`. | Pure | ✅ |
| `createHistoryRecoverySyncAdapter` | `historyRecoverySync.js` | `({ database, client, outbox, lifecycleSync }) → { flush, retryPoisoned }` | Flushes the lifecycle outbox **first** and refuses to proceed while it has work — history mutations depend on their parent. | **Supabase + Dexie** | ✅ |
| `createNotificationSyncAdapter` | `notificationSync.js` | `({ database, client }) → { pull(userId), flush() }` | `notification_upsert` / `notification_set_status` RPCs. | **Supabase + Dexie** | — |

## Entity repositories

| Export | Module | Signature | Description | Purity | Tested |
|---|---|---|---|---|---|
| `CATALOG_QUERY_KEY` | `catalogRepository.js` | `['catalog','snapshot']` | TanStack key. | Pure const | ✅ |
| `fetchCatalogRemote` | `catalogRepository.js` | `() → Promise<snapshot>` | Six catalog tables in parallel. | **Supabase** | ✅ |
| `cacheCatalogSnapshot` / `readCachedCatalog` | `catalogRepository.js` | `(database, snapshot?) → Promise<…>` | Replace-all cache write / read. | **Dexie** | ✅ |
| `hydrateCatalog` | `catalogRepository.js` | `(snapshot) → snapshot & { molds: mold[] with plastics + runs + stamps }` | Denormalizes the snapshot into the browse shape. | Pure | ✅ |
| `readCatalog` | `catalogRepository.js` | `({ database, fetchRemote }) → Promise<catalog>` | Remote-first, cache fallback. | **Supabase + Dexie** | ✅ |
| `filterCatalogMolds` | `catalogRepository.js` | `(catalog, { query = '', manufacturer, category }) → mold[]` | **The mold search.** Approved molds only, all-terms match, ≤20 results. *(Replaces the long-removed `discLocker.searchMolds` — see `_corrections/`.)* | Pure | ✅ |
| `useCatalog` | `catalogRepository.js` | `() → UseQueryResult<catalog>` | Offline-first catalog hook. | **React hook** | ✅ |
| `createRegimenRepository` / `regimenRepository` | `regimenRepository.js` | `({ database, fetchListRemote, fetchOneRemote }) → { list(userId), getWithSets(regimenId, userId) }` | Remote-first with a Dexie fallback; prunes stale regimens/sets; enforces ownership. | **Supabase + Dexie** | ✅ |
| `createGoalRepository` / `goalRepository` | `goalRepository.js` | `({ database, client }) → { list(userId), create({ type, targetValue, unit, startsOn, targetDate }), transition(goal, nextStatus) }` | Writes go through the `goal_create` / `goal_transition` RPCs (optimistic-version checked). | **Supabase + Dexie** | ✅ |
| `createSettingsRepository` / `settingsRepository` | `settingsRepository.js` | `({ database, client }) → { listNotificationPreferences(userId), setNotificationPreference(userId, category, optionalEnabled) }` | Preference mirror. | **Supabase + Dexie** | — |
| `createWeeklyReportRepository` / `weeklyReportRepository` | `weeklyReportRepository.js` | `({ database, client }) → { list(userId), generate(userId, { now }) }` | `generate` resolves the timezone, builds the pure snapshot, and inserts a new immutable version (one retry on unique-violation). | **Supabase + Dexie** | ✅ |
| `createFatigueCheckinRepository` / `fatigueCheckinRepository` | `fatigueCheckinRepository.js` | `({ database, client }) → { record(checkin), listForParent({ puttSessionId, regimenRunId }) }` | Local-first; `record` returns `sync_state: 'pending' \| 'synced'`. | **Supabase + Dexie** | ✅ |
| `NOTIFICATION_OUTBOX_TABLE` | `notificationRepository.js` | `'notifications'` | Outbox discriminator. | Pure const | ✅ |
| `createNotificationRepository` / `notificationRepository` | `notificationRepository.js` | `({ database }) → { upsert(notification), setStatus(id, status), observe(userId, listener), list(userId), badgeCount(userId, now) }` | Dexie-only; `upsert` honours preferences (non-critical only) and dedupes by `dedupe_key`. | **Dexie** | ✅ |
| `EXPORT_PAGE_SIZE` | `dataExportRepository.js` | `500` | Page size. | Pure const | ✅ |
| `createDataExportRepository` / `dataExportRepository` | `dataExportRepository.js` | `({ client }) → { collectUserExport(userId) → Promise<Record<table, { rows, scope, minimumColumns }>> }` | Paginated collection of ~40 owner tables plus referenced shared rows. | **Supabase** | ✅ |
| `fetchCareerData` | `careerRepository.js` | `(userId) → Promise<{ profile, sessions, runs, discs, puttEvents }>` | One-shot fetch feeding `buildCareerSummary`. | **Supabase** | — |
| `fetchGhostPacingProfile` | `ghostPacingRepository.js` | `(userId, regimenId) → Promise<ghostProfile \| null>` | Visible completed runs + their events → `buildHistoricalGhostProfile`. | **Supabase** | — |
| `loadDiscProfileContext` | `discProfileRepository.js` | `(discId) → Promise<{ performance, history }>` | Composes putts, round holes, state events, odometer, photos, lost & found. | **Supabase + Dexie** | — |
| `fetchBagVersions` / `loadBagVersions` | `bagHistoryRepository.js` | `(bagId) → Promise<version[]>` | Remote fetch + cache / cache-fallback read. | **Supabase + Dexie** | — |
| `captureBagVersion` / `restoreBagVersion` / `groupedSaveBag` / `deleteBagWithReplacement` | `bagHistoryRepository.js` | `(…, { idempotencyKey = crypto.randomUUID() }) → Promise<…>` | `capture_bag_version` / `restore_bag_version` / `grouped_save_bag` / `delete_bag_with_replacement` RPCs. | **Supabase RPC** | — |
| `recordDiscOdometerEvent` | `discOdometerRepository.js` | `({ userId, discId, metric, delta, source, reason, occurredAt, sourceRef, metadata }) → Promise<{ event, disc, unlocks, queued }>` | Validates, writes optimistically, syncs via `record_disc_odometer_event`; `queued: true` when offline. | **Supabase + Dexie** | ✅ |
| `flushDiscOdometerOutbox` / `loadDiscOdometer` | `discOdometerRepository.js` | `(userId) / (discId) → Promise<…>` | Outbox drain / `{ events, unlocks }` read with local fallback. | **Supabase + Dexie** | ✅ |
| `loadDiscPhotos` / `signedDiscPhotoUrl` / `queueDiscPhotoUpload` / `flushDiscPhotoUploads` / `deleteDiscPhoto` / `restoreDiscPhoto` | `discPhotoRepository.js` | see source | Photo lifecycle over Supabase Storage + the `register_disc_photo` / `delete_disc_photo` / `restore_disc_photo` RPCs. `queueDiscPhotoUpload` returns `{ photo, queued }`. | **Supabase + Storage + Dexie** | — |
| `loadGhostSlots` / `addGhostSlot` / `removeGhostSlot` / `loadDiscShotTags` / `createShotTag` / `assignShotTag` / `removeShotTagAssignment` | `discTaxonomyRepository.js` | see source | Ghost slots and shot tags; soft-remove via `removed_at`. | **Supabase + Dexie** | — |
| `openLostFoundCase` / `appendLostFoundUpdate` | `lostFoundRepository.js` | `({ userId, discId \| caseId, eventType, ...fields }) → Promise<{ caseId, queued }>` | Optimistic local write + `open_lost_found_case` / `append_lost_found_update` RPCs. | **Supabase + Dexie** | — |
| `flushLostFoundOutbox` / `loadLostFoundCases` | `lostFoundRepository.js` | `(userId) → Promise<…>` | Outbox drain / `{ cases, updates }` with pending rows merged in. | **Supabase + Dexie** | — |
| `finalizeRoundActivity` | `roundRepository.js` | `(roundId, userId) → Promise<activity>` | Finalizes the round's lifecycle parent, then flushes. | **Dexie + Supabase** | — |
| `loadRound` | `roundRepository.js` | `(roundId, userId) → Promise<round>` | Remote fetch + cache, local fallback. | **Supabase + Dexie** | — |
| `useRoundList` / `useCreateRound` / `useUpdateRound` | `roundRepository.js` | React Query hooks | `useCreateRound` captures a bag version and creates the lifecycle parent before the round insert (FK order). Errors carry `error.localResult` so callers can navigate to the optimistic row. | **React hook** | — |
| `saveRoundHole` | `roundRepository.js` | `(input) → Promise<roundHole>` | Queued upsert of one scorecard cell. | **Supabase + Dexie** | — |
| `flushRoundOutbox` | `roundRepository.js` | `(userId) → Promise<void>` | Replays queued round/hole writes after the lifecycle outbox drains. | **Supabase + Dexie** | — |

## Supabase-direct modules (pre-repository, still valid)

| Export | Module | Signature | Description | Purity | Tested |
|---|---|---|---|---|---|
| `fetchProfile` | `profile.js` | `(userId) → Promise<profile \| null>` | `select('*')` — safe only because it is always RLS-scoped to the caller. A shared/social view must use an explicit column list excluding `injury_notes`. | **Supabase** | — |
| `upsertProfileFields` | `profile.js` | `(userId, fields) → Promise<profile>` | Upsert on `id`. | **Supabase** | — |
| `isThrowingProfileEmpty` | `profile.js` | `(profile) → boolean` | Gate for the throwing-profile prompt. | Pure | — |
| `fetchUserDiscs` / `fetchDisc` | `discLocker.js` | `(userId) / (discId) → Promise<…>` | Disc rows with `moldInfo:disc_molds(*)` and `cosmeticUnlocks`. | **Supabase** | — |
| `upsertDisc` | `discLocker.js` | `(userId, discId, fields) → Promise<disc>` | Update by id, upsert on a client id, or insert. | **Supabase** | — |
| `buildDiscCopies` | `discLocker.js` | `(userId, fields, quantity, idFactory) → discPayload[]` — **throws** outside 1–10 | Pure payload builder for bulk duplication. | Pure | ✅ |
| `createDiscCopies` | `discLocker.js` | `(userId, fields, quantity) → Promise<disc[]>` | All-or-nothing bulk upsert. | **Supabase** | — |
| `updateDiscRole` | `discLocker.js` | `(discs, discId, role) → Promise<disc>` — **throws** past `SITUATIONAL_ROLE_CAP` | Demotes the old primary first (`discIdsToUnsetForNewPrimary`). | **Supabase** | — |
| `updateDiscWear` | `discLocker.js` | `(discId, wearScore) → Promise<disc>` | Wear slider write. | **Supabase** | — |
| `fetchBags` / `createBag` / `updateBag` / `deleteBag` | `discLocker.js` | see source | Bag CRUD. | **Supabase** | — |
| `setDefaultBag` | `discLocker.js` | `(bags, targetBagId) → Promise<void>` | Unsets other defaults first (`bagIdsToUnsetForNewDefault`). | **Supabase** | — |
| `fetchBagDiscs` | `discLocker.js` | `(bagId) → Promise<disc[]>` | Membership join, each row carrying `membershipId`. | **Supabase** | — |
| `fetchDiscBagIds` | `discLocker.js` | `(discId) → Promise<string[]>` | Which bags contain a disc. | **Supabase** | — |
| `addDiscToBag` / `removeDiscFromBag` | `discLocker.js` | `(bagId, discId) → Promise<void>` | Membership change **plus an automatic `captureBagVersion`**. | **Supabase** | — |
| `fetchRegimensWithSets` | `regimens.js` | `() → Promise<{ regimens, sets }>` | All regimens ordered by difficulty, with ordered sets. | **Supabase** | — |
| `createCustomRegimen` | `regimens.js` | `(userId, { regimen, sets }) → Promise<regimenId>` | Inserts parent then sets; archives the orphan and rewrites the 100-putt error if the sets insert fails. | **Supabase** | — |
| ~~`fetchCustomRegimens`~~ | — | — | **Deleted 2026-07-31.** Had no caller. `regimenRepository.list()` plus `RegimenSelectPage`'s `selectableRegimens` already produce the same own/non-archived set, and wiring this in would have regressed offline behaviour — it was a direct Supabase read with no Dexie mirror. | — | — |
| `fetchRegimenWithSets` | `regimens.js` | `(regimenId) → Promise<{ regimen, sets }>` | Clone-and-tweak source. | **Supabase** | — |
| `fetchRounds` | `roundLog.js` | `(userId) → Promise<round[]>` | Rounds hydrated with `course` and `layout`. | **Supabase** | — |
| `fetchRound` | `roundLog.js` | `(roundId) → Promise<round>` | Round + course + layout + `holes` + `round_holes` each joined to `hole` and `disc`. | **Supabase** | — |
| `createRound` / `updateRound` | `roundLog.js` | `(userId, fields) / (roundId, fields) → Promise<round>` | Whitelisted-column write, then re-fetch the hydrated round. | **Supabase** | — |
| `upsertRoundHole` | `roundLog.js` | `(input) → Promise<roundHole>` — **throws** without round/hole ids | Normalizes camelCase or snake_case input. | **Supabase** | — |
| `fetchCourses` / `fetchCourse` | `roundLog.js` | `() / (courseId) → Promise<…>` | Course directory / course with layouts and their holes. | **Supabase** | — |
| `createCourseWithLayout` | `roundLog.js` | `({ userId, name, location, holes }) → Promise<course>` — **throws** on empty name/holes | Course + "Main" layout + holes. | **Supabase** | — |
| `fetchLayoutHoles` | `roundLog.js` | `(layoutId) → Promise<hole[]>` | Ordered holes for a layout. | **Supabase** | — |

---

# 10. Navigation and route metadata

## `src/lib/routeMetadata.js` — the route contract

UI-framework-free. `docs/ui/TEMPLATE.md` requires every screen document's identity block to be pulled
mechanically from here.

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `SHELL_TYPES` | `{ NONE: 'none', STANDARD: 'standard', ACTIVE: 'active' }` | Shell kind enum. | Pure const | ✅ |
| `LEGACY_ROUTE_ALIASES` | `{ '/regimens': '/practice/regimens' }` | Legacy → canonical path map. | Pure const | ✅ |
| `resolveCanonicalPath` | `(pathname) → string` | Alias resolution. | Pure | ✅ |
| `resolveRouteMetadata` | `(pathname) → { id, match, section, shell, title, showActivityPill, preserveNestedState, scrollKey, pathname, isLegacyAlias } \| null` | Longest-specific-first regex match across 30 app routes + 3 public routes. `null` = unknown route. | Pure | ✅ |
| `resolveSectionRoot` | `(section) → '/practice' \| '/bag' \| '/courses' \| '/profile' \| null` | Tab root for a section. | Pure | ✅ |

## `src/lib/navigation.js` · `src/lib/tabNavigation.js`

| Export | Signature | Description | Purity | Tested |
|---|---|---|---|---|
| `resolveActiveTab` | `(tabs, pathname) → tab \| null` | Longest-prefix match, so `/practice/stats` does not light up both PLAY and STATS. | Pure | ✅ |
| `TAB_PRESS_ACTIONS` | `{ NAVIGATE, SCROLL_TO_TOP, RETURN_TO_ROOT }` | Tab-press outcome enum. | Pure const | ✅ |
| `resolveTabPressAction` | `({ isTargetActive, isAtTop, hasRequestedTop }) → TAB_PRESS_ACTIONS value` | Framework-free tap semantics; a second tap after a top request returns to the section root even mid-smooth-scroll. | Pure | ✅ |

---

# 11. Notifications and goals

| Export | Module | Signature | Description | Purity | Tested |
|---|---|---|---|---|---|
| `NOTIFICATION_CATEGORIES` | `notifications.js` | `{ ACTIVITY:'activity', SYNC:'sync' }` | Categories currently produced. | Pure const | ✅ |
| `NOTIFICATION_PRIORITIES` | `notifications.js` | `{ ACTIONABLE, CRITICAL, INFO }` | Priority enum. | Pure const | ✅ |
| `isExpired` | `notifications.js` | `(notification, now = Date.now()) → boolean` | Past `expires_at`. | Pure | ✅ |
| `isBadgeEligible` | `notifications.js` | `(notification, now = Date.now()) → boolean` | Unresolved, unexpired, actionable-or-critical. **The** badge-count predicate. | Pure | ✅ |
| `notificationDestination` | `notifications.js` | `(notification) → path \| null` | Action type + payload → in-app route. | Pure | ✅ |
| `dedupeNotifications` | `notifications.js` | `(existing, incoming) → notification[]` | Merges onto an unresolved row with the same `dedupe_key`, preserving `id`/`created_at`/`read_at`. | Pure | ✅ |
| `NOTIFICATION_PREFERENCE_CATEGORIES` | `notificationPreferences.js` | `{ id, label, description }[]` (7 categories) | Settings rows. Note: broader than `NOTIFICATION_CATEGORIES`, which lists only what is produced today. | Pure const | ✅ |
| `preferenceMap` | `notificationPreferences.js` | `(rows = []) → Map<category, boolean>` | Row list → lookup. | Pure | ✅ |
| `isOptionalNotificationEnabled` | `notificationPreferences.js` | `(rows, category) → boolean` | **Defaults to `true`** when no row exists. | Pure | ✅ |
| `isValidIanaTimezone` | `notificationPreferences.js` | `(value) → boolean` | `Intl` round-trip check. | Pure | ✅ |
| `produceActivityReviewNotifications` | `notificationProducers.js` | `({ userId, database, repository }) → Promise<notification[]>` | One actionable notification per visible incomplete activity. | **Dexie + crypto + time** | — |
| `produceSyncAttentionNotification` | `notificationProducers.js` | `({ userId, database, repository }) → Promise<notification \| null>` | One critical notification when the outbox has poisoned rows. | **Dexie + crypto + time** | — |
| `GOAL_TYPES` | `goals.js` | `{ TARGET_RATING, PRACTICE_FREQUENCY, PUTTING_VOLUME, CONSISTENCY }` | Goal type enum. | Pure const | ✅ |
| `GOAL_STATUSES` | `goals.js` | `{ ACTIVE, PAUSED, COMPLETED, CANCELLED }` | Status enum. | Pure const | ✅ |
| `GOAL_DEFINITIONS` | `goals.js` | `{ type, label, unit, suffix }[]` | Per-type display metadata. | Pure const | ✅ |
| `canTransitionGoal` | `goals.js` | `(from, to) → boolean` | Terminal statuses have no outgoing edges. | Pure | ✅ |
| `transitionGoal` | `goals.js` | `(goal, nextStatus, occurredAt) → goal` — **throws** `invalid_goal_transition` | Bumps `version` and stamps the matching timestamp column. | Pure | ✅ |
| `goalProgress` | `goals.js` | `(currentValue, targetValue) → 0..1 \| null` | `null` for non-finite input or a non-positive target. | Pure | ✅ |
| `availableGoalActions` | `goals.js` | `(status) → string[]` | Legal next statuses. | Pure | ✅ |

---

# 12. Platform, storage, privacy, and export

| Export | Module | Signature | Description | Purity | Tested |
|---|---|---|---|---|---|
| `isIosLike` | `platform.js` | `({ userAgent, platform, maxTouchPoints }) → boolean` | Handles iPadOS desktop-mode (`MacIntel` + touch). | Pure | ✅ |
| `isStandaloneDisplay` | `platform.js` | `({ displayModeStandalone, navigatorStandalone }) → boolean` | Home-screen install detection. | Pure | ✅ |
| `oauthRedirectLeavesApp` | `platform.js` | `({ ios, standalone }) → boolean` | An installed iOS PWA cannot reliably complete OAuth — steer to the email code. | Pure | ✅ |
| `readPlatformContext` | `platform.js` | `(nav = navigator, win = window) → { ios, standalone, oauthLeavesApp }` | The only global-reading wrapper. | **navigator/window** | ✅ |
| `PERSISTENCE_UNSUPPORTED` / `_GRANTED` / `_DENIED` / `_FAILED` | `storagePersistence.js` | string constants | Result states. | Pure const | ✅ |
| `supportsPersistence` | `storagePersistence.js` | `(storage) → boolean` | Capability check. | Pure | ✅ |
| `requestPersistentStorage` | `storagePersistence.js` | `(storage = navigator.storage) → Promise<{ state, persisted, error? }>` | Never re-prompts once granted; never throws. | **Storage API** | ✅ |
| `getViewMode` / `setViewMode` | `viewPreference.js` | `() → 'grid'\|'list'` / `(mode) → void` | Locker layout preference. Swallows private-mode throws. | **localStorage** | — |
| `getFlairMode` / `setFlairMode` | `viewPreference.js` | `() → boolean` / `(enabled) → void` | Flair toggle. | **localStorage** | — |
| `PURGEABLE_LOCAL_STORAGE_KEYS` | `localPurge.js` | 4 keys | Every key the app writes must appear here or be deliberately excluded. | Pure const | ✅ |
| `selectPurgeableKeys` | `localPurge.js` | `(existingKeys = []) → string[]` | Exact match plus the `discgolf.` prefix; leaves unrelated origin keys alone. | Pure | ✅ |
| `purgeLocalStorage` | `localPurge.js` | `(storage) → string[]` | Removes them; one failure never aborts the rest. | **localStorage** | ✅ |
| `purgeLocalDatabase` | `localPurge.js` | `(database) → Promise<boolean>` | Closes and **drops** the Dexie DB (safer than clearing tables). | **IndexedDB** | ✅ |
| `purgeDeviceData` | `localPurge.js` | `({ storage, database }) → Promise<{ removedKeys, databaseDeleted }>` | Post-account-deletion device purge. | **localStorage + IndexedDB** | ✅ |
| `DATA_EXPORT_FORMAT_VERSION` | `dataExport.js` | `1` | Manifest format version. | Pure const | ✅ |
| `csvCell` | `dataExport.js` | `(value) → string` | Always-quoted cell; objects serialized with sorted keys; leading `=+-@` prefixed with `'` (formula-injection safe). | Pure | ✅ |
| `orderedColumns` | `dataExport.js` | `(rows, minimumColumns = ['id']) → string[]` | Deterministic column order (`id`, `user_id`, then alphabetical). | Pure | ✅ |
| `rowsToCsv` | `dataExport.js` | `(rows, minimumColumns) → { columns, csv }` | BOM + CRLF, rows sorted by id. | Pure | ✅ |
| `createExportFiles` | `dataExport.js` | `({ userId, datasets, generatedAt }) → Record<filename, contents>` | `data/*.csv` + `manifest.json` + `README.txt`. | Pure (clock defaulted) | ✅ |
| `buildDataExportArchive` | `dataExport.js` | `(options) → Promise<Uint8Array>` | Zips the file set (fflate). | Pure (async) | ✅ |
| `dataExportFilename` | `dataExport.js` | `(generatedAt = now) → string` | `disc-golf-manager-export-YYYY-MM-DD.zip`. | Pure (clock defaulted) | ✅ |
| `downloadDataExport` | `dataExport.js` | `(bytes, filename, { urlApi, documentApi }) → void` | Object-URL download; APIs injectable for tests. | **DOM** | ✅ |

---

# 13. `src/hooks/`

No hook has a unit test — this repo's vitest config has no jsdom. Hooks are deliberately thin: the
decision logic lives in the pure modules above and is tested there. **If you need logic from a hook,
import the pure function it wraps, not the hook.**

| Hook | Signature | Description | Wraps |
|---|---|---|---|
| `useActiveActivity` | `(userId) → activity \| null` | Dexie `liveQuery` subscription to the current activity; `null` on error or no user. | `activityRepository.subscribeToActive` |
| `useActivityNavigationLifecycle` | `(userId, activeActivity) → void` | Pauses on leaving an ACTIVE-shell route, resumes on entering one. No-ops unless the crash buffer says a session is live. | `routeMetadata`, `activityRepository.pause/resume` |
| `useCrashRecoveryRedirect` | `() → void` | Once per app load, redirects a relaunched PWA back to its buffered session. | `resolveCrashRecoveryRedirect`, `routeSessionTypeFromPath` |
| `useOnboardingGate` | `() → void` | Once per app load, sends a user with zero bags to `/onboarding`. Fails open on a fetch error. | `fetchBags`, `needsOnboarding` |
| `useGesturePointer` | `(zoneRef, callbacks, config = GESTURE_CONFIG) → void` | Wires pointer events on a DOM node to the classifier. `callbacks`: `{ onMake, onMiss, onUndo, onRejected }`. Long-press rapid-fire is not debounced; swipes are. | `classifyGesture`, `rapidFireTickCount` |
| `usePuttHaptics` | `() → { supported, vibrateMake, vibrateMiss, vibrateUndo }` | `navigator.vibrate` patterns; silently no-ops on iOS Safari. | — |
| `usePuttAudio` | `() → { playMake, playMiss, announceStage, speakCallout, setSilenced }` | Web Audio make-ladder + miss thud + SpeechSynthesis. Declares an iOS `playback` audio session and resumes a backgrounded context. | — |
| `useWakeLock` | `(active) → { supported, held }` | Screen wake lock during capture; re-acquires on visibility change. | — |
| `useNotifications` | `(userId) → { notifications, badgeCount }` | Runs the producers, flushes + pulls, then subscribes to the local mirror. | `notificationRepository`, `notificationProducers`, `isBadgeEligible` |
| `useHistoryRecovery` | `() → { syncStatus, hide, restore, correctPracticeDetails, retrySync }` | History hide/restore/correct plus a sync scheduler over the history-recovery outbox. | `activityRepository`, `createHistoryRecoverySyncAdapter`, `createSyncScheduler` |
| `useInstantLaunchSession` | `(writeAdapter, userId) → sessionApi` | The live-capture orchestrator: FSM + localStorage subsystem + sync scheduler + lifecycle mirroring, generic across freeform and regimen pages. | all of `instantLaunch/`, `activityRepository` |

**`useInstantLaunchSession` returned API**

State: `fsmStatus`, `sessionState`, `profileDefaults`, `smartPredictionCard`, `activeRegimenSnapshot`,
`ghostProfile`, `ghostCurrentEvents`, `matchModeEnabled`, `coachingEvents`,
`coachingLastSpokenAttempt`, `coachingLastInterventionAttempt`, `parentIds`, `syncStatus`.

Actions:

| Action | Signature |
|---|---|
| `startSession` | `({ sessionType, parentIds, activeRegimenSnapshot, ghostProfile, matchModeEnabled, initialStage, parentWriteRow })` |
| `gestureMake` | `(occurredAt, distanceFt, putterDiscId = null, isPressure = false)` |
| `gestureMiss` | `(occurredAt, distanceFt, missZone = null, putterDiscId = null, isPressure = false)` |
| `undo` | `()` |
| `batchComplete` | `(makes, attempts)` |
| `advanceStage` | `(nextStage, summaryRowBuilder)` |
| `endSession` | `(summaryRowBuilder, parentUpdateRow)` |
| `updateProfileDefaults` | `(partial)` |
| `updateSmartPredictionCard` | `(card)` |
| `markCoachingCallout` | `(callout)` |
| `retrySync` | `()` |

`writeAdapter` must provide `syncParentWrites(rows)`, `syncSummaryWrites(rows)`,
`syncPuttEvents(rows)` (each `→ Promise<{ succeededIds, permanentFailureIds }>`) and
`deletePuttEvent(id) → Promise<void>`.

---

# 14. Intent lookup — "I need to…"

| I need to… | Use | Module |
|---|---|---|
| get a disc's **flight numbers** | `effectiveFlightNumbers(disc, mold)` | `lib/discs.js` |
| get flight numbers **including wear** | `spectrumFlightNumbers(disc)` or `wearAdjustedFlightNumbers(effective, wear)` | `lib/flightSpectrum.js`, `lib/flightCurve.js` |
| draw a **flight curve** | `flightPath(numbers, { width, height })` | `lib/flightCurve.js` |
| plot discs on a **speed × stability chart** | `flightChartPoints` or `buildFlightSpectrum` | `lib/bags.js`, `lib/flightSpectrum.js` |
| classify a disc by **speed / stability** | `speedClass`, `stabilityClass` | `lib/discFilters.js` |
| **filter or sort** a disc list | `filterDiscs`, `sortDiscs` | `lib/discFilters.js` |
| **search the mold catalog** | `filterCatalogMolds(catalog, { query, manufacturer, category })` + `useCatalog()` | `lib/repository/catalogRepository.js` |
| find **redundant / near-identical** discs | `findNearIdenticalDiscPairs`, `buildDiscComparison` | `lib/discCompare.js` |
| find **gaps** in a bag | `stabilityGaps`, `resonanceComponents`, `buildBagResonance` | `lib/wishlist.js`, `lib/bagResonance.js` |
| show a **bag's contents** | `bagViewDiscs` (visible-only), `fetchBagDiscs` (remote) | `lib/bags.js`, `lib/discLocker.js` |
| check a **bag's capacity band** | `capacityTier(discCount, cap)` | `lib/bags.js` |
| promote a **default bag / primary putter** | `bagIdsToUnsetForNewDefault`, `discIdsToUnsetForNewPrimary` (then `setDefaultBag` / `updateDiscRole`) | `lib/bags.js`, `lib/discs.js`, `lib/discLocker.js` |
| **restore a bag version** | `previewBagRestore` + `restoreBagVersion` | `lib/bagHistory.js`, `lib/repository/bagHistoryRepository.js` |
| load **session history** | `fetchHistory(userId, { visibility })` | `lib/history.js` |
| render the **history feed** | `activityHistoryEntries({ activities, sessions, runs })` | `lib/history.js` |
| restrict data to what **metrics may use** | `metricEligibleHistory(...)`, `isMetricEligibleActivity` | `lib/history.js`, `lib/metrics/registry.js` |
| get the **practice streak** | `practiceStreak(dates, now)` | `lib/insights/activity.js` |
| get **weekly / monthly / lifetime volume** | `volumeLedger(samples, now)` | `lib/insights/activity.js` |
| show a **confidence interval** on a make % | `wilsonInterval(makes, attempts)` — handle `null` | `lib/insights/wilson.js` |
| build the **putting confidence map** | `confidenceMap(distanceSamples)` | `lib/insights/confidenceMap.js` |
| bucket a **distance** | `distanceBand(feet)` (width `DISTANCE_BAND_WIDTH_FT`) | `lib/insights/confidenceMap.js` |
| show **current form vs lifetime** | `decayWeightedForm(samples, now)` | `lib/insights/form.js` |
| compare **putters** | `putterBreakdown` (simple) / `putterComparison` (distance-adjusted) | `lib/insights/` |
| analyse **misses by zone** | `missTendency(puttEvents)` | `lib/insights/missTendency.js` |
| evaluate a **before/after experiment** | `experimentComparison(markers, puttEvents, discs)` | `lib/insights/experimentComparison.js` |
| detect **PBs** | `regimenPBRunIds`, `distancePBSessionIds` | `lib/insights/pbs.js` |
| suggest the **next session** | `suggestNextSession(runs, distanceSamples, allSamples, now)` | `lib/insights/nextSessionSuggestion.js` |
| **score a regimen set** | `computeSetScore(regimen, set, results)` + `computeCompletionBonus` | `lib/regimenScoring.js` |
| build or preview a **custom routine** | `buildRegimenPayload`, `maxScorePreview`, `canAddStage` | `lib/routineBuilder.js` |
| handle a **classic drill** (JYLY / ATW / Clutch) | `validateDrillConfig`, `scoreDrillStage`, `nextDrillStage` | `lib/drillEngine.js` |
| read or write the **profile** | `fetchProfile`, `upsertProfileFields`, `isThrowingProfileEmpty` | `lib/profile.js` |
| build the **career summary radar** | `buildCareerSummary(...)` + `fetchCareerData(userId)` | `lib/careerSummary.js`, `lib/repository/careerRepository.js` |
| **start / pause / finish** an activity | `activityRepository.start / pause / resume / finalize / markIncomplete` | `lib/repository/activityRepository.js` |
| know **which activity is current** | `activityRepository.getActive(userId)` or `useActiveActivity(userId)` | repository / `hooks/useActiveActivity.js` |
| decide **what a start command should do** | `planActivityStart({ existingActivity, replacementActivity })` | `lib/activityLifecycle/reducer.js` |
| **hide / restore / correct** a history entry | `useHistoryRecovery()` | `hooks/useHistoryRecovery.js` |
| **flush the sync outbox** | `createActivitySyncAdapter().flush()`, `createHistoryRecoverySyncAdapter().flush()`, `flushRoundOutbox`, `flushOutbox` | `lib/repository/` |
| know if an error is **worth retrying** | `isPermanentError` / `isPermanentActivitySyncError` / `isPermanentHistoryRecoveryError` | `lib/instantLaunch/errorClassification.js`, `lib/repository/*Sync.js` |
| compute a **retry delay** | `nextBackoffDelayMs(attempt)` | `lib/instantLaunch/backoff.js` |
| show **sync status** | `SYNC_STATUS` + `createSyncScheduler` | `lib/instantLaunch/syncScheduler.js` |
| get **route metadata / shell type** for a path | `resolveRouteMetadata(pathname)` | `lib/routeMetadata.js` |
| resolve the **active tab** | `resolveActiveTab(tabs, pathname)`, `resolveTabPressAction` | `lib/navigation.js`, `lib/tabNavigation.js` |
| produce or read **notifications** | `notificationRepository`, `produceActivityReviewNotifications`, `useNotifications` | `lib/repository/notificationRepository.js`, `lib/notificationProducers.js`, `hooks/` |
| compute the **notification badge count** | `isBadgeEligible(notification)` / `notificationRepository.badgeCount` | `lib/notifications.js` |
| route a **notification tap** | `notificationDestination(notification)` | `lib/notifications.js` |
| manage **goals** | `goalRepository.list/create/transition`, `transitionGoal`, `goalProgress` | `lib/repository/goalRepository.js`, `lib/goals.js` |
| generate the **weekly report** | `weeklyReportRepository.generate(userId)` (pure core: `buildWeeklyReportSnapshot`) | `lib/repository/weeklyReportRepository.js`, `lib/weeklyReport.js` |
| find the **last completed week** in a timezone | `latestCompletedWeekWindow({ now, timezone })` | `lib/weeklyReport.js` |
| **export all user data** | `dataExportRepository.collectUserExport` → `buildDataExportArchive` → `downloadDataExport` | `lib/repository/dataExportRepository.js`, `lib/dataExport.js` |
| **purge device data** after account deletion | `purgeDeviceData({ storage, database })` | `lib/localPurge.js` |
| award **XP / badges** after a session | `awardPostSession({ ... })` then `celebrationEventsFor(result)` | `lib/gamification/` |
| render the **XP bar** | `xpProgressInLevel(totalXp)` | `lib/gamification/xp.js` |
| classify a **swipe gesture** | `classifyGesture(samples)` or `useGesturePointer(ref, callbacks)` | `lib/gestureEngine/classify.js`, `hooks/` |

---

# 15. Do-not-reimplement list

The functions most likely to be duplicated by an agent who did not read this index. Each line names
the wrong instinct and the right call.

| Do **not** write | Use this instead | Why |
|---|---|---|
| `disc.override_speed ?? mold.speed` inline | `effectiveFlightNumbers(disc, mold)` | Four axes, and `??` not `\|\|` — a `0` turn/fade override is valid and `\|\|` silently drops it. |
| your own speed/stability buckets | `speedClass`, `stabilityClass` | Thresholds are shared by filters, resonance, wishlist, and the spectrum. A second copy desynchronizes the whole disc UI. |
| `makes / attempts` with a hand-rolled error bar | `wilsonInterval(makes, attempts)` | Normal approximation escapes `[0,1]` at small n — exactly when it is displayed. Returns `null` at `attempts <= 0`. |
| `Math.floor(ft / 10) * 10` | `distanceBand(ft)` + `DISTANCE_BAND_WIDTH_FT` | Four modules band distances; they must agree or cross-view comparisons lie. |
| a loop counting back consecutive practice days | `practiceStreak(dates, now)` | Handles the "today has no entry yet" case — a naive version breaks every streak each morning. |
| re-deriving streak/clean/pressure points | `computeSetScore` / `computeCompletionBonus` | The shipped engine. `routineBuilder.maxScorePreview` already calls it so preview and reality cannot drift. |
| `makes === attempts` as a clean-set test | `isCleanSet(makes, attempts)` | Guards `attempts > 0`; `0/0` is not a clean set. `playerStats` reuses it so badges and scoring agree. |
| a fresh `1000 * 1.15 ** n` level curve | `calculateXpForLevel` / `levelForXp` / `xpProgressInLevel` | One economy, capped at level 50, rounded consistently. |
| flattening sessions/runs into samples by hand | `distanceSamples`, `allPuttSamples` | Regimen sets carry a *range*, not a distance — the midpoint rule lives here and nowhere else. |
| filtering history rows for a metric | `metricEligibleHistory` / `isMetricEligibleActivity` | Only completed, visible, meaningful parents may contribute evidence (`PHASE_A_ARCHITECTURE.md` § 5). |
| counting makes from `putt_events` | summary tables via `distanceSamples` / `buildPlayerStats` | Batch-ribbon putts never create events; counting off events undercounts silently. |
| a bespoke Supabase read + `try/catch` cache fallback | `readThroughCache` / a repository | Cache pruning on success is the part hand-rolled versions forget, so deleted rows resurface offline forever. |
| a bespoke queue-then-POST write | `writeThrough` / the repository outbox | Queue-before-send plus idempotent replay; see `PHASE_A_ARCHITECTURE.md` § 14. |
| direct Dexie writes to `activities` | `activityRepository.*` | State, event log, audit row, and outbox entry are transactionally coupled. Bypassing it corrupts the invariant. |
| your own retry timer | `nextBackoffDelayMs(attempt)` + `createSyncScheduler` | 2s→60s capped backoff, permanent-vs-transient split, online/visibility triggers. |
| `error.code === '23505'`-style checks scattered around | `isPermanentError` and its two lifecycle wrappers | Permanent errors must poison, not retry forever. |
| a `switch` on `pathname` for shell/title/section | `resolveRouteMetadata(pathname)` | The route contract is one table; a second copy breaks the shell on the next route added. |
| `pathname.startsWith(tab.to)` | `resolveActiveTab(tabs, pathname)` | Naive prefix matching lights up two tabs for nested routes. |
| a mold-search query against `disc_molds` | `filterCatalogMolds` + `useCatalog()` | Offline-first catalog snapshot; approved-only filtering; result cap. |
| counting unread notifications inline | `isBadgeEligible` / `notificationRepository.badgeCount` | Expiry + resolution + priority, in one predicate. |
| `new Date(...)` week-boundary math | `latestCompletedWeekWindow` / `zonedMidnightUtc` | DST-safe, IANA-timezone-correct, Monday-anchored. Hand-rolled versions drift an hour twice a year. |
| CSV escaping | `csvCell` / `rowsToCsv` | Formula-injection safe, deterministic column order, BOM + CRLF. |
| `localStorage.getItem('discgolf.instantLaunch.v1')` | `readInstantLaunchState` / `updateInstantLaunchState` + a `stateReducer` `apply*` fn | Migration, private-mode fallback, and pure transitions all live behind these. |
| ad-hoc gesture thresholds | `GESTURE_CONFIG` + `classifyGesture` | Named, tunable, DPR-independent, and shared with the rapid-fire pacer. |
| a new 9-zone miss grid | `MISS_ZONES` | Ids 1–9 are persisted in `putt_events.miss_zone`. Renumbering silently rewrites history. |
| a per-page "is this iOS / installed" check | `readPlatformContext()` | Covers iPadOS desktop-mode and the OAuth-leaves-app rule. |
