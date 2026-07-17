-- Phase B item 4: private Lost & Found cases and immutable update timelines.
--
-- IDEAL COLUMN FORMAT
-- - offline-safe identities: client-generated uuid primary keys and non-blank idempotency keys;
-- - ownership: non-null user_id, composite owner foreign keys, indexed auth.uid()-scoped RLS;
-- - case state: constrained text status with opened/resolved/latest-update timestamptz values;
-- - location: optional shared course uuid plus bounded text and paired numeric(9,6) coordinates;
-- - timeline: append-only event rows ordered by occurred_at then recorded_at, never auto-archived.

begin;

create table public.lost_found_cases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'recovered', 'closed')),
  opened_at timestamptz not null,
  resolved_at timestamptz,
  latest_update_at timestamptz not null,
  created_at timestamptz not null default now(),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  check ((status = 'open' and resolved_at is null) or (status <> 'open' and resolved_at is not null))
);

create unique index lost_found_cases_one_open_disc_idx
  on public.lost_found_cases (disc_id) where status = 'open';
create index lost_found_cases_user_status_latest_idx
  on public.lost_found_cases (user_id, status, latest_update_at desc, id);
create index lost_found_cases_disc_opened_idx
  on public.lost_found_cases (disc_id, opened_at desc, id);

create table public.lost_found_updates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null,
  event_type text not null check (event_type in (
    'reported_lost', 'location_updated', 'sighting', 'contact_updated',
    'note_added', 'recovered', 'closed'
  )),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  course_id uuid references public.courses(id) on delete set null,
  area_text text check (area_text is null or length(btrim(area_text)) between 1 and 500),
  latitude numeric(9,6),
  longitude numeric(9,6),
  notes text check (notes is null or length(btrim(notes)) between 1 and 4000),
  contact_name text check (contact_name is null or length(btrim(contact_name)) between 1 and 200),
  contact_value text check (contact_value is null or length(btrim(contact_value)) between 1 and 500),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  constraint lost_found_updates_case_owner_fkey
    foreign key (case_id, user_id)
    references public.lost_found_cases(id, user_id)
    on delete cascade,
  unique (user_id, idempotency_key),
  check ((latitude is null) = (longitude is null)),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create index lost_found_updates_case_occurred_idx
  on public.lost_found_updates (case_id, occurred_at desc, recorded_at desc, id);
create index lost_found_updates_user_recorded_idx
  on public.lost_found_updates (user_id, recorded_at desc, id);
create index lost_found_updates_course_idx
  on public.lost_found_updates (course_id) where course_id is not null;

alter table public.lost_found_cases enable row level security;
alter table public.lost_found_updates enable row level security;

create policy lost_found_cases_select_own on public.lost_found_cases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy lost_found_updates_select_own on public.lost_found_updates
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function private.prevent_lost_found_update_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Lost & Found updates are immutable';
end;
$$;

create trigger lost_found_updates_immutable
before update or delete on public.lost_found_updates
for each row execute function private.prevent_lost_found_update_mutation();

create or replace function private.open_lost_found_case(
  p_case_id uuid,
  p_update_id uuid,
  p_disc_id uuid,
  p_occurred_at timestamptz,
  p_course_id uuid,
  p_area_text text,
  p_latitude numeric,
  p_longitude numeric,
  p_notes text,
  p_contact_name text,
  p_contact_value text,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  disc_status text;
  existing_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_case_id is null or p_update_id is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'Case, update, and idempotency identifiers are required';
  end if;

  select id into existing_id
    from public.lost_found_cases
    where user_id = owner_id and idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  select status into disc_status
    from public.discs
    where id = p_disc_id and user_id = owner_id
    for update;
  if not found then raise exception 'Disc not found'; end if;
  if disc_status in ('retired', 'sold') then raise exception 'Disc status cannot open a Lost & Found case'; end if;
  if exists (select 1 from public.lost_found_cases where disc_id = p_disc_id and status = 'open') then
    raise exception 'Disc already has an open Lost & Found case';
  end if;

  insert into public.lost_found_cases (
    id, user_id, disc_id, status, opened_at, latest_update_at, idempotency_key
  ) values (
    p_case_id, owner_id, p_disc_id, 'open', p_occurred_at, p_occurred_at, p_idempotency_key
  );
  insert into public.lost_found_updates (
    id, user_id, case_id, event_type, occurred_at, course_id, area_text,
    latitude, longitude, notes, contact_name, contact_value, idempotency_key
  ) values (
    p_update_id, owner_id, p_case_id, 'reported_lost', p_occurred_at, p_course_id,
    nullif(btrim(p_area_text), ''), p_latitude, p_longitude, nullif(btrim(p_notes), ''),
    nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_value), ''),
    p_idempotency_key || ':reported'
  );
  if disc_status <> 'lost' then
    update public.discs set status = 'lost' where id = p_disc_id and user_id = owner_id;
  end if;
  return p_case_id;
end;
$$;

create or replace function private.append_lost_found_update(
  p_update_id uuid,
  p_case_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_course_id uuid,
  p_area_text text,
  p_latitude numeric,
  p_longitude numeric,
  p_notes text,
  p_contact_name text,
  p_contact_value text,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  case_row public.lost_found_cases%rowtype;
  existing_case_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_update_id is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'Update and idempotency identifiers are required';
  end if;
  if p_event_type not in ('location_updated', 'sighting', 'contact_updated', 'note_added', 'recovered', 'closed') then
    raise exception 'Invalid Lost & Found update type';
  end if;

  select case_id into existing_case_id
    from public.lost_found_updates
    where user_id = owner_id and idempotency_key = p_idempotency_key;
  if existing_case_id is not null then return existing_case_id; end if;

  select * into case_row
    from public.lost_found_cases
    where id = p_case_id and user_id = owner_id
    for update;
  if not found then raise exception 'Lost & Found case not found'; end if;
  if case_row.status <> 'open' then raise exception 'Lost & Found case is already resolved'; end if;

  insert into public.lost_found_updates (
    id, user_id, case_id, event_type, occurred_at, course_id, area_text,
    latitude, longitude, notes, contact_name, contact_value, idempotency_key
  ) values (
    p_update_id, owner_id, p_case_id, p_event_type, p_occurred_at, p_course_id,
    nullif(btrim(p_area_text), ''), p_latitude, p_longitude, nullif(btrim(p_notes), ''),
    nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_value), ''), p_idempotency_key
  );

  update public.lost_found_cases
    set latest_update_at = greatest(latest_update_at, p_occurred_at),
        status = case when p_event_type in ('recovered', 'closed') then p_event_type else status end,
        resolved_at = case when p_event_type in ('recovered', 'closed') then p_occurred_at else resolved_at end
    where id = p_case_id and user_id = owner_id;

  if p_event_type = 'recovered' then
    update public.discs set status = 'in_locker'
      where id = case_row.disc_id and user_id = owner_id;
  end if;
  return p_case_id;
end;
$$;

create or replace function public.open_lost_found_case(
  p_case_id uuid,
  p_update_id uuid,
  p_disc_id uuid,
  p_occurred_at timestamptz,
  p_course_id uuid default null,
  p_area_text text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_notes text default null,
  p_contact_name text default null,
  p_contact_value text default null,
  p_idempotency_key text default null
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.open_lost_found_case(
    p_case_id, p_update_id, p_disc_id, p_occurred_at, p_course_id, p_area_text,
    p_latitude, p_longitude, p_notes, p_contact_name, p_contact_value, p_idempotency_key
  );
$$;

create or replace function public.append_lost_found_update(
  p_update_id uuid,
  p_case_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_course_id uuid default null,
  p_area_text text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_notes text default null,
  p_contact_name text default null,
  p_contact_value text default null,
  p_idempotency_key text default null
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.append_lost_found_update(
    p_update_id, p_case_id, p_event_type, p_occurred_at, p_course_id, p_area_text,
    p_latitude, p_longitude, p_notes, p_contact_name, p_contact_value, p_idempotency_key
  );
$$;

revoke all on table public.lost_found_cases, public.lost_found_updates from public, anon, authenticated;
grant select on table public.lost_found_cases, public.lost_found_updates to authenticated;
grant all on table public.lost_found_cases, public.lost_found_updates to service_role;

revoke all on function private.prevent_lost_found_update_mutation() from public, anon, authenticated;
revoke all on function private.open_lost_found_case(uuid, uuid, uuid, timestamptz, uuid, text, numeric, numeric, text, text, text, text) from public, anon;
revoke all on function private.append_lost_found_update(uuid, uuid, text, timestamptz, uuid, text, numeric, numeric, text, text, text, text) from public, anon;
grant execute on function private.open_lost_found_case(uuid, uuid, uuid, timestamptz, uuid, text, numeric, numeric, text, text, text, text) to authenticated;
grant execute on function private.append_lost_found_update(uuid, uuid, text, timestamptz, uuid, text, numeric, numeric, text, text, text, text) to authenticated;

revoke all on function public.open_lost_found_case(uuid, uuid, uuid, timestamptz, uuid, text, numeric, numeric, text, text, text, text) from public, anon;
revoke all on function public.append_lost_found_update(uuid, uuid, text, timestamptz, uuid, text, numeric, numeric, text, text, text, text) from public, anon;
grant execute on function public.open_lost_found_case(uuid, uuid, uuid, timestamptz, uuid, text, numeric, numeric, text, text, text, text) to authenticated;
grant execute on function public.append_lost_found_update(uuid, uuid, text, timestamptz, uuid, text, numeric, numeric, text, text, text, text) to authenticated;

commit;
