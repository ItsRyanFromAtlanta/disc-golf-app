# Corrections log — state matrix

Contradictions found while authoring `docs/ui/STATE_MATRIX.md`, verified against `7351964` on branch
`claude/ui-documents-status-3fphcw` (2026-07-29).

Per `docs/ui/README.md` § `_corrections/` and `TEMPLATE.md` rule 5, these are **recorded, not fixed** —
no file outside `docs/ui/` was edited. Each entry cites the doc line and the code evidence.

Two of the three touch `PHASE_A_ARCHITECTURE.md`, which is a contract document. Unlike the drift entries
in `component-library.md` and `screen-specs-and-agents.md`, a contract that the code does not satisfy is
not necessarily a doc bug — it may be a code bug. Each entry states which reading it proposes.

---

## C-1 — `ToastHost` is shell-owned but permanently inert, so two § 11 behaviors cannot fire

**Where:** `PHASE_A_ARCHITECTURE.md:86`, `:159-160`, and `:26-27`

**Doc claims:**

> `AppShell` owns `GlobalHeader`, `ScreenScrollRegion`, `SheetHost`, `ToastHost`, and `TabBar`.
> — `PHASE_A_ARCHITECTURE.md:86`

> Deliberate navigation away from active capture pauses immediately and shows a local toast.
> — `PHASE_A_ARCHITECTURE.md:159-160`

> Starting a new activity auto-closes an existing practice as `incomplete` and shows a toast.
> — `PHASE_A_ARCHITECTURE.md:26-27`

**Code evidence:**

- `src/components/AppShell.jsx:123` — `<ToastHost toast={null} />`. The prop is a literal `null`, not
  state; there is no `useState`, context, queue, or setter feeding it anywhere in the file.
- `src/components/ToastHost.jsx:2` — `if (!toast) return null`. The component renders nothing for a
  falsy toast, so nothing is ever displayed.
- A repo-wide search for a toast setter (`setToast`, `showToast`, `ToastContext`, `useToast`) returns no
  definition. `ToastHost` has exactly one importer, `AppShell.jsx:8`.
- `src/hooks/useActivityNavigationLifecycle.js:41-52` performs the navigation-away pause the § 11 bullet
  describes, and shows the user nothing. Failures are swallowed at `:50` (`.catch(() => null)`).
- Pages have substituted local state: `src/pages/RoundScorecardPage.jsx:137,163`,
  `src/pages/LostFoundPage.jsx:109,132`, `src/components/DiscOdometerManager.jsx:58`. These are inline
  paragraphs — not transient, not announced from a shell-level live region, and they scroll away with
  the page.

**Relationship to an existing entry:** `_corrections/component-library.md` § "Checked and found
accurate" already records the inert `ToastHost` as a *caveat* against `PHASE_A_ARCHITECTURE.md:86`, on
the correct grounds that the ownership claim itself is true — `AppShell` does render it. This entry does
not dispute that. It records the separate and stronger fact that the § 11 and § 1 **behavioral**
requirements which depend on that host are unimplementable in the current code.

**Severity:** high. `PHASE_A_ARCHITECTURE.md:249-252` lists the shared shell among the *Required* Phase A
items and § 16 records only two items as having closed unmet (browser E2E and the real-device gate,
`:253-254`).
Toast-dependent lifecycle feedback is a third, and is not recorded as outstanding anywhere.

**Proposed resolution (not applied):** treat this as a **code** gap, not a doc gap. Wire toast state
through `AppShell` and emit from `useActivityNavigationLifecycle` and the practice-replacement path. If
toasts are instead being deliberately deferred, add a third bullet to `PHASE_A_ARCHITECTURE.md:253-254`
recording it alongside E2E and the device gate, so § 16 stops implying the shell shipped complete.

---

## C-2 — § 11 specifies a fifth offline label that § 12's four-label list does not contain

**Where:** `PHASE_A_ARCHITECTURE.md:168` against `PHASE_A_ARCHITECTURE.md:194-195`

**Doc claims, in the same file:**

> Finalization succeeds locally while offline and reports `Saved on this device · Sync pending`.
> — `PHASE_A_ARCHITECTURE.md:168`

> Offline/sync labels reserve stable layout space and use calm states: Saved on Device, Syncing, Synced,
> and Needs Attention. — `PHASE_A_ARCHITECTURE.md:194-195`

`Saved on this device · Sync pending` is neither of the two states it could map to. It is longer than
`Saved on Device`, it merges two of the four states into one string, and § 12 says "calm states:" and
then enumerates exactly four.

**Code evidence — the ambiguity has already produced five vocabularies:**

| Implementation | Strings |
|---|---|
| `src/components/sessionReport/SessionReport.jsx:67-71` | `Saved on device` · `Needs attention` · `Synced` |
| `src/pages/HistoryPage.jsx:53-58` | `Saved on device` · `Needs attention`; **`null` when synced** |
| `src/components/puttingCanvas/CanvasContextBar.jsx:12-27` | `Synced` · `Pending` · `Syncing...` · `Retrying...` · `Sync failed` |
| `src/pages/LostFoundPage.jsx:109,132`, `src/components/DiscOdometerManager.jsx:58` | `Saved on this device. It will sync when connectivity returns.` |
| `src/pages/RoundScorecardPage.jsx:137` | `Saved on this device; it will retry when you reconnect.` |

Underneath, the enums do not agree either: `SYNC_STATUS` has five members
(`src/lib/instantLaunch/syncScheduler.js:12-18` — `synced`, `pending`, `syncing`, `error-retrying`,
`failed`) while `activityRepository` emits three (`src/lib/repository/activityRepository.js:201,285,448`
— `pending`, `synced`, `needs_attention`). Neither is the contract's four.

`CanvasContextBar` is the instance that matters most: it is the pill an athlete watches during live
capture, and only two of its five strings are contract words.

**Severity:** high. This is the largest presentation divergence in the app and it cannot be fixed
without first resolving which of the two contract lines wins.

**Proposed resolution (not applied):** amend `PHASE_A_ARCHITECTURE.md:168` to cite § 12 rather than
introduce a sixth string — e.g. "Finalization succeeds locally while offline and shows the § 12
`Saved on Device` state." Then map the two enums onto the four labels in one place
(`error-retrying` → `Syncing`, `failed`/`poison` → `Needs Attention`, `pending` → `Saved on Device`) and
give both badge classes a `min-width` so § 12's "reserve stable layout space" is actually satisfied
(`src/App.css:1141`, `:3387` — neither sets one today).

---

## C-3 — the round-replacement confirmation is fully built and never reachable from the UI

**Where:** `PHASE_A_ARCHITECTURE.md:163-164`, `:26-27`, and `:122-123`

**Doc claims:**

> Starting while a round is active/paused requires confirmation with Continue Round, Save Round as
> Incomplete and Start, and Cancel actions. — `PHASE_A_ARCHITECTURE.md:163-164`

> Starting another practice atomically marks the previous practice incomplete and starts the new one.
> Offer Undo only until the replacement records its first meaningful fact.
> — `PHASE_A_ARCHITECTURE.md:161-162`

§ 9 lists "single-active auto-close; round-close confirmation" among the required E2E flows
(`PHASE_A_ARCHITECTURE.md:122-123`), and § 16 lists the local lifecycle engine among *Required* Phase A
items without noting this as outstanding.

**Code evidence — the logic exists:**

- `src/lib/activityLifecycle/reducer.js:148-173` — `planActivityStart` returns
  `{ kind: 'round_confirmation_required', closeExistingOnConfirm: true, requiresConfirmation: true }`
  when the existing current activity is a round.
- `src/lib/repository/activityRepository.js:330-396` — `start(activityId, mutation, { confirmRoundReplacement })`
  returns `warnings: ['round_replacement_confirmation_required']` when the flag is absent (`:348-356`),
  and otherwise closes the previous activity as `incomplete` inside the same transaction, returning
  `warnings: ['previous_activity_marked_incomplete']` (`:371-395`).
- Both paths are unit-tested (`src/lib/repository/activityRepository.test.js`,
  `src/lib/activityLifecycle/activityLifecycle.test.js`).

**Code evidence — nothing consumes it:**

- A repo-wide search for `confirmRoundReplacement`, `round_replacement_confirmation_required`, and
  `previous_activity_marked_incomplete` returns **zero hits** in `src/pages/`, `src/components/`, or
  `src/hooks/`.
- The strings `Continue Round` and `Save Round as Incomplete` do not exist anywhere in `src/`.
- The one path that could surface it is `src/lib/instantLaunch/activityBridge.js:111-127`, which calls
  `repository.start` and correctly propagates `outcome: 'confirmation_required'` to its caller. Its
  caller, `src/hooks/useInstantLaunchSession.js:92-102`, reads the result **only** for
  `result.activity?.id` and discards `outcome` entirely. No branch inspects it.

**Consequence:** starting a practice while a round is active or paused shows no dialog, records no
lifecycle start for the new activity, and lets InstantLaunch capture proceed against an activity that
was never mirrored. The local lifecycle mirror and the capture buffer diverge silently — a data-risk
outcome the § 14 transaction contract exists to prevent.

**Severity:** high. This is the top-ranked gap in `STATE_MATRIX.md` § 5.

**Proposed resolution (not applied):** treat as a **code** gap. Handle `outcome === 'confirmation_required'`
in `useInstantLaunchSession.mirrorActiveActivity` and present the three named actions. Until that ships,
`PHASE_A_ARCHITECTURE.md:253-254` should record it beside browser E2E and the real-device gate, since
§ 16 currently reads as though only two Required items closed unmet.

---

## Methodology note — the "5 pages reference offline/onLine" figure is not what it appears

Not a document contradiction; recorded so a later reader does not re-derive it or, worse, act on the
raw figure.

A case-insensitive grep for `offline|onLine` across `src/pages/` returns hits in eight files. **All of
them are comments or user-facing prose.** None is a runtime check:

- `src/pages/AuthPage.jsx:199,201` — a checkbox label, `Keep me signed in offline (365-day guarantee)`
- `src/pages/SplashPage.jsx:24` — the badge text `OFFLINE-FIRST ENABLED`
- `src/pages/LostFoundPage.jsx:173`, `src/pages/WeeklyReportsPage.jsx:68` — body copy
- `src/pages/BagLockerPage.jsx:21`, `FreeformLogPage.jsx:194,228`, `RegimenRunPage.jsx:264,299`,
  `TrophyRoomPage.jsx:32` — code comments

**The only `navigator.onLine` read in the entire application is `src/components/DataExportPanel.jsx:12`.**
Runtime `online` event subscriptions exist in exactly four places, all in the data layer:
`src/lib/repository/createRepository.js:38`, `src/lib/repository/roundRepository.js:232`,
`src/lib/instantLaunch/syncScheduler.js:89`, and `src/components/DiscPhotoManager.jsx:41`.

This confirms rather than undermines `PHASE_A_ARCHITECTURE.md` § 8: offline handling **is** centralized
in the repository layer, and a page not referencing `onLine` is not a gap. The real signal is whether
the modules a page imports are cache-backed — which is how `STATE_MATRIX.md` § 4 classifies the
`S-OFFLINE-READ` column, and which is what surfaced the eight uncached modules ranked as gap 3.

---

## Checked and found accurate (no correction needed)

Recorded so a later reader does not re-verify these:

- `PHASE_A_ARCHITECTURE.md:191` — "Ghost records use opacity plus an icon, label, and outline."
  Confirmed at `src/App.css:1128-1139`: `opacity: 0.72`, a dashed border, and a `::before` carrying
  `◌ Hidden` — icon and label both present. Applied at `src/pages/HistoryPage.jsx:236`. The only
  reservation is that icon and label are CSS `content:` rather than DOM text; filed as open question 4
  in `STATE_MATRIX.md` § 6 rather than as a correction, because the contract does not specify a
  mechanism.
- `PHASE_A_ARCHITECTURE.md:242` — "Recently Deleted visibility · 30 days." Confirmed:
  `RECENTLY_DELETED_DAYS = 30` at `src/lib/history.js:10`, enforced in the visibility filter at
  `:53-60`, and stated to the user at `src/pages/HistoryPage.jsx:209`.
- `PHASE_A_ARCHITECTURE.md:195` — "A network failure never replaces active capture with a full-screen
  error." Confirmed as **currently held**, narrowly. `src/pages/RegimenRunPage.jsx:320` is a
  full-screen error on an `active`-shell route, but its `error` is set only from the initial regimen
  load (`:231`) and from `handleStart` config validation (`:335`) — never from a capture-time network
  failure. `src/pages/FreeformLogPage.jsx:491` renders its error inline and does not early-return at
  all. The clause is not breached today; `RegimenRunPage` is one `setError` call away from breaching
  it, which is why `STATE_MATRIX.md` marks that cell ⚠️ rather than ✅.
- `SCREEN_INVENTORY.md:118-124` — 33 routes, 32 distinct page components, `HistoryPage` serving two.
  Confirmed against the `APP_ROUTES` array in `src/lib/routeMetadata.js` (30 shell routes + 3 pre-shell
  at `:315-317`) and `src/App.jsx:76`, where `/practice/history/deleted` passes the `deleted` prop.
- `docs/ui/README.md:30` already lists `STATE_MATRIX.md` under Foundation. No inventory edit was needed
  to publish this document.
