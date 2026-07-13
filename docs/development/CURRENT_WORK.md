# Current Work

Last updated: 2026-07-12

- **Active phase:** Phase B — DISCS data foundation.
- **Approved:** Phase A shell/navigation, lifecycle, notification, scrolling/sheets, accessibility,
  repository/transaction, migration-order, test-gate, and A1–A10 walkthrough are complete.
- **Current checkpoint:** B1.7 server-only fetch/staging contracts and B1.8 admin review/promotion
  are implemented and live-verified; B1.7 design and B1.6 repository/manufacturer-adapter contracts
  remain approved. The bounded non-production MVP manufacturer fixture and explicit fixture review
  record are now covered at the adapter boundary. A separate bounded official MVP source snapshot
  adapter covers Photon, Terra, Volt, and Watt with product-page provenance; the open-dataset check is
  complete with no safe dataset selected for promotion. Its server-only staging composition now binds
  the official registry and host policy to injected fetch/storage dependencies. A bounded official
  product-page parser/fetcher now produces verified parsed facts and exact raw-byte handoff; remaining
  ingestion work is the backup-gated transactional staging RPC/store, protected Edge Function,
  conditional fetch state, crawler/scheduler/admin UI, not an open canonical-write path.
  B1.5 catalog foundation remains applied and verified. The normalized manufacturer,
  mold/plastic, run, stamp, provenance, import, private-configuration, and submission/review tables are
  live with RLS and least-privilege grants. Four manufacturers backfill all 36 molds with zero unlinked
  rows. Rollback-only tests passed authenticated canonical reads, denied canonical writes, owner CRUD,
  cross-user isolation, one-way submission, and post-submission immutability. Three advisor follow-up
  migrations cover every new composite FK. A10 release-candidate gates remain complete. The notification contract now has an append-only
  applied migration, Dexie v4 mirror, durable local outbox adapter, deterministic activity/sync producers,
  and bell sheet/deep-link UI. Browser verification confirms the non-blank landing shell and protected
  `/notifications` redirect to login without an error overlay. The signed-in PLAY shell, practice session
  completion, notification bell, notification sheet, direct `/notifications` route, and reload persistence
  have now been exercised successfully. Live rollback
  checks also confirm anon RPC denial and authenticated-without-JWT rejection with zero residue. True
  cross-device identity verification remains deferred because this task has one signed-in browser session.
  A8 remains complete: the live-verified recovery RPCs and versioned metric registry are
  connected to a Dexie v3 audited recovery outbox, canonical activity history, sync/incomplete badges,
  Recently Deleted restore, hidden-row metric exclusion, and audited detail correction. Typed sporting
  facts remain unchanged and local-only activities never invent putt totals.
- **Current implementation:** B1.7 now has server-only fetch policy primitives, a dependency-injected
  staging orchestrator, and a persistence row contract with no Supabase or canonical-write dependency.
  It enforces lowercase adapter slugs, allowlisted HTTPS sources, response/redirect limits, checksummed
  fetch envelopes, idempotent existing-batch replay, explicit 304 handling, server-side candidate
  validation/checksums, and checksum-addressed raw artifacts. Candidate/artifact tables, private Storage,
  review history, append-only guards, service-only review/promotion RPCs, provenance candidate/alias/
  actor links, the raw-artifact closure trigger, and the authenticated `catalog-ingestion-admin` Edge
  Function are applied. The protected `catalog-ingestion` Edge Function is now also deployed (JWT
  verification enabled; a live unauthenticated POST returns 401 `catalog_admin_auth_required`) after the
  earlier Codex platform usage-limit rejection cleared. B1.6 contract slice remains complete:
  canonical catalog reads use the existing
  offline-first cache boundary; private configurations and submission/evidence drafts have owner-scoped,
  idempotent client IDs and durable outbox writes; canonical/import/review writes are not exposed. Pure
  manufacturer adapters produce checksummed, provenance-bearing staged candidates and never import
  Supabase or write canonical tables. The server-only MVP adapter validates the official host, emits
  only reviewable mold facts/evidence, and leaves fetch, review, and promotion outside the adapter.
  `mvpCatalogStaging.js` now composes that adapter with the generic staging orchestrator; adapter
  version drift is rejected before network or persistence calls, and persistence remains injected.
  `mvpProductPageParser.js` and `mvpCatalogFetcher.js` now parse one official product page per job,
  enforce network limits, checksum exact response bytes, and forward the raw body to that boundary.
  `catalogIngestionStore.js` now binds that boundary to checksum-verified private Storage and the
  service-only transactional staging RPC; `catalogIngestionHandler.js` adds the authenticated,
  allowlist-preflighted `catalog-ingestion` function source. The function is now deployed and live
  (JWT-protected, confirmed 401 on an unauthenticated request); the source tree was flattened into a
  single sibling directory with rewritten relative imports for the deploy payload, matching the
  `catalog-ingestion-admin` deploy convention, with no logic changes.
  GPT-5.6 Luna extra-high was requested for this implementation;
  the runtime model label remains GPT-5 Codex. Canonical promotion now requires explicit review,
  active allowlist membership, a matching raw artifact, and one atomic dependency-ordered transaction.
- **Database state:** A5/A6/A8/A9 activity/notification, B1.5 catalog, B1.7 candidate/artifact, and
  B1.8 review/promotion migrations are applied. Fresh Supabase checks
  confirm `notifications` has RLS, authenticated read access, and only authenticated/service-role RPC
  execution. B1 uses automated CLI-first/`pg_dump` backup with a non-blocking reminder fallback;
  A10’s notification activity-owner covering index is applied.
- **Previous full verification:** 381 unit tests pass, including the focused catalog/ingestion
  contract tests; build passes; lint retains only the four pre-existing warnings. Live rollback tests cover positive,
  idempotent, stale, invalid, cross-user, and collision cases with zero residue. Anonymous RPC execution
  and authenticated direct activity/audit DML are denied. Advisors have no new A8 findings; lint retains
  only four pre-existing warnings and the production build passes. Linked error-level DB lint returns
  zero results. Live B1.8 transaction tests cover review completion, dependency-ordered promotion,
  idempotent retry, missing-artifact rollback, service-only RPC grants, and zero residue. The deployed
  Edge Function has JWT verification enabled and rejects an unauthenticated smoke request with 401.
  The earlier A10 checkpoint recorded
  333 tests; the current full suite is 368. Browser verification now runs with
  `agent-browser`: the landing page and both A8 history URLs are non-blank and error-overlay-free, and
  unauthenticated history navigation correctly redirects to login. The signed-in browser smoke also covers
  the PLAY shell, freeform completion, notification sheet, direct `/notifications` route, and reload/session
  persistence. Cross-device authenticated history/content
  interaction was also reported passed by the user in a separate independent session/device. This is
  user-reported evidence; Codex did not directly observe the second session or collect its device metadata.
  The official MVP fetch/parser checkpoint refreshed graphify to 1,326 nodes and 2,774 edges.
- **Current B1.9 verification:** the focused store/handler/staging suite passes (17 tests), and a
  live rollback-only transaction inserted and then fully rolled back a temporary admin row, source,
  batch, artifact, and candidate. The CLI-first/`pg_dump` backup fallback was unavailable in this
  environment, so the manual-backup reminder remains active — confirm a real Supabase dashboard backup
  exists before the next migration/FK session. The `catalog-ingestion` Edge Function is now deployed and
  live-verified (401 on an unauthenticated request); the full gate re-run after deployment passed clean:
  390 unit tests, production build, lint at the four-warning baseline, and graphify refreshed to 1,370
  nodes / 2,873 edges.
- **Current conditional-fetch checkpoint:** `store.findLatestBatch()` now supplies the prior batch's
  checksum/etag/last-modified before fetching; `catalogIngestionStage.js` forwards it as `conditional`
  to the fetcher, which sends `If-None-Match`/`If-Modified-Since` and replays the real prior checksum on
  a genuine 304 (previously it hashed an empty body, so a real 304 could never match a staged batch).
  397 unit tests pass (7 new), build/lint/graphify gates re-ran clean. Not yet redeployed to the live
  `catalog-ingestion` Edge Function — that redeploy is a deliberate separate step, not bundled into this
  application-code checkpoint.
- **Context recommendation:** keep the official MVP snapshot staged-only until an explicit review
  record is selected and promoted through the now-live admin path. Do not promote the historical public
  CSV candidate without a verified license/provenance review; do not add canonical catalog writes to
  staging or grant the admin allowlist casually. Next up: redeploy `catalog-ingestion` with the
  conditional-fetch fix, then crawler/scheduler automation, then the admin review UI. The verified B1.8
  follow-on archive is outside Git at `C:\tmp\disc-golf-app-backups\20260712-212738`.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
