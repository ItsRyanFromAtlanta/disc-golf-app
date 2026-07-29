-- Live-database verification for questions the repository cannot settle.
--
-- Every documentation claim in docs/ui/ is read from applied schema FILES.
-- Nothing in the 2026-07-29 pass reached the live project: every Supabase MCP
-- call returns "MCP tool call requires approval" and never arrives, the same
-- condition recorded in docs/development/CURRENT_WORK.md on 2026-07-28.
--
-- Run these in the Supabase dashboard SQL editor. Each block is read-only
-- except Q3, which is explicitly wrapped in a rollback-only transaction.
-- Record the answers in docs/ui/CORRECTIONS_LEDGER.md and close the entries.
--
--
-- ============================================================
-- RUNBOOK — run in this order, not the order they appear below
-- ============================================================
--
-- The blocks are numbered by topic. This is the order to actually run them,
-- chosen so each step can short-circuit the next and the one destructive-
-- looking probe goes last.
--
--   1st  Q5  Which migrations are applied
--   2nd  Q2  profiles column grants
--   3rd  Q1  Trigger existence
--   4th  Q4  delete_own_account
--   5th  Q3  Multi-row insert probe        <- only if Q1 found the putt-cap trigger
--
-- WHY THIS ORDER
--
-- Q5 first because it is one cheap query that can pre-answer two others. If
--   20260727120000 is absent, Q4 is already answered. If the Layer 1 file
--   never landed, Q1's result is predictable.
--   CAVEAT: this repo has applied raw .sql from the dashboard at times, and
--   those do not appear in supabase_migrations.schema_migrations. A missing
--   row is weak evidence of absence; Q1 and Q4 test the objects directly and
--   are authoritative where they disagree.
--
-- Q2 second because it is the highest-consequence unknown and depends on
--   nothing. If those grants are missing, both Settings controls fail, and
--   SettingsPage.jsx:39 renders page-replacing on any error — so the whole
--   screen blanks, including the data export and account deletion panels.
--   That converts a quiet grant omission into a broken App Review surface.
--   Run it before deciding anything about a submission.
--
-- Q1 third because it settles what the documentation could not: the file-level
--   adjudication (CORRECTIONS_LEDGER C-9) proved the schema FILES define
--   enforce_bag_capacity, not that it was deployed. An empty result promotes
--   DEFECT_REGISTER D-19 from a UX defect to a data-integrity one. It also
--   gates Q3, because the same query reports the putting_regimen_sets trigger.
--
-- Q4 fourth because it is a yes/no on an App Review blocker, and Q5 may
--   already have answered it. Cheap either way; run it to be certain, since
--   IOS_READINESS and CURRENT_WORK have disagreed about this before.
--
-- Q3 last, and only if Q1 returned a putting_regimen_sets trigger. With no
--   trigger there is nothing to probe and the 100-putt ceiling is app-side
--   only — already the answer. Q3 also needs a real user id substituted and
--   is the only block that writes anything, even though it rolls back. Do not
--   run it first out of curiosity.
--
-- STOP CONDITIONS
--
--   Q2 returns false for either column  -> stop and fix the grant before any
--                                          further App Review work.
--   Q1 returns no bag_discs trigger     -> stop and re-rank D-19 before
--                                          anyone acts on capacity behavior.
--
-- Both are cases where continuing down the list would mean planning on top of
-- a wrong assumption.


-- ============================================================
-- Q1. Does the 35-disc bag interlock exist in the live database?
--
-- Two agents reached opposite conclusions from the schema files; the
-- adjudication (CORRECTIONS_LEDGER, C-9) found a BEFORE INSERT trigger at
-- layer1_foundation_schema.sql:230-253 and rejected the "no enforcement"
-- claim. That resolves the FILES. It does not prove the trigger was applied.
--
-- EXPECT: one row, bag_discs_capacity_check -> enforce_bag_capacity.
-- IF EMPTY: the interlock is unenforced in production and DEFECT_REGISTER
--           D-19 becomes a data-integrity defect rather than a UX one.
-- ============================================================
select  t.tgname          as trigger_name,
        c.relname         as table_name,
        p.proname         as function_name,
        t.tgenabled       as enabled_flag
from    pg_trigger t
join    pg_class    c on c.oid = t.tgrelid
join    pg_proc     p on p.oid = t.tgfoid
where   not t.tgisinternal
  and   c.relname in ('bag_discs', 'putting_regimen_sets')
order by c.relname, t.tgname;


-- ============================================================
-- Q2. Can the app actually UPDATE profiles.timezone and
--     profiles.round_turn_prompt_enabled?
--
-- layer5_gamification_hardening.sql:170-176 revoked table-wide UPDATE on
-- profiles and re-granted an explicit 20-column list. Both columns were added
-- 2026-07-16, AFTER that grant, and neither Phase D migration re-grants them.
--
-- This is the unresolved entry carried from _corrections/me-screens.md C-4.
--
-- EXPECT: true for every row.
-- IF FALSE: both Settings controls fail, and because SettingsPage.jsx:39
--           renders page-replacing on any error, the failure blanks the whole
--           screen -- including the data export and account deletion panels.
-- ============================================================
select  col                                                as column_name,
        has_column_privilege('authenticated', 'public.profiles', col, 'UPDATE') as can_update
from    unnest(array[
          'timezone',
          'round_turn_prompt_enabled',
          'units',            -- control: was in the original 20-column grant
          'target_rating'     -- control: same
        ]) as col;


-- ============================================================
-- Q3. Does the 100-putt cap trigger fire on a MULTI-ROW insert?
--
-- enforce_routine_putt_cap() is BEFORE INSERT ... FOR EACH ROW and sums
-- sibling rows. createCustomRegimen inserts every set row in ONE statement.
-- Whether a per-row BEFORE trigger's aggregate SELECT sees earlier rows of
-- its own statement is a Postgres visibility question no test in the repo
-- covers, and it cannot be answered by reading the schema.
--
-- ROLLBACK-ONLY. Nothing below is committed.
--
-- EXPECT (cap holds): the insert raises check_violation and you see the
--   friendly message. Note that even then, an archived orphan regimen may be
--   left behind -- see DEFECT_REGISTER and EXECUTION_PLAN.
-- IF IT SUCCEEDS: a 120-putt routine can be created through the app's real
--   write path, the ceiling is app-side only, and SCREEN_SPECS standing
--   divergence #6 overstates enforcement a second time.
-- ============================================================
begin;

-- Substitute a real user id before running.
--   select id from auth.users limit 1;
with new_regimen as (
  insert into putting_regimens (id, name, created_by, drill_type)
  values (gen_random_uuid(), 'CAP PROBE -- rollback only', '00000000-0000-0000-0000-000000000000', 'ladder')
  returning id
)
insert into putting_regimen_sets
        (id, regimen_id, set_order, distance_feet_min, distance_feet_max, reps_required)
select  gen_random_uuid(), new_regimen.id, gs, 20, 20, 20   -- 6 x 20 = 120 > 100
from    new_regimen, generate_series(1, 6) as gs;

rollback;


-- ============================================================
-- Q4. Is the account-deletion RPC applied?
--
-- Migration 20260727120000_phase_e_account_deletion.sql creates
-- public.delete_own_account(). CURRENT_WORK.md lists it as written and NOT
-- applied; the Settings delete button therefore fails with an
-- undefined-function error. It is an App Review blocker under Guideline
-- 5.1.1(v), and IOS_READINESS.md previously claimed it was fixed.
--
-- EXPECT if applied: one row, security_definer = true.
-- IF EMPTY: apply the migration before any App Store submission.
-- ============================================================
select  p.proname            as function_name,
        p.prosecdef          as security_definer,
        pg_get_userbyid(p.proowner) as owner
from    pg_proc p
join    pg_namespace n on n.oid = p.pronamespace
where   n.nspname = 'public'
  and   p.proname = 'delete_own_account';

-- And confirm anon cannot execute it, per the migration's own smoke checks.
select  has_function_privilege('anon', 'public.delete_own_account()', 'EXECUTE') as anon_can_execute;


-- ============================================================
-- Q5. Which migrations are actually applied?
--
-- Settles the file-versus-live gap generally rather than one claim at a time.
-- Compare against the .sql files in the repository root.
-- ============================================================
select  version, name
from    supabase_migrations.schema_migrations
order by version desc
limit   40;
