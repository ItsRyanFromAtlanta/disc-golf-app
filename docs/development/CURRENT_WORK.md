# Current Work

Last updated: 2026-07-27

This file is the restart/handoff checkpoint. A fresh session should be able to resume from this file,
`AGENTS.md`, and one relevant spec without replaying previous conversations. Per-item implementation
and verification history lives in `DEVLOG.md` (newest first) — do not duplicate it here.

## Resume point

- **Active phase:** Phase E. Phases A, B, C, and D are complete; E1 shipped 2026-07-17.
- **Next:** **E2 — shipped J1 round/course reconciliation.** Audit and harden the existing course/
  layout and offline round routes rather than rebuilding them, then add weather, activity-only rounds,
  group-scorecard groundwork, bag snapshot verification, and course preparation as separately
  committed green checkpoints. See `DEVELOPMENT_PLAN.md` § E2 and `PRODUCT_ROADMAP.md` § Phase E.

## Standing decisions that constrain new work

- **Catalog ingestion is SCRAPPED (2026-07-13) — do NOT rebuild a scraper.** The first live crawl
  proved the pipeline worked end to end, but MVP's live pages no longer expose parseable flight
  numbers (moved to prose, no `data-flight`), so 0 batches staged. The entire ingestion surface was
  removed from the client and the database (migration `20260714120000`). `disc_molds` is populated
  **manually** by the owner.
- **The B1.5 catalog foundation is retained and distinct from that pipeline.** `manufacturers`,
  `manufacturer_aliases`, `disc_molds`, `disc_plastics`, `disc_mold_plastics`, `disc_runs`,
  `disc_stamps`, `catalog_sources`, `catalog_entity_sources`, and `catalog_submissions` are live with
  RLS and least-privilege grants and hold real data. This is the schema manual population targets.
  `discs.mold_id` FKs into `disc_molds`; **never drop it.**
- **Migration policy:** append-only SQL, reviewed rollback notes, RLS negative tests, advisors, and
  post-apply smoke checks. Do not run backup commands or request manual backup confirmation.
- **Schema files are append-only.** New concepts arrive as additive columns/tables, never as a
  wholesale replacement.

## Known baseline (not regressions)

- Lint carries four pre-existing warnings: three hook-dependency findings and one Fast Refresh export
  finding. Address as touched or in a bounded cleanup review.
- Browser verification to date has been agent-driven smoke against anonymous sessions. Authenticated
  in-app rendering and interaction remain unexercised in the isolated browser environment, and the
  Phase A real-device gate is user-reported rather than Codex-observed. There is no automated E2E
  suite — see `PHASE_A_ARCHITECTURE.md` § 9 and `FEATURE_BACKLOG.md`.
- Production bundle is ~740 KB minified / ~213 KB gzip; code splitting is a tracked backlog item
  before public/mobile beta.

## Open follow-ups

- **`20260727120000_phase_e_account_deletion.sql` is written but NOT applied.** It creates the
  `public.delete_own_account()` security-definer RPC. Until it is applied, the Settings delete button
  fails with an undefined-function error. Apply it, then smoke-test in a rollback-only transaction:
  a second user's rows survive, community `created_by` is nulled rather than deleted, private Storage
  objects under the user's prefix are gone, and `anon` cannot execute the function.

- Delete the empty `catalog-import-raw` Storage bucket from the Supabase dashboard. Direct DELETE on
  storage tables is blocked and the CLI manages objects rather than buckets, so this needs the
  dashboard. Open since 2026-07-14.
- Enable protected-`main` required review/checks now that CI runs green remotely. `main` auto-deploys.
- Automated browser E2E is unbuilt while the Phase A contract lists it as required. Either build it or
  amend the contract; do not report it as shipped.
- Install the OpenAI Developer Docs MCP locally (`CODEX_WORKFLOW.md` § Installed capabilities). The
  desktop sandbox could not launch the installer.

Update this file at each major commit/push: move the resume point, add or clear follow-ups, and record
new standing decisions. Keep it short — history belongs in `DEVLOG.md`.
