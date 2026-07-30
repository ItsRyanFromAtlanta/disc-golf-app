# Current Work

Last updated: 2026-07-30

This file is the restart/handoff checkpoint. A fresh session should be able to resume from this file,
`AGENTS.md`, and one relevant spec without replaying previous conversations. Per-item implementation
and verification history lives in `DEVLOG.md` (newest first) — do not duplicate it here.

## Session and branch of record (2026-07-30)

Work had fragmented across parallel Codex/Claude sessions, each on its own branch. It is now
consolidated to a single line of development.

- **Branch of record is `main` again.** `claude/consolidate-chats-stage-actions-rj0lwl` merged as
  PR #4 (`eb9fd2b`) and is closed out. Open new work from `main`, not from that branch and not from
  a per-session branch. The consolidation branch and `claude/handoff-file-review-fqt4oc` can both be
  pruned with actions 3 and 4 below.
- **All 14 `codex/*` branches are fully merged into `main`** (verified: zero commits unique to any of
  them) and are safe to delete. They are retained only until the owner prunes them.
- **`claude/continue-hoqtyv` is superseded and will NOT be merged.** Its single unique commit
  (`775543c`, Layer 5 Screen 10, 2026-07-14) sits 81 commits behind `main` and each of its surfaces
  was rebuilt independently afterwards: `DataExportPanel`/`csvExport` by E1's `dataExport` +
  `dataExportRepository`, `ConfidenceMapPanel` by `ConfidenceMapPage` + `insights/confidenceMap`,
  `BehavioralToggles`/`ClearCacheModal` by `SettingsPage` + `settingsRepository`, and
  `SyncLedger`/`flushOutbox` by `syncScheduler` + `activitySync`. Merging it would reintroduce a
  second parallel implementation of each. The one surface with no successor — `TrendChart` +
  `insights/timeSeries` — is recorded in `FEATURE_BACKLOG.md` as a salvage candidate; the code stays
  reachable at `775543c` and does not need the branch kept.

## Resume point

- **Active phase:** Phase E. Phases A, B, C, and D are complete; E1 shipped 2026-07-17.
- **E2 is no longer blocked.** Account deletion was applied to the database on 2026-07-29 as
  `20260729213112_phase_e_account_deletion` — verified against the live migration list, not inferred.
  The four smoke checks in Open follow-ups remain **unrun**.
- **Next:** **E2 — shipped J1 round/course reconciliation.** Audit and harden the existing course/
  layout and offline round routes rather than rebuilding them, then add weather, activity-only rounds,
  group-scorecard groundwork, bag snapshot verification, and course preparation as separately
  committed green checkpoints. See `DEVELOPMENT_PLAN.md` § E2 and `PRODUCT_ROADMAP.md` § Phase E.

## Staged next actions

Ordered. The 2026-07-28 actions 1 and 2 (apply the account-deletion migration, merge PR #4) are both
**done** and have been removed from this table. E2 is unblocked.

| # | Action | Owner | Blocks |
|---|---|---|---|
| 1 | **Reconcile the three applied migrations that have no repo file** — see Open follow-ups | agent + owner | migration policy; reproducible rebuild |
| 2 | Run the four account-deletion smoke checks | owner | App Review confidence |
| 3 | Configure protected `main` + required review/checks in GitHub settings | owner (admin UI) | unreviewed auto-deploy risk |
| 4 | Delete the empty `catalog-import-raw` Storage bucket | owner (Supabase dashboard) | nothing; hygiene |
| 5 | Prune the merged `codex/*` and `claude/*` branches | **owner** — see note | nothing; hygiene |
| 6 | Resolve the E2E contradiction: build a Playwright baseline or amend the Phase A contract | agent | honest Phase A status |
| 7 | Begin E2 round/course reconciliation | agent | — |

**Action 5 is owner-only for environment reasons, not judgement reasons.** It was approved on
2026-07-28 and attempted; the git proxy returns HTTP 403 on `git push origin --delete`, and the
GitHub tool set exposes no delete-branch capability. Prune from the GitHub branches UI. All 14
`codex/*` branches were re-verified as having zero commits outside `main` immediately before the
attempt, so deleting them loses nothing. `claude/continue-hoqtyv` is kept for now as a visible
pointer until the `TrendChart` salvage in `FEATURE_BACKLOG.md` is done.

**Supabase MCP access recovered on 2026-07-30.** The 2026-07-28 note that "every Supabase MCP call
returns `MCP tool call requires approval`" no longer holds — read calls (`list_projects`,
`list_migrations`) now succeed. Do not carry that limitation forward; re-test before assuming a
Supabase call is blocked.

## Standing decisions that constrain new work

- **The "Disc Up" iOS bundle is PARKED (2026-07-30) — do not implement it against this repo.** A
  handoff document arrived describing Disc Up, a greenfield native SwiftUI/SwiftData iOS app for a
  repo named `disc-golf-iOS`. It is parked on three counts: the GitHub repo does not exist
  (`list_repos` returns only `disc-golf-app` and `disc-catcher`); the eleven documents it instructs
  an agent to commit were never attached; and its own text forbids implementation until three
  PROVISIONAL decisions are confirmed. **Its Supabase backend is real** — project `disc-golf-ios`
  (`ezzwoivuxhmfemplkobd`, created 2026-07-17, ACTIVE_HEALTHY), separate from this app's
  `icqzbvtjisxwycvioiup`.

  Several of its locked decisions directly reverse shipped architecture here, so it is **not** a
  feature to fold in: player data never leaving the device (this app syncs through Supabase with auth
  and RLS), Supabase reduced to a read-only course catalog with an empty `public` schema (this app's
  `public` holds putts, sessions, discs, bags, rounds), and "routine, never regimen" (this app's
  schema is `putting_regimens` / `putting_regimen_runs` / `putting_regimen_sets` plus
  `src/lib/regimenScoring.js`). It also assumes a from-scratch SwiftUI client, where
  `docs/mobile/IOS_READINESS.md` calls for Capacitor and only after Phase A field flows stabilize.

  **Open question for the owner:** is Disc Up a separate product or a rebuild of this one? Nothing
  downstream should treat the bundle as accepted design until that is answered.

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

- **`npm test` needs the Supabase placeholders exported, or 13 files fail at import** with a config
  error that looks like a regression and is not. CI sets them inline (`.github/workflows/ci.yml`);
  locally use `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder`.
  Green on the branch of record as of 2026-07-28: 497 tests across 74 files, build clean.
- Lint carries four pre-existing warnings: three hook-dependency findings and one Fast Refresh export
  finding. Address as touched or in a bounded cleanup review.
- Browser verification to date has been agent-driven smoke against anonymous sessions. Authenticated
  in-app rendering and interaction remain unexercised in the isolated browser environment, and the
  Phase A real-device gate is user-reported rather than Codex-observed. There is no automated E2E
  suite — see `PHASE_A_ARCHITECTURE.md` § 9 and `FEATURE_BACKLOG.md`.
- Production bundle is ~740 KB minified / ~213 KB gzip; code splitting is a tracked backlog item
  before public/mobile beta.

## Open follow-ups

- **Database is ahead of the repo by three migrations (found 2026-07-30).** The live project
  (`icqzbvtjisxwycvioiup`) reports 51 applied migrations; `supabase/migrations/` holds 35 files. Most
  of the gap is the pre-Phase-A schema that lives in root-level `*_schema.sql` files, which is
  expected. These three are not — they were applied to production and have **no repo counterpart at
  all**:

  | Applied version | Name |
  |---|---|
  | `20260729213141` | `phase_e_preserve_moderation_history` |
  | `20260729213216` | `phase_e_atomic_course_creation` |
  | `20260730025443` | `phase_e_hole_number_nulls_not_distinct` |

  This breaks the append-only migration policy below and means a rebuild from `supabase/migrations/`
  would not reproduce production. Reconcile before E2 touches course/round schema — E2 is exactly the
  area `atomic_course_creation` and `hole_number_nulls_not_distinct` sit in, so working around them
  blind risks a conflicting migration. Recover the DDL from the dashboard migration history rather
  than reconstructing it from introspection, since introspection loses comments and rollback notes.

  Related: `20260727120000_phase_e_account_deletion.sql` is in the repo but was applied under the
  stamp `20260729213112`, so filename and applied version do not match. Note it when reconciling.

- **The four account-deletion smoke checks are still unrun.** The RPC is applied and live. Verify in
  a rollback-only transaction: a second user's rows survive, community `created_by` is nulled rather
  than deleted, private Storage objects under the user's prefix are gone, and `anon` cannot execute
  `public.delete_own_account()`.

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
