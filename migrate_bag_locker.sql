-- ============================================================================
-- MIGRATION: bag locker membership (Track 1C)
--
-- PREREQUISITES (both required):
--   1. bags_schema.sql has been run (creates bags, bag_discs).
--   2. The 1B disc-locker migration's SCHEMA + SECTION 2 (BACKFILL) from
--      migrate_disc_locker_and_layouts.sql have been run, so discs.status
--      is populated. You do NOT need 1B's Section 3 (destructive cleanup)
--      for this — status exists as soon as Section 2 completes, and
--      Section 2 is reversible (old columns retained).
--
-- As of this writing, discs.status does not exist live yet (1B has not been
-- executed) — running this against the current database will fail with
-- "column discs.status does not exist". Run the two prerequisites above
-- first.
--
-- WHAT THIS DOES: for every user who owns at least one disc, creates a
-- default bag (if they don't already have one) named "My Bag" and adds
-- every disc with status = 'in_locker' owned by that user to it. Idempotent:
-- reruns skip users who already have a default bag and skip discs already
-- in a bag they own (ON CONFLICT DO NOTHING on the unique (bag_id, disc_id)
-- pair) — but note it will NOT create a second default bag for a user who
-- already has one, even if new in_locker discs appeared since.
-- ============================================================================

begin;

-- 1. One default bag per user who owns any disc and doesn't already have one.
insert into bags (user_id, name, is_default)
select distinct d.user_id, 'My Bag', true
from discs d
where not exists (
  select 1 from bags b where b.user_id = d.user_id and b.is_default
);

-- 2. Add every in-locker disc to its owner's default bag.
insert into bag_discs (bag_id, disc_id)
select b.id, d.id
from discs d
join bags b on b.user_id = d.user_id and b.is_default
where d.status = 'in_locker'
on conflict (bag_id, disc_id) do nothing;

commit;

-- Verification:
select 'users_without_default_bag' as check_name, count(*) as fail_count
from (select distinct user_id from discs) d
where not exists (select 1 from bags b where b.user_id = d.user_id and b.is_default)
union all
select 'in_locker_discs_not_in_default_bag', count(*)
from discs d
join bags b on b.user_id = d.user_id and b.is_default
where d.status = 'in_locker'
  and not exists (select 1 from bag_discs bd where bd.bag_id = b.id and bd.disc_id = d.id);
