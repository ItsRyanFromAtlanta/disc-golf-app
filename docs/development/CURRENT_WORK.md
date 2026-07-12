# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A3 complete — the pure `src/lib/activityLifecycle/` engine defines canonical
  states/types/sources/reasons, named policies, an optimistic-concurrency-aware reducer and append-only
  state-event result, plus practice-replacement and round-confirmation planning. No persistence changed.
- **Next implementation:** Session A4 only — design and implement the transactional Dexie activity,
  state-event, and dependent-outbox repository plus the InstantLaunch bridge. Preserve proven capture
  and enforce the single-active invariant locally. Review the A3 transition table before repository work.
- **Database state:** no Phase A expansion migration has been run; backup confirmation is required before
  any future migration.
- **Verification for this checkpoint:** 280 unit tests passed; lint has only the four pre-existing
  warnings; production build passed. A3 is pure and has no new browser/device verification surface.
- **Context recommendation:** start A4 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, and Graphify queries for `activityLifecycle`, Dexie repositories, and
  InstantLaunch state/outbox modules. Do not replay the planning conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
