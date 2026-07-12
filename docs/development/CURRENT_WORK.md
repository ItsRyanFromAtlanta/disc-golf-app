# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase B — DISCS data foundation.
- **Approved:** Phase A shell/navigation, lifecycle, notification, scrolling/sheets, accessibility,
  repository/transaction, migration-order, test-gate, and A1–A10 walkthrough are complete.
- **Current checkpoint:** B1.5 catalog foundation is applied and verified. The normalized manufacturer,
  mold/plastic, run, stamp, provenance, import, private-configuration, and submission/review tables are
  live with RLS and least-privilege grants. Four manufacturers backfill all 36 molds with zero unlinked
  rows. Rollback-only tests passed authenticated canonical reads, denied canonical writes, owner CRUD,
  cross-user isolation, one-way submission, and post-submission immutability. Three advisor follow-up
  migrations cover every new composite FK. A10 release-candidate gates remain complete. The notification contract now has an append-only
  applied migration, Dexie v4 mirror, durable local outbox adapter, deterministic activity/sync producers,
  and bell sheet/deep-link UI. Browser verification confirms the non-blank landing shell and protected
  `/notifications` redirect to login without an error overlay. The signed-in PLAY shell, practice session
  completion, notification bell, notification sheet, direct `/notifications` route, and reload persistence
  have now been exercised successfully. Live rollback
  checks also confirm anon RPC denial and authenticated-without-JWT rejection with zero residue. True
  cross-device identity verification remains deferred because this task has one signed-in browser session.
  A8 remains complete: the live-verified recovery RPCs and versioned metric registry are
  connected to a Dexie v3 audited recovery outbox, canonical activity history, sync/incomplete badges,
  Recently Deleted restore, hidden-row metric exclusion, and audited detail correction. Typed sporting
  facts remain unchanged and local-only activities never invent putt totals.
- **Current implementation:** Phase B B1.6 repositories and manufacturer-adapter contract is next.
  GPT-5.6 Terra high is recommended for implementation; Sol high remains the review model for security,
  migration, and normalization decisions.
- **Database state:** A5/A6/A8/A9 activity/notification and B1.5 catalog migrations are applied. Fresh Supabase checks
  confirm `notifications` has RLS, authenticated read access, and only authenticated/service-role RPC
  execution. B1 uses automated CLI-first/`pg_dump` backup with a non-blocking reminder fallback;
  A10’s notification activity-owner covering index is applied.
- **Verification for this checkpoint:** 333 unit tests pass; live rollback tests cover positive,
  idempotent, stale, invalid, cross-user, and collision cases with zero residue. Anonymous RPC execution
  and authenticated direct activity/audit DML are denied. Advisors have no new A8 findings; lint retains
  only four pre-existing warnings and the production build passes. A10 adds five equivalence tests; the
  full suite now passes 333 tests. Browser verification now runs with
  `agent-browser`: the landing page and both A8 history URLs are non-blank and error-overlay-free, and
  unauthenticated history navigation correctly redirects to login. The signed-in browser smoke also covers
  the PLAY shell, freeform completion, notification sheet, direct `/notifications` route, and reload/session
  persistence. Cross-device authenticated history/content
  interaction was also reported passed by the user in a separate independent session/device. This is
  user-reported evidence; Codex did not directly observe the second session or collect its device metadata.
- **Context recommendation:** continue with B1.6 repository and adapter contracts. The verified pre-apply
  archive for B1.5 is outside Git at `C:\tmp\disc-golf-app-backups\20260712-190157`.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
