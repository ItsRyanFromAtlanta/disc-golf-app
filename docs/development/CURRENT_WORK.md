# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A8 Sol checkpoint complete — the history/recovery RPC migration is applied and
  live-verified, and the versioned metric eligibility/capture registry is tested. Hide/restore and
  practice notes/tags correction enforce owner, version, source, idempotency, and append-only audit
  contracts without changing typed sporting facts.
- **Next implementation:** Switch to GPT-5.6 Terra at medium effort for the A8 client slice: local
  hide/restore/correction outbox, unified activity history, sync/incomplete badges, Recently Deleted,
  metric filtering/recalculation, and detail editing through the audited RPC.
- **Database state:** A5/A6/A8 activity migrations are applied. Future migration/FK work still requires
  fresh backup confirmation; no further A8 schema work is planned.
- **Verification for this checkpoint:** 315 unit tests pass; live rollback tests cover positive,
  idempotent, stale, invalid, cross-user, and collision cases with zero residue. Anonymous RPC execution
  and authenticated direct activity/audit DML are denied. Advisors have no new A8 findings; lint retains
  only four pre-existing warnings and the production build passes.
- **Context recommendation:** continue A8 with `AGENTS.md`, this file, `PHASE_A_ARCHITECTURE.md`,
  `docs/operations/PHASE_A_ACTIVITY_MIGRATION.md`, the A4/A7 repositories, and the Supabase skill.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
