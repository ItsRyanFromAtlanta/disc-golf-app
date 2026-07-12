# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A5 complete — the live Supabase schema/RLS/index/test-data audit passed, the
  manual backup was confirmed, and an unapplied activity-envelope migration plus recovery packet now
  await A6 review. Dexie v2 continues to store local activities, append-only state events,
  and ordered diagnostic lifecycle operations. The repository enforces one current activity per user,
  atomic practice replacement, explicit round confirmation, idempotent retries, and full rollback.
  InstantLaunch v1 state upgrades losslessly; its tested bridge remains unwired until A7.
- **Next implementation:** Session A6 only — review the unapplied migration and recovery packet, then
  add serialized lifecycle RPCs, ownership/forgery/concurrency/retry tests, and advisor verification.
- **Database state:** no Phase A expansion migration has been applied. The backup gate remains required
  before A6 applies any migration or FK change.
- **Verification for this checkpoint:** 304 unit tests pass, including 34 focused A4 tests against real
  Dexie semantics through `fake-indexeddb`; lint has only the four pre-existing warnings; production
  build passes. No Supabase migration or protected-shell UI changed.
- **Context recommendation:** start A6 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, `docs/operations/PHASE_A_ACTIVITY_MIGRATION.md`, the unapplied migration,
  and the Supabase skills. Re-confirm the backup before migration/FK work; do not replay the
  implementation conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
