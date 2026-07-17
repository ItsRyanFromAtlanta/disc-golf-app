-- Phase B item 5: immutable physical-disc odometers and permanent cosmetic-tier unlocks.
--
-- IDEAL COLUMN FORMAT
-- - offline identities: client-generated uuid primary keys and owner-scoped idempotency keys;
-- - immutable telemetry: constrained metric/source text, signed non-zero integer delta,
--   occurred_at + recorded_at timestamptz, optional source reference and object-shaped metadata;
-- - cached counters: non-negative integer totals on discs, changed only by the atomic RPC/helper;
-- - permanent unlocks: one immutable row per disc/tier with fixed threshold and triggering event FK.

begin;

alter table public.discs
  add column total_throws integer not null default 0 check (total_throws >= 0),
  add column total_airballs integer not null default 0 check (total_airballs >= 0);

create table public.disc_odometer_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id) on delete cascade,
  metric text not null check (metric in ('throws', 'chain_hits', 'airballs')),
  delta integer not null check (delta between -10000 and 10000 and delta <> 0),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in (
    'live_capture', 'round_capture', 'manual_entry', 'manual_correction',
    'udisc_import', 'pdga_import', 'system_backfill', 'admin_repair'
  )),
  source_ref text check (source_ref is null or length(btrim(source_ref)) between 1 and 500),
  installation_id text check (installation_id is null or length(btrim(installation_id)) between 1 and 200),
  reason text check (reason is null or length(btrim(reason)) between 1 and 1000),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (user_id, idempotency_key),
  check (delta > 0 or source in ('manual_correction', 'admin_repair')),
  check (delta > 0 or reason is not null),
  check (source <> 'admin_repair' or reason is not null)
);

create index disc_odometer_events_disc_occurred_idx
  on public.disc_odometer_events (disc_id, occurred_at desc, recorded_at desc, id);
create index disc_odometer_events_user_recorded_idx
  on public.disc_odometer_events (user_id, recorded_at desc, id);

create table public.disc_cosmetic_unlocks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  disc_id uuid not null references public.discs(id) on delete cascade,
  tier text not null check (tier in ('rare', 'epic', 'legendary')),
  threshold integer not null,
  unlocked_at timestamptz not null,
  triggering_event_id uuid references public.disc_odometer_events(id),
  source text not null check (source in ('odometer', 'system_backfill', 'admin_repair')),
  created_at timestamptz not null default now(),
  unique (disc_id, tier),
  check (
    (tier = 'rare' and threshold = 300)
    or (tier = 'epic' and threshold = 1000)
    or (tier = 'legendary' and threshold = 5000)
  )
);

create index disc_cosmetic_unlocks_user_unlocked_idx
  on public.disc_cosmetic_unlocks (user_id, unlocked_at desc, id);
create index disc_cosmetic_unlocks_event_idx
  on public.disc_cosmetic_unlocks (triggering_event_id) where triggering_event_id is not null;

alter table public.disc_odometer_events enable row level security;
alter table public.disc_cosmetic_unlocks enable row level security;

create policy disc_odometer_events_select_own on public.disc_odometer_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy disc_cosmetic_unlocks_select_own on public.disc_cosmetic_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function private.prevent_disc_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Disc odometer and cosmetic ledgers are immutable';
end;
$$;

create trigger disc_odometer_events_immutable
before update or delete on public.disc_odometer_events
for each row execute function private.prevent_disc_ledger_mutation();

create trigger disc_cosmetic_unlocks_immutable
before update or delete on public.disc_cosmetic_unlocks
for each row execute function private.prevent_disc_ledger_mutation();

create or replace function private.guard_disc_odometer_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.total_throws <> 0 or new.total_chain_hits <> 0 or new.total_airballs <> 0 then
      raise exception 'Disc odometer totals must be created at zero';
    end if;
  elsif (
    old.total_throws is distinct from new.total_throws
    or old.total_chain_hits is distinct from new.total_chain_hits
    or old.total_airballs is distinct from new.total_airballs
  ) and coalesce(current_setting('app.disc_odometer_write', true), '') <> '1' then
    raise exception 'Disc odometer totals may only change through record_disc_odometer_event';
  end if;
  return new;
end;
$$;

create trigger discs_guard_odometer_totals_insert
before insert on public.discs
for each row execute function private.guard_disc_odometer_totals();

create trigger discs_guard_odometer_totals_update
before update of total_throws, total_chain_hits, total_airballs on public.discs
for each row execute function private.guard_disc_odometer_totals();

-- Preserve the already-shipped total_chain_hits values without changing them.
insert into public.disc_odometer_events (
  id, user_id, disc_id, metric, delta, occurred_at, source, source_ref, idempotency_key
)
select gen_random_uuid(), d.user_id, d.id, 'chain_hits', d.total_chain_hits,
  coalesce(d.created_at, now()), 'system_backfill', 'pre-ledger total_chain_hits',
  'disc-odometer:backfill:chain_hits:' || d.id::text
from public.discs d
where d.total_chain_hits > 0;

insert into public.disc_cosmetic_unlocks (
  id, user_id, disc_id, tier, threshold, unlocked_at, triggering_event_id, source
)
select gen_random_uuid(), e.user_id, e.disc_id, milestone.tier, milestone.threshold,
  e.occurred_at, e.id, 'system_backfill'
from public.disc_odometer_events e
cross join (values ('rare', 300), ('epic', 1000), ('legendary', 5000)) as milestone(tier, threshold)
where e.source = 'system_backfill'
  and e.metric = 'chain_hits'
  and e.delta >= milestone.threshold
on conflict (disc_id, tier) do nothing;

create or replace function private.record_disc_odometer_event(
  p_event_id uuid,
  p_disc_id uuid,
  p_metric text,
  p_delta integer,
  p_occurred_at timestamptz,
  p_source text,
  p_source_ref text,
  p_installation_id text,
  p_reason text,
  p_idempotency_key text,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  disc_row public.discs%rowtype;
  existing_event public.disc_odometer_events%rowtype;
  next_total integer;
  result_unlocks jsonb;
  allow_cosmetics boolean;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_event_id is null or p_occurred_at is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'Event, occurrence time, and idempotency key are required';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object';
  end if;

  select * into existing_event
    from public.disc_odometer_events
    where user_id = owner_id and idempotency_key = p_idempotency_key;
  if found then
    select coalesce(jsonb_agg(to_jsonb(u) order by u.threshold), '[]'::jsonb)
      into result_unlocks from public.disc_cosmetic_unlocks u where u.disc_id = existing_event.disc_id;
    select * into disc_row from public.discs where id = existing_event.disc_id and user_id = owner_id;
    return jsonb_build_object('event', to_jsonb(existing_event), 'disc', to_jsonb(disc_row), 'unlocks', result_unlocks);
  end if;

  select * into disc_row from public.discs where id = p_disc_id and user_id = owner_id for update;
  if not found then raise exception 'Disc not found'; end if;

  next_total := case p_metric
    when 'throws' then disc_row.total_throws + p_delta
    when 'chain_hits' then disc_row.total_chain_hits + p_delta
    when 'airballs' then disc_row.total_airballs + p_delta
    else null
  end;
  if next_total is null then raise exception 'Invalid odometer metric'; end if;
  if next_total < 0 then raise exception 'Odometer total cannot be negative'; end if;

  insert into public.disc_odometer_events (
    id, user_id, disc_id, metric, delta, occurred_at, source, source_ref,
    installation_id, reason, idempotency_key, metadata
  ) values (
    p_event_id, owner_id, p_disc_id, p_metric, p_delta, p_occurred_at, p_source,
    nullif(btrim(p_source_ref), ''), nullif(btrim(p_installation_id), ''),
    nullif(btrim(p_reason), ''), p_idempotency_key, p_metadata
  ) returning * into existing_event;

  perform set_config('app.disc_odometer_write', '1', true);
  update public.discs set
    total_throws = case when p_metric = 'throws' then next_total else total_throws end,
    total_chain_hits = case when p_metric = 'chain_hits' then next_total else total_chain_hits end,
    total_airballs = case when p_metric = 'airballs' then next_total else total_airballs end
  where id = p_disc_id and user_id = owner_id
  returning * into disc_row;

  allow_cosmetics := p_metric = 'chain_hits'
    and p_delta > 0
    and (p_source not in ('udisc_import', 'pdga_import') or p_occurred_at::date >= current_date - 7);
  if allow_cosmetics then
    insert into public.disc_cosmetic_unlocks (
      id, user_id, disc_id, tier, threshold, unlocked_at, triggering_event_id, source
    )
    select gen_random_uuid(), owner_id, p_disc_id, milestone.tier, milestone.threshold,
      p_occurred_at, p_event_id, 'odometer'
    from (values ('rare', 300), ('epic', 1000), ('legendary', 5000)) as milestone(tier, threshold)
    where next_total >= milestone.threshold
    on conflict (disc_id, tier) do nothing;
  end if;

  select coalesce(jsonb_agg(to_jsonb(u) order by u.threshold), '[]'::jsonb)
    into result_unlocks from public.disc_cosmetic_unlocks u where u.disc_id = p_disc_id;
  return jsonb_build_object('event', to_jsonb(existing_event), 'disc', to_jsonb(disc_row), 'unlocks', result_unlocks);
end;
$$;

create or replace function public.record_disc_odometer_event(
  p_event_id uuid,
  p_disc_id uuid,
  p_metric text,
  p_delta integer,
  p_occurred_at timestamptz,
  p_source text default 'manual_entry',
  p_source_ref text default null,
  p_installation_id text default null,
  p_reason text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_disc_odometer_event(
    p_event_id, p_disc_id, p_metric, p_delta, p_occurred_at, p_source,
    p_source_ref, p_installation_id, p_reason, p_idempotency_key, p_metadata
  );
$$;

revoke all on table public.disc_odometer_events, public.disc_cosmetic_unlocks from public, anon, authenticated;
grant select on table public.disc_odometer_events, public.disc_cosmetic_unlocks to authenticated;
grant all on table public.disc_odometer_events, public.disc_cosmetic_unlocks to service_role;

revoke all on function private.prevent_disc_ledger_mutation() from public, anon, authenticated;
revoke all on function private.guard_disc_odometer_totals() from public, anon, authenticated;
revoke all on function private.record_disc_odometer_event(uuid, uuid, text, integer, timestamptz, text, text, text, text, text, jsonb) from public, anon;
grant execute on function private.record_disc_odometer_event(uuid, uuid, text, integer, timestamptz, text, text, text, text, text, jsonb) to authenticated;

revoke all on function public.record_disc_odometer_event(uuid, uuid, text, integer, timestamptz, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.record_disc_odometer_event(uuid, uuid, text, integer, timestamptz, text, text, text, text, text, jsonb) to authenticated;

commit;
