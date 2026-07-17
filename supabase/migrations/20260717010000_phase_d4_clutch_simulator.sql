-- Phase D4 checkpoint 6: genuine pressure-event attribution and the shared Clutch drill.
--
-- Ideal column format:
--   putt_events.is_pressure boolean not null default false
--     A capture-time sporting fact. True only when the active mode explicitly marks the
--     real-time attempt as pressure; batch summaries never create putt_events.
--   Partial index (user_id, occurred_at desc) where is_pressure
--     Supports owner-scoped longitudinal clutch evidence without indexing ordinary events.
--
-- Existing putt_events RLS and Data API grants continue to apply because this migration
-- alters an exposed owner-scoped table rather than creating a new one.

begin;

alter table public.putt_events
  add column if not exists is_pressure boolean not null default false;

create index if not exists putt_events_user_pressure_occurred_idx
  on public.putt_events (user_id, occurred_at desc)
  where is_pressure;

insert into public.putting_regimens (
  id, user_id, difficulty, name, description, base_points_per_make,
  streak_step, no_miss_bonus_pct, completion_bonus, drill_type, rules_config, archived
) values (
  '00000000-0000-4000-8000-00000000d453', null, 4, 'Clutch Simulator',
  'Wait for a randomized 2–8 minute alert, then commit to one pressure putt.',
  1, 0, 0, 0, 'clutch',
  '{"version":1,"kind":"clutch","score":"makes","min_rest_seconds":120,"max_rest_seconds":480,"attempts_per_run":1}'::jsonb,
  false
)
on conflict (id) do update set
  difficulty = excluded.difficulty,
  name = excluded.name,
  description = excluded.description,
  base_points_per_make = excluded.base_points_per_make,
  streak_step = excluded.streak_step,
  no_miss_bonus_pct = excluded.no_miss_bonus_pct,
  completion_bonus = excluded.completion_bonus,
  drill_type = excluded.drill_type,
  rules_config = excluded.rules_config,
  archived = false;

insert into public.putting_regimen_sets (
  id, regimen_id, set_order, distance_feet_min, distance_feet_max, reps_required, pressure_multiplier
)
select
  ('00000000-0000-4000-8300-' || lpad(station::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-00000000d453'::uuid,
  station,
  distance_ft,
  distance_ft,
  1,
  2
from (values (1, 15), (2, 20), (3, 25), (4, 33)) as distances(station, distance_ft)
on conflict (regimen_id, set_order) do update set
  distance_feet_min = excluded.distance_feet_min,
  distance_feet_max = excluded.distance_feet_max,
  reps_required = excluded.reps_required,
  pressure_multiplier = excluded.pressure_multiplier;

commit;

-- Rollback notes: delete the deterministic Clutch regimen row (sets cascade), then drop
-- putt_events_user_pressure_occurred_idx and putt_events.is_pressure. Dropping the column
-- permanently removes pressure attribution and should occur only before production facts exist.
