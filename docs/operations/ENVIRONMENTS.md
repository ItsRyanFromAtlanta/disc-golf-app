# Environments

| Environment | Purpose | Data policy | Deployment |
|---|---|---|---|
| Local | Development and unit tests | Fixtures/test account only | Vite dev server |
| Preview | PR integration and browser E2E | Isolated non-production project preferred | Vercel preview |
| Production | User-facing application | Production RLS, retention, backups | Protected `main` |

Use separate Supabase projects before public beta. Environment variables live in local `.env` or the
deployment secret store, never Git. Production migrations are additive, reviewed, rehearsed against
preview, and followed by advisor/RLS checks. Backup policy is the owner's, managed outside development
sessions — see `docs/operations/BACKUP_RESTORE.md`.
