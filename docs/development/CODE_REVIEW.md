# Code Review Standard

## Cadence

| Gate | When | Required scope |
|---|---|---|
| Self-review | Before every checkpoint commit | Entire diff, tests, errors, accessibility, docs |
| Slice review | Each completed feature/user flow | Behavior, maintainability, offline/error paths |
| Architecture review | Before contracts/schema/navigation change | Alternatives, migration, compatibility, rollback |
| Security/data review | Auth, RLS, storage, imports, privacy, AI | Threats, least privilege, provenance, negative tests |
| Release review | Before merge/deploy | Full checks, smoke test, release/privacy docs |

Review every changed line, but optimize for code health rather than theoretical perfection. Changes
should be small enough to understand as one unit and include their tests. Use a follow-up issue only for
non-blocking work, and record postponed product work in `FEATURE_BACKLOG.md` or `PRODUCT_ROADMAP.md`.

## Severity

- **Blocker:** security/privacy/data loss, broken core flow, invalid migration, or unrecoverable sync.
- **Required:** correctness, accessibility, maintainability, tests, or contract mismatch.
- **Suggestion:** worthwhile improvement that does not block the checkpoint.

## Review commands

```powershell
git diff --check
git diff --stat
git diff -- src relevant-file
npm test
npm run lint
npm run build
```
