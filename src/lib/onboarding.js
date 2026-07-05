// Pure helpers for Screen 3 (Onboarding Wizard). Kept here, not in the page
// component, so the default-mold fallback and payload shape are unit-testable
// without mounting React or hitting Supabase.

export const GOAL_OPTIONS = [
  { id: 'consistency', label: 'Dial In Consistency', description: 'Structured putting routines and streaks' },
  { id: 'bag', label: 'Bag Management', description: 'Track your discs, wear, and flight numbers' },
  { id: 'analytics', label: 'Deep Analytics', description: 'Fatigue curves, pressure stats, confidence maps' },
]

export const PUTTER_BRANDS = ['MVP', 'Axiom', 'Streamline']

// The blueprint names "Axiom Cosmic Pilot" as the default putter, but the
// seeded disc_molds catalog has no such mold — its real Axiom putters are
// Envy and Proxy (see disc_molds_seed.sql). Envy was chosen as the closer
// analogue (user-confirmed 2026-07-05).
export const DEFAULT_BRAND = 'Axiom'
export const DEFAULT_MOLD_NAME = 'Envy'

export const MIN_WEIGHT_GRAMS = 150
export const MAX_WEIGHT_GRAMS = 180
export const WEIGHT_STEP_GRAMS = 1
export const DEFAULT_WEIGHT_GRAMS = 174

export const PRACTICE_STACK_BAG_NAME = 'Practice Stack'

export const UNIT_OPTIONS = [
  { value: 'feet', label: 'Feet' },
  { value: 'meters', label: 'Meters' },
]

// Prefers the catalog's DEFAULT_MOLD_NAME within the given brand's putter
// molds; falls back to the first result rather than null so the stepper
// always has something selected (a brand with no seeded putter mold at all
// would be a data problem, not a UI one).
export function pickDefaultMold(molds) {
  if (!molds || molds.length === 0) return null
  return molds.find((mold) => mold.mold_name === DEFAULT_MOLD_NAME) ?? molds[0]
}

export function clampWeight(grams) {
  return Math.min(MAX_WEIGHT_GRAMS, Math.max(MIN_WEIGHT_GRAMS, grams))
}

// A user who has zero bags has never completed onboarding — Step 2 always
// provisions the Practice Stack bag, so this is a reliable signal with no
// new schema column (SCREEN_SPECS Screen 3: "Dependency: none beyond shipped
// 1A profile schema").
export function needsOnboarding(bags) {
  return !bags || bags.length === 0
}

export function buildPutterDiscFields({ moldId, manufacturer, moldName, weightGrams }) {
  return {
    mold_id: moldId,
    manufacturer,
    mold: moldName,
    weight_grams: weightGrams,
    role: 'primary_putter',
    status: 'in_locker',
  }
}
