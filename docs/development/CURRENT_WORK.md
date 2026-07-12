# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A10 implementation in progress. The notification contract now has an append-only
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
- **Current implementation:** A10 equivalence and release gates. GPT-5.6 Sol at high reasoning is confirmed
  for the synchronization, crash/reload, and release-contract work.
- **Database state:** A5/A6/A8/A9 activity and notification migrations are applied. Fresh Supabase checks
  confirm `notifications` has RLS, authenticated read access, and only authenticated/service-role RPC
  execution. Future migration/FK work still requires
  fresh backup confirmation; A10’s notification activity-owner covering index is applied.
- **Verification for this checkpoint:** 333 unit tests pass; live rollback tests cover positive,
  idempotent, stale, invalid, cross-user, and collision cases with zero residue. Anonymous RPC execution
  and authenticated direct activity/audit DML are denied. Advisors have no new A8 findings; lint retains
  only four pre-existing warnings and the production build passes. A10 adds five equivalence tests; the
  full suite now passes 333 tests. Browser verification now runs with
  `agent-browser`: the landing page and both A8 history URLs are non-blank and error-overlay-free, and
  unauthenticated history navigation correctly redirects to login. The signed-in browser smoke also covers
  the PLAY shell, freeform completion, notification sheet, direct `/notifications` route, and reload/session
  persistence. Cross-device authenticated history/content
  interaction still needs a second independent session; do not treat one browser session as that proof.
- **Context recommendation:** continue A10 with `AGENTS.md`, this file, `PHASE_A_ARCHITECTURE.md`, and
  the release checklist. The next gate is the remaining independent-session/release review, not more UI work.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
