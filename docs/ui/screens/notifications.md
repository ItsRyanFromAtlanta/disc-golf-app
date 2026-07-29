# Notifications

| Field | Value |
|---|---|
| Route id | `notifications` |
| URL pattern | `/notifications` |
| Section | `play` — the route sits **outside** the `/practice` tree |
| Shell | `standard` |
| Header title | `Notifications` |
| Activity pill | shown |
| Scroll key | `notifications` |
| Preserves nested state | no |
| Page component | `src/pages/NotificationsPage.jsx` (22 lines) |
| Blueprint screen | none — post-blueprint; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

The full-page view of everything the app needs the player to look at: incomplete activities awaiting
review, and sync writes that stopped retrying. Each row either links to the thing it is about or offers a
one-tap dismiss.

The page is a 22-line wrapper. All of its behavior lives in `NotificationSheet`, which is also what the
global header bell opens — two surfaces over one component, described in full in § 2.

### The two surfaces

One concept, two presentations. This is the single most important thing to understand about this screen,
so it is stated before anything else.

| | Header sheet | This page |
|---|---|---|
| How it opens | Bell tap in `GlobalHeader` → `AppShell.jsx:95-110` sets `sheet` state | **Nothing in the app opens it.** Typed URL, bookmark, or external deep link only |
| Where it renders | `SheetHost`, mounted outside the shell branch (`AppShell.jsx:122`) | Inside `ScreenScrollRegion`, as an ordinary route |
| Chrome | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a grab handle, a `Notifications` `<h2>`, and a `Close Notifications` button (`SheetHost.jsx:6-25`) | The shell header's `Notifications` title. No dialog semantics, no close control |
| Background | `aria-hidden` on the standard content (`AppShell.jsx:86`), satisfying § 12's inert-background rule | Not applicable — the page *is* the content |
| Available from the ACTIVE shell | **Yes** — `SheetHost` mounts outside the shell branch, so it works during capture. (In practice the ACTIVE shell has no header, so there is no bell to tap.) | No — `standard` shell only |
| On `Review` | mark `read_at`, **close the sheet**, navigate (`AppShell.jsx:101-105`) | mark `read_at`, navigate (`NotificationsPage.jsx:14-17`) |
| On resolve (checkmark) | write `resolved_at`; the row disappears via the live query | identical |
| Empty state | `You're all caught up.` inside the sheet | `You're all caught up.` filling the page |
| Badge source | `useNotifications(user.id).badgeCount` in `AppShell` | The same hook, mounted a **second** time by the sheet component — see § 12 |

`NAVIGATION_MAP.md` § Sheet layer is the authority on the sheet layer itself: one `SheetHost`, one
`sheet` state object, one sheet at a time, background inert. Notifications is the only sheet the shell
opens; page-level sheets are opened by pages themselves.

The rule of thumb the code implies: **the sheet is the product; the page is a deep-link target.** But
nothing states that, and both `SCREEN_INVENTORY.md:37-38` and `NAVIGATION_MAP.md:138-140` describe the
page as "reachable from the global header," which it is not. Logged as
`_corrections/play-screens.md` P-4.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Direct URL / bookmark | Route match | Guarded by `ProtectedRoute` and the onboarding gate |
| In | External deep link | Route match | `PHASE_A_ARCHITECTURE.md:206` lists `/notifications` among canonical destinations |
| In | ~~Header bell~~ | — | **Does not navigate.** `GlobalHeader.jsx:22-30` renders a `<button onClick={onNotifications}>`; `AppShell` opens the sheet instead |
| Out | `Review` on an `activity_review` row | `navigate('/practice/history/{type}/{activityId}')` | After writing `read_at` |
| Out | `Review` on a `sync_review` row | `navigate('/practice/history')` | After writing `read_at` |
| Out | `Review` on a `weekly_report` row | `navigate(payload.href ?? '/profile')` | **No producer emits this type** — see § 12 |
| Out | Shell back control | `AppShell.handleBack()` → `resolveSectionRoot('play')` → `/practice` | The route carries `section: 'play'`, so back lands on the PLAY root regardless of where the user came from |
| Out | PLAY tab tap | `TabBar` → `/practice` | The PLAY tab renders as active here, because `section` is `play` |
| Out | Resolve checkmark | stays on the page; the row disappears | Only rendered when `notificationDestination` returns `null` |

`resolveRouteMetadata('/notifications')` matches at `routeMetadata.js:83-91`, well before the `/practice`
entries, so the placement outside the `/practice` tree is intentional and the section assignment is what
makes back and tab highlighting behave.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+     +-------- sheet variant --------+
|  [STATUS BAR]                                         |     |                               |
+-------------------------------------------------------+     |  ~~~~~~~ (grab handle)        |
|  <-  Notifications           [Resume] [bell 2]        |     |  Notifications          [ X ] |
+-------------------------------------------------------+     +-------------------------------+
|  (!) Review incomplete activity            Review     |     |  (!) Review incomplete...     |
|      Finish its details or keep it in                 |     |      Finish its details...    |
|      history for later review.                        |     |                     Review    |
+-------------------------------------------------------+     |  (~) Sync needs attention     |
|  (~) Sync needs attention                  Review     |     |      2 saved changes need     |
|      2 saved changes need review.                     |     |      review.        Review    |
+-------------------------------------------------------+     |                               |
|  (bell) Weekly report ready                  [ v ]    |     +-------------------------------+
|         Your Monday-Sunday recap.                     |     ^ background is aria-hidden
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

Unread rows carry `.notification-row-unread`; read-but-unresolved rows render identically minus that
class. The third row above shows the resolve-checkmark variant, which appears only when the notification
has no destination.

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back -> /practice, title "Notifications", activity pill, bell
Page wrapper
  page-main ............ <main class="notifications-page">, the page's only own markup
NotificationSheet (identical in both surfaces)
  empty-copy ........... "You're all caught up." — replaces the list entirely
  List (<ul aria-label="Notifications">)
    Row (repeats, newest created_at first)
      row-icon ......... IconAlertCircle (activity) | IconRefresh (sync) | IconBell (fallback)
      row-title ........ <strong>, notification.title
      row-body ......... optional secondary line
      row-review ....... button "Review" — only when notificationDestination() is non-null
      row-resolve ...... icon button, aria-label "Resolve {title}" — only when it is null
```

The page contributes exactly one element of its own (`page-main`). Everything else is
`NotificationSheet`, unchanged from the sheet presentation — which is why
`COMPONENT_LIBRARY.md` describes it as "a plain list with no chrome of its own."

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `empty-copy` | text | `You're all caught up.` | — | — | — | rendered when every notification is resolved, or there are none. Note it replaces the `<ul>` entirely, so the page has no heading of its own in this state |
| `row-icon` | icon | `IconAlertCircle` for `activity`, `IconRefresh` for `sync`, `IconBell` otherwise | — | — | — | `CATEGORY_ICON` covers 2 of the schema's 8 categories (`20260712213000_phase_a_notifications.sql:13`); the other six fall back to the bell |
| `row-title` | strong | `Review incomplete activity` / `Sync needs attention` | read / unread | — | — | unread adds `.notification-row-unread` |
| `row-body` | text | `Finish its details or keep it in history for later review.` / `{n} saved change(s) need review.` | present / absent | — | — | rendered when `body` is non-empty |
| `row-review` | button | `Review` | default / pressed | write `read_at`, then `navigate(destination)` | see § 2 | rendered when `notificationDestination(notification)` is non-null. **No loading or disabled state** — the `setStatus` await precedes navigation, so a slow write delays the transition with no feedback |
| `row-resolve` | icon button | `IconCheck`, `aria-label="Resolve {title}"` | default / pressed | write `resolved_at` | `notifications` | rendered when the destination is null. **Not awaited** (`NotificationSheet.jsx:32`), so a failure is silent; the row disappears anyway via the live query |

There is no "mark all read," no filtering, no grouping, and no pagination. The list is every unresolved
notification for the user, newest first.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Notification list | `useNotifications(userId)` → `notificationRepository.observe` | `hooks/useNotifications`, `lib/repository/notificationRepository` | **Dexie `liveQuery`** | subscription |
| Badge count | `isBadgeEligible` over the same list | `lib/notifications` | — | **pure** |
| Row destination | `notificationDestination(notification)` | `lib/notifications` | — | **pure** |
| Category preferences | `settingsRepository.listNotificationPreferences(userId)` | `lib/repository/settingsRepository` | Dexie | async, best-effort |

Signatures in `LIB_API_INDEX.md`.

**The read is local-first and genuinely reactive.** `observe` wraps a Dexie `liveQuery` over
`notifications` filtered by `user_id`, sorted by `created_at` descending
(`notificationRepository.js:50-52`), so the list updates without a refetch when anything writes to the
table — including the background pull.

`useNotifications` also **produces and syncs on mount** (`useNotifications.js:11-34`), in this order:

1. read notification preferences (failures swallowed, defaulting to enabled);
2. `produceActivityReviewNotifications` — one `activity_review` per non-hidden `incomplete` activity in
   the local Dexie mirror (`notificationProducers.js:5-19`), deduped on
   `activity-review:{activityId}`;
3. `produceSyncAttentionNotification` — one `sync_review` when any outbox row is poisoned
   (`notificationProducers.js:21-32`), deduped on `sync:poisoned-outbox`;
4. `sync.flush()` — drain the notification outbox through the `notification_upsert` /
   `notification_set_status` RPCs;
5. `sync.pull(userId)` — fetch the server's notifications and `bulkPut` them locally.

The whole chain ends in `.catch(() => {})`, so every failure in it is silent by design.

**Two filters, not one.** The list filter and the badge filter differ:

| | List (`NotificationSheet.jsx:12`) | Badge (`notifications.js:16-22`) |
|---|---|---|
| resolved | excluded | excluded |
| expired (`expires_at <= now`) | **included** | excluded |
| priority `info` | **included** | excluded |

So a low-priority or expired notification appears in this list while contributing nothing to the bell
badge. That is defensible — the badge is for urgency, the list is for completeness — but it is undocumented
and means the page can show rows a user was never alerted to.

**Preferences gate production, not display.** `notificationRepository.upsert` returns `null` without
writing when a **non-critical** notification's category is disabled
(`notificationRepository.js:25-28`), defaulting to enabled for unknown categories
(`notificationPreferences.js:15-17`). `sync` notifications are `CRITICAL`
(`notificationProducers.js:26-27`) and therefore bypass preferences entirely — consistent with `sync`
being absent from `NOTIFICATION_PREFERENCE_CATEGORIES` (`notificationPreferences.js:1-9`).

### Writes

| Mutation | Call | Idempotency key | Transaction boundary |
|---|---|---|---|
| Mark read on `Review` | `notificationRepository.setStatus(id, { read_at })` | `notification:set_status:{id}:{uuid}` | One Dexie `rw` transaction over `notifications` + `outbox` (`notificationRepository.js:43-47`) |
| Mark resolved | `notificationRepository.setStatus(id, { resolved_at })` | same shape | same |
| Produce (background) | `notificationRepository.upsert(notification)` | `notification:upsert:{id}:{uuid}` | One Dexie `rw` transaction; deduped in memory by `dedupeNotifications` before the write |

The local half satisfies `PHASE_A_ARCHITECTURE.md` § 14: validate, one Dexie transaction, write state,
enqueue the outbox row, commit, UI updates via the live query, sync in the background.

The **remote** half is a `security definer` RPC, `private.notification_upsert`
(`20260712213000_phase_a_notifications.sql:44-…`), which takes a per-user advisory lock on the dedupe key,
resolves expired duplicates, and updates or inserts under
`notifications_unresolved_dedupe_idx` — `unique (user_id, dedupe_key) where resolved_at is null`. That is
a proper server-side dedupe guard, and `notifications` is `select`-only to `authenticated` with all
mutation flowing through the RPC. This is the strongest write path documented in this batch.

Caveat: the client-side `idempotencyKey` on each outbox row embeds a fresh `crypto.randomUUID()`
(`notificationRepository.js:14`), so it identifies the *attempt*, not the *intent*. The RPC's dedupe key
is what actually makes replays safe.

### Offline

**Fully offline-capable, uniquely among the PLAY screens.** The list is a Dexie `liveQuery`, and both
mutations commit locally and enqueue outbox rows. With no network the page renders, rows are actionable,
and `Review` still navigates — to a destination screen that will itself fail to load, since
`practice-history` and `practice-history-detail` have no read fallback.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered here. There is no per-row sync badge and no
page-level indicator, so a locally-marked-read notification is visually identical to a synced one. The
irony is that this is the one screen whose data model could show all four states accurately.

## 6. Flow paths

**Happy path.** Open `/notifications` → the live query resolves from Dexie (no spinner: `notifications`
starts as `[]`, so the empty state renders first and is replaced) → tap `Review` → `read_at` is written
→ navigate to the activity or to History.

**First run / empty.** `You're all caught up.` The same string covers "no notifications have ever been
produced," "all resolved," and "the live query has not emitted yet." There is **no loading state** — the
initial render of a user with pending notifications briefly shows the caught-up message. On a warm Dexie
that flash is sub-frame; on a cold start after `sync.pull`, it is visible.

**Error.** No error state exists anywhere on this screen. `useNotifications`'s producer/sync chain ends
in `.catch(() => {})` (`useNotifications.js:28`); `observe`'s error callback sets the list to `[]`
(`useNotifications.js:31`), which renders as `You're all caught up.`; `onResolve` is not awaited, so a
failed resolve is silent. **A total failure of the notification subsystem is indistinguishable from
having no notifications.** That is the most significant behavior on this screen.

**Offline.** As § 5: the screen works. Its outbound links do not.

**Auth / guard.** `ProtectedRoute` gates the shell. Uniquely in this batch the page uses **optional
chaining** — `user?.id` (`NotificationsPage.jsx:12`) — and `useNotifications` returns an empty list for a
falsy `userId` (`useNotifications.js:12-15`). So the page degrades to the empty state rather than
throwing if it renders before auth resolves.

**Interlock.** **N/A** — no cap. The badge clamps at `99+` (`GlobalHeader.jsx:29`), which is display
formatting, not an interlock.

**Destructive.** **N/A** — nothing here deletes. `row-resolve` sets `resolved_at`, which removes the row
from the list and the badge permanently: `dedupeNotifications` only matches unresolved rows
(`notifications.js:32-45`) and the server's partial unique index is likewise scoped to
`resolved_at is null`, so re-resolving is impossible and a resolved notification can be superseded by a
freshly produced one with the same dedupe key. There is no undo and no archive view.

`STATE_MATRIX.md` does not exist (`_corrections/play-screens.md` P-10), so these states are described
inline.

## 7. Dependencies

### Schema

`public.notifications`, introduced by `20260712213000_phase_a_notifications.sql`:
`id`, `user_id`, `category` (CHECK over eight values: `activity`, `lost_disc`, `sync`, `weekly_report`,
`equipment`, `community_review`, `achievement`, `coaching`), `priority` (CHECK: `info` | `actionable` |
`critical`), `title` (non-empty), `body`, `action_type`, `action_payload` (JSON object, defaulted `{}`),
`activity_id` (composite FK to `activities (id, user_id)`), `created_at`, `read_at`, `resolved_at`,
`expires_at` (CHECK: `>= created_at`), `updated_at`, `dedupe_key` (non-empty). Indexes:
`notifications_unresolved_dedupe_idx` (partial unique), `notifications_user_created_idx`,
`notifications_badge_idx` (partial, priority-ordered).

RLS: a single owner `select` policy; `revoke all` from `public`, `anon`, `authenticated`, then
`grant select` to `authenticated` only. **All writes go through `private.notification_upsert` and
`private.notification_set_status`**, both `security definer`.

Local Dexie tables `notifications`, `notificationPreferences`, and `outbox` (`src/lib/db/dexieDb.js`).

The eight categories map to `NOTIFICATION_PREFERENCE_CATEGORIES` (`notificationPreferences.js:1-9`),
which lists **seven** — `sync` is deliberately absent because sync notifications are critical and not
opt-out-able.

### Library

`lib/notifications` (`NOTIFICATION_CATEGORIES`, `NOTIFICATION_PRIORITIES`, `isExpired`,
`isBadgeEligible`, `notificationDestination`, `dedupeNotifications`), `lib/notificationPreferences`,
`lib/notificationProducers`, `lib/repository/notificationRepository`,
`lib/repository/notificationSync`, `lib/repository/settingsRepository`, `hooks/useNotifications`.
Signatures in `LIB_API_INDEX.md`.

### Components

`NotificationSheet` — the whole screen. Shared with `AppShell`'s sheet. Details in
`COMPONENT_LIBRARY.md`.

### Screens

Links out to `practice-history-detail` (`activity_review`), `practice-history` (`sync_review`), and
`me-root` or an arbitrary `payload.href` (`weekly_report`, unproduced). Nothing links in. The concept is
present on every `standard`-shell screen through the header bell.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 7 (the notification contract: persisted category, priority, title/body,
action type/payload, optional activity, created/read/resolved/expiry times, dedupe key; badge only
unresolved actionable/critical items; minor audit events do not become notifications), § 6 ("Notifications
sync across devices when durable/actionable. Transient toasts stay local."), § 12, § 13 (`/notifications`
is a canonical destination), § 14. `NAVIGATION_MAP.md` § Sheet layer. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Good — `<ul aria-label="Notifications">`** (`NotificationSheet.jsx:16`) gives the list a name in both
  surfaces.
- **Good — `row-resolve` is an icon-only button with `aria-label="Resolve {title}"`**
  (`NotificationSheet.jsx:32`), naming the specific notification. This is the pattern
  `practice-history-deleted`'s `Restore` buttons should copy.
- **Good — category icons are `aria-hidden="true"`.**
- **Good — the bell's own label is count-aware:** `Notifications, {n} needs attention`
  (`GlobalHeader.jsx:26`).
- **Good — the sheet surface has correct dialog semantics** — `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, a labelled close button, and `aria-hidden` on the background
  (`SheetHost.jsx:6-25`, `AppShell.jsx:86`). `COMPONENT_LIBRARY.md` § Gaps calls this the best modal
  implementation in the codebase.
- **Gap — the page surface has no heading of its own.** `<main class="notifications-page">` contains only
  the list; the only heading is the shell's `<h1>Notifications</h1>`. This is, ironically, the one PLAY
  screen that does **not** duplicate the shell's `<h1>` (`_corrections/play-screens.md` P-7) — and the
  structure is better for it.
- **Gap — the sheet loses `SheetHost`'s focus contract on the page.** § 12 requires "focus enters the
  sheet and returns to its trigger"; on the page there is no sheet and no focus management, so a
  keyboard user lands wherever the route change left them.
- **Gap — no live region.** Rows appear and disappear from a Dexie `liveQuery` with no announcement, and
  the empty state replaces the list silently.
- **Gap — `row-review` has no in-flight state.** It awaits `setStatus` before navigating with no
  disabled state, spinner, or announcement.
- **Gap — `row-review`'s accessible name is just `Review`.** Every row's button reads identically; the
  title above it is not associated. `aria-label={\`Review ${title}\`}` would match what `row-resolve`
  already does.
- **Gap — unread state is conveyed by a class only.** `.notification-row-unread` has no text or icon
  counterpart, so read and unread are indistinguishable to assistive tech.

## 9. Events and telemetry

**Metrics.** **N/A** — no metric readout renders here. `PHASE_A_ARCHITECTURE.md` § 5 does not apply.

**Notifications.** This is *the* notification screen, so § 7 is the governing contract:

| § 7 requirement | Implementation |
|---|---|
| Persist category, priority, title/body, action type/payload, optional activity, created/read/resolved/expiry times, dedupe key | All present as columns, all CHECK-constrained |
| Badge only unresolved actionable/critical items | `isBadgeEligible` (`notifications.js:16-22`), which additionally excludes expired items |
| Initial categories: activity, lost disc, sync, weekly report, equipment, community review, achievement, coaching | All eight in the schema CHECK. **Two are produced**: `activity` and `sync` |
| Minor audit events do not become notifications | Honoured — producers fire only on non-hidden `incomplete` activities and poisoned outbox rows, and both are deduped |

Consumed here; produced by `useNotifications`'s mount chain, which runs on **every** screen because
`AppShell` mounts the hook.

**Lifecycle events.** None written. Notification status changes are their own outbox operations
(`upsert`, `set_status`) and do not touch `activities`, `activity_state_events`, or the audit chain.

## 10. Tests

### Existing coverage

`src/lib/notifications.test.js` (three cases: badge eligibility including the expired and `info`
exclusions; dedupe preserving `read_at` and `created_at`; destination mapping for the activity and sync
actions), `src/lib/notificationPreferences.test.js`,
`src/lib/repository/notificationRepository.test.js`. Confirmed by reading imports; matches the
`TEST_MAP.md` § PLAY row.

**There is no component or page test for `NotificationsPage.jsx` or `NotificationSheet.jsx`,** and
**`src/lib/notificationProducers.js` and `src/lib/repository/notificationSync.js` have no test files at
all** — so nothing covers the producer predicates, the flush loop's ordering, or the pull's `bulkPut`.
`useNotifications`'s double-mount behavior (§ 12) is untested by construction.

### Acceptance criteria

1. A resolved notification appears in neither surface and does not count toward the badge.
2. An `info`-priority notification appears in the list but not in the badge count.
3. An expired unresolved notification appears in the list but not in the badge count.
4. A notification with a recognised `action_type` shows `Review`; one without shows the resolve
   checkmark.
5. `Review` writes `read_at` before navigating, and the sheet surface additionally closes first.
6. Two producer runs for the same incomplete activity yield one notification row, with `read_at`
   preserved.
7. A `sync` notification is produced even when every optional category preference is disabled.
8. Marking read offline persists and syncs exactly once on reconnect.
9. The badge clamps at `99+`.
10. **Known failing:** a subsystem failure renders `You're all caught up.` rather than an error.
11. **Known failing:** no in-app control navigates to `/notifications`.

### E2E critical paths

`PHASE_A_ARCHITECTURE.md` § 9 names "notification sheet/Back" as a required E2E flow and records that no
suite was built. Per-screen additions: abandon an activity → verify an `activity_review` notification
appears in both surfaces → `Review` → verify it lands on that activity's report and the row shows as
read. Poison an outbox row → verify a `sync_review` notification and its destination. Disable the
`activity` preference → verify no new activity notification is produced but existing ones remain. Open
`/notifications` directly and verify it renders the same rows as the sheet. Mark read offline → reconnect
→ verify exactly-once and no duplicate row.

## 11. Tasks

#### T-notifications-1 — Give `/notifications` an entry point, or document it as deep-link-only

- **Capability:** `ui-routine`
- **Touches:** `src/components/NotificationSheet.jsx`, `src/components/AppShell.jsx`, and/or
  `docs/ui/SCREEN_INVENTORY.md`, `docs/ui/NAVIGATION_MAP.md`
- **Done when:** Either the sheet gains a `See all` control that navigates to `/notifications` and closes
  itself, or `SCREEN_INVENTORY.md:37-38` and `NAVIGATION_MAP.md` § Sheet layer are corrected to state
  that the bell opens a sheet and the page is a deep-link destination.
- **Verify:** `grep -rn "'/notifications'" src/` finds a navigation call, **or**
  `_corrections/play-screens.md` P-4 is resolved and removed.
- **Commit:** `fix: reconcile the notifications page with the header sheet`

#### T-notifications-2 — Surface notification subsystem failures

- **Capability:** `data-access`
- **Touches:** `src/hooks/useNotifications.js`, `src/components/NotificationSheet.jsx`
- **Done when:** A producer, flush, pull, or `observe` failure renders a distinguishable state — at
  minimum, the caught-up copy is not shown when the list could not be read. `onResolve` failures surface
  rather than being swallowed.
- **Verify:** `npm test` with a hook-level test asserting an error state, plus a manual check with
  IndexedDB blocked.
- **Commit:** `fix: distinguish notification failures from an empty inbox`

#### T-notifications-3 — Mount the notification subscription once

- **Capability:** `data-access`
- **Touches:** `src/hooks/useNotifications.js`, `src/components/AppShell.jsx`,
  `src/components/NotificationSheet.jsx`
- **Done when:** Opening the sheet or the page does not start a second producer run and a second sync
  adapter concurrently with `AppShell`'s. The list and the badge read one subscription — a context
  provider or a lifted prop, not two hook instances.
- **Verify:** `npm test` asserting one `sync.flush` call when both surfaces are mounted; manual check
  that the outbox is drained once.
- **Commit:** `fix: share one notification subscription across surfaces`
- **Blocked by:** § 12 open question 1.

#### T-notifications-4 — Name each row's Review button

- **Capability:** `ui-routine`
- **Touches:** `src/components/NotificationSheet.jsx`
- **Done when:** `row-review` exposes `Review {title}` to assistive tech, is disabled while its write is
  in flight, and unread state has a non-visual counterpart. Visual output unchanged.
- **Verify:** `npm run lint` plus a VoiceOver pass over three rows in both surfaces.
- **Commit:** `fix: label notification actions and unread state`

#### T-notifications-5 — Decide the fate of the unproduced notification types

- **Capability:** `docs`
- **Touches:** `src/lib/notifications.js`, `PHASE_A_ARCHITECTURE.md`
- **Done when:** Either `weekly_report` notifications are produced (the `weekly_report_snapshots` table
  and `weeklyReportRepository` already exist), or `notificationDestination`'s `weekly_report` branch and
  the six unused category values are recorded as reserved-for-future with the trigger that would activate
  them.
- **Verify:** `grep -rn "weekly_report" src/lib/notificationProducers.js` finds a producer, or the
  decision is recorded in `PHASE_A_ARCHITECTURE.md` § 7.
- **Commit:** `docs: record the notification category roadmap`

## 12. Open questions

1. **`useNotifications` is mounted twice whenever either surface is open.** `AppShell` mounts it for the
   badge (`AppShell.jsx:24`) and `NotificationSheet` mounts it again for the list
   (`NotificationSheet.jsx:11`). Each instance creates its own sync adapter, runs both producers, and
   flushes the notification outbox. The Dexie transactions and the RPC dedupe key make this *safe*, but
   two concurrent flushes over the same outbox rows is not a designed behavior and is untested.
   Task `T-notifications-3`.
2. **Is the page or the sheet canonical?** `PHASE_A_ARCHITECTURE.md:206` requires `/notifications` as a
   canonical destination and the route exists; the product only ever opens the sheet. Until this is
   decided, the page is untested surface area that a deep link can land a user on.
   `_corrections/play-screens.md` P-4.
3. **Six of eight categories and one of three destination types are unreachable.** Only `activity` and
   `sync` are produced; `notificationDestination`'s `weekly_report` branch (`notifications.js:28`) has no
   producer, and `lost_disc`, `equipment`, `community_review`, `achievement`, and `coaching` exist only in
   the schema CHECK and the preferences list. A user can toggle preferences for notifications that cannot
   occur.
4. **Nothing resolves an `activity_review` notification when the user acts on it.** `Review` writes
   `read_at` and navigates; `isBadgeEligible` ignores `read_at` entirely
   (`notifications.js:16-22`), so the badge persists until the underlying activity is completed, hidden,
   or corrected out of `incomplete` and a later producer run stops re-upserting it. See
   `screens/practice-history-detail.md` § 12 item 4 and task `T-practice-history-detail-5`.
5. **The list shows expired and `info` notifications the badge ignores.** Deliberate or accidental? § 7
   specifies badge behavior and says nothing about list behavior.
6. **No sync indicator on the one screen whose data supports it.** Every notification row has a local
   pending/synced state available through its outbox row, and none of the four calm states from
   `PHASE_A_ARCHITECTURE.md` § 12 is rendered.
7. `_corrections/play-screens.md` P-4 (no entry point) and P-10 (missing `STATE_MATRIX.md`) touch this
   screen. P-7 (double `<h1>`) notably does **not** — this screen gets it right.

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no notification
centre. The concept enters through `SCREEN_SPECS.md:14-18`, which folds the expansion Screens 22–25 into
"DISCS Collection/Rich Profile/Lost & Found **and the shared notification sheet** rather than creating a
parallel application tree" — note that sentence names the *sheet*, not a page — and through
`PHASE_A_ARCHITECTURE.md` § 6 and § 7, which specify the header bell, cross-device sync for
durable/actionable notifications, and the persistence contract.

The page at `/notifications` exists because `PHASE_A_ARCHITECTURE.md:206` lists it among canonical
destinations. Its only divergence from that contract is that nothing navigates to it
(`_corrections/play-screens.md` P-4).

Standing divergences #1 (React/Vite) and #5 (four tabs) apply; see `SCREEN_SPECS.md`.
