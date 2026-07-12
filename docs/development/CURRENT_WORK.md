# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A8 complete. The live-verified recovery RPCs and versioned metric registry are
  connected to a Dexie v3 audited recovery outbox, canonical activity history, sync/incomplete badges,
  Recently Deleted restore, hidden-row metric exclusion, and audited detail correction. Typed sporting
  facts remain unchanged and local-only activities never invent putt totals.
- **Next implementation:** A9 notifications. Use GPT-5.6 Terra at medium effort for the normal
  persistence/bell/overlay/deep-link UI work; escalate only the notification deduplication and delivery
  contract review if it develops synchronization or security complexity.
- **Database state:** A5/A6/A8 activity migrations are applied. Future migration/FK work still requires
  fresh backup confirmation; no further A8 schema work is planned.
- **Verification for this checkpoint:** 324 unit tests pass; live rollback tests cover positive,
  idempotent, stale, invalid, cross-user, and collision cases with zero residue. Anonymous RPC execution
  and authenticated direct activity/audit DML are denied. Advisors have no new A8 findings; lint retains
  only four pre-existing warnings and the production build passes. Browser verification now runs with
  `agent-browser`: the landing page and both A8 history URLs are non-blank and error-overlay-free, and
  unauthenticated history navigation correctly redirects to login. This local Supabase project rejects
  anonymous sign-in, so authenticated history-content interaction still needs a valid test session.
- **Context recommendation:** start A9 with `AGENTS.md`, this file, `PHASE_A_ARCHITECTURE.md`, and the
  notification contracts identified in the Phase A plan.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
