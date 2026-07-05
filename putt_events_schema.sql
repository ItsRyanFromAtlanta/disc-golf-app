-- Per-putt capture layer (Track 2.2c). Additive only — new table, no changes
-- to existing tables. Applied live via Supabase MCP; this file reproduces it.
--
-- Parent is an exclusive arc across three nullable FKs (regimen run / freeform
-- session / round hole) rather than a polymorphic type+id pair, matching every
-- other relation in this schema. `id` has NO server default: it is always
-- client-generated (crypto.randomUUID()) before the network round-trip, so a
-- dropped-connection retry can upsert with onConflict/ignoreDuplicates and be
-- a true no-op on replay. `occurred_at` is client-set capture time (never
-- server now()) since offline-buffered events sync well after they happened.
--
-- Data-split rule (see CLAUDE.md § Data rules for putt capture): gesture-zone
-- entries (swipe/long-press) always produce a row here; batch-ribbon entries
-- never do. A stage can mix both — `sequence` gaps relative to the eventual
-- summary row's attempt count are expected, not a bug.
create table putt_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  regimen_run_id uuid references putting_regimen_runs(id) on delete cascade,
  freeform_session_id uuid references putt_sessions(id) on delete cascade,
  round_hole_id uuid references round_holes(id) on delete cascade,
  set_order integer,  -- denormalized copy of putting_regimen_sets.set_order, regimen-parented rows only
  sequence integer not null check (sequence > 0),  -- monotonic within whichever parent is non-null
  outcome text not null check (outcome in ('make', 'miss')),
  miss_zone smallint check (miss_zone between 1 and 9),  -- 9-zone grid, reading order (1=top-left..9=bottom-right); only when outcome='miss' and diagnostic mode was on
  distance_ft integer not null check (distance_ft > 0),
  input_source text not null default 'manual' check (input_source in ('manual', 'acoustic')),
  occurred_at timestamptz not null,
  synced_at timestamptz not null default now(),
  check (miss_zone is null or outcome = 'miss'),
  check (
    (regimen_run_id is not null)::int +
    (freeform_session_id is not null)::int +
    (round_hole_id is not null)::int = 1
  )
);

create index idx_putt_events_user_id on putt_events (user_id);
create index idx_putt_events_regimen_run_id on putt_events (regimen_run_id) where regimen_run_id is not null;
create index idx_putt_events_freeform_session_id on putt_events (freeform_session_id) where freeform_session_id is not null;
create index idx_putt_events_round_hole_id on putt_events (round_hole_id) where round_hole_id is not null;
create unique index idx_putt_events_regimen_run_sequence on putt_events (regimen_run_id, sequence) where regimen_run_id is not null;
create unique index idx_putt_events_freeform_session_sequence on putt_events (freeform_session_id, sequence) where freeform_session_id is not null;
create unique index idx_putt_events_round_hole_sequence on putt_events (round_hole_id, sequence) where round_hole_id is not null;

alter table putt_events enable row level security;

-- `for all` (not just select/insert) is deliberate: undo-after-sync needs
-- delete when opportunistic sync raced ahead of a same-stage undo tap.
create policy "Users manage their own putt events"
  on putt_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
