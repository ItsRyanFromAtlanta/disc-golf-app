-- Phase E — persist the onboarding Step-1 goal (defect register `D-15`).
--
-- **NOT APPLIED.** Written, reviewed, and deliberately left unapplied; the client degrades to a
-- no-write no-op while this is absent (see "Degradation" below). Apply with the other Phase E
-- migrations when an owner is at a console.
--
-- Why a `profiles` column and not the Phase D3 `goals` table (`20260716220000_phase_d3_goal_report
-- _contracts.sql`, `src/lib/goals.js`): that table's four `GOAL_TYPES` are measurable targets — a
-- number, a unit, a start date, an optional target date, and a create/pause/complete/cancel
-- lifecycle with an event history (`goal_create` / `goal_transition` RPCs). Onboarding Step 1
-- collects none of that. `GOAL_OPTIONS` (`src/lib/onboarding.js`) are three dashboard-focus tags —
-- 'consistency' | 'bag' | 'analytics' — with no target value and no date; even the option whose id
-- happens to match a `GOAL_TYPES` entry ('consistency') names a different fact (a UI preference,
-- not a percentage target). Writing a `goals` row here would mean fabricating a `target_value` and
-- `target_unit` the user never supplied — planting a synthetic, unmanageable row in a feature that
-- is otherwise entirely user-authored. That is worse than the discard this migration closes, so this
-- is a plain preference column beside `units`, not a goals-table write.
--
-- Ideal format (stated before the DDL, per the schema convention):
--   onboarding_goal text, null allowed (existing accounts and any account that skips the migration
--     window have no value and are not backfilled), CHECK against the three ids GoalStep renders.
--   Not a foreign key / lookup table: three static, code-defined options with no independent
--     lifecycle of their own — the same shape as `bh_confidence`'s four-value CHECK
--     (`phase_a_profile_schema.sql`), not the shape `goals.goal_type` earns from having rows that
--     reference it.
--
-- RLS: none added. `profiles` already restricts all access to the owning row, and a column added to
-- an existing table inherits its table's policies.
--
-- GRANT: `layer5_gamification_hardening.sql` revoked the table-wide UPDATE grant on `profiles` and
-- re-granted an explicit column list — any column added after that migration needs a compensating
-- grant or every write 42501s (insufficient_privilege) even once the column exists. The register's
-- § 5 flags `round_turn_prompt_enabled` and `timezone` as two earlier columns that may have shipped
-- without this compensating grant (unverified against the live project) — not a mistake to repeat
-- here on a column being added with full knowledge of the hazard.
--
-- Degradation while this is unapplied (or partially applied — column landed, grant pending):
-- PostgREST answers a missing column with PGRST204 / `42703` from Postgres directly; a missing grant
-- on an existing column answers `42501`. `isGoalColumnUnavailable` (`src/lib/onboarding.js`)
-- recognises all three and `persistOnboardingGoal` resolves to `null` rather than throwing for any
-- of them — restated locally rather than imported from `DEPLOY_LAG_CODES`
-- (`src/lib/instantLaunch/errorClassification.js`) for the same reason `isProvisioningRpcMissing`
-- above restates it: that set means "keep retrying an outbox write", this means "give up quietly,
-- there is nothing queued to retry." `OnboardingPage` calls it without awaiting the result, so even
-- a genuine, non-degradable failure cannot strand a user who already answered Step 1's question.
--
-- Rollback:
--   revoke update on public.profiles from authenticated;
--   grant update (
--     id, username, pdga_number, division, home_course_id, created_at, handedness,
--     bh_confidence, fh_confidence, bh_max_distance_ft, bh_max_distance_source,
--     fh_max_distance_ft, fh_max_distance_source, c1_comfort_ft, c1_comfort_source,
--     specialty_shots, target_rating, units, injury_notes, pdga_rating
--   ) on public.profiles to authenticated;
--   alter table public.profiles drop column if exists onboarding_goal;
-- Dropping the column discards only the recorded focus tag; nothing else on `profiles` is touched.
-- A client that has already shipped `persistOnboardingGoal` degrades to the no-op path the moment
-- either statement above lands — no client rollback needed.

alter table public.profiles
  add column if not exists onboarding_goal text
    check (onboarding_goal in ('consistency', 'bag', 'analytics'));

revoke update on public.profiles from authenticated;
grant update (
  id, username, pdga_number, division, home_course_id, created_at, handedness,
  bh_confidence, fh_confidence, bh_max_distance_ft, bh_max_distance_source,
  fh_max_distance_ft, fh_max_distance_source, c1_comfort_ft, c1_comfort_source,
  specialty_shots, target_rating, units, injury_notes, pdga_rating, onboarding_goal
) on public.profiles to authenticated;
