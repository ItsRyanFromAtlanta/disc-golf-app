# Contributing

## Change flow

1. Read `AGENTS.md`, `PRODUCT_ROADMAP.md`, and only the relevant detailed spec.
2. For implementation, work on `codex/<short-topic>` (or another approved feature branch).
3. Agree on behavior before schema, navigation, or public-contract changes.
4. Keep each commit self-contained: implementation, focused tests, and affected docs together.
5. Run the narrow verification first, then `npm test`, `npm run lint`, and `npm run build` at the
   checkpoint appropriate to the risk.
6. Push after a coherent green checkpoint. Open a pull request for review; merge to `main` only after
   required checks and review gates pass.
7. Update `DEVLOG.md`, the roadmap/backlog status, and `docs/development/CURRENT_WORK.md`.

## Review gates

- **Every commit:** author self-review of the complete diff, tests, data handling, accessibility, and
  documentation impact.
- **Focused implementation review:** after each coherent feature slice, and before committing a broad
  refactor, offline/sync change, navigation change, or change spanning several components.
- **High-risk design + code review:** before and after migrations, RLS/auth, storage/privacy, destructive
  operations, metric/rules engines, import/deduplication, AI data flows, and release configuration.
- **UI review:** browser automation plus mobile viewport/accessibility review after a screen flow is
  functional; real-device field review for active-play interactions.
- **Release review:** full tests/lint/build, migration and rollback check, privacy/security checklist,
  documentation reconciliation, and smoke test of the deploy candidate.

Prefer small pull requests with one logical purpose. Separate mechanical refactors from behavior
changes unless separation would make the change unsafe.

## Database rule

Schema history is append-only. Confirm a manual Supabase backup exists before any migration or foreign-
key restructuring. Never run production migration SQL merely to validate a draft.

## Commit and push policy

- Commit at working checkpoints; do not wait for an entire multi-phase initiative.
- Push after major changes and completed stages once their review gate is green.
- Do not bundle unrelated dirty-worktree changes.
- Because `main` auto-deploys, prefer reviewed branches and protected-branch checks over routine direct
  pushes.
