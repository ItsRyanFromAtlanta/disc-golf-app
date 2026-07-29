# Corrections — COURSES section screen documents

Contradictions found while writing the seven COURSES screen documents
(`courses-root`, `courses-new`, `course-detail`, `rounds-root`, `round-start`, `round-scorecard`,
`round-summary`). **Not applied.** Each entry is a proposed edit to another document, to be reconciled
in one reviewed commit.

Filed against `7351964`. Numbering is `CS-n` to avoid colliding with the `C-n` series in
`screen-specs-and-agents.md`.

---

## CS-1 — `preserveNestedState` is declared and tested but never read by runtime code

**Where:** `docs/ui/NAVIGATION_MAP.md:130-132`, `docs/ui/screens/disc-detail.md:38`,
`docs/ui/TEMPLATE.md:51`

**Claims:** `NAVIGATION_MAP.md` — "a route with `preserveNestedState: false` still has its position
stored, but returns to it only within a single shell mount." `disc-detail.md:38` —
"`preserveNestedState` is `false`, so scroll position is not restored on return."

**Reality:** nothing reads the field. `src/lib/routeMetadata.js` sets it on all 30 app routes; the only
other references in `src/` are assertions in `src/lib/routeMetadata.test.js` (lines 11, 25, 31, 37, 43,
56, 59-61, 73-76, 82). `AppShell.jsx` restores and stores scroll position keyed solely on
`route.scrollKey`:

```
AppShell.jsx:52-58   if (!region || !route?.scrollKey) return
                     const top = scrollPositionsRef.current[route.scrollKey] ?? 0
                     region.scrollTop = top
AppShell.jsx:61      if (route?.scrollKey) scrollPositionsRef.current[route.scrollKey] = event.currentTarget.scrollTop
```

So scroll position **is** restored for `preserveNestedState: false` routes, and the `disc-detail.md:38`
sentence is the opposite of the shipped behavior.

A second consequence, unrelated to `preserveNestedState`: because the ref map is keyed by `scrollKey`
and every instance of a parameterized route shares one key, scrolling `/courses/course-a`, returning to
`/courses`, then opening `/courses/course-b` restores **course A's** offset onto course B. The same
applies to `courses-detail`, `round-scorecard`, `round-summary`, and `discs-detail`.

**Proposed edit:** either wire `preserveNestedState` into `AppShell` (a real behavior change, needs a
decision) or mark it in `NAVIGATION_MAP.md` as a declared-but-unimplemented contract field, and fix
`disc-detail.md:38`. Do not leave the current wording — a screen author will assert scroll behavior that
does not exist.

---

## CS-2 — `NAVIGATION_MAP.md` says one query-parameter contract exists; there are two

**Where:** `docs/ui/NAVIGATION_MAP.md:170-173`

**Claims:** "One query-parameter contract exists in the shipped app: `/bag/lost-found?disc=:discId`,
linked from `disc-detail`."

**Reality:** `/rounds/new?courseId=<id>&layoutId=<id>` is a second shipped contract. It is produced at
`src/pages/CourseDetailPage.jsx:51` (`courseId` only, from the no-layouts empty state) and
`CourseDetailPage.jsx:66` (both parameters, from each layout's Start round button), and consumed at
`src/pages/RoundStartPage.jsx:13-14`:

```
const requestedCourseId = searchParams.get('courseId')
const requestedLayoutId = searchParams.get('layoutId')
```

Both parameters are advisory — `RoundStartPage.jsx:34-37` and `:66-70` silently fall back to the first
available course/default layout when the requested id is not in the fetched list.

**Proposed edit:** add the `/rounds/new` row to the deep-links table and change "one" to "two".

---

## CS-3 — `STATE_MATRIX.md` was missing when these seven were written — **since resolved**

> **Status: resolved during this branch.** Kept as a record of why the seven COURSES documents describe
> shared states inline, and as the follow-up task to convert them.

**Where:** `docs/ui/TEMPLATE.md:130`, `docs/ui/README.md:29`, `docs/ui/TASK_FORMAT.md:93`

**Claims:** `TEMPLATE.md` § 7 instructs authors to "Reference `STATE_MATRIX.md` rows by id instead of
re-describing shared state behavior." `README.md:29` links it. `TASK_FORMAT.md:93`'s worked example
cites a row id, `STATE_MATRIX S-EMPTY` — and that example is for `course-detail`, one of this batch.

**Reality at the time of authoring:** `ls docs/ui/` returned `COMPONENT_LIBRARY.md`,
`COPY_AND_TERMINOLOGY.md`, `LIB_API_INDEX.md`, `NAVIGATION_MAP.md`, `README.md`, `SCREEN_INVENTORY.md`,
`TASK_FORMAT.md`, `TEMPLATE.md`, `TEST_MAP.md`. No `STATE_MATRIX.md` existed anywhere in the repository,
so the three references were dangling and there were no row ids to cite.

**Resolution:** `docs/ui/STATE_MATRIX.md` has since been authored on this same branch by a concurrent
session, with its own corrections log at `_corrections/state-matrix.md`. The ids the COURSES documents
would use now exist: `S-LOAD`, `S-LOAD-PARTIAL`, `S-SAVING`, `S-EMPTY`, `S-ERR-BLOCK`, `S-ERR-INLINE`,
`S-RETRY`, `S-OFFLINE-READ`, `S-STALE`, `S-OFFLINE-WRITE`, `S-SYNC`, `S-SYNC-ATTENTION`,
`S-INTERLOCK-CAP`, `S-INTERLOCK-ACTIVE`, `S-CONFIRM`, and others.

**Outstanding follow-up:** the seven COURSES documents were written before those ids existed and
therefore describe loading, empty, error, offline, and sync states **inline** in their § 5 Offline and
§ 6 Flow paths sections. Per `STATE_MATRIX.md` § "How to reference this from a screen document" rule 1,
that is duplication, and duplication drifts. Each of the seven should be converted to cite the row id
and record only its divergence. The mapping is mechanical — a representative sample:

| Screen | Inline description | Row |
|---|---|---|
| `courses-root` | full-page `form-error` when `fetchCourses` rejects | diverges from `S-ERR-INLINE`; is `S-ERR-BLOCK` with no `S-RETRY` |
| `courses-root`, `course-detail`, `rounds-root`, `round-start` | `.empty-state` block + CTA | `S-EMPTY` |
| `rounds-root` | `Showing saved rounds from this device.` | `S-STALE` / `S-OFFLINE-READ`, styled as an error |
| `round-scorecard` | `Saved on this device; it will retry when you reconnect.` | `S-OFFLINE-WRITE`; no standing `S-SYNC` state |
| `round-scorecard` | `Saving…` / `Autosaves` | `S-SAVING`, with `Autosaves` not a state at all |
| `round-summary` | `Round completed on this device; it will sync when you reconnect.` | `S-OFFLINE-WRITE` |
| `round-summary` | `Finish round` with no confirmation | missing `S-CONFIRM` |
| `round-start` | submit disabled with no reason | `S-INTERLOCK-ACTIVE`, unannounced |

This is a `docs` task, not a rewrite: the observations in the seven documents are accurate, they are
simply stated in prose where a row id would do.

**Proposed edit:** none to `TEMPLATE.md`, `README.md`, or `TASK_FORMAT.md` — the file they reference now
exists and their instructions are correct as written. The work is in the seven screen documents.

---

## CS-4 — `DEVELOPMENT_PLAN.md` § J1's stated reuse does not match what shipped

**Where:** `DEVELOPMENT_PLAN.md` § J1, the **Reuse** bullet

**Claims:** "**Reuse:** `fetchBags` for bag pick; `useDiscList`/`DiscCard` for per-hole disc;
field-screen ergonomics (primary controls in viewport, secondary in sheets; TTFP not network-gated)."

**Reality, item by item:**

| Claim | Shipped |
|---|---|
| `fetchBags` for bag pick | ✅ `RoundStartPage.jsx:4,29` |
| `useDiscList` for per-hole disc | ✅ `RoundScorecardPage.jsx:4,51` |
| `DiscCard` for per-hole disc | ❌ `RoundScorecardPage.jsx:213-223` is a plain `<select>` of `discLabel(disc)` strings. `DiscCard` is never imported by any of the seven pages. |
| secondary tasks in sheets | ❌ None of the seven pages opens a sheet. Course, layout, bag, disc, and notes are all inline form controls. |
| TTFP not network-gated | ❌ for five of seven. `courses-root`, `courses-new`, `course-detail`, and `round-start` read `roundLog.js`, which is Supabase-only (`LIB_API_INDEX.md:640`) with no Dexie mirror, and each renders a bare `Loading…` or full-page error until the network answers. Only `round-scorecard` and `round-summary` are offline-capable, via `loadRound`'s Dexie fallback. |

**Proposed edit:** J1 is marked SHIPPED, so its text is a historical plan, not a claim about the current
tree. Either annotate the Reuse bullet with what actually landed, or add a pointer to the screen
documents. As written, an agent reading J1 will look for a `DiscCard` and a sheet layer that are not
there. `PHASE_A_ARCHITECTURE.md` § 12's "secondary tasks open in bottom sheets" clause binds the active
capture shell, not `standard` shell screens, so the missing sheets are a plan-vs-ship gap rather than a
contract violation.

---

## CS-5 — `TEST_MAP.md` COURSES rows are right but incomplete

**Where:** `docs/ui/TEST_MAP.md:57-72`

**Claims:** `rounds-root`, `round-start`, `round-scorecard`, `round-summary` → `rounds`;
`courses-root`, `courses-new`, `course-detail` → **none**.

**Reality:** confirmed correct by reading the imports of all seven pages. Two additions:

1. `round-start` also imports `fetchBags` from `src/lib/discLocker.js` (`RoundStartPage.jsx:4`), which
   **does** have `src/lib/discLocker.test.js`. The row should read `rounds`, `discLocker`.
2. `courses-root` and `rounds-root` import `useRoundList` from `roundRepository.js`, and
   `round-scorecard` additionally imports `useDiscList` (`discRepository.js`) and
   `fetchProfile`/`upsertProfileFields` (`profile.js`). None of those three modules has a test file
   (`src/lib/repository/roundRepository.test.js`, `src/lib/repository/discRepository.test.js`, and
   `src/lib/profile.test.js` all absent). Worth naming, because the row currently reads as though
   `rounds.test.js` is the only *relevant* module rather than the only *tested* one.

**Proposed edit:** amend the two rows; the headline finding ("the COURSES section is the least-covered
part of the app") stands and is if anything understated.

---

## CS-9 — ADR 0001 names three blocked screens; `SCREEN_INVENTORY.md` marks two

**Where:** `docs/decisions/0001-live-round-interaction-model.md:18-20` against
`docs/ui/SCREEN_INVENTORY.md:61-64`

**Claims:** the ADR's Context says "The screen documents for `round-scorecard`, **`round-start`**, and
`round-summary` cannot state a stable interaction contract until this closes." `SCREEN_INVENTORY.md`
marks `round-scorecard` and `round-summary` as `🔶 blocked on ADR 0001` and leaves `round-start` as `⬜`.

**Reality:** the two documents disagree about scope, and `SCREEN_INVENTORY.md` is the declared authority
("**Screen status lives here and nowhere else**", `SCREEN_INVENTORY.md:3`).

On the merits, the inventory's narrower reading looks right: all three of the ADR's options require a
round row to exist before capture begins, and none of them changes what `round-start` collects (course,
layout, bag) or how it writes it. Option C — the recommendation — explicitly keeps the structured
scorecard as the primary surface, which leaves the setup form untouched; Option B (conversational
capture) would replace the scorecard but would still need a round created somewhere.

**How it was handled:** `screens/round-start.md` follows the inventory and is written as unblocked, with
the discrepancy recorded in its § 12 question 5 and the ADR cited in its § 7 Contracts and decisions.
`screens/round-scorecard.md` and `screens/round-summary.md` are marked provisional per the inventory.

**Proposed edit:** either narrow the ADR's Context sentence to the two screens, or change the
`round-start` row to 🔶. Do not leave them disagreeing — a future author will not know which document
governs. **The ADR itself is not resolved by this entry.**

---

## Cross-screen code defects found while writing these documents

Not document contradictions — code. Recorded here because each spans a screen outside this batch and
would otherwise be lost.

### CS-6 — The PLAY dashboard hero mislinks an in-progress round to `/practice/freeform`

**Where:** `src/pages/PracticeMenuPage.jsx:162-169`, with `src/lib/dashboardHero.js:16-23`

`heroCardState()` returns `{ kind: 'active-activity', activityType }` for **any** active activity,
including `disc_golf_round` — which `roundRepository.ensureRoundActivity()` creates and starts for every
new round (`roundRepository.js:127-162`). `PracticeMenuPage.jsx:164` then resolves the destination as:

```jsx
to={hero.activityType === 'putting_regimen' && hero.regimenId ? `/practice/regimens/${hero.regimenId}/run` : '/practice/freeform'}
```

There is no `disc_golf_round` branch, so a player with a round in progress sees **"▶️ Resume active
practice"** on `/practice` and tapping it opens the freeform putting canvas instead of the scorecard.
The activity's own `metadata` carries `courseId`/`layoutId` but not the round id — though the round id
*is* the activity id (`ensureRoundActivity` passes `id: roundId`), so `/rounds/${hero.activityId}` is
available without a schema change.

Belongs to `play-root`'s screen document. Referenced from `round-start` § 12 and `round-scorecard` § 12.

### CS-7 — The header activity pill can never advertise a round

**Where:** `src/components/AppShell.jsx:42-47`, `src/components/GlobalHeader.jsx:16`

`activeHref` is computed only for `putting_regimen` and `putting_freeform`; every other activity type
yields `null`. `GlobalHeader` renders the pill only when `showActivityPill && activeActivity &&
activeHref`. All seven COURSES routes declare `showActivityPill: true`, and all seven can be visited
with a `disc_golf_round` activity current — so the flag is inert for the case it most needs to cover.
Its `aria-label` is also hardcoded `"Resume active practice"`, which would be wrong for a round even if
the link existed.

Belongs to the shell; noted in each COURSES document's identity block.

### CS-8 — `.round-turn-prompt` has no stylesheet rule

**Where:** `src/pages/RoundScorecardPage.jsx:167`, against `src/App.css`

The at-the-turn check-in renders `<aside className="round-turn-prompt">`. `grep round-turn-prompt
src/App.css` returns nothing. The element inherits default block styling, so a feature gated behind a
Settings toggle (`SettingsPage.jsx:47`) and a profile column
(`20260716213000_phase_d_session_context_fatigue.sql:20`) ships unstyled.

Belongs to `round-scorecard`; a task is filed there (`T-round-scorecard-4`).
