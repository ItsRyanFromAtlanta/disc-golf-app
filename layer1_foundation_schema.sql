-- Layer 1 — Foundation schema additions (blueprint integration).
-- Append-only per project convention. Absorbs blueprint concepts additively
-- onto the shipped Vite+Supabase schema (never a wholesale replacement):
-- putter-lineup role + wear + odometer, profile rating/XP/level, session
-- weather, putt_events.putter_disc_id, custom routines, badges/XP ledger,
-- the two hard interlocks (35-disc bag, 100-putt routine) at the DB layer,
-- and the disc-merge consolidation function.
--
-- SAFETY: This file does NO data backfill and drops NO columns. It DOES make
-- two non-destructive constraint relaxations on putting_regimens (difficulty
-- loses NOT NULL and its global-unique, replaced by a partial unique index for
-- system rows) and REPLACES the read-open RLS on putting_regimens /
-- putting_regimen_sets with system-or-own visibility so custom routines are not
-- globally readable. No rows are lost. A manual backup was confirmed before
-- this file was authored (CLAUDE.md gate).
--
-- Idempotent: safe to re-run (if-exists / if-not-exists throughout).

-- ============================================================
-- DISCS: putter-lineup role, wear score, odometer
-- (blueprint Screen 6). All additive; role/wear nullable, odometer defaulted.
-- ============================================================
alter table discs
  add column if not exists role text
    check (role in ('primary_putter','backup_putter','situational_weather','standard')),
  add column if not exists wear_score numeric
    check (wear_score >= 1 and wear_score <= 10),
  add column if not exists total_chain_hits integer not null default 0
    check (total_chain_hits >= 0);

-- Blueprint "Primary Putter: max 1" — enforced per user at the DB.
create unique index if not exists discs_one_primary_putter_per_user
  on discs (user_id) where role = 'primary_putter';

create index if not exists discs_role_idx on discs (role) where role is not null;

-- NOTE: total_chain_hits is a STORED counter, incremented app-side (and in the
-- Dexie mirror) from BOTH the batch ribbon and gesture capture. Do NOT add a
-- trigger that increments it on putt_events insert: per CLAUDE.md's data-split
-- rule, batch-ribbon putts never create putt_events, so such a trigger would
-- silently undercount every batch-logged putt.

-- ============================================================
-- PROFILES: current PDGA rating + XP/level
-- (pdga_number, division, target_rating already exist.) Level is DERIVED from
-- XP by lib/gamification (calculateXpForLevel); stored here as a denormalized
-- cache updated post-scoring. xp_events (below) is the source-of-truth ledger.
-- ============================================================
alter table profiles
  add column if not exists pdga_rating integer,
  add column if not exists xp bigint not null default 0 check (xp >= 0),
  add column if not exists level integer not null default 1 check (level >= 1);

-- ============================================================
-- PUTT_EVENTS: which putter threw the event (Screen 9 putter breakdown)
-- Nullable FK; 0 rows live so this is free.
-- ============================================================
alter table putt_events
  add column if not exists putter_disc_id uuid references discs(id);

create index if not exists putt_events_putter_disc_id_idx
  on putt_events (putter_disc_id) where putter_disc_id is not null;

-- ============================================================
-- SESSION WEATHER (session-level, both practice-session parents)
-- Mirrors how notes/tags were added to both tables. Per-event weather is a
-- later scoring-canvas concern; session-level matches the blueprint session log.
-- ============================================================
alter table putting_regimen_runs
  add column if not exists weather_condition text
    check (weather_condition in ('clear','headwind','tailwind','crosswind','rain')),
  add column if not exists wind_mph integer check (wind_mph >= 0);

alter table putt_sessions
  add column if not exists weather_condition text
    check (weather_condition in ('clear','headwind','tailwind','crosswind','rain')),
  add column if not exists wind_mph integer check (wind_mph >= 0);

-- ============================================================
-- CUSTOM ROUTINES: extend putting_regimens rather than a parallel tree, so the
-- existing sets / runs / run_sets / scoring engine all work unchanged.
--   user_id null  => system regimen (the fixed 5)
--   user_id set   => a user's custom routine
-- ============================================================
alter table putting_regimens
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists drill_type text,        -- e.g. 'ladder' | 'perfect_100' | 'pressure'
  add column if not exists rules_config jsonb,      -- per-routine scoring/bonus config for custom routines
  -- Soft delete: routines are archived, never hard-deleted, so their historical
  -- putting_regimen_runs (referenced with no cascade) and the analytics/PB
  -- features that read them stay intact. The app filters archived out of pickers.
  add column if not exists archived boolean not null default false;

-- Relax difficulty for custom routines while preserving the system invariant:
-- exactly one system regimen per difficulty 1..5. The old column-level UNIQUE
-- (putting_regimens_difficulty_key) is replaced by a partial unique index.
alter table putting_regimens alter column difficulty drop not null;
alter table putting_regimens drop constraint if exists putting_regimens_difficulty_key;
create unique index if not exists putting_regimens_system_difficulty_uniq
  on putting_regimens (difficulty) where user_id is null;

create index if not exists putting_regimens_user_id_idx
  on putting_regimens (user_id) where user_id is not null;

-- RLS reshape: the old policies were select-open to all authenticated users,
-- which would leak every user's custom routine. Replace with system-or-own.
drop policy if exists "Anyone authenticated can view regimens" on putting_regimens;
drop policy if exists "Anyone authenticated can view regimen sets" on putting_regimen_sets;

-- Owner can create/read/update their own custom routines, but NOT hard-delete
-- them (no DELETE policy) — deletion is a soft archive (update archived=true),
-- preserving run history and the runs FK. The WITH CHECK (user_id = auth.uid())
-- also prevents a user from forging a system regimen (user_id null).
create policy "Users insert own custom regimens"
  on putting_regimens for insert
  with check (user_id = auth.uid());

create policy "Users update own custom regimens"
  on putting_regimens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users view own custom regimens"
  on putting_regimens for select
  using (user_id = auth.uid());

create policy "Anyone authenticated can view system regimens"
  on putting_regimens for select
  using (user_id is null);

-- Sets inherit ownership through their regimen. Two OR'd policies: owner manages
-- own sets (all commands); everyone can read sets of system regimens.
create policy "Users manage own regimen sets"
  on putting_regimen_sets for all
  using (exists (
    select 1 from putting_regimens r
    where r.id = putting_regimen_sets.regimen_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from putting_regimens r
    where r.id = putting_regimen_sets.regimen_id and r.user_id = auth.uid()
  ));

create policy "Anyone authenticated can view system regimen sets"
  on putting_regimen_sets for select
  using (exists (
    select 1 from putting_regimens r
    where r.id = putting_regimen_sets.regimen_id and r.user_id is null
  ));

-- ============================================================
-- BADGES + XP LEDGER (gamification, Layer 5 spec; tables land now)
-- ============================================================
-- Shared reference (like putting_regimens): select-open, insert-closed (seeded
-- via service role). No insert/update/delete policy => write-closed to users.
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  tier text,                                   -- e.g. 'bronze' | 'silver' | 'gold'
  criteria jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Per-user progress toward each badge. Unique (user_id, badge_id) => one row
-- per user per badge; earned_at null until unlocked.
create table if not exists badge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  progress numeric not null default 0 check (progress >= 0),
  earned_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists badge_progress_user_id_idx on badge_progress (user_id);
-- Cover the badge_id FK: the unique (user_id, badge_id) index is user_id-first
-- and does not serve badge_id lookups / cascade checks.
create index if not exists badge_progress_badge_id_idx on badge_progress (badge_id);

-- Append-only XP ledger — source of truth for profiles.xp. source_ref is an
-- intentionally FK-less pointer to the originating row (a run, session, badge)
-- so the ledger survives deletion of the source.
create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source_type text not null,                   -- e.g. 'regimen_run' | 'badge' | 'session'
  source_ref uuid,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_user_id_created_idx on xp_events (user_id, created_at);

alter table badges enable row level security;
alter table badge_progress enable row level security;
alter table xp_events enable row level security;

create policy "Anyone authenticated can view badges"
  on badges for select
  using (auth.role() = 'authenticated');

create policy "Users manage own badge progress"
  on badge_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- xp_events is an immutable ledger: users may read and append their own rows,
-- but not update or delete them (no such policy) — protects XP history from
-- tampering.
create policy "Users view own xp events"
  on xp_events for select
  using (auth.uid() = user_id);

create policy "Users append own xp events"
  on xp_events for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- HARD INTERLOCKS (DB layer) — cross-row aggregates, so triggers not CHECKs.
-- These back the app-side interlocks per CLAUDE.md (enforce in BOTH layers).
-- Triggers fire only on new writes, so any pre-existing over-limit rows (none
-- today) are grandfathered rather than rejected.
-- ============================================================

-- 35-disc bag ceiling. bags.capacity is a separate, user-set soft target; this
-- is the hard PDGA-style cap on membership count.
create or replace function enforce_bag_capacity()
returns trigger
language plpgsql
set search_path = public   -- pin: don't resolve unqualified tables via session search_path
as $$
declare
  disc_count integer;
begin
  -- Serialize concurrent inserts into the same bag: the row lock makes the
  -- count-then-insert atomic, so two parallel adds at 34 discs can't both pass.
  perform 1 from bags where id = new.bag_id for update;
  select count(*) into disc_count from bag_discs where bag_id = new.bag_id;
  if disc_count >= 35 then
    raise exception 'Bag % is at the 35-disc capacity limit', new.bag_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists bag_discs_capacity_check on bag_discs;
create trigger bag_discs_capacity_check
  before insert on bag_discs
  for each row execute function enforce_bag_capacity();

-- 100-putt routine ceiling: sum(reps_required) across a routine's sets <= 100.
-- Excludes the row's own prior value on UPDATE so edits don't double-count.
create or replace function enforce_routine_putt_cap()
returns trigger
language plpgsql
set search_path = public   -- pin: don't resolve unqualified tables via session search_path
as $$
declare
  v_owner uuid;
  other_reps integer;
begin
  -- Lock the parent regimen (serializes concurrent set inserts for it) and read
  -- its owner. The 100-putt ceiling is a custom-routine fatigue guard per the
  -- blueprint; system regimens (user_id null) are curated and exempt, so editing
  -- or re-seeding them is never blocked by this cap.
  select user_id into v_owner from putting_regimens where id = new.regimen_id for update;
  if v_owner is null then
    return new;
  end if;

  select coalesce(sum(reps_required), 0) into other_reps
  from putting_regimen_sets
  where regimen_id = new.regimen_id and id <> new.id;
  if other_reps + new.reps_required > 100 then
    raise exception 'Routine % would exceed the 100-putt ceiling (% + % > 100)',
      new.regimen_id, other_reps, new.reps_required
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists regimen_sets_putt_cap_check on putting_regimen_sets;
create trigger regimen_sets_putt_cap_check
  before insert or update on putting_regimen_sets
  for each row execute function enforce_routine_putt_cap();

-- ============================================================
-- DISC MERGE: consolidate a duplicate physical-disc row into a survivor.
-- Reassigns all children (bag memberships, round holes, caddie recs, putt
-- events) to the target, sums the two odometers onto the target, deletes the
-- source. SECURITY DEFINER (bypasses RLS) with an explicit same-owner check —
-- the caller must own BOTH discs.
-- ============================================================
create or replace function merge_discs(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_source_owner uuid;
  v_target_owner uuid;
begin
  if p_source_id = p_target_id then
    raise exception 'Cannot merge a disc into itself';
  end if;

  select user_id into v_source_owner from discs where id = p_source_id;
  select user_id into v_target_owner from discs where id = p_target_id;

  if v_source_owner is null or v_target_owner is null then
    raise exception 'Source or target disc does not exist';
  end if;

  if v_caller is null or v_source_owner <> v_caller or v_target_owner <> v_caller then
    raise exception 'You can only merge your own discs';
  end if;

  -- Reassign bag memberships, skipping bags where the target is already a member
  -- (would violate unique (bag_id, disc_id)); leftover source rows are dropped next.
  update bag_discs
    set disc_id = p_target_id
    where disc_id = p_source_id
      and not exists (
        select 1 from bag_discs b2
        where b2.bag_id = bag_discs.bag_id and b2.disc_id = p_target_id
      );
  delete from bag_discs where disc_id = p_source_id;

  update round_holes            set disc_id        = p_target_id where disc_id        = p_source_id;
  update caddie_recommendations set disc_id        = p_target_id where disc_id        = p_source_id;
  update putt_events            set putter_disc_id = p_target_id where putter_disc_id = p_source_id;

  update discs
    set total_chain_hits = total_chain_hits
      + coalesce((select total_chain_hits from discs where id = p_source_id), 0)
    where id = p_target_id;

  delete from discs where id = p_source_id;
end;
$$;

-- Only signed-in users may call it, and it self-checks that the caller owns both
-- discs. anon is explicitly revoked; the advisor's "authenticated can execute a
-- SECURITY DEFINER function" warning is expected and intentional here.
revoke all on function merge_discs(uuid, uuid) from public;
revoke all on function merge_discs(uuid, uuid) from anon;
grant execute on function merge_discs(uuid, uuid) to authenticated;
