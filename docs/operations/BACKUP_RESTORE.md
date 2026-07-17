# Database Recovery and Migration Safety

- Codex does not run database backup commands or request manual backup confirmation. Production backup
  and restore policy is managed by the owner outside development sessions.
- Database changes use append-only migrations with reviewed rollback notes, ownership/RLS negative
  tests, advisors, and post-apply smoke checks.
- Never commit database dumps or credentials if the owner creates them through another workflow.
- User-facing bag/disc state restore creates a new version; it never rewrites history. Preview added,
  removed, and ghost-placeholder records before apply.
- Soft-deleted activities remain recoverable and auditable until the documented privacy-purge action.
- After any restore, verify row counts, ownership/RLS, references, audit timelines, and affected metrics.
