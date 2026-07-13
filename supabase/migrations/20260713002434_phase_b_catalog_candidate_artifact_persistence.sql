--
-- Phase B B1.7 candidate/artifact persistence.
--
-- Ideal format:
--   * catalog_import_artifacts: one immutable raw-response metadata row per
--     import batch; checksum is tied to the existing batch identity with a
--     composite FK; storage is private and checksum-addressed.
--   * catalog_import_candidates: one normalized candidate per source row;
--     UUID identity, 1-based row number, entity/identity JSON, normalized
--     fields, provenance, server-computed checksum, validation/dedup/review
--     state, and immutable source fields.
--   * catalog_import_candidate_reviews: append-only review decisions with a
--     reviewer principal and reason. No browser/API role receives access.
--   * private.catalog_ingestion_admins: explicit user allowlist for a future
--     authenticated ingestion/promotion trigger; service_role only.
--
-- The migration deliberately adds no canonical catalog write path. Staging and
-- promotion remain server-only and must use one transaction at their respective
-- persistence boundaries.

begin;

-- B1.7 contracts require normalized lowercase SHA-256 checksums and slugged
-- adapter keys. Existing batches are empty, so these additive constraints are
-- safe to apply before the first ingestion run.
alter table public.catalog_import_batches
  add constraint catalog_import_batches_source_checksum_sha256_check
    check (source_checksum ~ '^[0-9a-f]{64}$'),
  add constraint catalog_import_batches_adapter_name_slug_check
    check (adapter_name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint catalog_import_batches_id_checksum_uniq
    unique (id, source_checksum);

create table public.catalog_import_artifacts (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null,
  source_checksum text not null
    check (source_checksum ~ '^[0-9a-f]{64}$'),
  artifact_kind text not null default 'raw_response'
    check (artifact_kind = 'raw_response'),
  storage_bucket text not null default 'catalog-import-raw'
    check (storage_bucket = 'catalog-import-raw'),
  storage_path text not null
    check (storage_path ~ '^raw/[0-9a-f]{64}[.]raw$'),
  requested_url text not null
    check (left(lower(btrim(requested_url)), 8) = 'https://'),
  final_url text not null
    check (left(lower(btrim(final_url)), 8) = 'https://'),
  http_status smallint not null check (http_status between 200 and 599),
  content_type text check (content_type is null or length(btrim(content_type)) <= 128),
  response_bytes bigint not null check (response_bytes between 0 and 5242880),
  etag text,
  last_modified text,
  redirect_count smallint not null default 0 check (redirect_count between 0 and 3),
  captured_at timestamptz not null,
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  constraint catalog_import_artifacts_batch_checksum_fkey
    foreign key (import_batch_id, source_checksum)
    references public.catalog_import_batches (id, source_checksum)
    on delete restrict,
  constraint catalog_import_artifacts_batch_kind_uniq
    unique (import_batch_id, artifact_kind),
  constraint catalog_import_artifacts_retention_check
    check (retention_until is null or retention_until >= captured_at)
);

create index catalog_import_artifacts_checksum_idx
  on public.catalog_import_artifacts (source_checksum);
create index catalog_import_artifacts_storage_path_idx
  on public.catalog_import_artifacts (storage_bucket, storage_path);

create table public.catalog_import_candidates (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.catalog_import_batches(id) on delete restrict,
  row_number integer not null check (row_number > 0),
  entity_type text not null check (entity_type in (
    'manufacturer', 'manufacturer_alias', 'mold', 'plastic',
    'mold_plastic', 'run', 'stamp', 'source', 'entity_source'
  )),
  identity_key text not null check (length(btrim(identity_key)) between 1 and 512),
  identity jsonb not null check (jsonb_typeof(identity) = 'object'),
  normalized_fields jsonb not null check (jsonb_typeof(normalized_fields) = 'object'),
  supported_fields text[] not null default '{}'
    check (array_position(supported_fields, null) is null),
  source_reference text not null
    check (length(btrim(source_reference)) between 1 and 2048),
  evidence_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  confidence text not null default 'unverified'
    check (confidence in ('unverified', 'corroborated', 'manufacturer_verified', 'admin_verified')),
  candidate_checksum text not null
    check (candidate_checksum ~ '^[0-9a-f]{64}$'),
  validation_status text not null default 'valid'
    check (validation_status in ('valid', 'invalid')),
  dedup_status text not null default 'new'
    check (dedup_status in ('new', 'unchanged', 'changed', 'conflict')),
  conflict_code text check (conflict_code is null or length(btrim(conflict_code)) between 1 and 128),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'needs_changes')),
  reviewed_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_import_candidates_reviewed_at_check
    check ((review_status = 'pending' and reviewed_at is null)
      or (review_status <> 'pending' and reviewed_at is not null)),
  constraint catalog_import_candidates_batch_row_uniq
    unique (import_batch_id, row_number),
  constraint catalog_import_candidates_batch_identity_uniq
    unique (import_batch_id, identity_key)
);

create index catalog_import_candidates_batch_review_idx
  on public.catalog_import_candidates (import_batch_id, review_status, dedup_status);
create index catalog_import_candidates_identity_checksum_idx
  on public.catalog_import_candidates (identity_key, candidate_checksum);

create table public.catalog_import_candidate_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.catalog_import_candidates(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'needs_changes')),
  reviewer_user_id uuid references auth.users(id) on delete restrict,
  reviewer_principal text not null
    check (length(btrim(reviewer_principal)) between 1 and 256),
  reason text not null check (length(btrim(reason)) between 1 and 4096),
  created_at timestamptz not null default now()
);

create index catalog_import_candidate_reviews_candidate_created_idx
  on public.catalog_import_candidate_reviews (candidate_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table private.catalog_ingestion_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= granted_at)
);

create index catalog_ingestion_admins_active_idx
  on private.catalog_ingestion_admins (user_id)
  where revoked_at is null;

alter table private.catalog_ingestion_admins enable row level security;

-- Candidate source/evidence fields are immutable after staging. Review state is
-- mutable only through the future server transaction; the review history remains
-- append-only for auditability.
create or replace function private.catalog_import_candidate_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.import_batch_id is distinct from old.import_batch_id
       or new.row_number is distinct from old.row_number
       or new.entity_type is distinct from old.entity_type
       or new.identity_key is distinct from old.identity_key
       or new.identity is distinct from old.identity
       or new.normalized_fields is distinct from old.normalized_fields
       or new.supported_fields is distinct from old.supported_fields
       or new.source_reference is distinct from old.source_reference
       or new.evidence_snapshot is distinct from old.evidence_snapshot
       or new.confidence is distinct from old.confidence
       or new.candidate_checksum is distinct from old.candidate_checksum
       or new.validation_status is distinct from old.validation_status
       or new.dedup_status is distinct from old.dedup_status
       or new.conflict_code is distinct from old.conflict_code then
      raise exception using errcode = 'P0001', message = 'catalog_candidate_source_fields_immutable';
    end if;
  end if;

  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger catalog_import_candidates_guard_trg
  before insert or update on public.catalog_import_candidates
  for each row execute function private.catalog_import_candidate_guard();

create or replace function private.catalog_import_candidate_review_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'catalog_candidate_reviews_append_only';
end;
$$;

create trigger catalog_import_candidate_reviews_append_only_trg
  before update or delete on public.catalog_import_candidate_reviews
  for each row execute function private.catalog_import_candidate_review_append_only();

alter table public.catalog_import_artifacts enable row level security;
alter table public.catalog_import_candidates enable row level security;
alter table public.catalog_import_candidate_reviews enable row level security;

revoke all on table public.catalog_import_artifacts,
  public.catalog_import_candidates,
  public.catalog_import_candidate_reviews
  from public, anon, authenticated;
grant all on table public.catalog_import_artifacts,
  public.catalog_import_candidates,
  public.catalog_import_candidate_reviews
  to service_role;

revoke all on table private.catalog_ingestion_admins from public, anon, authenticated;
grant all on table private.catalog_ingestion_admins to service_role;

revoke all on function private.catalog_import_candidate_guard() from public, anon, authenticated;
grant execute on function private.catalog_import_candidate_guard() to service_role;
revoke all on function private.catalog_import_candidate_review_append_only() from public, anon, authenticated;
grant execute on function private.catalog_import_candidate_review_append_only() to service_role;

-- Storage is private and has no ordinary-client object policies. The ingestion
-- worker uses service_role, which bypasses Storage RLS; uploads must be
-- checksum-addressed and non-upserted by the worker.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-import-raw',
  'catalog-import-raw',
  false,
  5242880,
  array['application/json', 'application/ld+json', 'application/xhtml+xml', 'text/html', 'text/plain']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = pg_catalog.now();

commit;
