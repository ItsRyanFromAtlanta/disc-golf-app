# Development Integrations

## Current

- **Supabase MCP:** configured for the project. Database writes still require explicit scope, backup
  confirmation for migrations, and post-change RLS verification.
- **Graphify 0.9.6:** installed locally with project-scoped Codex skill and pre-tool check. Use for code
  navigation and impact analysis; refresh after a major source checkpoint. Generated `graphify-out/`
  artifacts are disposable and should not become product documentation.
- **RTK 0.43.0:** installed and connected to Claude Code through its global hook. It is not currently a
  Codex hook. Use manually only when it reduces noisy command output without hiding failures.
- **GitHub/browser/Vercel skills:** available in Codex; invoke only for a task that needs them.

## Conditional

- **Composio:** historical Claude MCP integration, not currently visible to Codex. Add it only when a
  scoped external-service workflow is approved. Prefer session/toolkit scoping and least-privilege
  authorization; do not preload broad tool catalogs or commit credentials.
- **OpenAI Developer Docs MCP:** recommended for current model/API work. One-time local command is in
  `CODEX_WORKFLOW.md` because the desktop sandbox could not launch the installer.
- **Playwright:** add as a project dev dependency with the first Phase A browser test, not as a global
  plugin with no exercised test.

## Maintenance

Quarterly and before native releases: inventory versions, permissions, exposed MCP servers, unused
plugins, privacy behavior, generated artifacts, and credential rotation needs. Remove integrations that
are unused or cannot be scoped safely.
