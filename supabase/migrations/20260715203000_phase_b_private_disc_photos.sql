--
-- Phase B item 3: private physical-disc photos.
--
-- Ideal format:
--   * disc_photos: immutable UUID version rows owned by auth.users and tied to
--     one physical disc; slot is front/back/side, object paths are immutable,
--     dimensions/bytes/MIME describe the compressed derivative, and lifecycle
--     timestamps preserve replacement plus 30-day deletion recovery.
--   * one partial unique index selects the current visible version per slot.
--   * Storage objects live at <user>/<disc>/<slot>/<photo>.webp in a private,
--     image-only bucket. Signed URLs are ephemeral and are never persisted.
--

begin;

create table public.disc_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id) on delete cascade,
  slot text not null check (slot in ('front', 'back', 'side')),
  storage_bucket text not null default 'disc-private-photos'
    check (storage_bucket = 'disc-private-photos'),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/webp', 'image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  deleted_at timestamptz,
  recoverable_until timestamptz,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  constraint disc_photos_storage_path_uniq unique (storage_bucket, storage_path),
  constraint disc_photos_idempotency_uniq unique (user_id, idempotency_key),
  constraint disc_photos_lifecycle_check check (
    (deleted_at is null and recoverable_until is null)
    or (deleted_at is not null and recoverable_until = deleted_at + interval '30 days')
  ),
  constraint disc_photos_superseded_check check (
    superseded_at is null or superseded_at >= created_at
  )
);

create unique index disc_photos_current_slot_uniq
  on public.disc_photos (disc_id, slot)
  where superseded_at is null and deleted_at is null;
create index disc_photos_disc_history_idx
  on public.disc_photos (disc_id, slot, created_at desc);
create index disc_photos_recovery_idx
  on public.disc_photos (user_id, recoverable_until)
  where deleted_at is not null and superseded_at is null;

alter table public.disc_photos enable row level security;

create policy disc_photos_select_own on public.disc_photos
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy disc_photos_insert_own on public.disc_photos
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.discs d
      where d.id = disc_id and d.user_id = (select auth.uid())
    )
  );
create policy disc_photos_update_own on public.disc_photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.disc_photos from public, anon;
grant select, insert, update on table public.disc_photos to authenticated;

create or replace function public.register_disc_photo(
  p_id uuid,
  p_disc_id uuid,
  p_slot text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer,
  p_idempotency_key text,
  p_created_at timestamptz default now()
)
returns public.disc_photos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.disc_photos;
  v_expected_prefix text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_slot not in ('front', 'back', 'side') then
    raise exception using errcode = '22023', message = 'invalid_disc_photo_slot';
  end if;
  if not exists (
    select 1 from public.discs d where d.id = p_disc_id and d.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'disc_not_owned';
  end if;

  v_expected_prefix := v_user_id::text || '/' || p_disc_id::text || '/' || p_slot || '/';
  if left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix
     or p_storage_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(front|back|side)/[0-9a-f-]{36}[.](webp|jpg|png)$' then
    raise exception using errcode = '22023', message = 'invalid_disc_photo_path';
  end if;

  select * into v_row
  from public.disc_photos
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    return v_row;
  end if;

  update public.disc_photos
  set superseded_at = p_created_at
  where disc_id = p_disc_id and slot = p_slot
    and superseded_at is null and deleted_at is null;

  insert into public.disc_photos (
    id, user_id, disc_id, slot, storage_path, mime_type, byte_size,
    width, height, idempotency_key, created_at
  ) values (
    p_id, v_user_id, p_disc_id, p_slot, p_storage_path, p_mime_type,
    p_byte_size, p_width, p_height, p_idempotency_key, p_created_at
  ) returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.delete_disc_photo(
  p_photo_id uuid,
  p_deleted_at timestamptz default now()
)
returns public.disc_photos
language plpgsql
security invoker
set search_path = ''
as $$
declare v_row public.disc_photos;
begin
  update public.disc_photos
  set deleted_at = coalesce(deleted_at, p_deleted_at),
      recoverable_until = coalesce(recoverable_until, p_deleted_at + interval '30 days')
  where id = p_photo_id and user_id = (select auth.uid()) and superseded_at is null
  returning * into v_row;
  if not found then
    raise exception using errcode = 'P0002', message = 'current_disc_photo_not_found';
  end if;
  return v_row;
end;
$$;

create or replace function public.restore_disc_photo(p_photo_id uuid)
returns public.disc_photos
language plpgsql
security invoker
set search_path = ''
as $$
declare v_row public.disc_photos;
begin
  update public.disc_photos
  set deleted_at = null, recoverable_until = null
  where id = p_photo_id and user_id = (select auth.uid())
    and superseded_at is null and deleted_at is not null
    and recoverable_until >= now()
    and not exists (
      select 1 from public.disc_photos current_photo
      where current_photo.disc_id = disc_photos.disc_id
        and current_photo.slot = disc_photos.slot
        and current_photo.id <> disc_photos.id
        and current_photo.superseded_at is null
        and current_photo.deleted_at is null
    )
  returning * into v_row;
  if not found then
    raise exception using errcode = 'P0002', message = 'recoverable_disc_photo_not_found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.register_disc_photo(uuid, uuid, text, text, text, integer, integer, integer, text, timestamptz) from public, anon;
revoke all on function public.delete_disc_photo(uuid, timestamptz) from public, anon;
revoke all on function public.restore_disc_photo(uuid) from public, anon;
grant execute on function public.register_disc_photo(uuid, uuid, text, text, text, integer, integer, integer, text, timestamptz) to authenticated;
grant execute on function public.delete_disc_photo(uuid, timestamptz) to authenticated;
grant execute on function public.restore_disc_photo(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'disc-private-photos', 'disc-private-photos', false, 5242880,
  array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = pg_catalog.now();

create policy disc_private_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'disc-private-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy disc_private_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'disc-private-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
  );

commit;
