# Phase A Architecture Contracts

Status: APPROVED FOR IMPLEMENTATION DESIGN (2026-07-11)

Recommended model: **GPT-5.6, high reasoning** for schema/security/contracts. Use
**GPT-5.3-Codex, medium reasoning** for normal implementation and tests.

This specification governs the production/shared-contract phase in `PRODUCT_ROADMAP.md`. It is a
design contract, not migration SQL. Before generating or running migration SQL, confirm the manual
Supabase backup and perform a fresh live-schema audit.

## 1. Canonical activity envelope

Add an `activities` parent record and link specialized domain records to it (`putt_sessions`,
`putting_regimen_runs`, `rounds`, and future activity types). Domain tables retain their specialized
facts and scoring fields.

Initial activity types: `putting_freeform`, `putting_regimen`, `disc_golf_round`. Reserved types:
`putting_game`, `fieldwork`, `course_practice`, `league_match`.

Lifecycle states: `draft`, `active`, `paused`, `completed`, `incomplete`.

- A user may have at most one `active` or `paused` activity. Enforce this in Supabase with a partial
  unique index and locally in a Dexie transaction.
- Paused activities never expire automatically.
- Starting a new activity auto-closes an existing practice as `incomplete` and shows a toast. Starting
  while a round is active/paused requires confirmation before closing that round.
- Empty drafts never appear in History and may be removed automatically.
- Soft deletion uses `hidden_at`; it is not a lifecycle state. Hidden activities do not contribute to
  statistics. Restoring one re-enters it and triggers scoped metric recalculation.
- Valid facts from incomplete activities count when they share the same activity identifier/logical
  window. Incomplete rounds do not contribute to full-round completion comparisons.

## 2. Lifecycle history

Use append-only `activity_state_events` with activity, previous/new state, reason, occurred/recorded
timestamps, source, installation ID, and metadata. Imported activities record only their real import
transition; never fabricate pauses/resumes. Derive active/paused duration from these events.

## 3. Finalization and inference

Rounds may finalize as completed or incomplete and independently carry `needs_review`. Infer course,
layout, holes, score/par, players, bag snapshot, timestamps, weather, and activity type from captured
facts. Store source and confidence for inferred values. Low-confidence or required missing fields lead
the review; optional fields never block saving. Practice finalization remains immediate.

## 4. Facts, audit, and provenance

Typed tables remain authoritative for sporting facts (`putt_events`, future `throw_events`,
`round_holes`, and summary tables). Do not duplicate every fact into the audit table.

Use append-only `audit_events` for meaningful changes: entity/action, occurred/recorded timestamps,
source/source reference, installation ID, previous/new values, optional reason, schema version, and
idempotency key.

Canonical sources: `live_capture`, `batch_entry`, `manual_entry`, `manual_correction`, `udisc_import`,
`pdga_import`, `system_inference`, `sensor`, `admin_repair`.

- Ordinary correction reasons are optional. Admin repairs and large score/odometer corrections require
  a reason.
- Immediate undo of unsynced active input may remove the local fact. Once synced or finalized, editing
  updates the typed current record and appends an audit event.
- Imported facts always affect statistics after deduplication. XP/cosmetics require ingestion within
  seven calendar days of occurrence.
- Generate an anonymous installation ID now; optional device naming remains parked in Sync Settings.

## 5. Metric registry

Define version-controlled JavaScript metric definitions before database materialization. Each metric
declares key/version, supported subjects, acceptable sources, windows, minimum samples, confidence
behavior, exclusions, formatting, and required inputs.

Initial subject scopes: player, physical disc, bag version, routine, session. Add round/course/layout/
hole scopes with their capture features. Initial groups: putting, practice load, fatigue, pressure,
disc usage, bag composition, progression, and activity volume.

Compute individual views with tested pure functions initially. Add Supabase RPC/materialization only
after measured data volume justifies it.

The existing capture split remains authoritative: real-time input writes ordered `putt_events`; batch
entry writes summaries only. Metrics must declare whether summaries are adequate. Never synthesize
per-putt sequence, timing, streak, miss-zone, or putter attribution from batch totals.

## 6. Shared application shell

`AppShell` owns `GlobalHeader`, `ScreenScrollRegion`, `SheetHost`, `ToastHost`, and `TabBar`.

- One vertical scroll region per ordinary screen; sticky safe-area header and centralized tab-bar
  clearance. Active scoring uses a non-scrolling field shell with secondary controls in sheets.
- Global header includes context/back title, active-activity pill, notification bell, and at most one
  context action.
- The active pill appears across PLAY, DISCS, and ME, but not auth/onboarding or the active activity.
- Notifications sync across devices when durable/actionable. Transient toasts stay local.
- Bottom navigation is PLAY / DISCS / ME; COURSES is added with the directory. First tap on the current
  tab scrolls to top; a tap while already at top returns to that tab's root. Preserve nested state only
  for expected resumable/editing workflows.

## 7. Notification contract

Persist category, priority, title/body, action type/payload, optional activity, created/read/resolved/
expiry times, and a dedupe key. Badge only unresolved actionable/critical items. Initial categories:
activity, lost disc, sync, weekly report, equipment, community review, achievement, coaching. Minor
audit events do not become notifications.

## 8. Offline transition

Do not replace InstantLaunch in one pass. Add the activity repository, mirror active InstantLaunch
state, make lifecycle transitions locally transactional, retain the proven putt outbox, then migrate
one entity family at a time. Extend outbox records with attempt count, last error class, next retry,
dependency key, and poison state. Remove duplicate storage only after crash/reconnect equivalence tests.

## 9. Browser E2E and PWA gates

Use Playwright for browser E2E. Required Phase A flows: onboarding/Quick Play; pause/navigation/resume;
single-active auto-close; round-close confirmation; offline reload/recovery/exactly-once reconnect;
completed edit/audit/recalculation; soft-delete/restore; tab scroll/root; notification sheet/Back; 320px
reflow; keyboard/gesture alternatives.

Correct PWA manifest colors to Sun-Drenched Topo tokens and verify icons, offline shell, safe areas,
standalone mode, and killed-app recovery on a real phone.

## 10. Deferred from Phase A

These remain in `PRODUCT_ROADMAP.md` with triggers: optional device naming (after multi-device sync UI),
database metric materialization (after measured volume), full conflict center (after real unresolved
conflicts), native Maestro (after Capacitor), and browser-to-native activity integrations.
