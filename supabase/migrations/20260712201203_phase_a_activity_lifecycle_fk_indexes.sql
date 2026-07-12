-- Phase A A6 follow-up: cover the owner foreign keys added by A5.
--
-- The A6 advisor pass identified these exact composite/single-column FK
-- lookups. This additive migration keeps the historical A5/A6 files intact.

begin;

create index activities_user_id_idx
  on public.activities (user_id);

create index activity_state_events_activity_owner_idx
  on public.activity_state_events (activity_id, user_id);

create index audit_events_user_id_idx
  on public.audit_events (user_id);

create index putt_sessions_activity_owner_idx
  on public.putt_sessions (id, user_id);

create index putting_regimen_runs_activity_owner_idx
  on public.putting_regimen_runs (id, user_id);

create index rounds_activity_owner_idx
  on public.rounds (id, user_id);

commit;
