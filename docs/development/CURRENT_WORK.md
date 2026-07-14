# Current Work

Last updated: 2026-07-13

- **Active phase:** Phase B — DISCS data foundation.
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
- **Database teardown state:** The ingestion-only DB objects (staging/candidate/artifact/review tables,
  the `catalog_assert_ingestion_admin` / `catalog_review_candidate` / `catalog_promote_import_batch` /
  staging RPCs, the `private.catalog_ingestion_admins` allowlist, and the `catalog-import-raw` Storage
  bucket) are targeted for a dedicated drop migration. Per project rule, that migration runs ONLY after a
  confirmed manual Supabase backup and must preserve every foundation table above. The migration files
  that created these objects stay as append-only history — the teardown is a new forward migration, not a
  deletion of past files.
- **Resume point:** Track 1 continues at 1A (player profile expansion) / 1B disc-molds schema +
  migration whenever the owner hand-populates discs. The 1B mold-derivation migration (molds from
  distinct manufacturer/mold pairs in existing `discs`) is still valid and no longer blocked on any seed.
- **Verification baseline:** After the teardown, 333 unit tests pass across 34 files; production build
  passes; lint holds at the four pre-existing warnings.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
