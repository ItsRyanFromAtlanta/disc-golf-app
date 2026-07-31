// Helpers for Screen 3 (Onboarding Wizard). Kept here, not in the step
// components, so the default-mold fallback, the payload shapes, and — since
// D-04 — the whole provisioning sequence are unit-testable without mounting
// React. The Supabase-touching functions at the bottom take their write calls
// as injectable dependencies for the same reason.

import { supabase } from './supabaseClient'
import { createBag, upsertDisc, addDiscToBag, fetchBags } from './discLocker'
import { upsertProfileFields } from './profile'

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

// ---------------------------------------------------------------------------
// Provisioning (defect register `D-04`)
//
// Step 2 used to write the bag, then the disc, then the membership as three
// sequential unguarded awaits. The first of those is the one that must not
// survive alone: `bags_one_default_per_user` is a partial unique index over
// `(user_id) where is_default`, so once the bag landed, every retry of the
// sequence collided with it and the wizard rendered the raw unique-violation.
//
// And the bag surviving alone is worse than a blocked retry, because that row
// is the only record that a user was ever onboarded — `needsOnboarding` above
// is `bags.length === 0`. A partial failure left an account the gate reports as
// onboarded, holding an empty bag and no putter, with the wizard unreachable.
//
// So the primary path is one RPC that does all three inserts in one
// transaction, exactly as E2 audit finding 3 resolved the same shape for
// `create_course_with_layout`. Its migration
// (`20260730235830_phase_e_atomic_onboarding_provisioning.sql`) is written and
// UNAPPLIED, so the fallback below is what actually runs today.
// ---------------------------------------------------------------------------

// "`provision_practice_stack` is not deployed on this project."
//
// The two spellings PostgREST and Postgres use for an absent function, both
// already in `DEPLOY_LAG_CODES` (`instantLaunch/errorClassification.js`). The
// codes are re-stated rather than imported because the meaning differs: there
// this set means "keep waiting for the migration", here it means "take the
// other path now". `isMissingRelationError` is the precedent for a predicate
// that owns one such rule in one place.
const MISSING_PROVISION_RPC_CODES = new Set(['PGRST202', '42883'])

export function isProvisioningRpcMissing(error, status) {
  if (!error) return false
  if (MISSING_PROVISION_RPC_CODES.has(String(error.code ?? ''))) return true
  // A bare 404 is how a missing function reaches us when the body carries no
  // recognisable code. Falling back on it is safe in a way that falling back on
  // a 4xx generally is not: the fallback is the path this screen already took,
  // so the worst case is the behaviour that shipped before the RPC existed.
  return status === 404 || error.status === 404
}

// `bag_discs` carries `unique (bag_id, disc_id)`, so a replay that already
// added the putter raises 23505. That is the membership being *present*, which
// is the outcome we wanted — not a failure.
function isDuplicateMembership(error) {
  return String(error?.code ?? '') === '23505'
}

export function buildProvisionArgs({ bagId, bagName = PRACTICE_STACK_BAG_NAME, discId = null, disc = null }) {
  return {
    p_bag_id: bagId,
    p_bag_name: bagName,
    p_disc_id: disc ? discId : null,
    p_disc: disc ?? null,
  }
}

export async function provisionPracticeStackRpc(args) {
  const { data, error, status } = await supabase.rpc('provision_practice_stack', args)
  if (error) {
    if (isProvisioningRpcMissing(error, status)) return null
    if (typeof status === 'number' && typeof error.status !== 'number') error.status = status
    throw error
  }
  return { bagId: data?.bag_id ?? args.p_bag_id, discId: data?.disc_id ?? null, atomic: true }
}

// The pre-RPC sequence, made idempotent so that a retry after a partial failure
// converges instead of colliding. Each step is individually replay-safe:
//
//   1. the bag resolves to the caller's existing default bag when there is one
//      — which also fixes re-entering `/onboarding` after completing it
//      (`screens/onboarding.md` § 12 q3);
//   2. the disc carries a caller-supplied id, which sends `upsertDisc` down its
//      `onConflict: 'id'` branch rather than inserting a second physical disc;
//   3. a duplicate membership is treated as the membership existing.
//
// Both ids must be stable across attempts for that to hold, which is why the
// caller generates them once per mount rather than per attempt.
export async function provisionPracticeStackFallback(
  userId,
  { bagId, bagName = PRACTICE_STACK_BAG_NAME, discId, disc },
  api = { fetchBags, createBag, upsertDisc, addDiscToBag },
) {
  const bags = await api.fetchBags(userId)
  const existingDefault = (bags ?? []).find((bag) => bag.is_default)
  const bag = existingDefault ?? (await api.createBag(userId, { id: bagId, name: bagName, is_default: true }))

  if (!disc) return { bagId: bag.id, discId: null, atomic: false }

  const savedDisc = await api.upsertDisc(userId, null, { ...disc, id: discId })
  try {
    await api.addDiscToBag(bag.id, savedDisc.id)
  } catch (error) {
    if (!isDuplicateMembership(error)) throw error
  }
  return { bagId: bag.id, discId: savedDisc.id, atomic: false }
}

// Atomic when the function is deployed, convergent when it is not. Returns
// `{ bagId, discId, atomic }` so the caller can tell which guarantee it got.
export async function provisionPracticeStack(userId, input, deps = {}) {
  const { rpc = provisionPracticeStackRpc, fallback = provisionPracticeStackFallback } = deps
  const viaRpc = await rpc(buildProvisionArgs(input))
  if (viaRpc) return viaRpc
  return fallback(userId, input)
}

// ---------------------------------------------------------------------------
// Goal persistence (defect register `D-15`)
//
// Step 1 required a choice and threw it away — no column, no write, anywhere.
// Two closes were on the table: stop asking, or persist it. This picks
// persist, but not into the Phase D3 `goals` feature at `/profile/goals`
// (`src/lib/goals.js`, `goalRepository.js`). That table's four `GOAL_TYPES`
// are measurable targets — a number, a unit, a start date, an optional target
// date, a create/pause/complete/cancel lifecycle with an event history. This
// step collects none of that: `GOAL_OPTIONS` are three dashboard-focus tags
// ("Dial In Consistency", "Bag Management", "Deep Analytics") with no target
// value and no date. Even the one option that shares a word with a real
// `GOAL_TYPES` entry ('consistency') is not the same fact — the goals feature's
// `consistency` is a percentage target, this is a UI preference. Writing a
// `goals` row here would mean fabricating a target_value and unit the user
// never supplied, planting a synthetic goal in a feature that is otherwise
// entirely user-authored and lifecycle-tracked. That is worse than the
// discard this closes — it is why "connect to the real feature" is a
// hypothesis worth writing down and then not taking, not a mandate: it does
// not fit, and forcing it would corrupt the very feature it was meant to
// respect.
//
// So the goal is what the blueprint always described it as — a profile-level
// preference tag, alongside `units` (which CalibrationStep already writes the
// same way) — not a goal record. It goes on `profiles.onboarding_goal`, a
// plain nullable column with no lifecycle, via the existing
// `upsertProfileFields` path so no new write surface is introduced.
//
// The migration (`supabase/migrations/<UTC>_phase_e_onboarding_goal.sql`) is
// written and UNAPPLIED, so a live write 400s on the missing column, or —
// once the column exists but before its compensating grant does — 403s on the
// missing UPDATE privilege (see the migration header for why both codes ride
// together). Neither may block Step 1: the user already made the choice the
// gate demanded, and losing the write is strictly better than losing forward
// progress over a preference field. Genuine failures (a real RLS denial, a
// network error) are not swallowed here — they propagate so a caller that
// cares can decide, but `OnboardingPage` itself fires this without awaiting
// the result, exactly because even a genuine failure must not strand a user
// who already answered the question.
const MISSING_GOAL_COLUMN_CODES = new Set([
  'PGRST204', // column not found in the schema cache (migration not yet applied)
  '42703', // undefined_column — the Postgres-side spelling of the same lag
  '42501', // insufficient_privilege — the column exists but its grant hasn't landed yet
])

export function isGoalColumnUnavailable(error) {
  if (!error) return false
  return MISSING_GOAL_COLUMN_CODES.has(String(error.code ?? ''))
}

// Best-effort: resolves to `null` (not a rejection) both when there is no
// goal to save and when the deploy-lag window swallows the write, so callers
// that don't care about the outcome can call this without a `.catch`. A
// genuine failure still rejects.
export async function persistOnboardingGoal(userId, goal, deps = {}) {
  const { upsertProfileFields: upsert = upsertProfileFields } = deps
  if (!goal) return null
  try {
    return await upsert(userId, { onboarding_goal: goal })
  } catch (error) {
    if (isGoalColumnUnavailable(error)) return null
    throw error
  }
}
