# Dev Log

## 2026-07-15 — Shipped Phase B item 4 Lost & Found

**What:** Applied private owner-scoped Lost & Found cases and immutable update timelines with optional
course, browser GPS, area, notes, and contact evidence. Atomic RPCs mark an opened case's physical disc
lost and return a recovered disc to the locker. The new DISCS route provides case history and resolution;
Dexie v10 caches the timeline and replays idempotent offline operations. Cases never auto-archive.

**Verified:** 362 tests pass across 42 files, production build and diff checks pass, and lint retains only
the four pre-existing warnings. Rollback-only authenticated owner/foreign-user visibility, recovery
atomicity, immutable client grants, and zero-residue checks passed. Linked database lint reports no new
B4 finding; its only warning predates this work.

**Next:** Phase B item 5 odometer and permanent cosmetic-tier unlock events.

---

## 2026-07-15 — Shipped Phase B item 3 private disc photos

**What:** Applied `disc_photos`, the private image-only `disc-private-photos` bucket, owner-scoped
metadata and Storage RLS, and security-invoker register/delete/restore RPCs. The shipped client provides
front/back/side compression, signed display URLs, Dexie v9 Blob retry, immutable replacement history,
legacy URL fallback, and 30-day recoverable removal.

**Verified:** Rollback-only authenticated owner/foreign-user tests passed for metadata visibility,
Storage path insert/visibility, RPC ownership rejection, replacement history, exact 30-day deletion,
restore, and idempotent retry. Zero smoke rows remain. Advisors introduced no new security warning or
missing foreign-key index; only the expected unused-index notice appears on the new empty table.

**Next:** Phase B item 4 Lost & Found.

---

## 2026-07-15 — Removed Codex pre-migration backup gate

**What:** Per owner direction, removed automated dump attempts and manual backup confirmation from
active migration instructions, roadmap gates, release checks, and migration runbooks. Production
backup policy is now explicitly owner-managed outside Codex sessions.

**Migration safety retained:** Append-only migrations, reviewed rollback notes, fresh schema audits,
ownership/RLS negative tests, advisors, and post-apply smoke checks remain required.

---

## 2026-07-15 — Phase B item 3 private photos local checkpoint

**What:** Added an unapplied owner-scoped `disc_photos` migration and private image Storage contract
for immutable front/back/side versions. The client compresses to bounded WebP derivatives, displays
short-lived signed URLs, queues Blobs in Dexie v9 for offline retry, preserves legacy `photo_url` as a
front-slot fallback, and supports replacement plus 30-day recoverable removal.

**Migration gate:** Global Supabase CLI and `pg_dump` were unavailable, and the pinned CLI dump path
required unavailable Docker Desktop. Per the owner's updated policy, backup attempts and confirmation
are no longer migration gates; append-only SQL, rollback notes, RLS tests, and smoke checks remain.

**Verified:** 358 tests pass across 41 files, production build and diff checks pass, and the new hook
lint warning was fixed; four pre-existing lint warnings remain.

**Next:** Apply the migration, run authenticated cross-owner Storage/RLS/RPC
smoke tests and advisors, then close Phase B item 3.

---

## 2026-07-15 — Shipped Phase B 2B ghost slots and shot tags

**What:** Persisted private, capacity-neutral bag ghost slots and added a physical-disc shot taxonomy.
The dictionary includes 10 curated tags plus private custom tags; assignment removal writes a
`removed_at` tombstone, while a partial unique index permits only one active disc/tag pair. Dexie v8
mirrors active rows and tombstones. Bag management can persist/remove derived gaps and disc detail can
assign, remove, or create tags.

**Migration:** Owner confirmed a fresh manual backup. Applied owner-scoped RLS and least-privilege
grants; anonymous access is absent. No social/community aggregation or caddie logic was added.

**Verified:** 355 tests pass across 40 files, build and diff checks pass, lint retains four existing
warnings, and rollback-only authenticated ghost/assignment/tombstone smoke passed with zero residue.
Advisors found no new 2B security issue or missing foreign-key index.

**Next:** Phase B item 3 private physical-disc photos.

---

## 2026-07-15 — Shipped Phase B 2A disc timelines and bag versions

**What:** Added immutable owner-scoped physical-disc state events and immutable bag metadata/membership
snapshots. Database triggers record status, role, wear, condition, and bag membership changes. Bag
history is cached in Dexie v7; Manage Bags previews additions/removals/unavailable discs before an
atomic restore that always creates a new version. New rounds capture `bag_version_id`.

**Migration:** Owner confirmed a manual backup after automated dump failed for missing Docker/pg_dump.
The foundation migration backfilled five bags and 22 memberships without changing current state. A
rollback smoke found self-recursive bag-version INSERT RLS; an append-only follow-up removed that
lookup and added both advisor-requested FK indexes.

**Verified:** 353 tests pass across 39 files, lint retains only four existing warnings, production
build and diff checks pass, and authenticated capture/restore passed rollback-only with zero smoke rows.

**Next:** Ghost slots, shot tags, and reversible assignment tombstones complete Phase B item 2.

---

## 2026-07-15 — Shipped B2 read-only offline catalog repository

**What:** Added a normalized catalog snapshot repository for manufacturers, molds, plastics,
mold-plastic availability, runs, and stamps. Dexie v6 mirrors the shared reference rows and TanStack
Query reads remote-first with a complete local fallback. Mold picker, Disc Universe search, onboarding
putter selection, and URL-prefilled add-disc now share this boundary. Removed the stale direct
`disc_molds` insert path because canonical tables are authenticated-read-only.

**Data decision:** No schema or production-data writes. The live catalog currently contains four
manufacturers and 36 molds; plastic/run/stamp rows remain empty. Representative cross-table fixtures
are deterministic test data only, so the UI never presents invented canonical products.

**Verified:** 351 tests pass across 38 files, production build and `git diff --check` pass, and lint
retains only the four pre-existing warnings. Live Supabase checks confirm RLS plus authenticated SELECT,
no authenticated INSERT, and no anonymous SELECT on all six cached canonical tables.

**Next:** Phase B item 2 — physical-disc timelines and bag configuration versions/snapshots.

---

## 2026-07-15 — Shipped J3 game-flair disc cards

**What:** Added an opt-in `DiscCard` flair variant for the locker. `discTier(disc)` is a pure, tested
precedence function: archived status (`lost`/`retired`/`sold`) wins first, followed by `primary_putter`
legendary, `situational_weather` epic, wear score ≥7 rare, and common fallback. The Profile preferences
checkbox persists through the existing local-storage preference pattern and feeds every locker grid/list,
compare-mode, and add-to-bag card. Flair cards add Topo rarity borders, Tier/Signal stat blocks, and a subtle
mount animation guarded by `prefers-reduced-motion`; the default-off card markup/classes remain unchanged.

**Verified:** 348 unit tests pass across 37 files, lint passes with only the four pre-existing warnings,
production build passes, `git diff --check` passes, and `graphify update .` rebuilt the graph. Browser smoke
reached the existing `/login` auth gate from `/profile`; the available guest action did not navigate, so an
authenticated toggle/card interaction could not be exercised. No schema changes; the existing theme contract
is light-only and no dark-mode variant was added.

**Next:** Resume the roadmap's DISCS intelligence work.

---

## 2026-07-15 — Shipped J2 disc comparison view

**What:** Added locker compare mode with a 2–4 disc cap, `/bag/compare?ids=…`, and the side-by-side
comparison page. The page derives effective flight numbers, per-axis low/high highlights, explicit
override markers, stability labels, a current-reality curve overlay, and no-meaningful-gap flags for
disc pairs within ±1 on every populated flight axis. Added pure `discCompare.js` rules/tests and a
small overlay export from `FlightCurve.jsx`; no schema changes.

**Verified:** 342 unit tests pass across 36 files, lint passes with only the four pre-existing warnings,
production build passes, `git diff --check` passes, and `graphify update .` rebuilt the graph. Browser
smoke reached the existing `/login` auth gate from the protected compare route with zero console errors;
an authenticated locker/compare interaction could not be exercised without a browser session, and no
guest account was created.

**Next:** J3 game-flair disc cards.

## 2026-07-14 — Shipped J1 round logging + quick-course

**What:** Built the new COURSES tree and round logger: course directory, quick-course creation,
course/layout detail, round setup with optional bag, offline-first scorecard, round history, and
finalization summary. Added `roundLog.js`, the Dexie v5 `rounds`/`roundHoles` stores, pure sparse-score
helpers in `rounds.js`, route metadata/tests, the COURSES tab, and Sun-Drenched Topo field-screen styles.

**Data contract:** Applied `20260714150000_phase_c_round_logging_rls.sql` to the live project. Courses,
layouts, holes, and aliases are authenticated community-read with bounded inserts/updates; rounds and
round holes are owner-scoped. The deployed composite `rounds(id,user_id) → activities(id,user_id)` FK was
found during the smoke test and is now honored by the round repository: it creates the matching
idempotent activity parent and drains lifecycle writes before round writes. No schema columns changed.

**Verified:** 338 unit tests pass across 35 files, lint passes with only the four pre-existing warnings,
production build passes, `git diff --check` passes, and `graphify update .` rebuilt the graph. Live SQL
verification confirmed RLS/policies/indexes; an authenticated create/read/update/foreign-user visibility
smoke passed inside a rollback-only transaction with zero rows left behind. The browser reached the
existing login gate at `/courses` with no console errors; no guest account was created.

**Migration note:** The bundled Supabase dump command could not create an automated backup because this
environment lacks Docker, and `pg_dump` is unavailable. The required manual-backup reminder remains open
for the next migration session; this J1 policy migration was applied within the approved scope.

**Next:** J2 disc comparison view.

## 2026-07-14 — Planned 3 jump-ahead features + reconciled stale Track 1 status (handoff to coding model)

**What:** Produced an executable handoff plan for three genuinely-unbuilt features and fixed the
documentation drift that would have misled the coding model. Discovered while scoping "next steps" that
Track 1 (1A player profile, 1B disc molds + locker migration, 1C bags/flight chart, 1E bag/disc manager
UI) is **already shipped** — live schema + built UI (`ProfilePage`, `BagPage`, `BagLockerPage`,
`DiscCard`) — but `DEVELOPMENT_PLAN.md` still read "NEXT UP / schema to generate."
**Decisions (owner):** build three features **ahead of roadmap phase order** (deliberate, documented) —
J1 Round logging + quick-course under a **new COURSES tab** (front-runs Phase E; owner picked the
quick-course scope over full course directory), J2 Disc comparison view (Phase C), J3 Game-flair disc
cards (Phase B cosmetic). Round logging's schema is 100% ready (1.5 groundwork applied); only an RLS
migration + offline-first `roundRepository`/`roundLog.js` (mirroring `discRepository`/`discLocker`) are
new.
**Doc changes (this commit):** `DEVELOPMENT_PLAN.md` — marked 1A/1B/1C/1E SHIPPED, added a "Jump-ahead
features (J1–J3)" section with per-feature specs, files, reuse, and models. `FEATURE_BACKLOG.md` — 1E →
SHIPPED, disc-comparison + game-flair + round-logging rows → IN PROGRESS. `PRODUCT_ROADMAP.md` — note
that the jump is a deliberate owner decision, not a sequencing violation.
**Handoff:** Full plan at `~/.claude/plans/1a-2yes-bright-pelican.md`. Coding model builds J1→J2→J3
(J2/J3 independent), running the per-feature gate and updating DEVLOG/CURRENT_WORK/FEATURE_BACKLOG as it
goes. Recommended models: GPT-5.6 high (J1 round state/schema), GPT-5.3-Codex medium (J2, J3).

## 2026-07-14 — Executed the catalog-ingestion teardown (code + functions + DB)

**What:** Carried out the scrap decided the day before. Removed the entire ingestion surface from the
repo (26 files, ~5k lines): both Edge Function dirs, all `_shared/catalog*`+`mvp*` modules,
`AdminCatalogReviewPage.jsx`, `src/lib/catalogAdmin.js`, `src/lib/catalog/*`, the dead
`src/lib/repository/catalogRepository.js`, and the `/admin/catalog` route in `App.jsx`. Deleted the
`catalog-ingestion` and `catalog-ingestion-admin` Edge Functions from the live project. Applied a DB
teardown migration (`20260714120000`) that dropped the ingestion-only tables
(`catalog_import_batches/candidates/artifacts/candidate_reviews`, `private.catalog_ingestion_admins`),
the ingestion RPCs and their private helpers (enumerated by exact name via a `pg_proc` DO block — no
`catalog_%` wildcard, so no foundation/submission helper was caught).
**Preserved (verified via list_tables before + after):** the catalog foundation — `manufacturers` (4),
`disc_molds` (36), `discs` (20), `catalog_sources` (4) — and the whole submission flow
(`catalog_submissions`/`_reviews`/`_evidence`), plastics/runs/stamps, `user_disc_configurations`. Row
counts unchanged. `discs.mold_id` FK intact.
**Verified:** 333 unit tests pass (34 files), build + lint clean, app loads in-browser with the route
gone and no console errors. Migration applied cleanly on the second attempt.
**Gotcha:** the first apply rolled back atomically — Supabase blocks direct `DELETE` on
`storage.objects`/`storage.buckets` (`storage.protect_delete`). Removed the bucket-delete from the
migration; the empty `catalog-import-raw` bucket (0 objects, confirmed) is left for a one-click dashboard
deletion since the CLI only manages objects, not buckets, and bucket deletion needs the Management API.
**Follow-up left for owner:** delete the empty `catalog-import-raw` Storage bucket from the dashboard.

## 2026-07-13 — Scrapped catalog ingestion; discs to be populated manually

**Decision:** Abandon the automated catalog-ingestion effort. `disc_molds` will be populated **manually**
by the owner, later (add-disc UI or an owner-supplied one-time seed SQL), not by a manufacturer-site
scraper. Trigger: the first live crawl proved the pipeline works end-to-end (auth, CORS, fetch,
throttle, staging boundary all correct) but the parser couldn't read MVP's current live page — flight
numbers now live in prose ("flight numbers of 2 | 5 | -0.5 | 0.5") with no `data-flight` attribute, so
all 4 targets failed with `mvp_flight_numbers_missing` and 0 batches staged. Maintaining a scraper
against a site we don't control isn't worth it for a solo catalog.
**What changed:** Documentation only. Added a standing "population policy" note to `DEVELOPMENT_PLAN.md`
§1B (disc molds section); flipped the three `FEATURE_BACKLOG.md` disc-universe ingestion rows to
REJECTED with reasoning preserved, and added a new BACKLOG row for manual population.
**Parked, not deleted:** The `catalog-ingestion` / `catalog-ingestion-admin` Edge Functions (both live,
CORS fix included), all `supabase/functions/_shared/catalog*`/`mvp*` modules, `src/pages/AdminCatalogReviewPage.jsx`,
`src/lib/catalogAdmin.js`, and the `catalog_*` staging tables + `private.catalog_ingestion_admins`
allowlist remain in place, out of scope. Removing them (and revoking the admin grant) is a separate
cleanup to run only if the owner asks.
**Next:** Track 1 resumes at 1A (player profile) / 1B disc-molds schema + migration whenever the owner
is ready to hand-populate; the migration step still derives molds from manually-entered discs.

## 2026-07-13 — Admin allowlist granted; fixed CORS header gap blocking the review UI

**What:** The project owner granted their account into `private.catalog_ingestion_admins` (manual SQL,
per the documented handoff). First real signed-in visit to `/admin/catalog` then failed with
`catalog_admin_operation_failed` — but the Edge Function logs showed only the OPTIONS preflight
arriving, never the POST. Root cause: `supabase.functions.invoke()` always sends `apikey` and
`x-client-info` headers, but both catalog Edge Functions' `Access-Control-Allow-Headers` allowed only
`authorization, content-type`, so the browser passed the preflight but blocked the actual request
client-side. Added `apikey, x-client-info` to the CORS allowlist in `catalogIngestionAdminHandler.js`
and `catalogIngestionFunction.js`.
**Verified:** 416 unit tests pass. Redeployed `catalog-ingestion-admin` (version 3); browser-confirmed
the signed-in admin happy path now works end-to-end — `/admin/catalog` authenticates, calls
`list_batches`, and renders the legitimate "No staged batches" empty state. A direct authed `fetch`
also returns `200 {"result":[]}`, confirming the allowlist grant itself.
**Handoff:** `catalog-ingestion` carries the same fix locally but has NOT been redeployed yet — redeploy
it before triggering the first admin crawl. The review → promote flow remains unexercised because zero
batches are staged; the next milestone is redeploy + first live crawl to stage a batch, then a full
review/promote pass, then the `disc_molds` migration script.

## 2026-07-13 — Redeployed catalog-ingestion-admin with the review UI's read ops

**What:** Redeployed `catalog-ingestion-admin` (version 2) carrying the `list_batches`/`list_candidates`
operations and the refactored handler factory.
**Verified:** Live smoke test with `{operation: 'list_batches'}` and no bearer token still returns 401.
**Handoff:** Phase B Track 1B ingestion pipeline (B1.5–B1.7 scope) is now complete end-to-end: schema,
staging RPC/store, protected Edge Functions, conditional fetch, bounded crawl, and admin review UI. The
admin allowlist is still empty — grant your own account access to `private.catalog_ingestion_admins`
when ready to actually exercise the review/promote flow, then the next real milestone is the
`disc_molds` migration script once a batch has been promoted through it.

## 2026-07-13 — Added the catalog admin review UI

**What:** Built the first admin-facing screen for the B1.7 pipeline: `/admin/catalog`, reachable only
by direct URL (not linked from the player-facing PLAY/DISCS/ME nav), gated by `ProtectedRoute` plus a
server-side allowlist check. Extended `catalog-ingestion-admin` with two read-only operations —
`list_batches` and `list_candidates` — that reuse the existing `catalog_assert_ingestion_admin` RPC for
authorization before querying with the service-role client; no new migration or RLS policy was needed
since `catalog_import_batches`/`catalog_import_candidates` already had zero policies (service-role only)
and the assert-RPC already existed. Refactored the previously-monolithic `catalog-ingestion-admin`
`index.ts` into a dependency-injected `createCatalogAdminHandler` factory (`catalogIngestionAdminHandler.js`),
matching `catalog-ingestion`'s testable pattern; the existing `review`/`promote` RPC dispatch is
unchanged. Added `src/lib/catalogAdmin.js` (first client-side use of `supabase.functions.invoke`) and
`AdminCatalogReviewPage.jsx`: lists staged batches, lets an admin approve/reject/needs-changes each
candidate with a required reason, and promotes a fully-reviewed batch.
**Verified:** 416 unit tests pass (13 new), production build passes, lint retains only the four
pre-existing warnings, graphify refreshed to 1,406 nodes and 2,944 edges. Confirmed in the browser that
an unauthenticated request to `/admin/catalog` redirects away (`ProtectedRoute` working). Could not
browser-verify the signed-in-but-not-admin "unauthorized" render or the reviewer happy path — guest
sign-in in this dev environment doesn't complete (no auth network call fires; appears unrelated to this
change) and no admin test-account session was available. The 401/403/400 gating logic itself has full
unit coverage in `catalogIngestionAdminHandler.test.js`.
**Handoff:** The admin allowlist (`private.catalog_ingestion_admins`) is still empty — nobody, including
the project owner, can use this screen's write actions yet. Adding an allowlist row is a deliberate,
security-sensitive step left for the user to take explicitly (not done here). Once granted, worth a
manual pass through the review → promote flow in the real browser.

## 2026-07-13 — Redeployed catalog-ingestion with crawl mode

**What:** Redeployed `catalog-ingestion` (version 3) carrying the crawl-mode handler/contract changes
and the new `mvpCatalogCrawl.js`, added to the flattened deploy file set with its import rewritten to
the flat `./mvpCatalogAdapter.js` path (the local source correctly uses `./adapters/mvpCatalogAdapter.js`
— these differ by design, see the deploy convention notes in earlier entries).
**Verified:** Live smoke test with a `{mode: 'crawl', jobId: 'smoke-test'}` body and no bearer token
still returns 401 `catalog_admin_auth_required` — auth is checked before mode routing, as designed.
**Handoff:** B1.7-scope ingestion work (staging RPC/store, protected Edge Function, conditional fetch,
crawler) is now complete and deployed end-to-end. Next: the admin review UI — there is currently zero
UI for reviewing/promoting staged candidates, only the RPC/Edge Function layer.

## 2026-07-12 — Added bounded, admin-triggered MVP crawl mode

**What:** Added `mvpCatalogCrawl.js`, a server-only orchestrator that stages a curated list of four
official MVP product pages (Watt, Terra, Volt, Photon) sequentially through the existing single-page
staging pipeline, unchanged. Each page gets its own `catalog_sources` row and checksum-addressed batch
(no contract changes needed — a crawl target is just a `source.url` variation), so 304 replay and
per-page failure isolation both work for free: one broken product page returns `{status: 'failed',
error}` in the results array without blocking the other three. One fetcher/store instance is shared
across the run so the existing per-host delay throttle applies across all pages. This is explicitly
not a scheduled/recurring job — it only runs when an admin sends `{mode: 'crawl', jobId}` to the
already-authenticated `catalog-ingestion` Edge Function, which now branches on `mode` before the
existing admin-allowlist check. No dynamic link discovery from a listing page — the target list is a
maintained constant, consistent with the project's "bounded, not ongoing scraping" ingestion principle.
**Verified:** 403 unit tests pass (10 new), production build passes, lint retains only the four
pre-existing warnings, graphify refreshed to 1,382 nodes and 2,897 edges.
**Boundary:** No canonical write, no cron/pg_cron job, no admin allowlist change. Not yet deployed to
the live Edge Function.

## 2026-07-12 — Redeployed catalog-ingestion with conditional-fetch replay

**What:** Redeployed the `catalog-ingestion` Edge Function (version 2) carrying the conditional-fetch
fix, using the same flattened-directory deploy convention as before. Only `mvpCatalogFetcher.js`,
`catalogIngestionStore.js`, `catalogIngestionStage.js`, and `catalogIngestionFunction.js` changed
content from the prior deployment; the other 11 files were redeployed unchanged.
**Verified:** Live smoke test confirms an unauthenticated POST still returns 401
(`catalog_admin_auth_required`).
**Handoff:** Both the deployment and the underlying fix are now shipped end-to-end. Next: crawler/
scheduler automation, then the admin review UI.

## 2026-07-12 — Wired real conditional-fetch (304) replay

**What:** Replaced the stubbed 304 handler in `mvpCatalogFetcher.js`, which hashed an empty body and
so could never match a real staged batch's checksum, with genuine conditional-fetch support. Added
`store.findLatestBatch()` to look up the most recent staged batch (and its `etag`/`last_modified` from
`catalog_import_artifacts`) for a source+adapter before fetching. `catalogIngestionStage.js` now calls
`ensureSource`/`findLatestBatch` before `fetcher.fetch`, forwarding a `conditional` object; the fetcher
sends `If-None-Match`/`If-Modified-Since` and, on a real 304, replays the prior checksum instead of
hashing nothing, so the existing exact-match `findBatch` lookup now correctly resolves to `status:
'existing'`. A 304 received without a conditional request throws the new
`not_modified_without_conditional_request` code — an anomalous-upstream case, not a design gap.
**Verified:** 397 unit tests pass (7 new), production build passes, lint retains only the four
pre-existing warnings, graphify refreshed to 1,371 nodes and 2,874 edges. No database migration was
needed — `etag`/`last_modified` columns already existed on `catalog_import_artifacts`.
**Boundary:** No Edge Function redeploy yet — this is application code sitting behind the already-live
`catalog-ingestion` function; redeploy is a deliberate separate step. No canonical write or admin
allowlist change.

## 2026-07-12 — Deployed protected catalog-ingestion Edge Function

**What:** Redeployed the `catalog-ingestion` Edge Function after the prior Codex platform usage-limit
rejection cleared. The function's source tree (`index.ts` plus 14 shared modules spanning
`supabase/functions/_shared`, `_shared/adapters`, and `src/lib/catalog`) was flattened into a single
sibling directory for the deploy payload, with cross-directory relative imports rewritten to flat
`./module.js` specifiers — the same convention the earlier `catalog-ingestion-admin` deploy used, since
Edge Function bundles don't preserve the repo's actual directory structure. No source logic changed.
**Verified:** JWT verification is enabled; an unauthenticated POST returns 401
(`catalog_admin_auth_required`). Full gates re-run clean: 390 unit tests pass, production build passes,
lint retains only the four pre-existing warnings, graphify refreshed to 1,370 nodes and 2,873 edges.
**Handoff:** Both `catalog-ingestion` and `catalog-ingestion-admin` are now live. Remaining B1.7-scope
ingestion work: real conditional-fetch (304) replay using last-known source checksum/etag instead of the
current stub, then the crawler/scheduler automation, then the admin review UI.

## 2026-07-12 — Added transactional catalog staging boundary

**What:** Added the append-only B1.9 staging migrations, including a service-only source resolver,
an explicit ingestion-admin preflight, and an allowlist-checked transactional RPC that inserts a
staged batch, checksum-addressed raw-artifact metadata, and normalized candidates atomically. Added
the Supabase Storage/RPC store with exact-byte verification, non-upserted uploads, conflict reads,
and cleanup on transaction failure, plus a protected `catalog-ingestion` handler and Edge Function
entrypoint. Canonical review and promotion remain separate.
**Verified:** The focused store/handler/staging suite passes (17 tests). The live RPC was exercised
inside a rollback-only transaction: batch, artifact, candidate, source, and temporary allowlist
rows appeared together and all residue returned to zero after rollback. The Supabase CLI and
`pg_dump` were unavailable, so no automated backup was produced; the required manual-backup
reminder remains active. Deployment was attempted with JWT verification enabled but was rejected by
the Codex usage limit before the platform created the function.
**Handoff:** Re-run the protected `catalog-ingestion` deployment after platform capacity returns,
then run the full test/build/graphify/commit gates. Do not add an admin allowlist row casually and
do not perform remote production ingestion until a reviewer is explicitly granted access.

## 2026-07-12 — Added bounded MVP product-page fetch and parser

**What:** Added a pure parser for one official MVP product page and a server-only fetcher that
revalidates the official host on every redirect, enforces timeout/size/content-type limits, honors
minimum host delay, computes the SHA-256 of the exact response bytes, and emits the existing parsed
adapter payload plus raw-byte/artifact metadata. The staging orchestrator now forwards those raw bytes
to the injected persistence boundary.
**Verified:** Focused parser/fetch/staging tests pass (13); full suite passes (381); production build
passes; lint retains only the four pre-existing warnings; graphify refreshed to 1,326 nodes and 2,774
edges. The parser ignores scripts and page prose, extracts only product title, class, flight ratings,
dimensions, and official source URL, and rejects non-product or incomplete pages.
**Boundary:** No Storage upload, staging-table write, migration, canonical write, or Edge Function was
added. The concrete fetcher exposes a 304 envelope but does not invent a prior checksum; conditional
replay remains behind the existing injected orchestrator contract until the transactional store can
supply last-known source state.
**Handoff:** Create the migration-backed transactional staging RPC/store only after the required
automated backup, then add the protected `catalog-ingestion` Edge Function around this verified path.

## 2026-07-12 — Wired the official MVP adapter through staging

**What:** Added `mvpCatalogStaging.js`, a server-only composition that selects the official MVP
adapter, binds its host allowlist, and invokes the generic staging orchestrator with the existing
pure `runManufacturerAdapter` contract. The generic orchestrator now rejects an adapter-version
mismatch before any network or persistence call.
**Verified:** The injected staging harness passes the real official MVP payload through mocked fetch
and storage boundaries, creates checksum-addressed raw-artifact and candidate persistence rows,
replays an existing checksum batch without a second write, rejects a 304 without an existing batch,
and rejects a stale adapter version before fetch. Full suite: 376 tests; production build passes;
lint retains only the four pre-existing warnings; graphify refreshed to 1,297 nodes and 2,712 edges.
**Boundary:** No concrete remote fetcher, Storage client, canonical write, admin allowlist change, or
database migration was added. The next environment-specific binding must remain server-only and
explicitly reviewed before promotion.

## 2026-07-12 — Added bounded official MVP source adapter snapshot

**What:** Added the server-only `mvp-catalog` adapter at version `1.0.0` with a bounded
source snapshot for Photon, Terra, Volt, and Watt. Each candidate carries the official product-page
URL, source class/dimension evidence, manufacturer identity, flight numbers, and a
`manufacturer_verified` confidence level. Candidates are sorted by normalized identity for stable
staging row order.
**Boundary:** The adapter consumes a server-owned parsed payload and validates the official
`mvpdiscsports.com` host. It does not fetch pages, copy images or prose, write Supabase rows, or
authorize canonical promotion. The existing non-production fixture remains separate.
**Verified:** 373 tests pass; production build passes; lint retains only the four pre-existing
warnings; and graphify refreshed to 1,289 nodes and 2,683 edges. Official source references are the
[MVP retail placards](https://mvpdiscsports.com/mvp-retail-placards/)
and the individual [Photon](https://mvpdiscsports.com/discs/photon/),
[Terra](https://mvpdiscsports.com/discs/terra/), [Volt](https://mvpdiscsports.com/discs/volt/), and
[Watt](https://mvpdiscsports.com/discs/watt/) pages.
**Handoff:** Keep live fetching, scheduling, admin review UI, and any canonical promotion behind
the existing server-only and explicit-review gates.

## 2026-07-12 — Open-dataset source check completed without adoption

**Finding:** A public 2020 PDGA-approved-disc CSV is mirrored in an R package, but the checked
listing does not establish a sufficiently clear dataset license/provenance chain for canonical
ingestion. The PDGA Developer Program is currently closed and its stated restrictions prohibit
storing data returned by its API.
**Decision:** Do not copy or promote that dataset. Continue with attributed official manufacturer
sources, checksum-bound raw artifacts, explicit review, and the existing server-only staging boundary.
No external dataset, migration, admin allowlist entry, or canonical catalog write was added.
**Handoff:** The next bounded slice is an official manufacturer-source adapter review; crawler,
scheduler, and admin UI remain out of scope.

## 2026-07-12 — Added bounded non-production MVP catalog fixture

**What:** Added a deterministic MVP manufacturer payload and adapter fixture with two representative
mold candidates, production-shaped lowercase adapter metadata, fixture-only evidence, and an explicit
approved review record. The fixture runs through the existing pure adapter contract and remains below
the staging/canonical-write boundary.
**Boundary:** The source is `fixture.example`, the reviewer principal is explicitly
`fixture-reviewer:non-production`, and no Supabase rows, Storage objects, admin allowlist entries, or
canonical writes were added.
**Verified:** Focused adapter/ingestion tests pass (13 tests); full suite passes (370 tests), build
passes, lint retains only the four pre-existing warnings, and graphify refreshed to 1,272 nodes,
2,643 edges, and 75 communities.
**Handoff:** Perform the open-dataset/source check before any production adapter or reviewer access.

## 2026-07-12 — Phase B B1.8 admin review and canonical promotion applied

**What:** Added the service-only `catalog_review_candidate` and
`catalog_promote_import_batch` RPCs, entity-specific static promotion allowlists, dependency-ordered
canonical writes, natural-identity conflict handling, candidate/alias/actor provenance links, and
the authenticated `catalog-ingestion-admin` Edge Function with JWT verification. Promotion requires
explicit review dispositions, a checksum-matched raw artifact, and one atomic transaction; exact
accepted-batch retries return idempotently.
**Security:** Anonymous/authenticated function execution is denied; the deployed Edge Function rejects
an unauthenticated request with HTTP 401; the admin allowlist remains empty after rollback tests. Raw
artifacts are required by a database batch-closure trigger, and missing-artifact promotion rolls back
canonical writes, provenance, and candidate state together.
**Backup:** Fresh follow-on backup is outside Git at
`C:\tmp\disc-golf-app-backups\20260712-212738`; custom archive 1,117 entries, 672,507 bytes,
SHA-256 `581462507D65312A20FF362A1A191C2F8F4D134B913D39716247B71441EE7A89`. The CLI-first dump
attempt fell back to PostgreSQL 17 `pg_dump` because Docker Desktop is unavailable.
**Verified:** Linked error-level DB lint returned zero results; migration ledger contains all three
B1.8 versions; successful review → promotion → retry and missing-artifact rollback transaction tests
passed with zero residue; the Edge Function is ACTIVE with `verify_jwt=true`; 368 unit tests, build,
and lint passed, with only the four pre-existing lint warnings. Graphify refreshed to 1,263 nodes,
2,622 edges, and 72 communities.
**Handoff:** Run one bounded non-production manufacturer fixture with an explicit review record before
granting a production reviewer access. Crawler, scheduler, and admin UI remain out of scope.

## 2026-07-12 — Phase B B1.7 candidate/artifact persistence applied

**What:** Added and applied the append-only candidate/artifact persistence boundary plus advisor
indexes. `catalog_import_artifacts` stores checksum-bound raw-response metadata; `catalog_import_candidates`
stores normalized identity/fields/evidence with server-computed checksums and validation/dedup/review
state; `catalog_import_candidate_reviews` is append-only audit history. A private ingestion-admin
allowlist and private `catalog-import-raw` Storage bucket complete the server-only boundary.
**Security:** RLS is enabled with no ordinary-client policies/grants; service_role is the only table
caller. Candidate source fields are immutable after staging, review history cannot be updated/deleted,
and raw object paths are `raw/<sha256>.raw`.
**Backup:** Fresh pre-index backup is outside Git at
`C:\tmp\disc-golf-app-backups\20260712-202618`; custom archive 1,085 entries, 612,325 bytes,
SHA-256 `17CFD4E5A1CE87D181BF0CA77B11BB6AFD98F1C71AA107EA63E31B8BDED2486B`; schema/data dumps are
also non-empty.
**Verified:** Rollback-only SQL and live constraint/trigger tests passed; anon/authenticated reads are
denied while service_role reads succeed; linked error-level DB lint returned zero results; scoped
advisors show no new catalog FK findings; 364 unit tests, production build, and lint passed (only the
four pre-existing warnings remain). The Supabase MCP runner recorded remote UTC migration versions,
so local filenames were reconciled to `20260713002434` and `20260713002750`.
**Handoff:** The admin review/promotion operation remains a separate gate; no canonical catalog write
path or Edge Function entrypoint was added.

## 2026-07-12 — Vercel project link and stale-branch diagnosis

**What:** Linked the workspace to the Discology Vercel project `disc-golf-app` (`prj_1IfaHXl5q4UFOgxwYXPAZASKL0Lg`)
through the authenticated CLI and verified the connected Vercel project/deployment list. Vercel is
connected to the GitHub repository `ItsRyanFromAtlanta/disc-golf-app` and the preview branch
`codex/phase-b-disc-foundation`.
**Finding:** The latest Vercel preview is commit `fa36652`; this workspace is three commits ahead locally,
so Vercel cannot deploy the current Codex work until the branch is pushed. The generated `.vercel` link
metadata and OIDC environment file are ignored; no secret values were printed.
**Boundary:** No push, redeploy, environment-variable mutation, or production change was performed.

## 2026-07-12 — Phase B B1.7 server-only fetch and staging contracts

**What:** Implemented the first approved B1.7 slice: persisted adapter keys now use lowercase
slugs, server-only fetch policy primitives enforce HTTPS/host/response/redirect limits, and a
dependency-injected staging orchestrator composes fetch, adapter, and persistence boundaries.
The orchestrator supports existing-batch replay and 304 handling but has no canonical-write path.
**Verified:** 26 focused catalog/ingestion tests; 359 total unit tests; production build passes;
lint retains the four pre-existing warnings. No migration SQL, Edge Function entrypoint, service-role
credential, or canonical catalog write was added.
**Handoff:** Candidate/artifact schema and the admin promotion operation remain separate migration,
security, and rollback review gates.

## 2026-07-12 — Phase B B1.7 remote adapter/server-ingestion design approved

**What:** Recorded the approved design boundary following B1.6. Remote fetching and adapter
execution are server-only; the browser repository remains canonical-read/owner-write only. The
design specifies allowlisted HTTPS fetching, immutable private raw artifacts, checksummed staged
candidates, idempotent import batches, separate admin promotion, and atomic dependency-ordered
canonical writes.
**Key decision:** staged candidates cannot use `catalog_entity_sources` because that table requires
an existing canonical FK. A future append-only candidate/artifact migration is required. Adapter
keys will use the database-compatible slug form (`mvp-catalog`) rather than the dotted test key
(`mvp.catalog`).
**Boundary:** This checkpoint adds documentation only. No Edge Function, migration SQL, service-role
path, or canonical catalog write was added.

## 2026-07-12 — Phase B B1.6 repository and manufacturer-adapter contracts

**What:** Added framework-free catalog repository and manufacturer-adapter contracts over the applied
B1.5 schema. Canonical catalog entities are read-only through the client boundary with cache fallback;
private configurations and draft/needs-changes submissions/evidence use owner-scoped payloads, stable
client IDs, and the existing durable outbox. Canonical, import-batch, and review writes are intentionally
not exposed.
**Adapter boundary:** A versioned pure adapter registry normalizes manufacturer payloads into staged
candidates with deterministic identity keys, supported-field declarations, evidence snapshots, source
references, confidence, capture time, and SHA-256 checksums. Adapters have no Supabase/network dependency
and cannot write canonical rows.
**Verified:** 13 focused contract tests; 346 total unit tests; production build passes; lint retains the
four pre-existing warnings. No migration or canonical catalog write was added. Graphify AST refresh was
attempted but its incremental run requested semantic extraction for changed docs/images and stopped because
no graphify API key is configured.
**Handoff:** Stop at the B1.6 contract checkpoint. Remote adapter/server-ingestion wiring requires a new
design review before implementation.

## 2026-07-12 — Phase B B1.5 catalog foundation applied

**What:** Applied and recorded the reviewed catalog foundation plus two append-only advisor index
migrations after a verified automated backup.

**Verified:** Four manufacturers link all 36 molds; 13 new tables have RLS; no test rows remain.
Rollback-only tests passed authenticated reads, canonical-write denial, owner CRUD, cross-user isolation,
submission transition, and submitted-row immutability. Advisors have no new catalog FK findings;
`catalog_import_batches` intentionally remains client-inaccessible with RLS/no policy/no grant.

## 2026-07-12 — Automated pre-migration backup policy

**What:** Replaced the repeated manual-confirmation gate with CLI-first automated backup: Supabase dump
when Docker is available, verified `pg_dump` fallback through pgpass otherwise, and a non-blocking
reminder only when neither route works.

**Verified:** The immediate Phase B backup is outside Git at
`C:\tmp\disc-golf-app-backups\20260712-190157`. Its custom archive contains 875 entries and is 512,096
bytes with SHA-256 `07135CED94F78FFE53D8BBAFCC43A99F6AA0ADED81FB1A5B2AFDD2F9517A77B6`;
separate schema/data dumps are also non-empty.

## 2026-07-12 — Reproducible Supabase CLI and psql connection

**What:** Installed PostgreSQL 17 command-line tools without the local server, pinned Supabase CLI
`2.109.1` as a project dev dependency, authenticated and linked the workspace to `disc-golf-app`, and
configured the standard user-level pgpass entry.

**Verified:** `npx supabase migration list` reads remote history; direct `psql` reaches Postgres 17.6 as
the hosted `postgres` role and returns the expected 36 molds. No credential value entered repository
files or command output.

## 2026-07-12 — Phase B B1.1–B1.4 catalog audit, draft, and review

**What:** Approved the normalized mold/plastic/run/stamp catalog and moderation design, confirmed the
fresh manual backup, audited the live DISCS schema/data/RLS/grants, and generated the unapplied
`phase_b_catalog_foundation` migration plus review/recovery packet.

**Key decisions:** Preserve all 36 mold UUIDs and compatibility fields; replace direct canonical inserts
with owner-scoped submissions; use typed provenance foreign keys with an exactly-one-target constraint;
keep adapters and review writes server-side; seed future representative data against the actively
exercised account rather than the larger but activity-empty disc account.

**Audit:** No mold duplicates, missing flight data, or missing legacy provenance. All 36 mold plastic
arrays are empty; 18 of 20 physical discs have plastic text. Existing mold policies use deprecated
`auth.role()` and broad grants, which the draft replaces with explicit `TO authenticated` reads and
least-privilege submission/configuration access.

**Review:** B1.4 tightened cross-manufacturer mold/plastic integrity, composite submission ownership,
submission status transitions, evidence destination checks, and the legacy `created_by` FK index.
The final 105-statement draft passes PostgreSQL syntax parsing with `pglast` 8.2.

**Boundary:** The reviewed migration remains unapplied. A fresh backup re-confirmation and explicit
apply approval are still required before any remote database change.

Newest entries first. One entry per meaningful unit of work. Keep entries short: what, why, decisions, gotchas.

---

## 2026-07-12 — Phase A A10 release candidate closed

**What:** Closed A10 after the automated equivalence, RLS, build/lint, browser, accessibility,
authenticated notification-route, and reload-persistence gates passed. The user also reported that
the independent authenticated-session/real-device check passed.
**Evidence boundary:** The second-session/device result is explicitly user-reported; Codex did not
directly observe that session or collect its device/OS metadata. The two-tab same-session limitation
therefore remains documented rather than silently reclassified as independent evidence.
**Handoff:** Phase A is complete. Stop at the Phase B DISCS data-foundation planning boundary; confirm
a fresh manual Supabase backup before any migration or FK-restructuring work.

## 2026-07-12 — Phase A A10 equivalence and release gates (in progress)

**What:** Added five deterministic equivalence tests covering Dexie reload durability, exactly-once replay,
concurrent offline starts, reconnect convergence, and crash-bridge identity preservation. Hardened one
order-sensitive Dexie assertion to test the contract rather than iteration order.
**Database:** After fresh backup confirmation, applied `phase_a_a10_indexes` with a covering
`notifications(activity_id, user_id)` index; live verification confirms the index exists and the notification
foreign-key advisor finding is cleared.
**Verified:** 333 tests pass, build passes, browser landing/protected-route smoke passes, and lint retains
only the four pre-existing warnings. A signed-in browser smoke also completes a freeform session and opens
the notification sheet in its expected empty state; direct `/notifications` navigation and reload/session
persistence also pass. Independent cross-device coverage remains deferred because this task has one signed-in
browser session.

---

## 2026-07-12 — Phase A A9 notification foundation (in progress)

**What:** Added the durable notification migration/RPC contract, Dexie v4 mirror and local outbox adapter,
deterministic activity/sync notification producers, and the shared-header bell badge with accessible sheet/deep-link UI.
**Decisions:** The first surface is deliberately limited to actionable activity review and poisoned-sync attention.
Unresolved dedupe keys update the existing row while preserving its read state, preventing badge noise.
**Verified:** Migration applied to the backed-up project; RLS, table grants, and public/private RPC ACLs were
checked live. 328 tests pass; lint retains only the four pre-existing warnings; production build passes.
Authenticated cross-device/browser verification remains because the project lacks a valid test session.
**Browser:** Local Vite verification confirms the landing page renders without a Vite error overlay and
unauthenticated `/notifications` redirects to login. The authenticated list and cross-device cases remain
blocked on a valid test session.
**Negative DB verification:** Live rollback checks confirm `anon` cannot execute the notification RPC and
the `authenticated` role without a JWT is rejected as unauthenticated, both with zero data residue.

---

## 2026-07-12 — Phase A A8 history and recovery client

**What:** Completed A8 with a Dexie v3 audit store and ordered recovery outbox, canonical activity-led
history, offline-first hide/restore and practice-detail correction, sync/incomplete status badges, and a
30-day Recently Deleted restore surface. Detail edits now use the audited recovery path instead of
direct typed-table updates.
**Decisions:** Activities own visibility and lifecycle presentation while typed practice tables remain
the sporting-fact authority. Hidden activities are removed before metric inputs are assembled; restore
therefore recalculates them naturally. Pending local state wins over remote hydration, and local-only
activities render without synthesized attempts, makes, or events.
**Verified:** 324 tests pass, including atomic rollback, ordered RPC mapping, optimistic hydration,
canonical history, and route metadata. Lint retains only four pre-existing warnings and the production
build passes. `agent-browser` is installed globally and verifies non-blank, error-overlay-free landing
and history-route navigation; unauthenticated routes correctly redirect to login. Local Supabase rejects
anonymous sign-in, so a valid test session is still needed for authenticated history interaction. A9 is
next; switch to GPT-5.6 Terra medium for that normal UI/persistence slice.

## 2026-07-12 — Phase A A8 server and metric contracts

**What:** After fresh backup confirmation, added and applied the A8 history/recovery RPC migration.
Authenticated public invoker wrappers call private owner/version/idempotency-validating functions for
hide/restore and audited practice notes/tags correction. Added a versioned pure-JavaScript metric
registry that declares sources, windows, exclusions, confidence, inputs, and capture requirements.
**Decisions:** Typed tables remain authoritative; corrections atomically update the current notes/tags
and append previous/new audit values. Valid incomplete practice facts remain metric-eligible; hidden or
nonterminal/empty activities do not. Ordered-event metrics reject batch summaries. Legacy typed-table
grants remain until A10 because InstantLaunch still uses the staged direct parent writer.
**Verified:** Live rollback tests passed positive, retry, stale, invalid-state/source, cross-user,
idempotency-reuse, and audit-ID collision cases for freeform and regimen paths, with zero residue.
Anonymous RPC and direct authenticated activity/audit writes are denied; advisors have no new A8
findings. All 315 tests, lint (four pre-existing warnings), and production build pass. Switch to Terra
medium for the A8 client/history UI slice.

## 2026-07-12 — Phase A A7 practice lifecycle integration

**What:** Wired freeform and regimen InstantLaunch sessions into the A4 activity repository using the
existing parent UUID as the activity identity. Added a stable installation ID, ordered lifecycle RPC
sync, local completion/incomplete transitions, route-aware pause/resume, and active shell/PLAY resume
surfaces.
**Decisions:** Lifecycle rows flush before typed parent/summary/gesture queues to satisfy A6 owner FKs;
InstantLaunch remains authoritative for batch summaries and real gesture events, with no synthesized
`putt_events`. Regimen metadata carries its route identity for resume links. No schema or Supabase
migration was needed.
**Verified:** 310 unit tests pass, including Dexie lifecycle sync ordering and RPC argument mapping;
production build passes; lint retains only the four pre-existing warnings. A8 owns history correction,
hidden/restore, and metric treatment.

## 2026-07-12 — Phase A A6 server lifecycle applied and verified

**What:** Applied the A5 activity envelope/backfill, A6 lifecycle RPCs, and the FK-index advisor
follow-up to Supabase after fresh backup confirmation. Added public invoker wrappers over private
security-definer implementations, authenticated-only reads, and serialized lifecycle writes.
**Verified:** Backfill counts match the audit; no orphan or duplicate-current rows remain. Live tests
covered RLS isolation, anonymous/direct-DML denial, stale/cross-user/admin rejection, idempotent retry,
round confirmation, replacement, supplied event IDs, and concurrent starts. Advisors report no new
public security-definer or A5 owner-FK findings; existing unrelated warnings remain baseline debt.
**Boundary:** A6 is complete. A7 may wire the local repository into freeform practice, then regimen;
hide/restore/correction remain A8 scope.

## 2026-07-12 — Phase A A6 server lifecycle RPC draft

**What:** Rechecked the live Supabase project and added the CLI-generated
`20260712195448_phase_a_activity_lifecycle_rpc.sql` draft. It exposes authenticated invoker wrappers
for draft creation and lifecycle transitions while keeping the privileged implementation in a
non-exposed schema.
**Decisions:** Per-user advisory transaction locks serialize starts and replacement closes. RPCs enforce
auth ownership, expected state/version, canonical commands/sources, supplied event IDs, idempotency, and
atomic activity/event writes. Practice replacement auto-closes; round replacement requires confirmation.
Client RPCs reject `admin_repair`; hide/restore/correction remain A8 scope.
**Boundary:** The A5 and A6 migrations are both unapplied. Fresh backup confirmation, remote apply,
authenticated negative/concurrency/retry tests, and advisor verification remain before A6 completion.

## 2026-07-12 — Phase A A5 live schema audit and migration draft

**What:** Confirmed a fresh manual Supabase backup; audited the live project’s tables, ownership,
RLS, grants, indexes, advisor findings, practice/round relationships, and historical test data. Added
the unapplied `activities`, `activity_state_events`, and `audit_events` migration draft plus the A6
review/recovery packet.
**Decisions:** Reuse specialized domain UUIDs as activity IDs and enforce owner-consistent composite
foreign keys. Backfill only authoritative facts, classify empty legacy rows as drafts, and fabricate no
pause/resume history. New lifecycle tables expose authenticated reads only; A6 must add hardened,
serialized RPC writes. Existing unrelated advisor warnings remain baseline debt.
**Verified:** No ownership mismatches, exclusive-parent violations, or cross-table UUID collisions were
found. No remote migration or data change was performed. The local Supabase CLI scaffold was generated
and the migration was created through the CLI as required.

## 2026-07-12 — Phase A A4 transactional local activity repository

**What:** Upgraded the local database to Dexie v2 with `activities` and append-only
`activityStateEvents`; added an ordered lifecycle outbox with dependency, retry, error, and poison
metadata; implemented the local activity repository and active subscription; and added an unwired
InstantLaunch recovery bridge plus a lossless v1→v2 state migration.
**Decisions:** Activity/state-event/outbox writes commit in one Dexie transaction. Practice replacement
closes the prior practice and starts the replacement atomically; rounds remain unchanged until explicit
confirmation. Each transition depends on the previous lifecycle idempotency key. InstantLaunch still
owns real-time putt capture and its existing outbox; A7 will wire the bridge into practice screens only
after the full pause/resume/finalize flow is exercised.
**Verified:** 34 focused A4 tests cover real IndexedDB schema upgrade, concurrent starts, single-active
enforcement, idempotent retries, ordered dependencies, delayed/poisoned attempts, live subscriptions,
lossless InstantLaunch recovery, and rollback at every partial-write boundary—including failure after
closing a replaced practice. Full suite: 304 tests; build passes; lint has four pre-existing warnings.
No Supabase migration, remote lifecycle RPC, or UI change.

## 2026-07-12 — Phase A A3 pure local lifecycle engine

**What:** Added the framework-free `src/lib/activityLifecycle/` contract: canonical lifecycle/type/
source/reason constants, named timing and retention policies, a complete transition table, an
optimistic-concurrency-aware pure reducer, append-only state-event payload construction, and a pure
start planner that distinguishes atomic practice replacement from required round confirmation.
**Decisions:** `hidden_at` remains visibility rather than lifecycle state; old `incomplete` activities
remain terminal; drafts can only become active through `start` (the first meaningful sporting fact);
already-satisfied commands do not increment versions or emit duplicate state events. Repository-level
idempotency-key storage, Dexie atomicity, and the InstantLaunch bridge remain A4 scope.
**Verified:** 32 focused lifecycle tests and 280 full tests pass; production build passes; lint reports
only the four pre-existing warnings. No migration, persistence, Supabase, or UI changes.

## 2026-07-12 — Phase A A2 shared application shell

**What:** Replaced the implicit document scroll/four-tab framing with the shared A2 shell: route-aware
standard and active shells, global header, accessible notification empty-state sheet, toast host,
scroll region, safe-area-aware fixed PLAY/DISCS/ME tab bar, per-route scroll restoration, and approved
current-tab scroll-to-top/root behavior.
**Boundary:** No activity state, lifecycle repository, notification persistence, or database work was
added. The bell intentionally hosts only an empty state until A9; the activity pill remains hidden until
A7 connects a real activity. Existing `/practice`, `/bag`, `/profile`, and legacy routes remain valid.
**Verified:** 248 tests, lint with only four pre-existing warnings, and production build pass. Local
browser smoke check was clean, but anonymous auth is disabled in the connected environment, so the
authenticated shell still needs real-account/device verification.

## 2026-07-12 — Phase A A1 route metadata and shell audit

**What:** Audited the shipped routes, AppShell/TabBar, scroll ownership, onboarding/crash-recovery
redirects, and current compatibility alias. Added framework-free `src/lib/routeMetadata.js` plus tests
that classify all current route families under approved PLAY/DISCS/ME sections, identify active capture,
preservation and scroll behavior, and resolve `/regimens` to its supported nested route.
**Decision:** A1 intentionally does not change rendered navigation or add a header/scroll host. The
existing four-tab UI remains until A2 consumes the contract, avoiding a partial shell migration.
**Verified:** 20 focused route/navigation/crash-recovery tests, lint (four existing warnings only), and
production build pass. No database work.

## 2026-07-12 — Phase A shell and lifecycle walkthrough approved

**What:** Completed and consolidated the pre-code walkthrough for PLAY/DISCS/ME shell behavior,
active-activity pill, notification overlay, tab scroll/root rules, activity lifecycle, interruption and
offline behavior, scrolling/sheets/safe areas, accessibility, repository and transaction boundaries,
conflict policy, migration ordering, tests, reviews, and A1–A10 implementation sessions.
**Decisions:** First meaningful fact activates a draft; navigation pauses; backgrounding has a tunable
60-second grace; new practice atomically closes the previous practice with constrained Undo; rounds
require confirmation; old incomplete activities are correctable but not reactivated; local finalization
never waits for the network; UI never writes lifecycle state directly.
**Scope:** Documentation only. No application code or database migration changed.

## 2026-07-11 — Production documentation and development-operations baseline

**What:** Rebuilt the repository entry-point and added production-grade contribution, security,
changelog, review, context-efficiency, integration, testing, environment, release, backup/restore,
incident, iOS-readiness, field-testing, and ADR documentation.
**Tooling:** Verified Graphify 0.9.6 and RTK 0.43.0 are installed. Graphify remains the generated code
map; RTK remains Claude-hook/manual-only; Composio is optional and least-privilege rather than a Codex
dependency. Generated Graphify/native build output is ignored.
**Workflow:** Small reviewed branches, checkpoint commits, pushes after green major stages, protected
`main`, risk-based review gates, and explicit fresh-task/handoff points replace context-heavy long
threads. No application or schema code changed.

## 2026-07-11 — Phase A contracts + Codex/OpenAI workflow migration

**What:** Documented the approved activity lifecycle, audit/provenance, metric registry, shared shell,
notification, offline-transition, browser-E2E, and PWA contracts in `PHASE_A_ARCHITECTURE.md`; added
`CODEX_WORKFLOW.md` and token-efficient project Codex defaults.
**Model policy:** GPT-5.3-Codex medium for normal implementation; GPT-5.6 high for architecture,
migrations, security/RLS, synchronization, and complex engines; GPT-5.4 mini low only for bounded
mechanical tasks with normal verification.
**Setup:** Supabase MCP was already configured. Official OpenAI Docs MCP installation was attempted but
Windows blocked launching `codex.exe`; the one-time manual command is recorded in `CODEX_WORKFLOW.md`.
No application or schema code changed.

## 2026-07-11 — Whole-product roadmap reconciliation

**What:** Added `PRODUCT_ROADMAP.md` as the current sequencing/disposition authority and reconciled
the expansion bundle, original blueprint, shipped implementation, and backlog.
**Decisions:** PLAY / DISCS / ME replaces PLAY / BAGS / STATS / PRO; statistics become contextual with
ME as the career summary; existing `disc_molds`/`discs` are extended instead of adding a parallel
Universe/Warehouse tree; postponed work now has explicit revisit triggers.
**Docs:** Updated `DEVELOPMENT_PLAN.md`, `SCREEN_SPECS.md`, `AGENTS.md`, and `FEATURE_BACKLOG.md` while
preserving superseded/rejected history. No application or schema code changed.

## 2026-07-11 — Expansion planning: community mold statistics backlog

**What:** Added opt-in, anonymized community mold statistics as a deliberate later feature.
**Decision:** Personal physical-disc performance stays private by default; community aggregates require explicit consent and minimum-sample/privacy thresholds, and remain separate from personal coaching metrics.
**Scope:** Documentation only; no application or schema code changed.

## 2026-07-11 — Screen 12 code review + fix pass (Trophy Room hardening)

**What:** `/code-review high` on the full Screen 12 diff (8-angle parallel finder pass, 10 one-vote
verifiers) found 9 confirmed issues; fixed all 9, re-verified live against the test account.
**Key fixes:**
- **Security (most severe):** `xp_events`/`badge_progress` had ownership-only RLS with no value
  validation, and `profiles`' row-level UPDATE policy meant `xp`/`level` were ALSO directly writable —
  any authenticated client could forge arbitrary XP/levels/badge unlocks from the browser console.
  Fixed via `layer5_gamification_hardening.sql`: bound CHECK constraints, a real unique constraint on
  `xp_events (user_id, source_type, source_ref)`, and three new SECURITY DEFINER RPCs
  (`append_xp_event`, `set_profile_level`, `upsert_badge_progress` — mirrors the existing `merge_discs`
  pattern) with direct table/column writes revoked. **Gotcha:** a plain column-level `REVOKE UPDATE
  (xp, level) ... FROM authenticated` was a no-op — Supabase's default table-wide grant supersedes it;
  the real fix is revoking the table-wide UPDATE grant and re-granting only the safe columns. Verified
  with `has_column_privilege` and a live forged-write attempt from the browser (all three vectors now
  correctly rejected).
- **Idempotency race → now atomic:** `append_xp_event`'s `ON CONFLICT DO NOTHING` on the new unique
  constraint replaces the old client-side check-then-insert, closing the double-XP race for real
  (confirmed by 4 independent review angles).
- **One bad badge metric no longer kills all evaluation:** `evaluateBadges` now isolates each badge in
  its own try/catch; a criteria/metric mismatch is skipped and logged, not fatal to the whole pass.
- **Badge catalog/seed/DB drift closed:** new `scripts/generate-badge-seed.mjs` derives
  `layer5_gamification_seed.sql` mechanically from `badgeCatalog.js`, so the SQL can no longer silently
  diverge from the JS catalog via hand-transcription.
- **Trophy Room now actually reconciles on load** (it previously only read existing data, contradicting
  the save-path comments that promised reconciliation) — calls `evaluateAndPersistBadges` before
  rendering, best-effort.
- **Stale celebration banner fixed:** `celebrationEvents` now clears in `handleStart`, so replaying
  immediately after an unlock can't leak the old banner onto the new session's summary.
- **"Iron Arm" now actually scoped to putters:** `putterChainHitsMax` filters to
  `primary_putter`/`backup_putter` discs before taking the max (previously any disc role qualified).
- **Efficiency:** `awardPostSession` no longer double-scans the full `xp_events` table (once for
  "before," once inside the old recompute) — `append_xp_event` returns the atomically-updated total
  directly, so profile XP tracking is now O(1) reads instead of O(lifetime event count).
- **Reuse:** `noMissRegimenRuns` now calls the existing `isCleanSet` from `regimenScoring.js` instead of
  a reimplemented copy of the same predicate.
**Live-verified against the real Supabase project (test account, `layer3test@example.com`):** completed
a second Foundation run (28/30, one imperfect set) — XP/badge_progress updated via the new RPCs with
exact correct values (1550→1930 XP, badge progress recalculated correctly, no incorrect Flawless
re-trigger); Trophy Room reconciliation ran silently as a no-op when nothing needed catching up; direct
forged writes to `xp_events`/`profiles`/`badge_progress` all correctly rejected; legitimate profile
field edits (division) still work post-lockdown.
**Not fixed (deliberately out of scope):** full server-side re-implementation of badge/scoring criteria
in SQL — would require duplicating the JS metric registry in Postgres, disproportionate for a
solo/small-group app with no competitive leaderboard yet. The bounds/constraints/RPC lockdown closes
the "instant max level" attack without that scope expansion.

## 2026-07-08 — Session Summary (SHIPPED) — Layer 4, Screen 9 (Layer 4 complete)

**What:** Screen 9 per `SCREEN_SPECS.md` — one `SessionReport.jsx` component (hero scoreboard, putter
performance breakdown, distance-vs-30-day-baseline matrix with a ⚠️ at >10-point dips, per-set/
per-distance breakdown, notes/tags, Replay/Dashboard footer) rendered from **three** entry points:
`HistoryDetailPage.jsx` (rewritten, now a thin fetch-and-normalize wrapper), `RegimenRunPage.jsx`'s
post-run summary phase, and a **new** post-session summary phase on `FreeformLogPage.jsx` (freeform
previously had none — ending a session silently dropped back to the launcher with no recap). New pure
functions `distanceDropOff` and `putterBreakdown` (`lib/insights/dropOff.js` / `putterBreakdown.js`,
registered in `insights/index.js`), plus `regimenRunAggregate` alongside the existing `sessionAggregate`
in `lib/history.js`. `CelebrationOverlay.jsx` is a real (but inert) component — renders nothing until
Layer 5's XP/level-up events exist to feed it.
**Model:** Sonnet 5, per Layer 4's recommendation for Screen 9 UI (no model switch needed after Screen 8).
**Key decisions:**
- **Putter breakdown only reflects gesture-captured putts** — batch-ribbon fills never create
  `putt_events` (data-split rule), so a session that used the batch ribbon shows fewer attempts here
  than its true total. Documented, not a bug.
- **Baseline window is relative to the entry's own timestamp**, not "now" — an old History entry
  compares against its own contemporaneous 30 days, not today's; the post-session views (which *are*
  "now") use `Date.now()` directly since there's no meaningfully different reference point available.
- **Freeform has no streak-peak stat** — `putt_distance_logs` has no per-row streak column (only
  regimen sets track `longest_streak`), so `SessionReport`'s streak line is an optional prop, present
  for regimen entries and omitted for freeform rather than fabricated.
- **Milestone/bonus recap section dropped** from the blueprint's wireframe — the per-row Clean badges
  already communicate clean-set info, and there's no "First Putt" bonus in the engine (Screen 7's
  scoring-model mapping), so a separate recap section would be redundant UI for data that doesn't exist.
- **Abandoning a regimen run now also shows the summary** (previously it silently returned to the
  launcher with nothing) — parity with "every session, however it ends, gets a recap," matching
  freeform's new behavior and the blueprint's intent.
**Live-verified in browser against the real Supabase project:** finished a freeform session (tap-scored
2/3, active putter Anode) — summary showed putter breakdown (Anode 2/3, 67%), a correctly-triggered ⚠️
distance warning (today 67% vs. a 100% baseline from earlier test sessions), saved notes/tags (confirmed
via direct query after initially misreading a same-tick race in my own test script, not a real bug), and
Dashboard nav; opened the same session from History — identical report, same tags shown active,
confirming the "one component, two entry points" goal. Started and abandoned a regimen run (2/2 makes,
streak peak 2) — summary correctly showed "Abandoned," 3.5 pts, a clean-set badge, and a *non*-triggered
baseline comparison (today's 100% beat the 86% baseline, so no warning); confirmed `completed: false`/
`total_score: 3.5` in Supabase; Replay correctly launched a fresh run.
**Layer 4 status: COMPLETE (Screens 7, 8, 9 all shipped).** Next: Layer 5 — Analytics + Progression
(Screens 10–13: Analytics tower, Career Hub, Trophy Room/XP ledger, UDisc ingestion), Sonnet 5 for UI /
Opus 4.8 for the UDisc parser + badge evaluator.

---

## 2026-07-08 — Scoring Canvas (SHIPPED) — Layer 4, Screen 8

**What:** Screen 8 per `SCREEN_SPECS.md` — split-screen tap becomes the primary scoring input (signed
off last session), with gesture and panic as alt modes. New `TapZone.jsx` (fixed 50/50 MADE/MISSED,
no streak-driven growth — unlike `GestureZone`, tap targets don't need bigger hit-zones), `PanicZone.jsx`
(tap=make/hold=miss, single high-contrast zone), `StackTracker.jsx` (pip row from gesture events + batch
tally, diamond marker on a pressure-putt slot), `CanvasToolbar.jsx` (active-putter chip + ad-hoc SWAP via
the existing `PutterPicker`, weather picker, weather→backup swap-suggestion banner, EDIT trigger),
`EditTallyDrawer.jsx` (manual makes/attempts correction via a tally delta). `lib/scoringCanvas.js`:
`suggestBackupSwap` (>15mph wind or rain → backup_putter suggestion, matching
`MASTER_PROJECT_BLUEPRINT.md` task 4.6's documented threshold) and `stackPips`. `PuttingCanvas.jsx`
gained optional `toolbar`/`stackTracker` slots (backward compatible); `CanvasContextBar.jsx` gained a
Tap/Gesture/Panic mode `ChipGroup`. Wired symmetrically into both `RegimenRunPage.jsx` and
`FreeformLogPage.jsx` (mirrors this repo's existing duplication convention between the two run-modes,
not a new abstraction).
**Model:** Sonnet 5, per Layer 4's recommendation for Screen 8's UI work (Screen 7's rules engine was
Opus 4.8 last session; the input-model decision was already signed off, so this session was pure UI).
**putter_disc_id now actually gets written:** `useInstantLaunchSession.js`'s `gestureMake`/`gestureMiss`
gained an optional `putterDiscId` param threaded into `buildPuttEventRow` — Layer 1 added
`putt_events.putter_disc_id` months ago but nothing wrote it until now. `stateReducer.js` gained
`profileDefaults.inputModeDefault` (defaults `'tap'`), mirroring `diagnosticModeDefault`'s existing
pattern.
**Bug found and fixed during live verification (real, pre-existing — not introduced by Screen 8):**
`syncScheduler.js`'s `attemptFlush` no-ops `notifyOutboxChanged()` while a flush is already in-flight
(by design, to avoid overlapping flushes). But `endSession` calls `finalizeCurrentStageSummary` (which
enqueues a summary write and immediately triggers a flush) followed by enqueuing the parent update
(`completed`/`total_score`, or now `weather_condition`/`wind_mph`) and *another* `notifyOutboxChanged()`
— which lands while the first flush is still SYNCING and gets silently dropped. The parent update sat
in the outbox until the next `online`/`visibilitychange` event or unrelated action triggered a fresh
flush (confirmed via live repro: weather fields stayed null in Supabase until a page reload). This
exact "finalize summary → enqueue parent update" shape already existed in `RegimenRunPage`'s original
`handleFinishStage`, so `completed`/`total_score` could have silently lagged the same way — Screen 8
just exercised it first because I was checking a new field. **Fix:** `attemptFlush`'s success path now
re-invokes itself immediately when the resolved flush still finds `hasPending` true, instead of settling
for PENDING and waiting for an external trigger. Converges naturally (each retry only re-fires while the
outbox actually still has items). No unit test added — `syncScheduler.js`'s own header comment documents
it as browser-only (window/document APIs), verified live instead (see below).
**Live-verified in browser against the real Supabase project:** tap-scored makes/misses (confirmed
`putt_events.putter_disc_id` matches the active disc via a direct query), stack tracker pips update
correctly (make/miss/pending), streak display, Undo; ad-hoc SWAP via the toolbar drawer; Gesture and
Panic mode toggles both score correctly; EDIT drawer corrects a stage's tally via delta; weather
selection + swap-suggestion logic (correctly suppressed — this test account has no `backup_putter`
disc yet, matching `suggestBackupSwap`'s unit-tested behavior); reproduced the sync-scheduler race live,
applied the fix, then re-ran the identical scenario and confirmed `weather_condition`/`wind_mph` land in
Supabase immediately with no reload needed.
**Layer 4 status: Screens 7–8 COMPLETE.** Next: Screen 9 (Session Summary — unified `SessionReport`,
putter-performance breakdown now has real `putter_disc_id` data to key off, distance drop-off matrix),
Sonnet 5.

---

## 2026-07-07 — Custom Routine Builder (SHIPPED) — Layer 4, Screen 7

**What:** Screen 7 per `SCREEN_SPECS.md` — a custom routine builder at `/practice/regimens/new`.
`src/lib/routineBuilder.js` (pure rules-engine core: `blankStage`, `totalPutts`, `canAddStage`,
`estimateDifficulty`, `buildRegimenPayload`, `maxScorePreview`), `src/lib/regimens.js` (data layer:
`createCustomRegimen`, `fetchCustomRegimens`, `fetchRegimenWithSets`), `RoutineBuilderPage.jsx` +
`StageCard.jsx`. Wired into Screen 4's Zone B NEW segment, Zone C trigger, and Clone & Tweak on every
regimen card.
**Model:** Opus 4.8, per Layer 4's recommendation for the rules-engine work (confirmed active before
starting). Screens 8–9 (Sonnet-5 UI) deferred to a later session — see checkpoint below.
**Zero schema work:** Layer 1 already shipped every dependency — `putting_regimens.user_id`/`drill_type`/
`rules_config`/`archived`, nullable `difficulty`, system-or-own RLS, and the DB-side 100-putt interlock
(`enforce_routine_putt_cap` trigger on `putting_regimen_sets`). A custom routine is just a
`putting_regimens` row (user_id set) + `putting_regimen_sets` rows that run through the SHIPPED
`RegimenRunPage` + `regimenScoring.js` engine unmodified.
**Key decisions:**
- **Scoring-model mapping (the rules-engine call):** the blueprint's per-stage `[First][Last][Streak]
  [Clean]` toggles don't map to the shipped engine (which scores streak/clean/completion at the ROUTINE
  level and pressure per-set). Per the "reuse engine unmodified" mandate, the builder exposes the knobs
  the engine actually reads — routine-level Streak/Clean/Completion bonus toggles + a per-stage
  "Pressure last putt" toggle (→ `pressure_multiplier`). The blueprint's per-stage `First` bonus is
  **not built** (no engine column; adding one would violate the mandate). Documented divergence.
- **`maxScorePreview` IS the shipped engine:** the live totalizer score composes `computeSetScore` +
  `computeCompletionBonus` over a hypothetical perfect run, so the preview can never drift from what the
  run page actually scores. Unit test asserts it equals a hand-computed 221 for a known config.
- **Screen 8 input model (decided this session, built next):** split-screen MADE|MISSED tap becomes the
  primary scoring input; the shipped swipe-cone `GestureZone` demotes to an opt-in "gesture mode."
  `PuttingCanvas` is slot-based so `TapZone` is a drop-in sibling — nothing tested gets deleted.
**Bug caught & fixed (from Layer 3):** Screen 4's Zone B STANDARD/CUSTOM filters tested `r.created_by`,
a column that doesn't exist (schema uses `user_id`). Latent because no custom routines existed until
now — the first saved routine would have mis-filed under STANDARD and never appeared in CUSTOM. Fixed to
`r.user_id == null` (standard) and `r.user_id === user.id && !r.archived` (custom).
**Live-verified in browser against the real Supabase project:** built a 2-stage routine, watched the
totalizer + max-score preview update live (confirmed ≈161 and ≈210 against hand math), confirmed the
Add-Stage 100-putt disable + over-cap red count; Save & Launch inserted `putting_regimens` (201) +
`putting_regimen_sets` (201) and landed on the shipped run page running the custom routine; confirmed it
then appeared under the CUSTOM tab (validates the `user_id` fix); Clone & Tweak from the "Foundation"
system regimen prefilled name/stages/bonuses/pressure correctly. (One test routine, "Layer 4 Test
Ladder," remains in the dev account's DB — harmless, a valid custom routine.)
**Layer 4 status: Screen 7 COMPLETE.** Next: Screens 8 (Scoring Canvas — split-screen tap primary) + 9
(Session Summary), both Sonnet-5-recommended UI — switch model before resuming.

---

## 2026-07-05 — Dashboard/Bag/Putter hubs (SHIPPED) — Layer 3 complete (hubs)

**What:** Screens 4–6 per `SCREEN_SPECS.md`: `PracticeMenuPage.jsx` evolved in place into the Dashboard
Hub (streak badge, Zone A hero with crash-recovery > resume-last > first-session priority chain +
persistent Quick Start card, Zone B STANDARD/CUSTOM/NEW `ChipGroup` launchpad over the 5 fixed
regimens, Zone C disabled planning-drawer stub); `BagPage.jsx` grew a client-side MY BAGS/PUTTERS/
UNIVERSE segmented header (no new routes — `/bag/locker`, `/bag/manage`, `/bag/discs/:id` unchanged);
new `PutterLineup.jsx` + `FlightCurve.jsx` (role swimlanes over `discs.role`, wear slider, 300-hit
odometer alert); new `UniverseBrowser.jsx` (Manufacturer → Mold → Plastic accordion over `searchMolds`,
ghost-slot wishlist card).
**Model:** Sonnet 5, per Layer 3's recommendation (confirmed active before starting).
**New pure functions (all unit-tested):** `flightPath`/`wearAdjustedFlightNumbers`/
`proposeWearStepDown` (`lib/flightCurve.js`), `discIdsToUnsetForNewPrimary`/`situationalRoleCount`
(`lib/discs.js`, mirrors `bagIdsToUnsetForNewDefault`'s one-default pattern for the partial-unique-index
primary_putter constraint), `capacityTier` (`lib/bags.js`), `stabilityGaps` (new `lib/wishlist.js`),
`heroCardState` (new `lib/dashboardHero.js`).
**Decisions (confirmed in conversation before building):**
- **Screen 5 tabs are client-side state, not routes** — one page at `/bag`, matching the existing
  `ChipGroup`/segmented pattern elsewhere rather than adding `/bag/putters` + `/bag/universe`.
- **Zone C (custom planning drawer) is a disabled stub this layer** — same treatment as
  CLONE & TWEAK; the real numeric-stepper sheet waits for Layer 4's routine builder context.
- **Universe tab's plastic tier hands off to the existing `DiscFormPage`** (`?mold=&plastic=`
  query params) instead of a bespoke weight-selection drawer — `disc_molds` has no per-run/weight rows
  to back one, so this reuses the shipped add-disc flow rather than inventing new schema/UI.
- **Hero card sources "resume last" from `suggestNextSession` (real Supabase history), not the
  localStorage `smartPredictionCard`** — nothing writes that field yet (`updateSmartPredictionCard`
  exists in `useInstantLaunchSession` but is never called), so reading it directly would always resolve
  to null. Real crash-recovery state still reads the live InstantLaunch buffer.
**Live-verified in browser against the real Supabase project:** created a test account (password
auth — anonymous sign-in still needs the Supabase dashboard toggle from Layer 2), ran onboarding,
confirmed the Dashboard's first-session hero + 5 STANDARD regimen cards + disabled Clone & Tweak/Zone C
render; searched the Universe tab (MVP → Anode → Standard plastic), confirmed the mold/plastic prefill
lands correctly on `DiscFormPage`, submitted a real disc; on the Putters tab, set that disc's role to
Primary (confirmed the swimlane move + a PATCH to `discs` in network) and moved its wear slider
(confirmed a second PATCH) — both against live data, not mocked.
**Layer 3 status: COMPLETE.** Next: Layer 4 — Execution engine (routine builder, scoring canvas input-
model decision, session summary), Opus 4.8 for the rules engine / Sonnet 5 for UI.

---

## 2026-07-05 — Splash/Auth/Onboarding (SHIPPED) — Layer 2 complete (front-door slice)

**What:** Screens 1–3 per `SCREEN_SPECS.md`/`MASTER_PROJECT_BLUEPRINT.md`: `SplashPage.jsx` (offline
badge, static social-proof line, GET STARTED / guest escape hatch), `AuthPage.jsx` rewrite (email
6-digit OTP via `OtpInput.jsx`, password fallback, Apple/Google SSO buttons, guest→account conversion),
`OnboardingPage.jsx` + 3 step components (goal cards, zero-typing putter provisioning, haptic
test + units).
**Model:** Sonnet 5, per Layer 2's recommendation (confirmed active before starting).
**Decisions (see SCREEN_SPECS.md Screen 3 for the mold one; both were sign-off'd in conversation):**
- **Default putter mold:** blueprint says "Axiom Cosmic Pilot," which isn't seeded. User picked
  **Axiom Envy** (real seeded Axiom putter) over the alternative "Axiom Pixel" (not a real
  manufacturer/mold pairing in the catalog).
- **Onboarding-complete signal:** no new schema column — `needsOnboarding(bags)` in
  `src/lib/onboarding.js` treats "zero bags" as "never onboarded," since Step 2 always genesis-creates
  the Practice Stack bag (even on "Skip setup," to avoid an infinite onboarding loop). Checked once per
  app load by `useOnboardingGate` (mirrors `useCrashRecoveryRedirect`'s ref-guard pattern), wired into
  `AppShell`.
- **Goal-card selection (Step 1):** not persisted anywhere (DB or InstantLaunch) — no consumer exists
  yet (Layer 3 dashboard). Revisit when the dashboard actually reads it.
**Bug caught during live verification (not by /code-review):** `.splash-page` needed `display:flex`
for its hero/bottom-zone vertical layout, but that broke the width-stretch every OTHER page gets for
free from `#root`'s flex column — measured 313px wide inside a 480px container instead of stretching,
on BOTH desktop and mobile viewports. Fixed with an explicit `width: 100%` on `.splash-page`. Existing
plain-block pages (`.auth-page`, etc.) don't have this problem since they're not `display:flex`
themselves.
**Live-verified in browser against the real Supabase project:** full onboarding flow (goal → Axiom
Envy putter provisioning → haptic test/units) end-to-end, confirmed the Practice Stack bag + Envy
putter actually landed in the DB (checked `/bag`), confirmed the onboarding gate doesn't loop once a
bag exists, confirmed sign-out routes to `/login` and `/` renders Splash.
**Dashboard setup still needed (external, not app code) — anonymous sign-in is currently OFF for this
project (guest tap fails with a 422, and the code's honest fallback correctly bounces to `/login`
instead of dead-ending):**
1. Supabase Dashboard → Authentication → Sign In / Providers → enable **Allow anonymous sign-ins**.
2. Apple: Services ID + Sign-in key in Apple Developer, then Supabase → Authentication → Providers →
   Apple.
3. Google: OAuth client in Google Cloud Console, then Supabase → Authentication → Providers → Google.
4. Confirm the redirect URL registered with each provider matches `<site>/practice` (see
   `signInWithOAuth`/`linkGuestWithOAuth` in `AuthContext.jsx`).
**Layer 2 status: COMPLETE.** Next: Layer 3 — Hubs (Dashboard/Bag/Putter lineup), Sonnet 5.

---

## 2026-07-05 — TabBar → 4-tab PLAY/BAGS/STATS/PRO (SHIPPED) — Layer 1, phase 4 (Layer 1 complete)

**What:** Migrated the bottom tab bar from 3 tabs (Practice/Bag/Profile) to the blueprint's 4-tab
layout — PLAY (`/practice`), BAGS (`/bag`), STATS (`/practice/stats`), PRO (`/profile`) — the last
item in `DEVELOPMENT_PLAN.md` Layer 1.
**Model:** Sonnet 5 (UI).
**No placeholder screens needed:** STATS and PRO route to already-shipped pages (`ConfidenceMapPage`
at `/practice/stats`, `ProfilePage`) — CLAUDE.md's nav-migration note already scoped both destinations
to existing screens, not new Layer-5 builds, so this was pure relabel + route reassignment, not a
"ship half-built tabs" risk.
**Bug caught before shipping (not by /code-review — traced during design):** STATS's route
(`/practice/stats`) is nested under PLAY's own route (`/practice`). The original per-tab
`pathname.startsWith(tab.to)` check, ported naively, would have lit up BOTH tabs simultaneously on
every `/practice/stats` visit. Fixed with `src/lib/navigation.js`'s `resolveActiveTab` — longest-prefix-match
across all tabs at once, so the most specific route always wins over its broader ancestor. Unit-tested
(exact match, plain nested match, nested-collision precedence, no-match case) since this is exactly
the kind of non-obvious invariant that's easy to silently re-break later (e.g. if PRO ever grows a
nested sub-route under `/profile`).
**Live-verified in browser:** confirmed via `preview_inspect`/`preview_eval` (not just unit tests) that
exactly one tab lights up on `/practice`, `/practice/stats`, and `/practice/history` respectively —
the three cases that matter for the collision this fix addresses.
**Layer 1 status: COMPLETE** (schema, Dexie/TanStack repository skeleton, ChipGroup primitive, 4-tab
nav). Next: Layer 2 — front-door slice (Splash/Auth/Onboarding, Sonnet 5).

---

## 2026-07-05 — Shared ChipGroup primitive (SHIPPED) — Layer 1, phase 3

**What:** Extracted `src/components/ChipGroup.jsx` — the first "shared zero-typing UI primitive"
from `DEVELOPMENT_PLAN.md` Layer 1 — from five near-identical inline chip-row implementations
(status/history filters, tag toggles, putter/preset pickers) that had all converged on the same
chip-row/chip/chip-active markup independently.
**Model:** Sonnet 5 (UI extraction).
**Scope call:** did NOT touch the native `<select>` dropdowns (manufacturer/speed/status on
BagLockerPage, DiscFormPage) even though they violate the blueprint's zero-typing mandate — those
are one-off usages needing real visual/UX design work per screen, not a mechanical extraction.
Building a `SegmentedStepper` primitive with no second real caller yet would be designing for a
hypothetical; extract it once a second genuine use case exists.
**Live-verified in browser** (created a persistent dev test account — `discgolfapp.devtest@gmail.com`
— for this and future sessions): History filter chips, Locker status chips (including filtering
against a real created disc), and Profile's specialty-shots chips all render and toggle correctly
against the live Supabase project, zero console errors. Also confirmed no regression to
`DiscFormPage`'s disc-create flow (untouched by the Layer 1 phase 2 repository work).
**Gotcha caught by `/code-review`:** the original discovery search (`className="chip`) missed two
more duplicates using template-literal styling (`` className={`chip ${...}`} ``) — `ProfilePage`'s
specialty-shots row (migrated) and `DiscDetailPage`'s bag-membership Equip toggle (NOT migrated on
reflection — it's a per-item action button paired with a label inside a `<li>`, not a flat row of
interchangeable chips; forcing it through `ChipGroup` would mean bolting a label-slot onto the
primitive for one caller). `isActive` also given a `() => false` default (matching `getKey`/
`getLabel`'s existing pattern) so a future "plain action chips, no selection state" caller doesn't
need to pass a throwaway no-op.
**Next in Layer 1:** TabBar → 4-tab (PLAY/BAGS/STATS/PRO) — the last item before Layer 2 (front-door
screens).

---

## 2026-07-05 — Dexie + TanStack Query repository skeleton (SHIPPED) — Layer 1, phase 2

**What:** The offline-first repository layer from `DEVELOPMENT_PLAN.md` Layer 1 — `dexie` +
`@tanstack/react-query` added; `discs` wired through it as the first entity, migrating
`BagLockerPage` off direct `fetchUserDiscs` calls.
**Model:** Sonnet 5 (UI/infra, per the model map — Opus was reserved for the prior schema phase).
**Shipped:**
- `src/lib/db/dexieDb.js` — local IndexedDB mirror (discs/bags/bagDiscs/regimens/regimenRuns/
  puttSessions/profile cache tables + an `outbox` for pending mutations).
- `src/lib/repository/offlineFirstRepository.js` — framework-free primitives (`readThroughCache`,
  `writeThrough`, `flushOutbox`), unit-tested with in-memory fakes (matches the `lib/insights` /
  `lib/instantLaunch` testing convention — no real Dexie/React Query needed to test the contract).
- `src/lib/repository/createRepository.js` — the actual "repository interface": a factory giving
  any entity `useList`/`useCreate`/`useUpdate`/`useRemove` hooks with offline-first behavior baked in
  once, not re-derived per entity.
- `src/lib/repository/discRepository.js` — discs' concrete instance, delegating to the existing
  `discLocker.js` Supabase functions (kept as the single source of truth for query shape).
- `BagLockerPage` reads through `useDiscList` now — first existing screen migrated (blueprint's
  "existing screens migrate as they're touched" clause), not deferred.
**Key decisions / gotchas (surfaced by `/code-review` before commit, all fixed):**
- Cache reconciliation must **prune**, not just upsert — `readThroughCache` now deletes cached rows
  absent from a successful remote result, or a disc removed/changed elsewhere would keep surfacing
  forever via the offline fallback on this device.
- **Idempotent creates**: retried/duplicated writes (double-tap offline, or two mounted `useDiscList`
  instances both flushing on reconnect) could otherwise insert a disc twice. Fixed with a
  mount-scoped client-generated id (`useCreate`'s `clientIdRef`, reset after success) threaded into
  `upsertDisc`, which now `upsert`s on `id` when a client id is present instead of a plain `insert` —
  mirrors the client-UUID + onConflict pattern `putt_events_schema.sql` already established.
  Updates/removes didn't need this — they already target a known row id, so replaying them is
  naturally idempotent.
- Stale-closure bug in the reconnect listener: `queryKey` was captured once at mount (empty effect
  deps) and never updated, so an id changing without an unmount would invalidate the wrong query on
  reconnect. Fixed via a ref updated every render.
- A shared `error` state was almost made to double as both the disc-query error and the picker-flow
  error — clearing one on the other's resolution would've clobbered it. Split into `displayError`
  (query error) `||` picker-only `error` instead of routing both through one `setError`.
**Deferred:** no other existing pages migrated yet (BagManagePage, DiscFormPage, DiscDetailPage,
regimen/history pages all still call Supabase directly) — migrate as touched, per the staged-adoption
plan. `useCreateDisc`/`useUpdateDisc` are exposed but not yet wired into a page.
**Next in Layer 1:** shared zero-typing UI primitives, TabBar → 4-tab (PLAY/BAGS/STATS/PRO).

---

## 2026-07-05 — Layer 1 foundation schema (APPLIED) — first Layer 1 phase

**What:** `layer1_foundation_schema.sql` — the append-only schema pass absorbing blueprint concepts onto
the shipped tables. Applied live via Supabase MCP (backup confirmed first, per CLAUDE.md gate).
**Model:** Opus 4.8 (schema design + rules/trigger logic, per the model map).
**Landed:**
- `discs`: `role` (putter-lineup, partial-unique "one primary putter per user"), `wear_score` (1–10),
  `total_chain_hits` odometer (stored counter — NOT a putt_events trigger; batch-ribbon putts create no
  events, so a trigger would undercount).
- `profiles`: `pdga_rating`, `xp`, `level` (level = derived cache; `xp_events` ledger = source of truth).
- `putt_events.putter_disc_id` (Screen 9 putter breakdown); session weather (`weather_condition`+`wind_mph`)
  on both `putting_regimen_runs` and `putt_sessions`.
- **Custom routines** = extend `putting_regimens` (not a parallel tree): `user_id` (null = system),
  `drill_type`, `rules_config`, `archived`. `difficulty` relaxed to nullable + **partial** unique (system
  rows only). Reuses the whole sets/runs/run_sets/scoring pipeline unchanged.
- `badges` / `badge_progress` / `xp_events` (gamification tables land now, Layer-5 logic later).
- Hard interlocks as **triggers** (cross-row aggregates can't be CHECKs): 35-disc bag cap, 100-putt
  routine cap. `merge_discs(source,target)` SECURITY DEFINER consolidation fn (reassign children + sum
  odometer + delete source; owner-checked).
**Key decisions / gotchas:**
- RLS reshape was mandatory, not optional: old regimen policies were select-open, which would have **leaked
  every user's custom routine**. Replaced with system-or-own visibility on regimens + sets.
- **Soft delete** for custom routines (`archived` flag, no DELETE policy) — hard delete would hit the
  no-cascade `putting_regimen_runs` FK and strand run history the analytics/PB features read.
- Cap triggers take a `FOR UPDATE` lock on the parent bag/regimen row → the count-then-insert is atomic
  (closes the concurrent-double-submit bypass). 100-cap skips system regimens (`user_id is null`).
- Process: `/code-review high` before apply (3 findings, all fixed pre-apply) → apply → `get_advisors`
  (fixed trigger `search_path` + revoked `anon` execute on `merge_discs` + covered `badge_progress.badge_id`).
  Residual advisor warnings are intentional (authenticated SECURITY DEFINER) or pre-existing (leaked-pw toggle).
**Next in Layer 1:** Dexie.js + TanStack Query repository skeleton, shared zero-typing UI primitives,
TabBar → 4-tab (PLAY/BAGS/STATS/PRO). See `DEVELOPMENT_PLAN.md` Layer 1.

---

## 2026-07-05 — Master Blueprint absorbed: 21-screen plan reconciled onto shipped app (Layer 0)

**What:** User supplied a consolidated "Master Project Blueprint v2.0.0" — 21 fully-wireframed screens,
logic-governance specs (competition engine, UDisc parser, XP ledger), an 8-table Postgres schema, and a
7-layer TASKS.md written as a **greenfield Expo/React-Native rebuild**. Ran a plan-mode reconciliation
(two rounds of AskUserQuestion) against the shipped React+Vite app before touching any code.
**Model:** Sonnet 5 for this docs-alignment session (Layer 0), per the plan's stated model map.
**Key decisions (all user-confirmed):**
- **No rebuild.** Absorb into the existing Vite+React app; Expo/native stays the parked Track-4 decision.
- **Staged local-first:** Dexie.js + TanStack Query introduced behind a repository interface — new
  screens first, existing screens as touched, InstantLaunch buffer folds in last. Not a big-bang rewrite.
- **Append-only schema absorption**, not the blueprint's from-scratch schema. `disc_molds` FK catalog
  is kept (blueprint's freetext brand/mold columns would be a regression).
- **Scope this cycle:** Screens 1–10 + Progression module (11 Career Hub, 12 Trophy Room, 13 UDisc
  ingestion). **Parked:** Social (14, 15, QR Beam, virtual bag tags), Hardware (16, 20), Commerce (17),
  Utilities (18, 19, 21) — reasoning for each recorded in `SCREEN_SPECS.md`.
- **4-tab nav** (Play/Bags/Stats/Pro) adopted; **both hard interlocks** adopted (100-putt routine
  ceiling, 35-disc bag capacity — app-side disable + DB CHECK, not just one).
- **Auth:** email 6-digit OTP (Supabase native, free) instead of the blueprint's 4-digit SMS; guest
  mode = Supabase anonymous sign-in (survives device loss), not an Expo-only shadow profile.
- **Putter roles land on `discs.role`** (enum + partial unique index for one PRIMARY per user) —
  this **supersedes** the v1 SCREEN_SPECS proposal of profile-side FK columns; the blueprint's model is
  cleaner and matches the Screen 6 swimlane UI directly.
- **PDGA:** manual entry v1; the blueprint's scraper Edge Function deferred (no official public API,
  ToS-gray).
- **Screen 8 flagged, not yet decided in code:** blueprint's split-screen tap zones vs. the shipped,
  tested gesture-swipe canvas (Track 2.2c). Recommendation on record in `SCREEN_SPECS.md` (adopt tap as
  primary, demote gestures to an alt mode) — explicit sign-off required before Layer 4 starts.
**Shipped this session:** `MASTER_PROJECT_BLUEPRINT.md` (verbatim copy, now the design authority);
`SCREEN_SPECS.md` rewritten as the integration layer (21-screen status table, standing divergences,
per-screen REUSE/NET-NEW/divergence for screens 1–13, parked-screen reasoning table) — supersedes the
prior ideation-only v1 (commit `da62bc5`); `CLAUDE.md` updated (4-tab nav, staged offline architecture,
gamification pointer, doc hierarchy, interlock rules); `DEVELOPMENT_PLAN.md` updated (new Layers 0–5 as
the active plan, Tracks 1–4 kept as historical record); `FEATURE_BACKLOG.md` updated (blueprint-scoped
items, v1 ideation items marked SUPERSEDED with pointers).
**Process note:** established a standing workflow rule this session — state the recommended model per
section/layer and verify the active model matches before proceeding (table lives in
`DEVELOPMENT_PLAN.md`'s Layer summary and `CLAUDE.md`'s documentation-conventions section).
**Next:** Layer 1 (Opus 4.8) — manual DB backup, then the append-only schema file + Dexie/TanStack
skeleton + shared primitives + 4-tab bar. Verify Track 1.5 provenance columns actually landed with 1B
before assuming they're there (open item from planning).

---

## 2026-07-05 — SCREEN_SPECS.md authored: screens 3–10 (Phase 1 of "updates" plan)

**What:** Wrote `SCREEN_SPECS.md` — full design specs for screens 3–10 of the 10-screen product spec
(`updates for disc golf app.md` covers 1–2). Format per screen: prose intro → style guide (Sun-Drenched
Topo tokens only) → ASCII wireframe → Pro Additions (why/how) → **Build Notes** (REUSE vs NET-NEW with
exact file paths, dependencies, honesty notes). This is the approval gate before Phase 2 builds beyond
the front-door slice.
**Model:** Opus 4.8 (design/ideation pass, per convention).
**Key decisions (user-confirmed in plan mode):**
- ASCII wireframes only, no per-screen HTML mockups (generated later on request).
- Every screen is an **ideation pass** — ideal interaction flow using source one-liners + shipped code as
  starting context, not documentation of the status quo. Screen 8 (shipped canvas) got its source-doc
  ideas evaluated as deltas: split-screen tap zones → **ADAPT** (opt-in Tap Mode, same engine), visual
  stack tracker → **ADOPT** (context-bar pips), mid-round swap drawer → **ADAPT** (putter-only,
  edge-swipe, start-position gated vs the undo cone).
- **Consolidated schema implications table** (all future append-only files, none built): putter roles as
  `profiles.primary/backup_putter_disc_id`; `discs.wear` numeric (freetext condition retained);
  `putt_events.putter_disc_id` (enables Screen 9's putter matrix + swap-drawer data story); Screen 7's
  demands on the Track 2.3 `rules_config`/`drill_type` design pass, incl. a versioning rule (editing a
  custom regimen with runs creates a new row, never mutates).
- Screen 7 (Custom Regimen Builder) remains **spec-only** — deliberately written as the demand signal for
  the 2.3 schema design; recommendation recorded: typed columns stay authoritative for fixed_sets,
  rules_config reserved for drill types that don't fit them.
- Screen 10 honesty ruling: "local database sync controls" = the InstantLaunch localStorage buffer/outbox,
  not an offline database (which 1D explicitly scoped out); settings live on Profile, analytics stays at
  /practice/stats.
**Verified:** all 41 REUSE file paths referenced in the doc exist (scripted check, zero missing).
Component inventory came from an Explore-agent pass over graphify + source (~50 files).
**Next:** user reviews SCREEN_SPECS.md (approval gate) → Phase 2 front-door build (Splash → Auth overhaul
w/ OTP + Apple/Google SSO + guest → Screen 3 onboarding). Suggested post-approval build order recorded at
the end of SCREEN_SPECS.md.

---

## 2026-07-05 — Token-efficient dev workflow set up (Phase 0 of "updates" plan)

**What:** Stood up the token-optimization tooling before starting the "updates for disc golf app" build (front-door slice: Splash → Auth overhaul + SSO → zero-typing Onboarding, per the approved plan file).
**Done:**
- **graphify** — ran `graphify update .` → built `graphify-out/graph.json` (397 nodes, 883 edges, 23 communities). This activated the previously-dormant `PreToolUse` enforcement hooks already in `~/.claude/settings.json` (they gate on `graphify-out/graph.json` existing): grep/read now steered to scoped `graphify query`/`explain`/`path` subgraphs. Re-run `graphify update .` at each session close.
- **rtk (Rust Token Killer)** — corrected the original assumption: it's **not an MCP server**, it's a Bash-output-compressing CLI + Claude Code hook. Installed the prebuilt Windows binary (`rtk-x86_64-pc-windows-msvc.zip`, v0.43.0) to `~/.local/bin` (already on PATH); ran `rtk init -g`; manually merged its `rtk hook claude` command into the existing `PreToolUse` Bash matcher group in `settings.json` (coexists with the graphify hooks). `RTK.md` + `@RTK.md` reference added to global CLAUDE.md by rtk itself.
- **composio** (MCP, connected) + **superpowers** (skill) — standing capabilities, not required for the front-door slice.
**Gotcha:** rtk's hook only loads at Claude Code **startup**, so it does nothing until a restart — restarted here specifically to bank its compression for the token-heavy Phase 1 (author screen specs 3–10) + Phase 2 (build) work. graphify, by contrast, is read per-call and was live immediately.

---

## 2026-07-05 — Scoring canvas shipped: gesture capture, offline sync, putt_events (Track 2.2b/2.2c)

**What:** The 2.2b design review (approved spec, no build) followed immediately by the full 2.2c build — a real-time, gesture-driven scoring canvas that replaces the plain number-entry active-logging UI in both `RegimenRunPage.jsx` and `FreeformLogPage.jsx` (user's explicit choice, confirmed via plan-mode question — not a new parallel mode).
**Model:** Opus 4.8 for the 2.2b spec, Sonnet 5 for the 2.2c build, per convention.
**Shipped:**
- `putt_events` schema (append-only `putt_events_schema.sql`) — exclusive-arc parent (`regimen_run_id`/`freeform_session_id`/`round_hole_id`, exactly one non-null via a CHECK), client-generated `id` (no server default — idempotent upsert-on-retry is the whole point), `set_order` denormalized for regimen-parented rows, RLS `for all` (needed for undo-after-sync deletes). Backed up via the same `db_backups/` JSON-dump pattern as the prior Track 1B migration before applying via Supabase MCP; verified clean via `get_advisors` (only the pre-existing unrelated password-protection warning).
- Pure logic layer, fully unit-tested: `lib/gestureEngine/` (swipe classification — cone half-angle, travel/velocity gates, rapid-fire tick pacing) and `lib/instantLaunch/` (FSM, crash-recovery redirect resolver, exponential backoff, the persisted-blob reducer, and the in-session tally reducer with streak/longest-streak/undo semantics). `lib/insights/nextSessionSuggestion.js` composes existing `confidenceMap`/`decayWeightedForm` — zero new queries.
- `useInstantLaunchSession` — one hook shared by both pages via a page-supplied `writeAdapter` (table-agnostic `syncRows`/`isPermanentError` helpers), so the hook never needs to know regimen vs. freeform.
- Real gesture physics (`useGesturePointer` on raw Pointer Events + capture, not React synthetic events — needed for `setPointerCapture` so a fast swipe leaving the element's bounds still delivers `pointermove`/`pointerup`), make-territory growth, shockwave/reject-flash feedback, batch ribbon (grid ≤10 / scroll-snap carousel 15-20 with historical-average centering and a 1.25× predictive-anchor highlight), diagnostic-mode 9-zone miss picker, audio (Web Audio pitch ladder + SpeechSynthesis), haptics (Vibration API, silent no-op on iOS).
- Zero new npm dependencies — everything above is native browser APIs, confirmed available (`crypto.randomUUID`, Pointer Events, Web Audio, SpeechSynthesis, Vibration API, CSS `scroll-snap`) before committing to that approach.
**Corrected my own mistake before building:** while briefing the design-pass agent I mis-stated the data-split rule as "canvas always writes both `putt_events` and summary tables." That contradicted CLAUDE.md's already-committed rule and my own approved 2.2b spec. Caught it during planning, not after building — gesture entries dual-write, batch-ribbon entries stay summary-only, a stage can mix both (`sequence` gaps vs. attempts are expected, not a bug).
**Real bugs found and fixed during an explicit offline-hardening pass** (not just theoretical — these would have failed on every real sync attempt):
- The hook's `gestureMake`/`gestureMiss` built `putt_events` rows with **no `user_id` and no parent FK** (violates the exclusive-arc CHECK — every sync would have hit a constraint violation) and used camelCase fields (`missZone`, `distanceFt`) that don't match the real snake_case columns (`miss_zone`, `distance_ft`). Fixed by having the hook read `sessionType`/`parentIds` fresh off the persisted blob (not a stale closure) to build a real DB-shaped row.
- `BatchRibbon`'s 3s confirm-then-advance was structurally unreachable: a single grid/carousel tap always accounts for the *entire* remaining volume (there's no partial-fill concept), so the parent page's `remaining > 0` conditional unmounted the ribbon on the very same render that produced the confirmation — before its own timer could ever be seen. Fixed with a `batchRibbonConfirming` flag that keeps the ribbon mounted through its own lifecycle regardless of the parent's remaining-volume calculation, plus reordering `BatchRibbon`'s own early-returns (`confirmed` check before the `volumePlanned <= 0` bail-out, which had the same problem internally).
- Undoing a wrongly-registered *miss* was resetting the streak to 0 (since a miss already zeroes `consecutiveMakes`) instead of restoring what it was before — fixed by having each gesture event carry a `consecutiveMakesBefore`/`longestStreakBefore` snapshot so UNDO restores the exact prior value, not just "minus one."
- `useInstantLaunchSession`'s BOOTSTRAP originally resolved in a `useEffect`, meaning one visible render of nothing useful before READY_DEFAULT/ACTIVE_SESSION resolved — moved to lazy `useState` initializers so the very first render is already correct (matches the "no gating before the start button" TTFP rule).
**Design clarifications nailed down during planning, not left ambiguous:** cone angle is a half-angle (±45°, tiles the circle cleanly with no dead zones between up/down/left); debounce (400ms) applies to swipe-classified gestures only, never to long-press rapid-fire ticks (paced solely by their own 200ms interval — the two would otherwise fight); undo is scoped to the current stage's most recent gesture event only, with a real DELETE fallback if opportunistic sync already raced ahead of the tap; freeform mints a fresh `putt_sessions` row per active session rather than reusing "today's session" (verified safe since `HistoryPage` already groups by day at the display layer, not by row identity) — removes a whole class of offline/online reconciliation complexity; the crash-recovery redirect fires once per app load (mount-once, not on every navigation), specifically so browsing to History/Profile mid-session never gets yanked back to the canvas.
**Verified:** all 125 unit tests pass (extends the prior 116; new coverage for every pure module above). Production build succeeds. A from-scratch Playwright pass (mocked Supabase REST + injected fake session, real synthetic `PointerEvent` swipes dispatched at the DOM level — same code path a real swipe exercises) drove a full regimen run and freeform session end-to-end: gesture make/miss/undo, mixed gesture+batch stage tallying, the diagnostic zone picker, an airplane-mode-then-reconnect cycle confirming the outbox buffers offline and drains exactly once on reconnect with the correct DB-shaped payload, and the crash-recovery redirect actually firing when a buffered session doesn't match the landed-on route. 19/19 checks passed after fixing the two real bugs above (the rest of the early failures were test-timing artifacts — synthetic swipes fired inside my own 400ms debounce window, and mock-response speed racing my own outbox assertions — not app bugs; distinguished each one before treating it as a fix).
**Known, disclosed limitation:** true on-device TTFP measurement (killed PWA, real phone) and true multi-device DPR testing aren't things this environment can perform — built TTFP-by-design (synchronous bootstrap, no network gating) and verified the closest available proxy, but real confirmation needs an actual phone.
**Deferred, not forgotten:** a minor UX inconsistency where a batch tap that exactly finishes a stage still shows the ribbon's confirmation (now fixed) — but the ribbon's *carousel* smart-centering only has real historical-average data for freeform distances today; regimen sets pass `historicalAvgMakePct: null` (no per-set historical query built yet), so the carousel's centering falls back to the volume midpoint for regimen sessions. Not a bug, just an unbuilt enrichment.

---

## 2026-07-04 — Sun-Drenched Topo (Oswald) theme, shipped app-wide (Track 2.2a)

**What:** Implemented the design system from CLAUDE.md § Design system across every screen, per `TASK_BRIEFS_2.2.md` 2.2a.
**Model:** Sonnet 5.
**Done:**
- All tokens (backgrounds, text, interactive, borders) as CSS custom properties in `src/index.css`, plus alpha-derived `-soft` tint variants for badge/chip fills — no new hues, just alpha versions of the fixed hexes. Removed the old Vite-template dark-mode block entirely: the palette is deliberately one fixed high-luminance look for sunlight legibility, not theme-variable.
- Oswald (variable, latin-subset, 400–700) downloaded from Google Fonts and self-hosted at `public/fonts/oswald-variable-latin.woff2` (21KB, one file covers all four weights), preloaded in `index.html`. Applied as the display face on headings, buttons, and stat/score numbers; body copy and form inputs stay on the system sans stack for small-size legibility.
- Restyled every screen (tab bar, practice menu, freeform log, regimens + run-through, history + detail, confidence map, locker, bag views, disc detail, profile) onto the token set. Global `button`/`input`/`select`/`textarea` base styles added so no control falls back to browser-default white/gray/blue (this closed a real gap: `MoldPicker`'s raw inputs and native checkboxes had no themed styling before and would otherwise still show default white fields / OS-blue checkmarks — added `accent-color` for checkbox/radio too). All borders bumped to the 2px minimum; primary CTAs (`start-button`, `save-button`, submit buttons) got 80px min-height tap targets. Replaced the last hardcoded hex holdouts (`discFilters.js` stability-swatch colors, `pb-badge` gold, error/success text colors) with tokens.
- **Contrast verification (WCAG relative-luminance math, not eyeballed):** text-primary on all three background tokens is 10.9–15.1:1 and text-secondary is 5.2–7.2:1 — both comfortably clear AA everywhere, confirmed rather than assumed.
- **Contrast finding, flagged rather than silently patched (tokens are fixed):** `--color-highlight` (sunburst orange) only works as a solid fill with dark text on top (~5.9:1, e.g. `pb-badge`) — as a foreground/text/icon color it fails against every background token (1.85–2.57:1, need 3–4.5:1), despite CLAUDE.md naming it for "active tab indicators." Used text-primary + bold weight for the active tab state instead, with a small canyon-blue accent bar (~5.3:1) carrying the color cue; same substitution applied to the confidence-map "developing" zone badge and CI point marker. Separately, `--color-positive` (terracotta) as a button fill tops out at ~3.9:1 with either text token — below normal-text AA (4.5:1) though above the large-text/UI-component floor (3:1); mitigated with bold 17px labels but not fully resolved by design since the hex values are fixed. Both are real, permanent properties of this exact palette, not implementation bugs.
- Verified: production build succeeds, all 52 existing unit tests pass unchanged, Playwright screenshot pass at 390px width across all ten routes (login, practice menu, freeform, regimens, history, confidence map, profile, bag, locker, bag-manage) using a locally-injected fake session + mocked Supabase REST responses (no real test-user credentials were available) to see real card/badge content rather than just empty/error states.
**Gotcha:** Google's `css2` endpoint served one shared variable-font file across all four requested weights (same URL for 400/500/600/700) rather than four separate static files — expected behavior for variable fonts, just meant one download instead of four.

## 2026-07-04 — Scoring canvas + theme planning (PLANNING)

**What:** Absorbed two uploaded specs — the Dual-Pace Scoring Canvas interaction design and the Sun-Drenched Topo (Oswald) design system — into an expanded 2.2 (now three sessions: 2.2a theme, 2.2b design review, 2.2c build).
**Key decisions:**
- Theme conflict resolved: Sun-Drenched Topo wins everywhere including scoring zones (Make = burnt terracotta #CC4E3C, Miss = deep rust #8C2D19); doc 1 contributes interaction spec only
- Batch ribbon writes summary tables ONLY; putt_events exclusively from real-time gesture mode — never synthesize per-putt events from batch totals
- Miss-zone capture via per-session "diagnostic mode" toggle (quick 9-zone tap after misses when on; frictionless swipes when off)
- Theme ships as its own session BEFORE the canvas build (canvas built in-theme, not themed after)
- Putter picker (light version): optional locker-sourced selection at session start, persisted in InstantLaunchPayload
- InstantLaunchPayload and offline sync buffer merged into one localStorage subsystem
- Web constraints accepted: haptics Android-only simplified (no iOS vibration support); hardware volume override impossible in web — both on Capacitor roadmap
- Gesture thresholds are named tunable constants, devicePixelRatio-normalized; field tuning expected
- New standing rule: plan-first — always prompt for approval before generating files

## 2026-07-04 — Bag & disc manager UX + app navigation (PLANNING)

**What:** Field testing revealed /bag routes have no navigation entry point (1C shipped schema, UI status unaudited). Designed 1E: game-inventory UX + app-level nav.
**Key decisions:**
- Bottom tab bar over hamburger/expanding menu: one-tap access, visible state, 5-tab cap matches full roadmap (Practice/Bag/Rounds/Caddie/Profile); ships now with three tabs
- Inventory mental model: locker=inventory, bags=loadouts, profile=character sheet, flight chart=stat coverage
- Locker: grid⇄list toggle (peripheral icon, persisted preference); search/filter/sort
- Minimal clean cards v1; game flair (rarity borders, equip animations) deliberately deferred to backlog
- 1E session must audit what 1C actually built at /bag before wiring or building

## 2026-07-03 — Operational readiness pass (PLANNING)

**What:** Pre-execution audit surfaced three operational gaps; docs updated.
**Key decisions:**
- New task 1D (deploy + PWA baseline) inserted into execution order BEFORE the big schema session — practice features need on-phone, on-cellular validation; Vercel + vite-plugin-pwa, app-shell caching only
- Standing convention added: manual DB backup required before any migration/FK-restructuring session; Claude Code confirms backup exists before running migration SQL
- Connection resilience made a required part of 2.2: local buffering + batch sync + retry + sync-status indicator ("a dropped connection never loses a set"), explicitly not full offline-first
- Considered and deferred: password reset flows (near-free via Supabase, fold in anytime), Sentry (public phase), CI (overkill solo)

## 2026-07-03 — Round/course/import tandem groundwork (PLANNING)

**What:** Identified schema accommodations to fold into in-flight work ahead of confirmed destinations (course catalog, round management, UDisc import). Added Track 1.5 to DEVELOPMENT_PLAN.md.
**Key decisions:**
- Layouts promoted to first-class (layouts table; holes belong to layouts, not courses) — must land before real round data; rides with the 1B schema session under Opus 4.8
- Provenance pattern (external_source/external_ref) on rounds + courses for idempotent imports
- course_aliases table (insert-open/update-closed, same pattern as disc_molds, built in same session)
- bag_id FK on rounds (rides with 1C); round_hole_id FK on putt_events (rides with 2.2)
- UDisc import noted as score-only (no disc/putt data in their CSV); exact format to be verified at build time
- Deliberately NOT building round/catalog/importer UI in tandem — schema accommodations only, to avoid parallel-workstream merge pain on a young codebase

## 2026-07-03 — Comprehensive development plan (PLANNING)

**What:** Consolidated all work into DEVELOPMENT_PLAN.md (4 tracks); evaluated external sensor-fusion TDD (features_possibilities.md upload).
**Key decisions:**
- All native-iOS features (CV detection, Watch IMU, LiDAR, biometrics, thermal armor) → parked Native iOS Roadmap section in backlog; revisit only after Tracks 1-2 ship + acoustic spike results
- Web-viable TDD features ranked by value:ease and queued: confidence map → per-putt capture → drills (JYLY/ATW) → clutch sim → miss tendency → ghost pacing → voice callouts
- Per-putt capture layer identified as the single cross-cutting enabler; `input_source` field future-proofs for acoustic/CV inputs writing to the same records
- Acoustic-first inversion of the TDD's CV-first approach: Web Audio FFT spike with a >90%-agreement success gate before it becomes a real feature
- Adopted TDD's intervention-threshold principle (never coach off single events) as a standing design rule for all coaching/AI features
- Standing convention: every task states its recommended model (Sonnet 5 default; Opus 4.8 for migrations, schema design, rules engines, DSP)

## 2026-07-03 — Player & bag profile planning (PLANNING)

**What:** Full plan-mode design for player profile expansion and locker/bags/molds system. Phase A schema generated (phase_a_profile_schema.sql).
**Key decisions:**
- Locker + multiple bags model (bags + bag_discs join) over flat is_active — discs owned once, carried in subsets
- disc_molds shared reference table (insert-open, update-closed RLS); seed via manufacturer-site import, Infinite Discs fallback; unique on lowercased (manufacturer, mold)
- Disc rows = physical copies; flight overrides as nullable columns, null = stock; effective numbers via coalesce
- Status lifecycle (in_locker/lost/retired/sold) replaces is_active; lost/retired excluded from bag views, memberships preserved
- Value+source pattern (typed columns, not JSONB) for calibration fields — self_reported now, derived later
- Throws as profile columns (not child table); specialty shots as text[]
- injury_notes: optional, private-always, never selected in shared views
- Migration over re-entry for existing discs data; migration runs under Opus 4.8

---

## 2026-07-03 — Session history v1 (IN PROGRESS)

**What:** Unified history feed at /practice/history + insights layer.
**Scope:** Feed (day-grouped, filter chips), detail views, notes + tag chips, practice streak, PB badges, volume ledger, and five zero-input derived insights (fatigue curve, pressure differential, decay-weighted current form, cadence fingerprint, confidence intervals).
**Schema:** `session_history_schema.sql` — tags[] on both session tables, notes on regimen runs. Everything else is derived read-only.
**Key decisions:**
- Unified timeline over per-mode history pages (matches real practice behavior; pattern will absorb round history later)
- Client-side merge of the two tables (fine at current volume; Postgres UNION view is the upgrade path if slow)
- Zero-input derived insights prioritized over diary-style inputs; all inputs optional and one-tap
- Confidence intervals: Wilson score interval, band shown until n ≥ 30 per distance
- Decay-weighted form: exponential decay, half-life 14 days (tunable constant, document in code)
- PB badge qualification: min 10 attempts at a distance for make-% PBs (prevents 2/2 = "100% PB" noise)
**Deferred:** distance heat profile + putter tracking (NEXT UP); full list in FEATURE_BACKLOG.md.

---

## 2026-07-02 — Putting practice menu + nested routing (SHIPPED)

**What:** Card-list menu at /practice; moved freeform + regimens under nested routes.
**Routes:** /practice, /practice/freeform, /practice/regimens, /practice/regimens/:id/run
**Key decisions:**
- Card grid menu inside a (future) bottom-tab-bar app shell; cards scale as modes are added
- Reusable ModeCard component — new modes are one-line additions
- Recent activity strip on menu (last 2-3 entries from both session tables)
**Gotchas:** swept for hardcoded old route paths during migration.

---

## 2026-07-01 — Scored putting regimens (SHIPPED)

**What:** 5 fixed regimens (difficulty 1-5) with points scoring.
**Schema:** putting_regimens, putting_regimen_sets, putting_regimen_runs, putting_regimen_run_sets + seed data.
**Scoring:** base points = difficulty per make; +10% streak step per consecutive make (miss resets); pressure putt (last of set) at 2x instead of streak formula; +25% no-miss set bonus; flat completion bonus scaled by difficulty.
**Key decisions:**
- Difficulty defined by distance AND makes-required combined
- Streak multiplier, no-miss bonus, pressure putt as core three separators; fatigue weighting + distance ladders deferred to v2
- Regimen definitions stored as data (not code) so tuning is a DB edit
- Tap-by-tap make/miss entry recommended over self-reported summaries (integrity for future social comparison)

---

## 2026-07-01 — Auth + freeform putting log (SHIPPED) — v1 vertical slice

**What:** Email/password auth (Supabase), freeform putting log page, session persistence verified end to end.
**Schema:** putt_sessions, putt_distance_logs. Zone (C1/C2/Beyond C2) is a generated column from distance_feet (C1 ≤ 33ft, C2 ≤ 66ft).
**Key decisions:**
- Putting practice chosen as the thinnest vertical slice to prove auth → DB → UI before bigger features
- Session-summary granularity (makes/attempts per distance), not per-putt logging, for freeform mode

---

## 2026-06-30 — Project foundation (SHIPPED)

**What:** Environment setup, project scaffold, core schema, CLAUDE.md.
**Stack decisions:**
- React + Vite SPA, mobile-first, Capacitor-ready (PWA first, app stores later)
- Supabase (Postgres + auth + RLS): multi-tenant from day one because scale path is solo → group → public
- Claude API server-side only; Sonnet 5 for live/conversational features, Opus 4.8 for background/analysis jobs
- Claude Code CLI (native installer) as dev tool; CLAUDE.md as living architecture doc
**Schema:** profiles, discs, courses, holes, rounds, round_holes, live_sessions, caddie_recommendations. Courses/holes are shared community data; all user data RLS-scoped to auth.uid().
