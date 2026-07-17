-- Phase B B1.3: normalized DISCS catalog, provenance, private custom
-- configurations, and community review queue.
--
-- IDEAL COLUMN FORMAT
-- - distributed/offline-created identities: uuid primary keys;
-- - user ownership: non-null uuid FK to auth.users with indexed RLS lookup;
-- - names/labels: text with non-blank checks and case-insensitive unique indexes;
-- - lifecycle values: text with explicit CHECK constraints;
-- - instants: timestamptz; source snapshots: object-shaped jsonb;
-- - every FK used for joins, review lookup, or cascades has a supporting index.
--
-- DRAFT ONLY. Unapplied locally and remotely. Review the companion packet at
-- docs/operations/PHASE_B_CATALOG_MIGRATION.md and re-confirm the fresh manual
-- backup immediately before any future apply.

begin;

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  official_url text,
  adapter_key text check (adapter_key is null or adapter_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'inactive', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index manufacturers_name_uniq on public.manufacturers (lower(btrim(name)));
create unique index manufacturers_adapter_key_uniq on public.manufacturers (adapter_key)
  where adapter_key is not null;

create table public.manufacturer_aliases (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  alias text not null check (length(btrim(alias)) > 0),
  created_at timestamptz not null default now()
);

create unique index manufacturer_aliases_alias_uniq
  on public.manufacturer_aliases (lower(btrim(alias)));
create index manufacturer_aliases_manufacturer_id_idx
  on public.manufacturer_aliases (manufacturer_id);

alter table public.disc_molds
  add column manufacturer_id uuid references public.manufacturers(id),
  add column catalog_status text not null default 'approved'
    check (catalog_status in ('approved', 'retired', 'merged')),
  add column updated_at timestamptz not null default now();

insert into public.manufacturers (name)
select distinct btrim(manufacturer)
from public.disc_molds
order by btrim(manufacturer);

update public.disc_molds m
set manufacturer_id = mf.id
from public.manufacturers mf
where lower(btrim(m.manufacturer)) = lower(btrim(mf.name));

alter table public.disc_molds alter column manufacturer_id set not null;
create index disc_molds_manufacturer_id_idx on public.disc_molds (manufacturer_id);
create index disc_molds_created_by_idx on public.disc_molds (created_by)
  where created_by is not null;
create unique index disc_molds_id_manufacturer_uniq
  on public.disc_molds (id, manufacturer_id);

create table public.disc_plastics (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id),
  name text not null check (length(btrim(name)) > 0),
  description text,
  firmness text,
  durability text,
  catalog_status text not null default 'approved'
    check (catalog_status in ('approved', 'retired', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index disc_plastics_manufacturer_name_uniq
  on public.disc_plastics (manufacturer_id, lower(btrim(name)));
create index disc_plastics_manufacturer_id_idx on public.disc_plastics (manufacturer_id);
create unique index disc_plastics_id_manufacturer_uniq
  on public.disc_plastics (id, manufacturer_id);

create table public.disc_mold_plastics (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id),
  mold_id uuid not null,
  plastic_id uuid not null,
  availability_status text not null default 'current'
    check (availability_status in ('current', 'limited', 'retired', 'unknown')),
  speed_adjustment numeric,
  glide_adjustment numeric,
  turn_adjustment numeric,
  fade_adjustment numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mold_id, plastic_id),
  constraint disc_mold_plastics_mold_manufacturer_fkey
    foreign key (mold_id, manufacturer_id)
    references public.disc_molds (id, manufacturer_id),
  constraint disc_mold_plastics_plastic_manufacturer_fkey
    foreign key (plastic_id, manufacturer_id)
    references public.disc_plastics (id, manufacturer_id)
);

create index disc_mold_plastics_manufacturer_id_idx
  on public.disc_mold_plastics (manufacturer_id);
create index disc_mold_plastics_plastic_id_idx on public.disc_mold_plastics (plastic_id);

create table public.disc_runs (
  id uuid primary key default gen_random_uuid(),
  mold_plastic_id uuid not null references public.disc_mold_plastics(id),
  run_name text not null check (length(btrim(run_name)) > 0),
  production_year smallint check (production_year between 1900 and 2200),
  batch_code text,
  tooling text,
  facility text,
  catalog_status text not null default 'approved'
    check (catalog_status in ('approved', 'retired', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index disc_runs_identity_uniq on public.disc_runs (
  mold_plastic_id,
  lower(btrim(run_name)),
  coalesce(production_year, 0),
  lower(coalesce(btrim(batch_code), ''))
);
create index disc_runs_mold_plastic_id_idx on public.disc_runs (mold_plastic_id);

create table public.disc_stamps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.disc_runs(id),
  stamp_name text not null check (length(btrim(stamp_name)) > 0),
  artwork_reference_url text,
  catalog_status text not null default 'approved'
    check (catalog_status in ('approved', 'retired', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index disc_stamps_run_name_uniq
  on public.disc_stamps (run_id, lower(btrim(stamp_name)));
create index disc_stamps_run_id_idx on public.disc_stamps (run_id);

create table public.catalog_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
    'manufacturer', 'pdga', 'curated_seed', 'community', 'import', 'other'
  )),
  name text not null check (length(btrim(name)) > 0),
  url text,
  created_at timestamptz not null default now()
);

create unique index catalog_sources_identity_uniq
  on public.catalog_sources (source_type, lower(btrim(name)), lower(coalesce(btrim(url), '')));

create table public.catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.catalog_sources(id),
  adapter_name text not null check (length(btrim(adapter_name)) > 0),
  adapter_version text not null check (length(btrim(adapter_version)) > 0),
  source_checksum text not null check (length(btrim(source_checksum)) > 0),
  status text not null check (status in ('staged', 'reviewed', 'accepted', 'rejected', 'failed')),
  captured_at timestamptz not null,
  completed_at timestamptz,
  row_count integer not null default 0 check (row_count >= 0),
  error_summary text,
  created_at timestamptz not null default now(),
  unique (source_id, adapter_name, adapter_version, source_checksum)
);

create index catalog_import_batches_source_id_idx on public.catalog_import_batches (source_id);

create table public.catalog_entity_sources (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.catalog_sources(id),
  import_batch_id uuid references public.catalog_import_batches(id),
  manufacturer_id uuid references public.manufacturers(id),
  mold_id uuid references public.disc_molds(id),
  plastic_id uuid references public.disc_plastics(id),
  mold_plastic_id uuid references public.disc_mold_plastics(id),
  run_id uuid references public.disc_runs(id),
  stamp_id uuid references public.disc_stamps(id),
  source_reference text,
  supported_fields text[] not null default '{}',
  evidence_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  confidence text not null default 'unverified'
    check (confidence in ('unverified', 'corroborated', 'manufacturer_verified', 'admin_verified')),
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(
    manufacturer_id, mold_id, plastic_id, mold_plastic_id, run_id, stamp_id
  ) = 1)
);

create index catalog_entity_sources_source_id_idx on public.catalog_entity_sources (source_id);
create index catalog_entity_sources_import_batch_id_idx on public.catalog_entity_sources (import_batch_id)
  where import_batch_id is not null;
create index catalog_entity_sources_manufacturer_id_idx on public.catalog_entity_sources (manufacturer_id)
  where manufacturer_id is not null;
create index catalog_entity_sources_mold_id_idx on public.catalog_entity_sources (mold_id)
  where mold_id is not null;
create index catalog_entity_sources_plastic_id_idx on public.catalog_entity_sources (plastic_id)
  where plastic_id is not null;
create index catalog_entity_sources_mold_plastic_id_idx on public.catalog_entity_sources (mold_plastic_id)
  where mold_plastic_id is not null;
create index catalog_entity_sources_run_id_idx on public.catalog_entity_sources (run_id)
  where run_id is not null;
create index catalog_entity_sources_stamp_id_idx on public.catalog_entity_sources (stamp_id)
  where stamp_id is not null;

create table public.catalog_submissions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_type text not null check (submission_type in (
    'manufacturer', 'mold', 'plastic', 'mold_plastic', 'run', 'stamp', 'correction'
  )),
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'needs_changes', 'approved', 'rejected', 'duplicate'
  )),
  proposed_payload jsonb not null check (jsonb_typeof(proposed_payload) = 'object'),
  canonical_entity_id uuid,
  duplicate_of_submission_id uuid references public.catalog_submissions(id),
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check ((status = 'draft' and submitted_at is null)
    or (status <> 'draft' and submitted_at is not null)),
  check ((status in ('approved', 'rejected', 'duplicate') and resolved_at is not null)
    or status not in ('approved', 'rejected', 'duplicate'))
);

create index catalog_submissions_user_status_updated_idx
  on public.catalog_submissions (user_id, status, updated_at desc);
create index catalog_submissions_review_queue_idx
  on public.catalog_submissions (status, submitted_at, id)
  where status in ('submitted', 'under_review');
create index catalog_submissions_duplicate_id_idx
  on public.catalog_submissions (duplicate_of_submission_id)
  where duplicate_of_submission_id is not null;

create table public.catalog_submission_evidence (
  id uuid primary key,
  submission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text,
  notes text,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint catalog_submission_evidence_owner_fkey
    foreign key (submission_id, user_id)
    references public.catalog_submissions (id, user_id)
    on delete cascade
);

create index catalog_submission_evidence_submission_id_idx
  on public.catalog_submission_evidence (submission_id);
create index catalog_submission_evidence_user_id_idx
  on public.catalog_submission_evidence (user_id);

create table public.catalog_submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.catalog_submissions(id),
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('under_review', 'needs_changes', 'approved', 'rejected', 'duplicate')),
  reason text,
  canonical_entity_id uuid,
  created_at timestamptz not null default now()
);

create index catalog_submission_reviews_submission_created_idx
  on public.catalog_submission_reviews (submission_id, created_at desc);
create index catalog_submission_reviews_reviewer_id_idx
  on public.catalog_submission_reviews (reviewer_id);

create table public.user_disc_configurations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mold_id uuid references public.disc_molds(id),
  plastic_id uuid references public.disc_plastics(id),
  run_id uuid references public.disc_runs(id),
  stamp_id uuid references public.disc_stamps(id),
  custom_manufacturer text,
  custom_mold text,
  custom_plastic text,
  custom_run text,
  custom_stamp text,
  custom_speed numeric,
  custom_glide numeric,
  custom_turn numeric,
  custom_fade numeric,
  notes text,
  submitted_as_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mold_id is not null or length(btrim(coalesce(custom_mold, ''))) > 0),
  constraint user_disc_configurations_submission_owner_fkey
    foreign key (submitted_as_id, user_id)
    references public.catalog_submissions (id, user_id)
);

create index user_disc_configurations_user_updated_idx
  on public.user_disc_configurations (user_id, updated_at desc);
create index user_disc_configurations_mold_id_idx on public.user_disc_configurations (mold_id)
  where mold_id is not null;
create index user_disc_configurations_plastic_id_idx on public.user_disc_configurations (plastic_id)
  where plastic_id is not null;
create index user_disc_configurations_run_id_idx on public.user_disc_configurations (run_id)
  where run_id is not null;
create index user_disc_configurations_stamp_id_idx on public.user_disc_configurations (stamp_id)
  where stamp_id is not null;
create index user_disc_configurations_submitted_as_id_idx on public.user_disc_configurations (submitted_as_id)
  where submitted_as_id is not null;

alter table public.manufacturers enable row level security;
alter table public.manufacturer_aliases enable row level security;
alter table public.disc_plastics enable row level security;
alter table public.disc_mold_plastics enable row level security;
alter table public.disc_runs enable row level security;
alter table public.disc_stamps enable row level security;
alter table public.catalog_sources enable row level security;
alter table public.catalog_import_batches enable row level security;
alter table public.catalog_entity_sources enable row level security;
alter table public.catalog_submissions enable row level security;
alter table public.catalog_submission_evidence enable row level security;
alter table public.catalog_submission_reviews enable row level security;
alter table public.user_disc_configurations enable row level security;

-- Retire the historical insert-open mold policy. Canonical writes are now
-- service/admin-reviewed; ordinary users write submissions instead.
drop policy if exists "Anyone authenticated can view disc molds" on public.disc_molds;
drop policy if exists "Authenticated users can add disc molds" on public.disc_molds;

create policy disc_molds_select_authenticated on public.disc_molds
  for select to authenticated using (true);

create policy manufacturers_select_authenticated on public.manufacturers
  for select to authenticated using (true);
create policy manufacturer_aliases_select_authenticated on public.manufacturer_aliases
  for select to authenticated using (true);
create policy disc_plastics_select_authenticated on public.disc_plastics
  for select to authenticated using (true);
create policy disc_mold_plastics_select_authenticated on public.disc_mold_plastics
  for select to authenticated using (true);
create policy disc_runs_select_authenticated on public.disc_runs
  for select to authenticated using (true);
create policy disc_stamps_select_authenticated on public.disc_stamps
  for select to authenticated using (true);
create policy catalog_entity_sources_select_authenticated on public.catalog_entity_sources
  for select to authenticated using (true);
create policy catalog_sources_select_authenticated on public.catalog_sources
  for select to authenticated using (true);

create policy catalog_submissions_select_own on public.catalog_submissions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy catalog_submissions_insert_own_draft on public.catalog_submissions
  for insert to authenticated with check (
    (select auth.uid()) = user_id and status = 'draft'
  );
create policy catalog_submissions_update_own_draft on public.catalog_submissions
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'draft')
  with check (
    (select auth.uid()) = user_id
    and status in ('draft', 'submitted')
    and resolved_at is null
  );
create policy catalog_submissions_update_own_needs_changes on public.catalog_submissions
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'needs_changes')
  with check (
    (select auth.uid()) = user_id
    and status in ('needs_changes', 'submitted')
    and resolved_at is null
  );

create policy catalog_submission_evidence_select_own on public.catalog_submission_evidence
  for select to authenticated using ((select auth.uid()) = user_id);
create policy catalog_submission_evidence_insert_own_editable on public.catalog_submission_evidence
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.catalog_submissions s
      where s.id = submission_id and s.user_id = (select auth.uid())
        and s.status in ('draft', 'needs_changes')
    )
  );
create policy catalog_submission_evidence_update_own_editable on public.catalog_submission_evidence
  for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.catalog_submissions s
    where s.id = submission_id and s.user_id = (select auth.uid())
      and s.status in ('draft', 'needs_changes')
  ))
  with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.catalog_submissions s
      where s.id = submission_id and s.user_id = (select auth.uid())
        and s.status in ('draft', 'needs_changes')
    )
  );
create policy catalog_submission_evidence_delete_own_editable on public.catalog_submission_evidence
  for delete to authenticated using (
    (select auth.uid()) = user_id and exists (
      select 1 from public.catalog_submissions s
      where s.id = submission_id and s.user_id = (select auth.uid())
        and s.status in ('draft', 'needs_changes')
    )
  );

create policy catalog_submission_reviews_select_submitter on public.catalog_submission_reviews
  for select to authenticated using (exists (
    select 1 from public.catalog_submissions s
    where s.id = submission_id and s.user_id = (select auth.uid())
  ));

create policy user_disc_configurations_select_own on public.user_disc_configurations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_disc_configurations_insert_own on public.user_disc_configurations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_disc_configurations_update_own on public.user_disc_configurations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_disc_configurations_delete_own on public.user_disc_configurations
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.disc_molds from public, anon, authenticated;
grant select on table public.disc_molds to authenticated;

revoke all on table public.manufacturers, public.manufacturer_aliases,
  public.disc_plastics, public.disc_mold_plastics, public.disc_runs,
  public.disc_stamps, public.catalog_sources, public.catalog_import_batches,
  public.catalog_entity_sources, public.catalog_submissions,
  public.catalog_submission_evidence, public.catalog_submission_reviews,
  public.user_disc_configurations from public, anon, authenticated;

grant select on table public.manufacturers, public.manufacturer_aliases,
  public.disc_plastics, public.disc_mold_plastics, public.disc_runs,
  public.disc_stamps, public.catalog_entity_sources to authenticated;
grant select on table public.catalog_sources to authenticated;
grant select, insert, update on table public.catalog_submissions to authenticated;
grant select, insert, update, delete on table public.catalog_submission_evidence to authenticated;
grant select on table public.catalog_submission_reviews to authenticated;
grant select, insert, update, delete on table public.user_disc_configurations to authenticated;

grant all on table public.manufacturers, public.manufacturer_aliases,
  public.disc_molds, public.disc_plastics, public.disc_mold_plastics,
  public.disc_runs, public.disc_stamps, public.catalog_sources,
  public.catalog_import_batches, public.catalog_entity_sources,
  public.catalog_submissions, public.catalog_submission_evidence,
  public.catalog_submission_reviews, public.user_disc_configurations to service_role;

commit;
