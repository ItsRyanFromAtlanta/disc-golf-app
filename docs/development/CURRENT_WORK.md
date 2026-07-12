# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A2 complete — shared shell now uses the A1 route contract: standard/active
  shells, header, scroll host, sheets/toasts, PLAY/DISCS/ME navigation, safe areas, and tab behavior.
  Existing URLs remain compatible.
- **Next implementation:** Session A3 only — define and test the pure local activity lifecycle types,
  transition table/reducer, source/reason constants, and tunable policy constants. No Dexie or database
  migration in A3.
- **Database state:** no Phase A expansion migration has been run; backup confirmation is required before
  any future migration.
- **Verification for this checkpoint:** 248 unit tests passed; lint has only the four pre-existing
  warnings; production build passed; local browser smoke check had content, no overlay, and no console
  errors. Anonymous auth is disabled, so protected-shell visual/device testing remains outstanding.
- **Context recommendation:** start A3 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, and a Graphify query for InstantLaunch state/FSM modules. Do not replay the
  planning conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
