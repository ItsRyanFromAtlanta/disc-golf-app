-- Phase D4 checkpoint 5: versioned classic-drill definitions.
--
-- Ideal row format:
--   putting_regimens.drill_type text: stable discriminator ('jyly' | 'around_the_world')
--   putting_regimens.rules_config jsonb: versioned rules object with kind and bounded controls
--   putting_regimen_sets: ordered station definitions; JYLY uses ten 10-putt sets,
--     Around the World uses ten one-putt stations and permits repeated run-set facts.
--
-- No new owner data or policies are introduced. These are shared system rows covered by
-- the existing authenticated system-regimen SELECT policies. Run and run-set writes remain
-- owner-scoped through putting_regimen_runs.user_id.

begin;

-- The original index encoded "one system regimen per difficulty". Classic drills share
-- difficulty bands with the five fixed regimens, so system identity is now name-based.
drop index if exists public.putting_regimens_system_difficulty_uniq;
create unique index if not exists putting_regimens_system_name_uniq
  on public.putting_regimens (lower(name))
  where user_id is null;

insert into public.putting_regimens (
  id, user_id, difficulty, name, description, base_points_per_make,
  streak_step, no_miss_bonus_pct, completion_bonus, drill_type, rules_config, archived
) values
  (
    '00000000-0000-4000-8000-00000000d451', null, 3, 'JYLY',
    '100 putts: five 10-putt stations at 15 ft, then five at 20 ft. One point per make.',
    1, 0, 0, 0, 'jyly',
    '{"version":1,"kind":"jyly","score":"makes","planned_putts":100}'::jsonb,
    false
  ),
  (
    '00000000-0000-4000-8000-00000000d452', null, 2, 'Around the World',
    'Make advances one station; miss steps back one. Make station 10 to finish.',
    1, 0, 0, 0, 'around_the_world',
    '{"version":1,"kind":"around_the_world","score":"makes","advance_on":"make","step_back_on":"miss","max_attempts":100}'::jsonb,
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
  ('00000000-0000-4000-8100-' || lpad(station::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-00000000d451'::uuid,
  station,
  case when station <= 5 then 15 else 20 end,
  case when station <= 5 then 15 else 20 end,
  10,
  1
from generate_series(1, 10) station
on conflict (regimen_id, set_order) do update set
  distance_feet_min = excluded.distance_feet_min,
  distance_feet_max = excluded.distance_feet_max,
  reps_required = excluded.reps_required,
  pressure_multiplier = excluded.pressure_multiplier;

insert into public.putting_regimen_sets (
  id, regimen_id, set_order, distance_feet_min, distance_feet_max, reps_required, pressure_multiplier
)
select
  ('00000000-0000-4000-8200-' || lpad(station::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-00000000d452'::uuid,
  station,
  20,
  20,
  1,
  1
from generate_series(1, 10) station
on conflict (regimen_id, set_order) do update set
  distance_feet_min = excluded.distance_feet_min,
  distance_feet_max = excluded.distance_feet_max,
  reps_required = excluded.reps_required,
  pressure_multiplier = excluded.pressure_multiplier;

commit;

-- Rollback notes: delete the two deterministic regimen rows (sets cascade), drop
-- putting_regimens_system_name_uniq, then recreate the former partial difficulty
-- index only after confirming no system difficulty duplicates remain.
