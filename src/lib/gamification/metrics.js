// Metric registry: pure functions that read a PlayerStats snapshot and return
// the current value for a badge's criteria. evaluateBadges compares each value
// against the badge's threshold. Keeping these pure (snapshot in, number out)
// is what makes the whole badge engine unit-testable without a database.
//
// PlayerStats shape (built by badgeEvaluatorService.buildPlayerStats):
//   totalMakes, totalAttempts        cumulative across ALL summary rows
//   totalSessions                    freeform sessions + regimen runs
//   practiceDayStreak                consecutive practice days as of "now"
//   distanceSamples: [{ distanceFeet, makes, attempts }]
//   weatherBuckets:  [{ windMph|null, condition|null, makes }]   one per parent
//   longestPuttStreak                max longest_streak over all run sets
//   cleanStages                      count of clean run sets
//   noMissRegimenRuns                completed runs with zero misses
//   pressurePuttsMade                count of run sets whose pressure putt landed
//   regimenRunsCompleted             count of completed runs
//   regimenPbsSet                    number of runs that were a regimen PB
//   discsOwned                       count of the user's discs
//   putterChainHitsMax               max discs.total_chain_hits
//
// IMPORTANT (data-split honesty, per CLAUDE.md): make counts here come from the
// SUMMARY tables (putt_distance_logs / putting_regimen_run_sets), never from
// putt_events — batch-ribbon putts never create events, so counting off events
// would silently undercount. putt_events feeds only genuinely event-level stats,
// of which the badge set currently has none (longest distance uses summary rows).

// Circle zoning mirrors the putt_distance_logs.zone generated column exactly:
// <=33 ft = C1, <=66 ft = C2, else Beyond C2. Inlined (not imported from
// insights) so gamification stays decoupled and the definition can't drift out
// from under us if the insights zoning ever changes for a different purpose.
function zoneForDistance(distanceFeet) {
  if (distanceFeet <= 33) return 'C1'
  if (distanceFeet <= 66) return 'C2'
  return 'Beyond C2'
}

export const METRICS = {
  total_makes: (s) => s.totalMakes,

  total_sessions: (s) => s.totalSessions,

  practice_day_streak: (s) => s.practiceDayStreak,

  makes_in_zone: (s, params) =>
    s.distanceSamples
      .filter((d) => zoneForDistance(d.distanceFeet) === params.zone)
      .reduce((sum, d) => sum + d.makes, 0),

  // Longest distance at which at least one putt was made. 0 if none yet.
  longest_made_distance: (s) =>
    s.distanceSamples.reduce((max, d) => (d.makes > 0 ? Math.max(max, d.distanceFeet) : max), 0),

  makes_beyond_ft: (s, params) =>
    s.distanceSamples
      .filter((d) => d.distanceFeet >= params.min_ft)
      .reduce((sum, d) => sum + d.makes, 0),

  longest_putt_streak: (s) => s.longestPuttStreak,

  clean_stages: (s) => s.cleanStages,

  no_miss_regimen_runs: (s) => s.noMissRegimenRuns,

  pressure_putts_made: (s) => s.pressurePuttsMade,

  // >= min_wind_mph (inclusive): "in winds of 15mph or more". Null wind (weather
  // unknown) never counts toward a wind badge.
  high_wind_makes: (s, params) =>
    s.weatherBuckets
      .filter((w) => w.windMph != null && w.windMph >= params.min_wind_mph)
      .reduce((sum, w) => sum + w.makes, 0),

  // > min_wind_mph (exclusive): "in any wind" is min_wind_mph 0, so any recorded
  // wind above zero qualifies.
  wind_makes: (s, params) =>
    s.weatherBuckets
      .filter((w) => w.windMph != null && w.windMph > params.min_wind_mph)
      .reduce((sum, w) => sum + w.makes, 0),

  rain_sessions: (s) => s.weatherBuckets.filter((w) => w.condition === 'rain').length,

  regimen_runs_completed: (s) => s.regimenRunsCompleted,

  regimen_pbs_set: (s) => s.regimenPbsSet,

  discs_owned: (s) => s.discsOwned,

  putter_chain_hits_max: (s) => s.putterChainHitsMax,
}

// Evaluate one badge's criteria against a stats snapshot. Returns the raw
// current value; the caller derives progress/earned from it and the threshold.
export function metricValue(stats, criteria) {
  const fn = METRICS[criteria.metric]
  if (!fn) throw new Error(`Unknown badge metric: ${criteria.metric}`)
  return fn(stats, criteria.params ?? {})
}
