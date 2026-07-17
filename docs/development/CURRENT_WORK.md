# Current Work

Last updated: 2026-07-16

- **Active phase:** Phase C is complete and Phase D item 1 is shipped; continue with Phase D item 2.
- **Approved:** Phase A shell/navigation, lifecycle, notification, scrolling/sheets, accessibility,
  repository/transaction, migration-order, test-gate, and A1–A10 walkthrough are complete. A8 recovery
  (RPCs + versioned metric registry, Dexie v3 audited outbox, Recently Deleted restore) and the A9/A10
  notification contract (append-only migration, Dexie v4 mirror, durable outbox, bell sheet/deep-link UI)
  remain complete and live-verified.
- **⚠️ Catalog ingestion SCRAPPED (2026-07-13):** The automated catalog-ingestion effort is abandoned.
  `disc_molds` will be **populated manually** by the owner, later — not by a manufacturer-site scraper.
  The full ingestion surface was torn down: the `catalog-ingestion` / `catalog-ingestion-admin` Edge
  Functions, all `supabase/functions/_shared/catalog*`/`mvp*` modules, `src/pages/AdminCatalogReviewPage.jsx`,
  `src/lib/catalogAdmin.js`, `src/lib/catalog/*`, `src/lib/repository/catalogRepository.js`, and the
  `/admin/catalog` route are removed. Trigger: the first live crawl proved the pipeline worked end-to-end
  but MVP's live pages no longer expose parseable flight numbers (moved to prose, no `data-flight`), so
  0 batches staged. See DEVLOG (2026-07-13 top entry) and DEVELOPMENT_PLAN.md §1B population policy. Do
  NOT rebuild a scraper.
- **B1.5 catalog FOUNDATION is retained** (distinct from the scrapped ingestion pipeline): the
  normalized `manufacturers` / `manufacturer_aliases` / `disc_molds` / `disc_plastics` / `disc_mold_plastics`
  / `disc_runs` / `disc_stamps` / `catalog_sources` / `catalog_entity_sources` / `catalog_submissions`
  tables are live with RLS and least-privilege grants and hold real data (four manufacturers, 36 molds,
  20 physical `discs` across three owners with `mold_id` links). This is the schema manual population
  targets — keep it. `discs.mold_id` FKs into `disc_molds`; never drop it.
- **Database teardown state:** DONE (2026-07-14, migration `20260714120000`, applied after a confirmed
  manual backup). Dropped the ingestion-only DB objects: the staging/candidate/artifact/review tables,
  the `catalog_assert_ingestion_admin` / `catalog_review_candidate` / `catalog_promote_import_batch` /
  `catalog_stage_import` / `catalog_ensure_source` RPCs and their private helpers, and the
  `private.catalog_ingestion_admins` allowlist. Every foundation table was preserved (verified before +
  after). The migration files that created these objects stay as append-only history. **One follow-up
  remains:** delete the empty `catalog-import-raw` Storage bucket from the Supabase dashboard — direct
  DELETE on storage tables is blocked, and the CLI manages objects, not buckets.
- **J1 shipped 2026-07-14:** Added the COURSES tab and `/courses` + `/rounds` route trees, quick-course
  creation, layout/hole detail, optional bag selection, Dexie v5 round/round-hole caching, idempotent
  activity-parent/round outbox ordering, offline scorecard capture, history, and finalization. Applied
  `20260714150000_phase_c_round_logging_rls.sql` with owner-scoped round policies and authenticated
  community course policies. Schema columns remain append-only and unchanged.
- **J1 verification:** 338 tests pass across 35 files; production build passes; lint retains only the
  four pre-existing warnings; `graphify update .` completed. Live RLS/index verification and a
  rollback-only authenticated owner/foreign-user smoke passed with zero rows left behind. Browser smoke
  reached `/login` from `/courses` with no console errors because no authenticated browser session was
  available; no guest account was created.
- **J2 shipped 2026-07-15:** Added locker compare mode with a 2–4 selection cap, `/bag/compare`, pure
  effective-flight comparison rules, per-axis low/high highlights, override markers, stability labels,
  current-reality curve overlay, and explicit no-meaningful-gap flags for pairs within ±1 on every
  populated axis. No schema changes.
- **J2 verification:** 342 tests pass across 36 files; production build passes; lint retains only the
  four pre-existing warnings; `graphify update .` completed. Browser smoke reached `/login` from the
  protected compare route with no console errors; no authenticated browser session was available and no
  guest account was created.
- **J3 shipped 2026-07-15:** Added the opt-in game-flair `DiscCard` variant, pure role/wear/status tier
  precedence, local Profile preferences toggle, locker wiring across grid/list/compare/picker cards, Tier/Signal
  stat blocks, Topo rarity borders, and a reduced-motion-safe mount animation. No schema changes.
- **J3 verification:** 348 tests pass across 37 files; production build passes; lint retains only the four
  pre-existing warnings; `git diff --check` and `graphify update .` completed. Browser smoke reached `/login`
  from `/profile`; the available guest action did not navigate, so authenticated toggle/card interaction remains
  unexercised. The current theme contract is light-only; no dark-mode variant was added.
- **B2 shipped 2026-07-15:** Added a read-only normalized catalog repository over manufacturers,
  molds, plastics, mold-plastic links, runs, and stamps; Dexie v6 persists the snapshot and TanStack
  Query supplies offline-first reads. Mold picker, Universe search, onboarding putter selection, and
  add-disc URL handoff now use it. Removed the stale ordinary-client `disc_molds` insert path.
- **B2 verification:** 351 tests pass across 38 files; production build and `git diff --check` pass;
  lint retains only the four pre-existing warnings. Live checks confirm all six canonical tables have
  RLS, authenticated SELECT, no authenticated INSERT, and no anonymous SELECT. No schema/data writes.
- **Phase B 2A shipped 2026-07-15:** Applied immutable `disc_state_events`, `bag_versions`, and
  `bag_version_discs`; backfilled five bags/22 memberships; added trigger-backed physical-disc events,
  authenticated security-invoker capture/restore RPCs, Dexie v7, preview-first restore UI, and
  `rounds.bag_version_id` capture. Restore skips unavailable discs and creates a new version.
- **2A verification:** Manual backup confirmed by the owner. 353 tests pass across 39 files; build and
  diff checks pass; lint retains four existing warnings. Authenticated capture/restore passed in a
  rollback-only transaction with zero smoke rows. Advisor-requested FK indexes were applied in an
  append-only follow-up after the smoke exposed and fixed a self-recursive INSERT policy.
- **Phase B 2B shipped 2026-07-15:** Applied private capacity-neutral `bag_ghost_slots`, shared/private
  `shot_tags`, and append-preserving `disc_shot_tag_assignments` tombstones. Seeded 10 curated tags,
  added Dexie v8 mirrors, bag gap persistence/removal, and disc-detail tag assignment/custom creation.
- **2B verification:** Fresh manual backup confirmed. 355 tests pass across 40 files; build/diff pass;
  lint retains four existing warnings. Authenticated ghost insert, tag assignment, and tombstone update
  passed rollback-only; 10 system tags were visible and no smoke rows remained. Advisors found no new
  security issue or missing 2B FK index.
- **Phase B item 3 shipped 2026-07-15:** Applied the append-only `disc_photos`
  migration with owner-scoped metadata/Storage RLS, immutable front/back/side object versions,
  security-invoker register/delete/restore RPCs, and a private image-only bucket. Client-side WebP
  compression, signed display URLs, Dexie v9 Blob upload/retry queue, legacy `photo_url` fallback,
  replacement UI, and 30-day restore are implemented.
- **Item 3 verification:** 358 tests pass across 41 files and production build/diff pass. Lint retains
  only four pre-existing warnings. Rollback-only owner/foreign-user metadata, Storage-path, RPC,
  replacement, exact 30-day delete/restore, and idempotency checks passed with zero residue. The bucket
  is private/image-only/5 MB; RLS and all five policies are active. Advisors found no new security issue
  or missing B3 foreign-key index.
- **Phase B item 4 shipped 2026-07-15:** Applied private owner-scoped `lost_found_cases` and immutable
  `lost_found_updates`, security-invoker RPC entry points backed by atomic owner-checking helpers, and
  automatic disc `lost`/`in_locker` lifecycle transitions. `/bag/lost-found` supports optional shared
  course, browser GPS, area, notes, contact details, sightings, resolution, and full history. Dexie v10
  caches both entities and replays an idempotent offline queue. There is no timed auto-archive.
- **Item 4 verification:** 362 tests pass across 42 files; build/diff pass; lint retains four existing
  warnings. Rollback-only authenticated owner visibility, foreign-user invisibility, recovery atomicity,
  immutable client grants, and zero-residue checks passed. Linked database lint reports no B4 finding;
  its sole warning is the pre-existing unused `private.activity_transition.v_replaced_event` variable.
- **Phase B item 5 shipped 2026-07-16:** Applied immutable owner-scoped `disc_odometer_events` for
  throws, chain hits, and airballs; RPC-maintained non-negative cached disc totals; permanent
  `disc_cosmetic_unlocks` at 300/1,000/5,000 chain hits; and insert/update guards against direct total
  manipulation. Dexie v11 mirrors both ledgers and replays idempotent offline events. Disc detail now
  shows totals, milestone progress, quick entry/correction controls, and immutable history. Batch-ribbon
  summaries do not synthesize events.
- **Item 5 verification:** 370 tests pass across 44 files; build/diff pass; lint retains four existing
  warnings. Rollback-only threshold crossing, idempotent retry, correction-to-zero with permanent unlock
  retention, throws/airballs aggregation, foreign-user invisibility, direct-write blocking, immutable
  grants, and zero-residue checks passed. Database lint and advisors report no B5 finding.
- **Migration policy:** Do not retry automated backup commands or request manual backup confirmation;
  use append-only SQL, rollback notes, RLS negative tests, advisors, and post-apply smoke checks.
- **Phase C item 1 shipped 2026-07-16:** `/bag` is now a collection-first DISCS hub with
  Collection/Bags/Putters/Universe navigation, active/bagged/lost inventory counts, recent additions,
  and embedded locker compatibility. Add-disc supports one atomic 1–10 physical-copy operation. Disc
  detail derives putting and round context only from genuine recorded events and merges lifecycle,
  odometer, Lost & Found, and photo records into one reverse-chronological history. No schema change.
- **Item 1 verification:** 376 tests pass across 46 files; production build and diff checks pass; lint
  retains four existing warnings. Graphify was refreshed. Anonymous mobile/desktop browser checks
  reached the protected-route login redirect without errors or overflow; authenticated rendering remains
  unexercised in the isolated browser session.
- **Phase C item 2 shipped 2026-07-16:** Manage Bags now stages metadata, default selection, and all
  membership changes in one draft with Save/Cancel. A security-invoker RPC applies the owner-scoped
  change atomically, enforces the 35-disc hard cap, and captures exactly one immutable version.
  Restore preview names additions/removals/unavailable historical discs and restores metadata plus
  eligible membership as a new version. Main-bag deletion requires atomic replacement; the sole bag
  cannot be deleted. Owner-private names map to generic `Main Bag` only in external display contexts.
- **Item 2 verification:** 379 tests pass across 46 files; build/diff pass and lint retains four existing
  warnings. Live rollback-only checks passed grouped-save idempotency, one-version capture, capacity,
  owner/foreign-user isolation, direct-delete protection, restore provenance, replacement promotion,
  and zero residue. A cascade history-owner defect exposed by the smoke was fixed append-only. New RPCs
  are security invoker, authenticated-only, and absent from new advisor findings. Anonymous browser
  checks reached the protected login route at mobile/desktop widths with no errors or overflow.
- **Phase C item 3 shipped 2026-07-16:** Replaced the basic bag plot with Flight Spectrum. Current
  reality applies per-copy overrides and the existing wear adjustment; Official uses untouched catalog
  numbers. Deterministic proximity clusters expose counts and named member links. Persisted active ghost
  slots render as hollow dashed diamonds with explicit desired/capacity-neutral labels. Shape, border,
  text, legend, SVG titles, and an adjacent detail list avoid color-only meaning. Missing data is counted
  honestly and ghost loading failure no longer blocks the bag screen. No schema change.
- **Item 3 verification:** 383 tests pass across 47 files; build/diff pass and lint retains four existing
  warnings. React review added stale-request cleanup and non-blocking ghost errors. Anonymous mobile and
  desktop browser checks reached the protected login route with no runtime errors, overlay, or overflow;
  authenticated spectrum interaction remains unexercised in the isolated browser session.
- **Phase C item 4 shipped 2026-07-16:** Added the schema-free `bagResonance` pure-function contract and
  panel below Flight Spectrum. It scores current-reality flight coverage, speed ladder, and near-duplicate
  separation with Balanced, Coverage-first, and Minimal redundancy presets. Active ghost slots remain
  separate desired gaps and never affect physical disc count, capacity, or actual coverage. Empty bags
  still show the honest resonance/spectrum zero state. No schema or route change.
- **Item 4 verification:** 386 tests pass across 48 files; production build and diff checks pass; lint
  retains four existing warnings. React review passed hooks, keyboard semantics, stable keys, and preset
  button labeling. Anonymous mobile (390×844) and desktop (1280×800) browser checks loaded content with
  no runtime errors, overlay, or horizontal overflow; authenticated resonance interaction remains
  unexercised in the isolated browser session. Graphify refresh remains required after commit.
- **Phase C item 5 shipped 2026-07-16:** Extended the shipped J2 `/bag/compare` screen with attributed
  Personal reality, Official catalog, and eligibility-gated Community benchmark source states. Personal
  comparisons use effective per-copy numbers; official comparisons intentionally exclude overrides. When
  community data is unavailable, the UI explains the minimum sample/attribution requirement and falls
  back to official numbers. A bag-context selector now summarizes capacity, speed classes, occupied flight
  cells, missing profiles, and near-duplicate pairs without introducing an opaque score. No schema or
  route change.
- **Item 5 verification:** 389 tests pass across 49 files; production build and diff checks pass; lint
  retains four existing warnings. React review passed source-button keyboard semantics, stable keys,
  effect cleanup, and responsive summary layout. Anonymous mobile and desktop browser checks loaded the
  app and protected comparison route without runtime errors, overlay, or horizontal overflow; authenticated
  cohort and bag data remain unexercised in the isolated browser session. Graphify was refreshed.
- **Phase D item 1 shipped 2026-07-16:** PLAY now orders true active/crash recovery first, then Quick
  Play, routine selection/Free Play, routine creation, a separate suggested-next-session card, recent
  activity, and History. Quick Play resolves a valid device-local default, then the system Level-1
  regimen, then the lowest system level, with explicit unavailable handling. Dexie v12 adds ordered
  `regimenSets`; the PLAY list, regimen selector, and run setup now read remote-first with a scoped local
  fallback. The local resume path no longer waits for history/network data. No remote schema or route change.
- **Item D1 verification:** 397 tests pass across 51 files; production build and diff checks pass; lint
  retains four existing warnings. React review added request cleanup, semantic controls, an 80pt Quick
  Play action, and 320px-safe stacking. Anonymous mobile and desktop browser checks reached the protected
  PLAY login boundary without runtime errors, overlay, or horizontal overflow; authenticated PLAY data
  remains unexercised in the isolated browser session.
- **Resume point:** Phase D item 2 — adaptive stage fatigue check-ins, editable putter/weather/external
  factors, end-session perceived effort, and a user-disableable round-turn prompt. Manual catalog
  population remains owner-driven.

Update this file at each major commit/push. A fresh Codex task should be able to resume using this file,
`AGENTS.md`, and the single relevant spec without replaying previous conversations.
