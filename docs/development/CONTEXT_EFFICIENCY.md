# Context and Token Efficiency

## Default operating pattern

- Load `AGENTS.md`, `CURRENT_WORK.md`, and one relevant authority; locate everything else with `rg`.
- Keep stable policy in files rather than repeating it in prompts.
- Ask tools for targeted matches, line ranges, or failing test output instead of whole files/logs.
- Use GPT-5.3-Codex medium for normal implementation; raise to GPT-5.6 high only for bounded high-risk
  decisions. Use a smaller model only for mechanical work followed by normal verification.
- Keep web search context low for discovery, then open only primary sources.
- Preserve prompt prefixes and stable instructions when using the API so prompt caching can help; place
  changing task data later in the prompt.
- Leave automatic compaction thresholds at model defaults until measurements justify tuning. The
  project caps stored tool output and uses concise summaries/low verbosity.

## Start a fresh Codex task when

- a plan is approved and implementation begins;
- switching between architecture, migration, UI, and deployment domains;
- a major checkpoint is committed/pushed and the next stage has a different goal;
- tool output or repeated corrections dominate the context;
- the task has compacted and the active objective can be stated more clearly from repository docs.

Before clearing context, update `CURRENT_WORK.md`, `DEVLOG.md`, roadmap/backlog status, commit the green
checkpoint, and record the exact next command or file. Do not clear context in the middle of an
uncommitted migration, failing test diagnosis, or unresolved data-loss risk.

## Efficient commands

```powershell
rg -n "term" src docs *.md
rg --files src supabase e2e
git diff --stat
git status --short
graphify query "symbol or concept"
graphify explain path/to/file
```

RTK may compact shell output in Claude Code. Codex already has bounded tool history, so use RTK only
when its output is demonstrably clearer; avoid stacking token wrappers blindly.
