# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A7 complete — freeform and regimen practice now mirror their stable parent UUID
  into the local activity repository, finalize locally on completion/abandon, and flush lifecycle RPCs
  before typed parent, summary, or gesture rows. A stable installation ID, route-aware pause/resume,
  active shell pill, and PLAY resume card are wired without changing InstantLaunch capture ownership.
- **Next implementation:** Session A8 — history and recovery (incomplete/hidden/sync states,
  correction provenance, metric exclusion/recalculation, and restore).
- **Database state:** Phase A activity migrations are applied. Future migration/FK work still requires a
  fresh backup confirmation.
- **Verification for this checkpoint:** 310 unit tests pass, including focused lifecycle RPC mapping,
  ordered outbox, installation-ID, and real Dexie repository tests; lint has only the four pre-existing
  warnings; production build passes. No new Supabase migration was required.
- **Context recommendation:** start A8 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, `docs/operations/PHASE_A_ACTIVITY_MIGRATION.md`, the A4 repository, and
  the Supabase skills. Re-confirm the backup before any new migration/FK work; do not replay the
  implementation conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
