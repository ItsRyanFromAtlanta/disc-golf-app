-- Phase A A8: authenticated history/recovery mutations and correction audit.
--
-- Existing `activities.hidden_at`, `activities.version`, and `audit_events`
-- columns are sufficient; this migration adds no tables or columns. Public
-- PostgREST wrappers remain SECURITY INVOKER. Privileged implementations live
-- in the non-exposed `private` schema, use an empty search_path, derive owner
-- identity from auth.uid(), lock per user, validate optimistic versions, and
-- write the envelope/domain row plus append-only audit event atomically.
-- Existing broad typed-table update grants remain temporarily because the
-- staged InstantLaunch parent writer still needs them; A8 routes user-facing
-- finalized metadata edits through this RPC, and A10 owns final grant
-- tightening after offline write-path equivalence is proven.

begin;

create or replace function private.activity_set_visibility(
  p_activity_id uuid,
  p_expected_version bigint,
  p_hidden boolean,
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_audit_event_id uuid default null,
  p_reason text default null,
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
  v_audit public.audit_events%rowtype;
  v_event_id uuid;
  v_action text;
  v_previous_values jsonb;
  v_new_values jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if p_activity_id is null or p_expected_version is null or p_expected_version < 0
     or p_hidden is null or p_occurred_at is null or p_recorded_at is null
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

  v_action := case when p_hidden then 'hide' else 'restore' end;
  v_new_values := pg_catalog.jsonb_build_object(
    'hidden_at', case when p_hidden then pg_catalog.to_jsonb(p_recorded_at) else 'null'::jsonb end
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('activity-history:' || v_user_id::text, 0)
  );

  select *
    into v_audit
  from public.audit_events
  where idempotency_key = p_idempotency_key;

  if found then
    if v_audit.user_id <> v_user_id
       or v_audit.entity_type <> 'activity'
       or v_audit.entity_id <> p_activity_id
       or v_audit.action <> v_action
       or v_audit.new_values <> v_new_values then
      raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
    end if;

    select *
      into v_activity
    from public.activities
    where id = p_activity_id and user_id = v_user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'activity_not_found';
    end if;

    return pg_catalog.jsonb_build_object(
      'outcome', 'idempotent',
      'activity', pg_catalog.to_jsonb(v_activity),
      'audit_event', pg_catalog.to_jsonb(v_audit),
      'sync_state', 'synced',
      'warnings', pg_catalog.jsonb_build_array()
    );
  end if;

  select *
    into v_activity
  from public.activities
  where id = p_activity_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'activity_not_found';
  end if;

  if v_activity.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;

  if v_activity.state not in ('completed', 'incomplete') then
    raise exception using errcode = 'P0001', message = 'invalid_activity_state';
  end if;

  if (p_hidden and v_activity.hidden_at is not null)
     or (not p_hidden and v_activity.hidden_at is null) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'idempotent',
      'activity', pg_catalog.to_jsonb(v_activity),
      'audit_event', null,
      'sync_state', 'synced',
      'warnings', pg_catalog.jsonb_build_array()
    );
  end if;

  v_previous_values := pg_catalog.jsonb_build_object(
    'hidden_at', case
      when v_activity.hidden_at is null then 'null'::jsonb
      else pg_catalog.to_jsonb(v_activity.hidden_at)
    end
  );

  update public.activities
  set hidden_at = case when p_hidden then p_recorded_at else null end,
      version = version + 1,
      updated_at = p_recorded_at
  where id = v_activity.id and user_id = v_user_id
  returning * into v_activity;

  v_event_id := coalesce(p_audit_event_id, pg_catalog.gen_random_uuid());
  if exists (select 1 from public.audit_events where id = v_event_id) then
    raise exception using errcode = 'P0001', message = 'audit_event_id_conflict';
  end if;

  insert into public.audit_events (
    id, user_id, entity_type, entity_id, action,
    occurred_at, recorded_at, source, installation_id,
    previous_values, new_values, reason, schema_version,
    idempotency_key, metadata
  ) values (
    v_event_id, v_user_id, 'activity', v_activity.id, v_action,
    p_occurred_at, p_recorded_at, p_source, p_installation_id,
    v_previous_values, v_new_values, p_reason, 1,
    p_idempotency_key, p_metadata
  )
  returning * into v_audit;

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'activity', pg_catalog.to_jsonb(v_activity),
    'audit_event', pg_catalog.to_jsonb(v_audit),
    'sync_state', 'synced',
    'warnings', pg_catalog.jsonb_build_array()
  );
end;
$$;

create or replace function private.activity_correct_practice_details(
  p_activity_id uuid,
  p_expected_version bigint,
  p_notes text,
  p_tags text[],
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_audit_event_id uuid default null,
  p_reason text default null,
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
  v_audit public.audit_events%rowtype;
  v_event_id uuid;
  v_previous_notes text;
  v_previous_tags text[];
  v_previous_values jsonb;
  v_new_values jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if p_activity_id is null or p_expected_version is null or p_expected_version < 0
     or p_tags is null or p_occurred_at is null or p_recorded_at is null
     or p_source is null or p_source <> 'manual_correction'
     or p_installation_id is null or pg_catalog.length(p_installation_id) = 0
     or p_idempotency_key is null or pg_catalog.length(p_idempotency_key) = 0
     or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     or exists (
       select 1 from pg_catalog.unnest(p_tags) as tag
       where tag is null or pg_catalog.length(tag) = 0
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_mutation';
  end if;

  v_new_values := pg_catalog.jsonb_build_object(
    'notes', pg_catalog.to_jsonb(p_notes),
    'tags', pg_catalog.to_jsonb(p_tags)
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('activity-history:' || v_user_id::text, 0)
  );

  select *
    into v_audit
  from public.audit_events
  where idempotency_key = p_idempotency_key;

  if found then
    if v_audit.user_id <> v_user_id
       or v_audit.entity_type <> 'activity'
       or v_audit.entity_id <> p_activity_id
       or v_audit.action <> 'correct_practice_details'
       or v_audit.new_values <> v_new_values then
      raise exception using errcode = 'P0001', message = 'idempotency_key_conflict';
    end if;

    select *
      into v_activity
    from public.activities
    where id = p_activity_id and user_id = v_user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'activity_not_found';
    end if;

    return pg_catalog.jsonb_build_object(
      'outcome', 'idempotent',
      'activity', pg_catalog.to_jsonb(v_activity),
      'audit_event', pg_catalog.to_jsonb(v_audit),
      'sync_state', 'synced',
      'warnings', pg_catalog.jsonb_build_array()
    );
  end if;

  select *
    into v_activity
  from public.activities
  where id = p_activity_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'activity_not_found';
  end if;

  if v_activity.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;

  if v_activity.type not in ('putting_freeform', 'putting_regimen')
     or v_activity.state not in ('completed', 'incomplete')
     or v_activity.hidden_at is not null then
    raise exception using errcode = 'P0001', message = 'invalid_activity_state';
  end if;

  if v_activity.type = 'putting_freeform' then
    select notes, tags
      into v_previous_notes, v_previous_tags
    from public.putt_sessions
    where id = v_activity.id and user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'practice_record_not_found';
    end if;

    if v_previous_notes is not distinct from p_notes
       and v_previous_tags is not distinct from p_tags then
      return pg_catalog.jsonb_build_object(
        'outcome', 'idempotent',
        'activity', pg_catalog.to_jsonb(v_activity),
        'audit_event', null,
        'sync_state', 'synced',
        'warnings', pg_catalog.jsonb_build_array()
      );
    end if;

    update public.putt_sessions
    set notes = p_notes, tags = p_tags
    where id = v_activity.id and user_id = v_user_id;
  else
    select notes, tags
      into v_previous_notes, v_previous_tags
    from public.putting_regimen_runs
    where id = v_activity.id and user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'practice_record_not_found';
    end if;

    if v_previous_notes is not distinct from p_notes
       and v_previous_tags is not distinct from p_tags then
      return pg_catalog.jsonb_build_object(
        'outcome', 'idempotent',
        'activity', pg_catalog.to_jsonb(v_activity),
        'audit_event', null,
        'sync_state', 'synced',
        'warnings', pg_catalog.jsonb_build_array()
      );
    end if;

    update public.putting_regimen_runs
    set notes = p_notes, tags = p_tags
    where id = v_activity.id and user_id = v_user_id;
  end if;

  v_previous_values := pg_catalog.jsonb_build_object(
    'notes', pg_catalog.to_jsonb(v_previous_notes),
    'tags', pg_catalog.to_jsonb(v_previous_tags)
  );

  update public.activities
  set version = version + 1,
      updated_at = p_recorded_at
  where id = v_activity.id and user_id = v_user_id
  returning * into v_activity;

  v_event_id := coalesce(p_audit_event_id, pg_catalog.gen_random_uuid());
  if exists (select 1 from public.audit_events where id = v_event_id) then
    raise exception using errcode = 'P0001', message = 'audit_event_id_conflict';
  end if;

  insert into public.audit_events (
    id, user_id, entity_type, entity_id, action,
    occurred_at, recorded_at, source, installation_id,
    previous_values, new_values, reason, schema_version,
    idempotency_key, metadata
  ) values (
    v_event_id, v_user_id, 'activity', v_activity.id, 'correct_practice_details',
    p_occurred_at, p_recorded_at, p_source, p_installation_id,
    v_previous_values, v_new_values, p_reason, 1,
    p_idempotency_key, p_metadata
  )
  returning * into v_audit;

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'activity', pg_catalog.to_jsonb(v_activity),
    'audit_event', pg_catalog.to_jsonb(v_audit),
    'sync_state', 'synced',
    'warnings', pg_catalog.jsonb_build_array()
  );
end;
$$;

create or replace function public.activity_set_visibility(
  p_activity_id uuid,
  p_expected_version bigint,
  p_hidden boolean,
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_audit_event_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activity_set_visibility(
    p_activity_id, p_expected_version, p_hidden,
    p_occurred_at, p_recorded_at, p_source,
    p_installation_id, p_idempotency_key, p_audit_event_id,
    p_reason, p_metadata
  );
$$;

create or replace function public.activity_correct_practice_details(
  p_activity_id uuid,
  p_expected_version bigint,
  p_notes text,
  p_tags text[],
  p_occurred_at timestamptz,
  p_recorded_at timestamptz,
  p_source text,
  p_installation_id text,
  p_idempotency_key text,
  p_audit_event_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activity_correct_practice_details(
    p_activity_id, p_expected_version, p_notes, p_tags,
    p_occurred_at, p_recorded_at, p_source,
    p_installation_id, p_idempotency_key, p_audit_event_id,
    p_reason, p_metadata
  );
$$;

revoke all on function private.activity_set_visibility(
  uuid, bigint, boolean, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function private.activity_set_visibility(
  uuid, bigint, boolean, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) to authenticated, service_role;

revoke all on function private.activity_correct_practice_details(
  uuid, bigint, text, text[], timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function private.activity_correct_practice_details(
  uuid, bigint, text, text[], timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) to authenticated, service_role;

revoke all on function public.activity_set_visibility(
  uuid, bigint, boolean, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.activity_set_visibility(
  uuid, bigint, boolean, timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) to authenticated, service_role;

revoke all on function public.activity_correct_practice_details(
  uuid, bigint, text, text[], timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.activity_correct_practice_details(
  uuid, bigint, text, text[], timestamptz, timestamptz, text, text, text,
  uuid, text, jsonb
) to authenticated, service_role;

commit;
