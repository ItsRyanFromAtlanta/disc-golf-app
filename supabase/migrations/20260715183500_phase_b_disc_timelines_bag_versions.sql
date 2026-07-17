-- Phase B 2A: immutable physical-disc timelines and bag configuration snapshots.
--
-- IDEAL COLUMN FORMAT
-- - offline identities and foreign keys: uuid, generated client-side where replay matters;
-- - ownership: non-null user_id with indexed auth.uid()-scoped RLS;
-- - append-only ordering: occurred_at + recorded_at timestamptz and monotonic bag version integer;
-- - mutation provenance: constrained source/reason text, object-shaped jsonb before/after values,
--   globally unique non-blank idempotency keys;
-- - historical activity references: nullable immutable bag_version_id snapshot FK.

begin;

create table public.disc_state_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'status_changed', 'role_changed', 'wear_changed', 'condition_changed',
    'bag_added', 'bag_removed', 'details_changed'
  )),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in (
    'manual_entry', 'manual_correction', 'round_capture', 'import', 'system_inference', 'admin_repair'
  )),
  reason text,
  previous_values jsonb not null default '{}'::jsonb check (jsonb_typeof(previous_values) = 'object'),
  new_values jsonb not null default '{}'::jsonb check (jsonb_typeof(new_values) = 'object'),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index disc_state_events_user_recorded_idx
  on public.disc_state_events (user_id, recorded_at desc, id);
create index disc_state_events_disc_occurred_idx
  on public.disc_state_events (disc_id, occurred_at desc, id);

create table public.bag_versions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bag_id uuid not null references public.bags(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null check (length(btrim(name)) > 0),
  description text,
  bag_type text,
  capacity integer check (capacity is null or capacity between 0 and 35),
  is_default boolean not null default false,
  reason text not null check (reason in ('initial_snapshot', 'grouped_save', 'restore', 'system_backfill')),
  source text not null check (source in ('manual_entry', 'manual_correction', 'system_inference', 'admin_repair')),
  restored_from_version_id uuid references public.bag_versions(id),
  created_at timestamptz not null default now(),
  idempotency_key text not null unique check (length(btrim(idempotency_key)) > 0),
  unique (bag_id, version),
  unique (id, user_id)
);

create index bag_versions_user_created_idx on public.bag_versions (user_id, created_at desc, id);
create index bag_versions_bag_version_idx on public.bag_versions (bag_id, version desc);

create table public.bag_version_discs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bag_version_id uuid not null,
  disc_id uuid not null references public.discs(id),
  position integer check (position is null or position >= 0),
  added_at timestamptz,
  unique (bag_version_id, disc_id),
  constraint bag_version_discs_version_owner_fkey
    foreign key (bag_version_id, user_id)
    references public.bag_versions(id, user_id)
    on delete cascade
);

create index bag_version_discs_user_idx on public.bag_version_discs (user_id);
create index bag_version_discs_disc_idx on public.bag_version_discs (disc_id);

alter table public.rounds
  add column bag_version_id uuid references public.bag_versions(id);
create index rounds_bag_version_id_idx on public.rounds (bag_version_id)
  where bag_version_id is not null;

alter table public.disc_state_events enable row level security;
alter table public.bag_versions enable row level security;
alter table public.bag_version_discs enable row level security;

create policy disc_state_events_select_own on public.disc_state_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy disc_state_events_insert_own on public.disc_state_events
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.discs d where d.id = disc_id and d.user_id = (select auth.uid())
    )
  );

create policy bag_versions_select_own on public.bag_versions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy bag_versions_insert_own on public.bag_versions
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.bags b where b.id = bag_id and b.user_id = (select auth.uid())
    ) and (
      restored_from_version_id is null or exists (
        select 1 from public.bag_versions prior
        where prior.id = restored_from_version_id and prior.user_id = (select auth.uid())
      )
    )
  );

create policy bag_version_discs_select_own on public.bag_version_discs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy bag_version_discs_insert_own on public.bag_version_discs
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.bag_versions v
      where v.id = bag_version_id and v.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.discs d
      where d.id = disc_id and d.user_id = (select auth.uid())
    )
  );

create or replace function private.record_disc_state_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  kind text;
  before_values jsonb := '{}'::jsonb;
  after_values jsonb := '{}'::jsonb;
begin
  if old.status is distinct from new.status then
    kind := 'status_changed'; before_values := jsonb_build_object('status', old.status); after_values := jsonb_build_object('status', new.status);
  elsif old.role is distinct from new.role then
    kind := 'role_changed'; before_values := jsonb_build_object('role', old.role); after_values := jsonb_build_object('role', new.role);
  elsif old.wear_score is distinct from new.wear_score then
    kind := 'wear_changed'; before_values := jsonb_build_object('wear_score', old.wear_score); after_values := jsonb_build_object('wear_score', new.wear_score);
  elsif old.condition is distinct from new.condition then
    kind := 'condition_changed'; before_values := jsonb_build_object('condition', old.condition); after_values := jsonb_build_object('condition', new.condition);
  else return new;
  end if;
  insert into public.disc_state_events (
    id, user_id, disc_id, event_type, occurred_at, source, previous_values, new_values, idempotency_key
  ) values (
    gen_random_uuid(), new.user_id, new.id, kind, now(), 'manual_entry', before_values, after_values,
    'disc-trigger:' || gen_random_uuid()::text
  );
  return new;
end;
$$;

create trigger discs_record_state_change
after update on public.discs
for each row execute function private.record_disc_state_change();

create or replace function private.record_bag_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  membership public.bag_discs%rowtype := coalesce(new, old);
  owner_id uuid;
begin
  select user_id into owner_id from public.bags where id = membership.bag_id;
  insert into public.disc_state_events (
    id, user_id, disc_id, event_type, occurred_at, source, previous_values, new_values, idempotency_key
  ) values (
    gen_random_uuid(), owner_id, membership.disc_id,
    case when tg_op = 'INSERT' then 'bag_added' else 'bag_removed' end,
    now(), 'manual_entry',
    case when tg_op = 'DELETE' then jsonb_build_object('bag_id', membership.bag_id) else '{}'::jsonb end,
    case when tg_op = 'INSERT' then jsonb_build_object('bag_id', membership.bag_id) else '{}'::jsonb end,
    'bag-membership-trigger:' || gen_random_uuid()::text
  );
  return coalesce(new, old);
end;
$$;

create trigger bag_discs_record_membership_change
after insert or delete on public.bag_discs
for each row execute function private.record_bag_membership_change();

revoke all on function private.record_disc_state_change() from public, anon, authenticated;
revoke all on function private.record_bag_membership_change() from public, anon, authenticated;

revoke all on table public.disc_state_events, public.bag_versions, public.bag_version_discs
  from public, anon, authenticated;
grant select, insert on table public.disc_state_events, public.bag_versions, public.bag_version_discs
  to authenticated;
grant all on table public.disc_state_events, public.bag_versions, public.bag_version_discs
  to service_role;

-- Existing bags become version 1 without altering current membership state.
insert into public.bag_versions (
  id, user_id, bag_id, version, name, description, bag_type, capacity, is_default,
  reason, source, created_at, idempotency_key
)
select gen_random_uuid(), b.user_id, b.id, 1, b.name, b.description, b.bag_type, b.capacity,
  b.is_default, 'system_backfill', 'system_inference', b.created_at,
  'bag-version:backfill:' || b.id::text
from public.bags b;

insert into public.bag_version_discs (id, user_id, bag_version_id, disc_id, added_at)
select gen_random_uuid(), v.user_id, v.id, bd.disc_id, bd.added_at
from public.bag_versions v
join public.bag_discs bd on bd.bag_id = v.bag_id
where v.version = 1;

create or replace function public.capture_bag_version(
  p_bag_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_restored_from_version_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  bag_row public.bags%rowtype;
  version_id uuid := gen_random_uuid();
  next_version integer;
  existing_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('grouped_save', 'restore') then raise exception 'Invalid snapshot reason'; end if;

  select id into existing_id from public.bag_versions where idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  select * into bag_row from public.bags where id = p_bag_id and user_id = owner_id for update;
  if not found then raise exception 'Bag not found'; end if;
  select coalesce(max(version), 0) + 1 into next_version
    from public.bag_versions where bag_id = p_bag_id;

  insert into public.bag_versions (
    id, user_id, bag_id, version, name, description, bag_type, capacity, is_default,
    reason, source, restored_from_version_id, idempotency_key
  ) values (
    version_id, owner_id, bag_row.id, next_version, bag_row.name, bag_row.description,
    bag_row.bag_type, bag_row.capacity, bag_row.is_default, p_reason, 'manual_entry',
    p_restored_from_version_id, p_idempotency_key
  );

  insert into public.bag_version_discs (id, user_id, bag_version_id, disc_id, added_at)
  select gen_random_uuid(), owner_id, version_id, bd.disc_id, bd.added_at
  from public.bag_discs bd where bd.bag_id = p_bag_id;
  return version_id;
end;
$$;

create or replace function public.restore_bag_version(
  p_source_version_id uuid,
  p_idempotency_key text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  source_row public.bag_versions%rowtype;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select * into source_row from public.bag_versions
    where id = p_source_version_id and user_id = owner_id;
  if not found then raise exception 'Bag version not found'; end if;

  delete from public.bag_discs where bag_id = source_row.bag_id;
  insert into public.bag_discs (bag_id, disc_id, added_at)
  select source_row.bag_id, snapshot.disc_id, coalesce(snapshot.added_at, now())
  from public.bag_version_discs snapshot
  join public.discs d on d.id = snapshot.disc_id and d.user_id = owner_id
  where snapshot.bag_version_id = p_source_version_id
    and d.status = 'in_locker'
  on conflict (bag_id, disc_id) do nothing;

  return public.capture_bag_version(
    source_row.bag_id, 'restore', p_idempotency_key, p_source_version_id
  );
end;
$$;

revoke all on function public.capture_bag_version(uuid, text, text, uuid) from public, anon;
revoke all on function public.restore_bag_version(uuid, text) from public, anon;
grant execute on function public.capture_bag_version(uuid, text, text, uuid) to authenticated;
grant execute on function public.restore_bag_version(uuid, text) to authenticated;

commit;
