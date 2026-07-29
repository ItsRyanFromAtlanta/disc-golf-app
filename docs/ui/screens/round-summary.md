# Round Summary

> **🔶 Provisional.** This screen is blocked on **ADR 0001 — Live round scoring interaction model**
> (`docs/decisions/0001-live-round-interaction-model.md`, status **Proposed**), which has not chosen
> between a structured per-hole scorecard and conversational capture. §§ 3, 4, and the review-related
> parts of § 6 are **provisional**: this screen reviews and finalizes whatever the capture surface
> produced, so a change of capture model changes what there is to review. §§ 5, 7, 9, 10 describe the
> data, lifecycle, contract, and coverage layers, which all three ADR options share. **This document does
> not resolve the ADR.** Status is owned by [`SCREEN_INVENTORY.md`](../SCREEN_INVENTORY.md):64.

| Field | Value |
|---|---|
| Route id | `round-summary` |
| URL pattern | `/rounds/:roundId/summary` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Round Summary` |
| Activity pill | declared shown (`showActivityPill: true`) — inert for rounds, see `_corrections/courses-screens.md` CS-7 |
| Scroll key | `round-summary` |
| Preserves nested state | `false` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/RoundSummaryPage.jsx` (146 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

`routeMetadata.js:54-61` places `round-summary` **before** `round-scorecard` in the route array so that
`/^\/rounds\/[^/]+\/summary$/` is tested before `/^\/rounds\/[^/]+$/`. `App.jsx:105-106` mirrors the
ordering. Neither is strictly required — the scorecard's pattern excludes a second path segment — but the
ordering is load-bearing documentation of intent and should not be shuffled.

The shell header shows the static string `Round Summary` while the page `h1` shows the course name
(`COPY_AND_TERMINOLOGY.md` § 4).

## 1. Purpose

The end-of-round review and the **only** place a round is marked complete: three headline stats, the
hole-by-hole card, and a `Finish round` button that writes the final score and closes the round's
lifecycle activity.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Finish` in the `/rounds/:roundId` header | `Link` from `round-scorecard` (`RoundScorecardPage.jsx:153`) | The intended path. Note the link **finalizes nothing** — this screen's button does |
| In | Direct URL / restored session | Route match | `ProtectedRoute` + the `AppShell` onboarding gate apply |
| Out | `Scorecard` (page header) | `Link` to `/rounds/:roundId` | Always present, **including after completion** — which is how a finished round becomes editable again; see § 6 |
| Out | `Back to rounds` | `Link` to `/rounds` | Replaces the finish button once `status === 'completed'` |
| Out | `Course directory` | `Link` to `/courses` | Always present, below the primary action |
| Out | Shell back control | Header, shell-owned | Goes to `/courses` (section root), **not** back to the scorecard |
| Out | Tab re-tap on COURSES | `TabBar` → `resolveSectionRoot('courses')` | Returns to `/courses` |

**Nothing links here except the scorecard.** `rounds-root` and `courses-root` both link their round rows
to `/rounds/:roundId` — the scorecard — for completed rounds as well as in-progress ones, so the natural
destination for a finished round is the editable capture surface rather than this read-mostly summary.
See `rounds-root` § 12 question 1.

`useActivityNavigationLifecycle` never intercepts this route: it acts only on transitions into and out of
`SHELL_TYPES.ACTIVE` (`useActivityNavigationLifecycle.js:36-38`), and no COURSES route uses the active
shell. So arriving here from live capture writes no lifecycle event, and neither does leaving mid-review.

**Scroll position leaks between rounds** — all rounds share the scroll key `round-summary`; see CS-1.

## 3. Layout

> Provisional per ADR 0001.

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Round Summary                        [ bell ]    | <- back goes to /courses
+-------------------------------------------------------+
|  EAST ROSWELL PARK              [ Scorecard ]         | <- h1 = course name; link stays after completion
|  Mar 3, 2026                                          | <- formatPlayedAt, or "Date not set"
+-------------------------------------------------------+
|  Round completed on this device; it will sync when    | <- .form-info notice, offline finish
|  you reconnect.                                       |
+-------------------------------------------------------+
|  +-----------+  +-----------+  +-----------+          | <- .round-summary-grid, 3 columns
|  | Relative  |  | Total     |  | Status    |          |    (1 column below 380px)
|  | to par    |  | strokes   |  |           |          |
|  |    +2     |  |    56     |  |Completed  |          |
|  +-----------+  +-----------+  +-----------+          |
+-------------------------------------------------------+
|  Hole 1        Par 3               4                  | <- .course-hole-row, same 3-col grid
|  Hole 2        Par 4               4                  |    as course-detail
|  Hole 3        Par 3               —                  | <- em-dash for an unscored hole
|  ... one row per hole, no heading above the list ...  |
+-------------------------------------------------------+
|  [           Finish round              ]              | <- .btn-primary, 80px; or "Back to rounds"
|            Course directory                           | <- .link-button, centered
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

There is no par-vs-score visual (no birdie/bogey colouring, no bar), no best/worst hole, no disc usage
rollup, no notes recap, and no comparison to previous rounds at the same course — although every input
for all of those is already loaded. Contrast blueprint Screen 9, the practice *Session Summary*, which
is in scope and shipped with a hero scoreboard and progress bars (`SCREEN_SPECS.md:245`); the round
summary got the plain version.

### 3b. Region outline (normative, provisional)

```
Shell header (AppShell-owned)
  back to /courses, title "Round Summary", notification bell
Body (shell scroll region, scrollKey round-summary)
  Page header (.practice-header)
    hdr-course ........... h1, round.course?.name ?? "Round summary"
    hdr-date ............. formatPlayedAt(round.played_at)
    hdr-scorecard ........ "Scorecard" link → /rounds/:roundId
  Notice
    notice-sync .......... form-info; offline finish, or lifecycle finalize failure
  Stat grid (.round-summary-grid)
    stat-relative ........ "Relative to par" / E | +3 | -2 | —
    stat-total ........... "Total strokes" / <n> | —
    stat-status .......... "Status" / Completed | In progress
  Hole list (ol.course-hole-list.round-summary-holes)
    sum-hole ............. "Hole <n>" / "Par <n>" / score or em-dash
  Actions (.round-actions)
    cta-finish ........... "Finish round" / "Finishing…"   (status !== completed)
    cta-backtorounds ..... "Back to rounds"                (status === completed)
    cta-directory ........ "Course directory" → /courses
Tab bar (shell-owned)
```

`cta-finish` and `cta-backtorounds` are mutually exclusive — the same slot, switched on
`round.status === 'completed'` (`:131`). The hole list has no heading of its own, so it is an unlabelled
`<ol>` between the stat grid and the actions.

## 4. Element catalog

> Provisional per ADR 0001.

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-course` | h1 | `round.course?.name ?? 'Round summary'` | — | — | — | falls to `Round summary` when the course did not hydrate — the common case for a round created offline, since `hydrateRounds` attaches `course` on the remote path only (`roundLog.js:63-76`) |
| `hdr-date` | `<p class="log-time">` | `formatPlayedAt(round.played_at)` → `Date not set`, else `toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })` | — | — | — | `formatPlayedAt` (`:12-15`) is **duplicated verbatim** from `RoundsPage.jsx:7-10`; neither copy is exported or tested |
| `hdr-scorecard` | link (`.link-button`) | `Scorecard` | default / pressed | navigate | `/rounds/:roundId` | always, **including after completion** — the mechanism by which a finished round is re-edited without its total being updated. See § 12 question 2 |
| `notice-sync` | `<p class="form-info">` | `Round completed on this device; it will sync when you reconnect.` **or** `Round saved; its activity lifecycle will retry when you reconnect.` | present / absent | — | — | the first is set when `updateRound` fails but produced an `error.localResult` (`:71-73`); the second when the round update succeeded but `finalizeRoundActivity` threw (`:68-72`). Both are accurate — the round write is genuinely queued, and `flushRoundOutbox` genuinely replays it |
| `stat-relative` | stat tile | label `Relative to par`; value `E` / `+3` / `-2` / `—` | — | — | — | `formatRelativeToPar(relativeToPar(round.round_holes, round.holes))` when at least one hole is scored, else `—` (`:49-56`). Sparse cards report **current position**, not a projection (`rounds.js:25-29`) |
| `stat-total` | stat tile | label `Total strokes`; value `<n>` or `—` | — | — | — | `roundTotal(round.round_holes)` — sums entered scores only — shown only when `hasScore`, else `—`. This is **recomputed live**, unlike `rounds-root`'s row which shows the stored `total_score` |
| `stat-status` | stat tile | label `Status`; value `Completed` / `In progress` | — | — | — | reads `rounds.status` exactly: anything not `'completed'` renders `In progress`. **It does not reflect the lifecycle activity's state**, which can be `draft` on a round that reads `Completed` here — see § 5 |
| `sum-hole` | list item (`li.course-hole-row`) | `Hole <n>` · `Par <par>` · score or `—` | — | — | — | one per entry in `round.holes ?? []`, matched to a `round_holes` row by `hole_id` (`:119`). **Read-only** — no editing on this screen |
| `cta-finish` | button (`.btn-primary`) | `Finish round` → `Finishing…` | idle / saving / disabled | `useUpdateRound().mutateAsync` then `finalizeRoundActivity` | `rounds.status`, `rounds.total_score`, `activities` | `disabled={saving}`. Shown only when `status !== 'completed'`. **No confirmation, and no check that the round is complete** — a round with 3 of 18 holes scored finishes with `total_score` = the sum of those 3 |
| `cta-backtorounds` | link (`.btn-primary`) | `Back to rounds` | default / pressed | navigate | `/rounds` | shown only when `status === 'completed'`. **There is no "reopen" control** — once finished, the finish action is gone, though the scorecard remains editable |
| `cta-directory` | link (`.link-button`) | `Course directory` | default / pressed | navigate | `/courses` | always; `.round-actions .link-button` centers it (`App.css:734-737`) |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Outbox drain before the read | `flushRoundOutbox(user.id)` | `lib/repository/roundRepository` | Supabase + Dexie | async, errors swallowed |
| The round, its holes, and its scored rows | `loadRound(roundId, user.id)` | `lib/repository/roundRepository` | Supabase **with Dexie fallback** | async |
| Total strokes | `roundTotal(round.round_holes)` | `lib/rounds` | — | **pure** |
| Relative to par | `relativeToPar(round.round_holes, round.holes)` → `formatRelativeToPar` | `lib/rounds` | — | **pure** |

Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

The mount effect (`:27-46`) chains `flushRoundOutbox(user.id).catch(() => undefined).then(() => loadRound(roundId, user.id))` — **drain before read**, the same correct ordering as `round-scorecard`. It
matters more here: a score queued offline on the scorecard must reach Supabase before this screen
computes and freezes `total_score`, or the stored total will be short.

**Unlike the scorecard, this page does not call `prepareRound`.** It renders `round.holes` as returned,
with a lookup into `round.round_holes` per hole (`:118-119`). Two consequences:

1. A `round_holes` row whose `hole_id` is not in `round.holes` — an orphan, which `fetchRound` explicitly
   preserves (`roundLog.js:107-115`) and `prepareRound` appends for the scorecard
   (`RoundScorecardPage.jsx:34`) — is **invisible here but still counted** by `roundTotal` and
   `relativeToPar`. The stat tiles can therefore exceed what the visible rows sum to.
2. A round read from the Dexie cache that was created offline and never synced has **no `holes` array at
   all** (`cacheRound` stores the create payload, which has none — `roundRepository.js:270`), so
   `(round.holes ?? [])` renders an empty list. `stat-relative` still works, because
   `readCachedRound` rehydrates `round_holes` from Dexie (`:98-106`) and `cacheRoundHole` preserves each
   row's attached `hole` object (`:35`), which `relativeToPar` reads directly (`rounds.js:12`). So an
   offline-created round shows correct headline stats above an empty hole list.

### Writes

| Mutation | Call | Idempotency key | Local transaction boundary |
|---|---|---|---|
| Complete the round | `useUpdateRound(user.id).mutateAsync({ roundId, fields: { status: 'completed', total_score } })` | none of its own; `onConflict`-free `.update().eq('id')` is naturally idempotent | Dexie `cacheRound(optimistic)` plus one shared-`outbox` entry, queued **before** the remote call |
| Finalize the lifecycle activity | `finalizeRoundActivity(round.id, user.id)` | `round:<roundId>:finalize` | `activityRepository.finalize` — one Dexie transaction plus an ordered outbox entry, then `roundActivitySync.flush()` |

`finishRound` (`:58-83`) runs them in sequence with **independent** error handling:

```
updateRound.mutateAsync(...)          →  setRound(result)
  then  finalizeRoundActivity(...)    →  on throw: notice, but the round stays completed
  catch (outer)                       →  err.localResult ? optimistic round + notice : setError
```

So the two writes can diverge: the round can be `completed` while its activity is not. That is the
correct precedence — the sporting fact wins, per `PHASE_A_ARCHITECTURE.md` § 14's "Conflicts preserve
valid sporting facts" — but it has a consequence nothing surfaces.

**`finalizeRoundActivity` silently does nothing to a draft parent.** `roundRepository.js:174-183`:

```js
if (!activity || activity.user_id !== userId ||
    ![ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED].includes(activity.state)) {
  return activity          // no throw, so no notice, so no signal of any kind
}
```

A round created while another activity was current has a parent left in `draft` on purpose
(`roundRepository.js:140-144`; see `round-start` § 5). That parent never becomes `active`, so this early
return fires, no error is raised, and:

| Effect | Where |
|---|---|
| `rounds.status` reads `completed` and `stat-status` shows `Completed` | this screen |
| the `activities` row stays `draft` forever | — |
| `weeklyReportRepository` counts only rounds whose activity id is among activities in state `completed` | `weeklyReportRepository.js:6, 38, 50` |
| **the round never appears in any weekly report** | — |

The user is told nothing, here or anywhere. This is the downstream half of `round-start` § 12 question 1
and the reason `T-round-start-3` and `T-round-summary-2` are paired.

`useUpdateRound` (`roundRepository.js:285-307`) is otherwise well-formed: it reads the cached round,
builds an optimistic merge, queues the outbox entry before the remote call via `runQueuedMutation`, and
attaches `error.localResult` on failure so the page can keep the completed state locally.

### Offline

Good, and honest about it — the best offline behavior of any write in the section.

- The read falls back to the Dexie cache (`loadRound`), so a round can be reviewed offline.
- `Finish round` queues before it calls the remote, so the completion is durable immediately.
- On failure the page merges `err.localResult` into local state — so `stat-status` flips to `Completed`
  and `cta-finish` is replaced by `Back to rounds`, matching what will be true after sync — and shows
  `Round completed on this device; it will sync when you reconnect.` That sentence is **accurate**:
  `flushRoundOutbox` replays `{ table: 'rounds', op: 'update' }` entries (`:343-345`).
- If only the lifecycle finalize failed, the second notice says so separately.

Two gaps:

- **Neither notice is one of the four `PHASE_A_ARCHITECTURE.md` § 12 calm states**
  (`Saved on Device`, `Syncing`, `Synced`, `Needs Attention`). They are prose, they appear only after a
  failure rather than reflecting standing state, and they reserve no stable layout space.
- **No reconnect listener.** Like the scorecard, this page flushes the outbox once, on mount. Regaining
  signal while the summary is open does not push the queued completion; the user must navigate away and
  back, or open `/rounds`, whose `useRoundList` does carry an `online` listener
  (`roundRepository.js:227-234`).

## 6. Flow paths

> The review portions are provisional per ADR 0001; Offline, Auth, and Destructive are not.

**Happy path.** `/rounds/:roundId` → `Finish` → outbox drains, `loadRound` resolves → three stats and the
hole list render with `In progress` → `Finish round` → button reads `Finishing…` → `rounds.status` and
`total_score` written → `finalizeRoundActivity` closes the lifecycle parent → `stat-status` flips to
`Completed` and the button becomes `Back to rounds`.

**First run / empty.** No distinct empty state. Three degenerate cases render without comment:

| Situation | What renders |
|---|---|
| No hole scored | `stat-relative` `—`, `stat-total` `—`, every `sum-hole` score `—`; `Finish round` is **enabled** and writes `total_score: null` |
| Round has no holes (null `layout_id`, or a zero-hole layout) | Header, stats, an **empty `<ol>`**, and the actions. No message |
| Offline-created round not yet synced | Correct stats above an empty hole list — see § 5 |

**Error.** Two behaviors:

- **Load failure with no cache** → `S-ERR-BLOCK`. `:86` returns `<p class="form-error">{error || 'Round
  not found'}</p>` as the whole page: no header, no stats, no way to finish the round, no retry
  (`S-RETRY`). `Round not found` is house copy; anything else is a raw Supabase or network string. One
  of the thirteen **unguarded** instances.
- **Finish failure** → either `notice-sync` (when a local result exists — the normal offline case) or
  `setError`, which under `:86`'s `error || !round` test **replaces the entire page** with the error even
  though `round` is loaded and fine. A finish failure with no `localResult` therefore destroys a
  perfectly good summary view. That combination is narrow (`useUpdateRound` attaches `localResult` on
  every failure path at `:300-303`) but the branch is live.

**The second bullet is a divergence from `S-ERR-BLOCK` as the row defines it.** The row scopes the state
to "a read fails and replaces the whole screen." Here a *write* failure replaces a screen whose read
succeeded — the same extension `settings` makes, and for the same structural reason: one `error` state
shared between the load path and the mutation path, tested in an early return. Two of the twenty
documents in this pass found that shape independently; it is not specific to either screen.

**Offline.** `S-OFFLINE-READ` — on the working side: `roundRepository` is cache-backed.
`S-OFFLINE-WRITE` — review and completion both work and queue through the round outbox. As § 5; no
reconnect self-heal, which diverges from the row's `createRepository` `online`-event re-flush.

**Resolves the `?` in this route's `S-SYNC` cell — and it is a sixth vocabulary, not one of the five.**
`RoundSummaryPage.jsx:76` sets `Round completed on this device; it will sync when you reconnect.`,
rendered as `.form-info` at `:100`. That is a distinct string from all five the row catalogues, including
`round-scorecard`'s `Saved on this device; it will retry when you reconnect.` — same screen family, same
repository, three words different. It uses none of § 12's four labels and reserves no layout space.
The row's count of "five distinct offline/sync copy vocabularies" is therefore an undercount; logged in
`_corrections/state-citations-2.md`.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell; `S-ONBOARD` — the onboarding gate
runs first.
`RoundSummaryPage.jsx:19` dereferences `user.id`. `loadRound`'s cached path checks `round.user_id`; the
remote path relies on RLS (`Authenticated users manage own rounds`,
`20260714150000_phase_c_round_logging_rls.sql:160`). `finalizeRoundActivity` independently rejects a
mismatched `activity.user_id` (`roundRepository.js:177`).

**Interlock.** **N/A** — none is enforced. Worth naming what is absent rather than leaving it bare:

- **No completeness check.** `cta-finish` never inspects how many holes are scored. Finishing a round
  after three holes writes `total_score` = the sum of three and marks it `Completed`, and that number
  then appears in `rounds-root` and feeds the weekly report's `rounds_completed` highlight
  (`weeklyReport.js:92`) as a full round. This is the `S-INCOMPLETE` gap arriving from the other
  direction: the row records that `activities.needs_review` is captured, notified around, and never
  rendered, and names `round-summary` as one of the three affected screens. Here a round that any
  reasonable definition would mark as needing review is instead marked `Completed` with no badge, so
  there is nothing for the unrendered column to have flagged.
- **No idempotency guard against a stale total.** `total_score` is computed once, at the moment the
  button is pressed, from whatever `round_holes` happen to be loaded.

**Destructive.** Finishing a round is the only irreversible action in the COURSES section, and it is
presented as an ordinary primary button:

- **No confirmation step.** `COMPONENT_LIBRARY.md` item 8 records that the app's three existing
  destructive flows all call `window.confirm()` and that no confirmation component exists; this flow has
  neither.
- **No reopen.** Once `status === 'completed'`, `cta-finish` is replaced by `cta-backtorounds` and no
  screen offers a way back to `in_progress`.
- **But the round is still editable.** `hdr-scorecard` stays, and `round-scorecard` never reads
  `round.status`, so a completed round's scores can be changed freely — and those changes do **not**
  update `total_score`, which was frozen here. The round then reports one number in `stat-total`
  (recomputed live) and a different one in `rounds-root`'s `row-total` (the stored column). See § 12
  question 2.
- **No delete.** As with every round, there is no way to remove it (`rounds-root` § 12 question 4),
  though RLS permits it.

## 7. Dependencies

### Schema

- `rounds` — the write target: `total_score` and `status` (`supabase_schema.sql:111-112`).
  `normalizeRoundFields` (`roundLog.js:24-40`) whitelists the columns `updateRound` will send and strips
  `id`/`user_id` defensively (`:144-145`). RLS is `for all using (auth.uid() = user_id)`
  (`20260714150000_phase_c_round_logging_rls.sql:160`).
- `round_holes` — read only here, for `score` and `hole_id`.
- `holes` — read for `hole_number` and `par`.
- `courses`, `layouts` — read as relations by `fetchRound`.
- `activities` — the round's lifecycle parent, finalized by `finalizeRoundActivity`. The composite FK
  `rounds(id, user_id) → activities(id, user_id)`
  (`supabase/migrations/20260712193922_phase_a_activity_lifecycle.sql:295-296`) is why the parent exists
  at all. `weeklyReportRepository` reads `activities.state` to decide which rounds count
  (`weeklyReportRepository.js:38, 50`).
- Dexie `rounds`, `roundHoles`, the shared `outbox`, and the activity lifecycle's own tables
  (`db/dexieDb.js`).

### Library

`lib/repository/roundRepository` (`loadRound`, `flushRoundOutbox`, `useUpdateRound`,
`finalizeRoundActivity`), `lib/rounds` (`roundTotal`, `relativeToPar`, `formatRelativeToPar`),
`context/AuthContext` (`useAuth`). Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

`formatPlayedAt` (`:12-15`) is module-local, unexported, untested, and byte-identical to
`RoundsPage.jsx:7-10`.

### Components

**None.** No import from `src/components/`. The three stat tiles are hand-rolled `.round-summary-stat`
divs; the hole list reuses `course-detail`'s `.course-hole-list` / `.course-hole-row` classes without
sharing a component. `COMPONENT_LIBRARY.md` § "Common needs with no shared component" catalogues the
pattern.

Notably, the practice side has a built `SessionReport` with a hero scoreboard and progress bars
(`COMPONENT_LIBRARY.md`, and `SCREEN_SPECS.md:245` Screen 9). None of it is reused here.

### Screens

- **Requires:** `round-scorecard`'s `Finish` link — the only in-app route to this screen — and therefore
  `round-start` and `courses-new` transitively.
- **Required by:** nothing structurally, but this screen is the **sole writer** of
  `rounds.status = 'completed'` and `rounds.total_score`, which `rounds-root` and `courses-root` both
  display and which `weekly-reports` counts.
- **Affects, invisibly:** `weekly-reports` — whether a round appears there is decided by
  `finalizeRoundActivity`'s early return here (§ 5); `play-root` — finalizing the round frees the single
  active activity slot, which changes its hero card (CS-6).

### Contracts and decisions

- **ADR 0001 — `docs/decisions/0001-live-round-interaction-model.md`, status Proposed.** The blocking
  dependency: this screen reviews and finalizes whatever the capture surface produced, so Option B
  (conversational capture) would change what a summary is summarizing. The finalization contract itself
  is model-independent. **Not resolved here.**
- `PHASE_A_ARCHITECTURE.md` § 3 (finalization and inference) — this screen is the app's only round
  finalization point.
- `PHASE_A_ARCHITECTURE.md` § 2 (lifecycle history) — `finalizeRoundActivity` writes the terminal state
  event with `expectedState`, `expectedVersion`, `occurredAt`, `recordedAt`, source, installation id,
  reason `USER_FINALIZE`, and idempotency key `round:<roundId>:finalize` (`roundRepository.js:184-195`).
  Fully compliant, and the best-formed lifecycle mutation in this section.
- `PHASE_A_ARCHITECTURE.md` § 14 — repository and transaction contract: `useUpdateRound` observes
  queue-before-remote; the round-then-activity ordering with independent failure handling is what
  § 14's "Conflicts preserve valid sporting facts" prescribes.
- `PHASE_A_ARCHITECTURE.md` § 12 — 80pt primary (met by `.btn-primary`), 44pt secondary (not met by
  `.link-button`), calm offline states (approximated in prose, not met), and "destructive actions do not
  sit beside scoring actions" — arguably met here, since scoring lives on the previous screen.
- `PHASE_A_ARCHITECTURE.md` § 5 — no `round` metric subject exists; see § 9.
- `DEVELOPMENT_PLAN.md` § E2 owns the backlog.

## 8. Accessibility

> The review-surface portions are provisional per ADR 0001.

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** `cta-finish` and `cta-backtorounds` inherit `min-height: var(--tap-target-min)` = 80px
  (`index.css:44`, `App.css:435-446`), meeting the 80pt primary-action rule, and the button's label
  changes to `Finishing…` so the busy state is text rather than a spinner alone.
- **Good:** `.round-summary-grid` collapses from three columns to one below 380px
  (`App.css:739-748`), so the stat tiles survive a 320px viewport.
- **Good:** the hole list is an `<ol>`, conveying sequence structurally.
- **Gap:** the stat tiles are `<div><span>label</span><strong>value</strong></div>` with no programmatic
  association between label and value. Each tile reads as two unrelated strings, and `E` for even par is
  unexplained to any user, sighted or not.
- **Gap:** `notice-sync` has no `role="status"`, so a user who finishes a round offline is never told —
  the button changes and a paragraph appears silently. This is the one moment on the screen where
  something important happens without a visible action, and it is the least announced.
- **Gap:** `hdr-scorecard` and `cta-directory` are `.link-button`s with no `min-height` and no padding
  (`App.css:455-466`) — roughly 17px tall against a 44×44pt minimum. Shared fix, `T-courses-root-6`.
  `cta-directory` is additionally centered directly beneath an 80px primary button, which makes it a very
  small target immediately below a very large one.
- **Gap:** the hole list has no heading and no accessible name — it is a bare `<ol>` between the stat grid
  and the actions, so there is no way to jump to it or past it.
- **Gap:** `sum-hole`'s three grid cells are bare text (`Hole 1`, `Par 3`, `4`); the score cell has no
  label at all, so it reads as a lone number. The same defect as `course-detail`'s `hole-row`, one column
  worse.
- **Gap:** the loading paragraph has no `role="status"` and the full-page error no `role="alert"`.
- **Gap:** finishing a round is irreversible and has no confirmation, so there is no protection against a
  mis-tap — for anyone, and particularly for a motor-impaired user, on an 80px button.
- **App-wide, not a screen delta:** two `h1` elements per page — the shell's and this page's.

## 9. Events and telemetry

**This is the only screen in the COURSES section that writes a terminal lifecycle event.**

| What | Contract | Detail |
|---|---|---|
| Activity finalized | `PHASE_A_ARCHITECTURE.md` §§ 2–3 | `activityRepository.finalize(roundId, { expectedState, expectedVersion, occurredAt, recordedAt, source: MANUAL_ENTRY, installationId, reason: USER_FINALIZE, idempotencyKey: 'round:<roundId>:finalize', metadata: { source: 'round_logging' } })` (`roundRepository.js:184-195`) |
| Sync flush | `PHASE_A_ARCHITECTURE.md` § 8 | `roundActivitySync.flush()` immediately after finalize (`:196`), and again inside `flushRoundOutbox` on mount (`:326`) |
| **Not written** | — | Nothing when the parent is `draft` — the early return at `:174-183` produces no event and no error |

**Notifications:** none produced or consumed (`PHASE_A_ARCHITECTURE.md` § 7). Worth noting as a gap
rather than a fact: § 7's initial categories include `activity`, and finishing a round is the most
notification-worthy moment in this section — particularly the offline case, where the completion sits
queued with nothing to tell the user when it lands.

**Metrics:** none emitted. `PHASE_A_ARCHITECTURE.md` § 5 anticipates a `round` subject;
`src/lib/metrics/registry.js` declares only `player`, `routine`, `session`, and `physical_disc`. So
`total_score` is written as a plain column rather than through a registered metric, which is why
`weeklyReport.js` recomputes round counts from raw rows (`weeklyReport.js:79-102`) instead of reading a
metric.

**Downstream consumer, worth stating explicitly:** `weeklyReportRepository.sourceRows`
(`weeklyReportRepository.js:36-52`) selects `rounds` in the report window and then filters them to
activity ids in state `completed`. `buildWeeklyReportSnapshot` counts them into
`sample_counts.rounds` and a `rounds_completed` highlight (`weeklyReport.js:79-102`), rendered by
`WeeklyReportsPage.jsx:12`. That chain is the only place a finished round is used for anything, and it is
the chain the draft-parent case in § 5 silently breaks.

## 10. Tests

### Existing coverage

**Partial, at the pure-function layer only.** Confirmed by reading every import of
`RoundSummaryPage.jsx`:

| Import | Test file | Covers this screen? |
|---|---|---|
| `lib/rounds` (`roundTotal`, `relativeToPar`, `formatRelativeToPar`) | `src/lib/rounds.test.js` | Yes — 4 tests, 32 lines |
| `lib/repository/roundRepository` (`loadRound`, `flushRoundOutbox`, `useUpdateRound`, `finalizeRoundActivity`) | **absent** — no `roundRepository.test.js` | — |
| `context/AuthContext` | absent | — |

[`TEST_MAP.md`](../TEST_MAP.md):67 records `round-summary` → `rounds`. Accurate.

Adjacent coverage that does **not** reach this screen but is worth knowing about:
`src/lib/repository/activityRepository.test.js` exercises the lifecycle engine including a
`DISC_GOLF_ROUND` draft (`:161`), and `src/lib/weeklyReport.test.js` covers
`buildWeeklyReportSnapshot`. Neither touches `finalizeRoundActivity`, which is the function joining them.

Unverified at any layer, in order of consequence:

1. **`finalizeRoundActivity`'s early return on a `draft` parent** — the branch that silently excludes a
   round from every weekly report, forever. No test at any layer asserts either side of it.
2. **The round-then-activity write sequence in `finishRound`**, including the case where the round
   completes and the finalize fails.
3. **`useUpdateRound`'s optimistic merge, outbox ordering, and `error.localResult`** — the whole offline
   completion path.
4. **`total_score` computation at finish time**, including the `hasScore ? total : null` branch and the
   fact that it is never recomputed afterwards.
5. `formatPlayedAt`'s null branch, and its duplication.
6. Every rendering branch: full-page error, empty hole list, the completed/in-progress action swap, the
   offline notice.
7. The orphan-`round_holes` divergence in § 5 — stats counting rows the list does not show.

### Acceptance criteria

1. A round of nine par-3 holes scored 3,3,3,4,3,3,3,3,3 shows `+1` and `28`.
2. A round with no scored holes shows `—` for both stats and every hole score.
3. An unscored hole renders `—` in the hole list while scored holes render their number.
4. `Finish round` writes `status = 'completed'` and `total_score` equal to `stat-total`, and swaps the
   button to `Back to rounds`.
5. Finishing an unscored round writes `total_score: null`, not `0`.
6. Finishing a round with 3 of 18 holes scored **warns before completing**. *Currently fails* — it
   completes silently with a partial total.
7. Finishing offline shows `Round completed on this device; it will sync when you reconnect.`, flips the
   UI to completed, and syncs exactly once on reconnect.
8. That queued completion syncs **without the user navigating away and back**. *Currently fails* — no
   `online` listener on this page.
9. Finishing a round whose activity parent is `active` moves that parent to `completed`.
10. Finishing a round whose activity parent is `draft` **tells the user the round will not be counted**,
    or resolves the parent. *Currently fails* — silent, and the round is excluded from weekly reports
    forever.
11. A completed round's `total_score` matches its holes, or the screen says the total is stale.
    *Currently fails* — editing via `hdr-scorecard` desynchronizes them with no signal.
12. A `round_holes` row with no matching hole is either shown in the list or excluded from the stats.
    *Currently fails* — it is counted and not shown.
13. Opening a summary with no cache and no network offers a retry. *Currently fails.*

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built).
Backlog specs — the first two are `TEST_MAP.md` Priority 1 shapes ("flows where a silent break loses user
data") applied to rounds:

1. **Finalize a round → it appears in the weekly report with matching totals.** The round analogue of
   `TEST_MAP.md` E2E backlog item 3, and the only end-to-end check that would catch the draft-parent
   exclusion in § 5.
2. **Finish offline → reconnect → the round is completed exactly once**, with one `rounds` update and one
   activity finalization, no duplicates. Overlaps backlog item 2.
3. Quick course → start → score 18 → finish → assert `total_score` and relative-to-par match
   `rounds.test.js` arithmetic and match what `/rounds` displays. The end of backlog item 4.
4. Start a putting session, leave it running, start and finish a round → assert what the app says about
   the two activities and whether the round reaches the report.
5. Finish a round → open the scorecard → change a score → return to the summary → assert the two totals
   agree, or that the disagreement is stated (criterion 11).

## 11. Tasks

E2 (`DEVELOPMENT_PLAN.md` § E2) owns these. **Tasks marked ⏸ must not be scheduled before ADR 0001
closes.**

#### T-round-summary-1 — Cover finalization in `roundRepository.test.js`

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/roundRepository.test.js` (new, shared with `T-round-start-2` and
  `T-rounds-root-3`)
- **Done when:** `finalizeRoundActivity` has tests for the `active`, `paused`, `draft`, missing-activity,
  and wrong-user cases, and `useUpdateRound` has tests for the optimistic merge, outbox ordering, and
  `error.localResult`.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `test: cover round finalization and the update path`
- **Note:** do this first. Every other task on this screen changes behavior these tests would pin.

#### T-round-summary-2 — Stop silently excluding rounds from weekly reports

- **Capability:** `sync`
- **Touches:** `src/lib/repository/roundRepository.js`, `src/pages/RoundSummaryPage.jsx`
- **Done when:** finishing a round whose activity parent is `draft` either resolves the parent to
  `completed` or tells the user the round will not be counted and why; a round marked `Completed` on this
  screen appears in the weekly report for its week.
- **Verify:** `npm test` covering both branches, plus a `weeklyReportRepository` case asserting the round
  is counted.
- **Commit:** `fix: finalize the lifecycle parent for every completed round`
- **Blocked by:** `T-round-summary-1`, and `round-start` § 12 question 1 (which decides what should
  happen at creation).
- **Note:** paired with `T-round-start-3`; the two ends of one defect. Highest-severity item on this
  screen — a user's round can be fully played, marked complete, and invisible to the only feature that
  consumes rounds.

#### T-round-summary-3 — Confirm before finishing an incomplete round

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundSummaryPage.jsx`, a shared confirmation component
- **Done when:** finishing a round with unscored holes requires an explicit confirmation naming how many
  holes are unscored; finishing a fully scored round is unchanged.
- **Verify:** `npm test` with page-level tests for the partial and complete cases; manual check.
- **Commit:** `feat: confirm before completing a partially scored round`
- **Note:** `COMPONENT_LIBRARY.md` item 8 records three existing `window.confirm()` callers and no
  confirmation component. **Do not add a fourth `window.confirm`** — build the component, and let
  `T-rounds-root-7` reuse it.

#### T-round-summary-4 — Keep `total_score` and the holes in agreement

- **Capability:** `data-access`
- **Touches:** `src/pages/RoundScorecardPage.jsx`, `src/pages/RoundSummaryPage.jsx`,
  `src/lib/repository/roundRepository.js`
- **Done when:** editing a completed round's scores either updates `total_score` or is prevented; the
  number on `rounds-root` and the number on this screen can no longer disagree.
- **Verify:** `npm test` covering an edit-after-finish; manual check of `/rounds` after editing.
- **Commit:** `fix: keep the stored round total consistent with its holes`
- **Blocked by:** § 12 question 2 — this is a product decision (lock, recompute, or reopen), not just a
  bug fix. `rounds-root` § 12 question 1 and `round-scorecard` § 12 question 2 are the same decision seen
  from their screens.

#### T-round-summary-5 — Flush the outbox on reconnect

- **Capability:** `sync`
- **Touches:** `src/pages/RoundSummaryPage.jsx` or `src/lib/repository/roundRepository.js`
- **Done when:** regaining connectivity while the summary is open flushes a queued completion without
  navigation, and the notice resolves to a synced state; the listener is removed on unmount.
- **Verify:** `npm test` dispatching an `online` event; manual offline-finish-then-reconnect check.
- **Commit:** `fix: sync a queued round completion when connectivity returns`
- **Note:** the same fix shape as `T-round-scorecard-2`. Do them together — one listener in
  `roundRepository` could serve both.

#### T-round-summary-6 — Present sync state as a calm status

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundSummaryPage.jsx`, `src/App.css`
- **Done when:** the two notices are replaced by the `PHASE_A_ARCHITECTURE.md` § 12 calm states
  (`Saved on Device` / `Syncing` / `Synced` / `Needs Attention`) in reserved layout space with
  `role="status"`, so finishing offline is announced rather than silent.
- **Verify:** `npm run lint` plus a VoiceOver pass finishing a round offline.
- **Commit:** `fix: show round completion sync state as a calm status`
- **Note:** settle the vocabulary once for the whole section — `rounds-root`'s `banner-cached` and
  `round-scorecard`'s `notice-save` are the same problem (`rounds-root` § 12 question 5).

#### T-round-summary-7 — Label the stat tiles and the hole scores

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundSummaryPage.jsx`
- **Done when:** each stat tile's label and value are programmatically associated, `E` is explained, and
  the hole list's score column is labelled; the visual output is unchanged.
- **Verify:** `npm run lint` plus a manual VoiceOver pass.
- **Commit:** `fix: label round summary stats for assistive tech`

#### T-round-summary-8 — Keep the summary on screen when a finish fails

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundSummaryPage.jsx`
- **Done when:** a `setError` from a failed finish renders inline and leaves the summary intact; only a
  failed *load* can produce the full-page state, and that state carries a retry.
- **Verify:** `npm test` with page-level tests for a failed finish and a failed load.
- **Commit:** `fix: do not replace the round summary with a finish error`

#### ⏸ T-round-summary-9 — Make the summary worth reading

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundSummaryPage.jsx`, `src/lib/rounds.js`
- **Done when:** the summary shows per-hole result against par (birdie/par/bogey), the best and worst
  holes, disc usage, and any hole notes — all from data already loaded — reaching parity with the
  practice `SessionReport`.
- **Verify:** `npm test` for the new pure derivations; manual check on a completed 18-hole round.
- **Commit:** `feat: expand the round summary beyond three stat tiles`
- **Blocked by:** **ADR 0001** — Option B would change what capture produces and therefore what a summary
  should show.
- **Note:** new derived stats belong in tested pure functions
  (`DEVELOPMENT_PLAN.md` § Standing conventions).

## 12. Open questions

1. **A round can be `Completed` while its activity is `draft`, and nothing says so.** § 5 traces the
   mechanism and the weekly-report consequence. The decision belongs with `round-start` § 12 question 1:
   what should happen when a round starts during another activity. Until it is answered, `stat-status`
   is showing one of two disagreeing notions of "completed" without saying which. Blocks
   `T-round-summary-2`.
2. **Should a completed round be editable, and if so what happens to `total_score`?** `hdr-scorecard`
   stays after completion, `round-scorecard` ignores `status`, and `total_score` is frozen at finish
   time. Three coherent answers: lock the round (and offer an explicit reopen), recompute the total on
   every hole write, or show the stored total as a historical snapshot and label it as such. All three
   are defensible; the current behavior is none of them. Blocks `T-round-summary-4`; the same question
   appears as `rounds-root` § 12 question 1 and `round-scorecard` § 12 question 2.
3. **Finishing is irreversible, unconfirmed, and possible on a three-hole round.** Three separate
   decisions bundled into one button. `T-round-summary-3` covers the confirmation; whether a reopen path
   should exist is question 2; whether an incomplete round should be completable at all is genuinely
   open, since abandoning a round halfway is a normal thing to do and `ACTIVITY_STATES.INCOMPLETE`
   already exists (`activityLifecycle/types.js:6`) and is never used by this flow.
4. **The stats count rows the hole list does not show.** An orphan `round_holes` row — one whose
   `hole_id` is not in the round's `holes` — is preserved by `fetchRound`, displayed by the scorecard,
   counted by `roundTotal`/`relativeToPar`, and invisible here. Whether such rows should exist at all is
   worth deciding before a hole editor (`T-course-detail-7`) makes them common.
5. **Should completing a round produce a notification?** `PHASE_A_ARCHITECTURE.md` § 7's initial
   categories include `activity` and `sync`. The offline completion path in particular finishes silently
   and syncs later with nothing to tell the user it landed. Related to `T-round-summary-6`.

Filed corrections touching this screen:
[`_corrections/courses-screens.md`](../_corrections/courses-screens.md) CS-1 (`preserveNestedState` and
the shared scroll key), CS-3 (`STATE_MATRIX.md`, since resolved), CS-5 (`TEST_MAP.md` rows), CS-6 (finalizing here
frees the active slot the PLAY hero mislinks), CS-7 (activity pill), CS-9 (ADR 0001 scope vs inventory
status).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no round
summary; `/rounds/:roundId/summary` shipped as `DEVELOPMENT_PLAN.md` § J1 on 2026-07-14, ahead of
`PRODUCT_ROADMAP.md` Phase E by owner decision.

**Blueprint Screen 9, Session Summary & Progress Report** (`SCREEN_SPECS.md:245`) is the analogous screen
for *practice*, and it is in scope and shipped — as `SessionReport` under PLAY, with a hero scoreboard
and progress bars (`COMPONENT_LIBRARY.md`). The comparison is instructive rather than a divergence: the
blueprint designed a rich end-of-session review for putting practice, that review shipped, and the round
equivalent — built later, in a jump-ahead session, with no blueprint to draw from — is three stat tiles
and a list. Nothing decided that the round deserved less; it is simply what J1 had time for.
`T-round-summary-9` is the backlog entry, and it is correctly blocked on ADR 0001, since a summary should
not be designed before the thing it summarizes is settled.

**Screen 13, Frictionless UDisc Ingestion Center** (unbuilt, no route) will create rounds already in a
completed state, bypassing this screen entirely — and therefore bypassing `finalizeRoundActivity`. Since
`weeklyReportRepository` counts only rounds whose activity is `completed`, imported rounds will need
their own lifecycle parents in a terminal state or they will be invisible in reports for exactly the
reason § 5 describes. That is worth resolving as part of question 1 rather than discovering during the
import build.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only additive schema), and #5
(**PLAY / DISCS / COURSES / ME**) apply; see `SCREEN_SPECS.md` § Standing divergences.
