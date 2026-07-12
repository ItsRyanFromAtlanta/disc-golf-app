# Incident Response

1. **Detect and classify:** security/privacy or data loss is critical; broken core flow is high; degraded
   non-core behavior is medium; cosmetic issues are low.
2. **Contain:** stop the harmful deploy/job, revoke exposed credentials, disable the affected feature,
   or roll back the application without rewriting database history.
3. **Preserve evidence:** record timestamps, release/commit, affected scope, sanitized logs, and actions.
4. **Recover:** validate backup/migration state, repair idempotently, and smoke-test ownership/offline
   behavior before restoring service.
5. **Communicate and learn:** notify affected users when required, write a blameless incident record,
   add regression tests, and update operating docs.

Never paste secrets or personal user data into issues, AI prompts, Graphify output, or public logs.
