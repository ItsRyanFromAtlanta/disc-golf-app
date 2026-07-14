-- Phase B — scrap catalog ingestion: tear down the automated ingestion surface.
--
-- Decision 2026-07-13 (see DEVLOG + DEVELOPMENT_PLAN.md §1B population policy):
-- the automated manufacturer-site ingestion pipeline is abandoned; disc_molds
-- will be populated manually. This migration drops ONLY the ingestion pipeline
-- objects (staging/candidate/artifact/review tables, the ingestion RPCs and
-- their private helpers, the admin allowlist, and the raw-artifact bucket).
--
-- INTENTIONALLY PRESERVED (the catalog data foundation + community submission
-- flow that manual population targets — DO NOT drop these):
--   manufacturers, manufacturer_aliases, disc_molds, disc_plastics,
--   disc_mold_plastics, disc_runs, disc_stamps, catalog_sources,
--   catalog_entity_sources, catalog_submissions, catalog_submission_reviews,
--   catalog_submission_evidence, user_disc_configurations, discs (mold_id FK).
--
-- Preconditions confirmed before writing: all dropped tables held 0 rows except
-- private.catalog_ingestion_admins (1 allowlist row, intentionally removed). The
-- catalog-ingestion / catalog-ingestion-admin Edge Functions were already
-- deleted, so nothing calls these RPCs at apply time. catalog_ensure_source and
-- every private.catalog_* helper below were verified referenced only by the
-- ingestion staging/promotion migrations, never by the foundation/submission flow.

begin;

-- 1. Ingestion tables (CASCADE also removes their guard/append-only triggers and
--    any dependent constraints). FK-child order first, though CASCADE covers it.
drop table if exists public.catalog_import_candidate_reviews cascade;
drop table if exists public.catalog_import_candidates cascade;
drop table if exists public.catalog_import_artifacts cascade;
drop table if exists public.catalog_import_batches cascade;

-- 2. Admin allowlist (removes the single granted row with it).
drop table if exists private.catalog_ingestion_admins cascade;

-- 3. Ingestion RPCs and their private helpers, dropped by exact name with their
--    resolved signatures (enumerated — never a private.catalog_% wildcard, so no
--    shared foundation/submission helper can be caught).
do $$
declare
  r record;
begin
  for r in
    select format(
             'drop function if exists %I.%I(%s) cascade',
             n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
           ) as stmt
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname = 'public' and p.proname in (
             'catalog_stage_import',
             'catalog_review_candidate',
             'catalog_promote_import_batch',
             'catalog_assert_ingestion_admin',
             'catalog_ensure_source'
           ))
        or (n.nspname = 'private' and p.proname in (
             'catalog_assert_candidate_fields',
             'catalog_identity_value',
             'catalog_import_candidate_guard',
             'catalog_import_candidate_review_append_only',
             'catalog_merge_date',
             'catalog_merge_numeric',
             'catalog_merge_text',
             'catalog_optional_date',
             'catalog_optional_numeric',
             'catalog_optional_smallint',
             'catalog_optional_text',
             'catalog_required_text'
           ))
  loop
    execute r.stmt;
  end loop;
end $$;

commit;

-- 4. The raw-artifact private Storage bucket ('catalog-import-raw') is removed
--    out-of-band via the Storage API, NOT here: Supabase blocks direct DELETE on
--    storage.objects/buckets (storage.protect_delete). The bucket held 0 objects
--    (no batch was ever staged), so removing it is a no-data-loss cleanup done
--    through the CLI/dashboard alongside this migration.
