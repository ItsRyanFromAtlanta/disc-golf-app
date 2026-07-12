# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A6 complete — the A5 envelope/backfill, A6 lifecycle RPCs, and FK-index follow-up
  are applied and verified in Supabase. Live negative, RLS, retry, replacement, and concurrent-start
  checks pass. Dexie v2 continues to store local activities, append-only state events,
  and ordered diagnostic lifecycle operations. The repository enforces one current activity per user,
  atomic practice replacement, explicit round confirmation, idempotent retries, and full rollback.
  InstantLaunch v1 state upgrades losslessly; its tested bridge remains unwired until A7.
- **Next implementation:** Session A7 only — integrate the activity repository with freeform practice first,
  then regimen, while preserving gesture-event versus batch-summary ownership and offline recovery.
- **Database state:** Phase A activity migrations are applied. Future migration/FK work still requires a
  fresh backup confirmation.
- **Verification for this checkpoint:** 304 unit tests pass, including 34 focused A4 tests against real
  Dexie semantics through `fake-indexeddb`; lint has only the four pre-existing warnings; production
  build passes. No Supabase migration or protected-shell UI changed.
- **Context recommendation:** start A7 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, `docs/operations/PHASE_A_ACTIVITY_MIGRATION.md`, the A4 repository, and
  the Supabase skills. Re-confirm the backup before any new migration/FK work; do not replay the
  implementation conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
