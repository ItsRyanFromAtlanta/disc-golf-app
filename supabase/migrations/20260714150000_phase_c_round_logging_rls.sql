-- Phase C / J1 — round logging RLS contract.
--
-- The course, layout, hole, round, round_holes, and course_aliases tables
-- already exist from the append-only Track 1.5 groundwork. This migration
-- changes only their exposed access policies and adds indexes that support the
-- new owner predicates and round-history query shape. It does not add columns,
-- backfill rows, or remove legacy columns.
--
-- layouts and holes do not have a created_by column. Their update authority is
-- therefore inherited from the creator of their parent course. This preserves
-- the approved no-new-columns scope while keeping community inserts open and
-- creator updates bounded to the course's own layout tree.

alter table public.courses enable row level security;
alter table public.layouts enable row level security;
alter table public.holes enable row level security;
alter table public.rounds enable row level security;
alter table public.round_holes enable row level security;
alter table public.course_aliases enable row level security;

-- Supporting indexes for the RLS predicates and the user's round history.
create index if not exists courses_created_by_idx
  on public.courses (created_by);

create index if not exists rounds_user_id_idx
  on public.rounds (user_id);

-- Shared course data: authenticated users can read and insert. A course's
-- creator may update it; there is deliberately no delete policy in J1.
drop policy if exists "Anyone authenticated can view courses" on public.courses;
drop policy if exists "Authenticated users can add courses" on public.courses;
drop policy if exists "Authenticated users can view courses" on public.courses;
drop policy if exists "Authenticated users can add courses with owner" on public.courses;
drop policy if exists "Course creators can update courses" on public.courses;

create policy "Authenticated users can view courses"
  on public.courses
  for select
  to authenticated
  using (true);

create policy "Authenticated users can add courses with owner"
  on public.courses
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Course creators can update courses"
  on public.courses
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

-- Layouts are community-readable and insert-open. Updates are limited to the
-- creator of the parent course because layouts have no row-level creator key.
drop policy if exists "Anyone authenticated can view layouts" on public.layouts;
drop policy if exists "Authenticated users can add layouts" on public.layouts;
drop policy if exists "Authenticated users can view layouts" on public.layouts;
drop policy if exists "Authenticated users can add layouts" on public.layouts;
drop policy if exists "Course creators can update layouts" on public.layouts;

create policy "Authenticated users can view layouts"
  on public.layouts
  for select
  to authenticated
  using (true);

create policy "Authenticated users can add layouts"
  on public.layouts
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

create policy "Course creators can update layouts"
  on public.layouts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      where c.id = layouts.course_id
        and c.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.courses c
      where c.id = layouts.course_id
        and c.created_by = (select auth.uid())
    )
  );

-- Holes follow the same parent-course ownership rule through layouts.
drop policy if exists "Anyone authenticated can view holes" on public.holes;
drop policy if exists "Authenticated users can add holes" on public.holes;
drop policy if exists "Authenticated users can view holes" on public.holes;
drop policy if exists "Course creators can update holes" on public.holes;

create policy "Authenticated users can view holes"
  on public.holes
  for select
  to authenticated
  using (true);

create policy "Authenticated users can add holes"
  on public.holes
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

create policy "Course creators can update holes"
  on public.holes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.layouts l
      join public.courses c on c.id = l.course_id
      where l.id = holes.layout_id
        and c.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.layouts l
      join public.courses c on c.id = l.course_id
      where l.id = holes.layout_id
        and c.created_by = (select auth.uid())
    )
  );

-- Course aliases are shared, insert-open, and update-closed.
drop policy if exists "Anyone authenticated can view course aliases" on public.course_aliases;
drop policy if exists "Authenticated users can add course aliases" on public.course_aliases;
drop policy if exists "Authenticated users can view course aliases" on public.course_aliases;
drop policy if exists "Authenticated users can add course aliases" on public.course_aliases;

create policy "Authenticated users can view course aliases"
  on public.course_aliases
  for select
  to authenticated
  using (true);

create policy "Authenticated users can add course aliases"
  on public.course_aliases
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

-- Round data is private to its owner. One FOR ALL policy includes SELECT so
-- UPDATE has the required read side of the RLS contract.
drop policy if exists "Users manage own rounds" on public.rounds;
drop policy if exists "Authenticated users manage own rounds" on public.rounds;

create policy "Authenticated users manage own rounds"
  on public.rounds
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage round_holes via parent round" on public.round_holes;
drop policy if exists "Authenticated users manage round_holes via parent round" on public.round_holes;

create policy "Authenticated users manage round_holes via parent round"
  on public.round_holes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.rounds r
      where r.id = round_holes.round_id
        and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.rounds r
      where r.id = round_holes.round_id
        and r.user_id = (select auth.uid())
    )
  );
