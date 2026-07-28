# Current Work

Last updated: 2026-07-28

This file is the restart/handoff checkpoint. A fresh session should be able to resume from this file,
`AGENTS.md`, and one relevant spec without replaying previous conversations. Per-item implementation
and verification history lives in `DEVLOG.md` (newest first) — do not duplicate it here.

## Session and branch of record (2026-07-28)

Work had fragmented across parallel Codex/Claude sessions, each on its own branch. It is now
consolidated to a single line of development.

- **Branch of record:** `claude/consolidate-chats-stage-actions-rj0lwl`, which contains `origin/main`
  plus the seven unmerged iOS/PWA and documentation-reconciliation commits. Open new work from this
  branch, not from a per-session branch, until it merges to `main`.
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
- **Blocking E2:** apply migration `20260727120000_phase_e_account_deletion.sql` (see Open
  follow-ups). In-app account deletion is a shipped-but-broken surface until it lands, and it is an
  App Review blocker rather than a Phase E feature.
- **Next:** **E2 — shipped J1 round/course reconciliation.** Audit and harden the existing course/
  layout and offline round routes rather than rebuilding them, then add weather, activity-only rounds,
  group-scorecard groundwork, bag snapshot verification, and course preparation as separately
  committed green checkpoints. See `DEVELOPMENT_PLAN.md` § E2 and `PRODUCT_ROADMAP.md` § Phase E.

## Staged next actions

Ordered. The first three close currently-open work; E2 does not start until 1 is applied.

| # | Action | Owner | Blocks |
|---|---|---|---|
| 1 | Apply `20260727120000_phase_e_account_deletion.sql`, then run the four smoke checks below | **owner** — see note | account deletion; App Review |
| 2 | Review and merge PR #4 (`main` auto-deploys) | owner review | everything downstream |
| 3 | Configure protected `main` + required review/checks in GitHub settings | owner (admin UI) | unreviewed auto-deploy risk |
| 4 | Delete the empty `catalog-import-raw` Storage bucket | owner (Supabase dashboard) | nothing; hygiene |
| 5 | Prune the 14 merged `codex/*` branches | **owner** — see note | nothing; hygiene |
| 6 | Resolve the E2E contradiction: build a Playwright baseline or amend the Phase A contract | agent | honest Phase A status |
| 7 | Begin E2 round/course reconciliation | agent | — |

**Two of these are owner-only for environment reasons, not judgement reasons.** Both were approved on
2026-07-28 and attempted; both were refused by the sandbox, so a future agent session should not
assume they are merely undecided:

- **Action 1** — every Supabase MCP call returns `MCP tool call requires approval` and never reaches
  the project. Apply via the Supabase dashboard SQL editor or `supabase db push`.
- **Action 5** — the git proxy returns HTTP 403 on `git push origin --delete`, and the GitHub tool
  set exposes no delete-branch capability. Prune from the GitHub branches UI. All 14 were re-verified
  as having zero commits outside `main` immediately before the attempt, so deleting them loses
  nothing. `claude/continue-hoqtyv` is kept for now as a visible pointer until the `TrendChart`
  salvage in `FEATURE_BACKLOG.md` is done.

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
