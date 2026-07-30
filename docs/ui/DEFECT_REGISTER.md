# Defect Register

The consolidated, ranked list of **code defects** found during the 33-screen documentation pass. It
exists because the findings were scattered across 33 screen documents (§ 6 Flow paths, § 10 Tests,
§ 12 Open questions), thirteen files that were quarantined under `_corrections/` (now applied and
cleared — dispositions in [`CORRECTIONS_LEDGER.md`](CORRECTIONS_LEDGER.md)), and
[`STATE_MATRIX.md`](STATE_MATRIX.md) § 2 and § 5 — a shape in which nobody can act on them. This is
the single artifact an engineer or an agent works from.

| | |
|---|---|
| Verified against | `8ee0ac9` (branch `claude/ui-documents-status-3fphcw`) |
| Compiled | 2026-07-29 |
| Defects registered | 24 |
| Live-database verification | **none** — see § 5 |

---

## 1. What belongs here, and what does not

**A code defect is registered here. Documentation drift is not.**

| | Belongs here | Belongs in `_corrections/` |
|---|---|---|
| The software misbehaves | ✅ | |
| A document describes the code wrongly | | ✅ |
| A document is wrong **and** the code is also wrong | ✅ — the code half only | ✅ — the doc half only |

So `SCREEN_SPECS.md:304` naming a `profiles.current_rating` column that does not exist is drift — it was
filed as `_corrections/me-screens.md` C-2, has since been applied to `SCREEN_SPECS.md`, and its
disposition is in [`CORRECTIONS_LEDGER.md`](CORRECTIONS_LEDGER.md). `CareerHubPage.jsx` *reading*
that column is a defect and is registered as `D-08`. The same split applies to the 35-disc interlock,
the guest-conversion surface, and the `/notifications` route.

Deliberate product gaps are also excluded. "No hole editor exists" and "goal cards are not persisted
because nothing was ever built to persist them" are unbuilt scope, not misbehaviour — except where the
UI already promises the capability, which is the line `D-14` and `D-15` sit on.

**Every entry below was opened and read against source before it was registered.** Two claims from the
source documents did not survive that check and are recorded as rejected in § 6 rather than propagated.

## 2. Severity scale

Four levels, applied in this order. Where [`STATE_MATRIX.md`](STATE_MATRIX.md) § 2 already rates a
row, that rating is carried through and named in the entry.

| Severity | Meaning | `STATE_MATRIX.md` equivalent |
|---|---|---|
| `data-loss` | A user's captured work is destroyed, stranded, or permanently unrecoverable through any UI | `data-risk` |
| `broken-feature` | A shipped surface cannot perform its stated function at all | (usually `contract-violation`) |
| `degraded` | The surface works, but wrongly, misleadingly, or only on some paths | `contract-violation` / `cosmetic` |
| `latent` | Correct today, but one plausible change away from breaking, with no test holding the line | — |

**Ordering.** Rows are grouped by severity tier, most severe first, and ranked by user impact within
each tier. Impact means "how many users hit it, how badly, and how easily can they recover" — not how
interesting the bug is.

**One caveat on the ordering.** `D-05` is labelled `broken-feature` because nothing the user had
already entered is destroyed — but for a player standing on a course with no signal it is the single
highest-consequence defect in this document. If only one thing is fixed, fix `D-05`.

---

## 3. The register

### `data-loss`

| id | Severity | Summary | Evidence | Screens | How it fails for a user | Documented in full |
|---|---|---|---|---|---|---|
| `D-01` | `data-loss` | Offline fatigue check-ins have no outbox and are never retried or shown | `src/lib/repository/fatigueCheckinRepository.js:5-10`, `:18` | `freeform-active`, `regimen-active` | You answer the mid-session fatigue prompt while offline. It writes to Dexie, the insert fails, and nothing ever retries it. Both call sites discard the `pending` return value, so no badge appears. A later *successful but empty* remote read (`data ?? local` returns `[]`) hides the local row too. The check-in is gone. | `STATE_MATRIX.md` § 5 gap 4 (`data-risk`), `S-OFFLINE-WRITE` |
| `D-02` | `data-loss` | The single-active interlock is fully built and never reaches the UI, so capture proceeds against an unmirrored activity | `src/lib/repository/activityRepository.js:330-396`, `src/hooks/useInstantLaunchSession.js:92-102`, `src/lib/instantLaunch/activityBridge.js:111-127` | `play-root`, `freeform-active`, `regimen-active`, `round-scorecard`, `practice-history` | You start a putting session while a round is live. No dialog appears, the new activity records no lifecycle start, and InstantLaunch keeps capturing putts against an activity the lifecycle mirror does not know about. The two diverge silently. | `STATE_MATRIX.md` § 5 gap 1 (`data-risk`), `S-INTERLOCK-ACTIVE`; `_corrections/state-matrix.md` C-3 |
| `D-03` | `data-loss` | A round started while another activity is current keeps a `draft` lifecycle parent, so it can never be finalized and never reaches a weekly report | `src/lib/repository/roundRepository.js:127-162`, `:174-183`; `src/lib/repository/weeklyReportRepository.js:6`, `:36-38` | `round-start`, `round-summary`, `weekly-reports`, `rounds-root` | You play and complete a full round. `rounds.status` reads `completed` and every screen shows it as finished — but its activity parent is stuck in `draft`, `finalizeRoundActivity` refuses to act on a draft, and the weekly report admits only `completed` activities. The round is permanently invisible to reports, with no UI able to repair it. | `screens/round-start.md` § 5 and § 12 q1; `screens/weekly-reports.md` § 12 q5; `screens/round-summary.md` § 12 q1 |
| `D-04` | `data-loss` | Onboarding provisions the default bag before the disc, and it is untransacted, so any partial failure makes every retry violate `bags_one_default_per_user` | `src/components/onboarding/PutterStep.jsx:36-53`, `:76`; `bags_schema.sql:27-28` | `onboarding` | `Confirm & Continue` creates the Practice Stack bag (`is_default: true`), then the disc, then the membership. If step 2 or 3 fails, the bag survives. Tapping the button again re-runs `createBag`, which now collides with the one-default-per-user unique index, and the wizard shows a raw Postgres string. There is no path forward in place; reloading drops you into the app with an empty bag and no putter. | `screens/onboarding.md` § 6 Error, § 12 q3 and q4; `_corrections/preshell-screens.md` "Not corrections" (§ 14 scoping) |

### `broken-feature`

| id | Severity | Summary | Evidence | Screens | How it fails for a user | Documented in full |
|---|---|---|---|---|---|---|
| `D-05` | `broken-feature` | Offline round start fails outright whenever a bag is selected — which is the default | `src/lib/repository/roundRepository.js:249-258` against `:265-279`; `src/lib/repository/bagHistoryRepository.js:23-34`, esp. `:28` | `round-start` | The bag-version step runs **before** the `try` that attaches `error.localResult`. `captureBagVersion` is a bare RPC and always fails offline; `loadBagVersions` rethrows when the Dexie cache is empty. The error escapes `mutationFn` with no `localResult`, so `RoundStartPage.jsx:107-112` cannot take its offline branch: no outbox row, no local round, no round at all. Because `Bag (optional)` preselects the default bag, this is the default path — a player at a course with no signal cannot start a round unless they think to set the bag select to `No bag selected`. | `screens/round-start.md` § 5 Offline; `screens/round-scorecard.md` § 12 q3 |
| `D-06` | `broken-feature` | `AppShell` passes `toast={null}`, so no toast can ever render | `src/components/AppShell.jsx:123`; `src/components/ToastHost.jsx:2` | all shell routes | The prop is a literal `null`, not state. There is no toast context, queue, or setter anywhere in the app. Navigating away from active capture pauses the session and tells you nothing; auto-closing a practice tells you nothing. Pages have substituted inline `notice` paragraphs that are not transient, are not announced from a shell live region, and scroll away with the page. | `STATE_MATRIX.md` § 5 gap 6 (`contract-violation`), `S-TOAST`, `S-PAUSE`; `_corrections/state-matrix.md` C-1 |
| `D-07` | `broken-feature` | In-app account deletion cannot succeed — the RPC it calls is not deployed | `src/context/AuthContext.jsx:39`; `supabase/migrations/20260727120000_phase_e_account_deletion.sql:34`; `docs/development/CURRENT_WORK.md:104-108` | `settings` | Typing `DELETE` and tapping `Permanently delete` calls `supabase.rpc('delete_own_account')`, whose migration is written but **not applied**, so it returns an undefined-function error and `DeleteAccountPanel.jsx:98` renders `Account not deleted: …`. This is an App Store Guideline 5.1.1(v) blocker that `docs/mobile/IOS_READINESS.md:19` lists as fixed. The one mercy: server-first ordering means `purgeDeviceData` never runs, so nothing local is destroyed. | `screens/settings.md` § 12 q1; `_corrections/me-screens.md` C-3 |
| `D-08` | `broken-feature` | `CareerHubPage` reads `profile.current_rating`, a column that does not exist; the real one is `pdga_rating`, which nothing in `src/` writes | `src/pages/CareerHubPage.jsx:24`, `:25`, `:41`; `layer1_foundation_schema.sql:50` | `me-root`, `profile-details` | `grep -rn "current_rating" --include=*.sql .` matches nothing; `grep -rn "pdga_rating" src/` also matches nothing. So `Current` always renders `—`, `ratingProgress` is always `null`, the progress bar always has `width: 0%`, and its `aria-label` always reads `Rating progress unavailable`. Fixing the read is not enough — the field has no entry point anywhere, so the headline element of blueprint Screen 11 cannot function either way. | `screens/me-root.md` § 12 q1; `_corrections/me-screens.md` C-2 |
| `D-09` | `broken-feature` | `/notifications` has no in-app entry point | `src/App.jsx:68`; `src/lib/routeMetadata.js:83-90`; `src/components/AppShell.jsx:95-110`; `src/lib/notifications.js:24-30` | `notifications` | The global header bell opens a sheet, not the page. `notificationDestination()` routes notifications to `/practice/history/*` and `/profile`, never to `/notifications`. The only non-test occurrences of the string in `src/` are the route definition and its metadata. The route is reachable only by typed URL, bookmark, or external deep link — while `PHASE_A_ARCHITECTURE.md:206-208` lists it among canonical destinations. | `screens/notifications.md` § 12 q2; `_corrections/play-screens.md` P-4 |
| `D-10` | `broken-feature` | Guest→account conversion ships complete and is unreachable, so every guest is permanently a guest | `src/context/AuthContext.jsx:24`, `:59-62`; `src/pages/AuthPage.jsx:112-119`; `src/components/ProtectedRoute.jsx:8` | `login`, `me-root`, `settings`, `root` | `isGuest` has exactly one consumer — `AuthPage` itself — and nothing navigates a signed-in user to `/login`. `ProtectedRoute` redirects only when `!user`, and a guest *is* a user. Neither Settings nor ME nor Profile offers a conversion affordance. `SplashPage.jsx:49` promises "save progress later" and nothing ever follows up. | `screens/login.md` § 12 q1; `_corrections/preshell-screens.md` C-3 |
| `D-11` | `broken-feature` | The weekly report is never generated automatically, never notified, and its notification points at the wrong screen | `src/lib/repository/weeklyReportRepository.js:79`; `src/lib/notificationProducers.js:5`, `:21`; `src/lib/notifications.js:28` | `weekly-reports`, `notifications`, `settings` | Three independent gaps in one feature. `generation_reason` is only ever written as `manual` or `correction_regeneration` — never `scheduled`, which is the column's own default — and `supabase/functions/` does not exist, so a user who never taps `Generate last week` never has a weekly report. No producer emits a `weekly_report` notification. And if one existed, `notificationDestination` sends it to `/profile` (`me-root`) rather than `/profile/reports`. Meanwhile Settings offers a `Weekly report` toggle for a notification that cannot occur. | `screens/weekly-reports.md` § 12 q1-q2; `_corrections/me-screens.md` C-5 |
| `D-12` | `broken-feature` | The PLAY dashboard hero mislinks an in-progress round to the freeform putting canvas | `src/pages/PracticeMenuPage.jsx:164`; `src/lib/dashboardHero.js:15-23` | `play-root`, `round-scorecard`, `round-start` | `heroCardState()` returns `active-activity` for **any** active activity, including `disc_golf_round`. The destination expression has only a `putting_regimen` branch and an `else`, so a player with a round in progress sees "▶️ Resume active practice" on `/practice` and tapping it opens the freeform canvas instead of their scorecard. The round id is available without a schema change — `ensureRoundActivity` uses the round id as the activity id. | `screens/round-start.md` § 5; `_corrections/courses-screens.md` CS-6 |
| `D-13` | `broken-feature` | The header activity pill can never advertise a round | `src/components/AppShell.jsx:42-47`; `src/components/GlobalHeader.jsx:16` | all seven COURSES routes | `activeHref` is computed only for `putting_regimen` and `putting_freeform`; every other type yields `null`, and `GlobalHeader` renders the pill only when `activeHref` is truthy. All seven COURSES routes set `showActivityPill: true` and all seven can be visited with a live `disc_golf_round` — so the flag is inert for the case it most needs to cover. The hardcoded `aria-label="Resume active practice"` would be wrong for a round even if the link existed. | `_corrections/courses-screens.md` CS-7 |
| `D-14` | `broken-feature` | The `Community benchmark` comparison source can never activate | `src/pages/DiscComparePage.jsx:114` | `disc-compare` | `resolveCommunityCohort([])` is called with a hard-coded empty array, so the source is always `not ready`. The button is always pressable, always shows the unavailability notice, and always falls back to official catalog numbers. The fallback is exactly as designed; no cohort source was ever wired to it. | `screens/disc-compare.md` § 12 q1 |
| `D-15` | `broken-feature` | The onboarding Step-1 goal is captured, gated on, and discarded | `src/pages/OnboardingPage.jsx:17`, `:28`; `src/lib/onboarding.js` | `onboarding` | The wizard requires a goal selection before `Continue`, holds it in `useState`, passes it to `GoalStep`, and never reads it again. No column, table, `localStorage` key, or repository call takes it. The blueprint's intent — tag the profile to customize default dashboard layouts — is unimplemented, so the screen asks a mandatory question and throws the answer away. | `screens/onboarding.md` § 12 q1; `_corrections/preshell-screens.md` C-1 |
| `D-16` | `broken-feature` | `Finish` on the scorecard finalizes nothing | `src/pages/RoundScorecardPage.jsx:153-155`; `src/pages/RoundSummaryPage.jsx:58-83` | `round-scorecard`, `round-summary`, `rounds-root` | The header control is a `<Link>` to the summary. `rounds.status` and `total_score` are written only by the summary page's own `Finish round` button. A player who taps `Finish`, sees their scores, and closes the app leaves the round `in_progress` forever — and, via `D-03`'s mechanism, its activity never finalizes either. | `screens/round-scorecard.md` § 12 q1 |

### `degraded`

| id | Severity | Summary | Evidence | Screens | How it fails for a user | Documented in full |
|---|---|---|---|---|---|---|
| `D-17` | `degraded` | `OtpInput.setDigit` relocates digits typed into non-adjacent boxes | `src/components/OtpInput.jsx:10-14` | `login` | `setDigit` pads `value` to `length` with spaces, writes the indexed character, then strips **all** spaces — so index position is not preserved. With `value = "12"`, typing into box 5 yields `"129"`: the digit lands at index 2. The same collapse happens on backspace into a middle box (`:26`, `:29`), which shifts every later digit left. Sequential entry with auto-advance never triggers it; tapping back to correct one box, and any assistive-technology navigation that jumps boxes, does. | `screens/login.md` § 12 q4 |
| `D-18` | `degraded` | Queued offline Lost & Found cases are invisible, because the read path is network-only even though the write path is not | `src/pages/LostFoundPage.jsx:61-74`; `src/lib/repository/lostFoundRepository.js:132-150` | `lost-found` | `loadLostFoundCases` correctly merges Dexie-queued cases, but `load()` awaits it inside a `Promise.all` alongside `fetchUserDiscs` and `fetchCourses`, both of which are Supabase-only. Offline, the `Promise.all` rejects and the merged result never reaches state. You file a case in the field, it is durably queued, and the screen tells you nothing exists. | `screens/lost-found.md` § 12 q4 |
| `D-19` | `degraded` | Bag membership can be added from two surfaces with no capacity guard, so the 35-disc trigger surfaces as a raw Postgres string | `src/pages/BagLockerPage.jsx:74-89`; `src/pages/DiscDetailPage.jsx` bag chips; `layer1_foundation_schema.sql:230-253` | `disc-collection`, `disc-detail`, `discs-root`, `bag-manage` | The database **does** enforce the cap — `enforce_bag_capacity()` is a row-locking `before insert` trigger on `bag_discs` — but `/bag/locker?addToBag=` and the `disc-detail` bag chips call `addDiscToBag` with no pre-check and surface `err.message` verbatim. Worse, the trigger counts **every** `bag_discs` row while `/bag`'s readout counts `in_locker` members only, so a bag with 5 lost discs displays `30 / 35` and still rejects the next insert. Four surfaces count three different ways. | `screens/disc-detail.md` § 12 q1 (resolved); `screens/discs-root.md` § 12 q1; `_corrections/capture-screens.md` C-9 + ADJUDICATION — **and see § 6 below** |
| `D-20` | `degraded` | `RegimenSelectPage` does not filter archived routines, and surfaces unrunnable orphans | `src/pages/RegimenSelectPage.jsx:16-18`, `:22`; `src/lib/regimens.js:3-19`, `:39-41`, `:56-65`; `src/lib/repository/regimenRepository.js` | `regimen-select`, `routine-builder` | Archiving is the project's soft delete for routines and `PracticeMenuPage.jsx:127` honours it; this screen does not — neither `regimenRepository.list` nor `fetchRegimensWithSets` applies an `archived` predicate, and the filtered fetch `fetchCustomRegimens` has no caller. Compounding it: when a set insert fails, `createCustomRegimen` archives the just-created parent as cleanup, so that zero-set orphan is invisible on `play-root` and **visible and launchable** here, where `validateDrillConfig` will reject it. | `_corrections/play-screens.md` P-6 |
| `D-21` | `degraded` | The 100-putt ceiling gates `Add next stage` but not `Save`, so an over-cap routine submits | `src/pages/RoutineBuilderPage.jsx:100`, `:160-162`; `src/components/routineBuilder/StageCard.jsx:28-33`; `src/lib/routineBuilder.js:31-36` | `routine-builder` | `canAddStage` disables one button. The per-stage putt stepper is a free `ChipGroup` over `[5,10,15,20]` with no cap awareness, and `saveDisabled` is `saving \|\| !name.trim() \|\| stages.length === 0` — it never reads `putts`. Ten stages × 10 putts, then tap `20` on each: 200/100 putts, a red totalizer the page explicitly renders, and both Save buttons enabled. The only remaining guard is the DB trigger, whose behaviour on this write path is unverified (see `D-24`). | `screens/routine-builder.md` § 12 q1; `_corrections/play-screens.md` P-2 |
| `D-22` | `degraded` | A retried course create mints fresh UUIDs, producing a duplicate that nobody can delete | `src/lib/roundLog.js:203-204`; `20260714150000_phase_c_round_logging_rls.sql` (no delete policy) | `courses-new`, `courses-root` | `saving` guards a double-tap within one attempt, but each call to `handleSubmit` mints new `courseId`/`layoutId`. A submit that times out after the server committed, followed by the user pressing the button again, produces two identical courses — both community-visible to every user and, with no delete policy on `courses`, permanent. `createRepository.useCreate`'s mount-stable `clientId` is the pattern that would fix it. | `screens/courses-new.md` § 12 q2 |
| `D-23` | `degraded` | Every instance of a parameterized route shares one scroll key, so one record's scroll offset is restored onto another's | `src/components/AppShell.jsx:52-61`; `src/lib/routeMetadata.js` (`scrollKey` is a static string per route) | `course-detail`, `disc-detail`, `round-scorecard`, `round-summary`, `practice-history-detail` | `scrollPositionsRef` is keyed solely on `route.scrollKey`, which is a fixed string like `courses-detail`. Scroll `/courses/course-a`, return to `/courses`, open `/courses/course-b` — and course B opens at course A's offset, frequently mid-page or past the end of a shorter record. Separately, `preserveNestedState` is declared on all 30 shell routes and asserted in tests but is **never read by runtime code**, so the field promises behaviour nothing implements. | `_corrections/courses-screens.md` CS-1 |
| `D-24` | `degraded` | Notification failures are indistinguishable from "all caught up" | `src/hooks/useNotifications.js:28`, `:31` | `notifications`, all shell routes (badge) | The producer/sync chain ends in `.catch(() => {})` and `notificationRepository.observe`'s error callback sets `[]`. A failure to produce, flush, or pull notifications renders the same empty list and the same zero badge as a genuinely empty inbox. `PHASE_A_ARCHITECTURE.md` § 7 requires actionable items to badge; a swallowed failure cannot badge. | `STATE_MATRIX.md` `S-ERR-SILENT` (`data-risk` for this case); `screens/notifications.md` § 12 |

---

## 4. Detail — mechanism and smallest closing fix

Every `data-loss` and `broken-feature` entry. The fix given is the smallest change that closes the
defect, not a refactor.

### `D-01` — offline fatigue check-ins are stranded

```js
// src/lib/repository/fatigueCheckinRepository.js:5-10
async function record(checkin) {
  await database.practiceFatigueCheckins.put(checkin)
  const { error } = await client.from('practice_fatigue_checkins').insert(checkin)
  if (error) return { ...checkin, sync_state: 'pending' }
  return { ...checkin, sync_state: 'synced' }
}
```

This is the only write path in the repository layer with no `db.outbox` entry and no flush. Every
other durable path (`offlineFirstRepository.writeThrough`, `roundRepository.runQueuedMutation`,
`lostFoundRepository`, `discOdometerRepository`, `activityOutbox`) queues **before** the remote attempt.
Both call sites — `RegimenRunPage.jsx:529` and `FreeformLogPage.jsx:402` — discard the return value, so
the `pending` marker is never rendered either.

`listForParent` compounds it at `:18`: `return data ?? local`. A *successful* remote read that returns
`[]` is not nullish, so it wins over the local rows and the queued check-in disappears from the UI as
well as from the server.

**Smallest fix.** Wrap the insert in the existing outbox pattern — add a `db.outbox` row keyed on the
check-in id before the remote call, delete it on success, and register the entity in `flushOutbox`.
Change `:18` to `return data?.length ? data : local`. Surface the returned `sync_state` at both call
sites using the existing `Saved on Device` badge.

### `D-02` — the single-active interlock never reaches the UI

The whole mechanism exists and is unit-tested. `planActivityStart`
(`src/lib/activityLifecycle/reducer.js:148-173`) returns
`{ kind: 'round_confirmation_required', closeExistingOnConfirm: true, requiresConfirmation: true }`
when the current activity is a round. `activityRepository.start` (`:330-396`) honours a
`confirmRoundReplacement` flag, returns `warnings: ['round_replacement_confirmation_required']` when it
is absent (`:348-356`), and otherwise closes the previous activity as `incomplete` inside the same
transaction (`:371-395`).

Nothing consumes it. A repo-wide search for `confirmRoundReplacement`,
`round_replacement_confirmation_required`, and `previous_activity_marked_incomplete` returns zero hits
in `src/pages/`, `src/components/`, or `src/hooks/`. The strings `Continue Round` and
`Save Round as Incomplete` do not exist in `src/`. The one path that could surface it —
`activityBridge.js:111-127` → `useInstantLaunchSession.mirrorActiveActivity` — correctly propagates
`outcome: 'confirmation_required'`, and the hook reads the result **only** for `result.activity?.id`
(`useInstantLaunchSession.js:92`), discarding the outcome.

**Smallest fix.** Branch on `outcome === 'confirmation_required'` in `mirrorActiveActivity` and refuse
to start capture until the caller resolves it, rather than proceeding against an unmirrored activity.
The dialog placement is genuinely open (`STATE_MATRIX.md` § 6 q3) — but *not* proceeding is a smaller
and independent change from *presenting a dialog*, and it closes the divergence.

### `D-03` — a round started during another activity is permanently unfinalizable

```js
// src/lib/repository/roundRepository.js:145-160 (inside ensureRoundActivity)
if (activity.state === ACTIVITY_STATES.DRAFT) {
  const current = await activityRepository.getActive(userId)
  if (!current) { /* ...start it... */ }
}
```

The comment at `:140-144` says leaving the parent a draft avoids bypassing the single-active invariant.
What it does not say is that the state is terminal in practice: `finalizeRoundActivity` (`:174-183`)
returns early unless the state is `active` or `paused`, so the activity can never reach `completed`,
and `weeklyReportRepository` admits only `VISIBLE_STATES = ['completed']` (`:6`, applied at `:36-38`).
The round row itself still reads `status: 'completed'`, so every screen except the weekly report shows
a finished round.

**Smallest fix.** Two lines of honesty plus one of function: have `finalizeRoundActivity` accept a
`draft` parent and transition it `draft → active → completed` (or directly to `completed` with a
`USER_FINALIZE` reason) at finish time, when the conflicting activity is no longer relevant. The
product decision about *starting* behaviour (`screens/round-start.md` § 12 q1) can stay open —
finalization does not depend on it.

### `D-04` — onboarding provisioning ordering makes retry impossible

```js
// src/components/onboarding/PutterStep.jsx:36-53
async function provision() {
  const bag = await createBag(userId, { name: PRACTICE_STACK_BAG_NAME, is_default: true })
  if (!selectedMold) return bag
  const disc = await upsertDisc(userId, null, buildPutterDiscFields({ … }))
  await addDiscToBag(bag.id, disc.id)
  …
}
```

Three sequential unguarded awaits with no transaction and no rollback. `bags_schema.sql:27-28` declares
`create unique index bags_one_default_per_user on bags (user_id) where is_default`, so the second
`createBag` after a partial failure raises a unique-violation that `handleConfirm` renders as
`err.message`. The same collision is why re-entering `/onboarding` after completion dies at
`Confirm & Continue` (`screens/onboarding.md` § 12 q3) — the bag from the first run is still there.

**Smallest fix.** Make `provision()` idempotent rather than transactional: look up the user's existing
default bag first and reuse it instead of unconditionally creating one. That closes both the
partial-failure retry and the re-entry case with a single read, and needs no schema change.

### `D-05` — offline round start fails whenever a bag is selected

```js
// src/lib/repository/roundRepository.js:249-258 — OUTSIDE the try below
let bagVersionId = fields.bag_version_id ?? null
if (fields.bag_id && !bagVersionId) {
  try { bagVersionId = await captureBagVersion(fields.bag_id, { … }) }
  catch { bagVersionId = latestBagVersion(await loadBagVersions(fields.bag_id))?.id ?? null }
}
…
try {                                   // :265 — the try that makes offline work
  return await runQueuedMutation({ … })
} catch (error) {
  error.localResult = payload           // :277
  throw error
}
```

`captureBagVersion` is a bare Supabase RPC and always rejects offline. The `catch` then calls
`loadBagVersions`, which **rethrows the original error when the Dexie cache is empty**
(`bagHistoryRepository.js:28`). That rethrow escapes `mutationFn` before `payload` exists and before
the `try` that attaches `error.localResult`. `RoundStartPage.jsx:107-112` tests `err.localResult?.id`,
finds nothing, and falls through to `setError(err.message)`. No outbox row is written, no local round
is cached, and nothing is navigable.

The device only has a cached `bagVersions` row if the user has changed a bag while online, so on a
fresh install this is unconditional. And because `fld-bag` preselects the default bag, it is the
default path.

**Smallest fix.** Move the bag-version resolution inside the outer `try`, and make its failure
non-fatal: `bagVersionId = null` is already a valid payload value, and the grouped-save path can
attach a version later. One `try` boundary moved; the whole designed offline flow starts working.

### `D-06` — the shell's toast host is inert

`AppShell.jsx:123` renders `<ToastHost toast={null} />` with a literal `null`. `ToastHost.jsx:2`
returns `null` for a falsy toast. There is no `useState`, context, queue, or setter feeding it anywhere
in `src/`; `ToastHost` has exactly one importer. Consequently
`useActivityNavigationLifecycle.js:41-52` performs the navigation-away pause the contract describes and
shows the user nothing, and swallows its own failures at `:50`.

**Smallest fix.** Add `const [toast, setToast] = useState(null)` to `AppShell`, pass `setToast` down
through the outlet context (or a minimal `ToastContext`), pass `toast` to `ToastHost`, and emit from
`useActivityNavigationLifecycle`. `ToastHost` already carries `role="status" aria-live="polite"`, so
the announcement half needs nothing.

### `D-07` — account deletion cannot succeed

`AuthContext.jsx:39` calls `supabase.rpc('delete_own_account')`. The function is created by
`supabase/migrations/20260727120000_phase_e_account_deletion.sql:34`, which
`docs/development/CURRENT_WORK.md:104-108` records as written and **not applied**. Until it is applied,
the button fails with an undefined-function error.

**Smallest fix.** Apply the migration. Then add the migration contract test the repo already has for
two earlier migrations and lacks for this one (`screens/settings.md` `T-settings-3`) so the gap cannot
recur silently. **This entry is schema-state dependent — see § 5.**

### `D-08` — `CareerHubPage` reads a nonexistent column

Three reads of `profile.current_rating` (`:24`, `:25`, `:41`). `grep -rn "current_rating" --include=*.sql .`
matches nothing anywhere in the repository; the shipped column is `pdga_rating`
(`layer1_foundation_schema.sql:50`, re-named in the column-level UPDATE grant list at
`layer5_gamification_hardening.sql:175`). So `profile.current_rating` is always `undefined`, and all
three consequences are live.

`grep -rn "pdga_rating" src/` also matches nothing — **no UI writes the column either.**
`ProfilePage.jsx` edits `target_rating` only.

**Smallest fix.** Two changes, and the second is required for the first to matter: read
`profile.pdga_rating` in `CareerHubPage`, and add a `pdga_rating` field to the Identity section of
`/profile/details` (which already writes `pdga_number` and `division` through the same
`upsertProfileFields` path). Note that `pdga_rating` **is** in the hardened UPDATE grant list, so no
grant migration is needed for it.

### `D-09` — `/notifications` is unreachable

The route exists (`App.jsx:68`) and has full metadata (`routeMetadata.js:83-90`). The header bell
opens a sheet (`AppShell.jsx:95-110`). `notificationDestination()` never returns `/notifications`.

**Smallest fix.** Add a `See all` link at the foot of `NotificationSheet` that closes the sheet and
navigates to `/notifications`. One control; it also gives the page a reason to exist and makes it
testable.

### `D-10` — guest conversion is unreachable

`AuthContext` exports `convertGuestWithOtp`, `verifyGuestConversion`, and `linkGuestWithOAuth`
(`:59-62`); `AuthPage` branches on `isGuest` at `:112-119` to render the `Save Your Progress` variant.
But `isGuest` has one consumer, and no signed-in user is ever navigated to `/login`:
`ProtectedRoute.jsx:8` redirects only when `!user`, and a guest is a user. The conversion mechanism
itself is correct — same `user.id` throughout, identity added rather than user recreated.

**Smallest fix.** Render a `Save your progress` link to `/login` on `settings` (or `me-root`), gated on
`isGuest`. The destination screen already handles the guest case correctly on arrival.

### `D-11` — the weekly report is unproduced, unscheduled, and misrouted

Three gaps, one feature:

1. **No scheduler.** `weeklyReportRepository.generate` writes `generation_reason` as `manual` or
   `correction_regeneration` (`:79`) and never `scheduled` — which is nonetheless the column's DB
   default. `supabase/functions/` does not exist (only `config.toml` and `migrations/`), and no client
   scheduler was found.
2. **No producer.** `notificationProducers.js` emits exactly two action types: `activity_review`
   (`:5`) and `sync_review` (`:21`). No `weekly_report` insert path exists.
3. **Wrong destination.** `notifications.js:28` — `if (type === 'weekly_report') return payload.href ?? '/profile'`
   — sends the notification to `me-root`, not `weekly-reports`.

**Smallest fix.** Gap 3 is a one-line correction to `/profile/reports` and is wrong under every
resolution of gaps 1 and 2, so land it now. Gaps 1 and 2 need a product decision on whether scheduled
reports are in scope; until that lands, the `Weekly report` toggle in Settings should be removed or
labelled as inactive rather than offering a preference for a capability that does not exist.

### `D-12` — the PLAY hero mislinks a round

```jsx
// src/pages/PracticeMenuPage.jsx:164
to={hero.activityType === 'putting_regimen' && hero.regimenId ? `/practice/regimens/${hero.regimenId}/run` : '/practice/freeform'}
```

`dashboardHero.js:15-23` returns `kind: 'active-activity'` for any `activeActivity`, and
`ensureRoundActivity` creates and starts one for every round begun with no other activity current. The
ternary has no `disc_golf_round` branch.

**Smallest fix.** Add the branch. `heroCardState` already returns `activityId`, and
`ensureRoundActivity` passes `id: roundId`, so the destination is `/rounds/${hero.activityId}` with no
schema or metadata change. Fix the label in the same edit — "Resume active practice" is wrong for a
round.

### `D-13` — the activity pill cannot advertise a round

```jsx
// src/components/AppShell.jsx:42-47
const activeHref =
  activeActivity?.type === 'putting_regimen' && activeActivity.metadata?.regimenId
    ? `/practice/regimens/${activeActivity.metadata.regimenId}/run`
    : activeActivity?.type === 'putting_freeform' ? '/practice/freeform' : null
```

Same missing branch, different file, different symptom: `GlobalHeader.jsx:16` renders the pill only
when `activeHref` is truthy, so a live round produces no pill on any of the seven COURSES routes that
declare `showActivityPill: true`.

**Smallest fix.** Add `activeActivity?.type === 'disc_golf_round' ? '/rounds/${activeActivity.id}'`
and make `GlobalHeader`'s `aria-label` derive from the activity type rather than the hardcoded
`"Resume active practice"`.

### `D-14` — the community comparison source is hardcoded off

`DiscComparePage.jsx:114` — `const community = resolveCommunityCohort([])`. The empty array is a
literal, so `community.status` is never `ready`, `activeSource` always falls back to `official`, and
the notice always renders. No cohort source was ever wired.

**Smallest fix.** Until a cohort source exists, do not offer the control: hide the
`Community benchmark` chip rather than rendering a button whose only outcome is an unavailability
notice. Wiring a real cohort is a feature, not a defect fix.

### `D-15` — the onboarding goal is discarded

`OnboardingPage.jsx:17` holds `goal` in `useState(null)`; `:28` passes it to `GoalStep`; nothing else
reads it. `PutterStep` and `CalibrationStep` do not receive it. `src/lib/onboarding.js` exports
`GOAL_OPTIONS` and nothing that writes a goal. `profiles` has no goal column, and the Phase D3 `goals`
table is an unrelated concept whose values do not overlap `GOAL_OPTIONS`.

**Smallest fix.** Either persist it — an `onboarding_goal` column on `profiles`, written from
`CalibrationStep`'s existing `upsertProfileFields` call so no new write path is needed — or drop the
`Continue` gate so the step is honestly optional. Do not leave a mandatory question whose answer is
thrown away.

### `D-16` — `Finish` does not finish

`RoundScorecardPage.jsx:153-155` renders `<Link to={`/rounds/${round.id}/summary`} className="start-button">Finish</Link>`.
The write lives in `RoundSummaryPage.finishRound` (`:58-83`), behind a second button. The scorecard
never reads `round.status` at all, which is also why a completed round remains fully editable while its
`total_score` stays frozen at the value written at `:65`.

**Smallest fix.** Rename the scorecard control to `Review` or `Summary`. Renaming is smaller and safer
than moving finalization onto a control that currently has no confirmation, and it removes the false
promise immediately; whether finishing should be reachable from the scorecard is a live product
question (`screens/round-summary.md` § 12 q3).

---

## 5. Verification status

Every entry was read against source on this branch at `8ee0ac9`. The column below records *what kind*
of verification was possible.

| id | Status | Note |
|---|---|---|
| `D-01` | **Directly verified** | Full file read; both call sites confirmed to discard the return value |
| `D-02` | **Directly verified** | `activityRepository.start` read; repo-wide grep for all three identifiers confirmed zero UI consumers; `useInstantLaunchSession.js:92` read |
| `D-03` | **Directly verified** | `ensureRoundActivity`, `finalizeRoundActivity`, and `VISIBLE_STATES` all read in source |
| `D-04` | **Verified in code; DB behaviour inferred from schema** | `provision()` ordering and the unique index are both read. The unique-violation on retry follows from the index definition, not from an observed failure |
| `D-05` | **Directly verified** | The `try` boundaries in `useCreateRound` and the rethrow in `loadBagVersions:28` were both read and traced to `RoundStartPage.jsx:107-112` |
| `D-06` | **Directly verified** | `toast={null}` literal and `ToastHost`'s falsy guard both read; no setter exists repo-wide |
| `D-07` | **Reported, not verifiable here** | The call site and the migration file are verified. Whether the function exists in the live project is **not** — this rests on `CURRENT_WORK.md:104-108` |
| `D-08` | **Directly verified** | Three reads confirmed in source; `grep --include=*.sql` for `current_rating` returns nothing; `grep src/` for `pdga_rating` returns nothing. Live schema unconfirmed |
| `D-09` | **Directly verified** | Repo-wide grep for `/notifications` returns only the route, its metadata, and tests |
| `D-10` | **Directly verified** | `isGuest` consumers and every `/login` navigation site enumerated by grep |
| `D-11` | **Directly verified** | `generation_reason:79`, both producers, `notifications.js:28`, and the absence of `supabase/functions/` all confirmed |
| `D-12` | **Directly verified** | The ternary at `:164` and `heroCardState`'s unconditional `active-activity` branch both read |
| `D-13` | **Directly verified** | `activeHref` read in full |
| `D-14` | **Directly verified** | The literal `[]` argument read at `:114` |
| `D-15` | **Directly verified** | `goal` state traced through `OnboardingPage` |
| `D-16` | **Directly verified** | The `Link` and `finishRound` both read; `grep` confirms `RoundScorecardPage` never reads `round.status` |
| `D-17` | **Directly verified** | `setDigit` read and traced by hand for the `"12"` + box-5 case and for mid-box backspace |
| `D-18` | **Directly verified** | `load()`'s `Promise.all` and `loadLostFoundCases`'s merge both read |
| `D-19` | **Directly verified in code and schema** | `enforce_bag_capacity()` read in full at `layer1_foundation_schema.sql:230-253`; `BagLockerPage.jsx:74-89` read. Live trigger existence unconfirmed |
| `D-20` | **Directly verified** | `regimenRepository` and `regimens.js` both read; no `archived` predicate anywhere on the list path |
| `D-21` | **Directly verified** | `saveDisabled` and `StageCard`'s `ChipGroup` both read |
| `D-22` | **Directly verified in code** | The two `crypto.randomUUID()` calls read at `roundLog.js:203-204`. The absence of a delete policy is taken from `_corrections/courses-screens.md` and the cited migration, **not** re-read line by line |
| `D-23` | **Directly verified** | `AppShell.jsx:52-61` read; every `scrollKey` in `routeMetadata.js` confirmed to be a static per-route string; `preserveNestedState` grep confirms no runtime reader |
| `D-24` | **Directly verified** | Full hook read |

### Reported but *not* registered, because they could not be verified

- **`_corrections/play-screens.md` P-3 — does the 100-putt trigger hold for a multi-row insert?**
  `createCustomRegimen` inserts every set row in one statement (`regimens.js:37-38`), and
  `enforce_routine_putt_cap()` is a `BEFORE … FOR EACH ROW` trigger summing sibling rows. Whether rows
  already processed by the same statement are visible to that `SELECT` depends on PostgreSQL
  intra-statement visibility and **cannot be settled by reading the repository**. There is no test
  either way. If the trigger does not hold, `D-21` escalates from `degraded` to `broken-feature`, since
  the app-side gap would be the only guard. Classified `latent` and left unregistered pending a
  negative test against a real Postgres.
- **`_corrections/me-screens.md` C-4 — do `profiles.timezone` and `round_turn_prompt_enabled` have an
  UPDATE grant?** `layer5_gamification_hardening.sql:162-176` revokes the table-wide grant and re-grants
  an explicit 20-column list; both columns were added by later Phase D migrations, and neither issues a
  compensating grant. If the hardening was applied as its comment claims, both Settings controls fail
  with `permission denied for table profiles` — and because `SettingsPage.jsx:39` returns a
  page-replacing error for *any* error, that failure blanks the entire Settings screen, taking the
  export and delete panels with it. **This depends entirely on deployed grant state.** Resolve with:
  ```sql
  select has_column_privilege('authenticated', 'public.profiles', 'timezone', 'UPDATE'),
         has_column_privilege('authenticated', 'public.profiles', 'round_turn_prompt_enabled', 'UPDATE');
  ```
  If it returns `false`, this is a `broken-feature` entry and should be added as `D-25`.

---

## 6. Source claims examined and rejected

Two claims in the source documents did not survive verification. They are recorded here rather than
propagated, per the register's own rule that a claim which does not hold up is stated as such.

### Rejected — `_corrections/discs-screens.md` D-1 and `screens/discs-root.md` § 12 item 1

**Claim:** "there is **no `CHECK` constraint on bag capacity anywhere in the schema**, and no constraint
of any kind limiting `bag_discs` cardinality" … "a bag can exceed 35 members today."

**Rejected.** `layer1_foundation_schema.sql:230-253` defines `enforce_bag_capacity()` and attaches it as
`bag_discs_capacity_check`, a `before insert` trigger on `bag_discs`. It takes a row lock
(`perform 1 from bags where id = new.bag_id for update`), counts members, and raises
`'Bag % is at the 35-disc capacity limit'` with `errcode = 'check_violation'`. The trigger fires on
every insert regardless of which app path issued it, so the unguarded surfaces fail loudly rather than
silently overfilling — which **inverts** the stated user-facing consequence.

This was already adjudicated in `_corrections/capture-screens.md` under "C-9 ADJUDICATION"; the
adjudication is confirmed by direct read here. D-1's narrower point stands and is correct: there is no
`CHECK` *constraint*, and there could not be — a `CHECK` cannot count sibling rows. So
`SCREEN_SPECS.md`'s "DB `CHECK` constraint" wording is drift either way, and D-1's survey of the other
enforcement points (`bag_versions.capacity between 0 and 35`, the `cardinality(normalized_ids) > 35`
guard in `grouped_save_bag`, its absence in `restore_bag_version`, and the four app surfaces counting
three different ways) is valuable and is carried into `D-19`.

**What is registered instead:** `D-19` — the two unguarded add paths surface the trigger's raw exception
to the user, and the trigger's count definition disagrees with the readout's.

### Rejected — `_corrections/courses-screens.md` CS-8

**Claim:** "`.round-turn-prompt` has no stylesheet rule … `grep round-turn-prompt src/App.css` returns
nothing. The element inherits default block styling, so a feature gated behind a Settings toggle and a
profile column ships unstyled."

**Rejected.** The grep was scoped to `src/App.css` only. `.round-turn-prompt` **is** styled, at
`src/index.css:181-187`, in a shared rule with `.fatigue-checkin` and `.session-context-summary`:

```css
.fatigue-checkin,
.round-turn-prompt,
.session-context-summary {
  border: 2px solid var(--color-border-default);
  background: var(--color-bg-surface);
  padding: 1rem;
  margin-block: 1rem;
}
```

`src/index.css` is imported at `src/main.jsx:5`, so the rule is live. The at-the-turn prompt
(`RoundScorecardPage.jsx:167`) renders styled, consistently with the other two context panels. Not a
defect. `screens/round-scorecard.md`'s `T-round-scorecard-4` should be withdrawn.

### Adjusted — the framing of `D-05`

The finding was reported as "offline round start **silently loses** the round when a bag is selected."
The mechanism is confirmed and the entry stands, but two details of that framing are wrong and are
corrected in `D-05`:

- **Nothing is lost**, because nothing is written. The failure happens before `payload` is constructed,
  so there is no optimistic row and no outbox entry to lose. The round is never created.
- **It is not silent.** `RoundStartPage.jsx:112` falls through to `setError(err.message)` and renders
  the raw network error in `.form-error`. The user sees an unactionable string, not nothing.

The defect is if anything easier to justify fixing in the corrected framing: a shipped offline-first
capability does not work on its default path, and the user is told so in language they cannot act on.

---

## 7. What this register is not

- **It is not verified against the live database.** Supabase MCP calls require approval and were never
  reachable in this session (`docs/development/CURRENT_WORK.md` § Staged next actions). Every schema
  statement here is read from the applied schema and migration files in this repository, which is not
  the same thing as the deployed project. **Confirm against the live database before acting on
  `D-04`, `D-07`, `D-08`, `D-19`, and the two unregistered items in § 5.**
- **It is not a task list.** [`TASK_FORMAT.md`](TASK_FORMAT.md) owns task shape and the screen documents
  own per-screen task ids (`T-me-root-1`, `T-round-start-3`, and so on). Entries here point at those.
- **It does not propose refactors.** The § 4 fixes are the smallest changes that close each defect.
  Several defects share a shape that a shared component would resolve better — the 19 copy-pasted
  `S-ERR-BLOCK` blocks, the five sync vocabularies, the three `window.confirm` calls. Those are ranked
  in [`STATE_MATRIX.md`](STATE_MATRIX.md) § 5 as contract gaps and are deliberately **not** registered
  here, because each is a systemic redesign rather than a misbehaving surface.
- **It does not carry documentation drift.** Nine corrections files hold that, and they stay
  authoritative for it. Where a defect has a drift twin, the entry names it.
- **It is not complete for untested surfaces.** `TEST_MAP.md` records that `CareerHubPage`,
  `roundRepository`, `discRepository`, and `profile.js` have no tests at all. `D-08` went undetected in
  production for exactly that reason. Absence of an entry here is not evidence of correctness.
