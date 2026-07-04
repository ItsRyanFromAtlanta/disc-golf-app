-- Session history v1: notes + tags on both practice entry types.
-- Append-only migration; run after putting_regimens_schema.sql.
-- putt_sessions already has notes (from putting_practice_schema.sql).

alter table putt_sessions
  add column if not exists tags text[] not null default '{}';

alter table putting_regimen_runs
  add column if not exists notes text;

alter table putting_regimen_runs
  add column if not exists tags text[] not null default '{}';
