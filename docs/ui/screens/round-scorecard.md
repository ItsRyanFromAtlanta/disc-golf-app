# Scorecard

> **🔶 Provisional.** This screen is blocked on **ADR 0001 — Live round scoring interaction model**
> (`docs/decisions/0001-live-round-interaction-model.md`, status **Proposed**), which has not chosen
> between a structured per-hole scorecard and conversational capture. §§ 3, 4, 6, and 8 describe the
> shipped structured model and are **provisional**: they hold under the ADR's recommended Option C and
> under Option A, and would be replaced under Option B. §§ 5, 7, 9, 10 describe the data, contract, and
> coverage layers, which all three options share. **This document does not resolve the ADR.**
> Status is owned by [`SCREEN_INVENTORY.md`](../SCREEN_INVENTORY.md):63.

| Field | Value |
|---|---|
| Route id | `round-scorecard` |
| URL pattern | `/rounds/:roundId` |
| Section | `courses` |
| Shell | `standard` |
| Header title | `Scorecard` |
| Activity pill | declared shown (`showActivityPill: true`) — inert for rounds, see `_corrections/courses-screens.md` CS-7 |
| Scroll key | `round-scorecard` |
| Preserves nested state | `true` — but the field is never read at runtime; see `_corrections/courses-screens.md` CS-1 |
| Page component | `src/pages/RoundScorecardPage.jsx` (241 lines) |
| Blueprint screen | `none — post-blueprint` (shipped as `DEVELOPMENT_PLAN.md` § J1, 2026-07-14) |
| Verified against | `7351964` |

**This is the only field-capture screen in the app that does not use the `active` shell.** Both putting
capture routes (`freeform-active`, `regimen-active`) carry `shell: SHELL_TYPES.ACTIVE` — the
non-scrolling field layout described in `PHASE_A_ARCHITECTURE.md` § 12 with no header and no tab bar.
Live round scoring runs on the ordinary `standard` shell, with a header, a scroll region, and a tab bar.
Whether that is right is precisely what ADR 0001 has not decided.

The shell header shows the static string `Scorecard` while the page `h1` shows the course name, so the
screen is named twice, differently, on every visit (`COPY_AND_TERMINOLOGY.md` § 4).

## 1. Purpose

The live capture surface for a disc golf round: one card per hole, each taking a score, an optional disc,
and optional notes, autosaved as the player moves down the course. It shows the running total and
relative-to-par at the top and hands off to the summary when the round is done.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Successful create on `/rounds/new` | `navigate('/rounds/' + round.id)` (`RoundStartPage.jsx:106`) | Primary path |
| In | **Failed** create on `/rounds/new` with a local round | `navigate('/rounds/' + err.localResult.id)` (`RoundStartPage.jsx:108-111`) | The offline path — the round exists only in Dexie and the outbox |
| In | Round row on `/rounds` | `Link` from `rounds-root` | For in-progress **and completed** rounds alike |
| In | Recent round row on `/courses` | `Link` from `courses-root` (`CoursesPage.jsx:84`) | Same |
| In | `Scorecard` link on `/rounds/:roundId/summary` | `Link` from `round-summary` (`RoundSummaryPage.jsx:95`) | Available after completion, so a finished round is re-openable and re-editable |
| In | Direct URL / restored session | Route match | `ProtectedRoute` + the `AppShell` onboarding gate apply |
| Out | `Finish` (page header) | `Link` to `/rounds/:roundId/summary` | **Navigation only.** It changes no state — the round stays `in_progress` until the button on the summary page. The label promises an action it does not perform |
| Out | Shell back control | Header, shell-owned | Goes to **`/courses`**, not `/rounds` and not the screen the user came from |
| Out | Tab re-tap on COURSES | `TabBar` → `resolveSectionRoot('courses')` | Returns to `/courses` |
| Out | Any tab press | `TabBar` | **Leaves live capture with no confirmation and no lifecycle pause** — see below |

**Leaving mid-round is completely unguarded.** `useActivityNavigationLifecycle` pauses an active
activity when the user leaves a screen, but only on transitions out of `SHELL_TYPES.ACTIVE`
(`useActivityNavigationLifecycle.js:36-38`). This route is `standard`, so navigating away from a live
round:

- writes no `paused` lifecycle event, unlike leaving a putting session;
- shows no confirmation;
- leaves the round's activity parent in `active` indefinitely, which keeps it as the user's single
  current activity and blocks the lifecycle's start path for anything else.

And because `AppShell.jsx:42-47` computes a pill target only for `putting_regimen` and
`putting_freeform`, there is **no header pill offering to return to the round** — so a player who taps
PLAY mid-round has no in-app affordance to get back except COURSES → View all → the row. Worse,
`/practice` will show them "▶️ Resume active practice" linking to `/practice/freeform`
(`PracticeMenuPage.jsx:162-169`, filed as
[`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-6).

**Scroll position leaks between rounds.** All rounds share the scroll key `round-scorecard`; see CS-1.

## 3. Layout

> Provisional — the region structure below is what Option C and Option A of ADR 0001 preserve.

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Scorecard                            [ bell ]    | <- Shell header; no round pill exists
+-------------------------------------------------------+
|  EAST ROSWELL PARK                    [ Finish ]      | <- h1 = course name; navigates only
|  Main                                                 | <- layout name, or "Scorecard"
+-------------------------------------------------------+
|  +2 · 29 strokes                        Autosaves     | <- .scorecard-toolbar, aria-live=polite
+-------------------------------------------------------+                 ("Saving…" while a write is open)
|  Saved on this device; it will retry when you         | <- .form-info notice, only after a failed save
|  reconnect.                                           |
+-------------------------------------------------------+
|  At the turn                                          | <- .round-turn-prompt — NO CSS RULE EXISTS
|  Take a breath, check your pace, and reset your       |
|  target for the back nine.                            |
|  [ Got it ]   Don't show this again                   |
+-------------------------------------------------------+
|  +-------------------------------------------------+  |
|  | Hole 1                          Score           |  | <- .scorecard-hole
|  | Par 3 · 320 ft                 [   4   ]        |  | <- 80px wide, 56px tall, 24px display font
|  |                                                 |  |
|  | Disc (optional)                                 |  |
|  | [ Thunderbird                             v ]   |  | <- every disc in the locker, not the bag
|  |                                                 |  |
|  | Notes (optional)                                |  |
|  | [                                           ]   |  | <- textarea, 2 rows
|  | [                                           ]   |  |
|  +-------------------------------------------------+  |
|  | Hole 2 ...                                      |  |
|  ( one card per hole; 18 holes = 54 controls )        |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS **COURSES** ME]                 |
+-------------------------------------------------------+
```

Nothing is sticky. The running total scrolls away above hole 3 and the `Finish` control scrolls away with
it, so on an 18-hole round neither the score nor the exit is on screen for most of the round. There is no
current-hole focus, no hole-to-hole stepper, no collapse, and no swipe. `PHASE_A_ARCHITECTURE.md` § 12's
"primary field controls in viewport" is written for `ActiveActivityShell`, which this screen does not use
— which is the concrete shape of what ADR 0001 has left undecided.

### 3b. Region outline (normative, provisional)

```
Shell header (AppShell-owned)
  back to /courses, title "Scorecard", notification bell
Body (shell scroll region, scrollKey round-scorecard)
  Page header (.practice-header)
    hdr-course ........... h1, round.course?.name ?? "Round"
    hdr-layout ........... round.layout?.name ?? "Scorecard"
    hdr-finish ........... "Finish" link → /rounds/:roundId/summary
  Toolbar (.scorecard-toolbar, aria-live="polite")
    tb-score ............. "<relative> · <total> strokes"
    tb-savestate ......... "Saving…" | "Autosaves"
  Notices
    notice-save .......... form-info, after a failed hole save
    notice-discs ......... form-error, when the disc list fails
  Turn prompt (aside.round-turn-prompt) — conditional
    turn-title ........... "At the turn"
    turn-copy ............ pace/reset reminder
    turn-dismiss ......... "Got it" (session-local)
    turn-never ........... "Don't show this again" (writes the profile)
  Hole list (ol.scorecard-hole-list)
    Hole card (li.scorecard-hole, one per hole)
      hole-label ......... "Hole <n>"
      hole-meta .......... "Par <n> · <n> ft" | "Par <n> · distance —"
      fld-score .......... number input, min 1 max 20, saves on blur
      fld-disc ........... select, saves on change
      fld-notes .......... textarea, saves on blur
Tab bar (shell-owned)
```

## 4. Element catalog

> Provisional per ADR 0001.

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-course` | h1 | `round.course?.name ?? 'Round'` | — | — | — | falls to `Round` when the course did not hydrate — the common case for a round created offline, since `hydrateRounds` attaches `course` on the remote path only (`roundLog.js:63-76`) |
| `hdr-layout` | `<p class="log-time">` | `round.layout?.name ?? 'Scorecard'` | — | — | — | falls to the literal `Scorecard`, which reads as a heading rather than a fallback |
| `hdr-finish` | link (`.start-button`) | `Finish` | default / pressed | navigate | `/rounds/:roundId/summary` | always. **Performs no finalization** — see § 12 question 1 |
| `tb-score` | text | `<strong>{relative}</strong> · {total} strokes` | — | — | — | `relative` is `—` until at least one hole has a non-null, non-empty score (`:88-95`); `total` is `roundTotal`, which sums entered scores only and shows `0` before any are entered |
| `tb-savestate` | text | `Saving…` while `savingHoleId` is set, else `Autosaves` | — | — | — | always. **Neither string is one of the four calm states** in `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`, `Needs Attention`), and `Autosaves` describes a capability rather than a state — it says the same thing whether every write has landed or none has |
| `notice-save` | `<p class="form-info">` | `Saved on this device; it will retry when you reconnect.` | present / absent | — | — | set when `saveRoundHole` rejects (`:137`); cleared at the start of the next `persist`. **Accurate** — the outbox entry is real and `flushRoundOutbox` replays it |
| `notice-discs` | `<p class="form-error">` | `Disc list unavailable; scores still save without a disc.` | present / absent | — | — | shown on `discsQuery.error`. Good copy: names the degradation and reassures about the primary task |
| `turn-title` / `turn-copy` | aside | `At the turn` / `Take a breath, check your pace, and reset your target for the back nine.` | present / absent | — | — | shown when `roundTurnPromptEnabled && frontNineComplete && !roundTurnDismissed` (`:166`). `frontNineComplete` requires ≥9 holes numbered ≤9, all scored (`:97-103`). **The `.round-turn-prompt` class has no rule in `src/App.css`** — the block renders unstyled. Filed as CS-8 |
| `turn-dismiss` | button (`.chip`) | `Got it` | default / pressed | `setRoundTurnDismissed(true)` | local state only | **Session-local.** Not persisted, so the prompt returns on every remount of the scorecard until the round's front nine stops being the newest fact |
| `turn-never` | button (`.link-button`) | `Don't show this again` | default / pressed | `upsertProfileFields(user.id, { round_turn_prompt_enabled: false })` | `profiles.round_turn_prompt_enabled` | on failure sets the notice `Preference will retry when you reconnect.` — **which is false.** `upsertProfileFields` is a bare Supabase upsert with no outbox (`LIB_API_INDEX.md:775`); nothing retries it. The toggle is also reachable from Settings (`SettingsPage.jsx:47`) |
| `hole-label` | strong | `Hole <hole_number>` | — | — | — | one card per hole in `prepareRound`'s sorted list |
| `hole-meta` | span | `Par <par> · <distance_feet> ft` or `Par <par> · distance —` | — | — | — | lowercase `distance —` here against Title Case `Distance —` on `course-detail` — two renderings of one fallback |
| `fld-score` | number input (`.scorecard-input`) | visible label `Score`; `aria-label="Score for hole <n>"` | empty / filled / saving | `updateLocal` on change, `saveRoundHole` on **blur** | `round_holes.score` | `min="1" max="20" inputMode="numeric"`. **The bounds are not enforced**: there is no form submit, so browser validation never runs, and neither `persist` nor `localHole` clamps — a typed `99` is saved as `99`. See § 6 Interlock |
| `fld-disc` | select | visible label `Disc (optional)`; first option `No disc selected` | — | `saveRoundHole` on **change** | `round_holes.disc_id` | lists **every disc in the locker**, unfiltered by `status` (`fetchUserDiscs`, `discLocker.js:11-19`) and unrelated to the bag captured at round start. Label text is `discLabel()`: `nickname \|\| moldInfo.mold_name \|\| mold \|\| manufacturer \|\| 'Disc'` (`:45-47`) |
| `fld-notes` | textarea, 2 rows | visible label `Notes (optional)` | empty / filled / saving | `updateLocal` on change, `saveRoundHole` on **blur** | `round_holes.notes` | empty string is normalized to `null` on save (`:232`) |

**Three fields, three save timings**: score on blur, disc on change, notes on blur. Nothing on screen
explains the difference, and `tb-savestate` reads `Autosaves` for all three.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| The round, its holes, and its scored rows | `loadRound(roundId, user.id)` | `lib/repository/roundRepository` | Supabase **with Dexie fallback** | async |
| Outbox drain before the read | `flushRoundOutbox(user.id)` | `lib/repository/roundRepository` | Supabase + Dexie | async, errors swallowed |
| Disc list for the per-hole picker | `useDiscList(user.id)` | `lib/repository/discRepository` | Supabase + Dexie | React Query hook |
| Turn-prompt preference | `fetchProfile(user.id)` | `lib/profile` | Supabase | async, **not awaited**, errors swallowed |
| Running total | `roundTotal(round_holes)` | `lib/rounds` | — | **pure** |
| Relative to par | `relativeToPar(round_holes, holes)` → `formatRelativeToPar` | `lib/rounds` | — | **pure** |

Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

The mount effect (`:61-85`) does three things, in a deliberate order for two of them:

1. `fetchProfile` for the turn preference — fired and forgotten, `.catch(() => undefined)`, not chained.
   A failure silently leaves the prompt enabled.
2. `flushRoundOutbox(user.id).catch(() => undefined).then(() => loadRound(roundId, user.id))` — **drain
   before read**, so a round or hole write queued on a previous visit is pushed to Supabase before the
   remote state is fetched. This is the right ordering and it is why returning to a scorecard after
   reconnecting shows synced data rather than clobbering it.
3. `prepareRound(value)` (`:16-35`) normalizes the result: sort holes by `hole_number` then `tee_type`,
   attach the existing `round_holes` row per hole or synthesize a local one with a fresh
   `crypto.randomUUID()`, and append any orphan `round_holes` whose `hole_id` is not in the layout. So
   every hole always has a row object, which is what makes `rowFor`/`makeRow` total.

`loadRound` (`roundRepository.js:200-208`) tries `fetchRound`, caches the result into Dexie, and on
failure returns `readCachedRound` — which additionally verifies `round.user_id` matches, so a shared
device cannot surface another account's cached round.

**The disc picker ignores the round's bag.** `round-start` captures a `bag_version_id` snapshot at
creation (`roundRepository.js:250-258`) precisely so the app knows which discs were carried.
`useDiscList` returns the entire locker — every status, including `lost`, `retired`, and `sold`
(`fetchUserDiscs` has no status predicate). Nothing on this screen reads `round.bag_id` or
`round.bag_version_id`. The snapshot is written and never used. See § 12 question 3.

### Writes

| Mutation | Call | Idempotency key | Local transaction boundary |
|---|---|---|---|
| Save one hole's score / disc / notes | `saveRoundHole(payload)` (`lib/repository/roundRepository`) | none of its own; the row's client-minted `id` plus `onConflict: 'id'` makes replay idempotent | Dexie `db.transaction('rw', db.rounds, db.roundHoles, …)` plus one shared-`outbox` entry, queued **before** the remote call |
| Disable the turn prompt | `upsertProfileFields(user.id, { round_turn_prompt_enabled: false })` | none | **none** — bare Supabase upsert, no local write, no queue |

`saveRoundHole` (`roundRepository.js:309-323`) runs through `runQueuedMutation`: add an outbox row → write
the hole into Dexie (`cacheRoundHole`, which also patches the cached round's `round_holes` array inside
one transaction, `:62-76`) → call `upsertRoundHole` → write the remote result → delete the outbox row.
Queue-before-remote is the durability ordering `PHASE_A_ARCHITECTURE.md` § 14 requires.

The UI is optimistic and reconciles: `persist` (`:129-141`) calls `updateLocal` first so the value appears
immediately, then merges the saved row back on success (`:135`). On failure the local value stays and the
notice appears — correct, because the outbox entry is genuinely durable.

One durability hazard worth naming: the outbox payload is keyed on the row's `id`, but `round_holes`
carries `unique (round_id, hole_id)` (`supabase_schema.sql:133`) while the upsert conflict target is
`id` alone (`roundLog.js:153`). Two devices scoring the same hole offline mint two different row ids for
one `(round_id, hole_id)` pair; the second replay violates the unique constraint rather than upserting,
the entry stays queued, and `flushRoundOutbox`'s bare `catch {}` (`:351-353`) leaves it there
permanently. `PHASE_A_ARCHITECTURE.md` § 8 calls for poison state on outbox records; the shared outbox
schema has the columns (`db/dexieDb.js`) and this path does not use them.

### Offline

**This is the section's one genuinely offline-capable screen, and the one that most needs to be.**

| Concern | Behavior |
|---|---|
| Reading the round | Works. `loadRound` falls back to the Dexie cache, user-scoped. A round created offline by `round-start`'s `error.localResult` path opens normally. |
| Scoring | Works. Every `saveRoundHole` queues before it calls the remote, so the score is durable the moment it is typed. |
| Feedback | `notice-save` — `Saved on this device; it will retry when you reconnect.` Accurate, but it is prose, not one of the four § 12 calm states, and it appears only *after* a failure rather than reflecting the standing state. |
| Disc picker | Works. `useDiscList` is offline-first. |
| Turn preference | Fails silently on read; fails with a false promise on write (`turn-never`). |
| Reconnect | **Does not self-heal.** `flushRoundOutbox` runs once, on mount. There is no `online` listener on this page — `useRoundList` has one (`roundRepository.js:227-234`) but this screen does not use `useRoundList`. A player who regains signal mid-round keeps queueing locally until they navigate away and back, or open the summary. |
| No cache at all | `loadRound` rethrows → `:144` renders `<p class="form-error">` **as the entire page**, replacing live capture. `PHASE_A_ARCHITECTURE.md` § 12: "A network failure never replaces active capture with a full-screen error." The Dexie fallback makes this rare, not impossible — a round opened for the first time on a second device with no signal hits it exactly. |

## 6. Flow paths

> Provisional per ADR 0001, except Offline and Auth.

**Happy path.** Arrive from `/rounds/new` → `flushRoundOutbox` then `loadRound` resolve → `prepareRound`
builds one card per hole → type a score, tab or tap away → `updateLocal` shows it, `saveRoundHole` queues
and writes, `tb-savestate` flips to `Saving…` and back, `tb-score` updates → repeat for 18 holes →
`Finish` → `/rounds/:roundId/summary` → the button there completes the round.

`tb-savestate` is `S-SAVING`, and it is the row's **only announced instance in the app**:
`RoundScorecardPage.jsx:159` renders `Saving…`/`Autosaves` inside an `aria-live="polite"` toolbar. Every
other in-flight indicator in the codebase is silent to assistive technology. No divergence — this is the
pattern § 3's first accessibility finding asks the other screens to adopt.

**First run / empty.** A newly created round has a row per hole with `score: null`, so every card renders
with an empty score box, `tb-score` reads `— · 0 strokes`, and the page is immediately usable. There is
no distinct empty state and none is needed.

The genuinely empty case is unhandled, and **is a divergence from `S-EMPTY`** — the grid marks this route
`➖`, which is right for the newly created round above but not for this case: a round whose layout has no
holes — or a round with `layout_id: null`, which `rounds` permits on purpose
(`migrate_disc_locker_and_layouts.sql:206-207`) — produces `round.holes = []` and renders the header, the
toolbar, and an **empty `<ol>`**. No message, no explanation. Reachable from `course-detail`'s zero-hole layout path (`course-detail` § 6) and from any
future score-only import.

**Error.** Two very different behaviors:

- **Load failure with no cache** → `S-ERR-BLOCK`. Full-page `<p class="form-error">{error || 'Round not
  found'}</p>` (`:144`), no retry (`S-RETRY`), no header, no navigation but the tab bar. `Round not
  found` is house copy for the `!round` case; anything else is a raw Supabase or network string. One of
  the thirteen **unguarded** instances — the `error || !round` test has no `&& !data` clause, which is
  the same shape that bites `round-summary` harder (see that document's Error path).
- **Save failure** → `notice-save`, non-blocking, capture continues. `S-ERR-INLINE`, and the row names
  this screen the **reference pattern** for it (`:163,181` — `Disc list unavailable; scores still save
  without a disc.`). Copy that names what still works, beside content that still works. This is the
  correct shape and the screen gets it right.

Note the `S-ERR-INLINE` severity divergence still applies: `:181` describes a benign degradation and is
styled `.form-error`, so a message whose entire point is reassurance renders in `--color-negative`.

**Offline.** `S-OFFLINE-READ` — on the working side: `loadRound` reads through the Dexie cache
(`roundRepository.js:200-207`). `S-OFFLINE-WRITE` — outbox-backed and durable. As § 5: capture continues;
reconnect does not auto-flush, which diverges from the row's `createRepository` shape, where the `online`
event re-flushes the outbox.

**Diverges from `S-SYNC`.** `RoundScorecardPage.jsx:137` is the row's **fifth** and last competing
vocabulary — `Saved on this device; it will retry when you reconnect.` — a sentence rather than one of
§ 12's four labels, and distinct even from `lost-found`'s fourth-vocabulary sentence, which says
"connectivity returns" rather than "you reconnect." Neither reserves layout space. The row rates the
whole state `contract-violation` on labels, count, and layout stability; this screen contributes to all
three.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell; `S-ONBOARD` — the onboarding gate
runs first. `RoundScorecardPage.jsx:51` dereferences `user.id`. `loadRound`'s cached path checks `round.user_id`
(`roundRepository.js:98-106`); the remote path relies on RLS
(`Authenticated users manage own rounds`, `20260714150000_phase_c_round_logging_rls.sql:160`). Opening
another user's round id therefore fails at the fetch and lands in the full-page error rather than showing
`Round not found` — a small information leak in the other direction (the raw PostgREST message reveals
the row-level rejection).

**Interlock.** `fld-score` declares `min="1" max="20"` and **neither bound is enforced**:

- there is no `<form>` and no submit, so browser constraint validation never runs;
- `persist` passes `event.target.value` through untouched (`:205`);
- `localHole` (`roundRepository.js:32`) only does `Number(input.score)`;
- `round_holes.score` is a plain nullable `int` with no `CHECK` (`supabase_schema.sql:129`).

So `99`, `0`, and `-3` all save and all flow into `roundTotal` and `relativeToPar`. Contrast
`SCREEN_SPECS.md` standing divergence #6, which sets the house standard for interlocks as "app-side
disabling AND a DB `CHECK` constraint" — met by the 100-putt routine ceiling and the 35-disc bag cap, not
met here.

**Diverges from `S-INTERLOCK-CAP`.** The row surveys three ceilings and rates them `cosmetic` —
"enforced, inconsistently pre-empted." This bound is the opposite and is not in the row's tally:
*advertised and not enforced anywhere at all*, in the markup, the app layer, or the schema. An
`S-INTERLOCK-CAP` reader who assumed the row's `cosmetic` severity generalized would be wrong here; on
this screen the failure is silent data corruption of the round total. Noted in
`_corrections/state-citations-2.md`.

**Destructive.** **N/A** — the screen deletes nothing, so `S-CONFIRM` is `➖`. Two adjacent facts:

- Clearing a score to empty writes `null` (`localHole` normalizes `''` to `null`), which is a real
  unscoring with no confirmation. Appropriate for a scorecard; worth knowing it is silent.
- **A completed round remains fully editable here.** Nothing on this screen reads `round.status`, so
  arriving from `round-summary`'s `Scorecard` link on a finished round yields live inputs. Edits are
  saved to `round_holes` and **do not** update `rounds.total_score`, which `round-summary` froze at
  finish time. See `round-summary` § 12 question 2.

## 7. Dependencies

### Schema

- `rounds` — read only here (`course`, `layout`, `holes`, `round_holes` as hydrated by `fetchRound`).
  Never written by this screen; `total_score` and `status` are `round-summary`'s.
- `round_holes` — the write target: `id`, `round_id`, `hole_id`, `score`, `disc_id`, `notes`
  (`supabase_schema.sql:125-134`). `unique (round_id, hole_id)` at `:133` against an `onConflict: 'id'`
  upsert — see § 5 Writes. Owner-scoped through the parent round
  (`20260714150000_phase_c_round_logging_rls.sql:175-190`). The J1 groundwork made these rows
  sparse-nullable on purpose (`DEVELOPMENT_PLAN.md` § J1), which is what lets a partial card exist.
- `holes` — read for `hole_number`, `par`, `distance_feet`, `tee_type`.
- `discs` — read through `useDiscList` for the picker; `disc_id` FK from `round_holes`.
- `profiles.round_turn_prompt_enabled` — boolean, `not null default true`, added by
  `supabase/migrations/20260716213000_phase_d_session_context_fatigue.sql:20`. Written by `turn-never`
  here and by the Settings toggle at `SettingsPage.jsx:47`.
- `activities` — the round's lifecycle parent exists (created by `round-start`) but this screen neither
  reads nor writes it.
- Dexie `rounds`, `roundHoles`, and the shared `outbox` (`db/dexieDb.js`).

### Library

`lib/repository/roundRepository` (`loadRound`, `saveRoundHole`, `flushRoundOutbox`),
`lib/repository/discRepository` (`useDiscList`), `lib/rounds` (`roundTotal`, `relativeToPar`,
`formatRelativeToPar`), `lib/profile` (`fetchProfile`, `upsertProfileFields`), `context/AuthContext`
(`useAuth`). Signatures in [`LIB_API_INDEX.md`](../LIB_API_INDEX.md).

`sortedHoles`, `prepareRound`, `replaceRoundHole`, and `discLabel` (`:9-47`) are module-local pure
functions, **none exported and none tested**. `prepareRound` and `replaceRoundHole` in particular carry
the screen's normalization and merge logic. `T-round-scorecard-1` moves them.

### Components

**None.** No import from `src/components/`. `DEVELOPMENT_PLAN.md` § J1's **Reuse** bullet promised
"`useDiscList`/`DiscCard` for per-hole disc" — `useDiscList` shipped, `DiscCard` did not; the picker is a
plain `<select>` of strings. It also promised "secondary tasks in sheets"; no sheet is opened here, so
putter choice and notes sit inline in the capture flow rather than behind the bottom-sheet pattern
`PHASE_A_ARCHITECTURE.md` § 12 prescribes for the active shell. Filed as
[`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-4.

### Screens

- **Requires:** `round-start` — the only creator of a round.
- **Required by:** `round-summary`, which reads what this screen wrote; `rounds-root` and `courses-root`,
  whose relative-to-par cells recompute from these `round_holes`.
- **Shares state with:** `settings` (the `round_turn_prompt_enabled` toggle), `bag-manage`/`discs-root`
  (the disc list, and the unused bag snapshot).

### Contracts and decisions

- **ADR 0001 — `docs/decisions/0001-live-round-interaction-model.md`, status Proposed.** The blocking
  dependency. It asks whether live round capture is a structured scorecard (Options A and C, shipped) or
  conversational (Option B), and its Consequences section says explicitly that deferring means "the round
  screen documents carry a provisional interaction section, and E2 proceeds with a known-unstable
  foundation under it." §§ 3, 4, 6, and 8 of this document are that provisional section. **Not resolved
  here.**
- `PHASE_A_ARCHITECTURE.md` § 12 — the contract this screen most visibly diverges from: the full-page
  error over active capture, the absent calm states, and the 80pt primary-action rule against a 56px
  score input. Note § 12's field-capture clauses are written for `ActiveActivityShell`, and this screen
  is `standard` — which is itself the ADR 0001 question.
- `PHASE_A_ARCHITECTURE.md` § 14 — repository and transaction contract: `saveRoundHole` observes it;
  `upsertProfileFields` does not.
- `PHASE_A_ARCHITECTURE.md` § 8 — offline transition, including outbox poison state, which
  `flushRoundOutbox` does not implement.
- `PHASE_A_ARCHITECTURE.md` § 5 — no `round` or `hole` metric subject exists; see § 9.
- `DEVELOPMENT_PLAN.md` § E2 owns the backlog, and ADR 0001 exists because E2 would otherwise harden a
  screen whose interaction model is formally undecided.

## 8. Accessibility

> Provisional per ADR 0001 — a change of capture model would replace most of this.

Deltas from the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good:** `.scorecard-toolbar` carries `aria-live="polite"` (`:158`), so the running total and the
  save state are announced as they change. This is the best live-region usage in the COURSES section and
  the pattern the rest of the section should copy.
- **Good:** `fld-score` has both a visible `Score` label (implicit association through the wrapping
  `<label>`) and an explicit `aria-label="Score for hole <n>"`, which disambiguates 18 identically
  labelled inputs.
- **Good:** the turn prompt is an `<aside aria-label="Round turn check-in">`.
- **Good:** the hole list is an `<ol>`, conveying sequence structurally.
- **Good:** `notice-discs` states the degradation *and* what still works.
- **Gap:** `fld-disc` and `fld-notes` rely on implicit label association only — no `htmlFor`/`id` pairs,
  unlike every other form in this section. Implicit association is valid, but it is the one place the
  section breaks its own pattern.
- **Gap:** `fld-score` is 80px wide and **56px tall** (`.scorecard-input`, `App.css:683-690`) against
  § 12's 80pt primary-field-action minimum. It is the single most-used control on the app's only round
  capture screen and it is 30% under the bar.
- **Gap:** the score input is `type="number"`, which raises a spinner keyboard and allows scroll-wheel
  and arrow-key changes to a committed value. It does set `inputMode="numeric"`, which `courses-new`
  does not — the two screens disagree.
- **Gap:** `tb-savestate` says `Autosaves` whether or not anything is pending, so the live region
  announces a capability rather than a state. There is no announcement at all when a save **succeeds** —
  only the transient `Saving…`.
- **Gap:** the turn prompt appears mid-list without moving focus and without an announcement beyond the
  polite region it is not part of; a screen-reader user scrolling by hole may never encounter it.
- **Gap:** `.round-turn-prompt` has no CSS rule at all (CS-8), so it has no visual affordance
  distinguishing it from a hole card — including no reduced-motion or contrast consideration, because
  there is nothing to consider.
- **Gap:** nothing is sticky, so at 200% text scaling the running score and the `Finish` control are off
  screen for essentially the whole round, and reaching hole 18 is a long unassisted scroll past 54
  controls with no landmarks between holes.
- **App-wide, not a screen delta:** two `h1` elements per page — the shell's and this page's.

## 9. Events and telemetry

**No metrics, no notifications, and — notably — no lifecycle events.**

The round's lifecycle parent is created and (conditionally) started by `round-start`
(`roundRepository.js:127-162`) and finalized by `round-summary` (`finalizeRoundActivity`). This screen,
which is where all the actual activity happens, writes nothing to the lifecycle at all:

- no `first meaningful fact` event when the first score is entered — the reason
  `ACTIVITY_STATE_REASONS.FIRST_MEANINGFUL_FACT` is used is at round *creation* time instead
  (`roundRepository.js:152`);
- no `paused` event when the user navigates away, because
  `useActivityNavigationLifecycle` only watches the `active` shell (§ 2);
- no `resumed` event when they come back.

So a round's lifecycle history (`PHASE_A_ARCHITECTURE.md` § 2) records creation and finalization with
nothing in between, even for a round played over three hours with six app switches.

**Metrics:** `PHASE_A_ARCHITECTURE.md` § 5 anticipates `round` and `hole` subjects "with their capture
features"; `src/lib/metrics/registry.js` declares only `player`, `routine`, `session`, and
`physical_disc`. `roundTotal` and `relativeToPar` are computed inline for display and are not registered
metrics — which is also why the per-disc performance panel on `disc-detail` reads round holes directly
through `discProfileRepository` rather than through a metric.

**Notifications:** none produced or consumed (`PHASE_A_ARCHITECTURE.md` § 7).

## 10. Tests

### Existing coverage

**Partial, at the pure-function layer only.** Confirmed by reading every import of
`RoundScorecardPage.jsx`:

| Import | Test file | Covers this screen? |
|---|---|---|
| `lib/rounds` (`roundTotal`, `relativeToPar`, `formatRelativeToPar`) | `src/lib/rounds.test.js` | Yes — 4 tests, 32 lines |
| `lib/repository/roundRepository` (`loadRound`, `saveRoundHole`, `flushRoundOutbox`) | **absent** | — |
| `lib/repository/discRepository` (`useDiscList`) | **absent** | — |
| `lib/profile` (`fetchProfile`, `upsertProfileFields`) | **absent** — no `src/lib/profile.test.js` | — |
| `context/AuthContext` | absent | — |

[`TEST_MAP.md`](../TEST_MAP.md):66 records `round-scorecard` → `rounds`, noting "`roundTotal`,
`parTotal`, `relativeToPar`, `formatRelativeToPar` only." Exactly right, and it deserves restating in
full because this is the app's live round capture surface:

**`src/lib/rounds.test.js` is 32 lines and is the entire automated verification of disc golf round
scoring.** It covers four pure functions against literal arrays. It does not touch a repository, a Dexie
transaction, an outbox, a component, or a rendered pixel.

Unverified at any layer, in rough order of what would hurt most:

1. **`saveRoundHole`'s queue-then-write-then-delete ordering** — the guarantee that a score typed offline
   survives an app kill. Nothing asserts the outbox entry exists before the remote call.
2. **`flushRoundOutbox`'s replay**, including its bare `catch {}` and the duplicate-`(round_id, hole_id)`
   poison scenario in § 5.
3. **`prepareRound`** — hole sorting, row synthesis, orphan-row preservation. Module-local and untested.
4. **`replaceRoundHole`** — the optimistic merge that every keystroke depends on.
5. **`loadRound`'s cache fallback** and its `user_id` check.
6. **`frontNineComplete`** (`:97-103`) — including its `row?.score !== null` treatment of a missing row
   as complete, which is currently unreachable only because `prepareRound` guarantees a row exists.
7. Every rendering branch: full-page error, empty hole list, turn prompt, disc-list degradation.
8. The unenforced 1–20 score bounds.

### Acceptance criteria

1. Entering `4` on a par-3 hole updates `tb-score` to `+1` and the stroke total to `4`, immediately, on
   change — before the save resolves.
2. A round with no scores shows `— · 0 strokes`.
3. Clearing a score to empty writes `null` and removes that hole from both derived values.
4. Blurring the score field writes exactly one `round_holes` row; blurring again with no change writes
   again (current behavior) or is debounced (decide — § 12 question 4).
5. Changing the disc saves immediately without waiting for blur.
6. With the network down, a typed score persists locally, `notice-save` appears, and the score is still
   present after a full page reload.
7. That queued score is written to Supabase exactly once when connectivity returns — **without the user
   navigating away and back.** *Currently fails* — no `online` listener on this page.
8. Two devices scoring the same hole offline reconcile to one row on reconnect. *Currently fails* — the
   second replay violates `unique (round_id, hole_id)` and stays queued forever.
9. Opening a round with no cache and no network shows an error **that does not remove the scorecard**.
   *Currently fails* — full-page error.
10. A round whose layout has zero holes explains itself rather than rendering an empty list. *Currently
    fails.*
11. Entering `99` is rejected or clamped. *Currently fails* — it saves.
12. Completing the front nine shows the turn prompt **styled**, once; `Got it` dismisses it for the
    round, not just for the mount. *Currently fails on both counts.*
13. `Don't show this again` persists across devices, or says so honestly when it cannot. *Currently
    fails* — the copy promises a retry that does not exist.

### E2E critical paths

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never built).
This screen supplies the section's highest-priority candidates — it is the only place in COURSES where a
silent break loses user data, which is `TEST_MAP.md`'s own Priority 1 criterion:

1. **Score offline → reconnect → exactly one write, no duplicates.** The round analogue of
   `TEST_MAP.md` E2E backlog item 2, which currently covers only putts.
2. **Score three holes → kill the tab → relaunch → the three scores are present.** The round analogue of
   backlog item 1.
3. Full round: quick course → start → score 18 holes → finish → totals match `rounds.test.js`
   arithmetic. Backlog item 4, end to end.
4. Start a round, navigate to PLAY, navigate back → assert the scores are intact and assert what the app
   offered as a way back (the CS-6 regression guard).
5. Complete the front nine → assert the turn prompt appears, is styled, and dismisses.

## 11. Tasks

E2 (`DEVELOPMENT_PLAN.md` § E2) owns these. **Tasks marked ⏸ must not be scheduled before ADR 0001
closes** — they change the capture surface the ADR is deciding about.

#### T-round-scorecard-1 — Extract and test the scorecard's normalization logic

- **Capability:** `pure-logic`
- **Touches:** `src/lib/rounds.js` (or a new `src/lib/scorecard.js`), `src/lib/rounds.test.js`,
  `src/pages/RoundScorecardPage.jsx`
- **Done when:** `sortedHoles`, `prepareRound`, `replaceRoundHole`, and `frontNineComplete` are exported
  pure functions with unit tests covering hole sorting by number then tee type, row synthesis, orphan-row
  preservation, the optimistic merge, and the front-nine predicate including its missing-row case; the
  page imports them.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `refactor: extract and test scorecard hole normalization`
- **Note:** safe under any ADR 0001 outcome — the data normalization survives a change of capture UI.

#### T-round-scorecard-2 — Flush the round outbox on reconnect

- **Capability:** `sync`
- **Touches:** `src/pages/RoundScorecardPage.jsx` or `src/lib/repository/roundRepository.js`
- **Done when:** regaining connectivity while the scorecard is open flushes queued hole writes without
  navigation, and `tb-savestate` reflects the transition; the listener is removed on unmount.
- **Verify:** `npm test` with a `roundRepository` test dispatching an `online` event; manual
  offline → score → online check in `npm run dev`.
- **Commit:** `fix: flush queued scores when connectivity returns`
- **Note:** the highest-severity item on this screen. `useRoundList` already has exactly this listener
  (`roundRepository.js:227-234`); the capture screen does not.

#### T-round-scorecard-3 — Give the round outbox a poison path

- **Capability:** `sync`
- **Touches:** `src/lib/repository/roundRepository.js`, possibly `src/lib/db/dexieDb.js`
- **Done when:** `flushRoundOutbox`'s bare `catch {}` records attempt count, last error class, next retry,
  and poison state on the outbox row per `PHASE_A_ARCHITECTURE.md` § 8; a hole write that can never
  succeed (duplicate `(round_id, hole_id)` from two devices) is surfaced as `Needs Attention` rather than
  retried forever in silence.
- **Verify:** `npm test` with a case forcing a unique-constraint rejection; assert the row is marked, not
  looped.
- **Commit:** `fix: mark unreplayable round writes instead of retrying silently`
- **Blocked by:** `T-round-start-2` (the `roundRepository.test.js` this needs).

#### T-round-scorecard-4 — Style the turn prompt, or remove it

- **Capability:** `ui-routine`
- **Touches:** `src/App.css`, `src/pages/RoundScorecardPage.jsx`
- **Done when:** `.round-turn-prompt` has a rule consistent with the Sun-Drenched Topo tokens
  (`AGENTS.md` § Design system), `Got it` persists per round rather than per mount, and
  `Don't show this again`'s failure copy stops promising a retry that does not exist.
- **Verify:** `npm run lint` plus a visual check after completing a front nine; VoiceOver pass on the
  aside.
- **Commit:** `fix: style and persist the round turn check-in`
- **Note:** the feature ships behind a Settings toggle and a profile column and has never had a
  stylesheet rule. Filed as [`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-8.

#### T-round-scorecard-5 — Bound the score input

- **Capability:** `pure-logic`
- **Touches:** `src/lib/rounds.js`, `src/pages/RoundScorecardPage.jsx`, possibly a migration
- **Done when:** a score outside 1–20 is rejected with a stated reason rather than saved, and a
  `CHECK` constraint backs it — matching the interlock standard in `SCREEN_SPECS.md` standing divergence
  #6.
- **Verify:** `npm test` for the client bound; negative SQL test for the constraint.
- **Commit:** `fix: enforce the per-hole score bounds`
- **Note:** the migration must tolerate any existing out-of-range rows; schema files are append-only.

#### T-round-scorecard-6 — Keep capture on screen when a load fails

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundScorecardPage.jsx`
- **Done when:** a failed `loadRound` with no cache renders an error **and a retry** without removing the
  header, satisfying `PHASE_A_ARCHITECTURE.md` § 12's "a network failure never replaces active capture
  with a full-screen error"; a genuinely missing round says `Round not found` with a link to `/rounds`.
- **Verify:** `npm test` with a page-level test rejecting `loadRound` once then resolving.
- **Commit:** `fix: do not replace the scorecard with a full-screen error`

#### T-round-scorecard-7 — Explain a round with no holes

- **Capability:** `ui-routine`
- **Touches:** `src/pages/RoundScorecardPage.jsx`
- **Done when:** a round whose `holes` array is empty renders a message naming the cause (no layout, or a
  layout with no holes) and a route to fix it, instead of an empty `<ol>`.
- **Verify:** `npm test` with a page-level test for `layout_id: null` and for a zero-hole layout.
- **Commit:** `fix: explain a round with no holes`
- **Note:** pairs with `T-course-detail-2` and `T-round-start-4`, which block the same dead end earlier.

#### ⏸ T-round-scorecard-8 — Meet the field-ergonomics contract for score entry

- **Capability:** `ui-interaction`
- **Touches:** `src/pages/RoundScorecardPage.jsx`, `src/App.css`, possibly `src/lib/routeMetadata.js`
- **Done when:** the score control meets the 80pt primary-action minimum, the running total and the
  finish control stay in viewport, and a keyboard is not required to enter a score — per
  `PHASE_A_ARCHITECTURE.md` § 12 and the zero-typing principle.
- **Verify:** `npm run build` plus owner field verification: one thumb, direct sunlight, 320px width,
  200% text.
- **Commit:** `feat: make round score entry meet the field ergonomics contract`
- **Blocked by:** **ADR 0001.** This task chooses the capture surface. Do not start it before the ADR
  closes.
- **Note:** carries `field-verify` as a second capability — the acceptance is owner-executed on device.

#### ⏸ T-round-scorecard-9 — Use the round's bag snapshot in the disc picker

- **Capability:** `data-access`
- **Touches:** `src/pages/RoundScorecardPage.jsx`, `src/lib/repository/bagHistoryRepository.js`
- **Done when:** the per-hole picker offers the discs recorded in the round's `bag_version_id` snapshot,
  with the full locker available as a deliberate secondary choice; retired, lost, and sold discs no
  longer appear by default.
- **Verify:** `npm test` covering a round with and without a `bag_version_id`; manual check with a
  retired disc.
- **Commit:** `feat: pick per-hole discs from the round's bag snapshot`
- **Blocked by:** **ADR 0001** (Option B would relocate the picker entirely) and § 12 question 3.

## 12. Open questions

1. **`Finish` does not finish anything.** The header control is a `Link` to the summary
   (`:153-155`); the round's `status` and `total_score` are written only by the summary page's own button
   (`RoundSummaryPage.jsx:58-83`). A player who taps `Finish` and then closes the app leaves the round
   `in_progress` forever. Either rename it (`Review`, `Summary`) or make it finalize.
2. **Editing a completed round silently desynchronizes it.** Nothing here reads `round.status`, so a
   finished round is fully editable, and `round_holes` edits never update the frozen
   `rounds.total_score`. `rounds-root` then shows a recomputed relative-to-par beside a stale total. See
   `round-summary` § 12 question 2 — one decision covers both screens.
3. **The bag snapshot captured at round start is never used.** `round-start` runs a
   `capture_bag_version` RPC for every round with a bag selected, and this screen offers the entire
   locker instead, unfiltered by status. Either the picker should honor the snapshot (`T-round-scorecard-9`)
   or the capture is dead weight on the create path — including on the offline path it currently breaks
   (`round-start` § 5).
4. **Three save timings and no debounce.** Score and notes save on blur; disc saves on change; nothing is
   debounced, so tabbing through 18 holes issues 18 writes even where nothing changed. Settle the
   save policy once, together with what `tb-savestate` should say.
5. **What is the round's lifecycle supposed to record?** Today: created, then finalized, with nothing in
   between (§ 9). No pause on navigation, no first-fact event on the first score, no resume. If a round
   is a first-class activity — and `rounds_activity_owner_fkey` says it is — its history should look like
   one. Related to `round-start` § 12 question 1.
6. **Should this screen use the `active` shell?** It is the app's only field-capture surface on the
   `standard` shell, which is why § 12's field clauses do not formally bind it and why nothing on it is
   sticky. This is a restatement of ADR 0001's core question in shell terms, and `T-round-scorecard-8`
   depends on the answer. **Not decided here.**

Filed corrections touching this screen:
[`_corrections/courses-screens.md`, now `CORRECTIONS_LEDGER.md`](../CORRECTIONS_LEDGER.md) CS-1 (`preserveNestedState` and
the shared scroll key), CS-3 (`STATE_MATRIX.md`, since resolved), CS-4 (§ J1's `DiscCard`/sheets reuse claim),
CS-5 (`TEST_MAP.md` rows), CS-6 (the PLAY hero mislinks the round this screen is capturing), CS-7
(activity pill), CS-8 (`.round-turn-prompt` has no CSS).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no disc golf
round scorecard; `/rounds/:roundId` shipped as `DEVELOPMENT_PLAN.md` § J1 on 2026-07-14, ahead of
`PRODUCT_ROADMAP.md` Phase E by owner decision.

**Blueprint Screen 8 is not this screen, despite its name.** *Rapid-Fire Scoring Canvas & Mid-Round
Swaps* (`SCREEN_SPECS.md:217`) is the **putting practice** capture canvas — it shipped under PLAY as
`FreeformLogPage` and `RegimenRunPage` on the `active` shell, with `TapZone`, `PanicZone`,
`StackTracker`, and `CanvasToolbar` (`_corrections/screen-specs-and-agents.md` C-1). Its "mid-round"
means mid-practice-session. This screen shares no component and no library module with it. The two are
routinely conflated in `SCREEN_SPECS.md` and `DEVLOG.md` language, which is worth knowing before reading
either.

That conflation has a real cost, and it is arguably the reason ADR 0001 exists: the app has two capture
surfaces built to two different standards. The practice one uses the `active` shell, gesture and tap
input, sheets for secondary tasks, an outbox with crash recovery, and is the most heavily tested surface
in the app (`TEST_MAP.md`:38). The round one is a scrolling form of number inputs with 32 lines of test
coverage. Nothing decided that; it is what J1 shipped in a jump-ahead session, and ADR 0001 is the first
document to ask whether it is right.

**Screen 14, Course Practice Hubs & Leaderboards** — `PARKED (Social)` — and **Screen 13, UDisc
Ingestion** — unbuilt — are the two blueprint screens that would write to the same tables. Screen 13's
imported rounds arrive with `round_holes` already populated and never pass through this screen, which is
why its `external_source`/`external_ref` dedupe path
(`disc_locker_and_layouts_schema.sql:117-119`) matters more than anything on this page.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only additive schema — why `round_holes` is
sparse-nullable and why `rounds.layout_id` may be null), #5 (**PLAY / DISCS / COURSES / ME**), and #6
(the interlock standard this screen's 1–20 score bound does not meet) apply; see `SCREEN_SPECS.md`
§ Standing divergences.
