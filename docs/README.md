# Engineering Documentation

Root documents remain the concise product and execution authorities. This directory contains operating
detail that should not inflate normal coding context.

## Development

- [CURRENT_WORK.md](development/CURRENT_WORK.md) — restart/handoff checkpoint.
- [CODE_REVIEW.md](development/CODE_REVIEW.md) — risk-based review cadence.
- [CONTEXT_EFFICIENCY.md](development/CONTEXT_EFFICIENCY.md) — token, tools, and fresh-task guidance.
- [INTEGRATIONS.md](development/INTEGRATIONS.md) — Graphify, RTK, Composio, MCP, and plugin policy.
- [TESTING_STRATEGY.md](development/TESTING_STRATEGY.md) — test pyramid and field verification.

## Operations

- [ENVIRONMENTS.md](operations/ENVIRONMENTS.md) — local, preview, and production separation.
- [RELEASE_CHECKLIST.md](operations/RELEASE_CHECKLIST.md) — web/PWA/native release gates.
- [BACKUP_RESTORE.md](operations/BACKUP_RESTORE.md) — database and user-state recovery rules.
- [INCIDENT_RESPONSE.md](operations/INCIDENT_RESPONSE.md) — severity and response workflow.

## Mobile

- [IOS_READINESS.md](mobile/IOS_READINESS.md) — Capacitor and App Store preparation.
- [FIELD_TESTING.md](mobile/FIELD_TESTING.md) — sunlight, one-thumb, offline, and device testing.

## UI

Screen-level documentation. Start at the README; screen **status** lives only in `SCREEN_INVENTORY.md`.

- [README.md](ui/README.md) — index, authority chain, and authoring rules for the screen documents.
- [SCREEN_INVENTORY.md](ui/SCREEN_INVENTORY.md) — canonical route → component → document → status table.
- [NAVIGATION_MAP.md](ui/NAVIGATION_MAP.md) — shell, route tree, sheet layer, guards, deep links.
- [STATE_MATRIX.md](ui/STATE_MATRIX.md) — cross-cutting states, current behavior against contract.
- [COMPONENT_LIBRARY.md](ui/COMPONENT_LIBRARY.md) — every component in `src/components/`, props and usage.
- [LIB_API_INDEX.md](ui/LIB_API_INDEX.md) — exported API surface of `src/lib/` and `src/hooks/`.
- [COPY_AND_TERMINOLOGY.md](ui/COPY_AND_TERMINOLOGY.md) — user-facing strings, grouped, conflicts flagged.
- [DEFECT_REGISTER.md](ui/DEFECT_REGISTER.md) — code defects found by the documentation pass, as tracked work.
- [EXECUTION_PLAN.md](ui/EXECUTION_PLAN.md) — sequencing for that registered work.
- [TEST_MAP.md](ui/TEST_MAP.md) — screen-to-test coverage and the E2E backlog.
- [TEMPLATE.md](ui/TEMPLATE.md) / [TASK_FORMAT.md](ui/TASK_FORMAT.md) — authoring and task conventions.
- [CORRECTIONS_LEDGER.md](ui/CORRECTIONS_LEDGER.md) — disposition of every quarantined correction.
- [screens/](ui/screens/) — one document per screen.

## Decisions

- [ADR index](decisions/README.md) — durable architecture decisions and template.
- Accepted: [0001 live-round interaction model](decisions/0001-live-round-interaction-model.md),
  [0002 group and league scope](decisions/0002-group-and-league-scope.md),
  [0003 native capability timeline](decisions/0003-native-capability-timeline.md).

## Archive

Superseded documents kept for the reasoning trail. Each carries a HISTORICAL header and is never an
authority for current work.

- [TASK_BRIEFS_2.2.md](archive/TASK_BRIEFS_2.2.md) — shipped 2.2a/2.2b/2.2c briefs (pre-Codex).
- [theme-spec-source.md](archive/theme-spec-source.md) — original Sun-Drenched Topo spec source.
- [screen-inventory-ideation.md](archive/screen-inventory-ideation.md) — pre-blueprint feature ideation.
