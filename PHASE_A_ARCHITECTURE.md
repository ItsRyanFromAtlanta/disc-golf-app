# Phase A Architecture Contracts

Status: APPROVED FOR IMPLEMENTATION (2026-07-12)

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

## 11. Approved UX behavior (walkthrough 2026-07-12)

### Shell and navigation

- The authenticated ordinary-screen header is consistent across PLAY, DISCS, and ME. The notification
  bell stays at the far right; the active-activity pill sits to its left and disappears when no active
  or paused activity exists or while viewing that activity.
- A current-tab tap scrolls the current screen to the top. A second tap while already at the top, or
  immediately after the first tap, returns to that tab's root.
- Restore scroll position on Back. Preserve nested route state only for resumable activities or
  unfinished edits; ordinary browsing returns to the section root.
- Existing `/practice/*` URLs remain compatible through aliases/redirects while canonical PLAY routes
  are introduced. Do not break recovery URLs or bookmarks during the shell migration.

### PLAY hierarchy

PLAY orders: resume active/paused activity; Quick Play; select routine; create routine; suggested next
session; recent activity; History. Quick Play uses Level 1 unless the profile default or its adjacent
selector changes it. When an activity exists, one detailed resume card replaces the normal hero; the
header pill remains the global shortcut rather than a second competing resume card.

### Lifecycle interaction details

- Opening setup creates at most a local draft. The first meaningful sporting fact starts the activity.
- Deliberate navigation away from active capture pauses immediately and shows a local toast. App
  backgrounding has a 60-second grace period before local pause; recovery explains why it paused.
- Starting another practice atomically marks the previous practice incomplete and starts the new one.
  Offer Undo only until the replacement records its first meaningful fact.
- Starting while a round is active/paused requires confirmation with Continue Round, Save Round as
  Incomplete and Start, and Cancel actions.
- Old incomplete activities may be corrected but never reactivated as the current live activity.
- Practice finalization never blocks on putter, weather, fatigue, effort, notes, or tags. Round review
  leads with required missing and low-confidence inferred fields, then optional details.
- Finalization succeeds locally while offline and reports `Saved on this device · Sync pending`.

### Hide, restore, and reports

- User-facing Delete hides the activity from ordinary History and metrics. Recently Deleted exposes it
  for 30 days initially; audit retention continues until the explicit privacy-purge policy applies.
- Restore returns it to History and performs scoped recalculation. Immutable reward-ledger rules prevent
  hide/restore from duplicating rewards.
- Weekly report windows are Monday–Sunday. Reports are immutable versions accessible from notification,
  ME, and History; corrections may offer regeneration without rewriting the original snapshot.

## 12. Presentation and accessibility contract

- Ordinary screens have exactly one vertical scroll owner beneath a sticky safe-area header and above
  a fixed safe-area tab bar. Shell-level tokens provide clearance; pages do not calculate it.
- `ActiveActivityShell` is non-scrolling for primary field controls. Putter, weather, fatigue, notes,
  filters, finalization, and other secondary tasks open in bottom sheets.
- One sheet is active at a time. Focus enters the sheet and returns to its trigger; the background is
  inert. Unsaved text survives accidental dismissal. Do not add multiple detents without a use case.
- Primary field actions remain at least 80pt; secondary controls remain at least 44×44pt. Every required
  gesture has a visible alternative. Destructive actions do not sit beside scoring actions.
- Support 320px width, 200% text scaling, keyboard-safe fields, reduced motion, logical landmarks/focus,
  screen-reader action consequences, and text/data alternatives for charts.
- Ghost records use opacity plus an icon, label, and outline; color or opacity alone is insufficient.
- Respect every safe-area inset in portrait and landscape across browser, installed PWA, and future
  Capacitor shells. Do not hardcode device notch/home-indicator sizes.
- Offline/sync labels reserve stable layout space and use calm states: Saved on Device, Syncing, Synced,
  and Needs Attention. A network failure never replaces active capture with a full-screen error.

## 13. Component and route boundaries

`AppShell` owns header, ordinary scroll region, tab bar, safe areas, route presentation, sheet host, and
toast host. `ActiveActivityShell` owns the fixed field layout, pause placement, sheets, and sync-status
presentation. Neither owns activity rules, scoring, repositories, or page-specific data.

Introduce these boundaries as touched rather than reorganizing the whole source tree. Route metadata
declares section, title/back behavior, shell type, activity-pill visibility, state preservation, and
scroll key. Pages must not manually duplicate shell decisions.

Canonical destinations are `/play`, `/discs`, `/me`, `/notifications`, their nested feature routes,
and one `/play/activity/:activityId` lifecycle/history destination. Specialized active capture routes
may remain internally until practice engines are safely unified.

## 14. Repository and transaction contract

UI requests lifecycle transitions through an activity service/repository; it never directly changes
lifecycle columns. Initial operations: create draft, start, pause, resume, finalize, mark incomplete,
hide, restore, correct, get active/by-id, list history, and subscribe to active.

Every mutation carries expected state/version, occurred time, source, installation ID, optional reason
and metadata, and an idempotency key. Results return the activity, state event, replaced activity when
applicable, sync state, and warnings.

Local capture order is authoritative: validate; begin one Dexie transaction; update current state;
append local event; queue dependent idempotent outbox operations; commit; update UI; sync in the
background. Auto-close plus replacement start is one local transaction.

Remote transitions that enforce the single-active invariant use an idempotent authenticated Supabase
RPC that serializes the user's transition, validates expected state/version, writes current records and
append-only events together, and returns the result. Independent browser find/update/insert calls are
not acceptable. A partial unique index remains the database safeguard.

Conflicts preserve valid sporting facts. A finalize-versus-new-fact conflict marks the activity for
review. Two different offline starts preserve both, deterministically close the later conflicting
activity unless replacement intent is clear, and withhold duplicate completion rewards pending review.

## 15. Tunable policies

Centralize and test these initial values rather than scattering literals:

| Policy | Initial value |
|---|---:|
| Background auto-pause grace | 60 seconds |
| Meaningful draft retention | 7 days |
| Recently Deleted visibility | 30 days |
| Replacement Undo | Until replacement's first meaningful fact |
| Notification expiry | Category-specific |
| Compact activity pill | Content/layout driven |

## 16. Required versus optional Phase A

Required: shared shells and route metadata; PLAY/DISCS/ME navigation; scroll/safe-area/sheet behavior;
local lifecycle engine and repository; Dexie atomicity; InstantLaunch bridge; reviewed server schema,
RPCs, RLS and negative tests; freeform/regimen integration; unified history/correction/hide/restore;
active pill/resume card; actionable sync/activity notifications; browser E2E and real-device gates.

Optional and non-blocking: rich animations; tablet-specific layouts; detailed paused-time charts;
draft-management UI; multiple skeleton systems; rich notification grouping; user-adjustable pause
threshold; landscape-specific capture redesign. Do not include them before offline/crash equivalence.
