-- Phase A A9: durable actionable notifications.
--
-- Ideal format: UUID primary key; owner UUID with cascade; constrained category
-- and priority; JSON object action payload; lifecycle timestamps; and a partial
-- unique unresolved dedupe index per user. The RPCs below are the only client
-- mutation path so owner identity and cross-device deduplication stay atomic.

begin;

create table public.notifications (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('activity', 'lost_disc', 'sync', 'weekly_report', 'equipment', 'community_review', 'achievement', 'coaching')),
  priority text not null check (priority in ('info', 'actionable', 'critical')),
  title text not null check (length(title) > 0),
  body text,
  action_type text,
  action_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(action_payload) = 'object'),
  activity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  dedupe_key text not null check (length(dedupe_key) > 0),
  constraint notifications_activity_owner_fkey foreign key (activity_id, user_id)
    references public.activities (id, user_id) on delete cascade,
  check (expires_at is null or expires_at >= created_at)
);

create unique index notifications_unresolved_dedupe_idx
  on public.notifications (user_id, dedupe_key) where resolved_at is null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_badge_idx on public.notifications (user_id, priority, created_at desc)
  where resolved_at is null;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create or replace function private.notification_upsert(
  p_notification_id uuid, p_category text, p_priority text, p_title text, p_body text,
  p_action_type text, p_action_payload jsonb, p_activity_id uuid, p_created_at timestamptz,
  p_expires_at timestamptz, p_dedupe_key text
) returns public.notifications
language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_notification public.notifications%rowtype;
begin
  if v_user_id is null then raise exception using errcode = 'P0001', message = 'unauthenticated'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_dedupe_key, 0));
  update public.notifications set resolved_at = coalesce(resolved_at, p_created_at), updated_at = p_created_at
    where user_id = v_user_id and dedupe_key = p_dedupe_key and resolved_at is null and expires_at is not null and expires_at <= p_created_at;
  select * into v_notification from public.notifications
    where user_id = v_user_id and dedupe_key = p_dedupe_key and resolved_at is null for update;
  if found then
    update public.notifications set priority = p_priority, title = p_title, body = p_body, action_type = p_action_type,
      action_payload = coalesce(p_action_payload, '{}'::jsonb), activity_id = p_activity_id, expires_at = p_expires_at,
      updated_at = p_created_at where id = v_notification.id returning * into v_notification;
  else
    insert into public.notifications (id, user_id, category, priority, title, body, action_type, action_payload, activity_id, created_at, expires_at, updated_at, dedupe_key)
      values (p_notification_id, v_user_id, p_category, p_priority, p_title, p_body, p_action_type, coalesce(p_action_payload, '{}'::jsonb), p_activity_id, p_created_at, p_expires_at, p_created_at, p_dedupe_key)
      returning * into v_notification;
  end if;
  return v_notification;
end;
$$;

create or replace function public.notification_upsert(
  p_notification_id uuid, p_category text, p_priority text, p_title text, p_body text,
  p_action_type text, p_action_payload jsonb, p_activity_id uuid, p_created_at timestamptz,
  p_expires_at timestamptz, p_dedupe_key text
) returns public.notifications language sql security invoker set search_path = '' as $$
  select * from private.notification_upsert(p_notification_id, p_category, p_priority, p_title, p_body, p_action_type, p_action_payload, p_activity_id, p_created_at, p_expires_at, p_dedupe_key);
$$;

create or replace function private.notification_set_status(p_notification_id uuid, p_read_at timestamptz, p_resolved_at timestamptz)
returns public.notifications language plpgsql security definer set search_path = '' as $$
declare v_notification public.notifications%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = 'P0001', message = 'unauthenticated'; end if;
  update public.notifications set read_at = coalesce(p_read_at, read_at), resolved_at = coalesce(p_resolved_at, resolved_at), updated_at = now()
    where id = p_notification_id and user_id = auth.uid() returning * into v_notification;
  if not found then raise exception using errcode = 'P0001', message = 'notification_not_found'; end if;
  return v_notification;
end;
$$;

create or replace function public.notification_set_status(p_notification_id uuid, p_read_at timestamptz, p_resolved_at timestamptz)
returns public.notifications language sql security invoker set search_path = '' as $$
  select * from private.notification_set_status(p_notification_id, p_read_at, p_resolved_at);
$$;

revoke all on function public.notification_upsert(uuid, text, text, text, text, text, jsonb, uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.notification_set_status(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function private.notification_upsert(uuid, text, text, text, text, text, jsonb, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function private.notification_set_status(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.notification_upsert(uuid, text, text, text, text, text, jsonb, uuid, timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function private.notification_set_status(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.notification_upsert(uuid, text, text, text, text, text, jsonb, uuid, timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function public.notification_set_status(uuid, timestamptz, timestamptz) to authenticated, service_role;

commit;
