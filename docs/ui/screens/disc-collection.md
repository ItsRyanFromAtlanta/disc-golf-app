# Disc Collection

| Field | Value |
|---|---|
| Route id | `disc-collection` |
| URL pattern | `/bag/locker` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Collection` |
| Activity pill | shown |
| Scroll key | `discs-collection` |
| Preserves nested state | no |
| Page component | `src/pages/BagLockerPage.jsx` (301 lines) |
| Blueprint screen | Screen 5 — partial; see § 13 |
| Verified against | `7351964` |

## 1. Purpose

The searchable, filterable grid of every physical disc the player owns, across every status. It is the
browse-and-find surface for the collection, and it doubles as two selection modes: picking discs into a
bag, and picking discs for comparison. A player comes here to locate one disc, or to assemble a set.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Locker` link on the Bags tab | `Link` from `/bag` | |
| In | `Locker` link in the disc detail page header | `Link` from `/bag/discs/:discId` | |
| In | `Locker` link in the compare header, and `Choose discs` in its invalid state | `Link` from `/bag/compare` | |
| In | `Locker` link in the Lost & Found header | `Link` from `/bag/lost-found` | |
| In | `Locker` link in the add-disc header | `Link` from `/bag/discs/new` | |
| In | `Add from locker` on the Bags tab | `Link` to `/bag/locker?addToBag=:bagId` | **Picker mode** — see the parameter contract below |
| In | Direct URL / restored session | Route match | `ProtectedRoute`; `useOnboardingGate` may intercept first |
| In | Rendered inline, headerless | `<BagLockerPage embedded />` at `BagPage.jsx:122` | Not navigation — the same component is the body of `/bag`'s Collection tab |
| Out | `Bag` link | `Link` to `/bag` | Non-picker, non-compare mode only |
| Out | `Done` link | `Link` to `/bag` | Picker mode only |
| Out | `Add a disc` | `Link` to `/bag/discs/new` | Hidden in picker mode |
| Out | Disc card tap | `Link` to `/bag/discs/:discId` | Browse mode only; in picker or compare mode the card is a static `<div>` with an action button |
| Out | `Compare (n)` | `navigate('/bag/compare?ids=a,b,c')` | Compare mode; enabled at ≥ `COMPARE_MIN` |
| Out | Shell back control | `GlobalHeader` → `/bag` | Returns to the section root, not to the page you arrived from |
| Out | Tab re-tap on DISCS | `TabBar` → `resolveSectionRoot('discs')` | Returns to `/bag` |

**Query parameter contract — `?addToBag=:bagId`.** Read at `BagLockerPage.jsx:19`. Presence switches
the page into picker mode: the `h1` becomes `Add to {bag.name}`, the header action becomes `Done`, the
`Add a disc` link and the compare toolbar are suppressed, and every card gains an `Add`/`Added` toggle
in place of its link. The id is looked up against `fetchBags(user.id)` (`:61`); an id the user does not
own resolves `pickerBag` to `null` and the page silently falls back to browse mode, while
`addToBagId` — the raw parameter — remains what the toggle would write to. A malformed or foreign id
therefore produces a browse-mode page with no visible defect. See § 12.

`preserveNestedState` is `false`, so scroll position is not restored on return. Compare selections and
filter state are component state and are lost on every unmount.

## 3. Layout

### 3a. Frame (illustrative)

Browse mode, grid view.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Collection                        [activity pill]| <- Shell header
+-------------------------------------------------------+
|  Locker                        [ Compare ]  [ Bag ]   | <- Page header; h1 flips in picker mode
+-------------------------------------------------------+
|  [ Add a disc ]                                       | <- hidden in picker mode
+-------------------------------------------------------+
|  [ Search your discs...            ]   [ ▦ ] [ ☰ ]   | <- search + grid/list toggle (persisted)
|  [All manufacturers v][All speeds v][All stability v] |
|  [Recently added v]                                   |
|  [All] [in_locker] [lost] [retired] [sold]            | <- status ChipGroup
+-------------------------------------------------------+
|  +---------------+  +---------------+                 |
|  | ▢ THUNDERBIRD |  | ▢ BUZZZ       |                 | <- DiscCard, accent = stability color
|  |   Innova      |  |   Discraft    |                 |
|  |   9/5/-1/2    |  |   5/4/-1/1    |                 |
|  +---------------+  +---------------+                 |
|  +---------------+                                    |
|  | ▢ ROC   [lost]|                                    | <- status badge when not in_locker
|  |   Innova      |                                    |
|  +---------------+                                    |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

Compare mode inserts a toolbar above `Add a disc`; picker mode replaces the header actions with `Done`
and gives every card an `Add`/`Added` chip.

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Collection", activity pill
Page header (suppressed when embedded)
  hdr-title ............ h1: "Add to {bag.name}" in picker mode, else "Locker"
  hdr-compare .......... button "Compare" — browse mode only
  hdr-cancel ........... button "Cancel" — compare mode only
  hdr-bag .............. link to /bag — browse mode only
  hdr-done ............. link to /bag — picker mode only
Error banner
  err-inline ........... form-error; picker/toggle failures or the disc query's error
Compare toolbar (compare mode, non-picker only)
  cmp-count ............ "Select 2–4 discs (n selected)"
  cmp-submit ........... "Compare (n)" → /bag/compare?ids=…
Primary action
  cta-adddisc .......... link to /bag/discs/new — hidden in picker mode
Toolbar
  tb-search ............ text input, placeholder "Search your discs..."
  tb-grid .............. view toggle, grid
  tb-list .............. view toggle, list
Filters
  flt-manufacturer ..... select, derived from the owned set
  flt-speed ............ select: all | putter | midrange | fairway | distance
  flt-stability ........ select: all | understable | stable | overstable
  flt-sort ............. select: recent | speed | stability
  flt-status ........... ChipGroup: all | in_locker | lost | retired | sold
Results
  res-empty ............ "No discs match."
  res-grid ............. .disc-grid or .disc-list, one DiscCard per visible disc
    card-link .......... browse mode: whole card links to /bag/discs/:id
    card-compare ....... compare mode: chip "Compare" / "Selected"
    card-add ........... picker mode: chip "Add" / "Added"
Page-level states (replace everything above)
  page-error ........... form-error as the entire page, when the query errored with no cache
  page-loading ......... "Loading..." until the disc query first resolves
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Locker`, or `Add to {bag.name}` | — | — | — | not rendered when `embedded` |
| `hdr-compare` | button | `Compare` | default / pressed | `startCompareMode()` | local state | browse mode only; clears any prior selection |
| `hdr-cancel` | button | `Cancel` | default / pressed | `cancelCompareMode()` | local state | compare mode only |
| `hdr-bag` | link | `Bag` | default / pressed | navigate | `/bag` | browse mode only |
| `hdr-done` | link | `Done` | default / pressed | navigate | `/bag` | picker mode only |
| `err-inline` | banner | error text | present / absent | — | — | `error \|\| discsQuery.error?.message`; the two sources are held separately so one resolving cannot wipe the other (`BagLockerPage.jsx:33-38`) |
| `cmp-count` | text | `Select 2–4 discs (n selected)` | — | — | — | bounds are `COMPARE_MIN`/`COMPARE_MAX` = 2/4 |
| `cmp-submit` | button | `Compare (n)` | enabled / disabled | `openComparison()` | `/bag/compare?ids=…` | disabled while `n < COMPARE_MIN`; `openComparison` also re-checks |
| `cta-adddisc` | link | `Add a disc` | default / pressed | navigate | `/bag/discs/new` | hidden in picker mode; **visible when embedded on `/bag`** |
| `tb-search` | text input | placeholder `Search your discs...` | — | `setQuery` | local state | always; no label element |
| `tb-grid` / `tb-list` | icon buttons | Tabler grid / list, `title` attributes | active / inactive | `setViewMode(mode)` | **localStorage** via `viewPreference` | always; the choice persists across sessions and screens |
| `flt-manufacturer` | select | `All manufacturers` + one per distinct manufacturer | — | `setManufacturer` | local state | options derive from `moldInfo.manufacturer ?? disc.manufacturer`, sorted, `Boolean`-filtered |
| `flt-speed` | select | `All speeds`, `Putter`, `Midrange`, `Fairway`, `Distance` | — | `setSpeedFilter` | local state | banding is `speedClass` (≤3 / ≤5 / ≤9 / 10+) |
| `flt-stability` | select | `All stability`, `Understable`, `Stable`, `Overstable` | — | `setStabilityFilter` | local state | banding is `stabilityClass(turn + fade)` |
| `flt-sort` | select | `Recently added`, `Speed`, `Stability` | — | `setSortKey` | local state | `sortDiscs`: speed desc, stability asc nulls last, recent by `created_at` desc |
| `flt-status` | chips ×5 | `All`, `in_locker`, `lost`, `retired`, `sold` | active / inactive | `setStatus` | local state | raw enum values are shown verbatim, not humanized |
| `res-empty` | text | `No discs match.` | — | — | — | shown for **both** a filtered-to-nothing result and an empty collection — see § 12 |
| `card-link` | link card | `DiscCard` in `to` mode | default / pressed | navigate | `/bag/discs/:discId` | browse mode only |
| `card-compare` | chip | `Compare` / `Selected` | active / inactive / **disabled** | `toggleCompareDisc` | local state | disabled when not selected and `compareIds.length >= COMPARE_MAX`; carries `aria-pressed` |
| `card-add` | chip | `Add` / `Added` | active / inactive | `addDiscToBag` / `removeDiscFromBag` | `bag_discs` | **always enabled — no capacity check**, § 6 Interlock. No `aria-pressed` |
| `page-loading` | text | `Loading...` | — | — | — | `discs` is `null` until the query settles |
| `page-error` | page | error text | — | — | — | only when the query errored **and** nothing is cached |

`DiscCard` itself renders the thumbnail (or a stability-colored fallback), title, manufacturer,
effective flight numbers with `—` for missing axes, a status badge for anything not `in_locker`, and
the optional flair block. Props and behavior in `COMPONENT_LIBRARY.md`.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Owned discs (with `moldInfo`) | `useDiscList(user.id)` | `lib/repository/discRepository` | **Supabase + Dexie** | React hook |
| Bag list, for picker-mode lookup | `fetchBags` | `lib/discLocker` | Supabase | async |
| Picker bag membership | `fetchBagDiscs` | `lib/discLocker` | Supabase | async |
| Filtering | `filterDiscs` | `lib/discFilters` | — | **pure** |
| Sorting | `sortDiscs` | `lib/discFilters` | — | **pure** |
| Stability banding for the card accent | `stabilityClass`, `stabilityColor` | `lib/discFilters` | — | **pure**, inside `DiscCard` |
| Flair tier | `discTier`, `discFlairSignal` | `lib/discFlair` | — | **pure**, inside `DiscCard` |
| View and flair preference | `getViewMode`, `getFlairMode` | `lib/viewPreference` | **localStorage** | sync |

Signatures in `LIB_API_INDEX.md`. `discs` is memoized as `discsQuery.data ?? (isError ? [] : null)`
(`BagLockerPage.jsx:29-32`) specifically so the `[]` fallback keeps a stable reference and does not
defeat the `filterDiscs`/`sortDiscs` memo while an error persists — a deliberate detail, not an
accident.

`flairEnabled` is read once into `useState(getFlairMode)` and never re-read, so toggling flair in
Settings does not take effect on this page until it remounts.

### Writes

| Mutation | Call | Notes |
|---|---|---|
| Add disc to the picker bag | `addDiscToBag(addToBagId, discId)` | Direct Supabase insert into `bag_discs`, then `captureBagVersion(bagId)` — every single add creates a new immutable bag version |
| Remove disc from the picker bag | `removeDiscFromBag(addToBagId, discId)` | Delete, then `captureBagVersion(bagId)` |
| View mode | `setViewMode(mode)` | localStorage; swallows private-mode throws |

Both membership writes are optimistic in the sense that `pickerMemberIds` updates only *after* the
await resolves (`BagLockerPage.jsx:80-85`); a rejection leaves the chip unchanged and surfaces
`err-inline`. Nothing reconciles the local `Set` against the server afterwards. Neither write carries an
idempotency key of its own — `captureBagVersion` generates one per call. The repository/transaction
contract is `PHASE_A_ARCHITECTURE.md` § 14; these calls predate it and do not follow it.

### Offline

The browse path is **the offline-capable one in the DISCS section.** `useDiscList` goes through
`readThroughCache` (`offlineFirstRepository.js:18`): a failed remote fetch falls back to the Dexie
`discs` table and returns the cached rows, so search, filters, sort, and the whole grid keep working.
`createRepository.useList` also registers a `window 'online'` listener that flushes the outbox and
invalidates the query on reconnect.

The picker path is **not** offline-capable. `fetchBags`/`fetchBagDiscs` are raw Supabase calls with no
fallback, so an offline arrival at `/bag/locker?addToBag=:id` sets `err-inline`, leaves `pickerBag`
`null`, and drops the page into browse mode. `addDiscToBag`/`removeDiscFromBag` have no outbox at all —
an offline toggle just fails and reports its message.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered: a cache-served page is visually
identical to a live one, with no `Saved on Device` indicator. Tracked in § 11.

## 6. Flow paths

**Happy path.** Arrive from `/bag` → grid renders from cache, then refreshes from the network → type
into `tb-search`, narrow with the filter selects and status chips → tap a card → `disc-detail`.

**First run / empty.** A user with zero discs sees the full toolbar, all four filter selects, the
status chips, and `No discs match.` — a message about a filter result, in a situation with no filter
applied and nothing to filter. There is no distinct empty state and no call to action beyond the
`Add a disc` link above the toolbar. See § 12.

**Error.** With no cache, `page-error` replaces the whole page (`BagLockerPage.jsx:128`) — no retry
control. With a cache, the query error becomes `err-inline` above a fully usable grid, which is the
better of the two shapes and the one to copy elsewhere. Picker and toggle failures always render
inline, never blocking.

**Offline.** As § 5. Browse works from Dexie; picker mode degrades to browse mode with an inline error.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced unconditionally in
`useDiscList(user.id)` and the picker effect.

**Interlock.** **None on this screen, and this is the hole in the 35-disc cap.** `card-add` calls
`addDiscToBag` directly with no capacity check, no count of current membership beyond the `Set` used
for labelling, and no reference to `capacityTier` or `bag.capacity`. `/bag` hides its entry point into
this page at capacity, but the URL remains directly addressable and the toggle remains live. A player
who bookmarks `/bag/locker?addToBag=:id` can push a bag past 35 without any surface objecting until the
next grouped save on `/bag/manage` fails. Full table in `screens/discs-root.md` § 12 item 1.

The compare selection *does* have a working interlock: `toggleCompareDisc` refuses to grow past
`COMPARE_MAX` (`BagLockerPage.jsx:102-108`), `card-compare` is genuinely `disabled` at the ceiling with
`aria-pressed` reflecting selection, and `cmp-submit` is `disabled` below `COMPARE_MIN` with a second
guard inside `openComparison`. This is the pattern the bag cap should follow.

**Destructive.** `card-add` in `Added` state removes the disc from the bag on tap, with no confirmation
— the same tap target that added it. This is reversible and low-stakes (membership only; the disc is
untouched), so no confirmation is warranted. This page calls no `window.confirm` and performs no
delete. `COMPONENT_LIBRARY.md` § Gaps item 8 names three pages that do; this is not one of them.

## 7. Dependencies

### Schema

`discs` (identity, `status`, `photo_url`, `override_*`, `wear_score`, `role`, `created_at`) joined to
`disc_molds` via `discs.mold_id` — never drop this FK (`docs/development/CURRENT_WORK.md` § Standing
decisions); `bags` and `bag_discs` for picker mode; `disc_cosmetic_unlocks`, joined by
`DISC_WITH_MOLD` and read by `discTier` for the flair variant. The Dexie mirror is the `discs` table in
`db/dexieDb`.

### Library

`lib/repository/discRepository`, `lib/discLocker`, `lib/discFilters`, `lib/discFlair`,
`lib/discCompare` (bounds only), `lib/viewPreference`. Signatures in `LIB_API_INDEX.md`.

### Components

`DiscCard` (three call sites, one per mode) and `ChipGroup`. `DiscCard`'s only consumer in the app is
this page — see `_corrections/component-library.md` item 3. Details in `COMPONENT_LIBRARY.md`.

### Screens

Rendered inline by `discs-root` with `embedded`, so a change here changes `/bag` too. Feeds
`disc-detail` (card tap), `disc-new` (`Add a disc`), and `disc-compare` (`?ids=`). Is the picker target
for `discs-root`'s `Add from locker`.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` §§ 12–14. `PRODUCT_ROADMAP.md` Phase C item 1 (collection-first hub) and the
J3 game-flair jump-ahead are the shipped-work record. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- `card-compare` sets `aria-pressed` and a real `disabled` attribute — the only chip group in the DISCS
  section that exposes its state correctly. Copy this, not `ChipGroup`.
- **Gap:** `card-add` — the picker's counterpart — has neither `aria-pressed` nor `disabled`. The two
  chips are visually and structurally parallel and semantically different.
- **Gap:** `tb-search` has a placeholder and no `<label>`. Placeholder-as-label fails at 200% text
  scaling and disappears on first keystroke.
- **Gap:** all four filter selects are bare `<select>` elements with no associated label; their meaning
  rests entirely on the `all` option text (`All manufacturers`, `All speeds`, …), which vanishes once a
  filter is applied.
- **Gap:** `tb-grid`/`tb-list` are icon-only buttons whose accessible name comes from `title`, not
  `aria-label`. `title` is unreliable across screen readers and invisible on touch. Neither carries
  `aria-pressed` for the active view.
- **Gap:** `flt-status` renders raw enum values (`in_locker`, `retired`) as user-facing chip labels.
- `DiscCard`'s thumbnail uses `alt=""` and is correctly decorative; the title text carries the name.
  Non-`to` cards are not focusable, which is right — the action chip is the interactive element.
- The compare toolbar is `role="status"`, so selection count changes are announced.

## 9. Events and telemetry

No metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted. No notification is produced or
consumed. No activity-lifecycle event is written.

Picker-mode membership changes do produce append-only rows through the database: the
`bag_discs_record_membership_change` trigger writes a `bag_added`/`bag_removed` row into
`disc_state_events` (`20260715183500_phase_b_disc_timelines_bag_versions.sql:184`), and
`addDiscToBag`/`removeDiscFromBag` each call `captureBagVersion`, minting a new `bag_versions` row per
toggle. A player adding eight discs one at a time creates eight versions.

## 10. Tests

### Existing coverage

`src/lib/discFilters.test.js`, `discLocker.test.js`, `discFlair.test.js`, and — because the compare
bounds come from there — `discCompare.test.js`. Matches the `disc-collection` row in `TEST_MAP.md`.

Coverage is entirely at the library layer. **There is no component or page test for
`BagLockerPage.jsx`**, and none for `DiscCard`. Nothing asserts that the three card modes are mutually
exclusive, that picker mode is entered from the query parameter, or that the compare ceiling reaches
the button's `disabled` attribute.

### Acceptance criteria

1. With no `addToBag` parameter and compare mode off, every card is a link to its disc.
2. `?addToBag=:ownedBagId` renders `Add to {bag name}`, hides `Add a disc`, and gives every card an
   `Add`/`Added` chip.
3. `?addToBag=:foreignId` renders browse mode with no visible error — current behavior, asserted so a
   change to it is deliberate (see § 12 item 2).
4. Selecting a fifth disc in compare mode is impossible: the fifth chip is `disabled`.
5. `Compare (2)` navigates to `/bag/compare?ids=a,b` and that URL renders a valid comparison.
6. Switching to list view persists across a reload and is also in effect on `/bag`'s Collection tab.
7. A status filter of `lost` shows only `lost` discs, including those still holding bag membership.
8. With the network unavailable and a populated Dexie cache, the grid renders from cache and search and
   filters still work.
9. With the network unavailable and an empty cache, the page renders an error with no retry control —
   current behavior, asserted only.

### E2E critical paths

Browse → filter → open a disc → back, asserting filters are lost (current behavior). Picker round trip:
`/bag` → `Add from locker` → add two → `Done` → the bag list shows both. Compare round trip: select
three → `Compare (3)` → the comparison renders all three. Offline browse from cache. No automated
browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing
coverage.

## 11. Tasks

#### T-disc-collection-1 — Distinguish "no discs yet" from "no discs match"

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagLockerPage.jsx`
- **Done when:** A collection with zero discs renders an empty state naming the absence and offering
  `Add a disc`; a non-empty collection filtered to nothing still renders `No discs match.` with a way
  to clear filters.
- **Verify:** `npm test` with a page-level test covering both cases.
- **Commit:** `feat: give the locker a real empty state`

#### T-disc-collection-2 — Enforce bag capacity on the picker toggle

- **Capability:** `data-access`
- **Touches:** `src/pages/BagLockerPage.jsx`, `src/lib/bags.js`
- **Done when:** With the picker bag at capacity, unselected `Add` chips are `disabled` with a stated
  reason and `addDiscToBag` is not called; already-added chips still remove.
- **Verify:** `npm test` covering the at-capacity picker.
- **Commit:** `feat: enforce bag capacity in the locker picker`
- **Blocked by:** `screens/discs-root.md` § 12 open question 1.

#### T-disc-collection-3 — Label the toolbar controls

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagLockerPage.jsx`
- **Done when:** The search input and all four filter selects have visible or visually-hidden
  `<label htmlFor>` pairs; the view toggles use `aria-label` plus `aria-pressed` instead of `title`.
- **Verify:** `npm run lint` and a manual VoiceOver pass at `/bag/locker`.
- **Commit:** `fix: label the locker toolbar for assistive tech`

#### T-disc-collection-4 — Give the picker chip the same semantics as the compare chip

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagLockerPage.jsx`
- **Done when:** `card-add` carries `aria-pressed` reflecting membership, matching `card-compare`.
- **Verify:** `npm run lint` and a manual VoiceOver pass in picker mode.
- **Commit:** `fix: expose picker chip state to assistive tech`

#### T-disc-collection-5 — Show the offline calm state when serving from cache

- **Capability:** `sync`
- **Touches:** `src/pages/BagLockerPage.jsx`, `src/lib/repository/createRepository.js`
- **Done when:** A cache-served render displays `Saved on Device` per `PHASE_A_ARCHITECTURE.md` § 12,
  and a live render displays `Synced`; the indicator reserves stable layout space.
- **Verify:** `npm test` asserting the flag surfaces from `readThroughCache`, plus manual offline check.
- **Commit:** `feat: surface the offline calm state in the locker`

## 12. Open questions

1. **Bag capacity is not enforced here at all.** This screen is the widest hole in the 35-disc
   interlock: `card-add` writes membership with no check while `/bag` believes it has blocked the path.
   The full cross-surface table and the decision it needs are in `screens/discs-root.md` § 12 item 1;
   `screens/disc-detail.md` § 12 item 1 raised the same question against a different surface. Logged
   against `SCREEN_SPECS.md:73-74,174` in `_corrections/discs-screens.md` D-1. Blocks
   `T-disc-collection-2`.
2. **A foreign or malformed `addToBag` id fails silently.** `pickerBag` resolves to `null` and the page
   renders browse mode, but `addToBagId` is still the raw parameter, so the code path that would write
   to it is dead only because no toggle renders. Should an unresolvable id render an explicit error?
3. **Every membership toggle mints a bag version.** `addDiscToBag` and `removeDiscFromBag` each call
   `captureBagVersion`, so assembling a bag one disc at a time in picker mode produces one immutable
   version per tap. `/bag/manage` deliberately batches this into one version per grouped save
   (`One save updates this bag and creates one immutable version.`). Two different histories for one
   user intent. Which is the contract?
4. **Membership state is optimistic with no reconciliation.** `pickerMemberIds` updates after a
   successful await, and nothing re-reads the server afterwards. A concurrent change on another device
   is invisible until remount. Same shape as `screens/disc-detail.md` § 12 item 3.
5. **`flairEnabled` is captured once at mount.** Changing the flair preference in Settings has no
   effect on an already-mounted locker, including the embedded one on `/bag`.
6. **`COPY_AND_TERMINOLOGY.md` T-2 attributes an empty-state string to this route that lives
   elsewhere.** Logged in `_corrections/discs-screens.md` D-2.

## 13. Blueprint divergence

Blueprint Screen 5 draws browsing as the *Disc Universe* accordion over the shared catalog. It does not
draw a filtered grid of the player's own discs at all — the shipped locker is the "MY BAGS" idea
generalized into a collection view, and `SCREEN_SPECS.md:159` records it as REUSE ("locker content,
filters/sort/grid-list") rather than as a drawn screen.

| Blueprint Screen 5 element | Shipped here |
|---|---|
| Zero-scrollbar workspace | Ordinary vertical scroll, per standing divergence and `PHASE_A_ARCHITECTURE.md` § 12's one-scroll-owner rule |
| `[ + ADD TO BAG ]` 48px action target on a run row | `card-add` chip on a disc card, sized by the shared `.chip` rule rather than an explicit 48px target |
| 35-disc interlock disabling `[ + Add to Bag ]` | **Not implemented on this screen** — § 6 Interlock |
| Ghost-slot cards | Not here; they live on `/bag`'s Universe and Bags tabs |

Two elements have **no blueprint counterpart at all** and are post-blueprint additions: the compare
selection mode (`PRODUCT_ROADMAP.md` jump-ahead J2, Phase C item 5) and the grid/list view toggle with
its persisted preference.

`SCREEN_SPECS.md:163` cites `discLocker.searchMolds` in this screen's REUSE list; that export was
removed in `6c88410` and mold search is now `catalogRepository.filterCatalogMolds` — already logged as
`_corrections/lib-api-index.md` item 1, referenced not repeated. Standing divergences #1 (React/Vite,
not Expo) and #3 (append-only schema) apply; see `SCREEN_SPECS.md`.
