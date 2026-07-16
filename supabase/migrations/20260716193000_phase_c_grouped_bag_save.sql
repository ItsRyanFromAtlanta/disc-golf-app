-- Phase C item 2: atomic grouped bag editing and main-bag invariants.
--
-- Ideal contract:
-- - bag metadata retains the existing typed columns and constraints;
-- - membership is supplied as a distinct uuid[] capped at 35 entries;
-- - one grouped save updates metadata/membership/default state and captures one immutable version;
-- - one owner-private default bag is retained; external naming remains an app presentation concern;
-- - idempotency keys are non-empty text and reuse bag_versions' unique key.
--
-- Rollback: revoke/drop grouped_save_bag and delete_bag_with_replacement, then drop
-- bags_protect_main_delete and private.protect_main_bag_delete. Existing versions and bag data remain valid.

begin;

-- Repair only legacy bag sets that have no default; the partial unique index already prevents two.
with replacement as (
  select distinct on (user_id) id
  from public.bags b
  where not exists (
    select 1 from public.bags current_main where current_main.user_id = b.user_id and current_main.is_default
  )
  order by user_id, created_at, id
)
update public.bags set is_default = true
where id in (select id from replacement);

create or replace function private.protect_main_bag_delete()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_bag_count integer;
begin
  -- Administrative/auth-user cascades are outside the interactive bag contract.
  if (select auth.uid()) is null then return old; end if;
  select count(*) into owner_bag_count from public.bags where user_id = old.user_id;
  if owner_bag_count <= 1 then raise exception 'The only main bag cannot be deleted'; end if;
  if old.is_default then raise exception 'Promote a replacement main bag before deleting this bag'; end if;
  return old;
end;
$$;

drop trigger if exists bags_protect_main_delete on public.bags;
create trigger bags_protect_main_delete
before delete on public.bags
for each row execute function private.protect_main_bag_delete();
revoke all on function private.protect_main_bag_delete() from public, anon, authenticated;

create or replace function public.grouped_save_bag(
  p_bag_id uuid,
  p_name text,
  p_description text,
  p_bag_type text,
  p_capacity integer,
  p_make_default boolean,
  p_disc_ids uuid[],
  p_idempotency_key text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  target_bag public.bags%rowtype;
  normalized_ids uuid[];
  version_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Bag name is required'; end if;
  if p_capacity is not null and (p_capacity < 0 or p_capacity > 35) then
    raise exception 'Bag capacity must be between 0 and 35';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'Idempotency key is required'; end if;

  select id into version_id from public.bag_versions where idempotency_key = p_idempotency_key;
  if version_id is not null then return version_id; end if;

  select * into target_bag from public.bags
    where id = p_bag_id and user_id = owner_id for update;
  if not found then raise exception 'Bag not found'; end if;

  -- Lock the owner's bag set so concurrent promotions cannot create a no-main interval.
  perform id from public.bags where user_id = owner_id order by id for update;

  select coalesce(array_agg(distinct requested_id), '{}'::uuid[])
    into normalized_ids
  from unnest(coalesce(p_disc_ids, '{}'::uuid[])) requested_id;

  if cardinality(normalized_ids) > 35 then raise exception 'A bag cannot contain more than 35 discs'; end if;
  if exists (
    select 1 from unnest(normalized_ids) requested_id
    left join public.discs d on d.id = requested_id and d.user_id = owner_id
    where d.id is null
  ) then raise exception 'Bag contains an unavailable or foreign disc'; end if;

  if p_make_default or not exists (
    select 1 from public.bags where user_id = owner_id and is_default
  ) then
    update public.bags set is_default = false where user_id = owner_id and is_default and id <> p_bag_id;
    target_bag.is_default := true;
  end if;

  update public.bags set
    name = btrim(p_name),
    description = nullif(btrim(p_description), ''),
    bag_type = nullif(btrim(p_bag_type), ''),
    capacity = p_capacity,
    is_default = target_bag.is_default
  where id = p_bag_id and user_id = owner_id;

  delete from public.bag_discs where bag_id = p_bag_id and disc_id <> all(normalized_ids);
  insert into public.bag_discs (bag_id, disc_id)
  select p_bag_id, requested_id from unnest(normalized_ids) requested_id
  on conflict (bag_id, disc_id) do nothing;

  return public.capture_bag_version(p_bag_id, 'grouped_save', p_idempotency_key, null);
end;
$$;

create or replace function public.delete_bag_with_replacement(
  p_bag_id uuid,
  p_replacement_default_id uuid default null
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  target_bag public.bags%rowtype;
  bag_count integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform id from public.bags where user_id = owner_id order by id for update;
  select * into target_bag from public.bags where user_id = owner_id and id = p_bag_id;
  if not found then raise exception 'Bag not found'; end if;
  select count(*) into bag_count from public.bags where user_id = owner_id;
  if bag_count <= 1 then raise exception 'The only main bag cannot be deleted'; end if;

  if target_bag.is_default then
    if p_replacement_default_id is null or p_replacement_default_id = p_bag_id or not exists (
      select 1 from public.bags where id = p_replacement_default_id and user_id = owner_id
    ) then raise exception 'Choose another owned bag as the replacement main bag'; end if;
    update public.bags set is_default = false where id = p_bag_id;
    update public.bags set is_default = true where id = p_replacement_default_id and user_id = owner_id;
  end if;

  delete from public.bags where id = p_bag_id and user_id = owner_id;
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
  target_is_default boolean;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select * into source_row from public.bag_versions
    where id = p_source_version_id and user_id = owner_id;
  if not found then raise exception 'Bag version not found'; end if;

  perform id from public.bags where user_id = owner_id order by id for update;
  select is_default into target_is_default from public.bags
    where id = source_row.bag_id and user_id = owner_id for update;
  if not found then raise exception 'Bag not found'; end if;

  if source_row.is_default then
    update public.bags set is_default = false
      where user_id = owner_id and is_default and id <> source_row.bag_id;
    target_is_default := true;
  end if;

  update public.bags set
    name = source_row.name,
    description = source_row.description,
    bag_type = source_row.bag_type,
    capacity = source_row.capacity,
    is_default = target_is_default
  where id = source_row.bag_id and user_id = owner_id;

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

revoke all on function public.grouped_save_bag(uuid, text, text, text, integer, boolean, uuid[], text)
  from public, anon;
revoke all on function public.delete_bag_with_replacement(uuid, uuid) from public, anon;
revoke all on function public.restore_bag_version(uuid, text) from public, anon;
grant execute on function public.grouped_save_bag(uuid, text, text, text, integer, boolean, uuid[], text)
  to authenticated;
grant execute on function public.delete_bag_with_replacement(uuid, uuid) to authenticated;
grant execute on function public.restore_bag_version(uuid, text) to authenticated;

commit;
