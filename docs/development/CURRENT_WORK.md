# Current Work

Last updated: 2026-07-14

- **Active phase:** J1 complete; next is J2 disc comparison view.
- **Approved:** Phase A shell/navigation, lifecycle, notification, scrolling/sheets, accessibility,
  repository/transaction, migration-order, test-gate, and A1–A10 walkthrough are complete. A8 recovery
  (RPCs + versioned metric registry, Dexie v3 audited outbox, Recently Deleted restore) and the A9/A10
  notification contract (append-only migration, Dexie v4 mirror, durable outbox, bell sheet/deep-link UI)
  remain complete and live-verified.
- **⚠️ Catalog ingestion SCRAPPED (2026-07-13):** The automated catalog-ingestion effort is abandoned.
  `disc_molds` will be **populated manually** by the owner, later — not by a manufacturer-site scraper.
  The full ingestion surface was torn down: the `catalog-ingestion` / `catalog-ingestion-admin` Edge
  Functions, all `supabase/functions/_shared/catalog*`/`mvp*` modules, `src/pages/AdminCatalogReviewPage.jsx`,
  `src/lib/catalogAdmin.js`, `src/lib/catalog/*`, `src/lib/repository/catalogRepository.js`, and the
  `/admin/catalog` route are removed. Trigger: the first live crawl proved the pipeline worked end-to-end
  but MVP's live pages no longer expose parseable flight numbers (moved to prose, no `data-flight`), so
  0 batches staged. See DEVLOG (2026-07-13 top entry) and DEVELOPMENT_PLAN.md §1B population policy. Do
  NOT rebuild a scraper.
- **B1.5 catalog FOUNDATION is retained** (distinct from the scrapped ingestion pipeline): the
  normalized `manufacturers` / `manufacturer_aliases` / `disc_molds` / `disc_plastics` / `disc_mold_plastics`
  / `disc_runs` / `disc_stamps` / `catalog_sources` / `catalog_entity_sources` / `catalog_submissions`
  tables are live with RLS and least-privilege grants and hold real data (four manufacturers, 36 molds,
  20 physical `discs` across three owners with `mold_id` links). This is the schema manual population
  targets — keep it. `discs.mold_id` FKs into `disc_molds`; never drop it.
- **Database teardown state:** DONE (2026-07-14, migration `20260714120000`, applied after a confirmed
  manual backup). Dropped the ingestion-only DB objects: the staging/candidate/artifact/review tables,
  the `catalog_assert_ingestion_admin` / `catalog_review_candidate` / `catalog_promote_import_batch` /
  `catalog_stage_import` / `catalog_ensure_source` RPCs and their private helpers, and the
  `private.catalog_ingestion_admins` allowlist. Every foundation table was preserved (verified before +
  after). The migration files that created these objects stay as append-only history. **One follow-up
  remains:** delete the empty `catalog-import-raw` Storage bucket from the Supabase dashboard — direct
  DELETE on storage tables is blocked, and the CLI manages objects, not buckets.
- **J1 shipped 2026-07-14:** Added the COURSES tab and `/courses` + `/rounds` route trees, quick-course
  creation, layout/hole detail, optional bag selection, Dexie v5 round/round-hole caching, idempotent
  activity-parent/round outbox ordering, offline scorecard capture, history, and finalization. Applied
  `20260714150000_phase_c_round_logging_rls.sql` with owner-scoped round policies and authenticated
  community course policies. Schema columns remain append-only and unchanged.
- **J1 verification:** 338 tests pass across 35 files; production build passes; lint retains only the
  four pre-existing warnings; `graphify update .` completed. Live RLS/index verification and a
  rollback-only authenticated owner/foreign-user smoke passed with zero rows left behind. Browser smoke
  reached `/login` from `/courses` with no console errors because no authenticated browser session was
  available; no guest account was created.
- **Migration follow-up:** automated backup was attempted with the bundled `supabase db dump --linked`,
  but Docker is unavailable and `pg_dump` is not installed. Take a manual backup before the next DDL/FK
  session. No J1 data rows were seeded.
- **Resume point:** Start J2 disc comparison on the `codex/j1-round-logging` checkpoint, then return to
  the roadmap's DISCS intelligence work. The 1B mold-derivation migration remains valid for the owner's
  future manual catalog population.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
