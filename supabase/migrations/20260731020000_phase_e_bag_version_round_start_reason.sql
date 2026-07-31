-- Phase E2 follow-up: an honest `'round_start'` bag-version reason
-- (E2_ROUND_COURSE_AUDIT.md finding F3).
--
-- WRITTEN, NOT APPLIED. Per the 2026-07-30 standing decision, migrations are
-- applied by the owner from the Supabase dashboard.
--
-- ============================================================
-- WHY THIS EXISTS
-- ============================================================
-- `roundRepository.useCreateRound` captures a `bag_versions` snapshot at the
-- first tee so a round can later be checked against what was actually carried
-- (`roundBagVerification.js`). It does this by calling `captureBagVersion`,
-- which defaults its `reason` argument to `'grouped_save'` and the round path
-- never overrides it — so every round-start snapshot claims to have been taken
-- because the bag was saved, which is not what happened. `bag_versions.reason`
-- already has room for a fourth value most callers don't use
-- (`system_backfill`), but there has never been a value for this, the single
-- most common reason a version gets captured outside an explicit bag edit.
--
-- Widening the vocabulary needs two changes, both in this file, because the
-- CHECK constraint and the RPC's own guard are independent gates: the column
-- accepts a value the function still refuses to write. This migration was
-- believed to only need the column widened until `capture_bag_version`'s own
-- `if p_reason not in (...)` check was re-read for this change -- it is
-- stricter than the column, and misses `system_backfill` too, which is
-- unrelated to this fix and is left as it was: that value is written only by
-- the one-off backfill INSERT in `20260715183500_phase_b_disc_timelines_bag_versions.sql`,
-- never by this RPC, so this migration does not add it here.
--
-- ============================================================
-- WHY THE CLIENT MUST DEGRADE, NOT JUST SWITCH
-- ============================================================
-- `main` auto-deploys ahead of a migration landing on the dashboard, so there
-- is a routine window where a client built against this change is live while
-- the database still runs the two-reason function. Calling
-- `capture_bag_version` with `p_reason => 'round_start'` during that window
-- raises the function's own `'Invalid snapshot reason'` exception (SQLSTATE
-- P0001 — a plain `raise exception`, predating the
-- `attachResponseStatus`/`DEPLOY_LAG_CODES` convention in
-- `src/lib/instantLaunch/errorClassification.js`, so there is no distinguishing
-- code to key on the way a missing function or column has one).
--
-- Before this change, every online round start got a real snapshot (mislabeled,
-- but present). A client that started sending `'round_start'` unconditionally
-- would turn that into "no snapshot at all until the dashboard migration is
-- applied" — trading a provenance defect for a data-completeness regression on
-- every deployment gap, not just this one. `bagHistoryRepository.captureBagVersion`
-- is changed alongside this migration (not part of it — this file is DDL only)
-- to try `'round_start'` first and, on exactly this rejection, retry once with
-- `'grouped_save'` before giving up. Once this migration is applied the retry
-- branch stops firing and every round gets the honest label on the first
-- attempt; the client change is inert until then, not wrong.
--
-- ============================================================
-- HOW THIS FILE WAS PRODUCED
-- ============================================================
-- `capture_bag_version`'s body below is the CURRENT body from
-- `20260715183500_phase_b_disc_timelines_bag_versions.sql`, extracted verbatim
-- and amended in exactly one line (the `if p_reason not in (...)` guard). Not
-- retyped from memory, for the same reason the D-03 migration gives: a wrong
-- version of this function would silently change what every bag-version write
-- accepts.
--
-- Before applying, diff it against the live definition — `pg_get_functiondef`
-- is authoritative if the database and the repo have diverged.
--
-- ROLLBACK:
--   alter table public.bag_versions
--     drop constraint if exists bag_versions_reason_check,
--     add constraint bag_versions_reason_check
--       check (reason in ('initial_snapshot', 'grouped_save', 'restore', 'system_backfill'));
--   -- then re-apply 20260715183500_phase_b_disc_timelines_bag_versions.sql's
--   -- `capture_bag_version` definition (the four-clause CASE without
--   -- 'round_start'), which restores the narrower guard.
-- Any `bag_versions` row already written with `reason = 'round_start'` violates
-- the restored CHECK and blocks the rollback until it is dealt with (re-label
-- to `'grouped_save'`, which is the fact the row would have recorded before
-- this migration, or delete — a version row is a snapshot, not a scoring fact,
-- so re-labelling loses nothing a player can see). A client still shipping the
-- `'round_start'` reason after a rollback gets the same `'Invalid snapshot
-- reason'` exception this migration exists to stop, and the paired client
-- change already degrades to `'grouped_save'` for exactly that response, so
-- rounds keep getting snapshots either way — roll the client back too if the
-- mislabeling itself needs to stop, not just the schema.

begin;

alter table public.bag_versions
  drop constraint if exists bag_versions_reason_check,
  add constraint bag_versions_reason_check
    check (reason in ('initial_snapshot', 'grouped_save', 'restore', 'system_backfill', 'round_start'));

create or replace function public.capture_bag_version(
  p_bag_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_restored_from_version_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  bag_row public.bags%rowtype;
  version_id uuid := gen_random_uuid();
  next_version integer;
  existing_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('grouped_save', 'restore', 'round_start') then raise exception 'Invalid snapshot reason'; end if;

  select id into existing_id from public.bag_versions where idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  select * into bag_row from public.bags where id = p_bag_id and user_id = owner_id for update;
  if not found then raise exception 'Bag not found'; end if;
  select coalesce(max(version), 0) + 1 into next_version
    from public.bag_versions where bag_id = p_bag_id;

  insert into public.bag_versions (
    id, user_id, bag_id, version, name, description, bag_type, capacity, is_default,
    reason, source, restored_from_version_id, idempotency_key
  ) values (
    version_id, owner_id, bag_row.id, next_version, bag_row.name, bag_row.description,
    bag_row.bag_type, bag_row.capacity, bag_row.is_default, p_reason, 'manual_entry',
    p_restored_from_version_id, p_idempotency_key
  );

  insert into public.bag_version_discs (id, user_id, bag_version_id, disc_id, added_at)
  select gen_random_uuid(), owner_id, version_id, bd.disc_id, bd.added_at
  from public.bag_discs bd where bd.bag_id = p_bag_id;
  return version_id;
end;
$$;

revoke all on function public.capture_bag_version(uuid, text, text, uuid) from public, anon;
grant execute on function public.capture_bag_version(uuid, text, text, uuid) to authenticated;

commit;

-- ============================================================
-- POST-APPLY VERIFICATION (run in a rollback-only transaction)
-- ============================================================
-- 1. THE POINT: a round-start capture with the honest reason succeeds and is
--    labelled correctly.
--      select public.capture_bag_version(<a bag you own>, 'round_start', 'verify:round-start-1');
--      select reason from public.bag_versions where idempotency_key = 'verify:round-start-1';
--      -- expect 'round_start'
-- 2. Regression: the two reasons every existing caller sends are still
--    accepted. `'grouped_save'` (grouped_save_bag / addDiscToBag /
--    removeDiscFromBag) and `'restore'` (restore_bag_version) each still
--    insert without error.
-- 3. Still rejected: an arbitrary string still raises 'Invalid snapshot
--    reason' -- the guard is widened, not removed.
--      select public.capture_bag_version(<a bag you own>, 'nonsense', 'verify:round-start-2');
--      -- expect the function to raise
-- 4. `system_backfill` is unaffected -- it is not writable through this RPC
--    before or after this migration, and no row's `reason` changes as a side
--    effect of this file.
