# Backup and Restore

- Before migrations/FK changes, automate a timestamped backup: try `supabase db dump --linked`, then
  use `pg_dump` through pgpass when the CLI dump cannot run (for example, when Docker is unavailable).
- Verify non-zero output, inspect the custom archive with `pg_restore --list`, and record path, size,
  and SHA-256 without printing contents or credentials. This satisfies the backup gate without another
  confirmation prompt. If neither route is available, give a non-blocking manual-backup reminder.
- Store backups outside Git under `C:\tmp\disc-golf-app-backups\<timestamp>` for an immediate migration
  checkpoint or in an encrypted managed store for durable retention.
- Test restore procedures against a non-production project at planned release milestones.
- User-facing bag/disc state restore creates a new version; it never rewrites history. Preview added,
  removed, and ghost-placeholder records before apply.
- Soft-deleted activities remain recoverable and auditable until the documented privacy-purge action.
- After any restore, verify row counts, ownership/RLS, references, audit timelines, and affected metrics.
