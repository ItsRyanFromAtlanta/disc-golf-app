# Bag Manage

| Field | Value |
|---|---|
| Route id | `bag-manage` |
| URL pattern | `/bag/manage` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Manage Bags` |
| Activity pill | shown |
| Scroll key | `discs-bag-manage` |
| Preserves nested state | **yes** |
| Page component | `src/pages/BagManagePage.jsx` (365 lines) |
| Blueprint screen | Screen 5 — partial; the editor and version history are post-blueprint. See § 13 |
| Verified against | `7351964` |

## 1. Purpose

The bag editor: create bags, rename and re-describe them, set membership, promote the main bag, delete
a bag with a mandated replacement, review and restore immutable version history, and author persisted
ghost slots. It is the only surface where a bag's whole configuration changes in one reviewable save,
and the only surface that can create a ghost slot.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Manage bags` link on the Bags tab | `Link` from `/bag` | Primary path |
| In | `Create your first bag` in the zero-bag branch | `Link` from `/bag` | Defensive branch; see `screens/discs-root.md` § 12 item 3 |
| In | Direct URL / restored session | Route match | `ProtectedRoute`; `useOnboardingGate` may intercept first |
| Out | `Bag` link in the page header | `Link` to `/bag` | In-page, not the shell back control |
| Out | Shell back control | `GlobalHeader` → `resolveSectionRoot('discs')` | Returns to `/bag` |
| Out | Tab re-tap on DISCS | `TabBar` → `resolveSectionRoot('discs')` | Returns to `/bag` |

**No query parameters.** This route accepts none and produces none.

`preserveNestedState` is `true` — the only route in the DISCS section besides `disc-new` and
`lost-found` where it is. Scroll position is retained per `scrollKey` within a shell mount, which
matters here because the page is a single long list of expandable bag cards. It does **not** preserve
the editor's own state: `editingBagId`, `bagDraft`, `historyByBag`, `ghostSlotsByBag`, and
`restorePreview` are all component state and are discarded on unmount. **An in-progress unsaved draft
is lost on any navigation away** — see § 12.

## 3. Layout

### 3a. Frame (illustrative)

One bag card in view mode above, one in edit mode below.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Manage Bags                       [activity pill]| <- Shell header
+-------------------------------------------------------+
|  Manage Bags                                  [ Bag ] | <- Page header
+-------------------------------------------------------+
|  Main Tourney Bag      [Main bag]           [ Edit ]  | <- h2 + default badge + edit
|  Description   Summer setup                           |
|  Type          tournament                             |
|  Capacity      35                                     |
|  Discs         19                                     | <- ALL memberships, any status
|                                                       |
|  [ Choose replacement main bag  v ]  [ Delete bag ]   | <- select only when default + >1 bag
|  [ Version history ]  [ v7 · 7/28/2026 ] [ v6 · ... ] |
|  [ Ghost slots ] [ Add next gap ]  [👻 overstable ... ]|
+-------------------------------------------------------+
|  Practice Stack                             [ Edit ]  |
|  +-- EDIT MODE ------------------------------------+  |
|  | Private bag name    [ Practice Stack        ]   |  |
|  | Description         [                       ]   |  |
|  | Type                [ practice              ]   |  |
|  | Display capacity    [ 35 ]                      |  | <- number, min 0 max 35
|  | [x] Main bag (promote another bag to change)    |  |
|  |                                                 |  |
|  | Discs · 12/35                                   |  | <- hard-coded 35, not capacity
|  |  [x] Thunderbird                                |  |
|  |  [ ] Roc (lost · unavailable)                   |  | <- status suffix, still selectable
|  |  [ ] Buzzz                                      |  |
|  | One save updates this bag and creates one       |  |
|  | immutable version.                              |  |
|  | [ Save changes ]  [ Cancel ]                    |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  [ New bag ]                                          | <- becomes an inline form when tapped
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

The restore preview renders as an inline `role="dialog"` card after the bag list, not as a sheet.

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Manage Bags", activity pill
Page header
  hdr-title ............ h1 "Manage Bags"
  hdr-bag .............. link to /bag
Error banner
  err-inline ........... form-error, rendered when error && bags loaded
Bag card (repeated per bag, .bag-manage-card)
  Header
    card-name .......... h2, bag.name
    card-defaultbadge .. "Main bag" zone-badge, when is_default
    card-edit .......... "Edit" — hidden while this card is editing
  View mode (dl)
    view-description ... bag.description or "—"
    view-type .......... bag.bag_type or "—"
    view-capacity ...... bag.capacity ?? 35
    view-disccount ..... membership size — ALL statuses
  Edit mode
    ed-name ............ text, required
    ed-description ..... text
    ed-type ............ text, placeholder "tournament, practice, all-purpose..."
    ed-capacity ........ number, min 0, max 35, label "Display capacity"
    ed-default ......... checkbox "Main bag", disabled when already default
    ed-count ........... "Discs · {n}/35"
    ed-nodiscs ......... "No discs in your collection yet."
    ed-member .......... checkbox per owned disc; status suffix when not in_locker
    ed-note ............ "One save updates this bag and creates one immutable version."
    ed-save ............ "Save changes" / "Saving…"
    ed-cancel .......... "Cancel"
  Actions row
    del-replacement .... select, only when is_default && bags.length > 1
    del-bag ............ "Delete bag"
  History row
    hist-load .......... "Version history"
    hist-version ....... one button per loaded version: "v{n} · {date}"
  Ghost row
    ghost-load ......... "Ghost slots"
    ghost-addnext ...... "Add next gap"
    ghost-slot ......... one button per ACTIVE slot: "👻 {stability} {speed} · remove"
Restore preview (inline dialog, when a version is selected)
  rp-title ............. h2 "Restore v{n}?"
  rp-explain ........... "This applies historical metadata and membership as a new current version."
  rp-meta .............. name / type / capacity from the snapshot
  rp-additions ......... "Add · n" + labelled list
  rp-removals .......... "Remove · n" + labelled list
  rp-unavailable ....... "Unavailable placeholders · n" + labelled list + explanatory note
  rp-apply ............. "Apply as new version"
  rp-cancel ............ "Cancel"
Create bag
  new-open ............. "New bag" button
  new-name ............. text, required, label "New bag name"
  new-submit ........... "Create"
  new-cancel ........... "Cancel"
Page-level states (replace everything above)
  page-error ........... form-error as the entire page, when error && !bags
  page-loading ......... "Loading..." until loadAll resolves
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-bag` | link | `Bag` | default / pressed | navigate | `/bag` | always |
| `err-inline` | banner | error text | present / absent | — | — | shown once `bags` has loaded; the same `error` state is the full-page error before that |
| `card-defaultbadge` | badge | `Main bag` | — | — | — | `bag.is_default` |
| `card-edit` | button | `Edit` | default / pressed | `startEditingBag(bag)` | local draft | hidden while this card is in edit mode; **not** disabled while another card is editing — see § 12 |
| `view-capacity` | text | `bag.capacity ?? 35` | — | — | — | always |
| `view-disccount` | text | membership count | — | — | — | counts **every** member regardless of status, unlike `/bag`'s `in_locker`-only readout |
| `ed-name` | text input | label `Private bag name` | valid / empty | draft edit | `bags.name` | `required`; `ed-save` also disables on an all-whitespace name |
| `ed-capacity` | number input | label `Display capacity` | — | draft edit | `bags.capacity` | `min="0" max="35"`; the RPC re-validates `0..35` and raises otherwise |
| `ed-default` | checkbox | `Main bag`, plus `(promote another bag to change)` when already default | checked / unchecked / **disabled** | draft edit | `bags.is_default` | `disabled={bag.is_default}` — you can promote another bag but never demote this one directly |
| `ed-count` | text | `Discs · {n}/35` | — | — | — | **hard-coded `35`**, independent of `ed-capacity`. `n` counts all draft members, any status |
| `ed-member` | checkbox | disc name, plus ` ({status} · unavailable)` when not `in_locker` | checked / unchecked / **disabled** | `toggleDraftMembership` | draft | `disabled={!included && draft.discIds.length >= 35}` (`BagManagePage.jsx:234`). **This is the only app-side membership cap that actually blocks.** A non-`in_locker` disc is labelled unavailable but remains selectable |
| `ed-save` | button | `Save changes` / `Saving…` | idle / saving / disabled | `groupedSaveBag` | `grouped_save_bag` RPC | disabled while saving, while the name is blank, or while `bagDraftHasChanges` is false |
| `ed-cancel` | button | `Cancel` | default / disabled | discard draft | — | disabled while saving; **discards without confirmation** |
| `del-replacement` | select | `Choose replacement main bag` + one option per other bag | — | `setReplacementByBag` | local state | rendered only when `is_default && bags.length > 1`; `aria-label="Replacement main bag for {name}"` |
| `del-bag` | button | `Delete bag` | default / **disabled** | `handleDeleteBag` | `delete_bag_with_replacement` RPC | disabled when `bags.length <= 1`, or when this is the default and no replacement is chosen. Confirms via `window.confirm` — § 6 |
| `hist-load` | button | `Version history` | default / pressed | `loadBagVersions` | `bag_versions` | always; loads on demand, per bag, and never unloads |
| `hist-version` | button | `v{n} · {locale date}` | default / pressed | `previewRestore` | local preview | one per loaded version, newest first |
| `ghost-load` | button | `Ghost slots` | default / pressed | `loadGhostSlots` | `bag_ghost_slots` | always; loads on demand |
| `ghost-addnext` | button | `Add next gap` | default / pressed | `addNextGhostSlot` | `bag_ghost_slots` | always; sets `No uncovered flight slot remains for this bag.` when there is nothing to add |
| `ghost-slot` | button | `👻 {stability_class} {speed_class} · remove` | default / pressed | `removeGhostSlot` then reload | `bag_ghost_slots.removed_at` | one per **active** slot (`activeGhostSlots`); **removes with no confirmation** |
| `rp-apply` | button | `Apply as new version` | default / pressed | `restoreBagVersion` | `restore_bag_version` RPC | always while the preview is open |
| `rp-cancel` | button | `Cancel` | default / pressed | clear preview | — | always |
| `rp-unavailable` | list + note | `Unavailable placeholders · n`, then `Unavailable historical discs remain visible here but are excluded from the restored current bag.` | present / absent | — | — | note renders only when the list is non-empty |
| `new-open` | button | `New bag` | default / pressed | open the form | local state | always |
| `new-name` | text input | label `New bag name` | valid / empty | `setNewBagName` | — | `required` |
| `new-submit` | button | `Create` | default | `createBag` then `loadAll` | `bags` | the new bag becomes the default **only if it is the user's first** (`is_default: (bags ?? []).length === 0`) |
| `page-error` | page | error text | — | — | — | `error && !bags`; **no retry control** |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| User's bags | `fetchBags` | `lib/discLocker` | Supabase | async |
| All owned discs | `fetchUserDiscs` | `lib/discLocker` | Supabase | async |
| Membership per bag | `fetchBagDiscs` ×N | `lib/discLocker` | Supabase | async |
| Version list per bag | `loadBagVersions` | `lib/repository/bagHistoryRepository` | Supabase + Dexie | async, on demand |
| Ghost slots per bag | `loadGhostSlots` | `lib/repository/discTaxonomyRepository` | Supabase + Dexie | async, on demand |
| Draft construction | `buildBagDraft` | `lib/bags` | — | **pure** |
| Dirty check | `bagDraftHasChanges` | `lib/bags` | — | **pure** |
| Restore diff | `previewBagRestore` | `lib/bagHistory` | — | **pure** |
| Restore labels | `describeRestoreDiscIds` | `lib/bagHistory` | — | **pure** |
| Active ghost filtering | `activeGhostSlots` | `lib/discTaxonomy` | — | **pure** |
| Next uncovered gap | `stabilityGaps(bagDiscs, { limit: 12 })` | `lib/wishlist` | — | **pure** |

Signatures in `LIB_API_INDEX.md`. `loadAll()` (`BagManagePage.jsx:38`) issues `fetchBags` and
`fetchUserDiscs` as one `Promise.all`, then fans out one `fetchBagDiscs` per bag, and is re-run after
every successful mutation — create, grouped save, delete, and restore all end in `await loadAll()`.

Note the gap source: `addNextGhostSlot` computes `stabilityGaps` over the **selected bag's members**
with `limit: 12`, while `/bag`'s Universe tab computes it over **every owned disc** with the default
`limit: 3`. Same function, different scope and different ceiling, on two screens a tap apart.

### Writes

| Mutation | Call | Idempotency | Transaction boundary |
|---|---|---|---|
| Create a bag | `createBag(user.id, { name, is_default })` | none | Single Supabase insert |
| Grouped save | `groupedSaveBag(bag.id, bagDraft)` | `crypto.randomUUID()` per call, checked against `bag_versions.idempotency_key` before any work | **One `grouped_save_bag` RPC.** Locks the bag and the owner's whole bag set `for update`, normalizes and validates membership, updates metadata, reconciles `bag_discs`, and captures exactly one version — atomically |
| Delete a bag | `deleteBagWithReplacement(bag.id, replacementId)` | none | One `delete_bag_with_replacement` RPC; locks the bag set, promotes the replacement, then deletes |
| Restore a version | `restoreBagVersion(version)` | `crypto.randomUUID()` | One `restore_bag_version` RPC; applies snapshot metadata and membership as a **new** version, never rewriting history |
| Add a ghost slot | `addGhostSlot(user.id, bagId, fields)` | none | Dexie put **first**, then the Supabase insert — see § 12 |
| Remove a ghost slot | `removeGhostSlot(slot)` | none | Dexie put first, then the Supabase update; soft delete via `removed_at` |

The grouped save is the closest thing in the DISCS section to the `PHASE_A_ARCHITECTURE.md` § 14
contract: expected-state locking, an idempotency key, one server-side transaction, and an append-only
event as the result. Cite § 14; do not restate its ordering rules.

Server-side validation inside `grouped_save_bag`
(`20260716193000_phase_c_grouped_bag_save.sql:71-97`) rejects: an unauthenticated caller, a blank name,
a capacity outside `0..35`, a blank idempotency key, a bag the caller does not own, more than 35
distinct disc ids, and any disc id that is not the caller's. Each raises a Postgres exception whose
raw message lands in `err-inline` verbatim.

### Offline

**This screen does not work offline.** `loadAll()`'s three fetches are direct Supabase calls with no
fallback; a rejection before `bags` is set renders `page-error` as the whole page, and a rejection
afterwards renders `err-inline`. Every write is an RPC with no outbox — offline, `ed-save`, `del-bag`,
and `rp-apply` all fail and report their message.

Two reads degrade gracefully once the page is up: `loadBagVersions` and `loadGhostSlots` both fall back
to Dexie when the remote call fails and only throw when the cache is also empty.

Ghost-slot writes are the odd case: `addGhostSlot`/`removeGhostSlot` write Dexie **before** the network
call and do not roll back on failure, so an offline add leaves a local row that will render on the next
`showGhostSlots` while the server knows nothing about it. Not an outbox — there is no flush. See § 12.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered.

## 6. Flow paths

**Happy path.** Arrive from `/bag` → each owned bag renders as a card → tap `Edit` → adjust name,
description, type, capacity, and membership checkboxes → `Save changes` → one `grouped_save_bag` RPC
updates metadata and membership and mints one version → `loadAll()` refreshes → the card returns to
view mode showing the new values.

**First run / empty.** A user always has at least one bag (the onboarding gate and the delete
protections both guarantee it), so the bag list is never empty. A user with no discs sees
`No discs in your collection yet.` inside the edit-mode membership block — styled `className="loading"`,
which is a loading idiom used for an empty state. Version history and ghost slots both start unloaded
and reveal nothing until their button is tapped, so a first visit shows no history at all.

**Diverges from `S-EMPTY`**, and this screen is the row's named exemplar of the divergence:
`BagManagePage.jsx:228` is the one instance in the app of an empty state wearing the loading class
(`PutterLineup.jsx:89` is the other, on `discs-root`). The row's defect list is exactly these two.

**Error.** `S-ERR-BLOCK` — before `bags` loads, `page-error` replaces the whole page with no retry
control (`S-RETRY`). This is one of the six **guarded** instances: `BagManagePage.jsx:180` is
conditioned on `&& !data`, so a warm result wins over the error. Afterwards, every failure — create,
save, delete, restore, ghost add/remove, history load — funnels into one shared `error` state rendered
as `err-inline` (`S-ERR-INLINE`, `:192`) near the top of the page, which may be far above the control
that failed. Raw Postgres exception strings surface unmodified (`A bag cannot contain more than 35
discs`, `Promote a replacement main bag before deleting this bag`, `Bag contains an unavailable or
foreign disc`). A failed `saveBag` keeps the editor open with the draft intact, which is correct.

Note the `S-ERR-INLINE` divergence this screen shares with the rest of the app: the row records that
every inline instance uses `.form-error`, so a benign degradation and a hard failure carry the same
`--color-negative` signal.

**Offline.** `S-OFFLINE-READ` — mixed on this screen: `bagHistoryRepository` is cache-backed but
`lib/discLocker` is one of the eight uncached modules, and the membership read is what gates the page,
so arrival degrades to the full-screen error. **Diverges from `S-OFFLINE-WRITE`:** none of the writes
here is outbox-backed — `grouped_save_bag`, `delete_bag_with_replacement`, and the ghost-slot mutations
are direct RPCs — so every write fails outright rather than queueing, and none of the four calm labels
from `S-SYNC` is displayable. As § 5.

**Auth / guard.** `ProtectedRoute` gates the shell. Every RPC independently re-checks `auth.uid()` and
raises `Authentication required` if it is null. `user.id` is dereferenced unconditionally in
`loadAll()`.

**Interlock.** `S-INTERLOCK-CAP` — **this is the one screen where the 35-disc cap actually blocks a
user action**, and it is the row's positive citation for the cap (`:234` disabled at 35).
`ed-member` sets `disabled={!included && draft.discIds.length >= 35}` (`BagManagePage.jsx:234`) and
`ed-count` reads `{n}/35`, and the `grouped_save_bag` RPC backs it with
`if cardinality(normalized_ids) > 35 then raise exception` (`20260716193000_phase_c_grouped_bag_save.sql:92`).

Three caveats keep it from being the interlock `SCREEN_SPECS.md` standing divergence 6 describes:

1. The cap here is the literal `35`, not `bag.capacity`. A bag whose `capacity` is 10 blocks at 10 on
   `/bag` and at 35 here.
2. The count includes members of every status. `/bag` counts `in_locker` only. The same bag can read
   `32 / 35` there and `35/35` here.
3. The RPC guard fires only on a grouped save. A bag pushed past 35 through
   `/bag/locker?addToBag=` or the `disc-detail` chips — neither of which checks anything — is not
   repaired here; the editor simply refuses to add more, and the next save of that bag raises. There is
   **no `CHECK` constraint on `bag_discs` cardinality anywhere in the schema**, and `bags.capacity`
   carries no constraint either (`bags_schema.sql:22`). Full table in `screens/discs-root.md` § 12
   item 1.

   **Amendment.** The "no `CHECK` constraint" statement is literally true and remains, but the inference
   that a bag can be "pushed past 35" does not follow, per `_corrections/capture-screens.md` § "C-9
   ADJUDICATION": `layer1_foundation_schema.sql:230-253` attaches `enforce_bag_capacity()` as a
   `before insert` trigger on `bag_discs` that row-locks the parent bag, counts members, and raises above
   35 on **every** insert regardless of app path. A `CHECK` could not do this — it cannot count sibling
   rows — which is the substance of the objection. So the unguarded surfaces fail loudly at 36; this
   editor's `disabled` is a pre-emption of an enforcement that already exists, not the only enforcement.
   Caveats 1 and 2 (literal `35` vs `bag.capacity`, and the status-inclusive count) are unaffected and
   stand.

A second, unrelated interlock is real and correct: the last bag cannot be deleted, and the main bag
cannot be deleted without promoting a replacement. This is enforced three times — `del-bag`'s
`disabled` rule, `delete_bag_with_replacement`'s `bag_count <= 1` and replacement checks, and the
`bags_protect_main_delete` trigger on the table itself. That is what "app-side disabling AND a DB
guard" looks like when it is actually implemented.

**Destructive.** Three destructive paths, three different confirmation standards:

- `del-bag` calls **`window.confirm(`Delete ${bag.name}? This cannot be undone.`)`**
  (`BagManagePage.jsx:103`). `S-CONFIRM` — this is the first of the row's three `window.confirm` sites,
  also named in `COMPONENT_LIBRARY.md` § Gaps item 8 — an unstyled OS dialog that violates the design
  system by construction and is not equivalently available in a Capacitor/WKWebView shell. The row's
  `contract-violation` verdict applies unchanged: no focus entry or return, no inert background, no
  320px or 200%-scale handling, and `SheetHost` available and unused. The copy
  (`This cannot be undone.`) is accurate and understated: `bag_versions.bag_id` cascades on delete, so
  the bag's entire version history goes with it. See § 12 item 5.
- `ghost-slot` removes a persisted slot on a single tap with **no confirmation**. Recoverable in
  principle — the removal is a `removed_at` tombstone, not a delete — but there is no restore UI.
- `ed-cancel` discards an unsaved draft with **no confirmation**, as does any navigation away.

`rp-apply` is not destructive: a restore appends a new version rather than rewriting history, and the
preview is shown first, which is the pattern `PRODUCT_ROADMAP.md` § Cross-cutting rules requires
("Historical restores preview additions/removals and create a new current version").

## 7. Dependencies

### Schema

`bags` (`name`, `description`, `bag_type`, `capacity`, `is_default`; partial unique index
`bags_one_default_per_user`; `bags_protect_main_delete` trigger from
`20260716193000_phase_c_grouped_bag_save.sql:46`), `bag_discs`, `discs` + `disc_molds`,
`bag_versions` and `bag_version_discs` (`20260715183500_phase_b_disc_timelines_bag_versions.sql`;
`bag_versions.capacity` carries the only `between 0 and 35` `CHECK` in the bag schema, at line 46),
`bag_ghost_slots` (`20260715190500_phase_b_ghost_slots_shot_tags.sql`, with the partial unique index
`bag_ghost_slots_active_slot_uniq` preventing two active slots for one `(bag, speed_class,
stability_class)`), and `disc_state_events` written by the membership trigger.

RPCs: `grouped_save_bag`, `delete_bag_with_replacement`, `restore_bag_version`, `capture_bag_version` —
all `security invoker`, all revoked from `public`/`anon` and granted to `authenticated`.

### Library

`lib/discLocker`, `lib/bags`, `lib/bagHistory`, `lib/wishlist`, `lib/discTaxonomy`,
`lib/repository/bagHistoryRepository`, `lib/repository/discTaxonomyRepository`. Signatures in
`LIB_API_INDEX.md`.

### Components

**None.** This page composes no shared component — every control is hand-rolled markup reusing the
`.profile-section`, `.profile-field-list`, `.profile-section-actions`, and `.putt-form` class families
from `App.css`. Notably it does not use `EditableSection`, which exists for exactly this view/edit
toggle and is used by `ProfilePage` and `DiscDetailPage`. See § 12.

### Screens

Required by `discs-root` (bag creation, and the only ghost-slot authoring surface — the slots this page
writes are what `/bag`'s Flight Spectrum and Bag Resonance plot). Reads the disc set that
`disc-collection` and `disc-new` populate. Its 35-member cap is the sibling of the unenforced paths in
`disc-collection` § 6 and `screens/disc-detail.md` § 6.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` §§ 12–14 — § 14 in particular, since the grouped save is the section's
best-matching implementation of it. `PRODUCT_ROADMAP.md` Phase C item 2 (bag editor with grouped
save/version, preview/apply restore, unavailable placeholders, one private main bag, generic external
label `Main Bag`) is the shipped-work record. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- Every edit-mode input has an explicit `htmlFor`/`id` pair, keyed by bag id so ids stay unique across
  cards (`name-${bag.id}`, `desc-${bag.id}`, `type-${bag.id}`, `cap-${bag.id}`). `new-name` likewise.
  This is the `disc-detail` pattern and it is applied correctly here.
- `ed-default` and every `ed-member` checkbox are wrapped in a `<label>` rather than paired by id,
  which is also valid.
- `del-replacement` carries `aria-label="Replacement main bag for {bag.name}"` — a genuinely useful
  disambiguation when several cards are on screen.
- The restore preview is `role="dialog"` with `aria-label="Restore bag version preview"`.
- **Gap:** that dialog is not modal. It has no `aria-modal`, does not trap or receive focus, does not
  close on Escape, does not make the background inert, and renders inline after the bag list rather
  than in `SheetHost`. `PHASE_A_ARCHITECTURE.md` § 12 requires focus to enter the sheet and the
  background to be inert; `SheetHost` implements exactly that and is not used here.
- **Gap:** `window.confirm` for deletion is unstyled, uncontrollable, and unannounced by the app's own
  live regions.
- **Gap:** `err-inline` is a plain `<p className="form-error">` with no `role="alert"`, near the top of
  a long page. A save that fails on the last card announces nothing and may be off-screen.
- **Gap:** `ed-count` (`Discs · 12/35`) is a `<span className="editor-label">`, not a live region, so
  crossing into the disabled range is silent — the checkboxes simply stop responding.
- **Gap:** `card-edit` disappearing rather than changing state means a screen-reader user re-traversing
  the card finds a control missing rather than a mode changed.

## 9. Events and telemetry

No metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted. No notification is produced or
consumed. No activity-lifecycle event is written.

This page is nonetheless the section's densest producer of append-only history:

- Every grouped save appends one `bag_versions` row with `reason: 'grouped_save'` plus one
  `bag_version_discs` row per member, via `capture_bag_version`.
- Every restore appends one `bag_versions` row with `reason: 'restore'` and
  `restored_from_version_id` pointing at the source — the provenance link that makes a restore
  auditable.
- Every membership insert or delete performed by the RPC fires
  `bag_discs_record_membership_change`, appending `bag_added`/`bag_removed` rows to `disc_state_events`
  with a trigger-generated idempotency key.
- Ghost-slot removal is a `removed_at` tombstone, never a delete, per `PRODUCT_ROADMAP.md` Phase B
  item 2's "reversible assignment tombstones".

## 10. Tests

### Existing coverage

`src/lib/bags.test.js` (`buildBagDraft`, `bagDraftHasChanges`, `bagIdsToUnsetForNewDefault`,
`capacityTier`) and `src/lib/bagHistory.test.js` (`previewBagRestore`, `latestBagVersion`,
`describeRestoreDiscIds`). `src/lib/wishlist.test.js` covers the gap detection behind `Add next gap`.
Matches the `bag-manage` row in `TEST_MAP.md`, with `wishlist` added.

`LIB_API_INDEX.md` marks every `bagHistoryRepository` export as untested — so **the RPC wrappers this
page depends on for all four of its mutations have no test coverage at all**, and neither do the RPCs
themselves. **There is no component or page test for `BagManagePage.jsx`.** The 35-member checkbox cap,
the delete-disable rule, and the draft dirty-check wiring are all unverified above the pure-function
layer.

### Acceptance criteria

1. Editing a bag and saving produces exactly one new `bag_versions` row, not one per changed field.
2. `Save changes` is disabled until something actually changes (`bagDraftHasChanges`), and re-enables
   when a single checkbox is toggled.
3. With 35 discs checked, every unchecked checkbox is `disabled` and `ed-count` reads `35/35`.
4. Checking 36 discs is impossible through the UI; a payload that reaches the RPC with 36 ids is
   rejected with `A bag cannot contain more than 35 discs`.
5. A bag whose `capacity` is 10 still allows 35 members here — current behavior, asserted so a change
   to it is deliberate (§ 12 item 1).
6. A `lost` disc appears in the membership list with ` (lost · unavailable)` and can still be checked.
7. `Delete bag` is disabled when only one bag exists, and disabled for the main bag until a replacement
   is chosen.
8. Deleting the main bag with a replacement chosen promotes the replacement and leaves exactly one
   default.
9. `Version history` → a version → the preview lists additions, removals, and unavailable placeholders
   with the correct counts; `Apply as new version` creates a new version rather than reverting.
10. A restored version excludes discs that are no longer `in_locker`, and the preview says so.
11. `Add next gap` twice adds two distinct slots; a third call with no uncovered class left sets
    `No uncovered flight slot remains for this bag.`
12. A removed ghost slot disappears from this page and stops plotting on `/bag`'s Flight Spectrum.

### E2E critical paths

Full edit round trip with a reload in between, asserting persistence and exactly one version. Delete
the main bag with and without a replacement. Restore an old version and confirm the current version
number increments rather than resetting. Add and remove a ghost slot, then confirm `/bag` agrees. Start
an edit, navigate away, come back — the draft is gone (current behavior). No automated browser E2E
suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing coverage.

## 11. Tasks

#### T-bag-manage-1 — Replace `window.confirm` for bag deletion

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagManagePage.jsx`
- **Done when:** Deleting a bag uses an in-app confirmation rendered through `SheetHost` (or a shared
  confirm component), naming the bag and stating what is retained; `window.confirm` no longer appears
  in this file.
- **Verify:** `npm run lint` plus manual check at `/bag/manage`; `grep -n "window.confirm" src/pages/BagManagePage.jsx` returns nothing.
- **Commit:** `fix: replace the OS confirm dialog for bag deletion`

#### T-bag-manage-2 — Make the restore preview a real modal

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagManagePage.jsx`, `src/components/AppShell.jsx`
- **Done when:** The restore preview opens in `SheetHost`, receives focus, returns focus to the version
  button on close, closes on Escape, and makes the background inert per
  `PHASE_A_ARCHITECTURE.md` § 12.
- **Verify:** `npm run lint` and a manual keyboard + VoiceOver pass through a restore.
- **Commit:** `fix: open the bag restore preview in the shared sheet host`

#### T-bag-manage-3 — Use `bag.capacity` as the membership cap

- **Capability:** `pure-logic`
- **Touches:** `src/pages/BagManagePage.jsx`, `src/lib/bags.js`
- **Done when:** `ed-count` and the `ed-member` disable rule both read the bag's effective capacity
  instead of the literal `35`, using the same count definition `/bag` uses.
- **Verify:** `npm test` with cases at capacity 10 and capacity 35.
- **Commit:** `fix: cap bag membership at the bag's own capacity`
- **Blocked by:** `screens/discs-root.md` § 12 open questions 1 and 2.

#### T-bag-manage-4 — Warn before discarding an unsaved bag draft

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagManagePage.jsx`
- **Done when:** `Cancel` with unsaved changes asks before discarding, and navigating away from an open
  editor with unsaved changes does the same — satisfying § 12's "unsaved text survives accidental
  dismissal".
- **Verify:** Manual check: edit, cancel, and edit, navigate away.
- **Commit:** `feat: protect unsaved bag drafts from accidental discard`

#### T-bag-manage-5 — Roll back the local ghost-slot row when the remote write fails

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/discTaxonomyRepository.js`
- **Done when:** A failed `addGhostSlot` or `removeGhostSlot` leaves no divergent Dexie row, or the row
  is queued in a real outbox that flushes on reconnect. The current write-local-then-throw path is gone.
- **Verify:** `npm test` with a new `discTaxonomyRepository` test rejecting the Supabase call.
- **Commit:** `fix: do not leave orphaned local ghost slots on write failure`

#### T-bag-manage-6 — Announce errors and the membership ceiling

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagManagePage.jsx`
- **Done when:** `err-inline` carries `role="alert"` and `ed-count` is a polite live region, so a failed
  save and a reached ceiling are both announced.
- **Verify:** `npm run lint` and a manual VoiceOver pass.
- **Commit:** `fix: announce bag editor errors and the membership ceiling`

## 12. Open questions

1. **The membership cap here is `35`, not `bag.capacity`, and it counts every status.** `/bag` uses
   `bag.capacity ?? 35` over `in_locker` members only. Two screens one tap apart disagree about how
   full the same bag is. The cross-surface table and the decision this blocks are in
   `screens/discs-root.md` § 12 item 1; the `bag.capacity` semantics question is item 2 there. Logged
   against `SCREEN_SPECS.md:73-74,174` in `_corrections/discs-screens.md` D-1. Blocks
   `T-bag-manage-3`.
2. **The `Display capacity` label says the number is presentational, and `/bag` treats it as an
   interlock threshold.** Either the label is wrong or `/bag` is.
3. **This page hand-rolls a view/edit toggle that `EditableSection` already implements.** `ProfilePage`
   and `DiscDetailPage` both use it. Extracting the bag card into it would delete ~60 lines and pick up
   the draft-resync behavior for free; keeping it hand-rolled is defensible only because of the
   per-card membership list. Decide, and record the decision.
4. **Two bag cards can be in edit mode's `startEditingBag` path in sequence but only one draft exists.**
   `editingBagId` and `bagDraft` are single-valued: tapping `Edit` on a second card while the first is
   open silently replaces the draft and abandons the first card's unsaved changes with no warning. The
   first card's `Edit` button reappears, which is the only signal.
5. **Is bag deletion actually irreversible, as the confirm copy claims?** `bag_versions.bag_id`
   references `public.bags(id) on delete cascade`
   (`20260715183500_phase_b_disc_timelines_bag_versions.sql:41`), so deleting a bag destroys its entire
   version history along with it. The copy is correct; the *architecture* is the question — every other
   history in this app is append-only and survives, and `PRODUCT_ROADMAP.md` § Cross-cutting rules says
   deleted things are "retained for recovery and audit until the user invokes the privacy purge flow."
   Bag deletion is the exception. Intentional?
6. **`restore_bag_version` has no cardinality check.** `grouped_save_bag` refuses more than 35 ids;
   the restore RPC copies whatever the snapshot holds
   (`20260716193000_phase_c_grouped_bag_save.sql:192-199`) with no count guard. A snapshot taken while a
   bag was over-full — reachable today via `/bag/locker?addToBag=` — restores over-full.
7. **Ghost slots write to Dexie before the network and never roll back.** § 5 Offline; blocks nothing
   but produces phantom local slots. `T-bag-manage-5`.
8. **`No discs in your collection yet.` is styled `className="loading"`.** An empty state wearing a
   loading class, and the string `COPY_AND_TERMINOLOGY.md` T-2 attributes to `/bag/locker`. Logged in
   `_corrections/discs-screens.md` D-2.

## 13. Blueprint divergence

Blueprint Screen 5 draws bag management as a browse-and-add workspace: a `[ + NEW BAG ]` header action,
a capacity bar, and the Universe accordion. **It draws no bag editor at all** — no metadata fields, no
membership checklist, no version history, no restore, and no ghost-slot authoring. Everything this page
does beyond `New bag` is post-blueprint, introduced by `PRODUCT_ROADMAP.md` Phase B item 2 and Phase C
item 2 under the cross-cutting rule that "Bag and physical-disc changes are time-versioned."

| Blueprint Screen 5 element | Shipped here |
|---|---|
| `[ + NEW BAG ]` in the screen header | `new-open` at the bottom of the page, expanding into an inline form |
| 35-disc capacity interlock | The only working app-side block in the section — but against a hard-coded `35`, not the drawn capacity bar. No bar renders here at all |
| `[ 🔗 BEAM QR ]` P2P bag share | Absent, per standing divergence 8 |
| Ghost Slot wishlist card with `[ FIND ]` | Slot cards render as **remove** buttons, not wishlist cards with a retail bridge. `[ FIND ]` bridges to Screen 17, which is parked — see `screens/discs-root.md` § 13 for the `/bag` side of the same divergence |
| 3-tier accordion catalog | Not here; `/bag`'s Universe tab |

The external-label rule from `PRODUCT_ROADMAP.md` Phase C item 2 — one private main bag, generic
external label `Main Bag` — is implemented in `bagDisplayName(bag, { external: true })`, which this
page does **not** call. It renders `bag.name` and a separate `Main bag` badge instead. That is correct
for a private surface (the user's own name is the useful label here), and the external form has no
consumer yet.

Standing divergences #1 (React/Vite, not Expo), #3 (append-only schema), and #8 (QR Beam parked)
apply; see `SCREEN_SPECS.md`. Standing divergence #6 ("35-disc bag capacity … with app-side disabling
AND a DB `CHECK` constraint") is **half-true here and false elsewhere** — see § 6 Interlock.
