# `.claude/` — Claude Code project configuration

## `settings.json` — read-only Supabase MCP allowlist

### Why this file exists

Headless / remote Claude Code sessions have no human at a keyboard. Every Supabase MCP
call — *including* zero-argument, read-only ones like `list_projects` — was returning:

```
MCP error -32003: MCP tool call requires approval
```

The approval gate fails closed, so two consecutive agent sessions were fully blocked. The
concrete cost: an agent could not determine whether migration
`20260729213112_phase_e_account_deletion.sql` had been applied, which blocked a PR merge.

`permissions.allow` pre-approves the read-only subset so a session can *observe* project
state without a human in the loop.

### The principle: read-only means read-only

**Only tools that cannot change anything belong in `permissions.allow`.**

`execute_sql` is the trap. It is *read-capable*, but it is not *read-only* — it runs
arbitrary SQL, which includes `INSERT`, `UPDATE`, `DELETE`, `DROP`, and `ALTER`. It must
never be allowlisted. Same for `apply_migration` and anything that creates, merges,
resets, deletes, deploys, pauses, restores, or confirms a cost.

Those write-capable tools are listed explicitly in `permissions.ask` so the intent is
recorded in the file itself, not just implied by absence. If you find yourself wanting to
move one of them into `allow`, that is a decision for the repo owner, not a convenience
edit.

Adding a tool here is a **standing, unattended grant** for every future session in this
repo. Treat it accordingly.

### Why every rule is listed twice

The Supabase MCP server is not exposed under a single stable name. Within one observed
session the tool namespace changed mid-session:

| Time (UTC) | Namespace seen |
| --- | --- |
| 19:28 | `mcp__Supabase__*` (friendly connector name) |
| 19:33 | `mcp__cde54079-9467-46f0-972c-508038f6c172__*` (connector UUID) |

The main thread and its subagents saw different forms of the same server. Because a rule
keyed to only one form is dead weight in a session that resolves the other, **both
namespaces are listed for every tool**. Keep them in sync when editing: add or remove a
tool from *both* lists, or the rule silently stops applying half the time.

If the connector is ever reinstalled the UUID may change. If Supabase MCP calls start
requiring approval again, check which prefix the current session is using and add it.

### If approval is still required

Repo-level `settings.json` cannot override a gate enforced upstream of the harness. If
read-only calls still return `-32003` after this file is in place, the approval is being
enforced at the **claude.ai account / connector level**, and the repo owner has to grant
it there — no repo change can work around it.
