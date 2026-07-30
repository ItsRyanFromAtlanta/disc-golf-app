# Architecture Decision Records

Create an ADR for a durable choice that affects multiple features, data compatibility, security,
deployment, or native architecture. Do not create ADRs for routine component details.

Filename: `NNNN-short-title.md`.

```markdown
# NNNN — Title
Status: proposed | accepted | superseded
Date: YYYY-MM-DD

## Context
## Decision
## Consequences
## Alternatives considered
## Supersedes / superseded by
```

## Accepted ADRs

| ADR | Decision | Date |
|---|---|---|
| [0001](0001-live-round-interaction-model.md) | Live round scoring interaction model — structured scorecard is the sole primary capture surface | 2026-07-29 |
| [0002](0002-group-and-league-scope.md) | Group and league scope — schema-shaped groundwork in v1, no group UI and no RLS widening | 2026-07-29 |
| [0003](0003-native-capability-timeline.md) | Native GPS/camera timeline — stay PWA-first, with four normative reopening triggers | 2026-07-29 |

These three closed the whole of `AGENTS.md` § Not yet decided, which now points here instead of listing
open questions. Reopening any of them means flipping that ADR's `Status` to `superseded` and writing the
replacement — not editing `AGENTS.md`.

Phase A's durable contracts still live in `PHASE_A_ARCHITECTURE.md`; split further ones out into ADRs
here when their implementation begins or when a decision changes.
