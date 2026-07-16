-- Phase C item 2 follow-up: retain owner attribution when bag deletion cascades membership deletes.
-- Ideal contract: immutable bag membership events always carry the physical disc owner UUID.
-- Rollback: restore private.record_bag_membership_change() from migration 20260715183500.

begin;

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
  if owner_id is null then
    -- During ON DELETE CASCADE the parent bag is already invisible to this trigger.
    select user_id into owner_id from public.discs where id = membership.disc_id;
  end if;
  if owner_id is null then raise exception 'Unable to attribute bag membership event owner'; end if;

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

revoke all on function private.record_bag_membership_change() from public, anon, authenticated;

commit;
