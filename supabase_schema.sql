-- Disc Golf Manager & Caddie App — Initial Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
--
-- ============================================================
-- READ THIS BEFORE TREATING THIS FILE AS CURRENT (reconciled 2026-07-30)
-- ============================================================
-- This is the Layer 1 *initial* schema, kept as the historical starting point.
-- It is NOT a description of the live database. Later schema files and
-- migrations re-parented and extended several tables, and this file was never
-- updated to match — the drift was found during the E2 course/round audit,
-- after a finding was written against a `holes` shape that no longer exists.
--
-- Per the append-only schema policy the stale definitions below are annotated
-- in place rather than rewritten. Each affected block carries a SUPERSEDED note
-- pointing at the file that actually owns its current shape. The known
-- divergences from live, all in the course/round tree:
--
--   * `layouts` does not appear in this file at all. A course has one or more
--     layouts, and holes hang off a layout. See
--     `disc_locker_and_layouts_schema.sql`.
--   * `holes.course_id` is DROPPED live; holes carry `layout_id` instead.
--     Dropped by `migrate_disc_locker_and_layouts.sql`.
--   * The `holes` uniqueness rule is now the index
--     `holes_layout_hole_tee_uniq` on `(layout_id, hole_number, tee_type)`
--     WITH `nulls not distinct`. See
--     `supabase/migrations/20260730025443_phase_e_hole_number_nulls_not_distinct.sql`.
--   * `rounds.layout_name` is DROPPED live; rounds carry `layout_id`.
--   * `courses` and `rounds` both gained `external_source` / `external_ref`,
--     and `rounds` gained `bag_id` / `bag_version_id`.
--
-- Verified against the live database (`icqzbvtjisxwycvioiup`) on 2026-07-30 by
-- reading `information_schema.columns` and `pg_indexes` rather than inferring
-- from the migration history.

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  pdga_number text,
  division text,               -- e.g. 'MA2'
  home_course_id uuid,         -- fk added after courses table exists
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ============================================================
-- DISCS (a user's bag)
-- ============================================================
create table discs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  manufacturer text,
  mold text not null,
  plastic text,
  speed numeric,
  glide numeric,
  turn numeric,
  fade numeric,
  condition text,               -- e.g. 'new', 'worn', 'beat-in'
  is_active boolean default true,
  notes text,
  created_at timestamptz default now()
);

alter table discs enable row level security;

create policy "Users manage own discs"
  on discs for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- COURSES (shared community data — not user-owned)
-- ============================================================
create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  layout_name text default 'Main',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table courses enable row level security;

create policy "Anyone authenticated can view courses"
  on courses for select using (auth.role() = 'authenticated');

create policy "Authenticated users can add courses"
  on courses for insert with check (auth.role() = 'authenticated');

-- Now that courses exists, wire the home_course_id fk on profiles
alter table profiles
  add constraint profiles_home_course_fk
  foreign key (home_course_id) references courses(id);

-- ============================================================
-- HOLES (belongs to a course + layout)
--
-- SUPERSEDED — do not write new code or migrations against this block.
-- Live, a hole belongs to a LAYOUT, not a course: `course_id` was dropped by
-- `migrate_disc_locker_and_layouts.sql` and replaced by `layout_id uuid not
-- null references layouts(id) on delete cascade`. The `unique (course_id,
-- hole_number, tee_type)` constraint below is likewise gone, replaced by the
-- index `holes_layout_hole_tee_uniq` on `(layout_id, hole_number, tee_type)`
-- with `nulls not distinct` — without that clause a layout with no explicit
-- tee types, which is every quick course, could hold duplicate hole numbers
-- (E2 audit finding 8).
-- ============================================================
create table holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  hole_number int not null,
  par int default 3,
  distance_feet int,
  tee_type text,                -- e.g. 'Black', 'Blue'
  hazards text,
  strategy_notes text,
  unique (course_id, hole_number, tee_type)
);

alter table holes enable row level security;

create policy "Anyone authenticated can view holes"
  on holes for select using (auth.role() = 'authenticated');

create policy "Authenticated users can add holes"
  on holes for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- ROUNDS (a played round, user-owned)
--
-- SUPERSEDED in part — `layout_name` was dropped by
-- `migrate_disc_locker_and_layouts.sql`; a round now references a layout
-- directly via `layout_id uuid references layouts(id)`. Live rounds also carry
-- `external_source` / `external_ref` (idempotent imports) and `bag_id` /
-- `bag_version_id` (the exact bag snapshot selected at start).
-- ============================================================
create table rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) not null,
  layout_name text,
  played_at timestamptz default now(),
  weather_summary text,
  target_score int,
  total_score int,
  status text default 'in_progress',  -- 'in_progress' | 'completed'
  created_at timestamptz default now()
);

alter table rounds enable row level security;

create policy "Users manage own rounds"
  on rounds for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- ROUND_HOLES (per-hole result within a round)
-- ============================================================
create table round_holes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade not null,
  hole_id uuid references holes(id) not null,
  score int,
  disc_id uuid references discs(id),
  notes text,
  created_at timestamptz default now(),
  unique (round_id, hole_id)
);

alter table round_holes enable row level security;

create policy "Users manage round_holes via parent round"
  on round_holes for all using (
    exists (select 1 from rounds where rounds.id = round_holes.round_id and rounds.user_id = auth.uid())
  )
  with check (
    exists (select 1 from rounds where rounds.id = round_holes.round_id and rounds.user_id = auth.uid())
  );

-- ============================================================
-- LIVE_SESSIONS (active caddie chat state during a round)
-- ============================================================
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade not null,
  chat_log jsonb default '[]'::jsonb,
  status text default 'active',   -- 'active' | 'closed'
  updated_at timestamptz default now()
);

alter table live_sessions enable row level security;

create policy "Users manage own live_sessions via round"
  on live_sessions for all using (
    exists (select 1 from rounds where rounds.id = live_sessions.round_id and rounds.user_id = auth.uid())
  )
  with check (
    exists (select 1 from rounds where rounds.id = live_sessions.round_id and rounds.user_id = auth.uid())
  );

-- ============================================================
-- CADDIE_RECOMMENDATIONS (logged AI suggestions, for later analysis)
-- ============================================================
create table caddie_recommendations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade not null,
  hole_id uuid references holes(id) not null,
  recommendation text,
  disc_id uuid references discs(id),
  model_used text,               -- e.g. 'claude-sonnet-5'
  created_at timestamptz default now()
);

alter table caddie_recommendations enable row level security;

create policy "Users manage own recommendations via round"
  on caddie_recommendations for all using (
    exists (select 1 from rounds where rounds.id = caddie_recommendations.round_id and rounds.user_id = auth.uid())
  )
  with check (
    exists (select 1 from rounds where rounds.id = caddie_recommendations.round_id and rounds.user_id = auth.uid())
  );
