-- Phase A: Player Profile Expansion — Schema Addition
-- Run after all prior schema files.

alter table profiles
  add column if not exists handedness text check (handedness in ('right','left','ambidextrous')),
  add column if not exists bh_confidence text default 'none' check (bh_confidence in ('none','developing','reliable','weapon')),
  add column if not exists fh_confidence text default 'none' check (fh_confidence in ('none','developing','reliable','weapon')),
  add column if not exists bh_max_distance_ft int,
  add column if not exists bh_max_distance_source text default 'self_reported' check (bh_max_distance_source in ('self_reported','derived')),
  add column if not exists fh_max_distance_ft int,
  add column if not exists fh_max_distance_source text default 'self_reported' check (fh_max_distance_source in ('self_reported','derived')),
  add column if not exists c1_comfort_ft int,
  add column if not exists c1_comfort_source text default 'self_reported' check (c1_comfort_source in ('self_reported','derived')),
  add column if not exists specialty_shots text[] default '{}',   -- e.g. {'roller','thumber','tomahawk','grenade'}
  add column if not exists target_rating int,
  add column if not exists units text default 'feet' check (units in ('feet','meters')),
  add column if not exists injury_notes text;   -- PRIVATE: never selected in any shared/social view. See CLAUDE.md.

-- Existing RLS policies on profiles already restrict all access to the owning user; no policy changes needed.
