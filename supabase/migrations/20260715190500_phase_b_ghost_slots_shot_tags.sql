-- Phase B 2B: persisted ghost slots and reversible physical-disc shot tags.
--
-- IDEAL COLUMN FORMAT
-- - offline identities: client-generated uuid primary keys;
-- - ownership: non-null user_id on private rows with indexed auth.uid() RLS;
-- - shared dictionary: nullable user_id (null = curated system tag), normalized slug + label;
-- - reversible assignments: append-only rows with nullable removed_at tombstone and partial active uniqueness;
-- - replay safety: globally unique, non-blank idempotency keys on assignments.

begin;

create table public.bag_ghost_slots (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bag_id uuid not null references public.bags(id) on delete cascade,
  speed_class text not null check (speed_class in ('putter', 'midrange', 'fairway', 'distance')),
  stability_class text not null check (stability_class in ('understable', 'stable', 'overstable')),
  target_speed numeric check (target_speed is null or target_speed between 1 and 15),
  target_glide numeric check (target_glide is null or target_glide between 0 and 7),
  target_turn numeric check (target_turn is null or target_turn between -5 and 2),
  target_fade numeric check (target_fade is null or target_fade between 0 and 5),
  notes text,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  check (removed_at is null or removed_at >= created_at)
);

create unique index bag_ghost_slots_active_slot_uniq
  on public.bag_ghost_slots (bag_id, speed_class, stability_class)
  where removed_at is null;
create index bag_ghost_slots_user_bag_idx on public.bag_ghost_slots (user_id, bag_id);

create table public.shot_tags (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) > 0),
  category text not null check (category in ('release', 'shape', 'utility', 'situational')),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index shot_tags_system_slug_uniq on public.shot_tags (slug) where user_id is null;
create unique index shot_tags_user_slug_uniq on public.shot_tags (user_id, slug) where user_id is not null;
create index shot_tags_user_id_idx on public.shot_tags (user_id) where user_id is not null;

create table public.disc_shot_tag_assignments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id) on delete cascade,
  shot_tag_id uuid not null references public.shot_tags(id),
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  idempotency_key text not null unique check (length(btrim(idempotency_key)) > 0),
  check (removed_at is null or removed_at >= assigned_at)
);

create unique index disc_shot_tag_assignments_active_uniq
  on public.disc_shot_tag_assignments (disc_id, shot_tag_id)
  where removed_at is null;
create index disc_shot_tag_assignments_user_disc_idx
  on public.disc_shot_tag_assignments (user_id, disc_id, assigned_at desc);
create index disc_shot_tag_assignments_tag_idx on public.disc_shot_tag_assignments (shot_tag_id);

alter table public.bag_ghost_slots enable row level security;
alter table public.shot_tags enable row level security;
alter table public.disc_shot_tag_assignments enable row level security;

create policy bag_ghost_slots_select_own on public.bag_ghost_slots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy bag_ghost_slots_insert_own on public.bag_ghost_slots
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.bags b where b.id = bag_id and b.user_id = (select auth.uid())
    )
  );
create policy bag_ghost_slots_update_own on public.bag_ghost_slots
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy shot_tags_select_available on public.shot_tags
  for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy shot_tags_insert_own on public.shot_tags
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shot_tags_update_own on public.shot_tags
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy disc_shot_tag_assignments_select_own on public.disc_shot_tag_assignments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy disc_shot_tag_assignments_insert_own on public.disc_shot_tag_assignments
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.discs d where d.id = disc_id and d.user_id = (select auth.uid()))
    and exists (
      select 1 from public.shot_tags t
      where t.id = shot_tag_id and t.retired_at is null
        and (t.user_id is null or t.user_id = (select auth.uid()))
    )
  );
create policy disc_shot_tag_assignments_tombstone_own on public.disc_shot_tag_assignments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and removed_at is not null);

revoke all on table public.bag_ghost_slots, public.shot_tags, public.disc_shot_tag_assignments
  from public, anon, authenticated;
grant select, insert, update on table public.bag_ghost_slots to authenticated;
grant select, insert, update on table public.shot_tags to authenticated;
grant select, insert on table public.disc_shot_tag_assignments to authenticated;
grant update (removed_at) on table public.disc_shot_tag_assignments to authenticated;
grant all on table public.bag_ghost_slots, public.shot_tags, public.disc_shot_tag_assignments
  to service_role;

insert into public.shot_tags (id, slug, label, category) values
  (gen_random_uuid(), 'backhand', 'Backhand', 'release'),
  (gen_random_uuid(), 'forehand', 'Forehand', 'release'),
  (gen_random_uuid(), 'hyzer', 'Hyzer', 'shape'),
  (gen_random_uuid(), 'anhyzer', 'Anhyzer', 'shape'),
  (gen_random_uuid(), 'turnover', 'Turnover', 'shape'),
  (gen_random_uuid(), 'roller', 'Roller', 'utility'),
  (gen_random_uuid(), 'skip', 'Skip', 'utility'),
  (gen_random_uuid(), 'tomahawk', 'Tomahawk', 'utility'),
  (gen_random_uuid(), 'thumber', 'Thumber', 'utility'),
  (gen_random_uuid(), 'wind-fighter', 'Wind Fighter', 'situational');

commit;
