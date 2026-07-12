# Security Policy

## Reporting

Do not open a public issue containing a vulnerability, credential, user data, or exploitable detail.
Report it privately to the repository owner. Until a dedicated security contact is published, use the
private GitHub repository communication channel.

## Baseline controls

- Supabase service-role and AI provider keys are server-side only; the client may contain only the
  public Supabase URL and anon key.
- Every user-owned table requires `auth.uid()`-scoped RLS and explicit negative tests.
- Storage buckets require ownership policies; photos, notes, locations, and physical-disc identity are
  private unless the user explicitly shares a supported field.
- Logs, screenshots, fixtures, Graphify output, and database backups must not contain credentials or
  production PII.
- Dependency, privacy-manifest, and permission audits are required before native release candidates.
- User-visible deletion may be recoverable for audit, but privacy purge must truly remove scoped data
  according to the documented retention policy.

See `docs/operations/RELEASE_CHECKLIST.md` and `docs/mobile/IOS_READINESS.md`.
