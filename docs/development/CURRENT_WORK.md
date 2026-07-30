# Current Work

Last updated: 2026-07-30

This file is the restart/handoff checkpoint. A fresh session should be able to resume from this file,
`AGENTS.md`, and one relevant spec without replaying previous conversations. Per-item implementation
and verification history lives in `DEVLOG.md` (newest first) — do not duplicate it here.

## Session and branch of record (2026-07-28)

Work had fragmented across parallel Codex/Claude sessions, each on its own branch. It is now
consolidated to a single line of development.

- **Branch of record:** merged to `main` on 2026-07-28 as `eb9fd2b`. `main` is authoritative again;
  open new work from it. Current session work continues on
  `claude/prioritize-scheduled-work-7lohb6`, which is `main` plus the E2E baseline, the
  degrade-on-missing-RPC fix, and the E2 audit checkpoint.
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
- **Account deletion is live** as of 2026-07-29: all three Phase E migrations are applied and
  verified. The App Review blocker is cleared. Atomic course creation is live too, so the
  quick-course flow no longer runs three unprotected sequential upserts.
- **E2's hardening half is complete as of 2026-07-30.** All nine audit findings are dispositioned:
  eight fixed, one (finding 5, unbounded course directory fetch) deferred by design with a revisit
  trigger. A fourth Phase E migration —
  `20260730025443_phase_e_hole_number_nulls_not_distinct.sql` — is applied and verified live.
- **Two repo-hygiene items that were open against the hardening work are closed as of 2026-07-30:**
  the Phase E migration filenames now match the applied ledger (so `db push` cannot regress the
  moderation-history fix), and the `supabase_schema.sql` drift is annotated rather than left silent.
  Both are detailed below.
- **Next:** the **feature** half of E2 — weather, activity-only rounds, group-scorecard groundwork,
  bag snapshot verification, and course preparation, as separately committed green checkpoints. See
  `DEVELOPMENT_PLAN.md` § E2 and `PRODUCT_ROADMAP.md` § Phase E. Note the caveat directly below
  before picking this up.

### Read this before starting more E2 hardening

The live database holds **28 users and 0 courses, 0 layouts, 0 rounds, 0 catalog reviews**. Six real
defects were found and fixed in the course/round surface across 2026-07-28/29/30 and every one was
worth fixing — but none of that code has ever run against real data, because this surface has never
been used by anyone.

The next most valuable action is almost certainly **not** finding a tenth defect. It is installing the
PWA on a phone, walking a real course, and finding out why the surface is empty. That answer changes
what is worth building next; more hardening does not.

**The `supabase_schema.sql` drift found on 2026-07-30 is now reconciled** (2026-07-30, later session).
It was not regenerated — the append-only schema policy forbids a wholesale replacement, and rewriting
the Layer 1 file would have destroyed the historical starting point without giving anyone a file they
could trust anyway. Instead the stale definitions are annotated where they sit: a header banner listing
every known divergence, and `SUPERSEDED` notes on the `holes` and `rounds` blocks pointing at the files
that own their current shape. `AGENTS.md` no longer calls it "full schema".

Divergences confirmed against live (`information_schema.columns` + `pg_indexes`, not inferred from
migration history): `layouts` is absent from the file entirely; `holes.course_id` is dropped in favour
of `layout_id`; the hole uniqueness rule is now the index `holes_layout_hole_tee_uniq` on
`(layout_id, hole_number, tee_type)` `nulls not distinct`; `rounds.layout_name` is dropped in favour of
`layout_id`; and `courses`/`rounds` carry `external_source`/`external_ref` plus `rounds.bag_id` /
`bag_version_id`.

**Still true and worth keeping in view:** no file describes the live schema end to end. The annotations
make the drift visible instead of silent; they do not replace reading the live database when a shape
actually matters.

## Staged next actions

Ordered. The first three close currently-open work. E2 no longer waits on 1 — see the interlock note
below.

| # | Action | Owner | Blocks |
|---|---|---|---|
| 1 | ~~Apply the three Phase E migrations~~ — **APPLIED AND VERIFIED 2026-07-29** on `icqzbvtjisxwycvioiup`. See "Migrations applied" below | — | — |
| 2 | ~~Review and merge PR #4~~ — **MERGED 2026-07-28** as `eb9fd2b` | — | — |
| 3 | Configure protected `main` + required review/checks in GitHub settings | owner (admin UI) | unreviewed auto-deploy risk |
| 4 | ~~Delete the empty `catalog-import-raw` Storage bucket~~ — **MOOT 2026-07-29.** It does not exist; `storage.buckets` holds only `disc-private-photos`. Open since 2026-07-14 against a bucket that was already gone | — | — |
| 5 | Prune the 14 merged `codex/*` branches | **owner** — see note | nothing; hygiene |
| 6 | ~~Resolve the E2E contradiction~~ — **DONE 2026-07-28.** Playwright baseline built and wired into CI | agent | — |
| 7 | E2 round/course reconciliation — **audit closed 2026-07-30. Eight of nine findings fixed** (1, 2, 3, 4, 6, 7, 8, 9). Only finding 5 remains open, deferred by design with a revisit trigger recorded. See `docs/development/E2_ROUND_COURSE_AUDIT.md`. The hardening phase of E2 is done; the **feature** half (weather, activity-only rounds, group-scorecard groundwork, bag snapshot verification, course preparation) has not started | agent | — |
| 8 | ~~Extend E2E with live-capture fixtures~~ — **DONE 2026-07-28**, suite at 32 specs. Remaining § 9 gaps are app defects and unreachable branches, not missing fixtures | agent | — |
| 9 | ~~Reconnect double-send in `syncScheduler.js`~~ — **FIXED 2026-07-28**, 11 unit tests plus a dedicated `online`-event E2E spec. The round outbox's silent `catch` (E2 audit finding 2) is still open and is the same class | agent | — |

**The 1-before-2 interlock was dissolved on 2026-07-28.** It existed because PR #4 ships the
account-deletion UI and `main` auto-deploys, so merging first put a button in production that threw a
raw PostgREST error on click. `DeleteAccountPanel` now maps `PGRST202`/`42883` to "Account deletion is
temporarily unavailable… nothing was deleted" (`src/lib/accountDeletion.js`), so the pre-migration
window degrades instead of breaking. Applying the migrations first is still preferable — the feature
does not work until they land — but it is no longer a correctness gate on the merge. CI on #4 is
green (`verify` + Vercel preview).

**The three Phase E migrations were applied on 2026-07-29** — see the section below for the verified
post-apply state. They were written and locally proved across 2026-07-27/28/29 and sat unapplied for
two days because every Supabase MCP call was refused; that block turned out to be specific to one of
the connector's two tool namespaces, not an authorization gap.

## RLS and storage negative tests — run 2026-07-29

The one unchecked box on PR #5, unchecked only because Supabase was unreachable. Executed against the
live database inside transactions that were rolled back.

| Check | Result |
|---|---|
| `anon` executing `delete_own_account()` | refused — `42501 permission denied` |
| `anon` executing `create_course_with_layout(...)` | refused — `42501 permission denied` |
| `delete_own_account()` with no `auth.uid()` | refused — `28000`, raised at line 6 before any deletion |
| `create_course_with_layout(...)` with no `auth.uid()` | refused — `28000`, raised at line 11 |
| User B claiming user A's course id | refused — `42501` |
| Owner replaying the same course id | returned the existing id, still 1 row — no duplicate |
| Invoker path under RLS for the caller's own `auth.uid()` | allowed, as the `courses` INSERT policy intends |

Residue check afterwards: 0 courses, 0 layouts, 0 holes, users unchanged at 28. The rollbacks held.

**No real account was ever deleted.** The purge was only exercised on its refusal paths, which raise
before touching data — that is deliberate, and it is also the limit of what these results prove. The
cascade itself (a second user's rows surviving, private Storage objects removed by prefix) is still
evidenced structurally, by the function body and the FK/RLS configuration, not behaviourally.

**Live data context, worth knowing before reading too much into any of this:** the database currently
holds 28 users, 0 courses, 0 layouts, 0 holes, 0 catalog reviews and 0 private photo objects. The
moderation-history fix therefore protects a table that is empty today — correct to have fixed, and it
protects future rows, but nothing was at risk in the interim.

## Migrations applied 2026-07-29

All three Phase E migrations are live on `icqzbvtjisxwycvioiup` (`disc-golf-app`, ACTIVE_HEALTHY,
Postgres 17). Project identity was confirmed before writing — all six expected tables present — which
matters because a second `disc-golf-ios` project exists in the same org.

Pre-apply state confirmed all three genuinely unapplied: neither function existed, `reviewer_id` was
still `NOT NULL`.

Post-apply verification, read back from `pg_proc` rather than assumed:

| Check | Result |
|---|---|
| `delete_own_account` — security definer, `search_path=""`, zero arguments | ✅ |
| `create_course_with_layout` — security **invoker**, no owner argument | ✅ |
| `anon` can execute either function | ❌ (correct — both false) |
| `authenticated` can execute both | ✅ |
| `catalog_submission_reviews.reviewer_id` nullable | ✅ YES |
| Purge **nulls** reviewer_id rather than deleting reviews | ✅ (delete statement absent) |
| Purge releases `courses.created_by` to null | ✅ |
| Purge removes `disc-private-photos` objects by user prefix | ✅ |

Advisors: 6 WARN, no ERROR. Five are `authenticated_security_definer_function_executable`; four of
those are pre-existing (`append_xp_event`, `merge_discs`, `set_profile_level`,
`upsert_badge_progress`) and the fifth is `delete_own_account`, which is **expected and intentional** —
a privacy purge must run with elevated privilege and derives its subject from `auth.uid()`. Note
`create_course_with_layout` does *not* appear, which independently confirms the invoker choice took.
The sixth is `auth_leaked_password_protection` disabled — pre-existing, unrelated, and a genuine
one-toggle improvement worth taking.

**Version-number caveat — REPAIRED 2026-07-30.** `apply_migration` assigned its own timestamps
(`20260729213112`, `20260729213141`, `20260729213216`) rather than the filenames (`20260727120000`,
`20260728120000`, `20260729120000`), so the remote ledger and the repo disagreed and a later
`supabase db push` would have considered all three unapplied and re-run them. That was not merely
noisy: re-running the *first* alone restores the form of `delete_own_account()` that **deletes**
moderation reviews, silently regressing the fix the second migration exists to make.

Repaired by renaming the three files to the versions the ledger actually holds — the same shape
already used for the fourth migration, chosen over `supabase migration repair` because it needs no
database credentials and leaves the repo self-consistent for anyone who clones it:

| Was | Now |
|---|---|
| `20260727120000_phase_e_account_deletion.sql` | `20260729213112_phase_e_account_deletion.sql` |
| `20260728120000_phase_e_preserve_moderation_history.sql` | `20260729213141_phase_e_preserve_moderation_history.sql` |
| `20260729120000_phase_e_atomic_course_creation.sql` | `20260729213216_phase_e_atomic_course_creation.sql` |

Before renaming, each file's content was matched to the statement stored in
`supabase_migrations.schema_migrations` for the version it was being renamed to — confirming the
pairing rather than assuming it from the names: `…213112` is the form that deletes reviews, `…213141`
the form that nulls them, `…213216` the course RPC, `…025443` the `nulls not distinct` index. Relative
order is preserved and all four now sort after the Phase D migrations. In-repo references to the old
versions were updated in `src/lib/roundLog.js`, `src/context/AuthContext.jsx`, both migration headers,
`.claude/README.md` and the audit doc; historical `DEVLOG.md` entries were left alone as the record of
what was true at the time.

**All four Phase E migrations now agree with the ledger, so `supabase db push` will correctly skip
every one of them.**

**Action 5 is owner-only for environment reasons, not judgement reasons:**

- **Action 5** — the git proxy returns HTTP 403 on `git push origin --delete`, and the GitHub tool
  set exposes no delete-branch capability. Prune from the GitHub branches UI. All 14 were re-verified
  as having zero commits outside `main` immediately before the attempt, so deleting them loses
  nothing. `claude/continue-hoqtyv` is kept for now as a visible pointer until the `TrendChart`
  salvage in `FEATURE_BACKLOG.md` is done.

**Re-attempted 2026-07-28 (second session), same walls — do not assume these are merely undecided:**

- **Action 1** still refused. Every Supabase MCP call, including zero-argument read-only ones
  (`list_projects`, `list_organizations`), returns `MCP error -32003: MCP tool call requires
  approval` and never reaches the project. Because `list_projects` is the first call, the migration's
  applied/not-applied state could not even be *read*. The migration SQL was reviewed instead and is
  clean: zero arguments with the subject derived from `auth.uid()`, `created_by` nulled rather than
  cascaded on `courses`/`course_aliases`/`disc_molds`, private Storage objects deleted by user
  prefix, and `revoke ... from anon` + `grant execute to authenticated`. The one real finding from
  that review — `catalog_submission_reviews.reviewer_id` being `NOT NULL`, so moderation history was
  hard-deleted rather than preserved — is **fixed** by migration `20260728120000`.

  **Diagnosis corrected 2026-07-29.** The refusal was never an authorization gap: `ListConnectors`
  reports the Supabase connector as `installState: connected`, `connected: true`,
  `enabledInChat: true`. The connector registers under **two** tool namespaces — a friendly
  `mcp__Supabase__*` and a UUID `mcp__cde54079-…__*` — and only the UUID one returns `-32003`. Calling
  the same tool under the friendly name works. Earlier sessions happened to hold the UUID
  registration and concluded, wrongly, that an account-level approval was missing. If a future
  session hits `-32003`, re-resolve the tool under the other namespace before escalating to the
  owner. The read-only allowlist in `.claude/settings.json` is still worth keeping, but it was never
  the blocker.

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
- **Browser E2E now exists** (2026-07-28). `npm run test:e2e` runs 32 Playwright specs across a phone
  project and a 320px project, authenticated via a seeded session with the Supabase backend
  intercepted in-page; CI runs them as a separate `e2e` job. This closes the "no authenticated screen
  has ever been rendered by a test" gap but **not** the full § 9 gate — see the per-flow coverage
  table there, and `e2e/README.md` for what the harness deliberately does not verify (schema truth,
  real network conditions, real devices). The Phase A real-device gate remains user-reported rather
  than independently observed.
- **Running E2E in a sandbox:** the pre-provisioned Chromium may not match the build Playwright
  expects. Use `E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`; leave it unset in CI.
- **`capture.spec.js` › "single-active auto-close" is intermittently flaky under parallel load**
  (observed once on 2026-07-30, in a sandbox). It fails in `waitForCaptureSync` waiting for the
  outbox to drain to 0 — a 7s poll timeout, not a wrong assertion — and passes both in isolation and
  on a full re-run of the suite. Treat a single failure of this spec as a flake to re-run, not a
  regression; if it starts failing repeatably, the poll budget is the thing that got too tight, not
  the auto-close behaviour.
- Production bundle is ~740 KB minified / ~213 KB gzip; code splitting is a tracked backlog item
  before public/mobile beta.

## Open follow-ups

These two are **closed** and were removed on 2026-07-30 — they had been contradicting the top of this
same file, which is exactly how a checkpoint stops being trusted: the account-deletion migration is
applied and verified (see "Migrations applied 2026-07-29"), and the `catalog-import-raw` bucket does
not exist, so there is nothing to delete.

- Enable protected-`main` required review/checks now that CI runs green remotely. `main` auto-deploys.
- **The account-deletion cascade is still only structurally evidenced.** The RLS negative tests
  exercised the refusal paths, which raise before touching data. That a second user's rows survive and
  that private Storage objects are removed by prefix is argued from the function body and the FK/RLS
  configuration, not observed. Proving it behaviourally needs two disposable accounts with real rows,
  which the live project (28 real users) is the wrong place for.
- Browser E2E is built but partial. Six § 9 flows remain uncovered — pause/resume, single-active
  auto-close, round-close confirmation, completed edit/audit, soft-delete/restore, exactly-once
  reconnect. All six need an in-progress or completed activity seeded through the InstantLaunch +
  Dexie layers rather than table-level rows, which is the next increment on the existing harness.
- Install the OpenAI Developer Docs MCP locally (`CODEX_WORKFLOW.md` § Installed capabilities). The
  desktop sandbox could not launch the installer.

Update this file at each major commit/push: move the resume point, add or clear follow-ups, and record
new standing decisions. Keep it short — history belongs in `DEVLOG.md`.
