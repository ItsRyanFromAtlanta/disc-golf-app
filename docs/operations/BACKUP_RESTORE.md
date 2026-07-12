# Backup and Restore

- Confirm and record a manual Supabase backup or verified `pg_dump` before migrations/FK changes.
- Store backups outside Git in the ignored `db_backups/` location or an encrypted managed store.
- Test restore procedures against a non-production project at planned release milestones.
- User-facing bag/disc state restore creates a new version; it never rewrites history. Preview added,
  removed, and ghost-placeholder records before apply.
- Soft-deleted activities remain recoverable and auditable until the documented privacy-purge action.
- After any restore, verify row counts, ownership/RLS, references, audit timelines, and affected metrics.
