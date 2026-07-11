-- Layer 5 — disc_role_history table (blueprint integration, Screen 10 dependency).
-- Append-only per project convention: new file, no edits to prior schema files.
--
-- WHY: Screen 10 (Analytics & Settings Control Tower) plots equipment-milestone
-- markers on the trend chart at the exact timestamp a disc's role changed to
-- PRIMARY_PUTTER. discs.role (Layer 1) only stores the CURRENT value — there was
-- no history of past transitions to draw markers from. This file adds that
-- history, populated automatically by a trigger (never app writes), so it can
-- never drift from the discs table it mirrors.
--
-- IDEAL FORMAT: disc_id + role + changed_at, one row per transition (not a
-- snapshot table) — mirrors the check-constraint vocabulary already on
-- discs.role so app code can share the same enum. No "previous_role" column:
-- it's always derivable as the prior row for the same disc_id ordered by
-- changed_at, and storing it would be a redundant, driftable copy.
--
-- SAFETY: purely additive — new table, new indexes, new trigger function, two
-- new triggers on discs (AFTER INSERT/UPDATE, so they can't block or fail an
-- existing discs write). No existing columns or data touched. Idempotent
-- (if-exists/if-not-exists + not-exists guards throughout). A manual backup was
-- confirmed before this file was authored (CLAUDE.md gate).

create table if not exists disc_role_history (
  id uuid primary key default gen_random_uuid(),
  disc_id uuid not null references discs(id) on delete cascade,
  role text check (role in ('primary_putter','backup_putter','situational_weather','standard')),
  changed_at timestamptz not null default now()
);

create index if not exists disc_role_history_disc_id_changed_idx
  on disc_role_history (disc_id, changed_at);

alter table disc_role_history enable row level security;

-- Read-only to users (via their own discs); no insert/update/delete policy — the
-- table is populated exclusively by the trigger below (SECURITY DEFINER), same
-- pattern as merge_discs, so history can't be edited or backdated by a client.
create policy "Users view own disc role history"
  on disc_role_history for select
  using (exists (
    select 1 from discs where discs.id = disc_role_history.disc_id and discs.user_id = auth.uid()
  ));

create or replace function log_disc_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role is not null then
      insert into disc_role_history (disc_id, role, changed_at)
      values (new.id, new.role, coalesce(new.created_at, now()));
    end if;
  elsif new.role is distinct from old.role then
    insert into disc_role_history (disc_id, role, changed_at)
    values (new.id, new.role, now());
  end if;
  return new;
end;
$$;

drop trigger if exists discs_role_history_insert on discs;
create trigger discs_role_history_insert
  after insert on discs
  for each row execute function log_disc_role_change();

drop trigger if exists discs_role_history_update on discs;
create trigger discs_role_history_update
  after update on discs
  for each row execute function log_disc_role_change();

-- ============================================================
-- TEST DATA: seeds a realistic role-history arc on the exercised test account's
-- putter (Anode, user 35b59d46-c58d-4193-9de2-f09238c0d009 — the account with
-- real session/regimen-run history from Layer 4 live verification, see DEVLOG
-- 2026-07-08) so Screen 10's milestone-marker UI has something real to render
-- against: started standard-role, promoted to primary_putter mid-way through
-- this account's session history. Seeded BEFORE the general backfill below so
-- that backfill's not-exists guard skips this disc and leaves this arc intact.
-- ============================================================
insert into disc_role_history (disc_id, role, changed_at)
select 'c6691a99-36e3-4a58-9d20-43b590f8db13'::uuid, 'standard', '2026-07-06 00:22:52+00'::timestamptz
where not exists (
  select 1 from disc_role_history
  where disc_id = 'c6691a99-36e3-4a58-9d20-43b590f8db13' and role = 'standard'
);

insert into disc_role_history (disc_id, role, changed_at)
select 'c6691a99-36e3-4a58-9d20-43b590f8db13'::uuid, 'primary_putter', '2026-07-08 12:00:00+00'::timestamptz
where not exists (
  select 1 from disc_role_history
  where disc_id = 'c6691a99-36e3-4a58-9d20-43b590f8db13' and role = 'primary_putter'
);

-- ============================================================
-- GENERAL BACKFILL: every other disc that already has a role gets one honest
-- "as of now" row — we do NOT fabricate a false historical "changed at" moment
-- for pre-existing roles, since the real transition time is unknown. Screens
-- reading this table should treat backfilled rows as "known role as of backfill
-- time," not a true historical milestone.
-- ============================================================
insert into disc_role_history (disc_id, role, changed_at)
select d.id, d.role, now()
from discs d
where d.role is not null
  and not exists (select 1 from disc_role_history h where h.disc_id = d.id);
