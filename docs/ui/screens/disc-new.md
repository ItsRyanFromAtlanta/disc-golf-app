# Disc New

| Field | Value |
|---|---|
| Route id | `disc-new` |
| URL pattern | `/bag/discs/new?mold=:moldId&plastic=:name` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Add Disc` |
| Activity pill | shown |
| Scroll key | `discs-form` |
| Preserves nested state | **yes** |
| Page component | `src/pages/DiscFormPage.jsx` (213 lines) |
| Blueprint screen | Screen 5 — partial; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

Creation of one or more physical discs from an approved catalog mold. It is creation only — editing an
existing disc's attributes, overrides, photos, and bag memberships happens on `disc-detail`
(`DiscFormPage.jsx:27-28`). Its distinguishing feature is quantity: a player who buys three of the same
mold creates three independently tracked copies in one all-or-nothing submit.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Add a disc` in the locker | `Link` from `/bag/locker` | Primary path; also reachable from `/bag`'s Collection tab, which renders the locker inline |
| In | Plastic row in the Universe accordion | `Link` to `/bag/discs/new?mold=:id&plastic=:name` from `UniverseBrowser.jsx:87` | **The parameterized entry** |
| In | Direct URL / restored session | Route match | `ProtectedRoute`; `useOnboardingGate` may intercept first |
| Out | `Locker` link in the page header | `Link` to `/bag/locker` | The only in-page exit that is not a submit |
| Out | Successful submit, quantity 1 | `navigate('/bag/discs/:id', { replace: true })` | Lands on the new disc's detail page |
| Out | Successful submit, quantity ≥ 2 | `navigate('/bag', { replace: true })` | Lands on the DISCS root, not on any of the created discs |
| Out | Shell back control | `GlobalHeader` → `resolveSectionRoot('discs')` | Returns to `/bag`, not to the locker you came from |
| Out | Tab re-tap on DISCS | `TabBar` → `resolveSectionRoot('discs')` | Returns to `/bag` |

Both post-submit navigations use `{ replace: true }`, so the form is removed from history and a back
press from the destination does not re-enter a submitted form.

**Query parameter contract — `?mold=:moldId&plastic=:name`.** Handled in a `useEffect` keyed on
`[catalog.data, searchParams]` (`DiscFormPage.jsx:43-53`). The Universe hand-off exists so browsing the
catalog can reach creation without building a separate weight-selection drawer:

- `mold` is resolved against `catalog.data.molds` by exact id. A hit calls `setMold(selected)`, which
  puts `MoldPicker` straight into its selected-summary state. A miss sets the error
  `That mold is no longer in the approved catalog.` — the only parameter validation on this screen.
- Resolution waits for the catalog. The effect returns early while `catalog.data` is undefined and
  re-runs when it arrives, so an offline arrival still resolves the mold from the IndexedDB snapshot.
- `plastic` is applied unconditionally, **whether or not `mold` resolved**, and is `decodeURIComponent`
  -ed by the router before it reaches `searchParams.get`. It is free text written straight into
  `form.plastic`; nothing checks it against the mold's normalized plastics.
- `plastic` alone, with no `mold`, is ignored: the effect returns at the `if (!moldId) return` guard
  before reaching the plastic branch.
- The effect re-runs on every `searchParams` identity change and re-applies the plastic, so a
  user-edited plastic field would be overwritten if the query string changed without a remount. In
  practice nothing on this page changes the query string.

`preserveNestedState` is `true`, so scroll position is retained within a shell mount — appropriate for
a 13-field form. It does **not** preserve the form itself: `mold`, `form`, and `quantity` are component
state and are discarded on unmount, with no draft persistence and no warning. See § 12.

## 3. Layout

### 3a. Frame (illustrative)

Mold already selected.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Add Disc                          [activity pill]| <- Shell header
+-------------------------------------------------------+
|  Add Disc                                  [ Locker ] | <- Page header
+-------------------------------------------------------+
|  Innova Thunderbird (9/5/-1/2)          [ Change ]    | <- MoldPicker, selected-summary state
|                                                       |    (search input before selection)
|  Physical copies      [ 1  v ]                        | <- 1..10
|  Each copy gets its own identity, photos, lifecycle,  |
|  and odometer. Creation is all-or-nothing.            |
|                                                       |
|  Nickname             [                        ]      |
|  Plastic              [ Champion              ]       | <- prefilled by ?plastic=
|  Weight (g)           [        ]                      |
|  Color                [                        ]      |
|                                                       |
|  Flight overrides (blank = mold stock: 9/5/-1/2)      |
|  +--------+ +--------+ +--------+ +--------+          |
|  | speed  | | glide  | | turn   | | fade   |          | <- number inputs, step 0.5,
|  | [    ] | | [    ] | | [    ] | | [    ] |          |    placeholder = mold value
|  +--------+ +--------+ +--------+ +--------+          |
|                                                       |
|  Condition            [ new, worn, beat-in... ]       |
|  Status               [ in_locker           v ]       |
|  Acquired on          [ 2026-07-29            ]       |
|  Provenance           [ bought new, traded... ]       |
|  Photo URL            [                        ]      |
|  Notes                [                        ]      |
|                                                       |
|  [ Add 1 physical disc ]                              | <- label pluralizes with quantity
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Add Disc", activity pill
Page header
  hdr-title ............ h1 "Add Disc"
  hdr-locker ........... link to /bag/locker
Form (.putt-form)
  Mold selection (MoldPicker)
    mold-search ........ text input, label "Mold" — search state only
    mold-loading ....... "Loading catalog..."
    mold-result ........ button per matching mold: manufacturer, name, s/g/t/f
    mold-none .......... "No approved molds match."
    mold-error ......... form-error from the catalog query
    mold-selected ...... manufacturer + name + (s/g/t/f) — selected state
    mold-change ........ "Change" — clears the selection back to search
  Quantity
    qty-select ......... select 1..10, label "Physical copies"
    qty-note ........... "Each copy gets its own identity, photos, lifecycle, and odometer.
                          Creation is all-or-nothing."
  Identity fields
    fld-nickname ....... text
    fld-plastic ........ text — prefilled by ?plastic=
    fld-weight ......... number, min 0
    fld-color .......... text
  Flight overrides
    ovr-label .......... "Flight overrides" + "(blank = mold stock: s/g/t/f)" when a mold is selected
    ovr-axis ........... one number input per speed | glide | turn | fade
  Lifecycle fields
    fld-condition ...... text, placeholder "new, worn, beat-in..."
    fld-status ......... select over STATUS_OPTIONS
    fld-acquired ....... date
    fld-provenance ..... text, placeholder "bought new, traded, found..."
    fld-photourl ....... text
    fld-notes .......... textarea, rows 2
  Submission
    err-inline ......... form-error, immediately above the submit button
    cta-submit ......... "Add {n} physical disc(s)" / "Saving..."
```

There is no page-level loading or error state: the form always renders. Catalog loading and catalog
failure are scoped inside `MoldPicker`.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-locker` | link | `Locker` | default / pressed | navigate | `/bag/locker` | always |
| `mold-search` | text input | label `Mold`, placeholder `Search manufacturer or mold name...` | — | `setQuery` | local state | rendered only while no mold is selected |
| `mold-result` | button | `{manufacturer} {mold_name}` + `{s}/{g}/{t}/{f}` | default / pressed | `onSelect(mold)` | `mold` state | results appear only once the query is non-empty; `filterCatalogMolds` returns **approved molds only, all query terms must match, capped at 20** |
| `mold-none` | text | `No approved molds match.` | — | — | — | non-empty query, catalog loaded, zero results |
| `mold-selected` | summary | `{manufacturer} {mold_name} ({s}/{g}/{t}/{f})` | — | — | — | flight numbers shown only when `speed != null` |
| `mold-change` | button | `Change` | default / pressed | `onSelect(null)` | `mold` state | **clears the mold but leaves every other field**, including flight-override placeholders that referenced it |
| `qty-select` | select | label `Physical copies`, options `1`–`10` | — | `setQuantity(Number)` | local state | ceiling is enforced twice: this select, and `buildDiscCopies`'s `count < 1 \|\| count > 10` throw |
| `fld-nickname` | text | label `Nickname` | — | form edit | `discs.nickname` | optional; trimmed to `null` when blank |
| `fld-plastic` | text | label `Plastic` | — | form edit | `discs.plastic` | optional; prefilled from `?plastic=` |
| `fld-weight` | number | label `Weight (g)`, `min="0"` | — | form edit | `discs.weight_grams` | optional; `'' → null`, else `Number(v)` |
| `fld-color` | text | label `Color` | — | form edit | `discs.color` | optional |
| `ovr-label` | text | `Flight overrides` + `(blank = mold stock: {s}/{g}/{t}/{f})` | with / without mold | — | — | the hint renders only when a mold is selected |
| `ovr-axis` | number ×4 | labels `speed`, `glide`, `turn`, `fade` | — | form edit | `discs.override_*` | `step="0.5"`; `placeholder={mold?.[axis] ?? ''}` — blank means "use mold stock". Same semantics as `disc-detail`'s override block |
| `fld-condition` | text | label `Condition`, placeholder `new, worn, beat-in...` | — | form edit | `discs.condition` | optional |
| `fld-status` | select | label `Status`; `in_locker`, `lost`, `retired`, `sold` | — | form edit | `discs.status` | defaults to `in_locker`. Raw enum values shown verbatim, and **`lost` here does not open a Lost & Found case** — § 12 |
| `fld-acquired` | date | label `Acquired on` | — | form edit | `discs.acquired_on` | optional; `'' → null` |
| `fld-provenance` | text | label `Provenance`, placeholder `bought new, traded, found...` | — | form edit | `discs.provenance` | optional |
| `fld-photourl` | text | label `Photo URL` | — | form edit | `discs.photo_url` | optional; the **legacy** photo column. The private three-slot photo manager lives on `disc-detail` and this field feeds its `front` slot fallback |
| `fld-notes` | textarea | label `Notes`, `rows={2}` | — | form edit | `discs.notes` | optional |
| `err-inline` | banner | `Pick an approved mold first.`, `That mold is no longer in the approved catalog.`, or a raw Supabase error | present / absent | — | — | rendered directly above `cta-submit` |
| `cta-submit` | button | `Add {n} physical disc` / `Add {n} physical discs` / `Saving...` | idle / saving | `handleSubmit` | `discs` | `disabled={saving}` only. **Enabled with no mold selected** — the submit handler rejects instead, § 6 |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Mold catalog | `useCatalog()` | `lib/repository/catalogRepository` | **Supabase + Dexie** | React hook |
| Mold search | `filterCatalogMolds(catalog, { query })` | `lib/repository/catalogRepository` | — | **pure** |
| `?mold=` resolution | `catalog.data.molds.find(...)` | — | — | inline |

Signatures in `LIB_API_INDEX.md`. `useCatalog` is called twice on this page — once by `MoldPicker` and
once by `DiscFormPage` itself for parameter resolution — but both share one TanStack query key
(`CATALOG_QUERY_KEY`), so there is one fetch and one cache entry.

**`searchMolds` does not exist.** `SCREEN_SPECS.md:120` and `:163` both cite
`src/lib/discLocker.js` (`searchMolds`) in this screen's REUSE lists; that export was removed in
`6c88410` and mold search has been `catalogRepository.filterCatalogMolds` + `useCatalog()` ever since.
Already logged as `_corrections/lib-api-index.md` item 1 — referenced here, not re-logged.

### Writes

| Mutation | Call | Idempotency | Transaction boundary |
|---|---|---|---|
| Create n physical discs | `createDiscCopies(user.id, fields, quantity)` | client-generated `crypto.randomUUID()` **per copy**, upserted `onConflict: 'id'` | **One Postgres statement.** `buildDiscCopies` materializes n payloads, then a single `supabase.from('discs').upsert(payloads)` writes them together — creation is all-or-nothing, so a caller never reconciles a partially created set |

Validation is split. `buildDiscCopies` throws `Quantity must be between 1 and 10` for a non-integer or
out-of-range count. `handleSubmit` refuses with `Pick an approved mold first.` when `mold` is null.
Everything else is normalized inline: `.trim() || null` for text fields, `v === '' ? null : Number(v)`
for numerics, and `form.acquired_on || null` for the date. A post-write assertion
(`data.length !== payloads.length`) throws `Not every physical disc was returned after creation` — a
guard against a partial upsert that silently returns fewer rows.

The repository/transaction contract is `PHASE_A_ARCHITECTURE.md` § 14. This write **does not follow
it**: it bypasses `discRepository.useCreate`, which exists, wraps this exact operation, and supplies
the outbox and the stable `clientId` (`discRepository.js:20,25`). See § 12.

### Offline

**Browsing works; creating does not.** `useCatalog` reads through the IndexedDB catalog snapshot, so
mold search, the `?mold=` hand-off, and the whole form render offline. `createDiscCopies` is a direct
Supabase upsert with no outbox, so `cta-submit` fails and renders the raw network error in
`err-inline`. Every field the player typed survives in component state — nothing is lost as long as they
do not navigate away — but nothing is queued and there is no retry beyond tapping the button again.

This is the sharpest offline gap in the DISCS section, because the fix already exists in the codebase:
`useCreateDisc` is exported and unused. No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered.

## 6. Flow paths

**Happy path, quantity 1.** Arrive from the locker → type into `mold-search` → pick a mold →
`MoldPicker` collapses to its summary and the override placeholders populate → fill nickname, plastic,
weight → `Add 1 physical disc` → one row is written → redirect to `/bag/discs/:id`.

**Happy path, quantity ≥ 2.** Same, with `qty-select` at 3 → `Add 3 physical discs` → three rows with
three distinct client-generated ids and otherwise identical fields → redirect to `/bag`, because there
is no single disc to land on.

**Universe hand-off.** From `/bag`'s Universe tab, tapping a plastic row arrives with
`?mold=&plastic=`, the mold resolves out of the catalog once it loads, and the plastic field is
prefilled. The player only chooses weight, quantity, and any personal fields.

**First run / empty.** The form is fully usable on a brand-new account — it depends on the shared
catalog, not on the user's data. `MoldPicker` deliberately renders no result list until the query is
non-empty, so the initial state is an empty search box with no browse affordance; a player who does not
know a mold name has to go back to `/bag`'s Universe tab.

**Error.** Three sources, all rendering into one `err-inline` above the button: the missing-mold guard,
the stale-`?mold=` message, and any raw Supabase error from the upsert. The form is never replaced —
this screen has no page-level error state, which is the right shape and the opposite of `discs-root`
and `bag-manage`.

**Offline.** As § 5. Browse and fill work; submit fails with a network error and no queue.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced in `handleSubmit`, and
RLS on `discs` scopes the insert to the caller.

**Interlock.** The quantity ceiling of 10 is enforced twice — `qty-select` offers exactly 1–10, and
`buildDiscCopies` throws outside that range regardless of caller (`discLocker.js:51`). It is a genuine
app-side interlock with a pure, tested guard behind it.

**No bag-capacity interlock applies here, and none is needed:** a created disc joins no bag. Membership
is a separate action on `disc-detail` or in the locker picker. This is why `disc-new` does not appear
in the capacity table in `screens/discs-root.md` § 12 item 1.

**Destructive.** **N/A** — this screen only creates. `mold-change` discards the mold selection without
confirmation, and navigating away discards the entire form without confirmation (§ 12 item 3), but
neither destroys persisted data. This page calls no `window.confirm` and is not among the three named
in `COMPONENT_LIBRARY.md` § Gaps item 8.

## 7. Dependencies

### Schema

`discs` — every column this form writes: `mold_id` (FK to `disc_molds`, **never drop it**,
`docs/development/CURRENT_WORK.md` § Standing decisions), the denormalized `manufacturer` and legacy
`mold` text label, `nickname`, `weight_grams`, `color`, `override_speed|glide|turn|fade`, `photo_url`
(legacy), `acquired_on`, `provenance`, `status`, `condition`, `plastic`, `notes`, plus the
client-supplied `id` and `user_id`.

The shared catalog behind `useCatalog`: `disc_molds` and its normalized manufacturers, plastics,
mold-plastic links, runs, and stamps (Phase B item 1,
`20260712223528_phase_b_catalog_foundation.sql`), mirrored into Dexie v6.

`disc_state_events` is **not** written on creation — see § 9.

### Library

`lib/discLocker` (`createDiscCopies`, `buildDiscCopies`), `lib/repository/catalogRepository`
(`useCatalog`, `filterCatalogMolds`). Signatures in `LIB_API_INDEX.md`. `lib/repository/discRepository`
is a dependency this page *should* have and does not.

### Components

`MoldPicker` — this page is its **only** consumer. Details in `COMPONENT_LIBRARY.md`. No other shared
component is used: quantity, the override grid, and all eleven text fields are hand-rolled markup on
the `.putt-form` and `.flight-number-grid` class families.

### Screens

Entered from `disc-collection` (`Add a disc`) and from `discs-root`'s Universe tab (the parameterized
hand-off). Exits into `disc-detail` or `discs-root`. Everything this screen omits — photos, odometer,
bag membership, shot tags, contextual performance — is `disc-detail`'s, by the explicit split recorded
in `DiscFormPage.jsx:27-28`.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` §§ 12 and 14 (§ 14 is the one this write does not satisfy).
`PRODUCT_ROADMAP.md` Phase C item 1 — "Collection-first DISCS hub, **quantity-first duplicate add**,
rich physical-disc profile" — is the shipped-work record for the quantity feature. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- **Every field on this page has an explicit `htmlFor`/`id` pair**, including all four override inputs
  (`override_speed`…`override_fade`) and the quantity select. Together with `disc-detail`'s
  `EditableSection` blocks and `lost-found`'s prefixed field block, this is the pattern the DISCS
  section gets right, and the one to copy.
- `mold-search` is labelled by an explicit `<label htmlFor="mold-search">Mold</label>` — the only
  labelled search input in the section (`disc-collection`'s and `UniverseBrowser`'s are
  placeholder-only).
- `ovr-axis` placeholders carry the mold's stock value, and `ovr-label` states the rule in text
  (`blank = mold stock: 9/5/-1/2`), so the placeholder is a redundant hint rather than the only channel.
- **Gap:** `err-inline` is a plain `<p className="form-error">` with no `role="alert"`. A submit that
  fails announces nothing, though it does sit immediately above the button that failed — the best
  placement of any error in the section.
- **Gap:** `fld-status` renders raw enum values (`in_locker`, `retired`) as user-facing option text, the
  same defect as `disc-collection`'s status chips and `disc-detail`'s status select.
- **Gap:** `MoldPicker`'s results are a plain `<ul>` of buttons with no combobox/listbox roles, no
  `aria-expanded`, no active-descendant management, and no keyboard arrow navigation. Result count
  changes are not announced.
- **Gap:** the four `ovr-axis` inputs are labelled only by lowercase single words (`speed`, `glide`,
  `turn`, `fade`), which are ambiguous out of context; they are grouped visually in
  `.flight-number-grid` but not in a `<fieldset>` with a `<legend>`.
- **Gap:** `qty-note` explains a consequential rule ("Creation is all-or-nothing") in a `.log-time`
  paragraph that is not associated with `qty-select` by `aria-describedby`.

## 9. Events and telemetry

No metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted. No notification is produced or
consumed. No activity-lifecycle event is written.

**No `disc_state_events` row is written on creation either, and this is a schema/behavior gap rather
than a design choice.** `disc_state_events.event_type` includes `'created'` in its `check` constraint
(`20260715183500_phase_b_disc_timelines_bag_versions.sql:18`), but the only trigger on `discs` is
`discs_record_state_change`, declared `after update` (`:155-157`). A create is an upsert-insert, so the
trigger never fires and no `created` row is ever written by anything — a repo-wide search for the
literal finds only the enum definition. Consequence: `buildDiscHistory` on `disc-detail` renders a disc
whose timeline begins at its first *edit*, with no origin entry. See § 12.

## 10. Tests

### Existing coverage

`src/lib/discLocker.test.js` — `buildDiscCopies` in particular, which is the tested pure core of the
quantity feature (id generation, the 1–10 range, field spreading).
`src/lib/repository/catalogRepository.test.js` covers `filterCatalogMolds`, `hydrateCatalog`, and
`readCatalog`'s remote-first/cache-fallback behavior. Matches the `disc-new` row in `TEST_MAP.md`.

**There is no component or page test for `DiscFormPage.jsx`** and none for `MoldPicker`. Untested above
the library layer: the `?mold=`/`?plastic=` effect and its stale-mold error, the empty-to-null
normalization of eleven fields, the two different post-submit destinations, and the fact that
`cta-submit` is enabled without a mold.

### Acceptance criteria

1. Submitting with no mold selected renders `Pick an approved mold first.` and writes nothing.
2. Quantity 3 creates exactly three rows with three distinct ids and identical other fields, and
   redirects to `/bag`.
3. Quantity 1 redirects to `/bag/discs/:id` for the created disc.
4. A blank optional field writes `null`, not `""` — checked for nickname, plastic, color, condition,
   provenance, photo URL, notes, and `acquired_on`.
5. A blank override axis writes `null`, and `0` in an override axis writes `0` rather than being
   treated as empty.
6. `?mold=:approvedId` preselects that mold once the catalog resolves.
7. `?mold=:unknownId` renders `That mold is no longer in the approved catalog.` and leaves the picker
   in search mode.
8. `?plastic=Champion` with no `mold` parameter is ignored.
9. `?mold=:id&plastic=Star%20Champion` prefills the plastic field with the decoded value.
10. With the network unavailable and a populated catalog snapshot, mold search works and submission
    fails with a network error — current behavior, asserted so a change to it is deliberate
    (task `T-disc-new-1`).
11. A quantity outside 1–10 reaching `buildDiscCopies` throws before any network call.

### E2E critical paths

Universe → plastic row → verify the prefilled mold and plastic → submit → land on the new disc. Create
three copies and verify three independently editable discs. Fill the form, go offline, submit, come
back online, submit again — assert exactly one set of discs exists (this is where the missing outbox
and the missing stable `clientId` matter most). Fill the form, navigate away, return — the form is
empty (current behavior). No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these
are backlog entries, not existing coverage.

## 11. Tasks

#### T-disc-new-1 — Create discs through the offline-first repository

- **Capability:** `data-access`
- **Touches:** `src/pages/DiscFormPage.jsx`, `src/lib/repository/discRepository.js`
- **Done when:** Submitting offline queues the create in the outbox, reports `Saved on Device`, and
  flushes exactly once on reconnect; a duplicate flush or a manual retry upserts onto the same
  `clientId` rather than inserting a second disc. Quantity ≥ 2 keeps its all-or-nothing guarantee.
- **Verify:** `npm test` with repository tests covering the offline queue and a replayed flush.
- **Commit:** `feat: create discs through the offline-first repository`

#### T-disc-new-2 — Disable submit until a mold is chosen

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscFormPage.jsx`
- **Done when:** `cta-submit` is `disabled` while `mold` is null, with the requirement stated near the
  picker rather than only after a failed submit; the existing `handleSubmit` guard stays as a backstop.
- **Verify:** `npm test` with a page test asserting the disabled state, plus manual check.
- **Commit:** `fix: require a mold before enabling disc creation`

#### T-disc-new-3 — Write a `created` disc state event

- **Capability:** `schema`
- **Touches:** a new migration
- **Done when:** Creating a disc appends one `disc_state_events` row with `event_type = 'created'`, so
  `buildDiscHistory` on `disc-detail` shows an origin entry; the existing `after update` trigger is
  unchanged and no duplicate rows are produced by an idempotent replay of the same create.
- **Verify:** `npm test` for the history derivation, plus a negative migration test asserting a
  replayed upsert does not append twice.
- **Commit:** `feat: record disc creation in the state event log`
- **Blocked by:** § 12 open question 1.

#### T-disc-new-4 — Protect an unsaved disc draft

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscFormPage.jsx`
- **Done when:** Navigating away from a form with entered values asks before discarding, satisfying
  `PHASE_A_ARCHITECTURE.md` § 12's "unsaved text survives accidental dismissal".
- **Verify:** Manual check: fill two fields, tap the shell back control.
- **Commit:** `feat: protect unsaved disc drafts`

#### T-disc-new-5 — Announce submission errors

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscFormPage.jsx`
- **Done when:** `err-inline` carries `role="alert"`, and `MoldPicker`'s result list announces its count
  on change.
- **Verify:** `npm run lint` and a manual VoiceOver pass through a failed submit.
- **Commit:** `fix: announce disc form errors`

#### T-disc-new-6 — Group and label the flight override inputs

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscFormPage.jsx`
- **Done when:** The four override inputs sit in a `<fieldset>` with a `<legend>` carrying the
  "blank = mold stock" rule via `aria-describedby`, and each label reads unambiguously.
- **Verify:** `npm run lint` and a manual VoiceOver pass.
- **Commit:** `fix: group the flight override inputs`

## 12. Open questions

1. **Disc creation writes no `created` event, though the schema reserves one.** § 9 has the evidence.
   Either add the insert trigger (or write the event from the repository) so a disc's timeline has an
   origin, or remove `'created'` from the enum so the contract stops promising it. Blocks
   `T-disc-new-3`.
2. **This page bypasses `discRepository.useCreate`, which was built for exactly this write.**
   `discRepository.js:20` wires `createRemote` to `upsertDisc(userId, null, { ...fields, id: clientId })`
   and `useCreate` supplies the per-mount `clientId` and the outbox; `discRepository.js:25` exports
   `useCreateDisc`, which **nothing imports**. The reason is probably quantity: `useCreate` mints one
   `clientId` and this page needs n. That is a solvable shape, and the current cost is a create path
   with no offline queue at all. Blocks `T-disc-new-1`.
3. **The form has no draft persistence and no unsaved-changes guard.** Thirteen fields, a shell back
   control that jumps to `/bag`, and no warning. `preserveNestedState: true` preserves scroll, not
   content — a distinction that will read as a contradiction to anyone scanning the route metadata.
   Blocks `T-disc-new-4`.
4. **`fld-status` lets a disc be created as `lost` without a Lost & Found case.** `lost-found` treats
   `discs.status = 'lost'` as a state its RPCs own, opening and closing cases in the same transaction
   as the status change. A disc created directly as `lost` has that status with no case behind it, and
   `lost-found`'s `reportableDiscs` will happily offer it (it filters only `retired`/`sold`), producing
   a case for a disc that was already lost. Should the create form offer all four statuses?
5. **`mold-change` leaves stale override placeholders and a stale plastic.** Clearing the mold resets
   only `mold`; `ovr-axis` placeholders vanish while any typed override values remain, and a plastic
   prefilled from `?plastic=` for the old mold persists into the new selection.
6. **`fld-photourl` writes the legacy `photo_url` column.** `disc-detail`'s `DiscPhotoManager` is the
   supported path (private Storage, three slots, compression, 30-day recovery) and treats `photo_url`
   only as a fallback for the `front` slot. Offering a raw public URL field on the create form
   contradicts the privacy posture Phase B item 3 established. Keep, or drop?
7. **`filterCatalogMolds` caps at 20 results and `MoldPicker` shows no count.** A search matching more
   than 20 approved molds silently truncates, and neither the picker nor the Universe browser says so.

## 13. Blueprint divergence

Blueprint Screen 5 places disc acquisition inside the Universe accordion: a run row carries a
`[ + ADD TO BAG ]` 48px action target, and "Tapping a run slides up a weight selection drawer."
`SCREEN_SPECS.md:159` records this page as the "ADD TO BAG target" for that flow.

| Blueprint Screen 5 element | Shipped here |
|---|---|
| Weight-selection **drawer** sliding up from a run row | A full form page. The file comment (`DiscFormPage.jsx:41-42`) states the trade explicitly: prefill the mold and plastic "rather than building a separate weight-selection drawer" |
| 3-tier accordion Mold → Plastic → **Run** | The hand-off carries `mold` and `plastic` only. There is no run tier anywhere in the shipped app, so a specific run cannot be recorded |
| `[ + ADD TO BAG ]` | This form adds a disc to the **locker**, not to a bag. Bag membership is a separate action on `disc-detail` or in the locker picker |
| Zero-typing entry | 11 of 13 controls are free-text or numeric inputs. The blueprint's zero-typing rule (and Screen 6's "touch blocks (no keyboard)" for overrides) is not met here — the override inputs are the same numeric fields `disc-detail` uses, which `screens/disc-detail.md` § 13 already records as a divergence |

One element has **no blueprint counterpart** and is the page's headline feature: the quantity selector
and its all-or-nothing multi-copy creation, from `PRODUCT_ROADMAP.md` Phase C item 1's "quantity-first
duplicate add". The blueprint models a disc as a catalog entry to add; the shipped app models it as an
individually tracked physical object with its own photos, odometer, and lifecycle — which is why
creating three requires three rows rather than a count column.

`SCREEN_SPECS.md:120` and `:163` both cite `discLocker.searchMolds` for this screen's mold search;
that export no longer exists and the replacement is `catalogRepository.filterCatalogMolds` +
`useCatalog()`. Already logged as `_corrections/lib-api-index.md` item 1 — referenced, not re-logged.

Standing divergences #1 (React/Vite, not Expo) and #3 (append-only schema; the shared `disc_molds` FK
catalog is retained over the blueprint's freetext `brand`/`mold` columns, which is exactly why this
form requires an approved mold) apply; see `SCREEN_SPECS.md`.
