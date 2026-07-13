--
-- Phase B B1.8: server-only catalog review and canonical promotion.
--
-- Ideal format:
--   * catalog_entity_sources links each promoted candidate to exactly one
--     canonical target and retains the reviewing/promotion principal.
--   * review decisions are appended to the existing review history and the
--     current candidate state is advanced in the same transaction.
--   * promotion is batch-locked, dependency-ordered, idempotent for exact
--     identities, and aborts the whole transaction on a canonical conflict.
--   * only service_role can execute the public RPC wrappers; the Edge Function
--     authenticates a user and the database checks the private admin allowlist.
--
-- The promotion allowlist intentionally excludes image fields, destructive
-- catalog status changes, source/entity_source staging rows, and client-supplied
-- canonical IDs. Existing canonical values are never overwritten: an incoming
-- non-null value may fill a null, equal an existing value, or abort on conflict.

begin;

alter table public.catalog_entity_sources
  add column manufacturer_alias_id uuid
    references public.manufacturer_aliases(id) on delete restrict,
  add column import_candidate_id uuid
    references public.catalog_import_candidates(id) on delete restrict,
  add column promoted_by_user_id uuid
    references auth.users(id) on delete restrict,
  add column promoted_by_principal text;

alter table public.catalog_entity_sources
  drop constraint if exists catalog_entity_sources_check;

alter table public.catalog_entity_sources
  add constraint catalog_entity_sources_target_check
    check (num_nonnulls(
      manufacturer_id, manufacturer_alias_id, mold_id, plastic_id,
      mold_plastic_id, run_id, stamp_id
    ) = 1),
  add constraint catalog_entity_sources_promotion_actor_check
    check ((promoted_by_user_id is null and promoted_by_principal is null)
      or (promoted_by_user_id is not null
        and promoted_by_principal is not null
        and length(btrim(promoted_by_principal)) between 1 and 256));

create index catalog_entity_sources_manufacturer_alias_id_idx
  on public.catalog_entity_sources (manufacturer_alias_id)
  where manufacturer_alias_id is not null;
create unique index catalog_entity_sources_import_candidate_uniq
  on public.catalog_entity_sources (import_candidate_id)
  where import_candidate_id is not null;
create index catalog_entity_sources_promoted_by_user_id_idx
  on public.catalog_entity_sources (promoted_by_user_id)
  where promoted_by_user_id is not null;

-- Candidate fields are checked against a fixed, entity-specific allowlist.
-- The helper deliberately does not construct SQL from candidate field names.
create or replace function private.catalog_assert_candidate_fields(
  p_entity_type text,
  p_supported_fields text[],
  p_fields jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed text[];
  v_field text;
  v_key text;
begin
  v_allowed := case p_entity_type
    when 'manufacturer' then array['name', 'official_url', 'adapter_key']::text[]
    when 'manufacturer_alias' then array['alias']::text[]
    when 'mold' then array[
      'mold_name', 'speed', 'glide', 'turn', 'fade', 'category',
      'pdga_approved_date', 'production_status', 'diameter_cm', 'rim_width_cm'
    ]::text[]
    when 'plastic' then array['name', 'description', 'firmness', 'durability']::text[]
    when 'mold_plastic' then array[
      'availability_status', 'speed_adjustment', 'glide_adjustment',
      'turn_adjustment', 'fade_adjustment'
    ]::text[]
    when 'run' then array[
      'run_name', 'production_year', 'batch_code', 'tooling', 'facility'
    ]::text[]
    when 'stamp' then array[
      'stamp_name', 'artwork_reference_url', 'run_name', 'production_year', 'batch_code'
    ]::text[]
    else null
  end;

  if v_allowed is null then
    raise exception using errcode = 'P0001', message = 'catalog_unsupported_candidate_type';
  end if;
  if p_supported_fields is null or p_fields is null then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_fields_invalid';
  end if;

  foreach v_field in array p_supported_fields loop
    if v_field is null or not coalesce(v_field = any(v_allowed), false) then
      raise exception using errcode = 'P0001', message = 'catalog_candidate_field_not_allowlisted';
    end if;
  end loop;

  for v_key in select k from pg_catalog.jsonb_object_keys(p_fields) k loop
    if not coalesce(v_key = any(p_supported_fields), false) then
      raise exception using errcode = 'P0001', message = 'catalog_candidate_fields_mismatch';
    end if;
  end loop;
  foreach v_field in array p_supported_fields loop
    if not (p_fields ? v_field) then
      raise exception using errcode = 'P0001', message = 'catalog_candidate_fields_mismatch';
    end if;
  end loop;
end;
$$;

create or replace function private.catalog_identity_value(
  p_identity jsonb,
  p_key text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(pg_catalog.btrim(p_identity ->> p_key), '')
$$;

create or replace function private.catalog_required_text(
  p_fields jsonb,
  p_key text,
  p_entity_type text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := nullif(pg_catalog.btrim(p_fields ->> p_key), '');
  if v_value is null then
    raise exception using errcode = 'P0001', message = 'catalog_required_candidate_field';
  end if;
  return v_value;
end;
$$;

create or replace function private.catalog_optional_text(
  p_fields jsonb,
  p_key text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(pg_catalog.btrim(p_fields ->> p_key), '')
$$;

create or replace function private.catalog_optional_numeric(
  p_fields jsonb,
  p_key text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := private.catalog_optional_text(p_fields, p_key);
  if v_value is null then return null; end if;
  begin
    return v_value::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_numeric_invalid';
  end;
end;
$$;

create or replace function private.catalog_optional_smallint(
  p_fields jsonb,
  p_key text
)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value numeric;
begin
  v_value := private.catalog_optional_numeric(p_fields, p_key);
  if v_value is null then return null; end if;
  if pg_catalog.trunc(v_value) <> v_value then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_year_invalid';
  end if;
  begin
    return v_value::smallint;
  exception when numeric_value_out_of_range then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_year_invalid';
  end;
end;
$$;

create or replace function private.catalog_optional_date(
  p_fields jsonb,
  p_key text
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := private.catalog_optional_text(p_fields, p_key);
  if v_value is null then return null; end if;
  begin
    return v_value::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_date_invalid';
  end;
end;
$$;

create or replace function private.catalog_merge_text(
  p_entity_type text,
  p_field text,
  p_existing text,
  p_incoming text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_incoming is null then return p_existing; end if;
  if p_existing is null then return p_incoming; end if;
  if pg_catalog.btrim(p_existing) = pg_catalog.btrim(p_incoming) then return p_existing; end if;
  raise exception using errcode = 'P0001', message = 'catalog_canonical_conflict';
end;
$$;

create or replace function private.catalog_merge_numeric(
  p_entity_type text,
  p_field text,
  p_existing numeric,
  p_incoming numeric
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_incoming is null then return p_existing; end if;
  if p_existing is null or p_existing = p_incoming then return coalesce(p_existing, p_incoming); end if;
  raise exception using errcode = 'P0001', message = 'catalog_canonical_conflict';
end;
$$;

create or replace function private.catalog_merge_date(
  p_entity_type text,
  p_field text,
  p_existing date,
  p_incoming date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_incoming is null then return p_existing; end if;
  if p_existing is null or p_existing = p_incoming then return coalesce(p_existing, p_incoming); end if;
  raise exception using errcode = 'P0001', message = 'catalog_canonical_conflict';
end;
$$;

create or replace function public.catalog_review_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_reviewer_user_id uuid,
  p_reviewer_principal text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate public.catalog_import_candidates%rowtype;
  v_batch public.catalog_import_batches%rowtype;
  v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_principal text := pg_catalog.nullif(pg_catalog.btrim(p_reviewer_principal), '');
  v_reason text := pg_catalog.nullif(pg_catalog.btrim(p_reason), '');
  v_pending_count integer;
begin
  if v_decision not in ('approved', 'rejected', 'needs_changes') then
    raise exception using errcode = 'P0001', message = 'catalog_review_decision_invalid';
  end if;
  if p_reviewer_user_id is null or v_principal is null
     or length(v_principal) > 256 or v_reason is null or length(v_reason) > 4096 then
    raise exception using errcode = 'P0001', message = 'catalog_review_request_invalid';
  end if;
  if not exists (
    select 1 from private.catalog_ingestion_admins a
    where a.user_id = p_reviewer_user_id
      and a.revoked_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'catalog_admin_required';
  end if;

  select b.* into v_batch
  from public.catalog_import_batches b
  where b.id = (
    select c.import_batch_id
    from public.catalog_import_candidates c
    where c.id = p_candidate_id
  )
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_not_found';
  end if;
  if v_batch.status in ('accepted', 'rejected') then
    raise exception using errcode = 'P0001', message = 'catalog_batch_closed';
  end if;
  if v_batch.status not in ('staged', 'reviewed') then
    raise exception using errcode = 'P0001', message = 'catalog_batch_not_reviewed';
  end if;

  select c.* into v_candidate
  from public.catalog_import_candidates c
  where c.id = p_candidate_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_not_found';
  end if;
  if v_candidate.promoted_at is not null then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_already_promoted';
  end if;
  if v_candidate.validation_status <> 'valid' then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_invalid';
  end if;

  insert into public.catalog_import_candidate_reviews (
    candidate_id, decision, reviewer_user_id, reviewer_principal, reason
  ) values (
    v_candidate.id, v_decision, p_reviewer_user_id, v_principal, v_reason
  );

  update public.catalog_import_candidates
  set review_status = v_decision,
      reviewed_at = pg_catalog.now()
  where id = v_candidate.id;

  select count(*) into v_pending_count
  from public.catalog_import_candidates c
  where c.import_batch_id = v_candidate.import_batch_id
    and c.review_status = 'pending';

  if v_pending_count = 0 and v_batch.status = 'staged' then
    update public.catalog_import_batches
    set status = 'reviewed'
    where id = v_batch.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'reviewed',
    'candidate_id', v_candidate.id,
    'batch_id', v_candidate.import_batch_id,
    'decision', v_decision,
    'pending_count', v_pending_count
  );
end;
$$;

create or replace function public.catalog_promote_import_batch(
  p_import_batch_id uuid,
  p_promoter_user_id uuid,
  p_promoter_principal text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_candidate public.catalog_import_candidates%rowtype;
  v_manufacturer public.manufacturers%rowtype;
  v_alias public.manufacturer_aliases%rowtype;
  v_mold public.disc_molds%rowtype;
  v_plastic public.disc_plastics%rowtype;
  v_mold_plastic public.disc_mold_plastics%rowtype;
  v_run public.disc_runs%rowtype;
  v_stamp public.disc_stamps%rowtype;
  v_fields jsonb;
  v_identity jsonb;
  v_manufacturer_key text;
  v_mold_key text;
  v_plastic_key text;
  v_run_key text;
  v_stamp_key text;
  v_manufacturer_name text;
  v_mold_name text;
  v_plastic_name text;
  v_run_name text;
  v_stamp_name text;
  v_alias_name text;
  v_official_url text;
  v_adapter_key text;
  v_description text;
  v_firmness text;
  v_durability text;
  v_category text;
  v_production_status text;
  v_pdga_approved_date date;
  v_availability_status text;
  v_batch_code text;
  v_tooling text;
  v_facility text;
  v_artwork_reference_url text;
  v_production_year smallint;
  v_speed numeric;
  v_glide numeric;
  v_turn numeric;
  v_fade numeric;
  v_speed_adjustment numeric;
  v_glide_adjustment numeric;
  v_turn_adjustment numeric;
  v_fade_adjustment numeric;
  v_resolved_manufacturer_id uuid;
  v_target_manufacturer_id uuid;
  v_target_manufacturer_alias_id uuid;
  v_target_mold_id uuid;
  v_target_plastic_id uuid;
  v_target_mold_plastic_id uuid;
  v_target_run_id uuid;
  v_target_stamp_id uuid;
  v_promoter_principal text := pg_catalog.nullif(pg_catalog.btrim(p_promoter_principal), '');
  v_approved_count integer := 0;
  v_rejected_count integer := 0;
  v_promoted_count integer := 0;
  v_pending_count integer;
  v_needs_changes_count integer;
  v_invalid_approved_count integer;
  v_changed boolean;
begin
  if p_promoter_user_id is null or v_promoter_principal is null
     or length(v_promoter_principal) > 256 then
    raise exception using errcode = 'P0001', message = 'catalog_promotion_request_invalid';
  end if;
  if not exists (
    select 1 from private.catalog_ingestion_admins a
    where a.user_id = p_promoter_user_id
      and a.revoked_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'catalog_admin_required';
  end if;

  select b.* into v_batch
  from public.catalog_import_batches b
  where b.id = p_import_batch_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'catalog_batch_not_found';
  end if;

  if v_batch.status = 'accepted' then
    select count(*) into v_promoted_count
    from public.catalog_import_candidates c
    where c.import_batch_id = v_batch.id and c.promoted_at is not null;
    return pg_catalog.jsonb_build_object(
      'status', 'already_accepted',
      'batch_id', v_batch.id,
      'promoted_candidate_count', v_promoted_count
    );
  end if;
  if v_batch.status = 'rejected' then
    return pg_catalog.jsonb_build_object('status', 'already_rejected', 'batch_id', v_batch.id);
  end if;
  if v_batch.status <> 'reviewed' then
    raise exception using errcode = 'P0001', message = 'catalog_batch_not_reviewed';
  end if;

  select count(*) into v_pending_count
  from public.catalog_import_candidates c
  where c.import_batch_id = v_batch.id and c.review_status = 'pending';
  if v_pending_count > 0 then
    raise exception using errcode = 'P0001', message = 'catalog_batch_not_reviewed';
  end if;

  select count(*) into v_needs_changes_count
  from public.catalog_import_candidates c
  where c.import_batch_id = v_batch.id and c.review_status = 'needs_changes';
  if v_needs_changes_count > 0 then
    raise exception using errcode = 'P0001', message = 'catalog_batch_needs_changes';
  end if;

  select count(*) into v_invalid_approved_count
  from public.catalog_import_candidates c
  where c.import_batch_id = v_batch.id
    and c.review_status = 'approved'
    and c.validation_status <> 'valid';
  if v_invalid_approved_count > 0 then
    raise exception using errcode = 'P0001', message = 'catalog_candidate_invalid';
  end if;

  select count(*) into v_approved_count
  from public.catalog_import_candidates c
  where c.import_batch_id = v_batch.id and c.review_status = 'approved';
  select count(*) into v_rejected_count
  from public.catalog_import_candidates c
  where c.import_batch_id = v_batch.id and c.review_status = 'rejected';

  -- The explicit rank is the dependency order:
  -- manufacturer -> alias -> mold/plastic -> mold_plastic -> run -> stamp.
  for v_candidate in
    select c.*
    from public.catalog_import_candidates c
    where c.import_batch_id = v_batch.id
      and c.review_status = 'approved'
    order by case c.entity_type
      when 'manufacturer' then 1
      when 'manufacturer_alias' then 2
      when 'mold' then 3
      when 'plastic' then 3
      when 'mold_plastic' then 4
      when 'run' then 5
      when 'stamp' then 6
      else 99
    end, c.row_number, c.id
    for update
  loop
    if v_candidate.promoted_at is not null then
      raise exception using errcode = 'P0001', message = 'catalog_candidate_already_promoted';
    end if;
    if v_candidate.entity_type in ('source', 'entity_source') then
      raise exception using errcode = 'P0001', message = 'catalog_unsupported_candidate_type';
    end if;

    v_fields := v_candidate.normalized_fields;
    v_identity := v_candidate.identity;
    perform private.catalog_assert_candidate_fields(
      v_candidate.entity_type, v_candidate.supported_fields, v_fields
    );

    v_target_manufacturer_id := null;
    v_target_manufacturer_alias_id := null;
    v_target_mold_id := null;
    v_target_plastic_id := null;
    v_target_mold_plastic_id := null;
    v_target_run_id := null;
    v_target_stamp_id := null;
    v_resolved_manufacturer_id := null;
    v_changed := false;

    if v_candidate.entity_type = 'manufacturer' then
      v_manufacturer_key := coalesce(
        private.catalog_identity_value(v_identity, 'manufacturerKey'),
        private.catalog_identity_value(v_identity, 'name')
      );
      v_manufacturer_name := private.catalog_required_text(v_fields, 'name', 'manufacturer');
      if v_manufacturer_key is null
         or pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
            <> pg_catalog.lower(pg_catalog.btrim(v_manufacturer_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      v_official_url := private.catalog_optional_text(v_fields, 'official_url');
      v_adapter_key := private.catalog_optional_text(v_fields, 'adapter_key');

      select m.* into v_manufacturer
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then
        insert into public.manufacturers (name, official_url, adapter_key, status)
        values (v_manufacturer_name, v_official_url, v_adapter_key, 'active')
        returning * into v_manufacturer;
        v_changed := true;
      else
        v_official_url := private.catalog_merge_text('manufacturer', 'official_url', v_manufacturer.official_url, v_official_url);
        v_adapter_key := private.catalog_merge_text('manufacturer', 'adapter_key', v_manufacturer.adapter_key, v_adapter_key);
        if v_manufacturer.official_url is distinct from v_official_url
           or v_manufacturer.adapter_key is distinct from v_adapter_key then
          update public.manufacturers
          set official_url = v_official_url,
              adapter_key = v_adapter_key,
              updated_at = pg_catalog.now()
          where id = v_manufacturer.id
          returning * into v_manufacturer;
          v_changed := true;
        end if;
      end if;
      v_target_manufacturer_id := v_manufacturer.id;

    elsif v_candidate.entity_type = 'manufacturer_alias' then
      v_manufacturer_key := private.catalog_identity_value(v_identity, 'manufacturerKey');
      v_alias_name := private.catalog_required_text(v_fields, 'alias', 'manufacturer_alias');
      if private.catalog_identity_value(v_identity, 'aliasKey') is not null
         and pg_catalog.lower(pg_catalog.btrim(private.catalog_identity_value(v_identity, 'aliasKey')))
             <> pg_catalog.lower(pg_catalog.btrim(v_alias_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      select m.id into v_resolved_manufacturer_id
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then
        raise exception using errcode = 'P0001', message = 'catalog_dependency_missing';
      end if;
      select a.* into v_alias
      from public.manufacturer_aliases a
      where pg_catalog.lower(pg_catalog.btrim(a.alias))
        = pg_catalog.lower(pg_catalog.btrim(v_alias_name))
      for update;
      if found then
        if v_alias.manufacturer_id <> v_resolved_manufacturer_id then
          raise exception using errcode = 'P0001', message = 'catalog_canonical_conflict';
        end if;
      else
        insert into public.manufacturer_aliases (manufacturer_id, alias)
        values (v_resolved_manufacturer_id, v_alias_name)
        returning * into v_alias;
        v_changed := true;
      end if;
      v_target_manufacturer_alias_id := v_alias.id;

    elsif v_candidate.entity_type = 'mold' then
      v_manufacturer_key := private.catalog_identity_value(v_identity, 'manufacturerKey');
      v_mold_name := private.catalog_required_text(v_fields, 'mold_name', 'mold');
      v_mold_key := private.catalog_identity_value(v_identity, 'moldKey');
      if v_mold_key is not null
         and pg_catalog.lower(pg_catalog.btrim(v_mold_key))
             <> pg_catalog.lower(pg_catalog.btrim(v_mold_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      select m.id, m.name into v_resolved_manufacturer_id, v_manufacturer_name
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      v_speed := private.catalog_optional_numeric(v_fields, 'speed');
      v_glide := private.catalog_optional_numeric(v_fields, 'glide');
      v_turn := private.catalog_optional_numeric(v_fields, 'turn');
      v_fade := private.catalog_optional_numeric(v_fields, 'fade');
      v_category := private.catalog_optional_text(v_fields, 'category');
      v_pdga_approved_date := private.catalog_optional_date(v_fields, 'pdga_approved_date');
      v_production_status := private.catalog_optional_text(v_fields, 'production_status');
      v_speed_adjustment := private.catalog_optional_numeric(v_fields, 'diameter_cm');
      v_glide_adjustment := private.catalog_optional_numeric(v_fields, 'rim_width_cm');

      select m.* into v_mold
      from public.disc_molds m
      where m.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(m.mold_name))
          = pg_catalog.lower(pg_catalog.btrim(v_mold_name))
      for update;
      if not found then
        insert into public.disc_molds (
          manufacturer, manufacturer_id, mold_name, speed, glide, turn, fade,
          category, pdga_approved_date, production_status, diameter_cm, rim_width_cm
        ) values (
          v_manufacturer_name, v_resolved_manufacturer_id, v_mold_name,
          v_speed, v_glide, v_turn, v_fade, v_category, v_pdga_approved_date,
          v_production_status, v_speed_adjustment, v_glide_adjustment
        ) returning * into v_mold;
        v_changed := true;
      else
        v_speed := private.catalog_merge_numeric('mold', 'speed', v_mold.speed, v_speed);
        v_glide := private.catalog_merge_numeric('mold', 'glide', v_mold.glide, v_glide);
        v_turn := private.catalog_merge_numeric('mold', 'turn', v_mold.turn, v_turn);
        v_fade := private.catalog_merge_numeric('mold', 'fade', v_mold.fade, v_fade);
        v_category := private.catalog_merge_text('mold', 'category', v_mold.category, v_category);
        v_production_status := private.catalog_merge_text('mold', 'production_status', v_mold.production_status, v_production_status);
        v_pdga_approved_date := private.catalog_merge_date('mold', 'pdga_approved_date', v_mold.pdga_approved_date, v_pdga_approved_date);
        v_speed_adjustment := private.catalog_merge_numeric('mold', 'diameter_cm', v_mold.diameter_cm, v_speed_adjustment);
        v_glide_adjustment := private.catalog_merge_numeric('mold', 'rim_width_cm', v_mold.rim_width_cm, v_glide_adjustment);
        if v_mold.speed is distinct from v_speed or v_mold.glide is distinct from v_glide
           or v_mold.turn is distinct from v_turn or v_mold.fade is distinct from v_fade
           or v_mold.category is distinct from v_category
           or v_mold.pdga_approved_date is distinct from v_pdga_approved_date
           or v_mold.production_status is distinct from v_production_status
           or v_mold.diameter_cm is distinct from v_speed_adjustment
           or v_mold.rim_width_cm is distinct from v_glide_adjustment then
          update public.disc_molds
          set speed = v_speed, glide = v_glide, turn = v_turn, fade = v_fade,
              category = v_category, pdga_approved_date = v_pdga_approved_date,
              production_status = v_production_status, diameter_cm = v_speed_adjustment,
              rim_width_cm = v_glide_adjustment, updated_at = pg_catalog.now()
          where id = v_mold.id
          returning * into v_mold;
          v_changed := true;
        end if;
      end if;
      v_target_mold_id := v_mold.id;

    elsif v_candidate.entity_type = 'plastic' then
      v_manufacturer_key := private.catalog_identity_value(v_identity, 'manufacturerKey');
      v_plastic_name := private.catalog_required_text(v_fields, 'name', 'plastic');
      v_plastic_key := private.catalog_identity_value(v_identity, 'plasticKey');
      if v_plastic_key is not null
         and pg_catalog.lower(pg_catalog.btrim(v_plastic_key))
             <> pg_catalog.lower(pg_catalog.btrim(v_plastic_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      select m.id into v_resolved_manufacturer_id
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      v_description := private.catalog_optional_text(v_fields, 'description');
      v_firmness := private.catalog_optional_text(v_fields, 'firmness');
      v_durability := private.catalog_optional_text(v_fields, 'durability');
      select p.* into v_plastic
      from public.disc_plastics p
      where p.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(p.name))
          = pg_catalog.lower(pg_catalog.btrim(v_plastic_name))
      for update;
      if not found then
        insert into public.disc_plastics (manufacturer_id, name, description, firmness, durability)
        values (v_resolved_manufacturer_id, v_plastic_name, v_description, v_firmness, v_durability)
        returning * into v_plastic;
        v_changed := true;
      else
        v_description := private.catalog_merge_text('plastic', 'description', v_plastic.description, v_description);
        v_firmness := private.catalog_merge_text('plastic', 'firmness', v_plastic.firmness, v_firmness);
        v_durability := private.catalog_merge_text('plastic', 'durability', v_plastic.durability, v_durability);
        if v_plastic.description is distinct from v_description
           or v_plastic.firmness is distinct from v_firmness
           or v_plastic.durability is distinct from v_durability then
          update public.disc_plastics
          set description = v_description, firmness = v_firmness,
              durability = v_durability, updated_at = pg_catalog.now()
          where id = v_plastic.id
          returning * into v_plastic;
          v_changed := true;
        end if;
      end if;
      v_target_plastic_id := v_plastic.id;

    elsif v_candidate.entity_type = 'mold_plastic' then
      v_manufacturer_key := private.catalog_identity_value(v_identity, 'manufacturerKey');
      v_mold_key := private.catalog_identity_value(v_identity, 'moldKey');
      v_plastic_key := private.catalog_identity_value(v_identity, 'plasticKey');
      select m.id into v_resolved_manufacturer_id
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select m.id into v_target_mold_id
      from public.disc_molds m
      where m.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(m.mold_name))
          = pg_catalog.lower(pg_catalog.btrim(v_mold_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select p.id into v_target_plastic_id
      from public.disc_plastics p
      where p.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(p.name))
          = pg_catalog.lower(pg_catalog.btrim(v_plastic_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      v_availability_status := private.catalog_optional_text(v_fields, 'availability_status');
      v_speed_adjustment := private.catalog_optional_numeric(v_fields, 'speed_adjustment');
      v_glide_adjustment := private.catalog_optional_numeric(v_fields, 'glide_adjustment');
      v_turn_adjustment := private.catalog_optional_numeric(v_fields, 'turn_adjustment');
      v_fade_adjustment := private.catalog_optional_numeric(v_fields, 'fade_adjustment');
      select mp.* into v_mold_plastic
      from public.disc_mold_plastics mp
      where mp.mold_id = v_target_mold_id and mp.plastic_id = v_target_plastic_id
      for update;
      if not found then
        insert into public.disc_mold_plastics (
          manufacturer_id, mold_id, plastic_id, availability_status,
          speed_adjustment, glide_adjustment, turn_adjustment, fade_adjustment
        ) values (
          v_resolved_manufacturer_id, v_target_mold_id, v_target_plastic_id,
          coalesce(v_availability_status, 'current'), v_speed_adjustment,
          v_glide_adjustment, v_turn_adjustment, v_fade_adjustment
        ) returning * into v_mold_plastic;
        v_changed := true;
      else
        v_availability_status := private.catalog_merge_text('mold_plastic', 'availability_status', v_mold_plastic.availability_status, v_availability_status);
        v_speed_adjustment := private.catalog_merge_numeric('mold_plastic', 'speed_adjustment', v_mold_plastic.speed_adjustment, v_speed_adjustment);
        v_glide_adjustment := private.catalog_merge_numeric('mold_plastic', 'glide_adjustment', v_mold_plastic.glide_adjustment, v_glide_adjustment);
        v_turn_adjustment := private.catalog_merge_numeric('mold_plastic', 'turn_adjustment', v_mold_plastic.turn_adjustment, v_turn_adjustment);
        v_fade_adjustment := private.catalog_merge_numeric('mold_plastic', 'fade_adjustment', v_mold_plastic.fade_adjustment, v_fade_adjustment);
        if v_mold_plastic.availability_status is distinct from v_availability_status
           or v_mold_plastic.speed_adjustment is distinct from v_speed_adjustment
           or v_mold_plastic.glide_adjustment is distinct from v_glide_adjustment
           or v_mold_plastic.turn_adjustment is distinct from v_turn_adjustment
           or v_mold_plastic.fade_adjustment is distinct from v_fade_adjustment then
          update public.disc_mold_plastics
          set availability_status = v_availability_status,
              speed_adjustment = v_speed_adjustment, glide_adjustment = v_glide_adjustment,
              turn_adjustment = v_turn_adjustment, fade_adjustment = v_fade_adjustment,
              updated_at = pg_catalog.now()
          where id = v_mold_plastic.id
          returning * into v_mold_plastic;
          v_changed := true;
        end if;
      end if;
      v_target_mold_plastic_id := v_mold_plastic.id;

    elsif v_candidate.entity_type = 'run' then
      v_manufacturer_key := private.catalog_identity_value(v_identity, 'manufacturerKey');
      v_mold_key := private.catalog_identity_value(v_identity, 'moldKey');
      v_plastic_key := private.catalog_identity_value(v_identity, 'plasticKey');
      v_run_name := private.catalog_required_text(v_fields, 'run_name', 'run');
      v_run_key := private.catalog_identity_value(v_identity, 'runKey');
      if v_run_key is not null
         and pg_catalog.lower(pg_catalog.btrim(v_run_key))
             <> pg_catalog.lower(pg_catalog.btrim(v_run_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      select m.id into v_resolved_manufacturer_id
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select m.id into v_target_mold_id
      from public.disc_molds m
      where m.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(m.mold_name))
          = pg_catalog.lower(pg_catalog.btrim(v_mold_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select p.id into v_target_plastic_id
      from public.disc_plastics p
      where p.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(p.name))
          = pg_catalog.lower(pg_catalog.btrim(v_plastic_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select mp.id into v_target_mold_plastic_id
      from public.disc_mold_plastics mp
      where mp.mold_id = v_target_mold_id and mp.plastic_id = v_target_plastic_id
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      v_production_year := private.catalog_optional_smallint(v_fields, 'production_year');
      v_batch_code := private.catalog_optional_text(v_fields, 'batch_code');
      v_tooling := private.catalog_optional_text(v_fields, 'tooling');
      v_facility := private.catalog_optional_text(v_fields, 'facility');
      select r.* into v_run
      from public.disc_runs r
      where r.mold_plastic_id = v_target_mold_plastic_id
        and pg_catalog.lower(pg_catalog.btrim(r.run_name))
          = pg_catalog.lower(pg_catalog.btrim(v_run_name))
        and r.production_year is not distinct from v_production_year
        and pg_catalog.lower(coalesce(pg_catalog.btrim(r.batch_code), ''))
          = pg_catalog.lower(coalesce(pg_catalog.btrim(v_batch_code), ''))
      for update;
      if not found then
        insert into public.disc_runs (
          mold_plastic_id, run_name, production_year, batch_code, tooling, facility
        ) values (
          v_target_mold_plastic_id, v_run_name, v_production_year,
          v_batch_code, v_tooling, v_facility
        ) returning * into v_run;
        v_changed := true;
      else
        v_tooling := private.catalog_merge_text('run', 'tooling', v_run.tooling, v_tooling);
        v_facility := private.catalog_merge_text('run', 'facility', v_run.facility, v_facility);
        if v_run.tooling is distinct from v_tooling or v_run.facility is distinct from v_facility then
          update public.disc_runs
          set tooling = v_tooling, facility = v_facility, updated_at = pg_catalog.now()
          where id = v_run.id
          returning * into v_run;
          v_changed := true;
        end if;
      end if;
      v_target_run_id := v_run.id;

    elsif v_candidate.entity_type = 'stamp' then
      v_manufacturer_key := private.catalog_identity_value(v_identity, 'manufacturerKey');
      v_mold_key := private.catalog_identity_value(v_identity, 'moldKey');
      v_plastic_key := private.catalog_identity_value(v_identity, 'plasticKey');
      v_run_name := private.catalog_required_text(v_fields, 'run_name', 'stamp');
      v_stamp_name := private.catalog_required_text(v_fields, 'stamp_name', 'stamp');
      v_run_key := private.catalog_identity_value(v_identity, 'runKey');
      v_stamp_key := private.catalog_identity_value(v_identity, 'stampKey');
      if v_run_key is not null
         and pg_catalog.lower(pg_catalog.btrim(v_run_key))
             <> pg_catalog.lower(pg_catalog.btrim(v_run_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      if v_stamp_key is not null
         and pg_catalog.lower(pg_catalog.btrim(v_stamp_key))
             <> pg_catalog.lower(pg_catalog.btrim(v_stamp_name)) then
        raise exception using errcode = 'P0001', message = 'catalog_identity_mismatch';
      end if;
      select m.id into v_resolved_manufacturer_id
      from public.manufacturers m
      where pg_catalog.lower(pg_catalog.btrim(m.name))
        = pg_catalog.lower(pg_catalog.btrim(v_manufacturer_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select m.id into v_target_mold_id
      from public.disc_molds m
      where m.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(m.mold_name))
          = pg_catalog.lower(pg_catalog.btrim(v_mold_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select p.id into v_target_plastic_id
      from public.disc_plastics p
      where p.manufacturer_id = v_resolved_manufacturer_id
        and pg_catalog.lower(pg_catalog.btrim(p.name))
          = pg_catalog.lower(pg_catalog.btrim(v_plastic_key))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select mp.id into v_target_mold_plastic_id
      from public.disc_mold_plastics mp
      where mp.mold_id = v_target_mold_id and mp.plastic_id = v_target_plastic_id
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      select r.id into v_target_run_id
      from public.disc_runs r
      where r.mold_plastic_id = v_target_mold_plastic_id
        and pg_catalog.lower(pg_catalog.btrim(r.run_name))
          = pg_catalog.lower(pg_catalog.btrim(v_run_name))
        and r.production_year is not distinct from private.catalog_optional_smallint(v_fields, 'production_year')
        and pg_catalog.lower(coalesce(pg_catalog.btrim(r.batch_code), ''))
          = pg_catalog.lower(coalesce(pg_catalog.btrim(private.catalog_optional_text(v_fields, 'batch_code')), ''))
      for update;
      if not found then raise exception using errcode = 'P0001', message = 'catalog_dependency_missing'; end if;
      v_artwork_reference_url := private.catalog_optional_text(v_fields, 'artwork_reference_url');
      select s.* into v_stamp
      from public.disc_stamps s
      where s.run_id = v_target_run_id
        and pg_catalog.lower(pg_catalog.btrim(s.stamp_name))
          = pg_catalog.lower(pg_catalog.btrim(v_stamp_name))
      for update;
      if not found then
        insert into public.disc_stamps (run_id, stamp_name, artwork_reference_url)
        values (v_target_run_id, v_stamp_name, v_artwork_reference_url)
        returning * into v_stamp;
        v_changed := true;
      else
        v_artwork_reference_url := private.catalog_merge_text('stamp', 'artwork_reference_url', v_stamp.artwork_reference_url, v_artwork_reference_url);
        if v_stamp.artwork_reference_url is distinct from v_artwork_reference_url then
          update public.disc_stamps
          set artwork_reference_url = v_artwork_reference_url, updated_at = pg_catalog.now()
          where id = v_stamp.id
          returning * into v_stamp;
          v_changed := true;
        end if;
      end if;
      v_target_stamp_id := v_stamp.id;
    else
      raise exception using errcode = 'P0001', message = 'catalog_unsupported_candidate_type';
    end if;

    insert into public.catalog_entity_sources (
      source_id, import_batch_id, import_candidate_id,
      manufacturer_id, manufacturer_alias_id, mold_id, plastic_id,
      mold_plastic_id, run_id, stamp_id, source_reference,
      supported_fields, evidence_snapshot, confidence, captured_at,
      promoted_by_user_id, promoted_by_principal
    ) values (
      v_batch.source_id, v_batch.id, v_candidate.id,
      v_target_manufacturer_id, v_target_manufacturer_alias_id, v_target_mold_id,
      v_target_plastic_id, v_target_mold_plastic_id, v_target_run_id,
      v_target_stamp_id, v_candidate.source_reference, v_candidate.supported_fields,
      v_candidate.evidence_snapshot, v_candidate.confidence, v_batch.captured_at,
      p_promoter_user_id, v_promoter_principal
    );

    update public.catalog_import_candidates
    set promoted_at = pg_catalog.now()
    where id = v_candidate.id;
    v_promoted_count := v_promoted_count + 1;
  end loop;

  update public.catalog_import_batches
  set status = case when v_approved_count = 0 then 'rejected' else 'accepted' end,
      completed_at = pg_catalog.now(),
      error_summary = null
  where id = v_batch.id;

  return pg_catalog.jsonb_build_object(
    'status', case when v_approved_count = 0 then 'rejected' else 'accepted' end,
    'batch_id', v_batch.id,
    'approved_candidate_count', v_approved_count,
    'rejected_candidate_count', v_rejected_count,
    'promoted_candidate_count', v_promoted_count,
    'promoted_by_principal', v_promoter_principal
  );
end;
$$;

revoke all on function private.catalog_assert_candidate_fields(text, text[], jsonb)
  from public, anon, authenticated;
revoke all on function private.catalog_identity_value(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.catalog_required_text(jsonb, text, text)
  from public, anon, authenticated;
revoke all on function private.catalog_optional_text(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.catalog_optional_numeric(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.catalog_optional_smallint(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.catalog_optional_date(jsonb, text)
  from public, anon, authenticated;
revoke all on function private.catalog_merge_text(text, text, text, text)
  from public, anon, authenticated;
revoke all on function private.catalog_merge_numeric(text, text, numeric, numeric)
  from public, anon, authenticated;
revoke all on function private.catalog_merge_date(text, text, date, date)
  from public, anon, authenticated;
grant execute on function private.catalog_assert_candidate_fields(text, text[], jsonb)
  to service_role;
grant execute on function private.catalog_identity_value(jsonb, text)
  to service_role;
grant execute on function private.catalog_required_text(jsonb, text, text)
  to service_role;
grant execute on function private.catalog_optional_text(jsonb, text)
  to service_role;
grant execute on function private.catalog_optional_numeric(jsonb, text)
  to service_role;
grant execute on function private.catalog_optional_smallint(jsonb, text)
  to service_role;
grant execute on function private.catalog_optional_date(jsonb, text)
  to service_role;
grant execute on function private.catalog_merge_text(text, text, text, text)
  to service_role;
grant execute on function private.catalog_merge_numeric(text, text, numeric, numeric)
  to service_role;
grant execute on function private.catalog_merge_date(text, text, date, date)
  to service_role;

revoke all on function public.catalog_review_candidate(uuid, text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.catalog_promote_import_batch(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.catalog_review_candidate(uuid, text, uuid, text, text)
  to service_role;
grant execute on function public.catalog_promote_import_batch(uuid, uuid, text)
  to service_role;

commit;
