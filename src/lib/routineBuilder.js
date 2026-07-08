import { computeSetScore, computeCompletionBonus } from './regimenScoring'

// Custom Routine Builder (Screen 7) domain logic. Pure — no React, no Supabase —
// so the rules-engine mapping and the 100-putt interlock are unit-testable in
// isolation. A custom routine is just a putting_regimens row + putting_regimen_sets
// rows that flow through the SHIPPED scoring engine (regimenScoring.js) unmodified;
// this module's job is to translate builder UI state into that schema, and to
// preview the score using the exact same engine the run page uses.

// Segmented-stepper options (blueprint's zero-typing touch grids).
export const DISTANCE_OPTIONS = [15, 20, 25, 33]
export const PUTT_OPTIONS = [5, 10, 15, 20]

// Hard interlock: total planned putts across a routine's stages. Mirrors the DB
// trigger enforce_routine_putt_cap (sum(reps_required) <= 100); enforced app-side
// too, per CLAUDE.md's "never just one layer" rule.
export const MAX_PUTTS = 100
export const MAX_STAGES = 20

// Scoring defaults — the knobs the shipped engine actually reads. The blueprint's
// per-stage [First]/[Streak]/[Clean] toggles don't map to the engine (which scores
// streak/clean/completion at the ROUTINE level and pressure per-set), so the
// builder exposes them at the level the engine scores them. See the plan's
// "Scoring-model mapping" section.
export const SCORING_DEFAULTS = {
  basePointsPerMake: 10,
  streakStep: 0.1, // applied when the routine-level Streak bonus is on
  noMissBonusPct: 0.25, // applied when the routine-level Clean-set bonus is on
  completionBonus: 50, // flat, applied when the routine-level Completion bonus is on
  pressureMultiplier: 2, // per-stage: applied to a stage's last putt when its Pressure toggle is on
}

export function blankStage() {
  return { distanceFt: 20, putts: 10, pressure: false }
}

export function totalPutts(stages) {
  return stages.reduce((sum, s) => sum + s.putts, 0)
}

// Blueprint: "ADD NEXT STAGE (DUPLICATES STAGE 1 SETTINGS)" — the next stage
// clones the last stage's putt count, so we disable when that duplicate would
// breach the ceiling (or the 20-stage limit). An empty routine can always add.
export function canAddStage(stages) {
  if (stages.length >= MAX_STAGES) return false
  if (stages.length === 0) return true
  const nextPutts = stages[stages.length - 1].putts
  return totalPutts(stages) + nextPutts <= MAX_PUTTS
}

// Difficulty estimate (1-5) for the CUSTOM routine card badge. Documented,
// deterministic heuristic: band by putt-weighted average distance, then bump for
// high total volume and for any pressure stage. Clamped 1-5.
export function estimateDifficulty(stages) {
  if (stages.length === 0) return 1

  const putts = totalPutts(stages)
  const weightedDistance = stages.reduce((sum, s) => sum + s.distanceFt * s.putts, 0) / putts

  // Distance bands mirror the segmented options (C1 edge = 33ft is the hardest band).
  let difficulty
  if (weightedDistance <= 15) difficulty = 1
  else if (weightedDistance <= 20) difficulty = 2
  else if (weightedDistance <= 25) difficulty = 3
  else if (weightedDistance <= 33) difficulty = 4
  else difficulty = 5

  if (putts >= 60) difficulty += 1 // sustained volume adds fatigue difficulty
  if (stages.some((s) => s.pressure)) difficulty += 1 // pressure putts raise the stakes

  return Math.max(1, Math.min(5, difficulty))
}

// Maps builder UI state (name, stages, routine-level bonus toggles) into the
// { regimen, sets } shape createCustomRegimen inserts. Toggle -> typed column,
// per the plan's scoring-model mapping.
export function buildRegimenPayload(userId, { name, stages, bonuses }) {
  const regimen = {
    user_id: userId,
    name: name.trim(),
    drill_type: 'custom',
    difficulty: estimateDifficulty(stages),
    base_points_per_make: SCORING_DEFAULTS.basePointsPerMake,
    streak_step: bonuses.streak ? SCORING_DEFAULTS.streakStep : 0,
    no_miss_bonus_pct: bonuses.clean ? SCORING_DEFAULTS.noMissBonusPct : 0,
    completion_bonus: bonuses.completion ? SCORING_DEFAULTS.completionBonus : 0,
    archived: false,
    // Reconstruction snapshot for a future edit flow; scoring reads the typed
    // columns above, not this. version'd so the shape can evolve.
    rules_config: { version: 1, stages },
  }

  const sets = stages.map((stage, index) => ({
    set_order: index + 1,
    distance_feet_min: stage.distanceFt,
    distance_feet_max: stage.distanceFt,
    reps_required: stage.putts,
    pressure_multiplier: stage.pressure ? SCORING_DEFAULTS.pressureMultiplier : 1,
  }))

  return { regimen, sets }
}

// Live max-score preview — the totalizer's "≈ N pts". IS the shipped engine:
// scores a hypothetical perfect run (every putt made, so the whole stage is one
// clean streak and the pressure putt lands) via computeSetScore, summed across
// stages, plus the completion bonus. `bonuses`/`name` come from the same builder
// state buildRegimenPayload uses, so preview and reality can't drift.
export function maxScorePreview({ stages, bonuses }) {
  if (stages.length === 0) return 0
  const { regimen, sets } = buildRegimenPayload(null, { name: '', stages, bonuses })

  let total = 0
  for (const set of sets) {
    const { points } = computeSetScore(regimen, set, {
      makes: set.reps_required,
      attempts: set.reps_required,
      longestStreak: set.reps_required,
      pressurePuttMade: true,
    })
    total += points
  }
  total += computeCompletionBonus(regimen, true)
  return Math.round(total * 100) / 100
}
