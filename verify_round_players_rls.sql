-- ============================================================================
-- RLS NEGATIVE TESTS — public.round_players
-- (migration `supabase/migrations/20260730234500_phase_e_round_players.sql`)
--
-- STATUS: **WRITTEN AND UNPROVEN.** Not one assertion below has been executed.
-- The migration is unapplied, this environment has no live database
-- credentials, and none of the claims in the migration header about what RLS
-- enforces should be described as verified until this file has been run and
-- every expectation observed.
--
-- Deliberately NOT under `supabase/migrations/`, where `supabase db push`
-- would execute it as a migration.
--
-- HOW TO RUN. Against a throwaway Postgres cluster with the migration applied,
-- as a superuser, after creating two real `auth.users` rows. Each block sets
-- `role authenticated` and `request.jwt.claims` so `auth.uid()` resolves, which
-- is what makes these tests of the POLICIES rather than of the owner's own
-- session. `set local` inside an explicit transaction, so nothing leaks between
-- cases. The final `rollback` leaves the database byte-identical — the same
-- discipline migration `20260730025443`'s probe used.
--
-- Every case states what MUST happen. A case that "passes" because the write
-- failed for some other reason has proved nothing, so several cases carry a
-- positive control immediately beside them: if the control does not succeed,
-- the negative result is meaningless.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures. Two accounts, a shared community course, one round each.
-- ---------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('alice',        gen_random_uuid()),
  ('bob',          gen_random_uuid()),
  ('course',       gen_random_uuid()),
  ('alice_round',  gen_random_uuid()),
  ('bob_round',    gen_random_uuid()),
  ('player_a',     gen_random_uuid()),
  ('player_b',     gen_random_uuid());

-- Replace with the fixture-user creation your harness uses; `auth.users` has
-- NOT NULL columns beyond these in a real Supabase project.
insert into auth.users (id, email)
select v, k || '@example.test' from t_ids where k in ('alice', 'bob');

insert into public.courses (id, name)
select v, 'Negative Test Park' from t_ids where k = 'course';

insert into public.rounds (id, user_id, course_id)
select (select v from t_ids where k = 'alice_round'),
       (select v from t_ids where k = 'alice'),
       (select v from t_ids where k = 'course');

insert into public.rounds (id, user_id, course_id)
select (select v from t_ids where k = 'bob_round'),
       (select v from t_ids where k = 'bob'),
       (select v from t_ids where k = 'course');

-- The activity bridge (`rounds_activity_owner_fkey`) may require an
-- `activities` row per round depending on how the fixture cluster was built;
-- insert them if the round inserts above fail on that constraint.

-- ---------------------------------------------------------------------------
-- Helper: run one statement as an authenticated user and report the outcome.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.as_user(p_user uuid, p_sql text)
returns text language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format(
    'set local request.jwt.claims = %L',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text
  );
  execute p_sql;
  execute 'reset role';
  return 'ok';
exception when others then
  execute 'reset role';
  return sqlstate;
end $$;

-- ---------------------------------------------------------------------------
-- POSITIVE CONTROL 0 — an owner CAN add a companion to their own round.
-- MUST return 'ok'. If this fails, every negative case below is worthless.
-- ---------------------------------------------------------------------------
select 'control_owner_insert_allowed' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 1, ''Dave'')',
           (select v from t_ids where k = 'player_a'),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       'ok' as expected;

-- ---------------------------------------------------------------------------
-- NEGATIVE 1 — Bob cannot SELECT Alice's companion rows.
-- MUST return 0 rows. Not an error: RLS filters, it does not raise.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
reset role;

select 'negative_1_cross_user_select_returns_nothing' as case_name,
       (select count(*) from public.round_players) as visible_rows,
       0 as expected_rows
  from (select set_config(
          'request.jwt.claims',
          json_build_object('sub', (select v from t_ids where k = 'bob')::text,
                            'role', 'authenticated')::text,
          true)) _;
-- NOTE: run the count with `role authenticated` actually set — the wrapper
-- above only sets the claim. In a real run this is:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<bob>","role":"authenticated"}';
--   select count(*) from public.round_players;  -- MUST be 0
--   reset role;

-- ---------------------------------------------------------------------------
-- NEGATIVE 2 — Bob cannot INSERT a companion row claiming Alice as owner.
-- MUST return '42501' (insufficient privilege / RLS violation), from the
-- `round_players_insert_own` WITH CHECK.
-- ---------------------------------------------------------------------------
select 'negative_2_insert_as_other_owner_denied' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'bob'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 2, ''Smuggled'')',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       '42501' as expected;

-- ---------------------------------------------------------------------------
-- NEGATIVE 3 — Bob cannot attach HIS OWN companion row to ALICE's round.
-- This is the case the composite FK exists for, and it must fail even though
-- the RLS WITH CHECK is satisfied (`user_id` really is Bob's).
-- MUST return '23503' (foreign key violation) — NOT '42501'. A 42501 here
-- would mean RLS caught it and the structural guarantee is untested.
-- ---------------------------------------------------------------------------
select 'negative_3_own_row_on_other_round_denied_structurally' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'bob'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 3, ''Wrong round'')',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'bob')
         )
       ) as result,
       '23503' as expected;

-- ---------------------------------------------------------------------------
-- NEGATIVE 4 — Bob cannot UPDATE Alice's companion row.
-- MUST report 0 rows updated. RLS makes the row invisible to the UPDATE's
-- USING clause, so this is a silent no-op rather than an error; assert on the
-- unchanged value, not on an exception.
--   set local role authenticated; (as bob)
--   update public.round_players set display_name = 'Hijacked'
--     where id = '<player_a>';           -- MUST affect 0 rows
--   reset role;
--   select display_name from public.round_players where id = '<player_a>';
--                                        -- MUST still be 'Dave'
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- NEGATIVE 5 — Alice cannot UPDATE her own row to hand it to Bob.
-- This is what the UPDATE policy's WITH CHECK is for; without it the row would
-- move into Bob's account carrying a private third-party name.
-- MUST return '42501'.
-- ---------------------------------------------------------------------------
select 'negative_5_update_reassigning_owner_denied' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'update public.round_players set user_id = %L where id = %L',
           (select v from t_ids where k = 'bob'),
           (select v from t_ids where k = 'player_a')
         )
       ) as result,
       '42501' as expected;

-- ---------------------------------------------------------------------------
-- NEGATIVE 6 — Bob cannot DELETE Alice's companion row.
-- MUST affect 0 rows, and the row MUST still exist afterwards.
--   set local role authenticated; (as bob)
--   delete from public.round_players where id = '<player_a>';  -- 0 rows
--   reset role;
--   select count(*) from public.round_players where id = '<player_a>';  -- 1
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- NEGATIVE 7 — anon has no access at all.
-- The grants revoke everything from `anon`, so this MUST fail with '42501'
-- before RLS is even consulted.
-- ---------------------------------------------------------------------------
select 'negative_7_anon_select_denied' as case_name,
       (select case
          when has_table_privilege('anon', 'public.round_players', 'select')
          then 'HAS SELECT — FAIL' else 'no select — ok' end) as result,
       'no select — ok' as expected;

select 'negative_7b_anon_insert_denied' as case_name,
       (select case
          when has_table_privilege('anon', 'public.round_players', 'insert')
          then 'HAS INSERT — FAIL' else 'no insert — ok' end) as result,
       'no insert — ok' as expected;

-- ---------------------------------------------------------------------------
-- CONSTRAINT 8 — the seat cap is enforced by the database, not only the app.
-- MUST return '23514' (check violation) for position 8, and for position 0.
-- ---------------------------------------------------------------------------
select 'constraint_8_position_above_cap_rejected' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 8, ''Eighth'')',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       '23514' as expected;

select 'constraint_8b_position_zero_rejected' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 0, ''Zeroth'')',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       '23514' as expected;

-- ---------------------------------------------------------------------------
-- CONSTRAINT 9 — the seat is the natural key. A second row in seat 1 on the
-- same round MUST fail with '23505'. This is what makes the client's upsert on
-- `(round_id, position)` converge instead of duplicating (audit finding 1).
-- ---------------------------------------------------------------------------
select 'constraint_9_duplicate_seat_rejected' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 1, ''Second Dave'')',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       '23505' as expected;

-- POSITIVE CONTROL 9b — the SAME seat number on a DIFFERENT round MUST still
-- be accepted. Without this contrast, case 9 could be passing because seats are
-- globally unique, which would break every second round.
select 'control_9b_same_seat_other_round_allowed' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'bob'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 1, ''Bob''''s companion'')',
           (select v from t_ids where k = 'player_b'),
           (select v from t_ids where k = 'bob_round'),
           (select v from t_ids where k = 'bob')
         )
       ) as result,
       'ok' as expected;

-- ---------------------------------------------------------------------------
-- CONSTRAINT 10 — a blank or whitespace-only name MUST fail with '23514'.
-- The client normalizes before writing so this should never fire in practice;
-- the point is that the database does not depend on the client for it.
-- ---------------------------------------------------------------------------
select 'constraint_10_blank_name_rejected' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name)
            values (%L, %L, %L, 4, ''   '')',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       '23514' as expected;

-- ---------------------------------------------------------------------------
-- CONSTRAINT 11 — a negative stated total MUST fail with '23514'.
-- ---------------------------------------------------------------------------
select 'constraint_11_negative_total_rejected' as case_name,
       pg_temp.as_user(
         (select v from t_ids where k = 'alice'),
         format(
           'insert into public.round_players (id, round_id, user_id, position, display_name, total_score)
            values (%L, %L, %L, 5, ''Negative'', -1)',
           gen_random_uuid(),
           (select v from t_ids where k = 'alice_round'),
           (select v from t_ids where k = 'alice')
         )
       ) as result,
       '23514' as expected;

-- ---------------------------------------------------------------------------
-- CASCADE 12 — deleting the round removes its roster; deleting the account
-- removes everything. Both are relied on by `delete_own_account()`
-- (`20260729213112`), which deletes only the `auth.users` row and trusts the
-- cascades.
--   delete from public.rounds where id = '<alice_round>';
--   select count(*) from public.round_players where round_id = '<alice_round>';
--                                                            -- MUST be 0
--   delete from auth.users where id = '<bob>';
--   select count(*) from public.round_players where user_id = '<bob>';
--                                                            -- MUST be 0
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- INVARIANT 13 — this table creates no activities. After every case above:
--   select count(*) from public.activities;   -- MUST equal the count taken
--                                             -- before the fixtures ran, plus
--                                             -- only the two round activities.
-- The single-active invariant (`activities_one_current_per_user_idx`) is
-- untouched by a group round precisely because a companion is not an activity.
-- ---------------------------------------------------------------------------

rollback;
