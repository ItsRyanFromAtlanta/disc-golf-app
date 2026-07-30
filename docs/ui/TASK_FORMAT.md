# Task Format

How the **Tasks** section of a screen document is written, so that a document is executable rather than
merely descriptive.

## Task anatomy

Every task is one line of heading plus four fields. Nothing else.

```markdown
#### T-<screen-id>-<n> — <imperative summary>

- **Capability:** <tag>
- **Touches:** <files, repo-relative>
- **Done when:** <observable outcome, not "implemented">
- **Verify:** <exact command or manual step>
- **Commit:** <commit message subject this task lands under>
```

Rules:

- **One commit boundary per task.** If a task cannot land as a single green commit, it is two tasks.
  The repo commits at every working checkpoint (`AGENTS.md` § Documentation conventions); tasks inherit
  that granularity.
- **"Done when" is observable.** "Disc detail renders the wear slider" is observable. "Wear slider
  implemented" is not.
- **"Verify" is executable or explicitly manual.** A task whose only verification is "looks right"
  must say so, and should carry the `field-verify` capability.
- **No vendor model names in tasks.** Use a capability tag; the mapping table below is the single place
  that knows which model serves which capability.

## Capability tags

| Tag | Work it covers | Care level |
|---|---|---|
| `ui-routine` | Component work, layout, CRUD forms, styling against existing tokens | Normal |
| `ui-interaction` | Gesture/tap input, haptics, audio, focus management, animation timing | Elevated — field-critical, hard to unit test |
| `pure-logic` | Pure functions: scoring, stats, filtering, derivations. Unit-testable in isolation | Normal, but always test-first |
| `data-access` | Repository/query work, Dexie transactions, TanStack wiring, outbox | Elevated — transaction contract applies |
| `schema` | Migrations, columns, constraints, indexes | Highest — append-only, rollback notes, negative tests |
| `security` | RLS policies, grants, auth flows, account deletion, export scope | Highest — negative tests mandatory |
| `sync` | Offline transitions, conflict handling, idempotency, replay | Highest — hardest failures to reproduce |
| `docs` | Documentation, inventories, corrections | Normal |
| `field-verify` | Real-device or sunlight/one-thumb verification. Cannot be automated | Owner-executed |

## Capability → model

The only place vendor models are named. Update here when model policy changes; screen documents never
need editing.

| Capability | Codex session | Claude session |
|---|---|---|
| `ui-routine`, `docs` | GPT-5.3-Codex medium | Sonnet 5 |
| `pure-logic` | GPT-5.3-Codex medium, test-first | Sonnet 5, test-first |
| `ui-interaction` | GPT-5.6 high | Opus 5 |
| `data-access` | GPT-5.6 high | Opus 5 |
| `schema`, `security`, `sync` | GPT-5.6 high | Opus 5 |
| `field-verify` | — owner, on device | — owner, on device |

This table restates `AGENTS.md` § Documentation conventions' model policy in capability terms. Where the
two disagree, `AGENTS.md` wins and this table is the correction to file.

## Verification commands

| Command | Covers | Note |
|---|---|---|
| `npm test` | 74 vitest files | Needs Supabase placeholders exported or 13 files fail at import — a known baseline, not a regression. Locally: `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test` |
| `npm run lint` | oxlint | Carries four known pre-existing warnings — three hook-dependency, one Fast Refresh export |
| `npm run build` | Vite production build | Bundle is ~740 KB minified / ~213 KB gzip; code splitting is a tracked backlog item |
| `npm run dev` | Local dev server | For manual verification steps |

CI (`.github/workflows/ci.yml`) runs test → lint → build on every pull request, with the placeholders
set inline. A task is not done until the commands in its **Verify** field pass locally.

There is **no automated browser E2E suite.** `PHASE_A_ARCHITECTURE.md` § 9 requires one and it was never
built. Tasks must not claim E2E verification; per-screen E2E critical paths accumulate in the Tests
section of each screen document and in `TEST_MAP.md`.

## Ordering

Tasks within a screen document are ordered by dependency, not importance. A task may depend on a task in
another screen document — reference it by full id (`T-disc-detail-3`). A task may depend on a
`Proposed` ADR; say so, and do not schedule it ahead of the decision.

## Worked example

```markdown
#### T-course-detail-2 — Render layout list from courseLayouts

- **Capability:** ui-routine
- **Touches:** `src/pages/CourseDetailPage.jsx`
- **Done when:** A course with three layouts renders three rows, each showing name, hole count, and
  par; a course with none renders the empty state from STATE_MATRIX S-EMPTY.
- **Verify:** `npm test` (adds `CourseDetailPage.test.jsx` cases) plus manual check at
  `/courses/<id>` with the seeded test account.
- **Commit:** `feat: render course layout list`
```
