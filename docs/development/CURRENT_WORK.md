# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase A — production baseline and shared contracts.
- **Approved:** complete Phase A shell/navigation, lifecycle, notification, scrolling/sheets,
  accessibility, repository/transaction, migration-order, test-gate, and A1–A10 walkthrough.
- **Current checkpoint:** A1 complete — audited the shipped shell/routes/scroll/recovery behavior and
  added the pure, tested `src/lib/routeMetadata.js` contract. The rendered shell remains unchanged.
- **Next implementation:** Session A2 only — implement the shared shell from the approved metadata:
  GlobalHeader, ScreenScrollRegion, SheetHost, ToastHost, PLAY/DISCS/ME TabBar, safe areas, and tab
  scroll/root behavior. Preserve current routes through compatibility wrappers.
- **Database state:** no Phase A expansion migration has been run; backup confirmation is required before
  any future migration.
- **Verification for this checkpoint:** 20 focused route/navigation/crash-recovery tests passed; lint
  has only the four pre-existing warnings; production build passed. Application behavior is unchanged.
- **Context recommendation:** start A2 in a fresh task with `AGENTS.md`, this file,
  `PHASE_A_ARCHITECTURE.md`, `src/lib/routeMetadata.js`, and a Graphify query; do not replay the
  planning conversation.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
