-- Track 1B (disc molds + locker) + Track 1.5 (layouts, provenance, course aliases)
-- Schema additions. Append-only per project convention.
--
-- This file is ADDITIVE and IDEMPOTENT ONLY: it creates new tables, adds
-- nullable columns, and creates indexes/policies. It performs NO data
-- backfill and NO destructive changes (no DROP COLUMN, no NOT NULL tightening).
-- It is safe to run at any time without a backup.
--
-- The data backfill and the destructive cleanup (dropping is_active, the stock
-- flight columns on discs, holes.course_id, rounds.layout_name; tightening FKs)
-- live in migrate_disc_locker_and_layouts.sql, which is gated behind a DB
-- backup and an approved dry-run. Run this schema file FIRST, then that.

-- ============================================================
-- DISC MOLDS (shared reference table; insert-open / update-closed)
-- A mold is the manufactured design (e.g. MVP Watt). A row in `discs` is a
-- physical copy a user owns. Stock flight numbers live here; per-copy tuning
-- lives as override_* columns on discs (null override = use the mold's stock).
-- ============================================================
create table if not exists disc_molds (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  mold_name text not null,
  -- stock flight numbers (nullable: enrichment may lag manual mold creation)
  speed numeric,
  glide numeric,
  turn numeric,
  fade numeric,
  category text check (category in ('distance','fairway','midrange','approach','putter')),
  -- nullable enrichment (seeded from manufacturer sites; never required)
  image_url text,
  pdga_approved_date date,
  production_status text,          -- e.g. 'current' | 'retired' | 'limited'
  plastics text[] not null default '{}',
  diameter_cm numeric,
  rim_width_cm numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on (manufacturer, mold_name): one canonical row
-- per real-world mold, so "MVP"/"mvp" + "Watt"/"watt" collapse to one.
create unique index if not exists disc_molds_manufacturer_mold_uniq
  on disc_molds (lower(manufacturer), lower(mold_name));

-- ============================================================
-- DISCS alterations (a user's physical copies)
-- All additive + nullable (status has a default). Existing rows are untouched
-- until the migration backfills them.
-- ============================================================
alter table discs
  add column if not exists mold_id uuid references disc_molds(id),
  add column if not exists nickname text,
  add column if not exists weight_grams numeric,
  add column if not exists color text,
  -- per-copy flight overrides; null = fall back to the mold's stock number
  add column if not exists override_speed numeric,
  add column if not exists override_glide numeric,
  add column if not exists override_turn numeric,
  add column if not exists override_fade numeric,
  add column if not exists photo_url text,
  add column if not exists acquired_on date,
  add column if not exists provenance text,     -- e.g. 'bought new' | 'traded' | 'found'
  -- status lifecycle replacing is_active. is_active is retained until the
  -- migration maps it across and then drops it.
  add column if not exists status text not null default 'in_locker'
    check (status in ('in_locker','lost','retired','sold'));

create index if not exists discs_mold_id_idx on discs (mold_id);
create index if not exists discs_status_idx on discs (status);

-- ============================================================
-- LAYOUTS (first-class; a course has one or more layouts; holes belong to a
-- layout, not directly to a course). Shared community data, same access
-- pattern as courses/holes (authenticated select + insert).
-- ============================================================
create table if not exists layouts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists layouts_course_name_uniq
  on layouts (course_id, lower(name));

-- At most one default layout per course.
create unique index if not exists layouts_one_default_per_course
  on layouts (course_id) where is_default;

-- holes gain a nullable layout_id now; the migration populates it from each
-- hole's current course (via that course's default layout) and a later gated
-- step drops holes.course_id.
alter table holes
  add column if not exists layout_id uuid references layouts(id) on delete cascade;

create index if not exists holes_layout_id_idx on holes (layout_id);

-- ============================================================
-- ROUNDS + COURSES provenance (idempotent imports) and rounds.layout_id
-- ============================================================
alter table rounds
  add column if not exists layout_id uuid references layouts(id),
  add column if not exists external_source text,   -- e.g. 'udisc'
  add column if not exists external_ref text;       -- provider's stable id for this round

alter table courses
  add column if not exists external_source text,
  add column if not exists external_ref text;

create index if not exists rounds_layout_id_idx on rounds (layout_id);

-- Idempotent re-import: the same external (source, ref) can exist at most once,
-- so a re-import updates the existing row instead of duplicating it. Partial
-- (only when external_source is set) so native rows are unconstrained.
create unique index if not exists rounds_external_uniq
  on rounds (external_source, external_ref) where external_source is not null;

create unique index if not exists courses_external_uniq
  on courses (external_source, external_ref) where external_source is not null;

-- ============================================================
-- COURSE ALIASES (alias -> course; insert-open / update-closed, like molds)
-- Resolves import name variants ("East Roswell Park" vs "East Roswell Park DGC")
-- and doubles as catalog search synonyms.
-- ============================================================
create table if not exists course_aliases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  alias text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- An alias resolves to exactly one course, so it is globally unique (ci).
create unique index if not exists course_aliases_alias_uniq
  on course_aliases (lower(alias));

-- ============================================================
-- RLS
-- ============================================================
alter table disc_molds enable row level security;
alter table layouts enable row level security;
alter table course_aliases enable row level security;

-- disc_molds: shared reference. Any authenticated user can read and add
-- (insert-open); no update/delete policy exists, so edits are closed
-- (update-closed) until a moderation model exists.
create policy "Anyone authenticated can view disc molds"
  on disc_molds for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can add disc molds"
  on disc_molds for insert
  with check (auth.role() = 'authenticated');

-- layouts: shared community data, same as courses/holes.
create policy "Anyone authenticated can view layouts"
  on layouts for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can add layouts"
  on layouts for insert
  with check (auth.role() = 'authenticated');

-- course_aliases: insert-open / update-closed, like disc_molds.
create policy "Anyone authenticated can view course aliases"
  on course_aliases for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can add course aliases"
  on course_aliases for insert
  with check (auth.role() = 'authenticated');
