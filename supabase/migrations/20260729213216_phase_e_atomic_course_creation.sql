-- Phase E / E2 finding 3 — atomic quick-course creation.
--
-- ORDERING: this migration is independent of `20260729213112_phase_e_account_deletion.sql` and
-- `20260729213141_phase_e_preserve_moderation_history.sql`; it touches no object either of those
-- defines. It depends only on the `courses` / `layouts` / `holes` shapes established by
-- `disc_locker_and_layouts_schema.sql` + `migrate_disc_locker_and_layouts.sql` (holes hang off
-- `layout_id`, not `course_id`) and on the J1 RLS contract in
-- `20260714150000_phase_c_round_logging_rls.sql`.
--
-- Why: `createCourseWithLayout` (`src/lib/roundLog.js`) wrote a course, then its default layout,
-- then its holes as three sequential PostgREST upserts. Nothing tied them together. A failure after
-- the first left an orphan course with no layout; a failure after the second left a layout with no
-- holes. All three tables are shared community data — J1 grants every authenticated user
-- `select ... using (true)` — so a partial write is immediately visible to everyone browsing the
-- COURSES directory, and it is not repairable from the client: J1 defines no DELETE policy on
-- `courses`, `layouts` or `holes`, and UPDATE is bounded to the parent course's creator. Quick-course
-- creation is a field action taken standing on a course with one bar of signal, so the window
-- between the three writes is exactly the window most likely to be interrupted.
--
-- Compensating deletes are the obvious alternative and the wrong one: a compensating delete runs on
-- the same connection that just failed, for the same reason, and there is no DELETE policy for it to
-- run under anyway. One function body is one transaction in Postgres — an exception anywhere inside
-- it rolls back every row the call inserted — so a single RPC is the whole fix.
--
-- `security invoker`, deliberately, not `security definer`. This writes community-visible rows on
-- behalf of the caller, so the caller's RLS must still apply: the insert into `courses` is checked
-- against `Authenticated users can add courses with owner` (`auth.uid() = created_by`), and the
-- inserts into `layouts` / `holes` against their `auth.uid() is not null` checks. A definer function
-- would bypass all three and turn this into an unaudited write path into shared data. `auth.uid()` is
-- still read explicitly and used as `created_by` so the function cannot be told to attribute a course
-- to someone else — the caller supplies no owner argument.
--
-- Contract:
--   create_course_with_layout(
--     p_name        text            -- required, trimmed; the course name
--     p_location    text  = null    -- trimmed, empty becomes null
--     p_holes       jsonb = '[]'    -- array of hole objects, snake_case keys, must be non-empty
--     p_course_id   uuid  = null    -- optional client-supplied id, for idempotent replay
--     p_layout_id   uuid  = null    -- optional client-supplied id, for idempotent replay
--     p_layout_name text  = 'Main'  -- name of the default layout the course is created with
--   ) returns uuid                  -- the course id, whether created now or already present
--
-- Each element of `p_holes` may carry `id`, `hole_number`, `par`, `distance_feet`, `tee_type`,
-- `hazards`, `strategy_notes`. `hole_number` falls back to the element's 1-based position and `par`
-- to 3, matching what the client sent before. Unknown keys are ignored, so the client's shape can
-- grow without a signature change.
--
-- Idempotent replay: passing `p_course_id` makes the call safe to repeat. If that course already
-- exists the function returns its id and writes nothing, because atomicity means a course row can
-- only exist if its layout and holes landed with it. The ownership check on that path keeps a replay
-- from silently succeeding against somebody else's course. This is deliberately more than finding 3
-- needs — finding 4 (no offline path for course creation) will queue this call in the round outbox,
-- and an outbox entry that cannot be replayed safely is not queueable.
--
-- Validation is duplicated between here and the client on purpose. The client's checks fail before
-- any network call, which is what a user on one bar of signal needs; these are the checks that hold
-- when the caller is a replay, a second client, or a future import path.
--
-- Rollback:
--   drop function if exists public.create_course_with_layout(text, text, jsonb, uuid, uuid, text);
-- The migration creates no tables, columns, constraints, indexes or policies and rewrites no rows,
-- so dropping the function restores the database exactly. Courses created through it are ordinary
-- rows indistinguishable from ones the three-upsert client wrote. Roll the client back to a build
-- that does not call the RPC first, or in the gap it will report course creation as unavailable
-- (`PGRST202` / `42883`), which is the documented degradation and not data loss.

begin;

create or replace function public.create_course_with_layout(
  p_name text,
  p_location text default null,
  p_holes jsonb default '[]'::jsonb,
  p_course_id uuid default null,
  p_layout_id uuid default null,
  p_layout_name text default 'Main'
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  new_course_id uuid := coalesce(p_course_id, gen_random_uuid());
  new_layout_id uuid := coalesce(p_layout_id, gen_random_uuid());
  layout_label text := coalesce(nullif(btrim(p_layout_name), ''), 'Main');
  hole_input jsonb := coalesce(p_holes, '[]'::jsonb);
  existing_owner uuid;
begin
  if owner_id is null then
    raise exception 'You must be signed in to create a course' using errcode = '28000';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Course name is required' using errcode = '22023';
  end if;
  if jsonb_typeof(hole_input) <> 'array' then
    raise exception 'Course holes must be supplied as a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(hole_input) = 0 then
    raise exception 'A course needs at least one hole' using errcode = '22023';
  end if;

  -- Replay of a call that already landed. Atomicity is what makes this a safe
  -- early return: if the course row exists, so do its layout and its holes.
  select created_by into existing_owner from public.courses where id = new_course_id;
  if found then
    if existing_owner is distinct from owner_id then
      raise exception 'That course id already belongs to another contributor' using errcode = '42501';
    end if;
    return new_course_id;
  end if;

  -- `courses.layout_name` is the pre-layouts denormalised label. It is still
  -- read by legacy paths, so keep it agreeing with the default layout below
  -- rather than leaving it on its 'Main' column default.
  insert into public.courses (id, name, location, layout_name, created_by)
  values (new_course_id, btrim(p_name), nullif(btrim(p_location), ''), layout_label, owner_id);

  insert into public.layouts (id, course_id, name, is_default)
  values (new_layout_id, new_course_id, layout_label, true);

  insert into public.holes (
    id, layout_id, hole_number, par, distance_feet, tee_type, hazards, strategy_notes
  )
  select
    coalesce(nullif(hole.value ->> 'id', '')::uuid, gen_random_uuid()),
    new_layout_id,
    coalesce(nullif(hole.value ->> 'hole_number', '')::integer, hole.ordinal::integer),
    coalesce(nullif(hole.value ->> 'par', '')::integer, 3),
    nullif(hole.value ->> 'distance_feet', '')::integer,
    nullif(hole.value ->> 'tee_type', ''),
    nullif(hole.value ->> 'hazards', ''),
    nullif(hole.value ->> 'strategy_notes', '')
  from jsonb_array_elements(hole_input) with ordinality as hole(value, ordinal);

  return new_course_id;
end;
$$;

comment on function public.create_course_with_layout(text, text, jsonb, uuid, uuid, text) is
  'Creates a course, its default layout and all of its holes in one transaction, attributed to '
  'auth.uid(). security invoker, so the caller''s RLS on courses/layouts/holes still applies. '
  'Returns the course id; re-calling with the same p_course_id returns it without writing again. '
  'Replaces the three sequential client upserts that could leave an orphan course or an empty '
  'layout visible to every authenticated user (E2 audit finding 3).';

-- Least privilege: shared community data, so the function must be unreachable
-- from anon/public even though it derives its owner from the JWT. Restated
-- absolutely (not additively) so a replay against a rebuilt database lands the
-- same grants.
revoke all on function public.create_course_with_layout(text, text, jsonb, uuid, uuid, text) from public;
revoke all on function public.create_course_with_layout(text, text, jsonb, uuid, uuid, text) from anon;
grant execute on function public.create_course_with_layout(text, text, jsonb, uuid, uuid, text) to authenticated;

commit;
