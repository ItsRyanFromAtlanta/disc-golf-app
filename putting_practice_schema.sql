-- Putting practice feature schema
-- Run this in the Supabase SQL editor for your project.

create table if not exists putt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists putt_distance_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references putt_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_feet integer not null check (distance_feet > 0),
  makes integer not null check (makes >= 0),
  attempts integer not null check (attempts >= makes and attempts > 0),
  zone text generated always as (
    case
      when distance_feet <= 33 then 'C1'
      when distance_feet <= 66 then 'C2'
      else 'Beyond C2'
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_putt_sessions_user_date on putt_sessions (user_id, session_date);
create index if not exists idx_putt_distance_logs_session on putt_distance_logs (session_id);
create index if not exists idx_putt_distance_logs_user on putt_distance_logs (user_id);

alter table putt_sessions enable row level security;
alter table putt_distance_logs enable row level security;

create policy "Users manage their own putt sessions"
  on putt_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own putt distance logs"
  on putt_distance_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
