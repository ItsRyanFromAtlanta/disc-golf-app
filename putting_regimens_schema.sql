-- Scored putting regimen feature schema.
-- Reference only: these tables already exist in the project's Supabase
-- instance (created in an earlier session). This file documents the actual
-- live schema/RLS for reproducing it in a fresh environment; `create table
-- if not exists` makes it a no-op against the current database.

create table if not exists putting_regimens (
  id uuid primary key default gen_random_uuid(),
  difficulty integer not null unique check (difficulty between 1 and 5),
  name text not null,
  description text,
  base_points_per_make numeric not null check (base_points_per_make > 0),
  streak_step numeric not null default 0 check (streak_step >= 0),
  no_miss_bonus_pct numeric not null default 0 check (no_miss_bonus_pct >= 0),
  completion_bonus numeric not null default 0 check (completion_bonus >= 0),
  created_at timestamptz not null default now()
);

create table if not exists putting_regimen_sets (
  id uuid primary key default gen_random_uuid(),
  regimen_id uuid not null references putting_regimens(id) on delete cascade,
  set_order integer not null,
  distance_feet_min integer not null check (distance_feet_min > 0),
  distance_feet_max integer not null check (distance_feet_max >= distance_feet_min),
  reps_required integer not null check (reps_required > 0),
  pressure_multiplier numeric not null default 1 check (pressure_multiplier >= 1),
  unique (regimen_id, set_order)
);

create table if not exists putting_regimen_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  regimen_id uuid not null references putting_regimens(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed boolean not null default false,
  total_score numeric not null default 0
);

-- No user_id column: ownership is derived through run_id -> putting_regimen_runs.user_id.
create table if not exists putting_regimen_run_sets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references putting_regimen_runs(id) on delete cascade,
  regimen_set_id uuid not null references putting_regimen_sets(id),
  makes integer not null check (makes >= 0),
  attempts integer not null check (attempts >= makes and attempts > 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  clean_set boolean not null default false,
  pressure_putt_made boolean not null default false,
  points_earned numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table putting_regimens enable row level security;
alter table putting_regimen_sets enable row level security;
alter table putting_regimen_runs enable row level security;
alter table putting_regimen_run_sets enable row level security;

create policy "Anyone authenticated can view regimens"
  on putting_regimens for select
  using (auth.role() = 'authenticated');

create policy "Anyone authenticated can view regimen sets"
  on putting_regimen_sets for select
  using (auth.role() = 'authenticated');

create policy "Users manage own regimen runs"
  on putting_regimen_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own run sets via run"
  on putting_regimen_run_sets for all
  using (exists (
    select 1 from putting_regimen_runs
    where putting_regimen_runs.id = putting_regimen_run_sets.run_id
      and putting_regimen_runs.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from putting_regimen_runs
    where putting_regimen_runs.id = putting_regimen_run_sets.run_id
      and putting_regimen_runs.user_id = auth.uid()
  ));
