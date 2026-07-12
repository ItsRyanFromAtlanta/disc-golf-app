# Codex Workflow and Token-Efficiency Guide

Last updated: 2026-07-11

## Model policy

- **GPT-5.3-Codex, medium reasoning:** default for React/UI/CRUD, focused refactors, tests, and routine
  repository work.
- **GPT-5.6, high reasoning:** architecture, migrations, RLS/security, lifecycle and synchronization
  contracts, rules engines, complex analytics, and final high-risk review.
- **GPT-5.4 mini, low reasoning:** optional for tightly bounded mechanical edits when available; always
  run the normal verification suite afterward.
- Use `xhigh` only for a demonstrated hard problem, not as a default. Prefer raising reasoning for one
  bounded task rather than an entire long thread.

OpenAI currently recommends GPT-5.6 for complex reasoning/coding and lists GPT-5.3-Codex as its
specialized agentic coding model. Re-check the official model catalog before changing these defaults.

## Thread discipline

1. One implementation checkpoint per task: design → edit → focused tests → full relevant tests → docs.
2. Start a fresh task when moving between architecture, migration, UI, and deployment phases; link the
   authoritative spec instead of replaying the full conversation.
3. Read `AGENTS.md`, `PRODUCT_ROADMAP.md`, and only the relevant spec section. Use `rg` to locate code;
   do not load large files unless needed.
4. Prefer focused commands and bounded output. Do not dump whole generated files or logs into context.
5. Keep plans short (normally 3–6 steps) and update only when state changes.
6. Run the narrowest useful test first; run `npm test`/`npm run build` at checkpoints, not after every
   line edit.
7. Preserve historical docs. Update current authorities and add one concise DEVLOG entry.

## Useful commands

```powershell
rg --files -g '!node_modules' -g '!dist'
rg -n "search term" src *.md *.sql
npm test -- --run src/lib/path/to/file.test.js
npm test
npm run lint
npm run build
git diff --check
git status --short
git diff --stat
```

After Playwright is approved and installed:

```powershell
npx playwright test
npx playwright test e2e/activity-lifecycle.spec.js
npx playwright test --ui
```

## Project Codex configuration

The project `.codex/config.toml` uses concise reasoning summaries, low response verbosity, and a bounded
per-tool history budget. Keep the selected model user/thread-controlled so unavailable project-local
model slugs never block startup.

For one-off overrides in the CLI:

```powershell
codex --model gpt-5.3-codex --config model_reasoning_effort="medium"
codex --model gpt-5.6 --config model_reasoning_effort="high"
```

## Installed capabilities

- Project Supabase MCP: configured in `.codex/config.toml`.
- GitHub, browser automation, Vercel, OpenAI developer, and visualization capabilities: available in
  the Codex desktop environment.
- Do not install duplicate plugins merely because a task mentions those services.

Useful missing integration: official OpenAI Developer Docs MCP. The desktop sandbox could not launch
the `codex.exe` installer command. Run once in a normal PowerShell session, then restart Codex:

```powershell
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
```

Playwright is a project dev dependency, not a Codex plugin. Install only at the Phase A browser-E2E
checkpoint so the dependency change and first working test land together.

## Token-saving settings

- Default reasoning `medium`; raise to `high` per high-risk task.
- Low output verbosity and concise reasoning summaries.
- Bounded tool history output; request targeted line ranges or filtered logs.
- Leave model context/compaction thresholds at model defaults unless real sessions show premature or
  delayed compaction. Incorrect manual limits can waste context or truncate useful work.
- Keep web-search context low unless research quality requires more.
- Disable unused skills/plugins only if tool discovery becomes noisy; installed-but-unused plugins do
  not justify per-project churn.

Detailed fresh-task triggers, Graphify/RTK/Composio policy, and review cadence now live under
`docs/development/` so normal coding tasks do not need to load them.
