-- Phase B B1.9 correction: coalesce is SQL syntax, not a pg_catalog
-- function. Replace the first staging RPC bodies without rewriting the
-- already-applied migration history.

begin;

create or replace function public.catalog_ensure_source(
  p_source_type text,
  p_source_name text,
  p_source_url text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source_id uuid;
begin
  if p_source_type is null
     or p_source_type not in ('manufacturer', 'pdga', 'curated_seed', 'community', 'import', 'other')
     or p_source_name is null
     or pg_catalog.length(pg_catalog.btrim(p_source_name)) = 0
     or pg_catalog.length(pg_catalog.btrim(p_source_name)) > 256
     or p_source_url is null
     or pg_catalog.left(pg_catalog.lower(pg_catalog.btrim(p_source_url)), 8) <> 'https://'
  then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;

  select s.id
    into v_source_id
    from public.catalog_sources s
   where s.source_type = p_source_type
     and pg_catalog.lower(pg_catalog.btrim(s.name)) = pg_catalog.lower(pg_catalog.btrim(p_source_name))
     and pg_catalog.lower(coalesce(pg_catalog.btrim(s.url), ''))
       = pg_catalog.lower(pg_catalog.btrim(p_source_url))
   for update;

  if v_source_id is not null then
    return v_source_id;
  end if;

  begin
    insert into public.catalog_sources (source_type, name, url)
    values (p_source_type, pg_catalog.btrim(p_source_name), pg_catalog.btrim(p_source_url))
    returning id into v_source_id;
  exception
    when unique_violation then
      select s.id
        into v_source_id
        from public.catalog_sources s
       where s.source_type = p_source_type
         and pg_catalog.lower(pg_catalog.btrim(s.name)) = pg_catalog.lower(pg_catalog.btrim(p_source_name))
         and pg_catalog.lower(coalesce(pg_catalog.btrim(s.url), ''))
           = pg_catalog.lower(pg_catalog.btrim(p_source_url))
       for update;
  end;

  if v_source_id is null then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;
  return v_source_id;
end;
$$;

create or replace function public.catalog_stage_import(
  p_source_id uuid,
  p_actor_user_id uuid,
  p_actor_principal text,
  p_batch jsonb,
  p_artifact jsonb,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_artifact public.catalog_import_artifacts%rowtype;
  v_adapter_name text;
  v_adapter_version text;
  v_source_checksum text;
  v_status text;
  v_captured_at timestamptz;
  v_row_count integer;
  v_artifact_checksum text;
  v_artifact_path text;
  v_artifact_kind text;
  v_storage_bucket text;
  v_candidate_count integer;
begin
  if p_actor_user_id is null
     or p_actor_principal is distinct from ('admin:' || p_actor_user_id::text)
     or not exists (
       select 1
         from private.catalog_ingestion_admins a
        where a.user_id = p_actor_user_id
          and a.revoked_at is null
     )
  then
    raise exception using errcode = 'P0001', message = 'catalog_admin_required';
  end if;

  if p_source_id is null
     or pg_catalog.jsonb_typeof(p_batch) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_artifact) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_candidates) is distinct from 'array'
  then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;

  if not exists (select 1 from public.catalog_sources s where s.id = p_source_id) then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;

  v_adapter_name := pg_catalog.btrim(p_batch ->> 'adapter_name');
  v_adapter_version := pg_catalog.btrim(p_batch ->> 'adapter_version');
  v_source_checksum := pg_catalog.lower(pg_catalog.btrim(p_batch ->> 'source_checksum'));
  v_status := pg_catalog.btrim(p_batch ->> 'status');

  if v_adapter_name is null
     or v_adapter_name !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_adapter_version is null
     or pg_catalog.length(v_adapter_version) = 0
     or pg_catalog.length(v_adapter_version) > 64
     or v_source_checksum is null
     or v_source_checksum !~ '^[0-9a-f]{64}$'
     or v_status is distinct from 'staged'
     or (p_batch ->> 'captured_at') is null
     or coalesce(p_batch ->> 'row_count', '') !~ '^[0-9]+$'
  then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;

  v_captured_at := (p_batch ->> 'captured_at')::timestamptz;
  v_row_count := (p_batch ->> 'row_count')::integer;
  v_candidate_count := pg_catalog.jsonb_array_length(p_candidates);

  if v_row_count < 0
     or v_row_count <> v_candidate_count
     or v_candidate_count > 1000
  then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;

  v_artifact_checksum := pg_catalog.lower(pg_catalog.btrim(p_artifact ->> 'source_checksum'));
  v_artifact_path := pg_catalog.replace(pg_catalog.btrim(p_artifact ->> 'storage_path'), '\\', '/');
  v_artifact_kind := coalesce(p_artifact ->> 'artifact_kind', 'raw_response');
  v_storage_bucket := coalesce(p_artifact ->> 'storage_bucket', 'catalog-import-raw');

  if v_artifact_checksum is distinct from v_source_checksum
     or v_artifact_kind is distinct from 'raw_response'
     or v_storage_bucket is distinct from 'catalog-import-raw'
     or v_artifact_path is distinct from ('raw/' || v_source_checksum || '.raw')
     or (p_artifact ->> 'requested_url') is null
     or pg_catalog.left(pg_catalog.lower(pg_catalog.btrim(p_artifact ->> 'requested_url')), 8) <> 'https://'
     or (p_artifact ->> 'final_url') is null
     or pg_catalog.left(pg_catalog.lower(pg_catalog.btrim(p_artifact ->> 'final_url')), 8) <> 'https://'
     or coalesce(p_artifact ->> 'http_status', '') !~ '^[0-9]+$'
     or coalesce(p_artifact ->> 'response_bytes', '') !~ '^[0-9]+$'
  then
    raise exception using errcode = 'P0001', message = 'catalog_stage_request_invalid';
  end if;

  insert into public.catalog_import_batches (
    source_id,
    adapter_name,
    adapter_version,
    source_checksum,
    status,
    captured_at,
    row_count
  )
  values (
    p_source_id,
    v_adapter_name,
    v_adapter_version,
    v_source_checksum,
    'staged',
    v_captured_at,
    v_row_count
  )
  on conflict (source_id, adapter_name, adapter_version, source_checksum) do nothing
  returning * into v_batch;

  if not found then
    select b.*
      into v_batch
      from public.catalog_import_batches b
     where b.source_id = p_source_id
       and b.adapter_name = v_adapter_name
       and b.adapter_version = v_adapter_version
       and b.source_checksum = v_source_checksum
     for update;

    return pg_catalog.jsonb_build_object(
      'status', 'existing',
      'batch', pg_catalog.to_jsonb(v_batch)
    );
  end if;

  insert into public.catalog_import_artifacts (
    import_batch_id,
    source_checksum,
    artifact_kind,
    storage_bucket,
    storage_path,
    requested_url,
    final_url,
    http_status,
    content_type,
    response_bytes,
    etag,
    last_modified,
    redirect_count,
    captured_at
  )
  values (
    v_batch.id,
    v_source_checksum,
    v_artifact_kind,
    v_storage_bucket,
    v_artifact_path,
    pg_catalog.btrim(p_artifact ->> 'requested_url'),
    pg_catalog.btrim(p_artifact ->> 'final_url'),
    (p_artifact ->> 'http_status')::smallint,
    nullif(pg_catalog.btrim(p_artifact ->> 'content_type'), ''),
    (p_artifact ->> 'response_bytes')::bigint,
    nullif(p_artifact ->> 'etag', ''),
    nullif(p_artifact ->> 'last_modified', ''),
    coalesce(nullif(p_artifact ->> 'redirect_count', '')::smallint, 0),
    (p_artifact ->> 'captured_at')::timestamptz
  )
  returning * into v_artifact;

  insert into public.catalog_import_candidates (
    import_batch_id,
    row_number,
    entity_type,
    identity_key,
    identity,
    normalized_fields,
    supported_fields,
    source_reference,
    evidence_snapshot,
    confidence,
    candidate_checksum,
    validation_status,
    dedup_status,
    conflict_code,
    review_status
  )
  select
    v_batch.id,
    c.row_number,
    c.entity_type,
    c.identity_key,
    c.identity,
    c.normalized_fields,
    c.supported_fields,
    c.source_reference,
    c.evidence_snapshot,
    c.confidence,
    pg_catalog.lower(c.candidate_checksum),
    'valid',
    case
      when exists (
        select 1
          from public.catalog_import_candidates prior
         where prior.identity_key = c.identity_key
           and prior.candidate_checksum = pg_catalog.lower(c.candidate_checksum)
      ) then 'unchanged'
      when exists (
        select 1
          from public.catalog_import_candidates prior
         where prior.identity_key = c.identity_key
      ) then 'changed'
      else 'new'
    end,
    null,
    'pending'
  from pg_catalog.jsonb_to_recordset(p_candidates) as c(
    row_number integer,
    entity_type text,
    identity_key text,
    identity jsonb,
    normalized_fields jsonb,
    supported_fields text[],
    source_reference text,
    evidence_snapshot jsonb,
    confidence text,
    candidate_checksum text
  );

  return pg_catalog.jsonb_build_object(
    'status', 'staged',
    'batch', pg_catalog.to_jsonb(v_batch),
    'artifact', pg_catalog.to_jsonb(v_artifact),
    'candidate_count', v_candidate_count
  );
end;
$$;

commit;
