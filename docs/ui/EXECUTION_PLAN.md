# Execution Plan

Derived roll-up of the **§ 11 Tasks** sections of all 33 documents in `docs/ui/screens/`, sequenced into
phases. Verified against branch `claude/ui-documents-status-3fphcw`.

**The screen documents remain the source of truth for task detail.** Every task keeps its `T-` id, and
its capability, touches, done-when, verify, and commit fields live in its screen document — not here.
This file adds three things the per-screen documents cannot: an order, a consolidation of duplicates,
and an honest account of what is blocked and by whom. Where this plan and a screen document disagree on
a task's content, the screen document wins and this file is the correction to file.

## What was rolled up

| | |
|---|---|
| Screen documents read | 33 |
| Tasks written across them | **179** |
| Tasks absorbed into another task or an umbrella | **45** |
| Consolidated umbrella tasks created | **7** (`XC-1` … `XC-7`) |
| **Tasks after consolidation** | **141** |
| Phases | **8** (Phase 0 is unblocking, not implementation) |

Consolidation reduces duplicated *work* more than it reduces the task count. Nine screens each proposed
"add `role="alert"` to the inline error"; that is nine files but one afternoon and one commit. Seven
screens each proposed "add a Retry control to the error state"; same. Where the shared thing is a
component that must then be adopted with screen-specific copy and conditions, the umbrella is a new
enabling task and the adopters stay separate — merging them would delete real content.

`docs/ui/DEFECT_REGISTER.md` **did not exist when this plan was written.** Cross-referencing every task
to a `D-` defect id is therefore **outstanding** and is the first maintenance action on this file. The
correspondence should be near-mechanical: most tasks in Phases 1–3 are the remediation of a registered
defect.

---

## 1. Ordering principles

Stated before the plan so the order can be argued with rather than merely followed.

**1. Unblock what is blocked, and do it with the people who can.** Roughly a quarter of the task list
cannot legally start. Three ADRs are `Proposed`, two screen documents are marked provisional beneath
them, one migration is written and unapplied, and two actions were refused by the sandbox and need the
owner at a dashboard. None of that is agent work. Sequencing implementation ahead of it produces work
that gets rewritten. Phase 0 is therefore a list of decisions and owner actions, not commits.

**2. Close data-loss defects before anything cosmetic.** The single ranking rule inside implementation
work: a defect where a user's recorded input silently disappears outranks a defect where the app looks
wrong. `T-round-scorecard-2` (offline scores never flush on reconnect), `T-round-start-1` (a round
cannot be created offline when no bag version resolves), `T-round-scorecard-3` (unreplayable writes
retried forever in a bare `catch {}`), and `T-round-summary-2` (finished rounds silently excluded from
weekly reports) are each a case of the user doing the work and the app losing it. They come first
because their cost is unrecoverable and their symptom is silence.

**3. Then the E2 commitment the project already made.** `PRODUCT_ROADMAP.md` § Phase E and
`DEVELOPMENT_PLAN.md` § E2 both name the same next work item: *audit and harden the existing course/
layout and offline round routes rather than rebuilding them.* `docs/development/CURRENT_WORK.md` stages
it as action 7. This plan does not get to relitigate that. The COURSES section is also, independently,
the correct next target — `TEST_MAP.md` records it as the least-covered part of the app, with
`src/lib/roundLog.js` exporting nine functions and having no test file at all. The roadmap commitment and
the evidence agree, which is the easiest kind of sequencing decision.

**4. Build a shared thing before the fifth screen needs it.** One deliberate inversion of "value first":
the shared-primitive phase (Phase 2) runs *before* the bulk of the screen work, because seven of its
consumers are COURSES screens in Phase 3. Building `EmptyState` after five screens have hand-rolled it
is how `COMPONENT_LIBRARY.md` accumulated ten gap entries. Phase 2 is small and it pays for itself
inside one phase.

**5. Everything else by section, by value.** DISCS, then PLAY and ME, then the pre-shell screens. DISCS
before PLAY because DISCS carries the unresolved bag-capacity contract, which is a schema decision and
therefore expensive to defer. Pre-shell last because those three screens are the least-changed surface
in the app and their tasks are almost entirely accessibility polish.

**6. Decision-gated work goes last, not never.** ADR 0001's three ⏸ tasks and the fifteen tasks gated on
a screen document's § 12 open question are collected in Phase 7. They are real work with a real owner;
they are simply not startable yet. Phase 7 exists so they do not quietly become backlog.

**What this plan deliberately does not do:** it does not decide ADR 0001, 0002, or 0003. It sequences
around all three. Where the recommended option would change a task's shape, the task sits in Phase 7
with the dependency named.

---

## 2. Blocked work

Everything here is blocked on something no agent session can resolve by writing code.

### 2.1 Owner-only, environment-blocked

Both were approved on 2026-07-28, attempted, and refused by the sandbox
(`docs/development/CURRENT_WORK.md`). A future session must not read them as merely undecided.

| Blocker | Who unblocks it | What it blocks |
|---|---|---|
| **Apply `supabase/migrations/20260727120000_phase_e_account_deletion.sql`.** Written, not applied. Every Supabase MCP call returns `MCP tool call requires approval` and never reaches the project. Apply via the Supabase dashboard SQL editor or `supabase db push`. | **Owner**, at the dashboard or CLI | `T-settings-2`, `T-settings-3`. Downstream: PR #4 merge (`main` auto-deploys, so merging first ships a delete button that errors on click), and **App Review** — Guideline 5.1.1(v) makes in-app account deletion a hard rejection. This is the single highest-consequence blocker in the repo and it is not a Phase E feature. |
| **Prune the 14 merged `codex/*` branches.** The git proxy returns HTTP 403 on `git push origin --delete` and the GitHub tool set exposes no delete-branch capability. Prune from the GitHub branches UI. | **Owner**, GitHub branches UI | Nothing functional. Repo hygiene only. Listed because a future session will otherwise re-attempt it and re-fail. |

Two further owner actions are staged in `CURRENT_WORK.md` and gate release rather than tasks: reviewing
and merging **PR #4** (after the migration, not before), and configuring **protected `main`** with
required review and checks. Neither blocks a `T-` task; both block shipping.

### 2.2 Blocked on `Proposed` ADRs

All three ADRs in `docs/decisions/` carry `Status: proposed` and each states a recommendation that is
explicitly **not yet accepted**. Only the **owner** can accept them.

**ADR 0001 — Live round scoring interaction model.** The consequential one. `screens/round-scorecard.md`
and `screens/round-summary.md` both open with a 🔶 **Provisional** banner; their §§ 3, 4, 6, and 8 are
provisional sections that hold under Options A and C and would be substantially rewritten under Option
B. The ADR's own Consequences section says the cost of deferral plainly: *"E2 proceeds with a
known-unstable foundation under it."*

Directly blocked (marked ⏸ in their documents, **must not be scheduled before the ADR closes**):

- `T-round-scorecard-8` — meet the field-ergonomics contract for score entry. *This task chooses the
  capture surface.*
- `T-round-scorecard-9` — use the round's bag snapshot in the disc picker (Option B would relocate the
  picker entirely). Also gated on `round-scorecard` § 12 question 3.
- `T-round-summary-9` — expand the summary beyond three stat tiles (Option B changes what capture
  produces, therefore what a summary should show).

Not blocked, despite living in provisional documents: everything else on those two screens. The
documents are careful about this — `T-round-scorecard-1` carries an explicit note that hole normalization
*"survives a change of capture UI."* Phase 1 and Phase 3 depend on that distinction holding; if the owner
leans toward Option B, re-read both § 11 sections before starting Phase 3.

**ADR 0002 — Group and league scope.** Blocks no individual task. It scopes the phrase *"group-scorecard
groundwork"* in `DEVELOPMENT_PLAN.md` § E2, which is currently undefined. Under the recommended Option B
that groundwork is exactly one thing — ensuring nothing in the round schema or repository layer assumes a
single scorer permanently, with no widened RLS and no shared-round UI. **Until it closes, this plan
schedules no group work at all**, which is the only safe reading. If it is accepted as recommended, the
groundwork is a review pass over Phase 3's output rather than new tasks.

**ADR 0003 — Native capability timeline.** Blocks no task in this plan. Under the recommended Option C
(PWA-first with explicit triggers), screen documents describe web APIs as the capability layer, which is
what they already do. Recorded here so it is not lost: if it is *rejected* toward adding Capacitor, the
`field-verify` verification steps throughout this plan change surface.

### 2.3 Blocked on an unresolved screen-document open question

These have no external blocker — they need a product or architecture decision written down in the
screen document's § 12, then the task can start. **Owner or lead agent decides; any agent implements.**

| Blocked task(s) | The question that blocks them | Where |
|---|---|---|
| `T-discs-root-6` (and the three tasks merged into it: former `T-bag-manage-3`, `T-disc-collection-2`, `T-disc-detail-3`) | Bag capacity is enforced in three places with three different rules; and is `bag.capacity` display-only or the interlock threshold? A bag with capacity 10 blocks at 10 on `/bag` and at 35 in the editor. **This is a `schema` task — append-only, so getting it wrong is expensive.** | `discs-root` § 12 Q1, Q2 |
| `T-rounds-root-7` | Should a round be deletable? RLS permits it; the app ships no path. | `rounds-root` § 12 Q4 |
| `T-round-summary-4` | Should a completed round be editable, and what happens to `total_score` — lock, recompute, or reopen? A product decision, not just a data one. | `round-summary` § 12 Q2 |
| `T-round-start-3`, and `T-round-summary-2` in part | What should happen when a round starts while another activity is current? | `round-start` § 12 Q1 |
| `T-courses-root-7`, `T-courses-new-4` | Is the course directory community-wide or personal? Should the quick-course form use a keyboard at all? | `courses-root` § 12 Q1; `courses-new` § 12 Q1 |
| `T-course-detail-7` | Nothing in the app can edit a layout or a hole; who may edit a shared course; and the tee-type model. The largest single item in COURSES. | `course-detail` § 12 Q2, Q4 + `courses-new` § 12 Q5 |
| `T-course-detail-5` | Scroll-key scoping. | `_corrections/courses-screens.md` CS-1 |
| `XC-7` (calm sync states) | Two conflicting statements about which calm states a cached list shows. **Must settle before the vocabulary can be applied in five places.** | `_corrections/state-matrix.md` C-2 |
| `T-practice-stats-2` | Should incomplete activities contribute evidence? The metric registry and `lib/history` disagree. | `practice-stats` § 12 Q2, `_corrections/play-screens.md` P-9 |
| `T-goals-5` | Two lifecycle implementations — `lib/goals.js` in JS and the RPC in SQL. Which is authoritative? | `goals` § 12 Q2 |
| `T-me-root-1` | Is `pdga_rating` the intended current-rating field? | `me-root` § 12 Q1 |
| `T-me-root-4` | Roadmap and code disagree about which ME links exist. | `_corrections/me-screens.md` C-1 |
| `T-settings-4` | Are `profiles.timezone` and `round_turn_prompt_enabled` genuinely missing column UPDATE grants? Confirm the hazard before writing a `security` migration. | `settings` § 12 Q2 |
| `T-login-6`, `T-login-7` | Where does the guest-conversion entry point belong; what replaces the inert guarantee checkbox. | `login` § 12 Q1, Q3 |
| `T-onboarding-1`, `T-onboarding-3` | Should the Step-1 goal influence anything; redirect or re-run for an already-onboarded user. | `onboarding` § 12 Q1, Q3 |
| `T-notifications-3`, `T-weekly-reports-2`, `T-trophy-room-2`, `T-regimen-select-4`, `T-disc-compare-3`, `T-disc-new-3`, `T-profile-details-3`, `T-freeform-active-2` | One § 12 question each. Individually small. | Respective documents |

### 2.4 Blocked on another task

Real ordering dependencies, all internal. These are honoured by the phase order below.

- `T-course-detail-4`, `T-courses-new-2`, `T-round-start-5` → `T-courses-root-4` (the course offline cache)
- `T-round-scorecard-3`, `T-round-start-3` → `T-round-start-2` (the `roundRepository.test.js` regression net)
- `T-round-summary-2` → `T-round-start-2` (via the merged `T-round-summary-1`)
- `T-rounds-root-1` → `T-round-start-2` (sequence the test file before the query shape changes)
- `T-courses-new-2` → `T-courses-new-1`; `T-routine-builder-3` → `T-routine-builder-2`
- `XC-4` (error + retry) → `T-courses-root-2` (scope the error before adding a retry to it)
- `T-login-2` → `T-login-1` (pin page-level auth behavior before touching `OtpInput`)
- Every adopter of `XC-1`, `XC-2`, `XC-3`, `XC-5`, `XC-6`, `T-goals-3` → the Phase 2 primitive it consumes

---

## 3. Consolidation ledger

The 45 absorbed tasks and where they went. Each umbrella is a **new consolidated task** and is marked
**[C]** wherever it appears below; no other task in this plan is invented.

### Direct merges — instructed by the screen documents themselves

| Kept | Absorbed | Why |
|---|---|---|
| `T-root-4` — add a landmark to the three shell-less screens | `T-login-4`, `T-onboarding-6` | All three documents say *"the same change; land once, under this id."* |
| `T-round-start-2` — create `roundRepository.test.js` | `T-rounds-root-3`, `T-round-summary-1` | Its own heading reads *"shared with `T-rounds-root-3`"*; `T-round-summary-1` names the same new file. One test file, one commit. |
| `T-round-scorecard-2` — flush the round outbox on reconnect | `T-round-summary-5` | `round-summary`'s note: *"the same fix shape… Do them together — one listener in `roundRepository`."* |

### Same-artifact merges

| Kept | Absorbed | Why |
|---|---|---|
| `T-courses-root-6` — give `.link-button` a 44pt hit area | `T-root-3` | Both are rules in `src/App.css` enforcing the same 44×44pt minimum. `courses-root`'s note already says *"`.link-button` is used app-wide… Verify PLAY and ME too."* |
| `T-discs-root-6` — decide and unify the bag capacity contract | `T-bag-manage-3`, `T-disc-collection-2`, `T-disc-detail-3` | `T-discs-root-6` already touches `bags.js`, `BagPage`, `BagLockerPage`, `BagManagePage` and a migration. Its done-when — *"one count definition and one cap value used by every add path"* — is by definition the other three. |
| `T-goals-3` — replace `window.confirm` with the app's confirmation pattern | `T-bag-manage-1`, `T-practice-history-detail-2`, `T-discs-root-3` | `T-goals-3` already scopes *"plus a new shared confirm component."* `COMPONENT_LIBRARY.md` gap 8 names exactly four call sites: `BagManagePage:103`, `GoalsPage:38`, `HistoryDetailPage:111`, and `PutterLineup:133`'s unconfirmed Retire. Build once, convert all four. |
| `T-play-root-2` — one `<h1>` per screen | `T-weekly-reports-4` | Same defect class (shell route title vs. in-page `<h1>`); extends the PLAY sweep by one ME file. |
| `T-round-summary-7` — label the stat tiles and hole scores | `T-rounds-root-5` | Identical fix (label an unlabelled numeric score column) on two adjacent COURSES screens. |

### Consolidated umbrella tasks **[C]**

Each is new. Each exists because N screens independently proposed the same fix and the shared artifact
is real, evidenced in `COMPONENT_LIBRARY.md` where noted.

**`XC-1` [C] — Extract a shared `EmptyState` component and retire the three CSS idioms.**
`ui-routine`. Source: `COMPONENT_LIBRARY.md` gap 6 — four pages hand-roll `.empty-state`
(`CourseDetailPage:49`, `RoundsPage:61`, `CoursesPage:46`, `RoundStartPage:131`) while
`NotificationSheet:13` uses `.sheet-empty-state` and `TrophyWall:36` uses `.trophy-empty`.
Absorbs: `T-regimen-select-3`. Consumed but not absorbed (they carry screen-specific conditions or copy
that would be lost): `T-course-detail-3`, `T-disc-collection-1`, `T-practice-history-2`,
`T-trophy-room-3`, `T-courses-root-2`, `T-round-start-6`.

**`XC-2` [C] — Give `ChipGroup` selection semantics and convert the hand-rolled variants.**
`ui-routine`. Source: `COMPONENT_LIBRARY.md` gap 10 — `ChipGroup` emits no `aria-pressed`, `role="radio"`,
or `role="tab"`, so five components bypassed it and hand-rolled their own (`BagResonance:32`,
`FlightSpectrum:39`, `TrophyWall:22-32`, `SessionLauncher:28-35`, `GoalStep:11-20`, `PutterStep:103-114`).
Absorbs: `T-disc-detail-2` (aria-pressed on bag/shot chips), `T-disc-collection-4` (picker chip parity
with compare chip), `T-routine-builder-5` (label the chip groups), and the card-group half of
`T-onboarding-5`. **Note for the implementer:** `COMPONENT_LIBRARY.md` gap 5 records `SESSION_FACTORS`
declared verbatim in two files with two hand-rolled chip rows. No screen task proposes fixing it, so it
is **not** in scope here — but it is the sixth hand-rolled variant and should be filed.

**`XC-3` [C] — Extract a shared progress-bar with `role="progressbar"` semantics.**
`ui-routine`. Source: `COMPONENT_LIBRARY.md` gap 7 — six independent track/fill pairs, all
`<div style={{width:'{pct}%'}}>` inside a track, none announcing a value.
Absorbs: `T-trophy-room-4` (progress semantics on every bar) and the progress-bar half of
`T-onboarding-5`.

**`XC-4` [C] — One inline error-with-retry state, applied to every screen that asked for one.**
`ui-routine`. Seven screens independently proposed the identical control: *"a failed load renders the
error plus a `Retry` control that re-runs [the loader]."*
Absorbs: `T-courses-root-3`, `T-disc-detail-1`, `T-discs-root-2`, `T-me-root-2`,
`T-practice-history-detail-3`, `T-practice-stats-1`, `T-trophy-room-5`.
**Deliberately not absorbed** — these say "retry" but their real content is scoping an error so it stops
replacing the page, which is per-screen logic: `T-course-detail-1`, `T-courses-root-2`,
`T-practice-history-3`, `T-practice-history-deleted-1`, `T-play-root-1`, `T-settings-1`,
`T-rounds-root-6`, `T-round-scorecard-6`, `T-round-summary-8`, `T-round-start-6`.
Depends on `T-courses-root-2` (scope first, then add the control).

**`XC-5` [C] — Give every inline error and status region a live-region role.**
`ui-routine`. Nine screens proposed the same `role="alert"` / `role="status"` pairing on
`.form-error` / `.form-info` / `err-inline` / `notice-inline`.
Absorbs: `T-bag-manage-6`, `T-courses-new-6`, `T-courses-root-5`, `T-disc-new-5`, `T-goals-4`,
`T-login-3`, `T-lost-found-6`, `T-profile-details-5`, `T-settings-6`.
**The umbrella carries their extra clauses** — do not drop them: announce the membership ceiling
(bag-manage), announce silent clamps (courses-new), announce the busy state (goals), clear the banners on
success (lost-found). Deliberately not absorbed: `T-notifications-2` (a `data-access` failure-surfacing
task, not a role attribute) and the `role="alert"` clause inside `T-round-start-4`, whose bulk is
disabled-state explanation.

**`XC-6` [C] — One unsaved-draft guard, wired to Cancel, shell Back, and tab re-tap.**
`ui-interaction`. Four screens proposed the same "warn before discarding an unsaved draft."
Absorbs: `T-bag-manage-4`, `T-disc-new-4`, `T-profile-details-4` (which touches the shared
`EditableSection.jsx`), `T-routine-builder-4` (which additionally covers shell Back and a PLAY tab
re-tap — a shell-level concern, and the reason this is one guard rather than four).
Depends on `T-goals-3` for the confirmation surface.

**`XC-7` [C] — Settle the calm sync-state vocabulary once and apply it.**
`sync`. Five screens each proposed rendering the four `PHASE_A_ARCHITECTURE.md` § 12 calm states
(`Saved on Device` / `Syncing` / `Synced` / `Needs Attention`). `round-summary`'s own note says it:
*"settle the vocabulary once for the whole section."*
Absorbs: `T-rounds-root-4`, `T-round-summary-6`, `T-lost-found-7`, `T-disc-collection-5`,
`T-practice-history-1`.
**Blocked** on `_corrections/state-matrix.md` C-2, which must first settle which of two conflicting
statements about cached-list states is correct. Inherited from `T-practice-history-1`; it applies to all
five, which is precisely why they belong in one task.

---

## 4. Phases

Eight phases. Phase 0 is decisions and owner actions; Phases 1–7 are commits.

---

### Phase 0 — Unblock

**Goal:** remove the blockers that make later phases unsafe to start. **Not agent work, except where
noted.**

| Action | Owner | Unblocks |
|---|---|---|
| Apply `20260727120000_phase_e_account_deletion.sql` via the dashboard SQL editor or `supabase db push` | **Owner** | `T-settings-2`, `T-settings-3`, PR #4, App Review |
| Accept, amend, or reject **ADR 0001** | **Owner** | `T-round-scorecard-8`, `T-round-scorecard-9`, `T-round-summary-9`; de-provisionalises two screen documents; makes Phase 3 safe |
| Accept, amend, or reject **ADR 0002** | **Owner** | Defines "group-scorecard groundwork" so E2 cannot expand mid-phase |
| Accept, amend, or reject **ADR 0003** | **Owner** | Nothing in this plan; closes a recurring question |
| Resolve `_corrections/state-matrix.md` C-2 | Lead agent | `XC-7` |
| Answer `discs-root` § 12 Q1 and Q2 (bag capacity) | **Owner** — product | `T-discs-root-6` and its three merged constituents |
| Review and merge PR #4 — **after the migration, not before** | **Owner** | Everything downstream; `main` auto-deploys |
| Configure protected `main` + required review/checks | **Owner** (GitHub admin UI) | Unreviewed auto-deploy risk |

**Definition of done:** the migration is applied and smoke-tested (a second user's rows survive;
community `created_by` is nulled rather than deleted; private Storage objects under the user's prefix are
gone; `anon` cannot execute the function); ADR 0001 carries a status other than `proposed`; C-2 and the
bag-capacity questions have written answers in their documents.

**Verify:** manual, in a rollback-only transaction for the migration smoke checks. No `npm` command
proves this phase.

---

### Phase 1 — Stop losing data

**Goal:** every defect where a user's recorded input silently disappears is closed, with a test that
would catch its return. **This is the largest-risk phase and it is not small** — 17 tasks, and 12 of them
carry the three highest-care capability tags. Several are E2 work pulled forward; that is intentional,
and it does not contradict the E2 commitment because E2's own first line is "audit and harden."

| Task | One-line |
|---|---|
| `T-settings-2` | Apply the account-deletion migration (App Review blocker; the document says it should land before anything else) |
| `T-settings-3` | Migration contract test for account deletion |
| `T-round-start-2` | Create `roundRepository.test.js` — the regression net for everything below *(absorbs `T-rounds-root-3`, `T-round-summary-1`)* |
| `T-round-start-1` | A round can be created offline when no bag version resolves |
| `T-round-scorecard-2` | Flush the round outbox on reconnect *(absorbs `T-round-summary-5`)* |
| `T-round-scorecard-3` | Give the round outbox a poison path instead of a bare `catch {}` |
| `T-round-summary-2` | Stop silently excluding finished rounds from weekly reports |
| `T-lost-found-2` | Test the lost-and-found offline queue |
| `T-routine-builder-2` | Prove the database putt-cap trigger holds for multi-row inserts |
| `T-routine-builder-3` | Make routine creation atomic |
| `T-routine-builder-1` | Close the app-side 100-putt hole |
| `T-courses-new-3` | Make the three-statement course write atomic |
| `T-bag-manage-5` | Roll back the local ghost-slot row when the remote write fails |
| `T-onboarding-2` | Make Step 2 provisioning retry-safe |
| `T-practice-stats-3` | Make the experiment-marker insert idempotent |
| `T-round-scorecard-5` | Bound the score input, with a `CHECK` constraint behind it |
| `T-trophy-room-6` | Pin the gamification hardening migration contract |

**Ordering inside the phase:** `T-settings-2` → `T-settings-3` first (App Review). Then
`T-round-start-2` **before** `T-round-start-1` and `T-round-scorecard-3` — its own note says so.
`T-routine-builder-2` before `T-routine-builder-3` — fix the constraint before relying on it inside a
transaction. Everything else is independent.

**Capability mix:** `sync` ×4, `schema` ×4, `security` ×2, `data-access` ×4, `pure-logic` ×3. Per
`TASK_FORMAT.md`, that is an almost entirely *Highest / Elevated* care phase — GPT-5.6 high or Opus 5
throughout, with negative tests mandatory on the `schema` and `security` items and append-only,
rollback-noted migrations.

**Definition of done:** `roundRepository.test.js` exists and covers `useCreateRound`'s bag-version
branch, outbox ordering, the optimistic write, `error.localResult`, `ensureRoundActivity`'s both
branches, and `finalizeRoundActivity`'s early return; an offline round survives create → score →
reconnect → flush with no duplicates; an unreplayable write is marked `Needs Attention` rather than
looped; the account-deletion RPC exists and its four smoke assertions hold.

---

### Phase 2 — Shared primitives

**Goal:** build the shared components that Phases 3–6 consume, before their fifth caller hand-rolls a
sixth copy. Small phase, high leverage — it is the difference between ten screens gaining a Retry button
and ten screens gaining ten different Retry buttons.

| Task | One-line |
|---|---|
| `XC-1` **[C]** | Shared `EmptyState` component; retire `.sheet-empty-state` and `.trophy-empty` *(absorbs `T-regimen-select-3`)* |
| `T-goals-3` | Shared confirmation dialog + convert all four `window.confirm` / unconfirmed-destructive call sites *(absorbs `T-bag-manage-1`, `T-practice-history-detail-2`, `T-discs-root-3`)* |
| `XC-4` **[C]** | One inline error-with-retry state across seven screens *(absorbs 7 tasks; depends on `T-courses-root-2`)* |
| `XC-5` **[C]** | Live-region roles on every inline error and status region, nine screens *(absorbs 9 tasks)* |
| `XC-2` **[C]** | `ChipGroup` selection semantics; convert the hand-rolled variants *(absorbs 4 tasks)* |
| `XC-3` **[C]** | Shared progress-bar with `role="progressbar"` *(absorbs 2 tasks)* |
| `XC-6` **[C]** | One unsaved-draft guard for Cancel, shell Back, and tab re-tap *(absorbs 4 tasks; depends on `T-goals-3`)* |
| `T-courses-root-6` | 44×44pt minimum on `.link-button` and the splash text links *(absorbs `T-root-3`)* |
| `T-root-4` | Landmark on the three shell-less screens *(absorbs `T-login-4`, `T-onboarding-6`)* |
| `T-play-root-2` | One `<h1>` per screen across PLAY and weekly reports *(absorbs `T-weekly-reports-4`)* |
| `T-trophy-room-1` | Migrate `XpLedgerModal` and `BadgeInspectDrawer` to `SheetHost` — deletes the weaker `.modal-sheet` pattern entirely |
| `T-bag-manage-2` | Open the bag restore preview in `SheetHost` |
| `T-regimen-active-3` | Route the three capture overlays through `SheetHost` |

**Ordering:** `T-courses-root-2` (Phase 3) is a prerequisite of `XC-4`; either pull that one task forward
into Phase 2 or run `XC-4` at the Phase 2/3 boundary. `T-goals-3` before `XC-6`. The three `SheetHost`
migrations are independent of everything else and can run in parallel.

**Capability mix:** `ui-routine` ×9, `ui-interaction` ×4 (the three `SheetHost` migrations plus `XC-6`),
`sync` ×0. Mostly Normal care — Sonnet 5 or GPT-5.3-Codex medium — except the `SheetHost` and draft-guard
work, which is focus management and therefore Elevated.

**Definition of done:** no `window.confirm` call remains in `src/`; `grep -rn "window.confirm" src/`
returns nothing. `.modal-sheet` has no remaining users. `EmptyState`, the error-retry state, the
progress-bar, and the draft guard each have at least one consumer and are documented in
`COMPONENT_LIBRARY.md`, with gaps 6, 7, 8, and 10 struck from its Gaps section.

---

### Phase 3 — E2: audit and harden COURSES

**Goal:** deliver the project's own committed next work item —
*"audit and harden the existing course/layout and offline round routes rather than rebuilding them"*
(`DEVELOPMENT_PLAN.md` § E2, `PRODUCT_ROADMAP.md` § Phase E, `CURRENT_WORK.md` staged action 7).

**This is the largest phase in the plan: 33 tasks.** It is large because COURSES is 51 of the 179
original tasks and because `TEST_MAP.md` records it as the least-covered section in the app —
`src/lib/roundLog.js` exports nine functions and has no test file. It should be run as three sub-phases
with a green commit at each boundary, not as one push.

**3a — Coverage and query shape first.** Nothing else here is safe without it.

| Task | One-line |
|---|---|
| `T-courses-root-1` | Create `roundLog.test.js` covering the course queries — the nine untested functions |
| `T-rounds-root-1` | Stop fetching every round in full to render the list *(the single highest-value item in the section)* |
| `T-rounds-root-2` | Sort the offline round list |
| `T-courses-new-1` | Extract quick-course construction into a tested pure module |
| `T-round-scorecard-1` | Extract and test the scorecard's normalization logic *(safe under any ADR 0001 outcome)* |

**3b — Error scoping and dead ends.** The "a network failure never replaces active capture" contract
from `PHASE_A_ARCHITECTURE.md` § 12.

| Task | One-line |
|---|---|
| `T-courses-root-2` | Stop a course-fetch failure blanking the directory *(prerequisite of `XC-4`)* |
| `T-course-detail-1` | Distinguish "not found" from "failed to load", and add a retry |
| `T-course-detail-2` | Block the launch path for a layout with no holes |
| `T-course-detail-3` | Fix the empty-state copy and the hole-count plural *(land with `T-course-detail-2`)* |
| `T-round-start-4` | Explain every disabled and fallen-back state *(pairs with `T-course-detail-2`)* |
| `T-round-start-6` | Distinguish an empty course catalog from a failed load |
| `T-round-scorecard-6` | Keep capture on screen when a load fails |
| `T-round-scorecard-7` | Explain a round with no holes |
| `T-round-summary-8` | Keep the summary on screen when a finish fails |
| `T-rounds-root-6` | Rounds-list retry and empty-cache recovery |

**3c — Offline reach, then polish.**

| Task | One-line |
|---|---|
| `T-courses-root-4` | Give the course directory an offline cache *(largest item in the section; unblocks three)* |
| `T-course-detail-4` | Read the course through the offline cache |
| `T-courses-new-2` | Make course creation survive an offline submit |
| `T-round-start-5` | Read the round setup form from the offline cache |
| `XC-7` **[C]** | Settle and apply the calm sync-state vocabulary *(absorbs 5 tasks; blocked on state-matrix C-2)* |
| `T-round-summary-7` | Label the stat tiles and hole scores *(absorbs `T-rounds-root-5`)* |
| `T-round-scorecard-4` | Style the turn prompt, or remove it |
| `T-course-detail-6` | Give the hole list assistive-tech structure |
| `T-courses-new-5` | Reconcile the route title and the page heading |

**Decision-gated, held for Phase 7 but belonging to E2:** `T-courses-root-7`, `T-courses-new-4`,
`T-course-detail-5`, `T-course-detail-7`, `T-round-start-3`, `T-round-summary-4`, `T-rounds-root-7`,
`T-round-scorecard-8` ⏸, `T-round-scorecard-9` ⏸, `T-round-summary-9` ⏸.

**Capability mix:** `ui-routine` ×17, `data-access` ×8, `pure-logic` ×3, `sync` ×1 (`XC-7`),
`docs` ×1. Roughly two thirds Normal care, one third Elevated — but the Elevated third
(`T-courses-root-4` and its three dependents) is the phase's critical path and should not be run at
Normal care.

**Definition of done:** `roundLog.js` has a test file; `/courses`, `/courses/:id`, and `/rounds/new` all
render usefully offline from cache; no COURSES screen replaces itself with a full-screen error on a
network failure; a quick-course create → start round → score → finalize path holds with totals matching
`rounds.test.js`; and — the E2 acceptance question — every remaining COURSES task is either shipped or
sitting in Phase 7 behind a *named* open question.

**Explicit scope guard:** ADR 0002 is `Proposed`. **No group-scorecard work in this phase.** Weather,
activity-only rounds, bag snapshot verification, and course preparation are the *later* half of E2 per
`DEVELOPMENT_PLAN.md`; no screen document writes tasks for them, so this plan does not either. They
follow Phase 3, from new task sections.

---

### Phase 4 — Build the verification floor

**Goal:** close the gap `PHASE_A_ARCHITECTURE.md` § 9 requires and § 16 admits *"closed without being
met."*

**This phase has no `T-` id because no screen document proposes it.** It is `CURRENT_WORK.md` **staged
action 6** — *"Resolve the E2E contradiction: build a Playwright baseline or amend the Phase A
contract"* — and the candidate specs live in `docs/ui/TEST_MAP.md` § E2E backlog. It is placed here, and
not omitted, because the alternative is that the plan silently ships around a contract the project says
is required.

It sits after Phase 3 rather than before it for one reason: `TEST_MAP.md`'s Priority 2 spec 4 is *"quick-
course create → start round → enter scores → finalize,"* which is exactly the surface Phase 3 changes.
Writing that spec first means rewriting it.

`TEST_MAP.md` also records that the tooling barrier is zero — Chromium and Playwright are preinstalled
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).

**Work, in the priority order `TEST_MAP.md` already sets:**

- **P1 — flows where a silent break loses user data.** (1) regimen → record → kill tab → relaunch →
  crash recovery resumes. (2) record offline → reconnect → outbox flushes exactly once, no duplicates.
  (3) finalize an activity → it appears in history with matching totals.
- **P2 — flows with no unit coverage at all.** (4) quick-course → round → score → finalize. (5) email
  OTP sign-in → `/practice`. (6) never-onboarded → gate → complete → default bag exists.
- **P3 — cross-screen contracts.** (7) tab-press three-state behavior. (8) Back returns to section root.
  (9) notification sheet open → mark read → navigate.

**Two decisions this phase must make, not defer:**

1. Playwright baseline **or** amend the Phase A contract. `CURRENT_WORK.md` allows either. Pick one in
   writing; do not report E2E as shipped while it is not (`TASK_FORMAT.md`: *"tasks must not claim E2E
   verification"*).
2. Whether to adopt `TEST_MAP.md`'s **proposed coverage rule** — *"a screen with zero related tests may
   not gain new behavior without at least one test on the pure logic it introduces"* — into
   `docs/operations/RELEASE_CHECKLIST.md`. It is currently proposed and unadopted. Phase 3 is the last
   moment its COURSES exemption is needed.

**Capability:** `sync` and `data-access` in character (the P1 specs are replay and idempotency), `docs`
for the contract amendment. Highest care either way.

**Definition of done:** the three P1 specs run in CI, or `PHASE_A_ARCHITECTURE.md` § 9 and § 16 are
amended to say what is actually required, with `CURRENT_WORK.md` staged action 6 struck.

---

### Phase 5 — DISCS

**Goal:** close the DISCS section, starting with the capacity contract because it is `schema` and
therefore append-only and expensive to defer. 21 tasks.

| Task | One-line |
|---|---|
| `T-discs-root-6` | Decide and unify the bag capacity contract *(absorbs `T-bag-manage-3`, `T-disc-collection-2`, `T-disc-detail-3`; **blocked on `discs-root` § 12 Q1/Q2** — closed in Phase 0)* |
| `T-discs-root-1` | Render the cached collection when the network is unavailable |
| `T-discs-root-4` | Give the capacity block a real disabled control |
| `T-discs-root-5` | Give `Compare` a valid destination |
| `T-disc-collection-1` | Distinguish "no discs yet" from "no discs match" |
| `T-disc-collection-3` | Label the toolbar controls |
| `T-disc-new-1` | Create discs through the offline-first repository |
| `T-disc-new-2` | Disable submit until a mold is chosen |
| `T-disc-new-6` | Group and label the flight override inputs |
| `T-disc-compare-1` | Test the `?ids=` parser |
| `T-disc-compare-2` | Give the flight overlay a text equivalent |
| `T-disc-compare-4` | Default the bag context to the main bag |
| `T-disc-compare-5` | Memoize the comparison derivation |
| `T-lost-found-1` | Render the cached case history offline |
| `T-lost-found-3` | Validate `?disc=` before enabling submission |
| `T-lost-found-4` | Select the case matching `?disc=` |
| `T-lost-found-5` | Confirm before resolving a case *(consumes `T-goals-3`'s dialog)* |

Held for Phase 7: `T-disc-new-3`, `T-disc-compare-3`.

**Capability mix:** `ui-routine` ×11, `data-access` ×3, `pure-logic` ×2, `schema` ×1, `sync` ×1.
Predominantly Normal care; `T-discs-root-6` alone is Highest.

**Definition of done:** one count definition and one cap value govern every add path including
`/bag/locker?addToBag=`, with a negative migration test; `/bag` and `/bag/locker` both render from cache
offline; every DISCS chart has a text equivalent.

---

### Phase 6 — PLAY and ME

**Goal:** close the two remaining shipped sections. 26 tasks. Almost entirely `ui-routine` — this is the
polish phase and it should be scheduled as such.

**PLAY**

| Task | One-line |
|---|---|
| `T-play-root-1` | Stop a history failure blanking the launchpad |
| `T-play-root-3` | Give the confidence-map shortcut an accessible name |
| `T-freeform-active-1` | Cover the multi-distance lifecycle |
| `T-freeform-active-3` | Document and test the pursuit deep-link contract |
| `T-regimen-select-1` | Exclude archived routines from the list |
| `T-regimen-select-2` | Handle the `Last time` query's rejection |
| `T-regimen-active-1` | Page-level test for the capture wiring |
| `T-regimen-active-2` | Confirm before abandoning a session with recorded attempts |
| `T-practice-history-2` | Distinguish a filtered-empty list from an empty history |
| `T-practice-history-3` | Keep a load failure from replacing the page |
| `T-practice-history-4` | Move run-set reshaping into `lib/history` |
| `T-practice-history-deleted-1` | Keep a restore failure from destroying the list |
| `T-practice-history-deleted-2` | Name and guard each Restore button |
| `T-practice-history-deleted-3` | Scope PB badges out of the deleted list |
| `T-practice-history-deleted-4` | Skip the unused derived computation on this branch |
| `T-practice-history-deleted-5` | Bind the policy copy to `RECENTLY_DELETED_DAYS` |
| `T-practice-history-detail-1` | Explain a hidden or missing activity |
| `T-practice-history-detail-4` | Reconcile `Abandoned` and `Incomplete` |
| `T-practice-stats-4` | Give the confidence bands a text alternative |
| `T-practice-stats-5` | Give the confidence map a discoverable entry point |
| `T-notifications-1` | Give `/notifications` an entry point, or document it as deep-link-only |
| `T-notifications-2` | Surface notification subsystem failures |
| `T-notifications-4` | Name each row's Review button |
| `T-notifications-5` | Decide the fate of the unproduced notification types |

**ME**

| Task | One-line |
|---|---|
| `T-settings-1` | Stop a single failed toggle blanking the page |
| `T-settings-5` | Cover `settingsRepository`'s offline fallback |
| `T-goals-1` | Enforce the one-active-goal-per-type interlock in the UI |
| `T-goals-2` | Translate RPC error codes into user-facing copy |
| `T-trophy-room-3` | Give a fresh account something to pursue |
| `T-me-root-3` | Surface radar axis sample sizes |
| `T-profile-details-1` | Unit tests for `lib/profile` |
| `T-profile-details-2` | Fix the handedness "Not set" option |
| `T-weekly-reports-1` | Point weekly-report notifications at this screen |
| `T-weekly-reports-3` | Surface the stored putt sample count |
| `T-weekly-reports-5` | Pair metric values with their labels semantically |

Held for Phase 7: `T-practice-stats-2`, `T-notifications-3`, `T-regimen-select-4`,
`T-freeform-active-2`, `T-goals-5`, `T-me-root-1`, `T-me-root-4`, `T-settings-4`, `T-trophy-room-2`,
`T-weekly-reports-2`, `T-profile-details-3`.

**Capability mix:** `ui-routine` ×24, `pure-logic` ×5, `data-access` ×4, `ui-interaction` ×2, `docs` ×2.
Overwhelmingly Normal care — this phase is the best candidate for batching several tasks per session.

**Definition of done:** no PLAY or ME screen replaces itself with a full-screen error on a partial
failure; every chart and progress indicator has a text equivalent; `T-notifications-5` has a written
answer for each unproduced notification type.

---

### Phase 7 — Decision-gated work

**Goal:** the tasks that were correctly written and cannot start. **21 tasks.** They are listed as a
phase so they are visible; in practice each lands as soon as its gate opens, which may be earlier than
this position implies.

**Gated on ADR 0001** (⏸ in their documents — do not start before the ADR closes):
`T-round-scorecard-8` (field-ergonomics contract for score entry — also carries `field-verify`, so its
acceptance is owner-executed on device), `T-round-scorecard-9` (bag-snapshot disc picker),
`T-round-summary-9` (expand the summary).

**Gated on a § 12 open question or a correction:**
`T-courses-root-7`, `T-courses-new-4`, `T-course-detail-5`, `T-course-detail-7`, `T-round-start-3`,
`T-round-summary-4`, `T-rounds-root-7`, `T-disc-new-3`, `T-disc-compare-3`, `T-practice-stats-2`,
`T-notifications-3`, `T-regimen-select-4`, `T-freeform-active-2`, `T-goals-5`, `T-me-root-1`,
`T-me-root-4`, `T-settings-4`, `T-trophy-room-2`, `T-weekly-reports-2`, `T-profile-details-3`,
`T-login-6`, `T-login-7`, `T-onboarding-1`, `T-onboarding-3`.

**Capability mix:** heavy on `schema`, `security`, and `data-access` relative to its size — decisions
tend to be deferred precisely when they are expensive. `T-course-detail-7` (the hole editor) is the
largest single unstarted item in the repo and `DEVELOPMENT_PLAN.md` § E2 names it.

**Definition of done:** every task here has either shipped or had its gate answered in writing in the
owning screen document's § 12. A task that is still gated at the end of Phase 7 needs an ADR, not
another deferral.

---

### Phase 8 — Pre-shell

**Goal:** close `root`, `login`, and `onboarding`. Deliberately last — the least-changed surface in the
app, and three of its tasks already landed in Phase 2 via `T-root-4`. 8 tasks.

| Task | One-line |
|---|---|
| `T-login-1` | Add an auth flow test suite *(highest priority in its document; every other login task is safer after it)* |
| `T-login-2` | Fix non-sequential digit entry in `OtpInput` *(land after `T-login-1`)* |
| `T-login-5` | Give SSO and guest buttons an in-flight state |
| `T-root-1` | Cover the `/` route contract in `routeMetadata.test.js` |
| `T-root-2` | Give the guest button an in-flight and failure state |
| `T-onboarding-4` | Add a Back control to Steps 2 and 3 |

Held for Phase 7: `T-login-6`, `T-login-7`, `T-onboarding-1`, `T-onboarding-3`.

**Capability mix:** `security` ×1, `ui-interaction` ×1, `pure-logic` ×1, `ui-routine` ×3.

**Definition of done:** `AuthPage`, `AuthContext`, and `OtpInput` have test files; every pre-shell
control has an in-flight state; all three screens expose a landmark (from Phase 2).

---

## 5. Per-phase verification

Every task's own **Verify** field still governs whether *that task* is done. The commands below are the
phase gate — they must pass before the phase closes.

**The `npm test` invocation.** Always export the Supabase placeholders, or **13 files fail at import**
with a config error that looks like a regression and is not:

```
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_ANON_KEY=ci-test-placeholder \
npm test
```

CI (`.github/workflows/ci.yml`) sets them inline and runs test → lint → build on every PR.
**Known-good baseline, not a target:** 497 tests across 74 files, build clean, on the branch of record as
of 2026-07-28. `npm run lint` carries **four pre-existing warnings** — three hook-dependency findings and
one Fast Refresh export finding. Four is the baseline; five is a regression. `npm run build` produces
~740 KB minified / ~213 KB gzip; code splitting is a tracked backlog item, not a phase gate.

| Phase | Gate |
|---|---|
| **0** | No `npm` command. Manual: the four account-deletion smoke assertions in a rollback-only transaction; ADR statuses changed in `docs/decisions/`. |
| **1** | `npm test` (placeholders exported) — must add `roundRepository.test.js` and grow past 497. `npm run lint` ≤ 4 warnings. `npm run build`. Plus **negative SQL tests** for each `schema`/`security` item, and Supabase advisors clean after `T-settings-2`. Plus a manual offline → score → reconnect pass in `npm run dev`. |
| **2** | `npm run lint`; `npm run build`; `grep -rn "window.confirm" src/` returns nothing; `grep -rn "modal-sheet" src/` returns nothing. Plus a **manual keyboard + VoiceOver pass** on each converted dialog: focus enters, Escape closes, focus returns to the invoking control, background is inert. |
| **3** | `npm test` — must add `roundLog.test.js`. `npm run lint`; `npm run build`. Plus a manual offline pass at `/courses`, `/courses/:id`, and `/rounds/new` in `npm run dev`, and a full quick-course → round → score → finalize walkthrough. |
| **4** | The new E2E command, whatever it is named, green in CI for the three P1 specs — **or** an amended `PHASE_A_ARCHITECTURE.md` § 9/§ 16 and a struck `CURRENT_WORK.md` action 6. Do not close this phase on a passing `npm test`; `npm test` is exactly what does not cover it. |
| **5** | `npm test` including the at-capacity case on every add path and the negative migration test. `npm run lint`; `npm run build`. Manual offline pass at `/bag` and `/bag/locker`. |
| **6** | `npm test`; `npm run lint`; `npm run build`. Plus a VoiceOver rotor pass with headings on the PLAY and ME routes. |
| **7** | Per-task. Each carries its own Verify; `T-round-scorecard-8` additionally requires **owner field verification** — one thumb, direct sunlight, 320px width, 200% text — which cannot be automated and is not agent-closable. |
| **8** | `npm test` including the new `AuthPage`, `AuthContext`, and `OtpInput` suites. `npm run lint`; `npm run build`. |

**No task in this plan may claim E2E verification before Phase 4 closes** (`TASK_FORMAT.md` § Verification
commands).

---

## 6. Capability totals

After consolidation. 141 tasks. Use `TASK_FORMAT.md` § Capability → model to match these to sessions.

| Capability | Tasks | Care level | Session per `TASK_FORMAT.md` |
|---|---:|---|---|
| `ui-routine` | 72 | Normal | GPT-5.3-Codex medium / Sonnet 5 |
| `data-access` | 23 | Elevated | GPT-5.6 high / Opus 5 |
| `pure-logic` | 15 | Normal, always test-first | GPT-5.3-Codex medium / Sonnet 5, test-first |
| `ui-interaction` | 9 | Elevated — field-critical | GPT-5.6 high / Opus 5 |
| `sync` | 8 | Highest | GPT-5.6 high / Opus 5 |
| `schema` | 6 | Highest — append-only, rollback notes, negative tests | GPT-5.6 high / Opus 5 |
| `security` | 4 | Highest — negative tests mandatory | GPT-5.6 high / Opus 5 |
| `docs` | 4 | Normal | GPT-5.3-Codex medium / Sonnet 5 |
| **Total** | **141** | | |

**Before consolidation** the same list read: `ui-routine` 101, `data-access` 26, `pure-logic` 17,
`ui-interaction` 11, `sync` 10, `schema` 6, `security` 4, `docs` 4 = 179. Consolidation removed 34
`ui-routine` tasks and added 5 back as umbrellas — nearly all of the saving is in repeated accessibility
and error-state work, which is exactly where a per-screen document cannot see the duplication.

**Reading these numbers for scheduling:**

- **51% of the work is `ui-routine`.** That is a Normal-care majority and it batches well — several
  tasks per session, one commit each.
- **18 tasks (13%) carry Highest care** (`sync` + `schema` + `security`). Fourteen of them are in
  Phase 1. That phase is not batchable and should not be estimated like the rest.
- **`field-verify` appears as a primary capability on zero tasks** and as a *second* capability on one
  (`T-round-scorecard-8`). This is worth noticing: `CURRENT_WORK.md` records that the Phase A real-device
  gate is user-reported rather than observed, and that authenticated in-app rendering remains unexercised.
  The plan has almost no owner-executed device verification in it, which is a gap in the *task set*, not
  in this plan — no screen document proposes more, so this plan does not invent it. **File it.**

---

## 7. Explicitly out of scope

Nothing below is in any phase above. Listing them is the point — an execution plan that stays silent
about the parked work invites it back in through a side door.

**Parked blueprint screens 14–21.** `SCREEN_SPECS.md` parks Screen 14 (Course Practice Hubs &
Leaderboards) and Screen 15 (Putting League Bracket Manager) with the Social module, and parks bag tags,
QR Beam, and peer challenge wherever they appear *inside* an in-scope screen (standing divergence #8).
The 33 screen documents cover the in-scope set; no task in this plan touches 14–21.

**Everything behind an unmet revisit trigger in `PRODUCT_ROADMAP.md` § Parked.** Reproduced so the
triggers are checkable rather than remembered:

| Area | Trigger that would unpark it |
|---|---|
| Social — sharing cards, QR Beam, bag tags, leaderboards, leagues, P2P, foil beaming | Public identity/privacy/moderation, a course/round foundation, explicit opt-in social design |
| Community analytics — anonymous mold/run/plastic/weight benchmarks | Consent pipeline, privacy thresholds, enough independent contributors |
| Commerce — pro-shop discovery, re-order/affiliate links | A real retailer inventory source and a partnership/affiliate agreement |
| Native/hardware — Capacitor distribution, watch, BLE, sensors, Maestro native flows | Stable PWA field flows plus a product need browser APIs cannot meet *(see ADR 0003)* |
| Experimental capture — acoustic/CV detection, tournament-noise training | Core manual capture stable; acoustic validation >90% over representative outdoor sessions |
| AI narrative — post-session/weekly/long-horizon prose | Deterministic reports stable, months of data, prompt/cost/privacy evaluation |
| Advanced sync UI — full conflict-resolution center | Real unresolved conflicts prove notification + record-level resolution insufficient |
| PDGA automation — rating/profile sync | An official or explicitly permitted stable source/API |
| Device naming | Multi-device sync/settings UI ships |
| Metric materialization — database aggregates/materialized summaries | Measured client/query cost shows on-device calculation insufficient |

**Note on the Social trigger:** *"course/round foundation"* is one of its three conditions and Phase 3 is
that foundation. Phase 3 completing satisfies one third of a trigger — it does not open it. ADR 0002 says
the same thing from the other direction.

**Also out of scope, for reasons other than parking:**

- **Catalog ingestion / any scraper.** Scrapped 2026-07-13 and removed from client and database
  (migration `20260714120000`). `disc_molds` is populated manually by the owner. `CURRENT_WORK.md`:
  *"do NOT rebuild a scraper."* The B1.5 catalog foundation is retained and is a different thing;
  `discs.mold_id` FKs into `disc_molds` and must never be dropped.
- **Everything under `PRODUCT_ROADMAP.md` § Rejected or obsolete** — standalone Stats tab, the parallel
  `global_disc_universe` identity tree, automatic 30-day lost-disc archival, opaque composite form
  scores, default notification spam, the dynamic topo placeholder generator, literal Expo/NativeWind
  migration, Maestro-before-Capacitor.
- **The later half of E2** — weather, activity-only rounds, bag snapshot verification, course
  preparation. Committed in `DEVELOPMENT_PLAN.md` § E2 and *not* out of scope for the project, but out of
  scope for *this plan*: no screen document writes tasks for them, and this plan does not invent tasks.
  They follow Phase 3 from new § 11 sections.
- **Bundle code splitting.** ~740 KB minified / ~213 KB gzip, tracked in `FEATURE_BACKLOG.md` before
  public/mobile beta. No screen task proposes it.
- **`TrendChart` + `insights/timeSeries` salvage** from `775543c`, recorded in `FEATURE_BACKLOG.md`.

**Not out of scope, and deliberately placed rather than omitted: automated browser E2E.**
`PHASE_A_ARCHITECTURE.md` § 9 requires it, § 16 lists it among two required items that *"closed without
being met,"* it was never built, and its candidate specs are in `docs/ui/TEST_MAP.md` § E2E backlog. It is
**Phase 4** of this plan. It has no `T-` id because no screen document proposes it — it is
`CURRENT_WORK.md` staged action 6. A future revision of this file should give it real task ids once
someone writes them.

---

## Maintaining this file

- **Cross-reference `docs/ui/DEFECT_REGISTER.md` when it lands.** It did not exist when this was written.
  Every task in Phases 1–3 should gain a `D-` id.
- Update it when a screen document's § 11 changes, when an ADR status changes, or when a § 12 open
  question is answered — the last of these moves tasks out of Phase 7 and is the most common edit.
- Do not copy task detail here. If you need to know what a task means, open its screen document.
