# Phase B catalog migration — B1.3 review packet

Status: **applied and verified** (2026-07-12)

Migrations:

- `supabase/migrations/20260712223528_phase_b_catalog_foundation.sql`
- `supabase/migrations/20260712230530_phase_b_catalog_advisor_indexes.sql`
- `supabase/migrations/20260712230619_phase_b_catalog_configuration_fk_index.sql`

The B1 design and live-audit refinements were approved before file generation. The pre-apply backup was
automated and verified on 2026-07-12 at
`C:\tmp\disc-golf-app-backups\20260712-190157`: `database.dump` is a valid 875-entry custom archive
(512,096 bytes, SHA-256 `07135CED94F78FFE53D8BBAFCC43A99F6AA0ADED81FB1A5B2AFDD2F9517A77B6`),
with separate non-empty schema and data SQL dumps. Backup contents remain outside Git.

## B1.4 review result

Static architecture/security review passed after three corrections: mold/plastic pairings now enforce a
shared manufacturer through composite foreign keys; submission/evidence/configuration owner links are
composite foreign keys; and submission/evidence update policies constrain both the current and resulting
state. The existing nullable `disc_molds.created_by` foreign key also receives its missing partial index.
The final draft parses successfully as PostgreSQL (`pglast` 8.2, 105 statements). No SQL was executed to
reach this result; behavioral/RLS verification remains a post-apply gate.

## B1.5 applied result

- Foundation and both append-only advisor migrations are recorded under their exact local versions.
- Four manufacturer rows backfill all 36 molds; zero molds are unlinked.
- All 13 new public tables have RLS. No verification submission/configuration rows remain.
- Authenticated canonical reads return 36 molds; direct canonical insert is denied.
- Owner configuration create/read succeeds inside rollback; cross-user visibility is zero.
- Draft submission advances to submitted once; subsequent submitter mutation affects zero rows.
- Performance advisors report no new catalog FK findings. New empty-table unused-index notices are
  expected and retained because the indexes cover FKs and planned query paths.
- `catalog_import_batches` intentionally has RLS with no client policy and no client grant. Its advisor
  INFO notice documents deny-by-default server/service-role isolation, not missing access.

## B1.7 candidate/artifact persistence result

Applied and verified on 2026-07-12:

- `supabase/migrations/20260713002434_phase_b_catalog_candidate_artifact_persistence.sql`
- `supabase/migrations/20260713002750_phase_b_catalog_candidate_artifact_indexes.sql`
- `public.catalog_import_artifacts` stores immutable raw-response metadata and binds its checksum to
  the durable batch checksum; `public.catalog_import_candidates` stores normalized, checksummed,
  reviewable rows; `public.catalog_import_candidate_reviews` preserves append-only review decisions.
- `private.catalog_ingestion_admins` is the service-role-managed admin allowlist; no ordinary client
  grants or RLS policies exist for staging, review, or admin rows.
- The `catalog-import-raw` bucket is private, 5 MiB-limited, and restricted to the approved fetch
  content types. No `storage.objects` policy grants ordinary-client access.
- Rollback-only live tests passed checksum/FK constraints, immutable candidate source fields, and
  append-only review guards. The linked error-level database lint returned zero results; advisors
  report only intentional RLS-no-policy and unused-index INFO notices for the empty staging tables.

The pre-index backup was automated and verified at
`C:\tmp\disc-golf-app-backups\20260712-202618`: custom archive 1,085 entries, 612,325 bytes,
SHA-256 `17CFD4E5A1CE87D181BF0CA77B11BB6AFD98F1C71AA107EA63E31B8BDED2486B`; schema/data dumps
remain outside Git.

## Live audit snapshot

- Connected project: `disc-golf-app` (`icqzbvtjisxwycvioiup`, us-east-1), Postgres 17.6.1.141.
- 36 molds: Innova 17, MVP 9, Axiom 7, Streamline 3.
- Zero case-insensitive duplicate molds, missing manufacturer/mold labels, incomplete flight-number rows,
  or rows without legacy provenance.
- All 36 legacy `disc_molds.plastics` arrays are empty.
- 20 physical discs across three owners; 18 have plastic text and all 20 have `mold_id`.
- The actively exercised account is `35b59d46-c58d-4193-9de2-f09238c0d009` (four freeform sessions,
  three regimen runs, seven lifecycle activities, one disc). Representative test data must use this
  account, not the separate 17-disc account with no session history.
- Existing mold policies use deprecated `auth.role()`, allow direct authenticated inserts, and sit behind
  broad grants. B1 replaces this with authenticated reads plus owner-scoped submissions.

## Migration boundary

The draft:

- preserves every existing `disc_molds.id` and its compatibility manufacturer/plastics fields;
- normalizes manufacturer, plastic, mold-plastic availability, run, and stamp identities;
- backfills manufacturer rows and non-null `disc_molds.manufacturer_id` links;
- records sources, versioned import batches, field support, evidence snapshots, and confidence;
- uses typed nullable provenance FKs with an exactly-one-target check instead of an unenforced
  polymorphic entity reference;
- adds private owner-scoped configurations and a persistent submission/evidence/review history;
- removes direct community writes to canonical molds and replaces deprecated mold policies;
- grants ordinary clients only the operations supported by their RLS policies.

The draft does **not** seed authoritative plastics/runs/stamps from the small physical-disc sample, add
admin approval RPCs, modify physical-disc foreign keys, remove compatibility columns, or implement B2+
features. Those boundaries prevent inferred catalog facts and premature client coupling.

## Preflight and apply gate

Before any future apply:

1. Create and verify the automated CLI/`pg_dump` backup; no additional confirmation is required after
   path, size, archive listing, and checksum verification.
2. Confirm the migration remains unapplied locally and remotely.
3. Re-run the live-audit counts; duplicate molds, blank names, and null `mold_id` counts must remain zero.
4. Review every table/check/FK/index, especially run identity and submission status transitions.
5. Review the admin authorization design. Service-role use must remain server-side only.
6. Apply first to a disposable/local database or reviewed Supabase development branch when available.
7. Run positive, negative, cross-user, duplicate, and transaction-rollback tests.
8. Run security and performance advisors; do not accept new DISCS findings.

## Verification SQL

```sql
select count(*) molds,
       count(*) filter (where manufacturer_id is null) unlinked
from public.disc_molds;

select lower(btrim(name)), count(*)
from public.manufacturers
group by 1 having count(*) > 1;

select lower(btrim(m.manufacturer)), lower(btrim(m.mold_name)), count(*)
from public.disc_molds m
group by 1, 2 having count(*) > 1;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'manufacturers', 'manufacturer_aliases', 'disc_molds', 'disc_plastics',
    'disc_mold_plastics', 'disc_runs', 'disc_stamps', 'catalog_sources',
    'catalog_import_batches', 'catalog_entity_sources', 'catalog_submissions',
    'catalog_submission_evidence', 'catalog_submission_reviews',
    'user_disc_configurations'
  )
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename like any (array[
  'disc_molds', 'manufacturers', 'manufacturer_aliases', 'disc_plastics',
  'disc_mold_plastics', 'disc_runs', 'disc_stamps', 'catalog_%',
  'user_disc_configurations'
])
order by tablename, policyname;
```

Required authenticated-session tests:

- anonymous reads and all writes fail;
- authenticated canonical reads succeed;
- direct canonical insert/update/delete fails;
- a user can CRUD only their private configurations;
- a user can create a draft submission, add evidence, and submit it once;
- submitted rows and evidence are immutable to the submitter;
- another user cannot read or mutate the submission, evidence, configuration, or review;
- submitters can read review outcomes only for their own submissions;
- duplicate normalized manufacturer/mold/plastic/run/stamp identities fail atomically.

## Recovery posture

Before client rollout, a failed apply recovers from the confirmed backup. Because the migration is one
transaction, an ordinary SQL error should roll it back completely; still verify no new table or column
survived before retrying. After any client or adapter writes Phase B data, do not drop or hand-edit the
catalog tables. Disable new writes, export every Phase B table, preserve submission/provenance history,
and use a reviewed forward repair. Compatibility columns remain specifically to support safe rollback of
the client release while the normalized model proves itself.
