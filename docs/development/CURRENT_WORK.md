# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A4 complete — Dexie v2 now stores local activities, append-only state events,
  and ordered diagnostic lifecycle operations. The repository enforces one current activity per user,
  atomic practice replacement, explicit round confirmation, idempotent retries, and full rollback.
  InstantLaunch v1 state upgrades losslessly; its tested bridge remains unwired until A7.
- **Next implementation:** Session A5 only — confirm a fresh manual Supabase backup, audit the live
  schema/RLS/indexes/test data, and design the append-only activity migration plus recovery notes for
  review. Do not apply migration SQL in A5.
- **Database state:** no Phase A expansion migration has been run; backup confirmation is required before
  any future migration.
- **Verification for this checkpoint:** 304 unit tests pass, including 34 focused A4 tests against real
  Dexie semantics through `fake-indexeddb`; lint has only the four pre-existing warnings; production
  build passes. No Supabase migration or protected-shell UI changed.
- **Context recommendation:** start A5 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, and the Supabase skills. Confirm the manual backup before migration/FK work,
  audit live state before drafting SQL, and do not replay the implementation conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
