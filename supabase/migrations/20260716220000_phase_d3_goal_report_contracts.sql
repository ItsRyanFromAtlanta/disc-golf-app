-- Phase D3 checkpoint 1: notification preferences, goal lifecycle, and immutable weekly reports.
-- Ideal formats: owner UUIDs indexed for RLS; constrained text enums; numeric goal targets;
-- immutable UUID event/report rows; JSONB objects for versioned metric payloads; Monday date windows.
-- Rollback: drop public/private goal functions, then weekly_report_snapshots, goal_events, goals,
-- notification_preferences, and profiles.timezone. Existing activity/audit/notification data is untouched.

begin;

alter table public.profiles
  add column if not exists timezone text not null default 'UTC'
  check (length(btrim(timezone)) between 1 and 100);

create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'activity', 'lost_disc', 'sync', 'weekly_report', 'equipment',
    'community_review', 'achievement', 'coaching'
  )),
  optional_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('target_rating', 'practice_frequency', 'putting_volume', 'consistency')),
  target_value numeric(12,2) not null check (target_value > 0),
  target_unit text not null check (target_unit in ('rating', 'sessions_per_week', 'putts_per_week', 'percent')),
  status text not null check (status in ('active', 'paused', 'completed', 'cancelled')),
  starts_on date not null default current_date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1 check (version > 0),
  create_idempotency_key text not null unique check (length(btrim(create_idempotency_key)) > 0),
  unique (id, user_id),
  check (target_date is null or target_date >= starts_on),
  check (
    (goal_type = 'target_rating' and target_unit = 'rating') or
    (goal_type = 'practice_frequency' and target_unit = 'sessions_per_week') or
    (goal_type = 'putting_volume' and target_unit = 'putts_per_week') or
    (goal_type = 'consistency' and target_unit = 'percent')
  ),
  check (
    (status = 'active' and paused_at is null and completed_at is null and cancelled_at is null) or
    (status = 'paused' and paused_at is not null and completed_at is null and cancelled_at is null) or
    (status = 'completed' and completed_at is not null and cancelled_at is null) or
    (status = 'cancelled' and cancelled_at is not null and completed_at is null)
  )
);

create unique index goals_one_active_type_idx on public.goals (user_id, goal_type)
  where status = 'active';
create index goals_user_status_idx on public.goals (user_id, status, updated_at desc);

create table public.goal_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  previous_status text check (previous_status is null or previous_status in ('active', 'paused', 'completed', 'cancelled')),
  new_status text not null check (new_status in ('active', 'paused', 'completed', 'cancelled')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('manual_entry', 'manual_correction', 'system_inference', 'admin_repair')),
  reason text check (reason is null or length(btrim(reason)) between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) > 0),
  constraint goal_events_goal_owner_fkey foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  check (previous_status is null or previous_status <> new_status)
);

create index goal_events_user_recorded_idx on public.goal_events (user_id, recorded_at desc);
create index goal_events_goal_occurred_idx on public.goal_events (goal_id, occurred_at, recorded_at);

create table public.weekly_report_snapshots (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  week_end date generated always as (week_start + 6) stored,
  timezone text not null check (length(btrim(timezone)) between 1 and 100),
  window_start timestamptz not null,
  window_end timestamptz not null,
  version integer not null check (version > 0),
  calculation_version text not null check (length(btrim(calculation_version)) between 1 and 100),
  source_cutoff timestamptz not null,
  sample_counts jsonb not null check (jsonb_typeof(sample_counts) = 'object'),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  highlights jsonb not null default '[]'::jsonb check (jsonb_typeof(highlights) = 'array'),
  generated_at timestamptz not null default now(),
  supersedes_id uuid,
  generation_reason text not null default 'scheduled'
    check (generation_reason in ('scheduled', 'manual', 'correction_regeneration')),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) > 0),
  unique (id, user_id),
  unique (user_id, week_start, version),
  constraint weekly_reports_supersedes_owner_fkey foreign key (supersedes_id, user_id)
    references public.weekly_report_snapshots (id, user_id),
  check (window_end > window_start),
  check (source_cutoff >= window_end)
);

create index weekly_reports_user_window_idx
  on public.weekly_report_snapshots (user_id, week_start desc, version desc);

alter table public.notification_preferences enable row level security;
alter table public.goals enable row level security;
alter table public.goal_events enable row level security;
alter table public.weekly_report_snapshots enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy goals_select_own on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy goal_events_select_own on public.goal_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_reports_select_own on public.weekly_report_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_reports_insert_own on public.weekly_report_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on table public.notification_preferences, public.goals, public.goal_events,
  public.weekly_report_snapshots from public, anon, authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select on table public.goals, public.goal_events to authenticated;
grant select, insert on table public.weekly_report_snapshots to authenticated;
grant all on table public.notification_preferences, public.goals, public.goal_events,
  public.weekly_report_snapshots to service_role;

create or replace function private.goal_create(
  p_goal_id uuid, p_goal_type text, p_target_value numeric, p_target_unit text,
  p_starts_on date, p_target_date date, p_occurred_at timestamptz,
  p_idempotency_key text, p_event_id uuid, p_event_idempotency_key text
) returns public.goals
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_goal public.goals%rowtype; v_existing public.goals%rowtype;
begin
  if v_user_id is null then raise exception using errcode = 'P0001', message = 'unauthenticated'; end if;
  select * into v_existing from public.goals where user_id = v_user_id and create_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.id <> p_goal_id then raise exception using errcode = 'P0001', message = 'idempotency_key_conflict'; end if;
    return v_existing;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_goal_type, 0));
  if exists (select 1 from public.goals where user_id = v_user_id and goal_type = p_goal_type and status = 'active') then
    raise exception using errcode = 'P0001', message = 'active_goal_exists';
  end if;
  insert into public.goals (id, user_id, goal_type, target_value, target_unit, status, starts_on,
    target_date, created_at, updated_at, create_idempotency_key)
  values (p_goal_id, v_user_id, p_goal_type, p_target_value, p_target_unit, 'active',
    coalesce(p_starts_on, p_occurred_at::date), p_target_date, p_occurred_at, p_occurred_at, p_idempotency_key)
  returning * into v_goal;
  insert into public.goal_events (id, user_id, goal_id, previous_status, new_status, occurred_at,
    recorded_at, source, idempotency_key)
  values (p_event_id, v_user_id, p_goal_id, null, 'active', p_occurred_at, now(),
    'manual_entry', p_event_idempotency_key);
  return v_goal;
end;
$$;

create or replace function private.goal_transition(
  p_goal_id uuid, p_expected_version integer, p_new_status text, p_occurred_at timestamptz,
  p_source text, p_reason text, p_metadata jsonb, p_event_id uuid, p_idempotency_key text
) returns public.goals
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_goal public.goals%rowtype; v_previous_status text; v_existing_event public.goal_events%rowtype;
begin
  if v_user_id is null then raise exception using errcode = 'P0001', message = 'unauthenticated'; end if;
  select * into v_existing_event from public.goal_events where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event.goal_id <> p_goal_id or v_existing_event.new_status <> p_new_status then
      raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
    end if;
    select * into v_goal from public.goals where id = p_goal_id and user_id = v_user_id;
    return v_goal;
  end if;
  select * into v_goal from public.goals where id = p_goal_id and user_id = v_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'goal_not_found'; end if;
  if v_goal.version <> p_expected_version then raise exception using errcode = 'P0001', message = 'version_conflict'; end if;
  if not ((v_goal.status = 'active' and p_new_status in ('paused','completed','cancelled')) or
          (v_goal.status = 'paused' and p_new_status in ('active','completed','cancelled'))) then
    raise exception using errcode = 'P0001', message = 'invalid_goal_transition';
  end if;
  if p_new_status = 'active' and exists (
    select 1 from public.goals where user_id = v_user_id and goal_type = v_goal.goal_type
      and status = 'active' and id <> v_goal.id
  ) then raise exception using errcode = 'P0001', message = 'active_goal_exists'; end if;
  v_previous_status := v_goal.status;
  update public.goals set status = p_new_status, version = version + 1, updated_at = p_occurred_at,
    paused_at = case when p_new_status = 'paused' then p_occurred_at else null end,
    completed_at = case when p_new_status = 'completed' then p_occurred_at else null end,
    cancelled_at = case when p_new_status = 'cancelled' then p_occurred_at else null end
  where id = v_goal.id returning * into v_goal;
  insert into public.goal_events (id, user_id, goal_id, previous_status, new_status, occurred_at,
    recorded_at, source, reason, metadata, idempotency_key)
  values (p_event_id, v_user_id, v_goal.id, v_previous_status,
    p_new_status, p_occurred_at, now(), p_source, nullif(btrim(p_reason), ''),
    coalesce(p_metadata, '{}'::jsonb), p_idempotency_key);
  return v_goal;
end;
$$;

create or replace function public.goal_create(
  p_goal_id uuid, p_goal_type text, p_target_value numeric, p_target_unit text,
  p_starts_on date, p_target_date date, p_occurred_at timestamptz,
  p_idempotency_key text, p_event_id uuid, p_event_idempotency_key text
) returns public.goals language sql security invoker set search_path = '' as $$
  select private.goal_create(p_goal_id, p_goal_type, p_target_value, p_target_unit, p_starts_on,
    p_target_date, p_occurred_at, p_idempotency_key, p_event_id, p_event_idempotency_key);
$$;

create or replace function public.goal_transition(
  p_goal_id uuid, p_expected_version integer, p_new_status text, p_occurred_at timestamptz,
  p_source text, p_reason text, p_metadata jsonb, p_event_id uuid, p_idempotency_key text
) returns public.goals language sql security invoker set search_path = '' as $$
  select private.goal_transition(p_goal_id, p_expected_version, p_new_status, p_occurred_at,
    p_source, p_reason, p_metadata, p_event_id, p_idempotency_key);
$$;

revoke all on function private.goal_create(uuid,text,numeric,text,date,date,timestamptz,text,uuid,text)
  from public, anon, authenticated;
revoke all on function private.goal_transition(uuid,integer,text,timestamptz,text,text,jsonb,uuid,text)
  from public, anon, authenticated;
revoke all on function public.goal_create(uuid,text,numeric,text,date,date,timestamptz,text,uuid,text)
  from public, anon;
revoke all on function public.goal_transition(uuid,integer,text,timestamptz,text,text,jsonb,uuid,text)
  from public, anon;
grant execute on function private.goal_create(uuid,text,numeric,text,date,date,timestamptz,text,uuid,text)
  to authenticated, service_role;
grant execute on function private.goal_transition(uuid,integer,text,timestamptz,text,text,jsonb,uuid,text)
  to authenticated, service_role;
grant execute on function public.goal_create(uuid,text,numeric,text,date,date,timestamptz,text,uuid,text)
  to authenticated, service_role;
grant execute on function public.goal_transition(uuid,integer,text,timestamptz,text,text,jsonb,uuid,text)
  to authenticated, service_role;

commit;
