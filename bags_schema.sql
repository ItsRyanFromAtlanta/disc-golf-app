-- Track 1C: bags + membership + the rounds.bag_id tandem accommodation.
-- Append-only. Additive/idempotent only — safe to run anytime, no backup
-- needed. This file is INDEPENDENT of the 1B disc-locker migration: it
-- references discs(id), which already exists in the base schema. It does
-- NOT depend on discs.status/mold_id existing.
--
-- The membership migration (create a default bag per user, add all
-- in-locker discs to it) is a SEPARATE file — migrate_bag_locker.sql —
-- because it DOES depend on discs.status, which only exists once the 1B
-- migration's backfill (Section 2) has run. See that file for details.

-- ============================================================
-- BAGS (user-owned)
-- ============================================================
create table if not exists bags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  bag_type text,              -- free text, e.g. 'tournament', 'practice', 'all-purpose'
  is_default boolean not null default false,
  capacity integer,
  created_at timestamptz not null default now()
);

-- At most one default bag per user.
create unique index if not exists bags_one_default_per_user
  on bags (user_id) where is_default;

create index if not exists bags_user_id_idx on bags (user_id);

-- ============================================================
-- BAG_DISCS (join: a disc can be in multiple bags)
-- No user_id column: ownership is derived through bag_id -> bags.user_id,
-- same pattern as putting_regimen_run_sets -> putting_regimen_runs.
-- ============================================================
create table if not exists bag_discs (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references bags(id) on delete cascade,
  disc_id uuid not null references discs(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (bag_id, disc_id)
);

create index if not exists bag_discs_bag_id_idx on bag_discs (bag_id);
create index if not exists bag_discs_disc_id_idx on bag_discs (disc_id);

-- ============================================================
-- ROUNDS tandem accommodation: which bag was carried for a round.
-- Nullable — most rounds (and all existing rows) have no bag recorded.
-- ============================================================
alter table rounds
  add column if not exists bag_id uuid references bags(id);

create index if not exists rounds_bag_id_idx on rounds (bag_id);

-- ============================================================
-- RLS
-- ============================================================
alter table bags enable row level security;
alter table bag_discs enable row level security;

create policy "Users manage own bags"
  on bags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own bag_discs via bag"
  on bag_discs for all
  using (exists (
    select 1 from bags
    where bags.id = bag_discs.bag_id
      and bags.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from bags
    where bags.id = bag_discs.bag_id
      and bags.user_id = auth.uid()
  ));
