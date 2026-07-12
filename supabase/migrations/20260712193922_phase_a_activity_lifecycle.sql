-- Phase A A5: canonical activity envelope, append-only lifecycle history,
-- audit provenance, and legacy-domain links.
--
-- DRAFT ONLY. This migration was generated for review and is intentionally
-- unapplied. A6 must review the RPC contract, run the preflight queries, and
-- apply it only after the manual Supabase backup is re-confirmed.
--
-- The A4 local repository uses a domain row's UUID as its activity UUID. This
-- migration preserves that identity and adds owner-consistent composite FKs;
-- it does not add a redundant activity_id column to every specialized table.

begin;

create table public.activities (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'putting_freeform',
    'putting_regimen',
    'disc_golf_round',
    'putting_game',
    'fieldwork',
    'course_practice',
    'league_match'
  )),
  state text not null default 'draft' check (state in (
    'draft',
    'active',
    'paused',
    'completed',
    'incomplete'
  )),
  version bigint not null default 0 check (version >= 0),
  has_meaningful_fact boolean not null default false,
  needs_review boolean not null default false,
  hidden_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  create_idempotency_key text unique
    check (create_idempotency_key is null or length(create_idempotency_key) > 0),
  last_lifecycle_idempotency_key text unique
    check (last_lifecycle_idempotency_key is null or length(last_lifecycle_idempotency_key) > 0),
  unique (id, user_id)
);

create unique index activities_one_current_per_user_idx
  on public.activities (user_id)
  where state in ('active', 'paused');

create index activities_history_user_updated_idx
  on public.activities (user_id, updated_at desc)
  where state <> 'draft' and hidden_at is null;

create table public.activity_state_events (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  user_id uuid not null,
  previous_state text not null check (previous_state in (
    'draft',
    'active',
    'paused',
    'completed',
    'incomplete'
  )),
  new_state text not null check (new_state in (
    'draft',
    'active',
    'paused',
    'completed',
    'incomplete'
  )),
  reason text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in (
    'live_capture',
    'batch_entry',
    'manual_entry',
    'manual_correction',
    'udisc_import',
    'pdga_import',
    'system_inference',
    'sensor',
    'admin_repair'
  )),
  installation_id text not null check (length(installation_id) > 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text not null unique
    check (length(idempotency_key) > 0),
  constraint activity_state_events_activity_owner_fkey
    foreign key (activity_id, user_id)
    references public.activities (id, user_id)
    on delete cascade
);

create index activity_state_events_activity_recorded_idx
  on public.activity_state_events (activity_id, recorded_at, id);

create index activity_state_events_user_recorded_idx
  on public.activity_state_events (user_id, recorded_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (length(entity_type) > 0),
  entity_id uuid not null,
  action text not null check (length(action) > 0),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in (
    'live_capture',
    'batch_entry',
    'manual_entry',
    'manual_correction',
    'udisc_import',
    'pdga_import',
    'system_inference',
    'sensor',
    'admin_repair'
  )),
  source_reference text,
  installation_id text,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  schema_version integer not null default 1 check (schema_version > 0),
  idempotency_key text not null unique
    check (length(idempotency_key) > 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_user_recorded_idx
  on public.audit_events (user_id, recorded_at desc);

create index audit_events_entity_recorded_idx
  on public.audit_events (entity_type, entity_id, recorded_at desc);

-- Backfill the envelope from authoritative domain facts. No synthetic state
-- events are written: the historical database has no trustworthy pause/resume
-- timeline. A6 may append real transitions after this migration.
insert into public.activities (
  id,
  user_id,
  type,
  state,
  version,
  has_meaningful_fact,
  needs_review,
  metadata,
  created_at,
  updated_at
)
select
  s.id,
  s.user_id,
  'putting_freeform',
  case when exists (
    select 1
    from public.putt_distance_logs d
    where d.session_id = s.id
  ) or exists (
    select 1
    from public.putt_events e
    where e.freeform_session_id = s.id
  ) then 'completed' else 'draft' end,
  0,
  exists (
    select 1
    from public.putt_distance_logs d
    where d.session_id = s.id
  ) or exists (
    select 1
    from public.putt_events e
    where e.freeform_session_id = s.id
  ),
  false,
  jsonb_build_object(
    'backfill', 'phase_a_a5',
    'source_table', 'putt_sessions',
    'source_created_at', s.created_at
  ),
  s.created_at,
  s.created_at
from public.putt_sessions s;

insert into public.activities (
  id,
  user_id,
  type,
  state,
  version,
  has_meaningful_fact,
  needs_review,
  metadata,
  created_at,
  updated_at
)
select
  r.id,
  r.user_id,
  'putting_regimen',
  case
    when r.completed then 'completed'
    when exists (
      select 1
      from public.putting_regimen_run_sets rs
      where rs.run_id = r.id
    ) or exists (
      select 1
      from public.putt_events e
      where e.regimen_run_id = r.id
    ) then 'incomplete'
    else 'draft'
  end,
  0,
  coalesce(r.completed, false) or exists (
    select 1
    from public.putting_regimen_run_sets rs
    where rs.run_id = r.id
  ) or exists (
    select 1
    from public.putt_events e
    where e.regimen_run_id = r.id
  ),
  false,
  jsonb_build_object(
    'backfill', 'phase_a_a5',
    'source_table', 'putting_regimen_runs',
    'source_started_at', r.started_at,
    'legacy_completed', r.completed
  ),
  r.started_at,
  coalesce(r.completed_at, r.started_at)
from public.putting_regimen_runs r;

insert into public.activities (
  id,
  user_id,
  type,
  state,
  version,
  has_meaningful_fact,
  needs_review,
  metadata,
  created_at,
  updated_at
)
select
  r.id,
  r.user_id,
  'disc_golf_round',
  case
    when r.status = 'completed' then 'completed'
    when exists (
      select 1
      from public.round_holes rh
      where rh.round_id = r.id and rh.score is not null
    ) then 'incomplete'
    else 'draft'
  end,
  0,
  coalesce(r.status = 'completed', false) or exists (
    select 1
    from public.round_holes rh
    where rh.round_id = r.id and rh.score is not null
  ),
  coalesce(r.status not in ('in_progress', 'completed'), false),
  jsonb_build_object(
    'backfill', 'phase_a_a5',
    'source_table', 'rounds',
    'legacy_status', r.status
  ),
  coalesce(r.created_at, r.played_at, now()),
  coalesce(r.played_at, r.created_at, now())
from public.rounds r;

-- The domain row UUID is the activity UUID. The composite form prevents a
-- cross-user link if a future import accidentally reuses an id.
alter table public.putt_sessions
  add constraint putt_sessions_activity_owner_fkey
  foreign key (id, user_id)
  references public.activities (id, user_id)
  on delete cascade;

alter table public.putting_regimen_runs
  add constraint putting_regimen_runs_activity_owner_fkey
  foreign key (id, user_id)
  references public.activities (id, user_id)
  on delete cascade;

alter table public.rounds
  add constraint rounds_activity_owner_fkey
  foreign key (id, user_id)
  references public.activities (id, user_id)
  on delete cascade;

alter table public.activities enable row level security;
alter table public.activity_state_events enable row level security;
alter table public.audit_events enable row level security;

create policy activities_select_own
  on public.activities
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy activity_state_events_select_own
  on public.activity_state_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy audit_events_select_own
  on public.audit_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Default ACLs in the live project currently grant broad table privileges.
-- New lifecycle tables deliberately expose reads only; A6 RPCs will perform
-- writes as SECURITY DEFINER with explicit owner and version checks.
revoke all on table public.activities from public, anon, authenticated;
revoke all on table public.activity_state_events from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;

grant select on table public.activities to authenticated;
grant select on table public.activity_state_events to authenticated;
grant select on table public.audit_events to authenticated;

grant all on table public.activities to service_role;
grant all on table public.activity_state_events to service_role;
grant all on table public.audit_events to service_role;

commit;
