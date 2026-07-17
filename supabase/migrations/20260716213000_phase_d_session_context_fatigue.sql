-- Phase D2 session context and adaptive fatigue observations.
-- Ideal formats: constrained smallint scales, canonical text[] factors, and immutable UUID child facts.
-- Rollback: drop practice_fatigue_checkins, then drop the additive parent/profile columns.

alter table public.putt_sessions
  add column if not exists perceived_effort smallint check (perceived_effort between 1 and 10),
  add column if not exists external_factors text[] not null default '{}',
  add constraint putt_sessions_external_factors_canonical check (
    external_factors <@ array['indoor','outdoor','tired','new-putter','pre-tournament','experimenting']::text[]
  );

alter table public.putting_regimen_runs
  add column if not exists perceived_effort smallint check (perceived_effort between 1 and 10),
  add column if not exists external_factors text[] not null default '{}',
  add constraint putting_regimen_runs_external_factors_canonical check (
    external_factors <@ array['indoor','outdoor','tired','new-putter','pre-tournament','experimenting']::text[]
  );

alter table public.profiles
  add column if not exists round_turn_prompt_enabled boolean not null default true;

create table public.practice_fatigue_checkins (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  putt_session_id uuid references public.putt_sessions(id) on delete cascade,
  regimen_run_id uuid references public.putting_regimen_runs(id) on delete cascade,
  stage_index integer not null check (stage_index >= 1),
  trigger_reason text not null check (trigger_reason in ('trailing_misses', 'stage_drop')),
  fatigue_rating smallint check (fatigue_rating between 1 and 5),
  skipped boolean not null default false,
  recorded_at timestamptz not null default now(),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) > 0),
  check (num_nonnulls(putt_session_id, regimen_run_id) = 1),
  check ((skipped and fatigue_rating is null) or (not skipped and fatigue_rating is not null))
);

create index practice_fatigue_checkins_user_recorded_idx
  on public.practice_fatigue_checkins (user_id, recorded_at desc);
create index practice_fatigue_checkins_session_idx
  on public.practice_fatigue_checkins (putt_session_id) where putt_session_id is not null;
create index practice_fatigue_checkins_run_idx
  on public.practice_fatigue_checkins (regimen_run_id) where regimen_run_id is not null;

alter table public.practice_fatigue_checkins enable row level security;

create policy practice_fatigue_checkins_select_own on public.practice_fatigue_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy practice_fatigue_checkins_insert_own on public.practice_fatigue_checkins
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      (putt_session_id is not null and exists (
        select 1 from public.putt_sessions s where s.id = putt_session_id and s.user_id = (select auth.uid())
      ))
      or
      (regimen_run_id is not null and exists (
        select 1 from public.putting_regimen_runs r where r.id = regimen_run_id and r.user_id = (select auth.uid())
      ))
    )
  );

revoke all on table public.practice_fatigue_checkins from public, anon, authenticated;
grant select, insert on table public.practice_fatigue_checkins to authenticated;
grant all on table public.practice_fatigue_checkins to service_role;
