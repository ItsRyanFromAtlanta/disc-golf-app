// The 25 badge definitions — single source of truth.
//
// This catalog drives three things that must never drift apart:
//   1. the `badges` table seed (layer5_gamification_seed.sql is generated to match)
//   2. the evaluator's criteria (each badge's `criteria` is what evaluateBadges reads)
//   3. the Trophy Room UI (icon + tier styling by `code`)
//
// `criteria.metric` keys into the metric registry in metrics.js. `threshold` is
// the value that fully unlocks the badge; progress is min(current/threshold, 1).
// Binary "do it once" badges use threshold 1. `params` carry metric-specific
// arguments (zone, distance, wind speed) so several badges can share one metric.
//
// icon is a client-only emoji (the badges table has no icon column — icons are
// presentation, not criteria); the UI maps code -> icon via BADGE_ICONS below.

export const BADGE_CATALOG = [
  // --- Volume: cumulative makes ---
  { code: 'first_makes', name: 'First Steps', tier: 'bronze', icon: '👣',
    description: 'Sink your first 10 putts.',
    criteria: { metric: 'total_makes', threshold: 10 } },
  { code: 'makes_500', name: 'Getting Warm', tier: 'silver', icon: '🔥',
    description: 'Make 500 putts all-time.',
    criteria: { metric: 'total_makes', threshold: 500 } },
  { code: 'makes_5k', name: 'Chain Music', tier: 'gold', icon: '🎶',
    description: 'Make 5,000 putts all-time.',
    criteria: { metric: 'total_makes', threshold: 5000 } },

  // --- Cadence: practice-day streaks & session volume ---
  { code: 'streak_3d', name: 'Habit Formed', tier: 'bronze', icon: '📅',
    description: 'Practice 3 days in a row.',
    criteria: { metric: 'practice_day_streak', threshold: 3 } },
  { code: 'streak_7d', name: 'Locked In', tier: 'silver', icon: '🔒',
    description: 'Practice 7 days in a row.',
    criteria: { metric: 'practice_day_streak', threshold: 7 } },
  { code: 'streak_30d', name: 'Relentless', tier: 'gold', icon: '🏔️',
    description: 'Practice 30 days in a row.',
    criteria: { metric: 'practice_day_streak', threshold: 30 } },
  { code: 'sessions_50', name: 'Field General', tier: 'silver', icon: '🎖️',
    description: 'Log 50 practice sessions.',
    criteria: { metric: 'total_sessions', threshold: 50 } },

  // --- Distance ---
  { code: 'c1_100', name: 'C1 Automatic', tier: 'bronze', icon: '🤖',
    description: 'Make 100 putts inside Circle 1 (≤33 ft).',
    criteria: { metric: 'makes_in_zone', threshold: 100, params: { zone: 'C1' } } },
  { code: 'c2_100', name: "Circle's Edge", tier: 'silver', icon: '🎯',
    description: 'Make 100 putts in Circle 2 (34–66 ft).',
    criteria: { metric: 'makes_in_zone', threshold: 100, params: { zone: 'C2' } } },
  { code: 'sniper', name: 'Sniper Rifle', tier: 'gold', icon: '🔭',
    description: 'Make a putt from 66 ft or beyond.',
    criteria: { metric: 'longest_made_distance', threshold: 66 } },
  { code: 'bomber_40', name: 'Long Bomber', tier: 'silver', icon: '💣',
    description: 'Make 25 putts from 40 ft or beyond.',
    criteria: { metric: 'makes_beyond_ft', threshold: 25, params: { min_ft: 40 } } },

  // --- Streaks & clean sets ---
  { code: 'streak_10', name: 'On Fire', tier: 'bronze', icon: '🔥',
    description: 'Hit a 10-putt streak in a set.',
    criteria: { metric: 'longest_putt_streak', threshold: 10 } },
  { code: 'streak_25', name: 'Untouchable', tier: 'silver', icon: '⚡',
    description: 'Hit a 25-putt streak in a set.',
    criteria: { metric: 'longest_putt_streak', threshold: 25 } },
  { code: 'clean_10', name: 'Clean Sweep', tier: 'bronze', icon: '🧹',
    description: 'Finish 10 clean stages (no misses).',
    criteria: { metric: 'clean_stages', threshold: 10 } },
  { code: 'flawless', name: 'Flawless', tier: 'gold', icon: '💎',
    description: 'Complete a regimen with zero misses.',
    criteria: { metric: 'no_miss_regimen_runs', threshold: 1 } },

  // --- Pressure ---
  { code: 'pressure_10', name: 'Ice Water', tier: 'bronze', icon: '🧊',
    description: 'Make 10 pressure putts.',
    criteria: { metric: 'pressure_putts_made', threshold: 10 } },
  { code: 'pressure_50', name: 'Clutch Gene', tier: 'gold', icon: '🧬',
    description: 'Make 50 pressure putts.',
    criteria: { metric: 'pressure_putts_made', threshold: 50 } },

  // --- Weather ---
  { code: 'gale_force', name: 'Gale Force', tier: 'gold', icon: '🌪️',
    description: 'Make 50 putts in winds of 15 mph or more.',
    criteria: { metric: 'high_wind_makes', threshold: 50, params: { min_wind_mph: 15 } } },
  { code: 'rain_10', name: 'Rain or Shine', tier: 'silver', icon: '🌧️',
    description: 'Log 10 sessions in the rain.',
    criteria: { metric: 'rain_sessions', threshold: 10 } },
  { code: 'any_wind_100', name: 'Storm Chaser', tier: 'silver', icon: '⛈️',
    description: 'Make 100 putts in any wind.',
    criteria: { metric: 'wind_makes', threshold: 100, params: { min_wind_mph: 0 } } },

  // --- Regimen mastery ---
  { code: 'regimens_5', name: 'Graduate', tier: 'bronze', icon: '🎓',
    description: 'Complete 5 regimen runs.',
    criteria: { metric: 'regimen_runs_completed', threshold: 5 } },
  { code: 'perfect_10', name: 'Perfectionist', tier: 'gold', icon: '✨',
    description: 'Complete 10 flawless regimen runs.',
    criteria: { metric: 'no_miss_regimen_runs', threshold: 10 } },
  { code: 'pb_5', name: 'Record Breaker', tier: 'silver', icon: '📈',
    description: 'Set 5 regimen personal bests.',
    criteria: { metric: 'regimen_pbs_set', threshold: 5 } },

  // --- Inventory ---
  { code: 'collector_10', name: 'Collector', tier: 'bronze', icon: '🥏',
    description: 'Own 10 discs.',
    criteria: { metric: 'discs_owned', threshold: 10 } },
  { code: 'iron_arm', name: 'Iron Arm', tier: 'silver', icon: '🦾',
    description: 'Rack up 1,000 chain hits on a single putter.',
    criteria: { metric: 'putter_chain_hits_max', threshold: 1000 } },
]

// code -> emoji, for the UI. Derived from the catalog so there's one list.
export const BADGE_ICONS = Object.freeze(
  Object.fromEntries(BADGE_CATALOG.map((b) => [b.code, b.icon])),
)

// code -> full definition, for looking up name/icon from an evaluator result
// (which carries only code/id/tier).
export const BADGE_BY_CODE = Object.freeze(
  Object.fromEntries(BADGE_CATALOG.map((b) => [b.code, b])),
)
