# Profile Details

| Field | Value |
|---|---|
| Route id | `profile-details` |
| URL pattern | `/profile/details` |
| Section | `me` |
| Shell | `standard` |
| Header title | `Profile` |
| Activity pill | shown |
| Scroll key | `me-profile` |
| Preserves nested state | yes |
| Page component | `src/pages/ProfilePage.jsx` (316 lines) |
| Blueprint screen | Screen 11 — partial; identity half only. See § 13 |
| Verified against | `7351964` |

**`ProfilePage` is not the ME root.** `/profile` renders `CareerHubPage`; this component is one level
down at `/profile/details` (`src/App.jsx:80-82`). Any agent that assumes `ProfilePage` ↔ `/profile`
will wire the wrong screen. See `docs/ui/screens/me-root.md`.

## 1. Purpose

The editable player record: who you are (username, PDGA number, division, handedness), what you can
throw (confidence, specialty shots), your calibrated distances and preferred units, and your target
rating plus private injury notes. It is the input surface that other screens read from — the career
radar, the caddie features, and the distance defaults all consume what is typed here.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Edit profile` link on the ME root | `Link` from `/profile` | `CareerHubPage.jsx:31`. The only in-app entry point |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` runs first |
| Out | Shell back control | `GlobalHeader` → `handleBack()` | Goes to `/profile`, the ME section root — not to browser history |
| Out | Tab re-tap on ME | `TabBar` → `resolveSectionRoot('me')` | Returns to `/profile` |
| Out | Any other tab | `TabBar` | Standard |

There is **no in-page link out of this screen** — no equivalent of `disc-detail`'s `Locker` link. The
shell back control and the tab bar are the only exits.

`preserveNestedState` is `true`. In practice the only state that survives is the shell's stored scroll
offset for `me-profile`; the four `EditableSection` blocks each hold their own local `editing`/`draft`
state, which is destroyed on unmount. **Navigating away mid-edit silently discards the draft** — see
§ 12.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Profile                           [activity pill]| <- Shell-owned header
+-------------------------------------------------------+
|  Add your throwing profile so future features (like   | <- .nudge-banner, conditional
|  caddie recommendations) can use it.                  |
|  [ Fill it out ]                                      | <- scrolls to the Throwing section
+-------------------------------------------------------+
|  Identity                                    [ Edit ] | <- EditableSection #1
|  Username ................. ryanfromatlanta           |
|  PDGA number .............. 142899                    |
|  Division ................. MA2                       |
|  Handedness ............... right                     |
+-------------------------------------------------------+
|  Throwing                                    [ Edit ] | <- EditableSection #2, scroll anchor
|  Backhand confidence ...... reliable                  |
|  Forehand confidence ...... developing                |
|  Specialty shots .......... roller, thumber           |
+-------------------------------------------------------+
|  Calibration                                 [ Edit ] | <- EditableSection #3
|  Backhand max distance .... 380 feet                  |
|  Forehand max distance .... 310 feet                  |
|  C1 comfort distance ...... 28 feet                   |
|  Units .................... feet                      |
+-------------------------------------------------------+
|  Goals                                       [ Edit ] | <- EditableSection #4 (NOT /profile/goals)
|  Target rating ............ 900                       |
|  Injury notes (private) ... —                         |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+

Edit mode for any one section replaces its value list with inputs plus:
|  [ Save ]  Cancel                                     | <- .profile-section-actions
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Profile", activity pill
Nudge banner (.nudge-banner) — conditional
  nudge-copy ........... "Add your throwing profile so future features (like caddie
                          recommendations) can use it."
  nudge-cta ............ button "Fill it out", scrolls to the Throwing section
Identity (EditableSection, title "Identity")
  ident-view ........... dl of username / pdga_number / division / handedness
  ident-username ....... text input
  ident-pdga ........... text input
  ident-division ....... text input, placeholder "e.g. MA2"
  ident-handedness ..... select: (Not set) | right | left | ambidextrous
Throwing (EditableSection, title "Throwing") — wrapped in the scroll-anchor div
  throw-view ........... dl of bh_confidence / fh_confidence / specialty_shots
  throw-bh ............. select: none | developing | reliable | weapon
  throw-fh ............. select: none | developing | reliable | weapon
  throw-specialty ...... ChipGroup, multi-select: roller | thumber | tomahawk | grenade
Calibration (EditableSection, title "Calibration")
  cal-view ............. dl of bh/fh max distance, C1 comfort, units
  cal-units ............ select: feet | meters
  cal-bh-max ........... number input, min 0
  cal-fh-max ........... number input, min 0
  cal-c1 ............... number input, min 0
Goals (EditableSection, title "Goals")
  goal-view ............ dl of target_rating / injury_notes
  goal-target .......... number input, min 0
  goal-injury .......... textarea, rows 3
Per-section controls (rendered by EditableSection in every block)
  sec-edit ............. "Edit" link-button, view mode only
  sec-save ............. "Save" / "Saving..." button
  sec-cancel ........... "Cancel" link-button
  sec-error ............ p.form-error, edit mode only, from a rejected onSave
Page-replacing states (mutually exclusive with everything above)
  state-error .......... p.form-error with the raw message
  state-loading ........ p.loading "Loading..."
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `nudge-copy` | banner | `Add your throwing profile so future features (like caddie recommendations) can use it.` | present / absent | — | — | rendered when `isThrowingProfileEmpty(profile)` — both confidences unset-or-`none` **and** both max distances falsy |
| `nudge-cta` | button (`.chip`) | `Fill it out` | default / pressed | `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the Throwing wrapper | in-page | always, when the banner is shown |
| `ident-view` | `dl` | 4 `dt`/`dd` pairs | — | — | — | `—` via `display()` for `null`, `undefined`, or `''` |
| `ident-username` | text input | `Username` | — | draft update | `profiles.username` | `htmlFor="username"` / `id="username"` |
| `ident-pdga` | text input | `PDGA number` | — | draft update | `profiles.pdga_number` | text, **not** numeric — no `inputMode`, no keypad |
| `ident-division` | text input | `Division`, placeholder `e.g. MA2` | — | draft update | `profiles.division` | free text, unvalidated |
| `ident-handedness` | select | `Handedness` | — | draft update | `profiles.handedness` | options `Not set` (`''`) + the three `HANDEDNESS_OPTIONS`; `''` violates the DB CHECK — see § 12 |
| `throw-view` | `dl` | 3 pairs; specialty shots comma-joined or `—` | — | — | — | confidences render raw values, defaulting to `none` |
| `throw-bh` / `throw-fh` | select | `Backhand`/`Forehand confidence` | — | draft update | `profiles.bh_confidence` / `fh_confidence` | four `CONFIDENCE_OPTIONS`; no empty option |
| `throw-specialty` | `ChipGroup` | `roller`, `thumber`, `tomahawk`, `grenade` | active / inactive per chip | toggle membership in the draft array | `profiles.specialty_shots` (`text[]`) | always; multi-select. Label is a `<span className="editor-label">`, not a `<label>` |
| `cal-units` | select | `Units` | — | draft update | `profiles.units` | `feet` \| `meters` |
| `cal-bh-max` / `cal-fh-max` / `cal-c1` | number input | `Backhand max distance` / `Forehand max distance` / `C1 comfort distance` | — | draft update | `profiles.bh_max_distance_ft`, `fh_max_distance_ft`, `c1_comfort_ft` | `min="0"`, no `max`, no `step`. **Column names say `_ft` but the value is stored raw in whatever unit is selected** — see § 12 |
| `goal-target` | number input | `Target rating` | — | draft update | `profiles.target_rating` | `min="0"`; `''` normalizes to `null` on save |
| `goal-injury` | textarea | `Injury notes (private — never shown to others)` | — | draft update | `profiles.injury_notes` | `rows={3}`; trimmed, empty → `null` |
| `sec-edit` | link-button | `Edit` | default / pressed | opens edit mode, resets draft from values | local | shown only in view mode |
| `sec-save` | button | `Save` / `Saving...` | idle / saving / error | `upsertProfileFields` via the section's `onSave` | `profiles` | `disabled` while saving; a throw keeps edit mode open and renders `sec-error` |
| `sec-cancel` | link-button | `Cancel` | idle / disabled | resets draft, closes edit mode | local | `disabled` while saving |
| `sec-error` | text | raw `err.message` | present / absent | — | — | rendered inside the section, above the actions |
| `state-error` | page | raw `err.message` | — | — | — | replaces the entire page when the initial `fetchProfile` rejects; no retry |
| `state-loading` | page | `Loading...` | — | — | — | replaces the entire page until `fetchProfile` settles |

Only one section's `Edit` can be usefully open at a time from the user's point of view, but **nothing
enforces it** — all four can be in edit mode simultaneously, each with an independent draft, each
saving independently.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| The full profile row | `fetchProfile(user.id)` | `lib/profile` | Supabase `profiles` | async |
| Nudge visibility | `isThrowingProfileEmpty(profile)` | `lib/profile` | — | **pure** |

One query, one effect, re-run on `user.id` change only (`ProfilePage.jsx:22-26`). `fetchProfile` uses
`maybeSingle()`, so a missing row resolves to `null`; the page substitutes `{ id: user.id }` so a
profile-less account still renders an editable form. Signatures in `LIB_API_INDEX.md`.

`fetchProfile` uses `select('*')`, which is safe **only** because it is always RLS-scoped to the
caller. `src/lib/profile.js:3-6` carries a standing warning: any future shared or social profile view
must use an explicit column list excluding `injury_notes`.

### Writes

| Mutation | Call | Notes |
|---|---|---|
| Save Identity | `upsertProfileFields(user.id, draft)` | Draft passed through unchanged — empty strings are written as `''`, not `null`. See § 12 |
| Save Throwing | `upsertProfileFields(user.id, draft)` | Draft passed through unchanged |
| Save Calibration | `upsertProfileFields(user.id, {...})` | `ProfilePage.jsx:201-211` normalizes `''` → `null`, coerces numbers, **and stamps all three `*_source` columns to `'self_reported'`** |
| Save Goals | `upsertProfileFields(user.id, {...})` | `ProfilePage.jsx:276-281` normalizes: `target_rating` `''` → `null`; `injury_notes` trimmed, empty → `null` |

`upsertProfileFields` is a single Supabase `upsert` on conflict `id`, returning the updated row, which
replaces local state (`ProfilePage.jsx:28-31`). There is **no idempotency key, no version check, and no
local transaction** — this screen predates and sits outside the repository/transaction contract in
`PHASE_A_ARCHITECTURE.md` § 14. A concurrent edit on another device is silently last-write-wins.

Only Calibration and Goals normalize their drafts. Identity and Throwing pass the raw draft, which is
why an emptied Identity field persists as `''` rather than `null` and then renders `—` only because
`display()` treats `''` as empty. See § 12.

### Offline

`lib/profile.js` is classified **Supabase only — no local mirror** in `LIB_API_INDEX.md`. With no
network the initial `fetchProfile` rejects and the page renders `state-error` as the whole page. A
save attempted offline rejects inside `EditableSection.save()`, which keeps edit mode open and renders
`sec-error` with the raw Supabase message — the draft is preserved, which is the correct behavior, but
nothing queues it and nothing retries. None of the four calm states from
`PHASE_A_ARCHITECTURE.md` § 12 is displayed.

## 6. Flow paths

**Happy path.** Arrive from ME → `fetchProfile` resolves → four sections render read-only → tap `Edit`
on one → the draft initializes from committed values → change fields → `Save` → `upsertProfileFields`
returns the updated row → local state replaces → edit mode closes → view re-renders from the server
row.

**First run / empty.** A never-edited account has no throwing data, so `nudge-copy` renders at the top
with a `Fill it out` button that smooth-scrolls to the Throwing section. Every field reads `—` except
the two confidences (which default to `none`) and `units` (which defaults to `feet`). The nudge
disappears on the next render after either confidence moves off `none` or either max distance is set.

**Error.** A rejected initial `fetchProfile` renders the raw error message as the entire page — no
header content, no retry control, no navigation but the shell. A rejected *save* is contained: the
section stays in edit mode, the draft is intact, and `sec-error` renders the raw message above the
actions. This is a materially better error posture than the pre-load case and than
`disc-detail`'s equivalent.

**Offline.** As § 5. Reads fail hard; writes fail visibly but non-destructively.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced unconditionally
(`ProfilePage.jsx:23`), so there is no anonymous rendering path. A Supabase anonymous session renders
normally and can edit its own profile.

**Interlock.** **N/A** — no cap or constraint is enforced on this screen. The DB CHECK constraints on
`handedness`, `bh_confidence`, `fh_confidence`, `units`, and the `*_source` columns
(`phase_a_profile_schema.sql:5-16`) are the only enforcement, and a violation surfaces as a raw
Postgres error string in `sec-error`. See § 12.

**Destructive.** **N/A** — no delete, retire, clear, or discard action exists here. `Cancel` discards a
draft without confirmation, which is conventional for an inline edit and not treated as destructive.
Account deletion lives on `/profile/settings`.

## 7. Dependencies

### Schema

`profiles`, specifically:

- Base columns (`supabase_schema.sql:9-12`): `username` (unique), `pdga_number`, `division`,
  `home_course_id`.
- Phase A profile expansion (`phase_a_profile_schema.sql:4-17`): `handedness`, `bh_confidence`,
  `fh_confidence`, `bh_max_distance_ft`, `bh_max_distance_source`, `fh_max_distance_ft`,
  `fh_max_distance_source`, `c1_comfort_ft`, `c1_comfort_source`, `specialty_shots` (`text[]`),
  `target_rating`, `units`, `injury_notes`. Every text enum carries a CHECK; every `*_source` column
  defaults to `'self_reported'` and is constrained to `'self_reported' | 'derived'`.
- `injury_notes` is marked PRIVATE at `phase_a_profile_schema.sql:17` — never selected in any shared or
  social view.
- Column-level UPDATE grants: `layer5_gamification_hardening.sql:170-176` revokes the table-wide
  UPDATE from `authenticated` and re-grants an explicit column list. **Every column this screen writes
  is in that list.** (Two columns written by `/profile/settings` are not — see
  `docs/ui/screens/settings.md` § 12.)

### Library

`lib/profile` (`fetchProfile`, `upsertProfileFields`, `isThrowingProfileEmpty`). That is the entire
library surface — this page imports no repository and no insight module. Signatures in
`LIB_API_INDEX.md`.

### Components

`EditableSection` (×4) and `ChipGroup` (×1, inside the Throwing edit form). Details in
`COMPONENT_LIBRARY.md`.

### Screens

- `me-root` links in and consumes what is written here (`username`, `pdga_number`, `division`,
  `target_rating`).
- `settings` writes the same `profiles` row through the same `upsertProfileFields`, for a disjoint set
  of columns (`timezone`, `round_turn_prompt_enabled`). Two screens, one row, no coordination.
- `goals` (`/profile/goals`) is a **different feature** from this page's `Goals` section: that screen
  owns the `goals` table and its lifecycle; this section owns `profiles.target_rating`. The shared
  name is a real ambiguity — see § 12.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 12 (presentation/accessibility) and § 13 (shell boundaries). § 14's
repository/transaction contract is **not** followed here and predates it — recorded as a gap in § 12,
not restated. No blocking ADR.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Every input in all four `EditableSection` blocks has an explicit `htmlFor`/`id` pair** — 12 of the
  13 controls. This is the same pattern `disc-detail.md` § 8 calls out as the one to copy, and this
  page is where it originated.
- View mode uses real `<dl>`/`<dt>`/`<dd>` markup, so each label/value pair is semantically associated
  rather than visually implied.
- The one exception is `throw-specialty`: its label is `<span className="editor-label">Specialty
  shots</span>` (`ProfilePage.jsx:175`), not a `<label>`, and `ChipGroup` renders plain `<button>`
  elements with no `role="group"` and no group name. Screen-reader users hear four unlabeled toggle
  buttons with no announced grouping.
- **Gap — `ChipGroup` emits no selection semantics.** Active state is a class name only, with no
  `aria-pressed`. `COMPONENT_LIBRARY.md` § Gaps item 10 records this as a repo-wide issue across five
  hand-rolled variants; it lands on this screen through `throw-specialty`.
- **Gap — no focus management on the view↔edit transition.** `EditableSection` toggles the rendered
  subtree without moving focus, so a keyboard or screen-reader user who activates `Edit` is left with
  focus on a button that no longer exists. `COMPONENT_LIBRARY.md`'s `EditableSection` entry records
  the same finding.
- **Gap — `sec-error` is a plain `<p className="form-error">` with no `role="alert"`** and no
  `aria-describedby` from the failing input, so a save failure is announced only if the user happens to
  navigate to it. `DeleteAccountPanel` and `DataExportPanel` on `/profile/settings` both do this
  correctly; this page does not.
- **Gap — duplicate `<h1>`.** `GlobalHeader.jsx:13` renders the route title as an `<h1>`; this page
  renders no `<h1>` of its own but four `<h2>` section headings, so the heading tree is
  `h1 (shell) → h2 ×4`. That is well-formed, unlike `me-root` / `trophy-room` / `weekly-reports`, and
  is the correct pattern.
- `nudge-cta` calls `scrollIntoView({ behavior: 'smooth' })` unconditionally, ignoring
  `prefers-reduced-motion`, which § 12 requires respecting.

## 9. Events and telemetry

**N/A** — this screen emits no metrics (`PHASE_A_ARCHITECTURE.md` § 5), writes no lifecycle events
(§ 2), and produces or consumes no notifications (§ 7). Profile edits are not audited: there is no
`audit_events` row, no previous/new value capture, and no reason field, despite
`PRODUCT_ROADMAP.md` § Cross-cutting rules stating that "user corrections preserve previous/new
values, effective time, recorded time, source, and reason." The three `*_source` columns are the only
provenance this screen records, and they are hardcoded to `'self_reported'`.

## 10. Tests

### Existing coverage

**None.** There is no `src/lib/profile.test.js` and no page or component test for `ProfilePage.jsx`.
`TEST_MAP.md` § ME records `profile-details` as `**none**`, and reading the page's imports confirms it:
the only library it consumes is `lib/profile`, which has no test file.

This makes `profile-details` one of the least-verified shipped screens in the app. `isThrowingProfileEmpty`
is a pure function with four branches and zero tests; `upsertProfileFields` is the write path for 13
columns and has zero tests.

### Acceptance criteria

1. An account with no `profiles` row renders all four sections in view mode with `—` values rather
   than crashing, and a save creates the row.
2. `isThrowingProfileEmpty` is true — and the nudge renders — when both confidences are `null` or
   `none` and both max distances are falsy; setting either confidence to `developing` or either max
   distance to a number hides it.
3. `Fill it out` scrolls the Throwing section into view.
4. Saving Calibration with all three distance fields emptied writes `null` (not `0`, not `''`) to all
   three columns and `'self_reported'` to all three `*_source` columns.
5. Saving Goals with an empty `injury_notes` writes `null`; with whitespace only, also `null`.
6. A failed save keeps the section in edit mode, preserves the draft, and shows the error.
7. Toggling a specialty-shot chip twice returns the array to its previous contents.
8. *Currently ambiguous.* Saving Identity with an emptied `Username` writes `''`, not `null`. Whether
   that is acceptable is open — see § 12.
9. *Currently failing.* Selecting `Not set` for handedness on a profile that previously had one
   attempts to write `''`, which violates the `handedness` CHECK constraint. See § 12.

### E2E critical paths

- Edit → save → reload → value persists.
- Edit → navigate away via the tab bar → return → **draft is gone** (documents current behavior, which
  § 12 questions).
- Offline edit → save → error renders, draft survives → reconnect → save succeeds.
- Nudge lifecycle: fresh account shows it, filling the throwing profile removes it on the next render.
- Handedness `Not set` round-trip (currently expected to fail).

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries. See
`TEST_MAP.md` § E2E backlog.

## 11. Tasks

#### T-profile-details-1 — Add unit tests for `lib/profile`

- **Capability:** `pure-logic`
- **Touches:** `src/lib/profile.test.js` (new)
- **Done when:** `isThrowingProfileEmpty` is covered for all four branches (both confidences unset,
  one set, distances present, `null` profile), and `upsertProfileFields` is covered against a stubbed
  client for the field-normalization contract.
- **Verify:** `npm test`
- **Commit:** `test: cover the profile library`

#### T-profile-details-2 — Fix the handedness "Not set" option

- **Capability:** `ui-routine`
- **Touches:** `src/pages/ProfilePage.jsx`
- **Done when:** Selecting `Not set` writes `null`, not `''`, and a profile that previously had a
  handedness can be returned to unset without a constraint error.
- **Verify:** `npm test` with a case asserting the normalized payload; manual check at
  `/profile/details`.
- **Commit:** `fix: write null when handedness is cleared`

#### T-profile-details-3 — Normalize Identity and Throwing drafts on save

- **Capability:** `ui-routine`
- **Touches:** `src/pages/ProfilePage.jsx`
- **Done when:** Emptied Identity fields write `null` rather than `''`, matching what Calibration and
  Goals already do; a round-trip through save then reload leaves no `''` values in `profiles`.
- **Verify:** `npm test` with a normalization test per section.
- **Commit:** `fix: normalize empty profile fields to null`
- **Blocked by:** § 12 open question 2.

#### T-profile-details-4 — Warn before discarding an open draft

- **Capability:** `ui-interaction`
- **Touches:** `src/components/EditableSection.jsx`
- **Done when:** Unmounting or navigating away with an open, dirty draft either preserves it or prompts;
  § 12's "unsaved text survives accidental dismissal" is satisfied for the four sections on this page
  and for `disc-detail`'s two.
- **Verify:** Manual check at `/profile/details` and `/bag/discs/:id`, plus a component test asserting
  the guard fires on a dirty draft only.
- **Commit:** `fix: protect unsaved profile edits from accidental dismissal`

#### T-profile-details-5 — Announce save failures to assistive tech

- **Capability:** `ui-routine`
- **Touches:** `src/components/EditableSection.jsx`
- **Done when:** `sec-error` carries `role="alert"` so a failed save is announced without the user
  hunting for it.
- **Verify:** `npm run lint` plus a VoiceOver pass on a forced save failure.
- **Commit:** `fix: announce editable-section save errors`

## 12. Open questions

1. **The `Not set` handedness option cannot be saved.** `ProfilePage.jsx:113` renders
   `<option value="">Not set</option>`, and Identity's `onSave` passes the draft through unchanged,
   so selecting it sends `handedness: ''`. `phase_a_profile_schema.sql:5` constrains the column to
   `right | left | ambidextrous` (nullable), and `''` satisfies neither, so the DB rejects it with a
   raw constraint error in `sec-error`. On a profile that never had a handedness the round-trip is
   invisible (the value was already effectively unset and the user has no reason to pick `Not set`),
   which is likely why it survived to production.
2. **Two of four sections normalize their drafts and two do not.** Calibration
   (`ProfilePage.jsx:201-211`) and Goals (`276-281`) convert `''` → `null` and coerce numbers; Identity
   (`62`) and Throwing (`132`) pass the draft straight to `upsertProfileFields`. So an emptied
   `username` persists as `''` while an emptied `target_rating` persists as `null`. `display()` masks
   the difference in the UI, but the database now holds two representations of "unset" for one entity.
   Which is canonical?
3. **The `_ft` columns store whatever unit is selected.** `cal-units` writes `profiles.units`, and the
   three distance inputs write `bh_max_distance_ft`, `fh_max_distance_ft`, and `c1_comfort_ft`
   verbatim with no conversion (`ProfilePage.jsx:203-208`). The view renders `` `${value} ${units}` ``
   (`216-228`), so a user on `meters` sees `120 meters` stored in a column named `_ft`. Any consumer
   reading those columns as feet — and the names invite exactly that — is wrong for metric users. No
   current consumer was found, which is the only reason this has not surfaced.
4. **This page's `Goals` section and the `/profile/goals` screen are different features with the same
   name.** This section edits `profiles.target_rating`; `GoalsPage` owns the `goals` table with its own
   `target_rating` goal *type*, its own lifecycle, and its own event log. A user can set 900 here and a
   conflicting `target_rating` goal there, with nothing reconciling them. Should this section link to
   `/profile/goals`, be renamed, or be merged?
5. **An open draft is silently discarded on navigation.** `EditableSection` holds `draft` in component
   state with no persistence and no guard. `PHASE_A_ARCHITECTURE.md` § 12 requires that "unsaved text
   survives accidental dismissal" — stated for sheets, but the intent plainly covers this. Four
   sections on this screen and two on `disc-detail` share the defect.
6. **Profile writes bypass the § 14 repository/transaction contract entirely.** No idempotency key, no
   expected version, no occurred/recorded time, no source, no installation id, no audit event. § 14
   scopes its requirements to lifecycle transitions, so this is arguably out of contract rather than in
   violation — but `profiles` is user-correctable data, and `PRODUCT_ROADMAP.md`'s correction rule
   speaks to it. Is `profiles` deliberately exempt?

## 13. Blueprint divergence

Blueprint Screen 11 (`MASTER_PROJECT_BLUEPRINT.md:633`) draws identity and career analytics as **one**
screen. The shipped app splits them: analytics on `me-root`, editable identity here. Neither page has
a one-to-one blueprint counterpart, and `SCREEN_SPECS.md:38-39` still marks Screen 11 `IN SCOPE` as a
standalone destination — the distributed model is authoritative per the owner's 2026-07-29 ruling,
logged as C-2 in `docs/ui/_corrections/screen-specs-and-agents.md`.

Divergences specific to the identity half:

| Blueprint Screen 11 intent | Shipped reality on this page |
|---|---|
| Tapping the identity card opens a **zero-typing numeric keypad** for PDGA linkage | `ident-pdga` is an ordinary `<input type="text">` with no `inputMode`, so it raises a full alphabetic keyboard. The blueprint's central zero-typing ergonomic is not honored anywhere on this screen |
| Verified PDGA badge | No verification exists. `me-root` shows a `Linked` badge that means only "a number is present" |
| PDGA data auto-populated by a `fetch-pdga-profile` Edge Function | Standing divergence #7 — manual entry only, scraper deferred |
| Division shown as a constrained value (`MA2`) | Free-text input with an `e.g. MA2` placeholder and no validation |

The Throwing, Calibration, and Goals sections have **no blueprint counterpart at all** — they are
post-blueprint additions from the Phase A profile expansion (`phase_a_profile_schema.sql`), built to
feed future caddie recommendations. The nudge banner exists precisely because that data has no other
capture point.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only schema), and #7 (manual PDGA entry)
apply; see `SCREEN_SPECS.md` § Standing divergences.
