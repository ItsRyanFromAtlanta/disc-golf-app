# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A6 implementation draft — the live Supabase schema/RLS baseline was rechecked,
  the approved RPC design is implemented in a second unapplied migration, and the negative/concurrency
  test gate is documented. Dexie v2 continues to store local activities, append-only state events,
  and ordered diagnostic lifecycle operations. The repository enforces one current activity per user,
  atomic practice replacement, explicit round confirmation, idempotent retries, and full rollback.
  InstantLaunch v1 state upgrades losslessly; its tested bridge remains unwired until A7.
- **Next implementation:** Finish Session A6 — reconfirm a fresh backup, apply the A5 and A6 migrations,
  run the authenticated negative/concurrency/retry suite and Supabase advisors, then update this handoff.
- **Database state:** no Phase A expansion migration has been applied. The backup gate remains required
  before applying either migration or opening lifecycle RPC writes.
- **Verification for this checkpoint:** 304 unit tests pass, including 34 focused A4 tests against real
  Dexie semantics through `fake-indexeddb`; lint has only the four pre-existing warnings; production
  build passes. No Supabase migration or protected-shell UI changed.
- **Context recommendation:** resume A6 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, `docs/operations/PHASE_A_ACTIVITY_MIGRATION.md`, both unapplied migrations,
  and the Supabase skills. Re-confirm the backup before migration/FK work; do not replay the
  implementation conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
