# Changelog

User-visible changes, newest first. Detailed engineering history remains in `DEVLOG.md`; current
status and sequencing live in `PRODUCT_ROADMAP.md`. No versioned release has been cut yet, so
everything below is unreleased-but-shipped to production through `main`.

## Unreleased

### Added — Phase E (2026-07-17)

- Structured own-your-data export from Profile → Settings: deterministic, formula-safe CSVs in a
  versioned ZIP, read from the authoritative account rather than a partial local cache.

### Added — Phase D (2026-07-16)

- PLAY reordered around resuming real work first, then Quick Play, routine selection, and history.
- Adaptive stage fatigue check-ins, editable putter/weather/external session factors, end-session
  perceived effort, and a disableable round-turn prompt.
- ME career summary; Profile and Settings split; notification preferences; goals with pause/resume and
  immutable status history; deterministic weekly report snapshots with version history.
- Practice analytics at `/practice/stats`: distance confidence, 9-zone miss tendency, longitudinal
  putter comparisons, new-putter before/after markers, and best-run ghost pacing.
- Classic drills (JYLY, Around the World), a one-attempt Clutch Simulator with a randomized deadline,
  and opt-in Match Mode voice coaching gated behind repeated-pattern thresholds.

### Added — Phase C (2026-07-16)

- Collection-first DISCS hub with quantity-first duplicate add and a consolidated physical-disc profile.
- Bag editor with grouped save, versioned snapshots, and preview-first restore.
- Flight Spectrum with wear-adjusted and official views, clustering, and accessible ghost styling.
- Bag Resonance draft with transparent component scores and selectable presets.
- Disc and bag comparisons across personal, official, and eligibility-gated community sources.

### Added — Phase B (2026-07-15 – 2026-07-16)

- Normalized read-only disc catalog with offline-first caching.
- Physical-disc timelines, versioned bag membership, ghost slots, and shot tags.
- Private disc photos with replacement history and 30-day recovery.
- Lost & Found cases with update timelines and automatic disc status transitions.
- Disc odometer (throws, chain hits, airballs) with permanent 300/1,000/5,000 chain-hit unlocks.

### Added — Jump-ahead work (2026-07-14 – 2026-07-15)

- COURSES tab with course directory, quick-course creation, layout/hole detail, offline scorecard
  capture, round history, and finalization.
- Disc comparison view and opt-in game-flair disc cards.

### Added — Phase A (2026-07-12)

- Shared app shell: global header, bottom navigation, active-activity pill, notification bell, sheets,
  toasts, safe-area layout, and per-route scroll restoration.
- Canonical activity lifecycle with pause/resume/finalize, single-active-activity enforcement, soft
  delete with Recently Deleted restore, and correction provenance.
- Unified activity history, actionable notifications, and offline capture with crash recovery.

### Changed

- Navigation reconciled to PLAY / DISCS / ME with contextual statistics (2026-07-11), then extended to
  PLAY / DISCS / COURSES / ME when the course directory shipped (2026-07-14). No standalone Stats tab.

### Removed

- Automated disc-catalog ingestion (2026-07-13/14). The scraper pipeline, admin review route, Edge
  Functions, and staging tables were removed after the source stopped exposing parseable flight
  numbers. The catalog is curated manually; the normalized catalog schema is retained.
