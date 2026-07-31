-- Phase A lifecycle: permit `draft -> completed` directly (DEFECT_REGISTER D-03).
--
-- WRITTEN, NOT APPLIED. Per the 2026-07-30 standing decision, migrations are
-- applied by the owner from the Supabase dashboard.
--
-- ============================================================
-- WHY THIS TRANSITION HAS TO EXIST
-- ============================================================
-- `roundRepository.ensureRoundActivity` deliberately leaves a round's lifecycle
-- parent in `draft` when another activity is already current, so that starting a
-- round never bypasses the single-active invariant. That was the right call. What
-- was not intended is that `draft` then became terminal in practice:
--
--   * `finalizeRoundActivity` refused anything but `active`/`paused`,
--   * this RPC's transition CASE had no `draft` + `finalize_completed` arm, and
--   * `weeklyReportRepository` admits only `completed` activities.
--
-- So the round row read `status = 'completed'` and every screen showed a finished
-- round, while its activity parent sat in `draft` forever — permanently absent
-- from weekly reports, with no UI able to repair it. The player's work was
-- recorded and unreportable at the same time.
--
-- ============================================================
-- WHY NOT ROUTE IT THROUGH `active` INSTEAD
-- ============================================================
-- That is the obvious fix and it is actively harmful. `start` on a draft is the
-- command the replacement flow hangs off: further down this same function, a
-- draft being started takes any OTHER `active`/`paused` activity for that user
-- and sets it to `incomplete`. So "start the parent, then finalize it" would mean
-- tapping Finish on an old round silently closes whatever the player currently
-- has live, marking a session they are in the middle of as incomplete. That
-- trades a reporting defect for a data-integrity one.
--
-- `draft -> completed` cannot do that. `activities_one_current_per_user_idx` is
-- `unique (user_id) where state in ('active','paused')` — this transition never
-- enters either state, so there is nothing to replace and no invariant to bypass.
-- It is purely additive to the CASE: no existing arm changes, and every
-- transition that was legal before is still legal with the same outcome. The
-- replacement block guarded by `v_activity.state = 'draft' and p_command =
-- 'start'` is left exactly as it was — its condition already excludes this new
-- path, which is the whole safety argument.
--
-- `has_meaningful_fact` is set true on this path for the same reason `start` sets
-- it: both assert the activity really happened. Without it a draft would reach
-- `completed` still claiming nothing happened. It is only ever set true, never
-- cleared, matching the existing arm.
--
-- ============================================================
-- HOW THIS FILE WAS PRODUCED
-- ============================================================
-- The function body below is the CURRENT body from
-- `20260712195448_phase_a_activity_lifecycle_rpc.sql`, extracted verbatim and
-- amended in exactly two places (the new CASE arm, and the widened
-- `has_meaningful_fact` assignment). It was not retyped from memory: a wrong
-- version of this function would silently weaken the single-active invariant for
-- every activity type, which is far worse than the defect it fixes.
--
-- Before applying, diff it against the live definition — `pg_get_functiondef` is
-- authoritative if the database and the repo have diverged.
--
-- ROLLBACK: re-apply `20260712195448_phase_a_activity_lifecycle_rpc.sql`, which
-- restores the CASE without the new arm. Rows already moved `draft -> completed`
-- are not reverted and do not need to be — they are ordinary completed
-- activities, and they are the rounds this migration exists to make reportable.
-- No column, index, constraint or grant is altered here.

begin;

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
    when v_activity.state = 'draft' and p_command = 'finalize_completed' then
      v_next_state := 'completed';
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
        when p_command = 'finalize_completed' and v_activity.state = 'draft' then true
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

commit;

-- ============================================================
-- POST-APPLY VERIFICATION (run in a rollback-only transaction)
-- ============================================================
-- 1. THE POINT: a draft finalizes while another activity is live, and the live
--    one is untouched.
--      - seed user U with activity A (state 'active') and activity B ('draft')
--      - call activity_transition: B, 'finalize_completed', expected_state 'draft'
--      - expect B.state = 'completed' and B.has_meaningful_fact = true
--      - expect A.state STILL 'active' and A.version UNCHANGED
-- 2. Regression on the arm that must not have moved: `draft` + `start` with
--    another activity live still replaces it (or demands confirmation for a
--    round/league_match).
-- 3. An invalid transition still raises `invalid_transition` (e.g. 'completed'
--    + 'start').
-- 4. select count(*) from public.activities
--     where state = 'completed' and has_meaningful_fact = false;
--    should not grow after this lands.
