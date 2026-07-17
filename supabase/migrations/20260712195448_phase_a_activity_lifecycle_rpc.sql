-- Phase A A6: server lifecycle RPCs and hardened execution boundary.
--
-- This migration depends on the A5 activity-envelope migration. It is
-- generated locally and remains unapplied until the fresh-backup gate is
-- confirmed. The public functions are SECURITY INVOKER wrappers; privileged
-- work lives in a non-exposed schema and still validates auth.uid(), owner,
-- transition, version, and idempotency invariants.

begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create or replace function private.activity_create_draft(
  p_activity_id uuid,
  p_type text,
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.activities%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if p_activity_id is null
     or p_type is null
     or p_type not in (
       'putting_freeform', 'putting_regimen', 'disc_golf_round',
       'putting_game', 'fieldwork', 'course_practice', 'league_match'
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_activity';
  end if;

  if p_occurred_at is null or p_recorded_at is null
     or p_source is null
     or p_source not in (
       'live_capture', 'batch_entry', 'manual_entry', 'manual_correction',
       'udisc_import', 'pdga_import', 'system_inference', 'sensor'
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_mutation';
  end if;

  if p_installation_id is null or pg_catalog.length(p_installation_id) = 0
     or p_idempotency_key is null or pg_catalog.length(p_idempotency_key) = 0
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = 'P0001', message = 'invalid_mutation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('activity-lifecycle:' || v_user_id::text, 0)
  );

  select *
    into v_activity
  from public.activities
  where id = p_activity_id
    and user_id = v_user_id
  for update;

  if found then
    if v_activity.type <> p_type then
      raise exception using errcode = 'P0001', message = 'activity_id_conflict';
    end if;

    if v_activity.create_idempotency_key = p_idempotency_key then
      return pg_catalog.jsonb_build_object(
        'outcome', 'idempotent',
        'activity', pg_catalog.to_jsonb(v_activity),
        'state_event', null,
        'replaced_activity', null,
        'sync_state', 'synced',
        'warnings', pg_catalog.jsonb_build_array()
      );
    end if;

    raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
  end if;

  if exists (
    select 1
    from public.activities a
    where a.create_idempotency_key = p_idempotency_key
       or a.last_lifecycle_idempotency_key = p_idempotency_key
  ) or exists (
    select 1
    from public.activity_state_events e
    where e.idempotency_key = p_idempotency_key
  ) then
    raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
  end if;

  insert into public.activities (
    id,
    user_id,
    type,
    state,
    version,
    has_meaningful_fact,
    needs_review,
    hidden_at,
    metadata,
    created_at,
    updated_at,
    create_idempotency_key
  ) values (
    p_activity_id,
    v_user_id,
    p_type,
    'draft',
    0,
    false,
    false,
    null,
    p_metadata,
    p_recorded_at,
    p_recorded_at,
    p_idempotency_key
  )
  returning * into v_activity;

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'activity', pg_catalog.to_jsonb(v_activity),
    'state_event', null,
    'replaced_activity', null,
    'sync_state', 'synced',
    'warnings', pg_catalog.jsonb_build_array()
  );
end;
$$;

create or replace function private.activity_transition(
  p_activity_id uuid,
  p_command text,
  p_expected_state text,
  p_expected_version bigint,
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_state_event_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_confirm_round_replacement boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.activities%rowtype;
  v_existing public.activities%rowtype;
  v_replaced_activity public.activities%rowtype;
  v_event public.activity_state_events%rowtype;
  v_replaced_event public.activity_state_events%rowtype;
  v_next_state text;
  v_replace_key text;
  v_event_id uuid;
  v_replaced_json jsonb := null;
  v_warnings jsonb := pg_catalog.jsonb_build_array();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if p_activity_id is null
     or p_command is null
     or p_command not in (
       'start', 'pause', 'resume', 'finalize_completed', 'mark_incomplete'
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_command';
  end if;

  if p_expected_state is null or p_expected_version is null
     or p_occurred_at is null or p_recorded_at is null
     or p_source is null
     or p_source not in (
       'live_capture', 'batch_entry', 'manual_entry', 'manual_correction',
       'udisc_import', 'pdga_import', 'system_inference', 'sensor'
     )
     or p_installation_id is null or pg_catalog.length(p_installation_id) = 0
     or p_idempotency_key is null or pg_catalog.length(p_idempotency_key) = 0
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = 'P0001', message = 'invalid_mutation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('activity-lifecycle:' || v_user_id::text, 0)
  );

  select *
    into v_event
  from public.activity_state_events
  where idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_event.user_id <> v_user_id or v_event.activity_id <> p_activity_id then
      raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
    end if;

    select *
      into v_activity
    from public.activities
    where id = p_activity_id
      and user_id = v_user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'activity_not_found';
    end if;

    return pg_catalog.jsonb_build_object(
      'outcome', 'idempotent',
      'activity', pg_catalog.to_jsonb(v_activity),
      'state_event', pg_catalog.to_jsonb(v_event),
      'replaced_activity', null,
      'sync_state', 'synced',
      'warnings', pg_catalog.jsonb_build_array()
    );
  end if;

  if exists (
    select 1
    from public.activities a
    where a.create_idempotency_key = p_idempotency_key
       or a.last_lifecycle_idempotency_key = p_idempotency_key
  ) then
    raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
  end if;

  select *
    into v_activity
  from public.activities
  where id = p_activity_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'activity_not_found';
  end if;

  if v_activity.state <> p_expected_state then
    raise exception using errcode = 'P0001', message = 'state_conflict';
  end if;

  if v_activity.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;

  case
    when v_activity.state = 'draft' and p_command = 'start' then
      v_next_state := 'active';
    when v_activity.state = 'active' and p_command = 'pause' then
      v_next_state := 'paused';
    when v_activity.state = 'active' and p_command = 'finalize_completed' then
      v_next_state := 'completed';
    when v_activity.state = 'active' and p_command = 'mark_incomplete' then
      v_next_state := 'incomplete';
    when v_activity.state = 'paused' and p_command = 'resume' then
      v_next_state := 'active';
    when v_activity.state = 'paused' and p_command = 'finalize_completed' then
      v_next_state := 'completed';
    when v_activity.state = 'paused' and p_command = 'mark_incomplete' then
      v_next_state := 'incomplete';
    when (v_activity.state = 'active' and p_command in ('start', 'resume'))
      or (v_activity.state = 'paused' and p_command = 'pause')
      or (v_activity.state = 'completed' and p_command = 'finalize_completed')
      or (v_activity.state = 'incomplete' and p_command = 'mark_incomplete') then
      return pg_catalog.jsonb_build_object(
        'outcome', 'idempotent',
        'activity', pg_catalog.to_jsonb(v_activity),
        'state_event', null,
        'replaced_activity', null,
        'sync_state', 'synced',
        'warnings', pg_catalog.jsonb_build_array()
      );
    else
      raise exception using errcode = 'P0001', message = 'invalid_transition';
  end case;

  if p_state_event_id is null then
    v_event_id := pg_catalog.gen_random_uuid();
  else
    v_event_id := p_state_event_id;
    if exists (select 1 from public.activity_state_events where id = v_event_id) then
      raise exception using errcode = 'P0001', message = 'state_event_id_conflict';
    end if;
  end if;

  if v_activity.state = 'draft' and p_command = 'start' then
    select *
      into v_existing
    from public.activities
    where user_id = v_user_id
      and id <> v_activity.id
      and state in ('active', 'paused')
    order by id
    limit 1
    for update;

    if found then
      if v_existing.type in ('disc_golf_round', 'league_match')
         and not p_confirm_round_replacement then
        raise exception using errcode = 'P0001', message = 'round_replacement_confirmation_required';
      end if;

      v_replace_key := p_idempotency_key || ':replace:' || v_existing.id::text;

      if exists (
        select 1
        from public.activities a
        where a.create_idempotency_key = v_replace_key
           or a.last_lifecycle_idempotency_key = v_replace_key
      ) or exists (
        select 1
        from public.activity_state_events e
        where e.idempotency_key = v_replace_key
      ) then
        raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
      end if;

      update public.activities
      set state = 'incomplete',
          version = version + 1,
          updated_at = p_recorded_at,
          last_lifecycle_idempotency_key = v_replace_key
      where id = v_existing.id
        and user_id = v_user_id
      returning * into v_replaced_activity;

      insert into public.activity_state_events (
        id,
        activity_id,
        user_id,
        previous_state,
        new_state,
        reason,
        occurred_at,
        recorded_at,
        source,
        installation_id,
        metadata,
        idempotency_key
      ) values (
        pg_catalog.gen_random_uuid(),
        v_replaced_activity.id,
        v_user_id,
        v_existing.state,
        'incomplete',
        case
          when v_existing.type in ('disc_golf_round', 'league_match')
            then 'round_replacement_confirmed'
          else 'replaced_by_activity'
        end,
        p_occurred_at,
        p_recorded_at,
        p_source,
        p_installation_id,
        p_metadata || pg_catalog.jsonb_build_object(
          'replacementActivityId', v_activity.id
        ),
        v_replace_key
      )
      returning * into v_replaced_event;

      v_replaced_json := pg_catalog.to_jsonb(v_replaced_activity);
      v_warnings := pg_catalog.jsonb_build_array('previous_activity_marked_incomplete');
    end if;
  end if;

  update public.activities
  set state = v_next_state,
      version = version + 1,
      updated_at = p_recorded_at,
      has_meaningful_fact = case
        when p_command = 'start' then true
        else has_meaningful_fact
      end,
      last_lifecycle_idempotency_key = p_idempotency_key
  where id = v_activity.id
    and user_id = v_user_id
  returning * into v_activity;

  insert into public.activity_state_events (
    id,
    activity_id,
    user_id,
    previous_state,
    new_state,
    reason,
    occurred_at,
    recorded_at,
    source,
    installation_id,
    metadata,
    idempotency_key
  ) values (
    v_event_id,
    v_activity.id,
    v_user_id,
    p_expected_state,
    v_next_state,
    p_reason,
    p_occurred_at,
    p_recorded_at,
    p_source,
    p_installation_id,
    p_metadata,
    p_idempotency_key
  )
  returning * into v_event;

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'activity', pg_catalog.to_jsonb(v_activity),
    'state_event', pg_catalog.to_jsonb(v_event),
    'replaced_activity', v_replaced_json,
    'sync_state', 'synced',
    'warnings', v_warnings
  );
end;
$$;

-- PostgREST-facing wrappers stay invoker functions. The private functions
-- perform their own auth.uid() check and are not in an exposed schema.
create or replace function public.activity_create_draft(
  p_activity_id uuid,
  p_type text,
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activity_create_draft(
    p_activity_id,
    p_type,
    p_occurred_at,
    p_recorded_at,
    p_source,
    p_installation_id,
    p_idempotency_key,
    p_metadata
  );
$$;

create or replace function public.activity_transition(
  p_activity_id uuid,
  p_command text,
  p_expected_state text,
  p_expected_version bigint,
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_state_event_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_confirm_round_replacement boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activity_transition(
    p_activity_id,
    p_command,
    p_expected_state,
    p_expected_version,
    p_occurred_at,
    p_recorded_at,
    p_source,
    p_installation_id,
    p_idempotency_key,
    p_state_event_id,
    p_reason,
    p_metadata,
    p_confirm_round_replacement
  );
$$;

revoke all on function private.activity_create_draft(
  uuid, text, timestamptz, timestamptz, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function private.activity_create_draft(
  uuid, text, timestamptz, timestamptz, text, text, text, jsonb
) to authenticated, service_role;

revoke all on function private.activity_transition(
  uuid, text, text, bigint, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function private.activity_transition(
  uuid, text, text, bigint, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb, boolean
) to authenticated, service_role;

revoke all on function public.activity_create_draft(
  uuid, text, timestamptz, timestamptz, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.activity_create_draft(
  uuid, text, timestamptz, timestamptz, text, text, text, jsonb
) to authenticated, service_role;

revoke all on function public.activity_transition(
  uuid, text, text, bigint, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.activity_transition(
  uuid, text, text, bigint, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb, boolean
) to authenticated, service_role;

commit;
