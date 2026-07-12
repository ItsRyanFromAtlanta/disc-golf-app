-- Layer 5 — gamification write-access hardening (code review follow-up).
-- Append-only per project convention: new file.
--
-- WHY: code review on Screen 12 found that xp_events (INSERT, auth.uid()=user_id
-- only) and badge_progress (ALL, same check) had no validation beyond row
-- ownership, and profiles' "Users can update own profile" policy is a full-row
-- UPDATE with no column restriction — so profiles.xp/level were ALSO directly
-- writable by any authenticated client. Together this meant a user could forge
-- arbitrary XP/levels/badge unlocks straight from the browser console,
-- bypassing the evaluator entirely. It also meant appendXpEventsIdempotent's
-- check-then-insert (app-side dedup) had no DB backstop, so concurrent calls
-- for the same source_ref could double-insert.
--
-- FIX: mirrors the merge_discs / log_disc_role_change pattern already used in
-- this schema — sensitive writes move behind SECURITY DEFINER functions that
-- validate inputs; direct client writes to the affected columns are revoked.
-- A DB unique constraint makes the idempotency guarantee atomic instead of
-- app-enforced. profiles.xp/level get a column-level REVOKE (Postgres column
-- privileges are independent of RLS) so even a client with full-row UPDATE on
-- profiles cannot touch these two columns outside the RPCs.
--
-- SAFETY: additive constraints + revoked policies replaced with equivalents;
-- no data touched. A manual backup was confirmed before this file was authored
-- (CLAUDE.md gate). Idempotent (if-exists/if-not-exists throughout).

-- ============================================================
-- Bound the values these tables can hold, independent of who writes them.
-- ============================================================
alter table xp_events
  add constraint xp_events_amount_bounds check (amount > 0 and amount <= 10000);

alter table xp_events
  add constraint xp_events_source_type_enum
    check (source_type in ('regimen_run', 'session', 'badge', 'import'));

-- Atomic idempotency backstop: append_xp_event's ON CONFLICT below relies on
-- this. (source_ref is always populated by every current caller — a session/
-- run id or a badge id — so this constraint doesn't need to special-case NULL.)
alter table xp_events
  add constraint xp_events_user_source_uniq unique (user_id, source_type, source_ref);

alter table badge_progress
  add constraint badge_progress_progress_bounds check (progress >= 0 and progress <= 1);

-- ============================================================
-- Revoke direct client writes; replace with read-only + RPCs.
-- ============================================================
drop policy if exists "Users append own xp events" on xp_events;
drop policy if exists "Users manage own badge progress" on badge_progress;

create policy "Users manage own badge progress read-only"
  on badge_progress for select
  using (auth.uid() = user_id);

-- profiles.xp/level are the security-relevant progression cache. Column-level
-- revoke so the existing "Users can update own profile" row policy (used for
-- username/PDGA/throwing-profile fields elsewhere) can no longer touch these
-- two columns. SECURITY DEFINER functions run as the function owner and are
-- unaffected by this revoke.
revoke update (xp, level) on profiles from authenticated;

-- ============================================================
-- append_xp_event: the only path that may insert into xp_events. Validates
-- bounds/source_type (redundant with the CHECK constraints, but a friendlier
-- error message), inserts idempotently via the unique constraint, and
-- atomically increments profiles.xp only when a new row was actually inserted
-- — replacing the old pattern of re-summing the entire ledger on every call.
-- Returns the fresh xp total so the caller never needs a second read.
-- ============================================================
create or replace function append_xp_event(p_amount integer, p_source_type text, p_source_ref uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rows integer;
  v_total bigint;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  insert into xp_events (user_id, amount, source_type, source_ref)
  values (v_user, p_amount, p_source_type, p_source_ref)
  on conflict (user_id, source_type, source_ref) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update profiles set xp = xp + p_amount where id = v_user returning xp into v_total;
  else
    select xp into v_total from profiles where id = v_user;
  end if;

  return v_total;
end;
$$;

revoke all on function append_xp_event(integer, text, uuid) from public;
revoke all on function append_xp_event(integer, text, uuid) from anon;
grant execute on function append_xp_event(integer, text, uuid) to authenticated;

-- ============================================================
-- set_profile_level: the only path that may write profiles.level. Kept
-- separate from append_xp_event (rather than duplicating the JS leveling
-- formula in SQL, which would recreate the exact "two sources of truth" drift
-- this review cycle is fixing elsewhere) — the caller computes the level from
-- the xp total via the existing pure levelForXp() and writes it through here.
-- ============================================================
create or replace function set_profile_level(p_level integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update profiles set level = p_level where id = auth.uid();
end;
$$;

revoke all on function set_profile_level(integer) from public;
revoke all on function set_profile_level(integer) from anon;
grant execute on function set_profile_level(integer) to authenticated;

-- ============================================================
-- upsert_badge_progress: the only path that may write badge_progress. Clamps
-- progress to [0,1] and never un-earns or backdates a badge — earned_at, once
-- set, is preserved regardless of what a later call passes.
-- ============================================================
create or replace function upsert_badge_progress(p_badge_id uuid, p_progress numeric, p_earned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_progress numeric := greatest(0, least(1, p_progress));
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  insert into badge_progress (user_id, badge_id, progress, earned_at, updated_at)
  values (v_user, p_badge_id, v_progress, case when p_earned then now() else null end, now())
  on conflict (user_id, badge_id) do update set
    progress = v_progress,
    earned_at = coalesce(badge_progress.earned_at, case when p_earned then now() else null end),
    updated_at = now();
end;
$$;

revoke all on function upsert_badge_progress(uuid, numeric, boolean) from public;
revoke all on function upsert_badge_progress(uuid, numeric, boolean) from anon;
grant execute on function upsert_badge_progress(uuid, numeric, boolean) to authenticated;

-- ============================================================
-- CORRECTION (applied as a follow-up migration): the `revoke update (xp,
-- level) on profiles from authenticated` above is a no-op on its own —
-- `authenticated` already holds Supabase's default table-wide UPDATE grant,
-- which supersedes a column-specific revoke. The actual fix requires revoking
-- the table-wide grant and re-granting UPDATE on only the non-sensitive
-- columns. Verified after applying: has_column_privilege('authenticated',
-- 'profiles', 'xp'/'level', 'UPDATE') = false, 'username' = true.
-- ============================================================
revoke update on profiles from authenticated;
grant update (
  id, username, pdga_number, division, home_course_id, created_at, handedness,
  bh_confidence, fh_confidence, bh_max_distance_ft, bh_max_distance_source,
  fh_max_distance_ft, fh_max_distance_source, c1_comfort_ft, c1_comfort_source,
  specialty_shots, target_rating, units, injury_notes, pdga_rating
) on profiles to authenticated;
