# Goals

| Field | Value |
|---|---|
| Route id | `goals` |
| URL pattern | `/profile/goals` |
| Section | `me` |
| Shell | `standard` |
| Header title | `Goals` |
| Activity pill | shown |
| Scroll key | `me-goals` |
| Preserves nested state | yes |
| Page component | `src/pages/GoalsPage.jsx` (72 lines) |
| Blueprint screen | none — post-blueprint |
| Verified against | `7351964` |

## 1. Purpose

Declare one measurable target per goal type, then move it through a four-state lifecycle —
active, paused, completed, cancelled — with a per-goal audit trail of every transition. It is a
commitment register, not a progress tracker: nothing on this screen measures how close you are.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Goals` link on the ME root | `Link` from `/profile` | `CareerHubPage.jsx:33`. The only in-app entry point |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` runs first |
| Out | Shell back control | `GlobalHeader` → `handleBack()` | Goes to `/profile`, the ME section root |
| Out | Tab re-tap on ME | `TabBar` → `resolveSectionRoot('me')` | Returns to `/profile` |
| Out | Any other tab | `TabBar` | Standard |

No in-page link leaves this screen, and nothing links **in** except the ME root — notably, the `Goals`
section on `/profile/details` (which edits `profiles.target_rating`) does **not** link here, despite
sharing the name. See § 12.

`preserveNestedState` is `true`; the shell restores the `me-goals` scroll offset within a mount. The
create form's four pieces of local state (`type`, `target`, `targetDate`, plus `busy`/`error`) do not
survive unmount, so a half-typed goal is lost on navigation.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Goals                             [activity pill]| <- Shell-owned header
+-------------------------------------------------------+
|  active_goal_exists                                   | <- p.form-error, inline, raw server string
+-------------------------------------------------------+
|  Create a goal                                        | <- h2, inside the <form>
|  Goal type                                            |
|  [ Target rating                                   v ]| <- 4 GOAL_DEFINITIONS
|  Target (rating)                                      | <- label suffix switches with type
|  [ 900                                              ] | <- number, min 0.01, step 0.01, required
|  Target date (optional)                               |
|  [ 2026-12-31                                       ] | <- date, min = today
|  [ Create goal ]                                      | <- .btn-primary, disabled while busy
+-------------------------------------------------------+
|  Your goals                                           | <- h2#goal-list-title
|  +-------------------------------------------------+  |
|  | Target rating                        [ active ] |  | <- .status-chip .status-active
|  | 900 rating                                      |  |
|  | Started 7/29/2026 · target 12/31/2026           |  |
|  | [ Pause ] [ Complete ] [ Cancel ]               |  | <- availableGoalActions(status)
|  | > History (3)                                   |  | <- <details>, collapsed by default
|  |     paused -> active   7/29/2026, 9:14:02 AM    |  |
|  |     active -> paused   7/28/2026, 6:02:41 PM    |  |
|  |     Created active     7/20/2026, 8:31:10 AM    |  |
|  +-------------------------------------------------+  |
|  +-------------------------------------------------+  |
|  | Putting volume                    [ completed ] |  |
|  | 500 putts/week                                  |  |
|  | Started 6/01/2026                               |  |
|  |                                                 |  | <- no actions: terminal state
|  | > History (2)                                   |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+

Empty list instead of the cards:
|  No goals yet. Choose one measurable target to begin. | <- .career-note
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Goals", activity pill
Page (section.goals-page)
  err-inline ........... p.form-error, raw message, rendered above the form
  Create form (form.goal-create-form)
    create-heading ..... h2 "Create a goal"
    create-type ........ select #goal-type, one option per GOAL_DEFINITIONS entry
    create-target ...... number input #goal-target, label text switches with type
    create-date ........ date input #goal-date, optional
    create-submit ...... button "Create goal"
  Goal list (section, aria-labelledby="goal-list-title")
    list-heading ....... h2#goal-list-title "Your goals"
    list-empty ......... "No goals yet. Choose one measurable target to begin."
    goal-card .......... one article.goal-lifecycle-card per goal
      card-type ........ h3, definition label or raw goal_type
      card-target ...... "<target_value> <suffix>"
      card-status ...... span.status-chip.status-<status>, raw status text
      card-dates ....... "Started <date>" + optional " · target <date>"
      card-action ...... one button per availableGoalActions(status); 0–3 of them
      card-history ..... <details> "History (<n>)" wrapping an ordered event list
        hist-row ....... "<previous> → <new>" or "Created <new>", plus a <time>
Page-replacing state
  state-loading ........ p.loading "Loading goals…", only while snapshot and error are both absent
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `err-inline` | text | raw error string | present / absent | — | — | Rendered inline above the form, **not** page-replacing. Carries raw server messages — see § 12 |
| `create-type` | select | `Goal type` | — | sets `type` | local | Four options: `Target rating`, `Practice frequency`, `Putting volume`, `Consistency`. **Never disabled, even when an active goal of that type already exists** — see § 6 Interlock |
| `create-target` | number input | `Target (<suffix>)` where suffix is `rating` \| `sessions/week` \| `putts/week` \| `%` | — | sets `target` | local | `required`, `min="0.01"`, `step="0.01"`. No upper bound — a `Consistency` goal of `500%` is accepted client-side and by the DB (`target_value > 0` is the only CHECK) |
| `create-date` | date input | `Target date (optional)` | — | sets `targetDate` | local | `min={today()}`; empty is sent as `null`. DB additionally enforces `target_date >= starts_on` |
| `create-submit` | button (`.btn-primary`) | `Create goal` | idle / busy | `goalRepository.create(...)` then reload | `goals` + `goal_events` via the `goal_create` RPC | `disabled` while `busy`; label does **not** change to a working state |
| `list-empty` | text | `No goals yet. Choose one measurable target to begin.` | — | — | — | shown when the goal list is empty |
| `card-type` | h3 | `GOAL_DEFINITIONS` label, falling back to the raw `goal_type` | — | — | — | always |
| `card-target` | text | `<target_value.toLocaleString()> <suffix>` | — | — | — | suffix is `undefined` if the definition is missing |
| `card-status` | chip | raw status value (`active`, `paused`, `completed`, `cancelled`) | four states, styled by `status-<value>` class | — | — | always; text is present, so it does not rely on color alone |
| `card-dates` | text | `Started <locale date>` + optional ` · target <locale date>` | — | — | — | Parsed as `` `${date}T00:00:00` `` — **local** midnight, unlike the weekly report's UTC parsing. See § 12 |
| `card-action` | button | `Pause` \| `Resume` \| `Complete` \| `Cancel` | idle / busy | `goalRepository.transition(goal, status)` then reload | `goals` + `goal_events` via `goal_transition` | From `availableGoalActions(goal.status)`: **3** actions for `active` and `paused`, **0** for `completed` and `cancelled`. All `disabled` while `busy`. `Cancel` uses class `goal-cancel`; the other three use `link-button` |
| `card-history` | `<details>` | `History (<n>)` | collapsed / expanded | — | — | Always rendered, including at zero events |
| `hist-row` | list item | `<previous> → <new>` or `Created <new>`, plus a `<time dateTime={occurred_at}>` | — | — | — | Ordered newest-first, inherited from the repository's `occurred_at desc` ordering |
| `state-loading` | page | `Loading goals…` | — | — | — | Replaces the page only while `snapshot` and `error` are both falsy |

`Complete` and `Cancel` are intercepted by a browser `window.confirm` before firing — see § 6
Destructive.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Goals + goal events | `goalRepository.list(user.id)` | `lib/repository/goalRepository` | Supabase-first, **Dexie fallback** | async |
| Type metadata (label, unit, suffix) | `GOAL_DEFINITIONS` | `lib/goals` | — | **pure const** |
| Legal next statuses | `availableGoalActions(status)` | `lib/goals` | — | **pure** |

`list` issues two parallel Supabase queries (`goals` ordered by `updated_at desc`, `goal_events`
ordered by `occurred_at desc`); on success it writes both into one Dexie `rw` transaction over
`goals` + `goalEvents` and returns the remote rows. On any remote error it reads the Dexie mirror and
returns it if non-empty, otherwise rethrows (`goalRepository.js:5-23`). Signatures in
`LIB_API_INDEX.md`.

Events are grouped per goal in the page via a `Map` built from a `filter` per goal
(`GoalsPage.jsx:46`) — O(goals × events), fine at this scale.

### Writes

| Mutation | Call | Idempotency / boundary |
|---|---|---|
| Create a goal | `goalRepository.create({ type, targetValue, unit, startsOn, targetDate })` → `goal_create` RPC | Client-generated `crypto.randomUUID()` id; `p_idempotency_key = 'goal-create:<id>'`; separate `p_event_id` and `p_event_idempotency_key = 'goal-event:create:<id>'`. The RPC inserts the goal **and** its `active` creation event in one server transaction |
| Transition a goal | `goalRepository.transition(goal, nextStatus)` → `goal_transition` RPC | Fresh `eventId` per attempt; `p_idempotency_key = 'goal-event:<eventId>'`; `p_expected_version = goal.version`; `p_source = 'manual_entry'` |

Both RPCs are `security invoker` public wrappers over `security definer` `private.*` functions with
`set search_path = ''` (`20260716220000_...:140-232`). The server owns every invariant:

- **Ownership** — `auth.uid()` is the only subject; `unauthenticated` is raised when it is null.
- **Idempotency** — a replayed key returns the existing row, or raises `idempotency_key_conflict` if
  the key was reused for a different goal or status.
- **One active goal per type** — enforced by `goals_one_active_type_idx` **and** by an explicit
  advisory-lock-guarded check that raises `active_goal_exists`, on both create and resume.
- **Optimistic concurrency** — `version_conflict` when the client's `version` is stale.
- **Legal transitions** — `invalid_goal_transition` for anything outside active↔paused and
  either → completed/cancelled.
- **Append-only events** — `grant select on public.goals, public.goal_events to authenticated` and
  nothing more (`:135`); clients cannot insert, update, or delete either table directly. The RPCs are
  the only write path.

This is the most rigorously contracted write path in the ME section, and the closest any ME screen
comes to `PHASE_A_ARCHITECTURE.md` § 14's requirements (expected version, occurred time, source,
idempotency key, paired current-record + append-only-event write). It still differs from § 14 in one
respect: there is no local Dexie transaction and no outbox, so a write is remote-or-nothing.

### Offline

**Reads survive; writes do not.** `goalRepository.list` falls back to the Dexie mirror
(`LIB_API_INDEX.md` classifies it **Both — remote-first, local fallback**), so an offline visit shows
the last synced goals and history. `create` and `transition` call `client.rpc(...)` directly with no
outbox, so both reject offline and surface a raw network message in `err-inline`. The optimistic
`busy` flag clears correctly in the `finally` block, so the page is not left stuck.

None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 is displayed, so a user reading a
cached goal list offline has no indication the data is not live.

## 6. Flow paths

**Happy path.** Arrive from ME → `list` resolves → form and goal cards render → pick a type, enter a
target, optionally a date → `Create goal` → the RPC inserts the goal plus its creation event → `load()`
re-reads → the new card appears with `active` status and a one-entry history.

**First run / empty.** `list` returns `{ goals: [], events: [] }`. The create form renders in full and
`list-empty` renders in place of the cards (`S-EMPTY`, `GoalsPage.jsx:61` — `No goals yet. Choose one
measurable target to begin.`, one of the fourteen bare-`<p>` instances the row catalogues rather than a
`.empty-state` block). The form is the primary affordance on an empty screen, which is the right
emphasis, and the copy carries its own next action — better than the row's average even though the
markup is not.

**Error.** `S-ERR-INLINE` (`GoalsPage.jsx:49`) — every failure renders inline via `err-inline` and
**leaves the rest of the page intact** — the form keeps its values, the cards stay rendered, the user
can retry immediately. **This screen is deliberately outside `S-ERR-BLOCK`**, one of the minority the
row does not list among its 19. That is materially better than `settings` (which blanks the page on any
error) and better than `me-root` / `profile-details` / `trophy-room` (which blank the page on load
failure). Note the loading guard is `if (!snapshot && !error)` (`:44`), so a load failure falls through
to a rendered page with an empty goal list plus the error — degraded, but navigable.

`S-RETRY` still binds in the strict sense — there is no retry *control* — but the row's harm does not
land here: the page stays interactive, so re-submitting or re-navigating is reachable without a browser
reload. This screen is one of the few where the `S-RETRY` gap is nominal rather than a dead end.

The messages themselves are the weak point: `active_goal_exists`, `version_conflict`,
`invalid_goal_transition`, `goal_not_found`, `idempotency_key_conflict`, and `unauthenticated` are
machine strings raised by the RPCs and rendered verbatim. See § 12.

**Offline.** `S-OFFLINE-READ` — on the working side: `goalRepository` is cache-backed, so the list
renders from Dexie. `S-STALE` then applies unannounced — nothing on this screen distinguishes a cached
list from a live one, and the row records `rounds-root` as the app's only screen that does. **Diverges
from `S-OFFLINE-WRITE`:** both write paths are direct RPCs with no outbox, so create and transition fail
with a raw network message and nothing queues; no `S-SYNC` label is displayable. As § 5.

**Auth / guard.** `S-AUTH-REQUIRED` — `ProtectedRoute` gates the shell. `user.id` is dereferenced
unconditionally in `load` (`GoalsPage.jsx:22-24`), so there is no anonymous rendering path. The RPCs independently reject
a null `auth.uid()` with `unauthenticated`, so the server does not trust the client's scoping.

**Interlock.** **One active goal per type**, enforced server-side in two places (the partial unique
index `goals_one_active_type_idx` and the advisory-locked existence check in `private.goal_create`).
**The client enforces nothing.** `create-type` lists all four types unconditionally, `create-submit`
is enabled, and the user discovers the constraint only after submitting, as the raw string
`active_goal_exists`. The same rule is re-checked on resume: reactivating a paused goal whose type
already has an active goal raises `active_goal_exists` too.

This is the inverse of standing divergence #6's stated pattern ("app-side disabling **AND** a DB
`CHECK`") for the 35-disc and 100-putt interlocks: here only the database half exists. See § 11
T-goals-1.

`S-INTERLOCK-CAP` surveys three ceilings and does not include this one, which is a fourth: a cardinality
ceiling of one active goal per type. It belongs in the row's tally and is its **worst** case on the
row's own criterion — the row's three caps are all "enforced, inconsistently pre-empted," while this one
is enforced with *no* app-side pre-emption whatsoever. Noted in `_corrections/state-citations-2.md`.

**Destructive.** `Complete` and `Cancel` are terminal — `TRANSITIONS` gives both an empty set of
successors (`lib/goals.js:19-24`), and the server enforces the same. Both are gated by
`window.confirm(`${actionLabel[status]} this goal? This status is final.`)`
(`GoalsPage.jsx:38`) — so the prompts read `Complete this goal? This status is final.` and
`Cancel this goal? This status is final.`

`S-CONFIRM` — this is the second of the row's three `window.confirm` sites. A native `window.confirm` is
a blocking, unstyled browser dialog: it cannot be themed, it does not respect the app's sheet contract
in `PHASE_A_ARCHITECTURE.md` § 12, its focus behavior is browser-defined, and it looks nothing like
`DeleteAccountPanel`'s typed-phrase pattern (`S-CONFIRM-PHRASE`) — the only other destructive
confirmation in the app. The row's `contract-violation` verdict applies here without divergence: no
focus entry or return, no inert background, no 320px or reduced-motion handling, and `SheetHost` shell-
owned and unused for it. `COMPONENT_LIBRARY.md` § Gaps records that there is no
shared confirm dialog; this screen is the reason it is needed.

Nothing is deleted: a cancelled goal keeps its row and its full event history, consistent with the
append-only schema (standing divergence #3).

## 7. Dependencies

### Schema

All from `20260716220000_phase_d3_goal_report_contracts.sql`:

- `goals` (`:24-53`) — `goal_type` CHECK over four values, `target_value numeric(12,2) > 0`,
  `target_unit` CHECK, a paired CHECK forcing `goal_type`↔`target_unit` consistency, a status/timestamp
  consistency CHECK (a `paused` goal must have `paused_at` and no terminal timestamp, etc.),
  `version > 0`, unique `create_idempotency_key`, and `unique (id, user_id)` so `goal_events` can carry
  a composite owner-checked FK.
- `goals_one_active_type_idx` (`:56-57`) — partial unique index on `(user_id, goal_type) where status
  = 'active'`. **This is the interlock.**
- `goal_events` (`:60-75`) — immutable transition log with `previous_status`/`new_status`,
  `occurred_at` vs `recorded_at`, a `source` CHECK (`manual_entry`, `manual_correction`,
  `system_inference`, `admin_repair`), optional `reason`, `metadata` JSONB, unique `idempotency_key`,
  composite FK to `(goals.id, goals.user_id)`, and a CHECK forbidding a no-op transition.
- RLS: select-own only on both tables; **no insert/update/delete policy for `authenticated`**, and the
  grant is `select` only (`:135`).
- `public.goal_create` / `public.goal_transition` — invoker wrappers over `private.*` definers
  (`:140-232`); direct execute on the `private` functions is revoked (`:230-233`).

Dexie mirror: `goals` and `goalEvents` stores (`src/lib/db/dexieDb.js:260-261`), indexed on
`[user_id+status]` and `[goal_id+occurred_at]`.

### Library

`lib/goals` (`GOAL_TYPES`, `GOAL_STATUSES`, `GOAL_DEFINITIONS`, `availableGoalActions` — plus
`canTransitionGoal`, `transitionGoal`, and `goalProgress`, **none of which this page imports**),
`lib/repository/goalRepository` (`list`, `create`, `transition`). Signatures in `LIB_API_INDEX.md`.

### Components

**N/A** — this page imports no components from `src/components/`. Every element is hand-rolled markup,
including the status chip, the action buttons, and the history disclosure. It is one of very few
component-free pages in the app.

### Screens

`me-root` links in. `profile-details`' `Goals` section edits `profiles.target_rating`, which overlaps
conceptually with a `target_rating`-typed goal here and is not reconciled with it — see § 12.

Nothing consumes goals: no screen reads the `goals` table other than this one, and no metric, report,
or notification references a goal. `weekly-reports` does not mention them.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 12 (presentation/accessibility) and § 14 (repository/transaction contract
— partially met, see § 5). `SCREEN_SPECS.md` standing divergence #3 (append-only schema) and #6
(hard interlocks with both app-side and DB enforcement — **only half-met here**). No blocking ADR.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- Every form control has an explicit `<label htmlFor>` / `id` pair; the target label's suffix updates
  with the selected type, so the accessible name stays accurate.
- The goal list is a `<section aria-labelledby="goal-list-title">`.
- History uses a native `<details>`/`<summary>`, which is keyboard-operable and announces its expanded
  state for free — the correct primitive, and better than a hand-rolled disclosure.
- Event rows use `<time dateTime={occurred_at}>` with a machine-readable attribute alongside the
  localized text.
- `card-status` carries the status as text inside the chip, so it does not rely on color alone.
- **Gap — the destructive confirmation is `window.confirm`.** It is unstyled, blocking, and outside the
  app's sheet contract; focus behavior on dismissal is browser-defined rather than returning to the
  trigger as § 12 requires.
- **Gap — `err-inline` has no `role="alert"`.** An `active_goal_exists` failure after tapping
  `Create goal` is announced only if the user navigates to it. Two panels on `/profile/settings` do
  this correctly; this page does not.
- **Gap — no busy announcement.** `create-submit` keeps the label `Create goal` while `busy` is true
  (it only goes `disabled`), unlike `WeeklyReportsPage`'s `Generating…`. A slow create is silent.
- **Gap — the action button row has no group label.** Three sibling buttons per card are distinguished
  only by their own text and the card's heading; there is no `aria-labelledby` tying the action group
  to the goal it acts on, so a screen-reader user hearing "Cancel" out of context has no goal name.
- **Gap — `Cancel` collides with the universal dismiss verb.** In a card of three buttons, `Cancel`
  means "permanently cancel this goal," and it is immediately followed by a `window.confirm` whose own
  dismiss button is also labeled Cancel.
- Heading tree is well-formed: `h1` from `GlobalHeader.jsx:13`, two `<h2>`s, one `<h3>` per card.

## 9. Events and telemetry

**Lifecycle events:** every create and every transition writes exactly one `goal_events` row inside
the RPC's transaction, carrying `previous_status`, `new_status`, `occurred_at`, `recorded_at`,
`source: 'manual_entry'`, and an idempotency key. This is the app's second append-only event ledger
after `activity_state_events`, and it is fully rendered in the UI — `card-history` is the audit trail,
visible to the user, which very few screens offer.

The `source` CHECK admits `manual_correction`, `system_inference`, and `admin_repair`; this screen
only ever writes `manual_entry`, and `reason` and `metadata` are always `null`/`{}`
(`goalRepository.js:42-43`). The correction and inference paths the schema anticipates have no UI.

**Metrics:** none emitted (`PHASE_A_ARCHITECTURE.md` § 5). No goal is registered as a metric subject
and no `calculation_version` applies.

**Notifications:** none produced or consumed (§ 7). There is no goal category in
`NOTIFICATION_PREFERENCE_CATEGORIES`, so a goal cannot remind you of itself.

## 10. Tests

### Existing coverage

| Test file | What it covers |
|---|---|
| `src/lib/goals.test.js` | Pause/resume allowed, terminal transitions rejected; version and lifecycle timestamps set deterministically; `goalProgress` clamps and rejects unusable targets; `availableGoalActions` per state |
| `src/lib/repository/goalRepository.test.js` | Repository behavior against a stubbed client/database |
| `src/lib/phaseD3ContractsMigration.test.js` | The migration contract: owner-scoped RLS on all four D3 tables, ≥7 `auth.uid() = user_id` predicates, the three indexes, select-only grants on `goals`/`goal_events`, no update/delete grant, `auth.uid()` in the functions, `version_conflict`, `security definer set search_path = ''`, and the `private.goal_transition` revoke |

Confirmed by reading the page's imports. `TEST_MAP.md` § ME's row for `goals` is accurate, and this is
the **best-covered screen in the ME section** — the pure lifecycle, the repository, and the migration
contract are all pinned.

**Not covered:** no page or component test (consistent with `TEST_MAP.md` § The headline); nothing
asserts the page renders the actions `availableGoalActions` returns; nothing exercises the
`active_goal_exists` path end to end.

Note that `goals.test.js` covers `transitionGoal`, `canTransitionGoal`, and `goalProgress` — three
functions with **no non-test callers anywhere in `src/`**. The tested pure lifecycle and the shipped
server-side lifecycle are two independent implementations of the same rules that agree today by
inspection, not by construction. See § 12.

### Acceptance criteria

1. A fresh account renders the create form plus `No goals yet. Choose one measurable target to begin.`
2. Creating a goal produces exactly one card with status `active` and a history containing one
   `Created active` entry.
3. Selecting each of the four types updates the target label suffix to `rating`, `sessions/week`,
   `putts/week`, and `%` respectively.
4. An `active` card offers exactly `Pause`, `Complete`, `Cancel`; a `paused` card offers `Resume`,
   `Complete`, `Cancel`; `completed` and `cancelled` cards offer none.
5. `Complete` and `Cancel` prompt for confirmation and take no action when dismissed.
6. Every transition appends one history entry showing `<previous> → <new>`.
7. Creating a second goal of a type that already has an active goal fails and leaves the form and the
   existing cards intact.
8. Resuming a paused goal whose type already has another active goal fails the same way.
9. An offline visit renders the cached goal list from Dexie.
10. *Currently failing as a usability criterion.* The message a user sees when 7 or 8 occurs is
    understandable English rather than `active_goal_exists`.

### E2E critical paths

- Create → pause → resume → complete, verifying the card, the actions, and the four history entries at
  each step.
- Two-tab concurrency: transition the same goal in two sessions and confirm the second gets
  `version_conflict` rather than silently overwriting.
- Interlock: create an active goal, then attempt a second of the same type.
- Offline: load from cache, attempt a create, confirm the failure is contained and the page stays
  usable.
- Idempotency: replay `goal_create` with the same key and confirm one goal, not two.

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries. See
`TEST_MAP.md` § E2E backlog.

## 11. Tasks

#### T-goals-1 — Enforce the one-active-goal-per-type interlock in the UI

- **Capability:** `ui-routine`
- **Touches:** `src/pages/GoalsPage.jsx`
- **Done when:** A type that already has an active goal is disabled in `create-type` (or the submit is
  blocked) with a visible reason, so the constraint is discoverable before submission — matching
  standing divergence #6's "app-side disabling AND a DB CHECK" pattern.
- **Verify:** `npm test` with a page-level test asserting the disabled option; manual check at
  `/profile/goals`.
- **Commit:** `feat: disable goal types that already have an active goal`

#### T-goals-2 — Translate RPC error codes into user-facing copy

- **Capability:** `ui-routine`
- **Touches:** `src/pages/GoalsPage.jsx`, `src/lib/goals.js`
- **Done when:** `active_goal_exists`, `version_conflict`, `invalid_goal_transition`, `goal_not_found`,
  `idempotency_key_conflict`, and `unauthenticated` each render as a sentence a player can act on;
  unknown codes fall back to the raw message rather than being swallowed.
- **Verify:** `npm test` covering the mapping table, including the unknown-code fallback.
- **Commit:** `feat: show readable goal error messages`

#### T-goals-3 — Replace `window.confirm` with the app's confirmation pattern

- **Capability:** `ui-interaction`
- **Touches:** `src/pages/GoalsPage.jsx`, plus a new shared confirm component
- **Done when:** Completing or cancelling a goal opens an in-app confirmation that satisfies
  `PHASE_A_ARCHITECTURE.md` § 12 (focus enters and returns to the trigger, background inert), and
  `window.confirm` no longer appears in `src/pages/`.
- **Verify:** `npm run lint`, a component test for the confirm, and a VoiceOver pass on the flow.
- **Commit:** `feat: add a shared destructive confirmation dialog`
- **Note:** `COMPONENT_LIBRARY.md` § Gaps records the absent shared confirm; this task is its first
  consumer.

#### T-goals-4 — Announce goal errors and the busy state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/GoalsPage.jsx`
- **Done when:** `err-inline` carries `role="alert"` and `create-submit` shows a `Creating…` label
  while busy, matching `WeeklyReportsPage`'s `Generating…`.
- **Verify:** `npm run lint` plus a VoiceOver pass on a forced failure.
- **Commit:** `fix: announce goal creation state and failures`

#### T-goals-5 — Resolve the dead pure lifecycle

- **Capability:** `pure-logic`
- **Touches:** `src/lib/goals.js`, `src/pages/GoalsPage.jsx`
- **Done when:** `canTransitionGoal`, `transitionGoal`, and `goalProgress` are either consumed by the
  page (client-side pre-validation and a progress readout) or deleted along with their tests, so the
  repo does not carry two independent lifecycle implementations.
- **Verify:** `npm test`; `grep -rn "transitionGoal\|goalProgress" src/` returns only intended callers.
- **Commit:** `refactor: reconcile the goal lifecycle helpers with the shipped page`
- **Blocked by:** § 12 open question 2.

## 12. Open questions

1. **Goals have no progress.** `goalProgress(currentValue, targetValue)` exists and is tested
   (`lib/goals.js:43-46`, `goals.test.js:17`) but **has no caller anywhere in `src/`**, and no schema
   column or query supplies a `currentValue`. Nothing measures putts per week against a
   `putting_volume` goal, or the current rating against a `target_rating` goal. The screen is a
   commitment register: you declare a target, then manually decide it is complete. Is progress
   intended, and if so what supplies the current value — `weekly_report_snapshots.metrics`,
   `buildCareerSummary`, or a new metric registry entry per `PHASE_A_ARCHITECTURE.md` § 5?
2. **Two lifecycle implementations.** `lib/goals.js` implements the state machine in JS
   (`TRANSITIONS`, `canTransitionGoal`, `transitionGoal`) with tests, while
   `private.goal_transition` implements the same machine in PL/pgSQL — and the shipped page uses only
   the server's. They agree today, but nothing enforces that they keep agreeing; adding a state to one
   would not fail the other's tests. Which is authoritative?
3. **`target_rating` exists in two unrelated places.** `profiles.target_rating` is edited on
   `/profile/details` and rendered on `me-root`'s rating bar; a `target_rating`-typed row in `goals`
   is created here and rendered nowhere else. A user can set 900 in one and 950 in the other with no
   warning and no reconciliation. Should the goal write through to the profile column, should the
   profile field link here, or should one be retired?
4. **Date parsing differs from the weekly report's.** This page parses goal dates as
   `` new Date(`${goal.starts_on}T00:00:00`) `` — **local** midnight (`GoalsPage.jsx:65`) — while
   `WeeklyReportsPage.jsx:5` parses report dates as `` `${value}T00:00:00Z` `` with
   `timeZone: 'UTC'`. Two ME screens render `date` columns with two different interpretations. For a
   user west of UTC a goal `starts_on` can display as the previous day relative to how the same date
   would render on the reports screen.
5. **`today()` uses the device timezone, not `profiles.timezone`.** `GoalsPage.jsx:6-10` derives
   `startsOn` and the date input's `min` from the device clock, while `/profile/settings` establishes a
   reporting timezone that governs weekly report boundaries. A traveling user can create a goal whose
   `starts_on` disagrees with their own reporting calendar.
6. **No upper bound on `target_value`.** `create-target` has `min="0.01"` and no `max`; the DB CHECK is
   only `target_value > 0`. A `Consistency` goal of `500%` or a `Target rating` of `0.01` is accepted
   and rendered. The `%` and `rating` units imply bounds nobody applies.
7. **Terminal is truly terminal, with no correction path.** A goal completed or cancelled by mistake
   cannot be reopened: `TRANSITIONS` gives both empty successor sets and the RPC enforces it. The
   `goal_events.source` CHECK anticipates `manual_correction` and `admin_repair`, but no UI writes
   them. Given the app's stated correction discipline for activities, is an irreversible goal state
   intended?

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 has no goals screen
among its 21; the only adjacent element is Screen 11's target-rating progress bar, which shipped as
`profiles.target_rating` on `me-root` and `profile-details` rather than as a goal.

This screen is a Phase D3 addition (`PRODUCT_ROADMAP.md:124-125`, "goals pause/history", COMPLETE
2026-07-16), built alongside notification preferences and weekly report snapshots under one migration.
Its design authority is that migration's contract, not the blueprint.

Standing divergences #1 (React/Vite, not Expo) and #3 (append-only schema) apply generally; #6's
"app-side disabling AND a DB CHECK" rule is stated for the 35-disc and 100-putt interlocks but its
principle is violated here — see § 6 Interlock and T-goals-1.
