-- Phase D4 checkpoint 3: immutable new-putter experiment markers.
-- Ideal format: owner UUID + physical disc UUID, client-generated idempotency
-- key, explicit effective timestamp, and short human context. Markers are
-- append-only evidence boundaries; before/after metrics remain derived from
-- completed-visible real-time putt_events and are never stored here.
-- Rollback: revoke marker grants, drop the owner policies/indexes, then drop
-- public.practice_experiment_markers. Existing practice events are untouched.

begin;

create table public.practice_experiment_markers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id),
  marker_type text not null default 'new_putter'
    check (marker_type = 'new_putter'),
  effective_at timestamptz not null,
  label text not null default 'New putter'
    check (length(btrim(label)) between 1 and 120),
  notes text check (notes is null or length(btrim(notes)) between 1 and 1000),
  created_at timestamptz not null default now(),
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 1 and 200),
  unique (id, user_id),
  unique (user_id, idempotency_key)
);

create index practice_experiment_markers_user_effective_idx
  on public.practice_experiment_markers (user_id, effective_at desc);
create index practice_experiment_markers_disc_effective_idx
  on public.practice_experiment_markers (disc_id, effective_at desc);

alter table public.practice_experiment_markers enable row level security;

create policy practice_experiment_markers_select_own
  on public.practice_experiment_markers
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy practice_experiment_markers_insert_own
  on public.practice_experiment_markers
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.discs d
      where d.id = disc_id
        and d.user_id = (select auth.uid())
    )
  );

-- There are deliberately no authenticated UPDATE or DELETE policies. The
-- marker is a historical boundary; corrections are represented by a new row.
revoke all on table public.practice_experiment_markers from public, anon, authenticated;
grant select, insert on table public.practice_experiment_markers to authenticated;
grant all on table public.practice_experiment_markers to service_role;

commit;
