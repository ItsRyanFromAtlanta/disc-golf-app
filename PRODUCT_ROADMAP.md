# Product Roadmap — Current Authority

Last reconciled: 2026-07-11

This document is the current sequencing and disposition authority. `MASTER_PROJECT_BLUEPRINT.md`
remains the visual/product-idea source for its original 21 screens; `SCREEN_SPECS.md` remains the
integration map; older tracks and layers in `DEVELOPMENT_PLAN.md` are historical after the shipped
Layer 1–4 work. New work extends the shipped React/Vite/Supabase app and never adopts the blueprint's
greenfield Expo schema literally.

> **Deliberate out-of-sequence work (owner decision 2026-07-14):** three features are being built ahead
> of their phase order — Round logging + quick-course/COURSES tab (Phase E), Disc comparison view
> (Phase C), and Game-flair disc cards (Phase B cosmetic). Each is self-contained with live schema, so
> the jump is intentional, not a sequencing violation. See `DEVELOPMENT_PLAN.md` "Jump-ahead features"
> (J1–J3) and `~/.claude/plans/1a-2yes-bright-pelican.md`.

## Product structure

- Bottom navigation now targets **PLAY / DISCS / COURSES / ME** because the J1 course directory shipped
  on 2026-07-14. The standalone STATS destination is obsolete: statistics live with their subject,
  while ME provides the career-wide summary.
- PLAY prioritizes: resume unfinished activity → Quick Play → select routine → create routine →
  History. Only one activity may remain unfinished; starting another closes the previous activity as
  incomplete and preserves it for correction/audit.
- DISCS owns Collection, Bags, Universe, and Lost & Found. `disc_molds` is the global catalog and
  `discs` remains the physical-owned-disc entity; no parallel Universe/Warehouse identity tree.
- ME opens on a takeaway-first analytics summary and links to Profile, Settings, Weekly Reports,
  History, Trophy Room, and detailed contextual analytics.

## Cross-cutting rules

- Ordinary information screens scroll vertically; active field screens keep primary controls in the
  viewport and move secondary controls into scrollable sheets.
- Raw events and version history are authoritative. Derived metrics use one registry, carry
  calculation versions, expose sample size/provenance, and avoid opaque composite scores.
- Bag and physical-disc changes are time-versioned. Activities reference the configuration used at
  the time. Historical restores preview additions/removals and create a new current version.
- User corrections preserve previous/new values, effective time, recorded time, source, and reason.
- Deleted activities are soft-deleted from normal views and statistics but retained for recovery and
  audit until the user invokes the privacy purge flow.
- Community data is opt-in. Private notes, locations, names, photos, and physical-disc identity never
  enter community aggregates.
- Every automatic non-critical prompt has a Settings toggle. Coaching requires a repeated supported
  pattern and never recommends stopping practice.
- Monday–Sunday is the default reporting week.

## Phase A — Production baseline and shared contracts

Recommended model: GPT-5.6 high for architecture/contracts; GPT-5.3-Codex medium for UI/documentation.

1. Shared scroll/header/sheet shell; navigation to PLAY / DISCS / ME; notification bell and active-
   activity pill; tab-tap scroll/root behavior.
2. Canonical activity lifecycle: pause, resume, finalize, auto-close previous, soft delete, correction
   provenance, and single-active-activity invariant.
3. Canonical event/audit contract and metric registry (player/disc/bag/routine/session/round/course
   scopes; recent/lifetime windows; confidence/sample gates; calculation versions).
4. Browser E2E baseline, storage/RLS tests, PWA manifest token correction, and real-device field test.
5. Expand Dexie/TanStack repositories and outbox diagnostics incrementally; preserve InstantLaunch
   until each replacement path is proven.

Phase A status: COMPLETE (2026-07-12). Automated equivalence, RLS, build/lint, browser, accessibility,
reload, and authenticated notification-route checks passed. The independent authenticated-session/
real-device gate was reported passed by the user; Codex did not directly observe that session or collect
device metadata.

## Phase B — DISCS data foundation

Recommended model: GPT-5.6 high. Review migration SQL and rollback notes before live apply.

Phase B status: **COMPLETE** (2026-07-16). The retained B1 catalog foundation and least-privilege
RLS are live; the automated ingestion/admin pipeline was subsequently scrapped and torn down in favor
of manual curation. B2 ships the migration-free, read-only client repository: normalized Dexie v6
caches for manufacturers/molds/plastics/mold-plastic links/runs/stamps, TanStack offline-first reads,
and migrated mold selection/search/onboarding consumers. Manual representative catalog population
remains owner-driven. Phase B 2A now ships immutable physical-disc events, bag versions/membership
snapshots, preview-first restore, Dexie v7 mirrors, and round-to-bag-version capture. Phase B 2B adds
capacity-neutral persisted ghost slots, a curated/private shot-tag dictionary, reversible assignment
tombstones, Dexie v8 mirrors, and management UI. Item 2 is complete. Item 3's private-photo client,
Dexie v9 queue, private Storage/RLS, signed display URLs, replacement history, and 30-day recovery are
live and verified. Item 4 now adds private Lost & Found cases, immutable update timelines, optional
course/GPS/notes/contact evidence, Dexie v10 offline replay, and atomic disc status transitions. Items
3 and 4 are complete. Item 5 now ships immutable odometer deltas, guarded cached totals, Dexie v11
offline replay, and permanent 300/1,000/5,000 chain-hit unlocks. All Phase B items are complete.

1. Catalog variants for mold/plastic/run/stamp with source provenance; manufacturer adapters; private
   custom configurations; community submission and admin-review queue.
2. Physical-disc timelines, bag configuration versions/snapshots, ghost-slot records, shot-tag
   dictionary/assignments, and reversible assignment tombstones.
3. **COMPLETE 2026-07-15.** Supabase Storage/RLS for up to
   three private disc photos (front/back/side), compressed derivative, offline queue, replacement
   history, and 30-day deletion recovery.
4. **COMPLETE 2026-07-15.** Lost & Found case/update timeline with optional GPS/course/notes/contact;
   offline replay and no timed auto-archive.
5. **COMPLETE 2026-07-16.** Odometer events (`total_throws`, chain hits, airballs/manual
   corrections/import provenance) and permanent cosmetic-tier unlock events.

## Phase C — DISCS experience and intelligence

Recommended model: GPT-5.3-Codex medium for UI; GPT-5.6 high for scoring/merge algorithms.

1. **COMPLETE 2026-07-16.** Collection-first DISCS hub, quantity-first duplicate add, rich
   physical-disc profile, photo flow, contextual performance, lifecycle, and history.
2. **COMPLETE 2026-07-16.** Bag editor with grouped save/version, state-in-time preview/apply restore,
   unavailable placeholders, one private main bag, and generic external label `Main Bag`.
3. Flight Spectrum (wear-adjusted default, official toggle, clustering, accessible ghost styling).
4. Bag Resonance first draft with component scores and presets; ghost gaps never count toward capacity.
5. Disc/bag comparisons using personal, official, and eligible community cohorts with graceful cohort
   broadening and explicit attribution.

## Phase D — PLAY, ME, reports, and contextual analytics

Recommended model: GPT-5.3-Codex medium; GPT-5.6 high for metric/report engines.

1. Revised PLAY ordering and Level-1 Quick Play default with profile/default selector.
2. Adaptive stage fatigue check-ins, editable putter/weather/external factors, end-session perceived
   effort, and user-disableable round-turn prompt.
3. ME career summary, Profile/Settings split, contextual notification preferences, goals pause/history,
   weekly deterministic report snapshots, and complete activity history/corrections.
4. Distance heat map, miss tendency, putter comparisons, new-putter experiment markers, before/after
   engine, ghost pacing, JYLY/Around-the-World, then clutch/voice features.

## Phase E — Courses, rounds, and interoperability

Recommended model: GPT-5.6 high for schema/import/round state; GPT-5.3-Codex medium for UI.

1. Data export first; then course directory/layout viewer, round creation/recording/finalization,
   activity-only rounds, group scorecard groundwork, weather, bag snapshot, and course preparation.
2. UDisc import after verifying the current export format. Imports always affect statistics; XP and
   cosmetic rewards apply only when deduplicated data arrives within seven calendar days of the event.
3. Course-aware loadouts, course/layout/hole analytics, lost-disc proximity, and explicit/fallback
   practice↔round relationships.
4. Live caddie only after rounds/course prep stabilize and server-side AI safety/cost/context rules are
   approved.

## Parked with revisit triggers

| Area | Parked work | Revisit trigger |
|---|---|---|
| Social | Sharing cards, QR Beam, bag tags, leaderboards, leagues, P2P competition, foil beaming | Public identity/privacy/moderation, course/round foundation, explicit opt-in social design |
| Community analytics | Anonymous mold/run/plastic/weight benchmarks | Consent pipeline, privacy thresholds, enough independent contributors |
| Commerce | Pro-shop discovery, re-order/affiliate links | Real retailer inventory source and partnership/affiliate agreement |
| Native/hardware | Capacitor distribution, watch, BLE, sensors, Maestro native flows | Stable PWA field flows plus a product need that browser APIs cannot meet |
| Experimental capture | Acoustic/CV detection, tournament-noise training | Core manual capture stable; acoustic validation exceeds 90% over representative outdoor sessions |
| AI narrative | Post-session/weekly/long-horizon AI prose | Deterministic reports stable, months of data, prompt/cost/privacy evaluation |
| Advanced sync UI | Full conflict-resolution center | Real unresolved conflicts demonstrate that notification + record-level resolution is insufficient |
| PDGA automation | Rating/profile synchronization | Official or explicitly permitted stable source/API |
| Device naming | User-facing names for anonymous installation IDs | Multi-device sync/settings UI ships |
| Metric materialization | Database aggregates/materialized summaries | Measured client/query cost shows pure on-device calculation is insufficient |

## Rejected or obsolete

- Standalone Stats tab and separate Analytics/Settings Control Tower.
- Parallel `global_disc_universe` / `collection_warehouse` identity tree.
- Automatic 30-day lost-disc archival.
- Opaque session/current-form composite score.
- Default daily near-miss notification spam and default weekly AI digest.
- MMORPG/social-warfare production voice; use a sports-coach voice.
- Dynamic topo placeholder generator as a standalone priority.
- Permanent UNION-only tag merges and MAX-only concurrent odometer reconciliation; use versioned
  assignments/tombstones and append-only telemetry events.
- Literal Expo/NativeWind migrations or Maestro-before-Capacitor workflow.

## Definition of roadmap completion

A phase is complete only when implementation, unit/integration/browser verification, schema/RLS
verification where relevant, documentation updates, DEVLOG entry, and a working checkpoint commit are
complete. Schema files remain append-only.
