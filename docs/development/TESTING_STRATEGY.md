# Testing Strategy

- **Pure unit tests:** scoring, insights, metrics, lifecycle reducers, merge/deduplication, formatting.
- **Repository/integration tests:** Dexie, outbox idempotency, correction/audit behavior, storage and
  Supabase contracts.
- **RLS/security tests:** positive ownership and negative cross-user/forged-write cases for every new
  user-owned table, RPC, and bucket.
- **Browser E2E:** critical PLAY, DISCS, ME, auth, offline/resume, finalize/correct, and soft-delete flows.
- **Visual/accessibility:** target mobile widths, keyboard/focus, screen-reader labels, contrast, text
  scaling, reduced motion, and touch-target checks.
- **Real devices:** cold-start TTFP, sunlight, one-thumb operation, background/resume, interrupted
  networks, low battery, and iOS/Android installation.

Tests accompany the feature. Run focused tests during development and the complete relevant suite at a
green checkpoint and release candidate.
