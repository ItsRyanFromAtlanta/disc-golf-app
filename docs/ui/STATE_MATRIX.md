# State Matrix

The cross-cutting states every screen has to handle, as a **delta**: what the app does today against
what `PHASE_A_ARCHITECTURE.md` requires. The gap column is the point of the document — it is a
ready-made backlog, ordered in § 5.

| | |
|---|---|
| Verified against | `7351964` (branch `claude/ui-documents-status-3fphcw`) |
| Routes covered | 33 (`src/lib/routeMetadata.js`), 32 distinct page components |
| Method | § 4 |

## How to reference this from a screen document

Every state below has a short stable id (`S-EMPTY`, `S-OFFLINE-READ`, …). `TEMPLATE.md` § 7 requires
screen documents to cite those ids **instead of re-describing shared behavior**:

> **First run / empty.** `S-EMPTY` — renders `No courses yet. Build a quick course for your next round.`
> inside `.empty-state`. No divergence from the shared pattern.

Two rules follow from that:

1. **Shared state behavior is defined here and nowhere else.** A screen document records only what its
   screen does *differently* from the row — the copy string, the element id, a divergence. It does not
   restate the row.
2. **A screen that diverges says so against the row id.** "Diverges from `S-ERR-BLOCK`: the error is
   inline and the page stays usable" is the whole sentence a screen document owes.

Ids are stable. If a state is retired, its id is struck through rather than reused, because screen
documents cite them by name.

Design tokens are not repeated here — see `AGENTS.md` § Design system. Component props are in
`COMPONENT_LIBRARY.md`; function signatures in `LIB_API_INDEX.md`; screen status in
`SCREEN_INVENTORY.md`.

---

## 1. The contract baseline

`PHASE_A_ARCHITECTURE.md` § 12 is the presentation and accessibility contract and is not restated
here. Read it. The clauses this document measures against are its last three bullets plus the scroll
and target rules; § 6 (shared shell ownership), § 8 (offline transition), § 11 (approved UX behavior,
especially "Lifecycle interaction details"), and § 14 (repository and transaction contract) supply the
rest.

Three clauses do most of the work below, so they are quoted rather than paraphrased:

> Offline/sync labels reserve stable layout space and use calm states: Saved on Device, Syncing,
> Synced, and Needs Attention. A network failure never replaces active capture with a full-screen
> error. — `PHASE_A_ARCHITECTURE.md:194-195`

> Ghost records use opacity plus an icon, label, and outline; color or opacity alone is insufficient.
> — `PHASE_A_ARCHITECTURE.md:191`

> Support 320px width, 200% text scaling, keyboard-safe fields, reduced motion, logical
> landmarks/focus, screen-reader action consequences, and text/data alternatives for charts.
> — `PHASE_A_ARCHITECTURE.md:189-190`

**Four labels, exactly.** `Saved on Device`, `Syncing`, `Synced`, `Needs Attention`. The codebase ships
five vocabularies for the same underlying status (`S-SYNC`), only one of which uses all four words, and
none of which reserves stable layout space. That is the single largest contract divergence in this
document.

**"Never replaces active capture with a full-screen error"** binds the two `active`-shell routes
(`freeform-active`, `regimen-active`). It does not strictly bind ordinary screens — but 19 of 32 page
components *do* replace themselves with a bare error paragraph (`S-ERR-BLOCK`), and none of them offer
a retry (`S-RETRY`). The contract's spirit and the shipped pattern are far apart even where the letter
does not bind.

**Note on § 11 versus § 12.** `PHASE_A_ARCHITECTURE.md:168` specifies a fifth label format —
`Saved on this device · Sync pending` — that § 12's four-label list does not contain. That is an
internal contradiction in the contract itself, logged as C-2 in `_corrections/state-matrix.md`. This
document treats § 12 as authoritative because § 12 is the presentation contract.

---

## 2. The matrix

Severity scale:

| Severity | Meaning |
|---|---|
| `none` | Ships as the contract requires |
| `cosmetic` | Behaviorally correct; copy, layout, or naming diverges |
| `contract-violation` | A stated contract clause is not met |
| `data-risk` | A user's captured work can be lost, stranded, or silently diverge from the server |

### Session and identity

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-AUTH-BOOT` | Auth session still resolving | Inside the shell: `ProtectedRoute` renders `<p className="loading">Loading...</p>` (`src/components/ProtectedRoute.jsx:7`). At `/`: `App.jsx:49` renders **`null`** — a fully blank screen with no indicator until `getSession()` resolves. | Not named explicitly in § 12; the screen-reader clause implies a perceivable, announced state. Blank is not a state. | `cosmetic` at `/`, `none` in-shell | `ProtectedRoute` |
| `S-AUTH-REQUIRED` | No session at a guarded route | `ProtectedRoute` returns `<Navigate to="/login" replace />` (`ProtectedRoute.jsx:8`). No explanatory copy, no return-to destination preserved. | § 6 places auth outside the tab shell; no redirect-intent requirement is stated. | `none` | `ProtectedRoute` |
| `S-GUEST` | Anonymous / guest session | `AuthContext` exposes `isGuest = user?.is_anonymous` (`src/context/AuthContext.jsx:24`). **Exactly one consumer**: `AuthPage`, which flips its heading to `Save Your Progress` and swaps three calls to the guest-conversion variants (`AuthPage.jsx:74,88,99,112-115`). No other screen renders anything differently for a guest — no banner, no nudge, no capability difference. | Not specified in § 12. `SplashPage.jsx:49` promises "save progress later", so a guest is expected to be reminded somewhere. | `cosmetic` — unspecified rather than violated; flagged because screen documents will otherwise assume a guest state exists per-screen and it does not | `AuthContext.isGuest` |
| `S-ONBOARD` | Never-onboarded user (zero bags) | `useOnboardingGate` (`src/hooks/useOnboardingGate.js`) runs **once per app load**, fetches bags, and redirects to `/onboarding` when `needsOnboarding(bags)`. **Fails open** on fetch rejection (`useOnboardingGate.js:28`, `.catch(() => {})`) — deliberate, so a network hiccup cannot trap an onboarded user in a loop. Consequence: a genuinely un-onboarded user who is offline at launch lands in the tab shell with no data and no explanation. | § 6 requires the gate; no offline behavior is specified for it. | `cosmetic` (inference: the offline-launch consequence is derived from the code path, not observed) | `useOnboardingGate` |

### Loading and mutation

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-LOAD` | Initial page read in flight | **24 of 32 page components** render `<p className="loading">…</p>` as an early return, keyed on `!data` rather than an explicit flag on most pages. Copy varies: the plain `Loading...` in 14 of them, then `Loading courses...`, `Loading scorecard...`, `Loading career summary…`, `Loading weekly reports…`, `Loading settings…`, `Loading goals…`, `Loading round setup...`, `Loading round summary...`, `Loading course...` — and both ASCII `...` and `…` are in use. `.loading` is a single colour rule (`src/App.css:793-795`); there is no skeleton system. **None of the 24 carries `aria-live`, `role="status"`, or `aria-busy`.** **`lost-found` has no loading state at all** (resolved 2026-07-29, was `_corrections/state-citations-2.md` S-1): `LostFoundPage.jsx` declares no `loading` flag and takes no early return — `discs`, `courses`, `cases`, and `updates` all initialize to `[]` (`:48-51`) and the full body renders on first paint. So its **empty state doubles as its loading state**: during the initial read a user *with* cases is told `No Lost & Found cases yet.` (`:194`). This is the same defect already recorded for `NotificationsPage` under `S-EMPTY`, giving the pattern two instances. `lost-found`'s is milder — `lostFoundRepository` is cache-backed, so the window is short on a warm cache — but on a cold start it is the same false statement. | § 12 requires "screen-reader action consequences". A silent swap from a loading paragraph to a full page is not announced. § 16 lists "multiple skeleton systems" as explicitly *optional*, so the plain paragraph is a legitimate choice. | `contract-violation` (a11y announcement) + `cosmetic` (copy drift) | none — the pattern is copy-pasted per page |
| `S-LOAD-PARTIAL` | A secondary panel loads after the page | Handled ad hoc inside the page body: `DiscComparePage.jsx:233` (`Loading bag context...`), `PracticeMenuPage.jsx:217,258`, `BagPage.jsx:220`, `FreeformLogPage.jsx:638`, `RegimenSelectPage.jsx:54` (inline, not an early return), plus components `DiscProfileContext.jsx`, `MoldPicker.jsx`, `UniverseBrowser.jsx`, `PutterStep.jsx`, `PutterLineup.jsx`. | § 12's single-scroll-owner rule is unaffected. No specific requirement. | `none` — and this is the *better* pattern; see `S-ERR-BLOCK` | none |
| `S-SAVING` | A mutation is in flight | Where a shared component owns the form, this is correct: `EditableSection` holds `saving` state, swaps the label to `Saving...`, and disables both Save and Cancel (`src/components/EditableSection.jsx:26-34,53-56`). Page-owned forms replicate it by hand — `DiscFormPage.jsx:207`, `CourseFormPage.jsx:78`, `RoutineBuilderPage.jsx:166`, `AuthPage.jsx:172,207`, `GoalsPage.jsx:30`, `WeeklyReportsPage` (`Generating…`). `RoundScorecardPage.jsx:159` shows `Saving…`/`Autosaves` inside an `aria-live="polite"` toolbar — the only announced instance. **`SettingsPage` saves without any in-flight guard** (`SettingsPage.jsx:23,28,33` — no `saving` state, no `disabled`, no idempotency key; `saveProfile`, `toggleCategory`, and `saveTimezone` are each invoked inline from an `onChange`/`onBlur` handler at `:47`, `:48`, `:53` with only `.catch`). **Corrected 2026-07-29** (was `_corrections/state-citations-2.md` S-3): ~~`ProfilePage`~~ and its `:28` citation were removed from that sentence. `ProfilePage.jsx:28`'s `saveFields` is bare, but it is **never invoked directly** — it is the `onSave` prop of all four `EditableSection` instances on the screen (`:62`, `:132`, `:201`, `:276`), and `EditableSection` owns the in-flight state. `profile-details` is therefore an instance of this row's *correct* branch, not its exception; do not add a second, competing guard there. | Not directly specified. Double-submission protection is implied by § 14's idempotency-key requirement, which these paths do not carry. | `cosmetic`, rising to `data-risk` for `SettingsPage` unguarded repeat submits | `EditableSection` |

### Empty and insufficient

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-EMPTY` | The collection is genuinely empty | 18 of 32 pages render something. Four use the shared `.empty-state` block (`src/App.css:567`): `CoursesPage.jsx:46`, `CourseDetailPage.jsx:49`, `RoundsPage.jsx:61`, `RoundStartPage.jsx:131`. The other fourteen render a bare `<p>` with hand-written copy: `No sessions yet.` / `Nothing deleted recently.` (`HistoryPage.jsx:226`), `No putts logged yet today.` (`FreeformLogPage.jsx:640`), `No discs in this bag yet.` (`BagPage.jsx:222`), `No goals yet. Choose one measurable target to begin.` (`GoalsPage.jsx:61`), `No Lost & Found cases yet.` (`LostFoundPage.jsx:194`), `You don't have any bags yet.` (`DiscDetailPage.jsx:344`), `You're all caught up.` (`NotificationSheet.jsx:13`), `Nothing here yet.` (`TrophyWall.jsx:36`), etc. **`BagManagePage.jsx:228` renders its empty copy with `className="loading"`** — an empty state wearing the loading class. **`PutterLineup.jsx:89` renders the literal word `Empty`** for an empty role swimlane, also with `className="loading"`. | Not specified in § 12 beyond general legibility. | `cosmetic` — behavior is present and correct nearly everywhere; the class misuse and the absence of a shared component are the defects | `.empty-state` (4 of 18 pages) |
| `S-EMPTY-FILTER` | Filtered/searched down to nothing | Not distinguished from `S-EMPTY` anywhere. `HistoryPage.jsx:225` shows `No sessions yet.` when the `All`/`Freeform`/`Regimens` `ChipGroup` filters everything out — even though sessions exist. `BagLockerPage.jsx:248` and `TrophyWall.jsx:35` have the same shape. | Not specified. | `cosmetic` — but it actively misinforms: the user is told they have no data when they have data plus a filter | none |
| `S-INSUFFICIENT` | Data exists but is below a metric's minimum sample | Well-handled and deliberate, and **distinct from empty**. `SkillRadar.jsx:25` and `DiscProfileContext.jsx:5,9` render `Insufficient data`. `HistoryPage.jsx:32-38` widens a percentage into a Wilson interval below `WILSON_MIN_N_FOR_HIDING`. `GhostPaceCard.jsx:17` renders `N more real-time attempts to compare.` `SessionReport.jsx:132` renders `no baseline yet`. `CareerHubPage.jsx:50` states `Personal evidence only; division benchmarks remain unavailable.` `pct()` helpers render `—` for null throughout. | § 5 requires each metric to declare "minimum samples, confidence behavior". This is that behavior surfacing. | `none` — the strongest state in the codebase | `insights.wilsonInterval`, per-component `pct()` helpers |

### Error

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-ERR-BLOCK` | A read fails and replaces the whole screen | **19 of 32 page components** early-return a bare `<p className="form-error">{error}</p>` as their entire body: `ProfilePage:33`, `RoundScorecardPage:144`, `BagManagePage:180`, `RegimenRunPage:320`, `PracticeMenuPage:137`, `CourseDetailPage:27`, `DiscComparePage:105`, `RoundSummaryPage:86`, `SettingsPage:39`, `BagLockerPage:128`, `DiscDetailPage:99`, `CareerHubPage:20`, `BagPage:84`, `RoundsPage:45`, `CoursesPage:24`, `HistoryDetailPage:120`, `TrophyRoomPage:57`, `ConfidenceMapPage:34`, `HistoryPage:178` (plus `PutterLineup:73` and `PutterPicker:26` at component level). No header, no navigation, no retry — the raw `err.message` from Supabase or a thrown `Error`, styled only by `color: var(--color-negative)` (`App.css:469-473`). `DiscDetailPage.jsx:99` is the canonical instance and is documented as such in `screens/disc-detail.md` § 6. Six of the nineteen guard with `&& !data`, so a cached result wins over the error — `BagManagePage`, `BagLockerPage`, `DiscDetailPage`, `DiscComparePage`, `RoundsPage`, `CoursesPage`. The other thirteen do not. | § 12 forbids this only for active capture. `RegimenRunPage.jsx:320` **is** an `active`-shell route, so the letter of the contract binds there. Its `error` is set from the initial regimen load (`:231`) and from `handleStart` config validation (`:335`) — not from a capture-time network failure — so the specific prohibited sequence does not occur today. It is one `setError` call away from occurring. | `contract-violation` for `regimen-active`; `data-risk`-adjacent everywhere (see `S-RETRY`) | none — copy-pasted 19 times |
| `S-ERR-INLINE` | A failure is shown beside content that still works | The correct pattern, and it does exist. `RoundScorecardPage.jsx:181` — `Disc list unavailable; scores still save without a disc.` `DiscComparePage.jsx:235` — `Bag context is unavailable; the disc comparison above remains usable.` `DiscComparePage.jsx:157` — `Community benchmark unavailable: {reason} Showing official catalog numbers instead.` `BagPage.jsx:215` — `Desired slots unavailable: {error}`. `WeeklyReportsPage.jsx:67`, `GoalsPage.jsx:49`, `BagLockerPage.jsx:157`, `BagManagePage.jsx:192`, `DiscDetailPage.jsx:115`, `EditableSection.jsx:51`. **All of them use `.form-error`** — including the four that describe a benign degradation rather than an error. | § 12's calm-state principle. A degraded-but-working panel styled in `--color-negative` is not calm. | `cosmetic` — right behavior, wrong severity signal | none |
| `S-ERR-SILENT` | A non-critical dependency fails and nothing is shown | 24 occurrences of `.catch(() => {})` / `(() => [])` / `(() => null)` across pages, components, and hooks; 11 in `src/pages/` alone. Mostly annotated and defensible — `RegimenRunPage.jsx:193` "non-critical — swap suggestion/label just stay unavailable", `:291` "the report just omits these sections on failure", `:314` "XP/badges reconcile on the Trophy Room's next load". Two are not benign: `useNotifications.js:29` swallows every producer/sync failure **and** `notificationRepository.observe`'s error callback sets `[]` (`useNotifications.js:31`), so a notification failure is indistinguishable from "all caught up"; `useActivityNavigationLifecycle.js:50,63` swallow pause/resume failures, so a lifecycle transition can silently not happen. | § 7 requires actionable notifications to badge. A swallowed failure cannot badge. | `cosmetic` in general, `data-risk` for the notification and lifecycle cases | none |
| `S-RETRY` | The user can retry after a failure | **Zero read-retry affordances exist across all 32 page components.** A grep for `Retry` / `Try again` / `refetch` returns exactly three UI hits, all sync-retries, none read-retries: `HistoryPage.jsx:273` (`Retry activity sync`, shown only at `SYNC_STATUS.FAILED`), `SessionReport.jsx:73` (`Retry sync`, via `onRetrySync`), and `PwaUpdatePrompt.jsx:49` (`Reload now`, a service-worker update). Recovery from a failed initial read is a full browser reload, everywhere. | Not named as a clause in § 12, but § 9's required E2E flow "offline reload/recovery/exactly-once reconnect" presumes recovery is reachable from the UI. | `contract-violation` — this is the top backlog item in § 5 | none |

### Offline and sync

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-OFFLINE-READ` | A read with no network | **No page component reads `navigator.onLine` or subscribes to `online`/`offline`.** The only `navigator.onLine` read in the app is `src/components/DataExportPanel.jsx:12`. Offline read behavior is inherited entirely from the data layer, exactly as `PHASE_A_ARCHITECTURE.md` § 8 intends: `readThroughCache` (`src/lib/repository/offlineFirstRepository.js:18-33`) falls back to the Dexie cache and rethrows only when the cache is empty; `createRepository.useList` sets `networkMode: 'offlineFirst'` and re-flushes the outbox on the `online` event (`createRepository.js:32-48`); `regimenRepository`, `roundRepository`, `goalRepository`, `settingsRepository`, `weeklyReportRepository`, `bagHistoryRepository`, `catalogRepository`, `lostFoundRepository` each implement the same try-remote/fall-back-to-Dexie shape. **A page that does not mention `onLine` is therefore not automatically a gap.** What *is* a gap is the set of modules with no cache at all — `lib/discLocker.js`, `lib/history.js`, `lib/profile.js`, `lib/roundLog.js`, `repository/careerRepository.js`, `repository/discProfileRepository.js`, `repository/ghostPacingRepository.js`, `lib/gamification/trophyRoom.js` — every one of which throws straight into `S-ERR-BLOCK`. `fetchHistory` (`lib/history.js:40-42`) throws on any of its three queries, so `/practice/history`, `/practice/history/deleted`, `/practice/stats`, and `/practice/history/:type/:id` cannot render offline **at all** — which is where the `Saved on device` badges live. | § 8 stages the migration entity-family by entity-family and does not require full coverage yet. § 12's calm-state rule assumes the screen renders. | `contract-violation` for the eight uncached modules; `none` for the cached path | `offlineFirstRepository`, `createRepository`, per-entity repositories |
| `S-STALE` | Cached rows are served after a failed read | Implemented in the data layer and almost invisible in the UI. `readThroughCache` prunes rows absent from a *successful* remote result, so stale rows do not accumulate (`offlineFirstRepository.js:18-33`); the same prune exists in `regimenRepository.cacheList` and `roundRepository`. **Exactly one screen tells the user they are looking at cache**: `RoundsPage.jsx:58` — `{roundsQuery.error && <p className="form-error">Showing saved rounds from this device.</p>}` — and it says so in error red. Every other cached-fallback screen presents stale data as if it were live. | § 12 requires calm offline labelling. Stale-but-shown is precisely the case those labels exist for. | `contract-violation` | `readThroughCache` (data layer only) |
| `S-OFFLINE-WRITE` | A write with no network | Durable and correct in the mature paths. `writeThrough` queues to `db.outbox` **before** the remote attempt so a mid-request disconnect still leaves a replayable record (`offlineFirstRepository.js:40-45`); `flushOutbox` replays per entity and leaves failures queued (`:50-60`). `roundRepository`, `lostFoundRepository`, `discOdometerRepository`, `discPhotoRepository`, `historyRecoveryOutbox`, `activityOutbox` each own an outbox with a flush. The InstantLaunch putt outbox is separate and proven (§ 8). **One exception:** `fatigueCheckinRepository.record` (`src/lib/repository/fatigueCheckinRepository.js:5-10`) writes to Dexie, attempts the insert, and returns `{ sync_state: 'pending' }` on failure — **with no outbox entry and no flush anywhere in the repo**. Both call sites discard the return value (`RegimenRunPage.jsx:529`, `FreeformLogPage.jsx:402`). An offline fatigue check-in is stranded on-device forever and is never shown as pending. `listForParent` compounds it: it returns `data ?? local`, so a *successful* empty remote response (`[]`) hides the local rows entirely (`fatigueCheckinRepository.js:19`). | § 14: every mutation carries an idempotency key and queues dependent idempotent outbox operations. § 12: the write must be labelled `Saved on Device`. | `data-risk` for fatigue check-ins; `none` for the outbox-backed paths | `offlineFirstRepository.writeThrough` / `flushOutbox` |
| `S-SYNC` | Sync status shown to the user | **Six different vocabularies for one status** (was five; the sixth was added 2026-07-29 from `_corrections/state-citations-2.md` S-2 — it strengthens this row's `contract-violation` verdict rather than changing it). (1) `SessionReport.jsx:67-71` — `Saved on device` / `Needs attention` / `Synced`, no `Syncing`. (2) `HistoryPage.jsx:53-58` `SyncBadge` — `Saved on device` / `Needs attention`, and **returns `null` for `synced`**, so the badge and its layout space vanish. (3) `CanvasContextBar.jsx:12-27`, the *active capture* pill — `Synced` / `Pending` / `Syncing...` / `Retrying...` / `Sync failed`: five states, only two of which are contract words. (4) `LostFoundPage.jsx:109,132` and `DiscOdometerManager.jsx:58` — `Saved on this device. It will sync when connectivity returns.` (5) `RoundScorecardPage.jsx:137` — `Saved on this device; it will retry when you reconnect.` (6) `RoundSummaryPage.jsx:76` — `Round completed on this device; it will sync when you reconnect.`, rendered as `<p className="form-info">` at `:100`. That last one differs from (5) in three words, on the same screen family, through the same repository, and reserves no layout space. Underneath, `SYNC_STATUS` has five members (`src/lib/instantLaunch/syncScheduler.js:12-18`) against the contract's four labels; `activityRepository` emits a separate three-value `syncState` (`pending` / `synced` / `needs_attention`, `activityRepository.js:201,285,448`). Neither `.history-sync-badge` (`App.css:1141-1151`) nor `.canvas-sync-pill` (`App.css:3387-3395`) sets a `min-width`. | § 12, verbatim: four calm labels, **stable reserved layout space**. | `contract-violation` — labels, count, and layout stability all diverge | `SYNC_STATUS`, `SessionReport`, `CanvasContextBar` (three competing implementations) |
| `S-SYNC-ATTENTION` | A permanent failure needs a human | Modelled properly. `SYNC_STATUS.FAILED` is terminal and deliberately never auto-retried by `online`, `visibilitychange`, or `notifyOutboxChanged`; only the explicit `retry()` clears it (`syncScheduler.js:80-116`). Outbox rows carry a `poison` flag, and `produceSyncAttentionNotification` (`src/lib/notificationProducers.js:21-31`) raises a `CRITICAL` `sync` notification titled `Sync needs attention` with a `sync:poisoned-outbox` dedupe key. Surfaced at `HistoryPage.jsx:272-274` and `SessionReport.jsx:72-74`. | § 7 (badge only unresolved actionable/critical) and § 12 (`Needs Attention`). | `none` — the closest thing to a reference implementation in the app | `syncScheduler`, `notificationProducers`, `notificationRepository` |

### Records with a modified status

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-GHOST` | Hidden (soft-deleted) record | `.history-row-ghost` (`src/App.css:1128-1139`) supplies all four required signals: `opacity: 0.72`, a dashed `1px` outline, and a `::before` carrying `◌ Hidden` — icon *and* label. Applied at `HistoryPage.jsx:236` on the `/practice/history/deleted` route, alongside `Hidden activities remain restorable here for 30 days.` and a per-row `Restore`. Hiding is soft (`hidden_at`), confirmed, and reversible. **Caveat:** the icon and label are CSS `content:` on a pseudo-element, not DOM text, so they are not selectable and their announcement depends on the screen reader. | § 12: "opacity plus an icon, label, and outline; color or opacity alone is insufficient." § 11: 30-day Recently Deleted, restore triggers scoped recalculation. | `cosmetic` — the four signals are present; only their DOM-vs-CSS provenance is questionable | `.history-row-ghost` |
| `S-GHOST-SLOT` | Desired-but-unowned bag slot ("ghost slot") | **A different meaning of "ghost" — do not conflate with `S-GHOST`.** A capacity-neutral placeholder for a flight gap. `FlightSpectrum.jsx:64-73` plots them as dashed diamonds (`.flight-spectrum-ghost`, `App.css:1774-1779`) with a `<title>` reading `{label} — desired, capacity-neutral`, a legend entry (`:80`), and an `aria-label` on the SVG naming both counts (`:50`). `UniverseBrowser.jsx:39-43` renders `👻 Ghost slot: …` cards; `BagResonance.jsx:56` states `Ghost gaps are targets only and do not use capacity.` | Not a § 12 state. Documented here because the word collides with the contract's term and a screen document citing "ghost" without an id would be ambiguous. | `none` | `buildFlightSpectrum`, `buildBagResonance` |
| `S-INCOMPLETE` | Activity finalized as incomplete / needs review | Rendered as a badge: `.abandoned-badge` with the text `Incomplete` (`HistoryPage.jsx:76,90-92`, `SessionReport.jsx:62-66`). `produceActivityReviewNotifications` (`notificationProducers.js:5-19`) raises one `ACTIONABLE` `Review incomplete activity` notification per non-hidden incomplete activity, deduped on `activity-review:{id}`. `activities.needs_review` exists in the schema and in `fetchHistory`'s select list (`src/lib/history.js:20`) but **is never read by any component** — no screen renders it. | § 3: "Low-confidence or required missing fields lead the review." § 7: actionable items badge. | `contract-violation` — `needs_review` is captured, notified around, and never presented | `.abandoned-badge`, `notificationProducers` |

### Interlocks and destructive actions

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-INTERLOCK-CAP` | A capacity or ceiling is reached | Three caps, three qualities of enforcement. **35-disc bag cap:** `capacityTier()` (`src/lib/bags.js:70-78`) returns `ok`/`warn`/`full` with a 5-slot warning band; `BagPage.jsx:201-205` replaces the add control with a disabled `Bag full — remove a disc to add another`; `BagManagePage.jsx:234` disables the checkbox at `>= 35`. **Not enforced on `DiscDetailPage`** — `bag-row` calls `addDiscToBag` with no check (`screens/disc-detail.md` § 12 Q1). **100-putt routine ceiling:** `MAX_PUTTS = 100`, `MAX_STAGES = 20` (`src/lib/routineBuilder.js:17-18`); `RoutineBuilderPage.jsx:150-152` disables Add Stage with the reason `(100-putt max)` and reddens the counter past the cap (`:160`). But `saveDisabled` (`:100`) checks only `saving`, name, and stage count — **a routine edited past 100 putts can still be submitted**, falling through to the DB trigger, whose `23514` is mapped to `This routine exceeds the 100-putt ceiling.` (`src/lib/regimens.js:44-45`). Graceful, but the button lies about being enabled. **Situational-putter cap:** `SITUATIONAL_ROLE_CAP` throws from `discLocker.js:72-73` with no pre-emptive disable. **Scope note added 2026-07-29** (was `_corrections/state-citations-2.md` S-4): this row surveys the three caps named in `SCREEN_SPECS.md` standing divergence #6 — **it is not an inventory**, and its `cosmetic` verdict does not characterize interlocks generally. Six more ceilings exist, and three of them are worse than anything described here: one active goal per type on `goals` is **enforced server-side with zero app-side pre-emption**; hole count 1–36 and par 2–6 on `courses-new` are **silently corrected, never enforced** — no disable, no message, no constraint, so the user's input is mutated without being told; and `fld-score`'s `min=1 max=20` on `round-scorecard` is **advertised in the markup and enforced nowhere** (no `<form>`, no clamp, no `CHECK`), so out-of-range scores flow into `total_score`. The better-behaved three are `COMPARE_MAX`/`COMPARE_MIN` on `disc-compare` (pre-empted, enforced, and explained when it clamps — the best in the app), one open Lost & Found case per disc (pre-empted plus RPC plus partial unique index), and disc-creation quantity 1–10 on `disc-new`. `MAX_LEVEL = 50` on `trophy-room` is reached passively and relabels correctly. | § 12 does not cover interlocks; `TEMPLATE.md` § 5 requires the enforcing constraint be named in the enable/disable column. | `cosmetic` for the three surveyed — but see the scope note; `courses-new` and `round-scorecard` are worse | `bags.capacityTier`, `routineBuilder.canAddStage` |
| `S-INTERLOCK-ACTIVE` | A second activity is started while one is live | **The rule is fully built in the repository and never reaches a screen.** `planActivityStart` (`src/lib/activityLifecycle/reducer.js:148-173`) returns `kind: 'round_confirmation_required'` when the existing activity is a round; `activityRepository.start` (`activityRepository.js:330-396`) honours a `confirmRoundReplacement` flag, returns `warnings: ['round_replacement_confirmation_required']` when it is absent, and otherwise closes the previous activity as `incomplete` in the same transaction, returning `warnings: ['previous_activity_marked_incomplete']`. **A repo-wide grep for `confirmRoundReplacement`, `round_replacement_confirmation_required`, and `previous_activity_marked_incomplete` finds no hit in `src/pages/`, `src/components/`, or `src/hooks/`.** The only caller path is `mirrorInstantLaunchActivity` → `repository.start` (`src/lib/instantLaunch/activityBridge.js:111-127`), which propagates `outcome: 'confirmation_required'` up to `useInstantLaunchSession.mirrorActiveActivity` — where the return value is read **only** for `result.activity?.id` and the outcome is discarded (`src/hooks/useInstantLaunchSession.js:92-102`). The strings `Continue Round`, `Save Round as Incomplete`, and the auto-close toast do not exist anywhere in the source. Net effect: starting a practice during a live round shows no dialog, records no lifecycle start, and lets InstantLaunch capture proceed against an unmirrored activity. | § 11: "Starting while a round is active/paused requires confirmation with Continue Round, Save Round as Incomplete and Start, and Cancel actions." § 11: "Starting another practice atomically marks the previous practice incomplete … Offer Undo until the replacement records its first meaningful fact." § 9 names both as required E2E flows. | `data-risk` — the local lifecycle mirror and the capture buffer diverge silently | `planActivityStart` / `activityRepository.start` (both unreached from the UI) |
| `S-CONFIRM` | Destructive confirmation | Three `window.confirm()` calls, total: `BagManagePage.jsx:103` (`Delete {name}? This cannot be undone.`), `GoalsPage.jsx:38` (`{action} this goal? This status is final.`), `HistoryDetailPage.jsx:111` (`Hide this activity from History and statistics? You can restore it for 30 days.`). Native dialogs — not the `SheetHost` the shell owns, no focus management, no reduced-motion or 320px control, unstyled. Several genuinely destructive actions have **no** confirmation: disc retirement is an ordinary `status` select on `DiscDetailPage` (`screens/disc-detail.md` § 6), and photo delete relies on `restoreDiscPhoto` being available afterwards. | § 12: "One sheet is active at a time. Focus enters the sheet and returns to its trigger; the background is inert." and "Destructive actions do not sit beside scoring actions." A `window.confirm` satisfies none of the sheet clauses. | `contract-violation` | none — `SheetHost` exists and is not used for this |
| `S-CONFIRM-PHRASE` | Irreversible confirmation requiring typed intent | One instance, and it is correct: `DeleteAccountPanel.jsx` requires the literal phrase `DELETE`, is two-stage (`confirming` → typed phrase → `btn-danger`), purges local Dexie and `localStorage` only **after** the server RPC confirms, and hard-reloads to `/` so no provider retains the deleted user (`src/components/DeleteAccountPanel.jsx:5,25-45`). | § 4's privacy-purge intent; App Store 5.1.1(v). | `none` | `DeleteAccountPanel` |
| `S-UNDO` | A reversible action window | Capture-level undo exists and is good: `TapZone.jsx:39-40` (`↩ Undo`), `GestureZone.jsx:71-72` plus a left-swipe gesture with the button retained as the visible alternative, `applyRemovePendingPuttEvent` removes an unsynced event locally (`stateReducer.js:185`). Lifecycle-level undo does not: there is no Undo for the auto-close of a replaced practice, because the replacement itself never happens through the UI (`S-INTERLOCK-ACTIVE`). | § 4: "Immediate undo of unsynced active input may remove the local fact." § 11: "Offer Undo only until the replacement records its first meaningful fact." | `none` for capture; `contract-violation` for lifecycle, folded into `S-INTERLOCK-ACTIVE` | `sessionReducer` / `stateReducer` |

### Shell-level transient states

| id | State | Current behavior in the codebase | Required per contract | Gap | Shared implementation |
|---|---|---|---|---|---|
| `S-TOAST` | Transient shell-level feedback | **`ToastHost` is mounted with a hardcoded `toast={null}`** (`src/components/AppShell.jsx:123`), and `ToastHost` returns `null` for a falsy toast (`src/components/ToastHost.jsx:2`). No state ever flows into it; there is no toast context, queue, or setter anywhere. **No toast is ever displayed in this application.** Pages substitute local `notice` state rendered as inline paragraphs — `RoundScorecardPage.jsx:137,163` (`.form-info`), `LostFoundPage.jsx:109,132`, `DiscOdometerManager.jsx:58` — which are not transient, not announced from a shell-level live region, and scroll away with the page. | § 6: "`AppShell` owns … `ToastHost`". § 11: navigating away from active capture "pauses immediately and shows a local toast"; starting a new practice "auto-closes an existing practice as `incomplete` and shows a toast" (§ 1). Both toasts are specified and neither can fire. | `contract-violation` | `ToastHost` (inert) |
| `S-PAUSE` | Deliberate navigation away from active capture | The transition itself works: `useActivityNavigationLifecycle` detects an `active`→non-`active` shell change and calls `activityRepository.pause` with a `NAVIGATION_AWAY` reason and a version-keyed idempotency key (`src/hooks/useActivityNavigationLifecycle.js:41-52`); re-entering an `active` route resumes. Failures are swallowed (`:50`, `.catch(() => null)`). **The user is told nothing** — no toast (`S-TOAST`), no banner. The only surviving signal is the header activity pill (`GlobalHeader` via `AppShell.jsx:91-93`). The 60-second background auto-pause grace of § 11 has no `visibilitychange` implementation in `src/hooks/` at all. | § 11: "pauses immediately and shows a local toast"; "App backgrounding has a 60-second grace period before local pause; recovery explains why it paused." | `contract-violation` — the toast is impossible and the grace period is unbuilt | `useActivityNavigationLifecycle` |
| `S-RECOVERY` | Killed-and-relaunched app with live capture | Built and deliberate. `useCrashRecoveryRedirect` (`src/hooks/useCrashRecoveryRedirect.js`) reads the InstantLaunch buffer **once per app load** — not per navigation, so browsing History mid-session does not yank you back — and redirects to the correct capture route. `PracticeMenuPage.jsx:155-168` renders a resume hero: `▶️ Resume session in progress` for a crash buffer, `▶️ Resume active practice` with `Paused safely for later` / `In progress` for an active activity, per `heroCardState()`. `RegimenRunPage.jsx:210-216` recovers `regimenRunId` from the persisted buffer on a fresh mount. `activityBridge` reuses the client-generated parent UUID as the activity id so a crash between the Dexie and `localStorage` writes is retry-safe. **Missing:** § 11's "recovery explains why it paused" — no reason is surfaced anywhere. | § 11 (grace period + explained recovery); § 9 (killed-app recovery is a required real-device gate). | `cosmetic` — recovery works; the explanation does not exist | `useCrashRecoveryRedirect`, `heroCardState`, `activityBridge` |
| `S-UPDATE` | A new app version is waiting | Correct and thoughtfully scoped. `PwaUpdatePrompt` (`src/components/PwaUpdatePrompt.jsx`) replaced `autoUpdate`+`skipWaiting` precisely because `main` auto-deploys and a mid-routine reload would take the capture screen with it. The prompt requires an explicit tap and **hides entirely while an `active`-shell route is on screen** (`:42-43`), reappearing on an ordinary screen. `role="status"` is present. | Not a § 12 clause; it is a direct application of "a network failure never replaces active capture". | `none` | `PwaUpdatePrompt` |

---

## 3. Accessibility deltas that cut across every state

Recorded here rather than repeated in 33 screen documents. Baseline is
`PHASE_A_ARCHITECTURE.md` § 12.

| Finding | Evidence | Severity |
|---|---|---|
| Loading and error transitions are silent to assistive technology | Nine `aria-live` / `role="status"` attributes exist in the entire app (`RoundScorecardPage:158`, `DiscComparePage:156,176`, `BagLockerPage:160`, `PwaUpdatePrompt:46`, `DiscPhotoManager:128`, `GhostPaceCard:15`, `ClutchTimerPanel:37`, `ToastHost:5` — the last inert). **None of the 24 `S-LOAD` paragraphs and none of the 19 `S-ERR-BLOCK` paragraphs carry one.** | `contract-violation` |
| Sync labels do not reserve layout space | Neither `.history-sync-badge` (`App.css:1141`) nor `.canvas-sync-pill` (`App.css:3387`) sets `min-width`; `HistoryPage`'s `SyncBadge` returns `null` when synced, removing the element. Text width swings from `Synced` to `Retrying...` in the capture pill. | `contract-violation` (§ 12, verbatim) |
| `window.confirm` bypasses the sheet contract entirely | `S-CONFIRM`. No focus entry/return, no inert background, no 320px or 200%-scale control, no reduced-motion path. `SheetHost` is available and unused for this. | `contract-violation` |
| Ghost-record icon and label are CSS `content:`, not DOM text | `App.css:1134-1139`. Announcement depends on the screen reader; the text cannot be selected or translated. | `cosmetic` |
| Chip toggles do not expose pressed state | `screens/disc-detail.md` § 8 records this for `bag-row`/`tag-chip`; the same is true of `ChipGroup` consumers generally. `FlightSpectrum.jsx:39,41` is the one place `aria-pressed` is used correctly. | `cosmetic` |

---

## 4. Per-screen conformance

### Method — read this before trusting a cell

Reading 32 page components line by line was not attempted. What was done instead:

1. **Complete mechanical extraction, not sampling, for four states.** Every top-level early return and
   every empty-branch conditional in all 32 pages was extracted by pattern (`if (loading`, `if (error`,
   `if (!x) return`, `className="loading"`, `className="form-error"`, `length === 0`, `.empty-state`).
   `S-LOAD`, `S-EMPTY`, `S-ERR-BLOCK`, and `S-ERR-INLINE` cells are derived from that extraction and are
   as reliable as a full read for those states. `S-RETRY` likewise, from an exhaustive identifier grep.
2. **Import-graph classification for `S-OFFLINE-READ`.** Every page's `src/lib/*` imports were listed,
   and each module was opened and classified as cache-backed or network-only. Cells state which the page
   inherits. This is verified, not inferred.
3. **Full reads** of `AppShell`, `ProtectedRoute`, `AuthContext`, `App.jsx`, `routeMetadata.js`,
   `offlineFirstRepository`, `createRepository`, `regimenRepository`, `goalRepository`,
   `settingsRepository`, `careerRepository`, `fatigueCheckinRepository`, `syncScheduler`,
   `activityBridge`, `useOnboardingGate`, `useActiveActivity`, `useActivityNavigationLifecycle`,
   `useCrashRecoveryRedirect`, `useNotifications`, `useHistoryRecovery`, `NotificationSheet`,
   `CanvasContextBar`, `ToastHost`, `PwaUpdatePrompt`, `DeleteAccountPanel`, `EditableSection`,
   `FlightSpectrum`, `HistoryPage`, `CareerHubPage`, `WeeklyReportsPage`, `RegimenSelectPage`,
   `SplashPage`, `OnboardingPage`, `NotificationsPage`, and the load/error/save regions of
   `RegimenRunPage`, `FreeformLogPage`, `RoundScorecardPage`, `RoutineBuilderPage`, `PracticeMenuPage`.
4. **`screens/disc-detail.md`** was used as verified prior work for `disc-detail`, cross-checked against
   the code at the lines it cites.
5. Anything not established by 1–4 is marked `?` and is **unverified, not absent**.

### Legend

| Mark | Meaning |
|---|---|
| ✅ | Implemented, consistent with the row |
| ⚠️ | Present but diverges from the row (see the row's Gap column) |
| ❌ | Absent where the row says it should exist |
| ➖ | Not applicable to this screen |
| ? | **Unverified** — not established by the method above; do not treat as either present or absent |

### PLAY

| Route id | Component | `S-LOAD` | `S-EMPTY` | `S-ERR-BLOCK` | `S-ERR-INLINE` | `S-RETRY` | `S-OFFLINE-READ` | `S-SYNC` | `S-INTERLOCK` | `S-CONFIRM` |
|---|---|---|---|---|---|---|---|---|---|---|
| `play-root` | `PracticeMenuPage` | ✅ `:217,258` | ✅ `:221,259` | ⚠️ `:137` | ❌ | ❌ | ⚠️ `regimenRepository` cached; `lib/history` not | ➖ | ⚠️ `Quick Play unavailable` `:198` | ➖ |
| `freeform-active` | `FreeformLogPage` | ✅ `:638` inline | ✅ `:640` | ✅ none — inline only `:491` | ✅ `:491` | ❌ | ⚠️ direct `supabase.from` `:249,268` | ⚠️ `CanvasContextBar` `:532` | ➖ | ➖ |
| `regimen-select` | `RegimenSelectPage` | ✅ `:54` inline | ❌ no empty branch | ✅ none — inline only `:55` | ✅ `:55` | ❌ | ✅ `regimenRepository` cached | ➖ | ➖ | ➖ |
| `routine-builder` | `RoutineBuilderPage` | ➖ form | ➖ | ✅ none — inline only `:111` | ✅ `:111` | ❌ | ❌ `lib/regimens` network-only | ➖ | ⚠️ add-stage disabled `:150`; **save not** `:100` | ➖ |
| `regimen-active` | `RegimenRunPage` | ✅ `:319` | ➖ no collection to report empty | ⚠️ `:320` — **active shell** | ❌ | ❌ | ⚠️ `regimenRepository` cached; `ghostPacing` not | ⚠️ `CanvasContextBar` `:728` | ➖ | ➖ |
| `practice-history` | `HistoryPage` | ✅ `:179` | ⚠️ `:226` — filter case misreported | ⚠️ `:178` | ❌ | ⚠️ sync-only `:273` | ❌ `fetchHistory` throws | ⚠️ `SyncBadge` `:53-58` | ➖ | ➖ |
| `practice-history-deleted` | `HistoryPage deleted` | ✅ `:179` | ✅ `:226` | ⚠️ `:178` | ❌ | ⚠️ sync-only `:273` | ❌ `fetchHistory` throws | ⚠️ `SyncBadge` | ➖ | ➖ (restore is non-destructive) |
| `practice-history-detail` | `HistoryDetailPage` | ✅ `:121` | ➖ detail | ⚠️ `:120` | ❌ | ⚠️ sync-only `:184` | ❌ `fetchHistory` throws | ✅ `SessionReport` `:67-71` | ➖ | ⚠️ `window.confirm` `:111` |
| `practice-stats` | `ConfidenceMapPage` | ✅ `:35` | ✅ `:53-54` | ⚠️ `:34` | ❌ | ❌ | ❌ `fetchHistory` throws | ➖ | ➖ | ➖ |
| `notifications` | `NotificationsPage` | ❌ none — `[]` renders as empty | ⚠️ `NotificationSheet:13` — indistinguishable from loading and from error | ✅ none | ❌ errors swallowed `useNotifications:29,31` | ❌ | ✅ `notificationRepository` Dexie-primary | ➖ | ➖ | ➖ |

### DISCS

| Route id | Component | `S-LOAD` | `S-EMPTY` | `S-ERR-BLOCK` | `S-ERR-INLINE` | `S-RETRY` | `S-OFFLINE-READ` | `S-SYNC` | `S-INTERLOCK` | `S-CONFIRM` |
|---|---|---|---|---|---|---|---|---|---|---|
| `discs-root` | `BagPage` | ✅ `:85,220` | ✅ `:222` | ⚠️ `:84` — no `&& !data` guard | ✅ `:215` | ❌ | ❌ `lib/discLocker` network-only | ➖ | ✅ `capacityTier` `:162,201-205` | ➖ |
| `disc-collection` | `BagLockerPage` | ✅ `:129` | ✅ `:248` | ⚠️ `:128` — guarded by `&& !discs` | ✅ `:157` | ❌ | ✅ `useDiscList` cached | ➖ | ➖ | ➖ |
| `bag-manage` | `BagManagePage` | ✅ `:181` | ⚠️ `:228` uses `.loading` class | ⚠️ `:180` — guarded | ✅ `:192` | ❌ | ⚠️ `bagHistoryRepository` cached; `discLocker` not | ➖ | ✅ `:234` disabled at 35 | ⚠️ `window.confirm` `:103` |
| `disc-compare` | `DiscComparePage` | ✅ `:106,233` | ✅ `:214,310` | ⚠️ `:105` — guarded | ✅ `:157,235` — **best copy in the app** | ❌ | ⚠️ `useDiscList` cached; `discLocker` not | ➖ | ➖ | ➖ |
| `lost-found` | `LostFoundPage` | ❌ none at all — `:194` doubles as the loading state | ✅ `:194` (double duty, see `S-LOAD`) | ✅ none — inline only `:174` | ✅ `:174` | ❌ | ✅ `lostFoundRepository` cached + outbox | ⚠️ `:109,132` 4th vocabulary | ➖ | ➖ |
| `disc-new` | `DiscFormPage` | ➖ form | ➖ | ✅ none — inline only `:205` | ✅ `:205` | ❌ | ⚠️ `catalogRepository` cached; `discLocker` not | ➖ | ➖ | ➖ |
| `disc-detail` | `DiscDetailPage` | ✅ `:100` | ✅ `:344` | ⚠️ `:99` — guarded | ✅ `:115` | ❌ (`disc-detail.md` T-1) | ❌ `discLocker`/`discProfileRepository` network-only | ⚠️ `DiscOdometerManager:58` | ❌ bag cap unenforced (`disc-detail.md` Q1) | ❌ retire has none |

### COURSES

| Route id | Component | `S-LOAD` | `S-EMPTY` | `S-ERR-BLOCK` | `S-ERR-INLINE` | `S-RETRY` | `S-OFFLINE-READ` | `S-SYNC` | `S-INTERLOCK` | `S-CONFIRM` |
|---|---|---|---|---|---|---|---|---|---|---|
| `courses-root` | `CoursesPage` | ✅ `:25` | ✅ `:46,78` `.empty-state` | ⚠️ `:24` — guarded | ✅ `:38` | ❌ | ⚠️ `roundRepository` cached; `roundLog` not | ➖ | ➖ | ➖ |
| `courses-new` | `CourseFormPage` | ➖ form | ➖ | ✅ none — inline only `:47` | ✅ `:47` | ❌ | ❌ `lib/roundLog` network-only | ➖ | ➖ | ➖ |
| `course-detail` | `CourseDetailPage` | ✅ `:28` | ✅ `:49` `.empty-state` | ⚠️ `:27` | ❌ | ❌ | ❌ `lib/roundLog` network-only | ➖ | ➖ | ➖ |
| `rounds-root` | `RoundsPage` | ✅ `:44` | ✅ `:61` `.empty-state` | ⚠️ `:45` — guarded | ✅ `:58` | ❌ | ✅ `roundRepository` cached | ⚠️ `:58` — **the only stale-cache notice, in error red** | ➖ | ➖ |
| `round-start` | `RoundStartPage` | ✅ `:118` | ✅ `:131` `.empty-state` | ✅ none — inline only `:129` | ✅ `:129` | ❌ | ⚠️ `roundRepository` cached; `roundLog`/`discLocker` not | ➖ | ➖ | ➖ |
| `round-scorecard` | `RoundScorecardPage` | ✅ `:143`, `:159` announced | ➖ | ⚠️ `:144` | ✅ `:163,181` — **reference pattern** | ❌ | ✅ `loadRound` cached `roundRepository:200-207` | ⚠️ `:137` 5th vocabulary | ➖ | ➖ |
| `round-summary` | `RoundSummaryPage` | ✅ `:85` | ➖ | ⚠️ `:86` | ❌ | ❌ | ✅ `roundRepository` cached | ⚠️ `:76` **6th vocabulary** | ➖ | ➖ |

### ME

| Route id | Component | `S-LOAD` | `S-EMPTY` | `S-ERR-BLOCK` | `S-ERR-INLINE` | `S-RETRY` | `S-OFFLINE-READ` | `S-SYNC` | `S-INTERLOCK` | `S-CONFIRM` |
|---|---|---|---|---|---|---|---|---|---|---|
| `me-root` | `CareerHubPage` | ✅ `:21` | ✅ `S-INSUFFICIENT` `:50,52` | ⚠️ `:20` | ❌ | ❌ | ❌ `careerRepository` has **no cache** — the ME landing screen cannot render offline | ➖ | ➖ | ➖ |
| `profile-details` | `ProfilePage` | ✅ `:34` | ✅ `:145` `—` | ⚠️ `:33` | ✅ `EditableSection:51` | ❌ | ❌ `lib/profile` network-only | ➖ | ➖ | ➖ |
| `settings` | `SettingsPage` | ✅ `:40` | ➖ | ⚠️ `:39` | ❌ | ❌ | ⚠️ `settingsRepository` cached; `lib/profile` not | ➖ | ➖ | ✅ `DeleteAccountPanel` `S-CONFIRM-PHRASE` |
| `goals` | `GoalsPage` | ✅ `:44` | ✅ `:61` | ✅ none — inline only `:49` | ✅ `:49` | ❌ | ✅ `goalRepository` cached | ➖ | ➖ | ⚠️ `window.confirm` `:38` |
| `weekly-reports` | `WeeklyReportsPage` | ✅ `:61` | ✅ `:68`, `:29` per-report | ✅ none — inline only `:67` | ✅ `:67` | ⚠️ regenerate, not retry | ✅ `weeklyReportRepository` cached | ➖ | ➖ | ➖ |
| `trophy-room` | `TrophyRoomPage` | ✅ `:58` | ✅ `TrophyWall:36`, `XpLedgerModal:34` | ⚠️ `:57` | ❌ | ❌ | ❌ `gamification/trophyRoom` network-only | ➖ | ➖ | ➖ |

### Pre-shell

| Route id | Component | `S-LOAD` | `S-EMPTY` | `S-ERR-BLOCK` | `S-ERR-INLINE` | `S-RETRY` | `S-OFFLINE-READ` | `S-SYNC` | `S-INTERLOCK` | `S-CONFIRM` |
|---|---|---|---|---|---|---|---|---|---|---|
| `root` | `SplashPage` | ❌ `App.jsx:49` renders `null` | ➖ | ➖ | ❌ guest failure silently redirects `:15-17` | ➖ | ➖ static | ➖ | ➖ | ➖ |
| `login` | `AuthPage` | ✅ `submitting` `:172,207` | ➖ | ✅ none — inline only `:169,196` | ✅ `:169,196` | ❌ | ➖ requires network | ➖ | ➖ | ➖ |
| `onboarding` | `OnboardingPage` | ➖ wizard shell | ➖ | ✅ none | ✅ every step that makes a call | ❌ | ⚠️ `PutterStep` cached `catalogRepository`; ➖ `GoalStep`/`CalibrationStep` read nothing | ➖ | ➖ | ➖ |

### Counts

| | Count |
|---|---:|
| Routes | 33 |
| `S-LOAD` implemented | 24 of 32 components |
| `S-EMPTY` implemented | 18 of 32 components |
| `S-ERR-BLOCK` (whole-screen bare error) | **19** of 32 components |
| `S-RETRY` for a failed read | **0** of 32 components |
| Pages reading `navigator.onLine` | **0** (`DataExportPanel` is the app's only reader) |
| Distinct offline/sync copy vocabularies | **6** |
| Toasts displayable | **0** |

---

## 5. Gaps worth fixing, ranked

Ranked by user-visible risk, then by breadth. Each is a candidate task; none is written as one here —
`TASK_FORMAT.md` owns that shape and screen documents own per-screen task ids.

### 1 — `S-INTERLOCK-ACTIVE`: the single-active interlock never reaches the UI · `data-risk`

The confirmation flow, the atomic auto-close, and the replacement warnings are all implemented and
unit-tested in `src/lib/activityLifecycle/reducer.js:148-173` and
`src/lib/repository/activityRepository.js:330-396`. Nothing in `src/pages/`, `src/components/`, or
`src/hooks/` references `confirmRoundReplacement` or either warning string. The one path that could
propagate it — `useInstantLaunchSession.mirrorActiveActivity` (`src/hooks/useInstantLaunchSession.js:92-102`)
— reads only `result.activity?.id` and discards `outcome: 'confirmation_required'`. A user who starts a
practice during a live round gets no dialog, no lifecycle start, and a capture buffer that no longer
corresponds to any mirrored activity.

**Screens affected:** `play-root`, `freeform-active`, `regimen-active`, `round-scorecard`,
`practice-history`, and **`round-start`** — added 2026-07-29 (was `_corrections/state-citations-2.md`
S-5). `round-start` is where a round is started, so § 11's "starting while a round is active/paused
requires confirmation" applies to it by any reading. **Its mechanism differs, and that matters for the
fix:** on the other screens the repository *offers* the confirmation and the UI drops it. Here the
repository never reaches for it — `roundRepository.ensureRoundActivity`
(`src/lib/repository/roundRepository.js:145-158`) calls `activityRepository.getActive(userId)` **first**
and invokes `activityRepository.start` only when nothing is active, so `planActivityStart`'s
`round_confirmation_required` and the `confirmRoundReplacement` flag are never evaluated and the round's
lifecycle parent is deliberately left a `draft` (the code says so at `:141-144`: "J1 keeps that decision
out of the round form"). Same user-visible outcome; the repair on `round-start` is to make the call at
all, not to consume a discarded outcome. **Contract:** § 11 (both bullets), § 1, § 9 (two required E2E
flows).

### 2 — `S-RETRY`: no screen can recover from a failed read without a browser reload · `contract-violation`

Zero read-retry affordances across 32 page components. Combined with `S-ERR-BLOCK`, a single transient
Supabase failure on 19 of 32 screens produces a dead end whose only exit is the browser's reload button
— on a phone, in a PWA with no chrome, at a course with intermittent signal. `screens/disc-detail.md`
already carries this as `T-disc-detail-1`; it needs to be a shared control, not 19 copies.

**Screens affected:** the 19 `S-ERR-BLOCK` pages. **Contract:** § 9's offline reload/recovery flow.

### 3 — `S-OFFLINE-READ`: eight modules have no cache, and one of them is History · `contract-violation`

`lib/history.js:40-42` throws on any of its three Supabase queries before the Dexie hydration in its
`try` block is ever reached — so `/practice/history`, `/practice/history/deleted`, `/practice/stats`,
and `/practice/history/:type/:id` render a bare error string offline. That is the surface where the
`Saved on device` badges live: the user is least able to see their unsynced work exactly when they most
need to. `careerRepository` has the same shape and takes the entire ME landing screen down with it
(`src/lib/repository/careerRepository.js:12`). Also uncached: `lib/discLocker`, `lib/profile`,
`lib/roundLog`, `discProfileRepository`, `ghostPacingRepository`, `gamification/trophyRoom`.

**Screens affected:** `practice-history`, `practice-history-deleted`, `practice-history-detail`,
`practice-stats`, `me-root`, `profile-details`, `discs-root`, `disc-detail`, `courses-new`,
`course-detail`, `trophy-room`. **Contract:** § 8, § 12.

### 4 — `S-OFFLINE-WRITE`: fatigue check-ins captured offline are stranded permanently · `data-risk`

`fatigueCheckinRepository.record` (`src/lib/repository/fatigueCheckinRepository.js:5-10`) is the one
write path in the repository layer with no outbox and no flush. It returns `{ sync_state: 'pending' }`,
which both call sites discard (`RegimenRunPage.jsx:529`, `FreeformLogPage.jsx:402`). Nothing ever
retries the row and nothing ever tells the user. `listForParent` makes it worse: `data ?? local` at
`:19` means a successful empty remote response hides the local rows outright.

**Screens affected:** `freeform-active`, `regimen-active`. **Contract:** § 14, § 12.

### 5 — `S-SYNC`: five vocabularies, four contract labels, no reserved space · `contract-violation`

`SessionReport` (`:67-71`), `HistoryPage.SyncBadge` (`:53-58`), `CanvasContextBar` (`:12-27`),
`LostFoundPage`/`DiscOdometerManager`, and `RoundScorecardPage` each invent their own wording.
`CanvasContextBar` — the one the user stares at during capture — says `Pending`, `Retrying...`, and
`Sync failed`, none of which is a contract word. `SyncBadge` returns `null` when synced, so the row
reflows. Neither badge class sets `min-width`. § 12 names four labels and requires stable layout space,
verbatim.

**Screens affected:** every screen that shows sync state — `freeform-active`, `regimen-active`,
`practice-history`, `practice-history-deleted`, `practice-history-detail`, `round-scorecard`,
`lost-found`, `disc-detail`. **Contract:** § 12:194-195.

### 6 — `S-TOAST`: the shell's toast host is inert, so two specified behaviors cannot fire · `contract-violation`

`AppShell.jsx:123` passes `toast={null}` unconditionally; no toast context, queue, or setter exists.
§ 6 lists `ToastHost` as shell-owned, and § 11 specifies a toast on navigation-away pause and on
practice auto-close. Neither can happen. Pages have substituted local `notice` paragraphs that are not
transient, not announced from a shell live region, and scroll away with the page. Note that
`_corrections/component-library.md` records the inert `ToastHost` as a non-error caveat against § 6's
ownership claim — correct as to ownership, but the § 11 behavioral requirement is unmet, which is why
it is filed as C-1 here.

**Screens affected:** all shell routes. **Contract:** § 6:86, § 11:159-161, § 1:26-27.

### 7 — `S-LOAD` / `S-ERR-BLOCK` are silent to assistive technology · `contract-violation`

None of the 24 loading paragraphs and none of the 19 error paragraphs carry `aria-live`, `role="status"`,
or `aria-busy`. A screen-reader user gets no announcement when a page finishes loading or when it
collapses into an error. § 12 requires "screen-reader action consequences". The fix is one shared
component with the live region baked in, which also resolves the `Loading...` / `Loading…` copy drift.

**Screens affected:** 24 and 19 respectively. **Contract:** § 12:189-190.

### 8 — `S-CONFIRM`: destructive confirmation uses `window.confirm`, bypassing the sheet contract · `contract-violation`

Three native dialogs (`BagManagePage:103`, `GoalsPage:38`, `HistoryDetailPage:111`) satisfy none of
§ 12's sheet clauses — no focus entry or return, no inert background, no reduced-motion or 320px
handling, no styling. `SheetHost` exists, is shell-owned, and is used for notifications only. Separately,
disc retirement (`DiscDetailPage`) has no confirmation at all.

**Screens affected:** `bag-manage`, `goals`, `practice-history-detail`, `disc-detail`.
**Contract:** § 12:186-188.

### 9 — `S-STALE`: cached data is presented as live on every screen but one · `contract-violation`

`readThroughCache` silently substitutes cached rows on a failed read. `RoundsPage.jsx:58` is the only
screen that says so — and it says so in `.form-error` red, which reads as a failure rather than as the
calm `Saved on Device` family the contract asks for. Every other cached-fallback screen shows stale data
indistinguishably from fresh.

**Screens affected:** every page consuming a cache-backed repository — `disc-collection`, `disc-compare`,
`bag-manage`, `courses-root`, `rounds-root`, `round-start`, `round-scorecard`, `round-summary`,
`regimen-select`, `regimen-active`, `goals`, `weekly-reports`, `lost-found`, `disc-new`, `settings`.
**Contract:** § 12:194.

### 10 — `S-INCOMPLETE`: `needs_review` is captured, notified around, and never rendered · `contract-violation`

The column exists, `fetchHistory` selects it (`src/lib/history.js:20`), and § 3 makes it the thing that
"leads the review". No component reads it. `Incomplete` is shown; "needs review" is not.

**Screens affected:** `practice-history`, `practice-history-detail`, `round-summary`.
**Contract:** § 3:42-45.

### 11 — `S-EMPTY-FILTER`: filtered-to-empty is reported as having no data · `cosmetic`

`HistoryPage.jsx:225-226` tells a user with a year of sessions `No sessions yet.` because a chip filter
excluded everything. Same shape in `BagLockerPage:248` and `TrophyWall:35`.

**Screens affected:** `practice-history`, `disc-collection`, `trophy-room`. **Contract:** none — this is
a correctness-of-copy issue, not a contract breach.

### 12 — `S-INTERLOCK-CAP`: two caps are enforced only after submission · `cosmetic`

`RoutineBuilderPage.jsx:100` omits the putt total from `saveDisabled`, so an over-cap routine submits
and is rejected by the DB trigger. `SITUATIONAL_ROLE_CAP` throws from `discLocker.js:72` with no
pre-emptive disable. Bag capacity is unenforced on `disc-detail` (already open as `disc-detail.md` Q1).

**Screens affected:** `routine-builder`, `discs-root`, `disc-detail`. **Contract:** `TEMPLATE.md` § 5.

---

## 6. Open questions

1. **Does § 11's `Saved on this device · Sync pending` supersede or contradict § 12's four labels?**
   Blocks any consolidation of `S-SYNC`. Filed as C-2 in `_corrections/state-matrix.md`.
2. **Should `S-ERR-BLOCK` become a shared component, or should every page adopt `S-ERR-INLINE`?**
   `RoundScorecardPage.jsx:181` and `DiscComparePage.jsx:235` prove the inline pattern works. Blocks
   gap 2 and gap 7, which want the same shared component.
3. **Where should `S-INTERLOCK-ACTIVE`'s confirmation live?** The repository is ready. The dialog has no
   home: `SheetHost` is shell-level and the decision is made from a page. Blocks gap 1.
4. **Does `S-GHOST`'s CSS-`content:` icon and label satisfy § 12?** The contract says "icon, label, and
   outline"; it does not say they must be DOM text. Blocks whether the `.history-row-ghost` row is
   `none` or `contract-violation`.
5. **Is `S-GUEST` supposed to be visible outside `AuthPage`?** `SplashPage.jsx:49` promises "save
   progress later" and nothing ever follows up. No contract section covers it.

---

## 7. Corrections filed

`docs/ui/_corrections/state-matrix.md` — three entries (C-1 inert `ToastHost` against § 6/§ 11, C-2 the
§ 11 versus § 12 label contradiction, C-3 the unreached round-replacement confirmation against § 11/§ 9),
plus a methodology note correcting the "5 pages reference offline/onLine" figure that this document was
briefed with.
