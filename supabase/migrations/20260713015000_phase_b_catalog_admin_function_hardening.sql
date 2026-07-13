--
-- Phase B B1.8 follow-on hardening.
--
-- The first live function definition used pg_catalog.nullif, but NULLIF is a
-- SQL special form rather than a pg_catalog function. Recreate the two public
-- RPCs from their deployed definitions with that qualification corrected.
-- Keeping this as a tiny corrective migration avoids duplicating the large,
-- static promotion body and does not accept any user-controlled SQL.

begin;

do $$
declare
  v_definition text;
begin
  select pg_catalog.replace(
    pg_catalog.pg_get_functiondef(
      'public.catalog_review_candidate(uuid,text,uuid,text,text)'::regprocedure
    ),
    'pg_catalog.nullif',
    'nullif'
  ) into v_definition;
  execute v_definition;

  select pg_catalog.replace(
    pg_catalog.pg_get_functiondef(
      'public.catalog_promote_import_batch(uuid,uuid,text)'::regprocedure
    ),
    'pg_catalog.nullif',
    'nullif'
  ) into v_definition;
  execute v_definition;
end;
$$;

commit;
