# Discs Root

| Field | Value |
|---|---|
| Route id | `discs-root` |
| URL pattern | `/bag` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Discs` |
| Activity pill | shown |
| Scroll key | `discs-root` |
| Preserves nested state | no |
| Page component | `src/pages/BagPage.jsx` (239 lines) |
| Blueprint screen | Screen 5 — partial; also carries part of Screen 6. See § 13 |
| Verified against | `7351964` |

## 1. Purpose

The DISCS section root: a four-tab hub over everything the player owns. It answers "what do I have,
what is in the bag I am carrying, is that bag balanced, and what am I missing." It is also the section
root every DISCS tab re-tap returns to, so it must be readable with no prior context.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | DISCS tab press from another section | `TabBar` → `NAVIGATE` | Primary path |
| In | DISCS tab re-tap while already in `/bag/*` and scrolled to top | `TabBar` → `resolveSectionRoot('discs')` | Three-state tab press, `NAVIGATION_MAP.md` § Tab press behavior |
| In | Shell back control from any `/bag/*` child | `GlobalHeader` `handleBack()` | Back is section-root navigation, not history |
| In | `Bag` link in the locker header | `Link` from `/bag/locker` | |
| In | `Bag` link in the manage header | `Link` from `/bag/manage` | |
| In | `Done` link in locker picker mode | `Link` from `/bag/locker?addToBag=:bagId` | Closes the picker loop opened by `cta-add` below |
| In | Post-create redirect for a multi-copy add | `navigate('/bag', { replace: true })` from `DiscFormPage.jsx:86` | Only when `quantity > 1`; a single copy goes to `disc-detail` instead |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` can redirect a zero-bag user to `/onboarding` first |
| Out | `Lost & Found` link | `Link` to `/bag/lost-found` | Present on both the Collection tab and the Bags tab, with no `?disc=` parameter |
| Out | `Compare` link | `Link` to `/bag/compare` | Collection tab only. Carries **no** `?ids=`, so it lands on `disc-compare`'s invalid state — see § 12 |
| Out | `Manage bags` link | `Link` to `/bag/manage` | Bags tab only |
| Out | `Locker` link | `Link` to `/bag/locker` | Bags tab only |
| Out | `Add from locker` | `Link` to `/bag/locker?addToBag=:selectedBagId` | Suppressed at capacity — see § 4 |
| Out | `Create your first bag` | `Link` to `/bag/manage` | Zero-bag branch of the Bags tab |
| Out | Disc row in bag contents | `Link` to `/bag/discs/:discId` | |
| Out | Plotted disc in the Flight Spectrum detail list | `Link` to `/bag/discs/:discId` | `FlightSpectrum.jsx:90` |
| Out | Disc card in the embedded locker | `Link` to `/bag/discs/:discId` | Collection tab, via `DiscCard`'s `to` prop |
| Out | `Add a disc` in the embedded locker | `Link` to `/bag/discs/new` | Collection tab |
| Out | Plastic row in the Universe accordion | `Link` to `/bag/discs/new?mold=:moldId&plastic=:name` | `UniverseBrowser.jsx:87`; the hand-off `disc-new` consumes |
| Out | Shell back control | — | **Not rendered.** `showBack = Boolean(route && !isRoot)` and this *is* the section root |

**Tab state is not addressable.** The four-way tab lives in `useState('collection')`
(`BagPage.jsx:23`), not in the URL or in route state. A reload, a deep link, a tab re-tap, or a return
from any child route all land on Collection. `preserveNestedState` is `false`, so scroll position is
likewise not restored across a shell remount. There is no query-parameter contract on this route.

## 3. Layout

### 3a. Frame (illustrative)

Bags tab shown; the other three are sketched in the outline.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|      Discs                             [activity pill]| <- Shell header, no back control
+-------------------------------------------------------+
|  Discs                                                | <- Page h1, duplicates the shell title
|  [Collection] [Bags] [🎯 Putters] [Universe]          | <- ChipGroup, 4-way, local state
+-------------------------------------------------------+
|  [ Main Bag (default)  v ]  Manage bags  Locker  L&F  | <- Bag switcher + link row
+-------------------------------------------------------+
|  19 / 35 discs                                        |
|  [██████████████░░░░░░░░░░░░░░░░░░░]                  | <- capacityTier: ok | warn | full
|  [ Add from locker ]                                  | <- becomes a disabled span at 'full'
+-------------------------------------------------------+
|  FLIGHT SPECTRUM            [Current reality][Official]|
|         Stability                                     |
|      |          o    <>                               | <- o = disc/cluster, <> = ghost slot
|      |    (2)  o                                      |
|      +---------------------  Speed                    |
|  o Physical disc  (2) Cluster  <> Desired slot        |
|  Plotted physical discs: Thunderbird 9.0 speed ...    | <- text equivalent for the SVG
+-------------------------------------------------------+
|  BAG RESONANCE                        72 / 100        |
|  [Balanced][Coverage-first][Minimal]                  |
|  Coverage ████  Speed ladder ███  Separation ██       |
+-------------------------------------------------------+
|  Thunderbird                            Innova        | <- one row per in_locker member
|  Buzzz                                  Discraft      |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  title "Discs", activity pill; no back control (section root)
Page header (all tabs)
  hdr-title ............ h1 "Discs"
  tab-chip ............. ChipGroup, one per TABS entry: collection | mybags | putters | universe
Collection tab (default)
  col-summary .......... 4 figures: Total discs, Active, Bagged, Lost
  col-lostfound ........ link to /bag/lost-found
  col-compare .......... link to /bag/compare
  col-recent ........... "Recently added: a, b, c" — top 3 by created_at, hidden when empty
  col-locker ........... <BagLockerPage embedded /> — the whole disc-collection body, header suppressed
Bags tab (mybags)
  bag-empty ............ "You don't have a bag yet." + cta-firstbag, when bags.length === 0
  cta-firstbag ......... link to /bag/manage
  bag-select ........... <select> over bags; label = name + " (default)"
  bag-manage ........... link to /bag/manage
  bag-lockerlink ....... link to /bag/locker
  bag-lostfound ........ link to /bag/lost-found
  cap-readout .......... "{n} / {cap} discs"; class form-error at 'full', log-time otherwise
  cap-bar .............. track + fill, width = min(100, n/cap*100)%, class capacity-bar-fill-{tier}
  cta-add .............. link to /bag/locker?addToBag={selectedBagId} — replaced at 'full'
  cap-blocked .......... span, aria-disabled, "Bag full — remove a disc to add another"
  ghost-error .......... "Desired slots unavailable: {message}", when loadGhostSlots rejected
  spectrum ............. <FlightSpectrum discs ghostSlots />
  resonance ............ <BagResonance discs ghostSlots capacity />
  bag-loading .......... "Loading..." while the selected bag's discs are in flight
  bag-nodiscs .......... "No discs in this bag yet."
  bag-row .............. one link per in_locker member → /bag/discs/:id; name + manufacturer
Putters tab
  putter-lineup ........ <PutterLineup userId /> — role swimlanes, flight curve, wear slider, Retire
Universe tab
  universe ............. <UniverseBrowser discs={allDiscs} /> — ghost gap cards, search, accordion
Page-level states (replace everything above)
  page-error ........... <p class="form-error"> as the entire page
  page-loading ......... <p class="loading">Loading...</p> until fetchBags resolves
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | `Discs` | — | — | — | always |
| `tab-chip` | chip ×4 | `Collection`, `Bags`, `🎯 Putters`, `Universe` | active (`chip-active`) / inactive | `setTab(key)` | local state | always; no `aria-pressed` (`ChipGroup` limitation) |
| `col-summary` | figures ×4 | `Total discs`, `Active`, `Bagged`, `Lost` | — | — | — | always; counts are `allDiscs?.length ?? 0`, `status==='in_locker'`, `baggedDiscIds.size`, `status==='lost'` |
| `col-lostfound` | link | `Lost & Found` | default / pressed | navigate | `/bag/lost-found` | always |
| `col-compare` | link | `Compare` | default / pressed | navigate | `/bag/compare` | always — but always lands on the invalid-selection state, § 12 |
| `col-recent` | text | `Recently added: …` | present / absent | — | — | rendered only when at least one disc exists |
| `col-locker` | embedded page | — | inherits `disc-collection` | — | — | `embedded` suppresses only the page header, so Compare mode is unreachable here |
| `bag-empty` | text | `You don't have a bag yet.` | — | — | — | `bags.length === 0`; effectively unreachable, § 12 |
| `cta-firstbag` | link | `Create your first bag` | default / pressed | navigate | `/bag/manage` | with `bag-empty` |
| `bag-select` | select | one option per bag, `(default)` suffix on `is_default` | — | `setSelectedBagId` | local state | always; initial value is the default bag, else the first |
| `cap-readout` | text | `{n} / {cap} discs` | ok / warn / full | — | — | `n` counts **`in_locker` members only** (`bagViewDiscs`); `cap = bag.capacity ?? 35` |
| `cap-bar` | meter | — | `capacity-bar-fill-ok` / `-warn` / `-full` | — | — | `capacityTier(n, cap)`: `full` at `n ≥ cap`, `warn` in the last 5 slots |
| `cta-add` | link | `Add from locker` | default / pressed / **absent at capacity** | navigate | `/bag/locker?addToBag={bagId}` | rendered only when `tier !== 'full'` |
| `cap-blocked` | span | `Bag full — remove a disc to add another` | static | none | — | rendered when `tier === 'full'`; `aria-disabled="true"` on a non-focusable `<span>`, not a disabled button. **Hides the entry point; does not enforce the cap** — see § 6 Interlock and § 12 |
| `ghost-error` | banner | `Desired slots unavailable: {message}` | present / absent | — | — | `loadGhostSlots` rejected with nothing cached |
| `spectrum` | chart | `Flight Spectrum` | Current reality / Official; empty-data note | mode toggle | local state | ghost slots are drawn as diamonds and never counted against capacity |
| `resonance` | panel | `Bag Resonance` | Balanced / Coverage-first / Minimal | preset select | local state | capacity passed through for the `n/capacity` readout |
| `bag-loading` | text | `Loading...` | — | — | — | while `fetchBagDiscs(selectedBagId)` is in flight |
| `bag-nodiscs` | text | `No discs in this bag yet.` | — | — | — | zero `in_locker` members |
| `bag-row` | link | nickname ‖ mold name ‖ raw mold; manufacturer | default / pressed | navigate | `/bag/discs/:discId` | one per `in_locker` member |
| `putter-lineup` | component | four swimlanes | error / loading / empty / lanes | role, wear, retire | `discs` | see § 6 Destructive |
| `universe` | component | ghost cards + search + accordion | — | expand, deep-link | `/bag/discs/new?mold=…` | ghost cards are non-interactive `<div>`s, § 13 |
| `page-error` | page | error message text | — | — | — | any of the three loaders rejecting; **no retry control** |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| User's bags | `fetchBags` | `lib/discLocker` | Supabase | async |
| Every bag's members (for the Bagged count) | `fetchBagDiscs` ×N | `lib/discLocker` | Supabase | async |
| All owned discs | `fetchUserDiscs` | `lib/discLocker` | Supabase | async |
| Selected bag's members | `fetchBagDiscs` | `lib/discLocker` | Supabase | async |
| Persisted ghost slots for the selected bag | `loadGhostSlots` | `lib/repository/discTaxonomyRepository` | Supabase + Dexie | async |
| Bag-view filtering | `bagViewDiscs` | `lib/bags` | — | **pure** |
| Capacity banding | `capacityTier` | `lib/bags` | — | **pure** |
| Spectrum points and clusters | `buildFlightSpectrum` | `lib/flightSpectrum` | — | **pure**, inside `FlightSpectrum` |
| Resonance score | `buildBagResonance` | `lib/bagResonance` | — | **pure**, inside `BagResonance` |
| Stability gaps (Universe tab) | `stabilityGaps` | `lib/wishlist` | — | **pure**, inside `UniverseBrowser` |
| Catalog (Universe tab) | `useCatalog`, `filterCatalogMolds` | `lib/repository/catalogRepository` | Supabase + Dexie | React hook |
| Putters (Putters tab) | `fetchUserDiscs` | `lib/discLocker` | Supabase | async, inside `PutterLineup` |
| Collection body | see `screens/disc-collection.md` § 5 | — | Dexie-backed | — |

Signatures in `LIB_API_INDEX.md`. Three independent `useEffect`s run the page's own loads
(`BagPage.jsx:34`, `:50`, `:56`), plus a fourth for ghost slots (`:65`). They are not sequenced with
each other; `allDiscs` and `bags` land independently, which is why the Collection tab's four counts can
render `0` for one frame before `fetchUserDiscs` resolves.

**Two unrelated ghost-slot mechanisms share the word "ghost" on this one screen.** The Bags tab reads
**persisted** `bag_ghost_slots` rows scoped to the selected bag. The Universe tab computes
**ephemeral** gaps with `stabilityGaps` over every owned disc, persisting nothing. Neither feeds the
other. Only `/bag/manage` can create a persisted slot.

### Writes

**N/A** — this screen performs no mutation of its own. Every write reachable from `/bag` belongs to a
child component with its own contract: `PutterLineup` (`updateDiscRole`, `updateDiscWear`,
`upsertDisc` for retirement) and the embedded `BagLockerPage` in picker mode, which is unreachable here
because no `addToBag` parameter is present on `/bag`. The repository/transaction contract is
`PHASE_A_ARCHITECTURE.md` § 14.

### Offline

**This screen does not work offline.** `fetchBags` and `fetchUserDiscs` are direct Supabase calls with
no cache fallback, and either rejection sets `error`, which short-circuits the whole page to
`<p className="form-error">` at `BagPage.jsx:84`. The embedded Collection body *is* offline-capable —
`useDiscList` reads through Dexie — but it never renders, because the page-level guard runs first.

`loadGhostSlots` has a Dexie fallback and degrades to an inline `ghost-error` rather than blocking.
`useCatalog` in the Universe tab has an IndexedDB snapshot fallback. Both are unreachable behind the
page guard.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`) is rendered anywhere on this screen. Tracked in § 11 and § 12.

## 6. Flow paths

**Happy path.** Arrive on Collection → four counts and the embedded locker render → tap `Bags` →
switcher defaults to the main bag → capacity bar, Flight Spectrum, Bag Resonance, and the member list
render → tap a member → `disc-detail`.

**First run / empty.** A freshly onboarded user has one bag ("Practice Stack") and zero or one disc.
Collection shows `0`/`0`/`0`/`0` with no `col-recent` line and the embedded locker's `No discs match.`;
Bags shows `0 / 35 discs` and `No discs in this bag yet.`; Putters shows `No putters in your locker yet
— add one to build your lineup.`; Universe shows an empty accordion with no ghost cards, because
`stabilityGaps` derives gaps only from speed classes the player already carries.

**Error.** Any of `fetchBags`, `fetchUserDiscs`, or `fetchBagDiscs` rejecting renders the message as
the entire page — no header, no tabs, no retry control, no navigation except the shell chrome. The
error is sticky: nothing re-runs the effects without a route change or reload. Same shape as the
`disc-detail` pre-load error and the same gap.

**Offline.** As § 5: the page-level error path, not a degraded render. This is not active capture, so
§ 12's "a network failure never replaces active capture with a full-screen error" does not strictly
bind — but a cached locker exists and is deliberately not shown, which is the sharper defect.

**Auth / guard.** `ProtectedRoute` gates the shell. `useOnboardingGate` runs once per app load and
redirects a zero-bag user to `/onboarding`; it fails open on a fetch error. `user.id` is dereferenced
unconditionally in all three effects, so there is no anonymous rendering path.

**Interlock.** The 35-disc cap is **advisory on this screen.** `capacityTier` drives the bar color and
swaps `cta-add` for the non-interactive `cap-blocked` span, which removes the entry point into the
locker picker. It does not prevent the write: `/bag/locker?addToBag=:bagId` remains directly
addressable, and its `Add` toggle calls `addDiscToBag` with no capacity check
(`BagLockerPage.jsx:74-89`). No database constraint limits `bag_discs` row count. Full analysis in
§ 12; the sibling enforcement on `/bag/manage` is documented in `screens/bag-manage.md` § 6.

Two further wrinkles make the readout itself soft. The count is `in_locker`-only, so a bag holding 35
memberships of which three are `lost` reads `32 / 35` and stays addable. And `cap` is
`bag.capacity ?? 35`, a per-bag display value — while `/bag/manage` caps membership at a hard-coded
`35` regardless of `bag.capacity`.

**Destructive.** No destructive action belongs to this page. One is reachable through it: the Putters
tab's `Retire` (`PutterLineup.jsx:133`) writes `status: 'retired'` **with no confirmation of any kind**
— no `window.confirm`, no typed phrase, no undo. It sits in the same button stack as the role chips and
the wear slider, which is the arrangement `PHASE_A_ARCHITECTURE.md` § 12 warns against. Recorded in
`COMPONENT_LIBRARY.md` § Gaps item 8; task in § 11.

## 7. Dependencies

### Schema

`bags` (`name`, `description`, `bag_type`, `capacity`, `is_default`; partial unique index
`bags_one_default_per_user`), `bag_discs` (join, `unique (bag_id, disc_id)`, no cardinality
constraint), `discs` (`status`, `role`, `wear_score`, `total_chain_hits`, `override_*`) joined to
`disc_molds` via `discs.mold_id` — never drop this FK (`docs/development/CURRENT_WORK.md` § Standing
decisions), `bag_ghost_slots` (`20260715190500_phase_b_ghost_slots_shot_tags.sql`; partial unique index
`bag_ghost_slots_active_slot_uniq` on active slots), and the shared catalog tables behind `useCatalog`.

### Library

`lib/discLocker`, `lib/bags`, `lib/wishlist`, `lib/flightSpectrum`, `lib/bagResonance`,
`lib/discTaxonomy`, `lib/repository/discTaxonomyRepository`, `lib/repository/catalogRepository`.
Signatures in `LIB_API_INDEX.md`.

### Components

`ChipGroup`, `FlightSpectrum`, `BagResonance`, `PutterLineup`, `UniverseBrowser`, and
`BagLockerPage` rendered as a component with `embedded`. Details in `COMPONENT_LIBRARY.md`.
`FlightChart` is **not** used here and has no importers at all — see `_corrections/component-library.md`
item 1; do not re-log it.

### Screens

Requires `bag-manage` (bag creation and the only ghost-slot authoring surface) and `disc-collection`
(rendered inline). Links out to `lost-found`, `disc-compare`, `disc-new`, and `disc-detail`. Is the
return target for every DISCS back press and tab re-tap, so it must render without arguments.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` §§ 12–13. `PRODUCT_ROADMAP.md` Phase C items 1, 3, and 4 (collection-first
hub, Flight Spectrum, Bag Resonance) are the shipped-work record. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- `FlightSpectrum` is the best chart in the codebase for this: `role="img"` with a count-bearing label,
  an `aria-pressed` mode toggle inside a `role="group"`, and a `Plotted physical discs` list that gives
  every point a text equivalent. `BagResonance` follows the same pattern with an explicit
  `aria-label="Resonance score N out of 100"` and `aria-hidden` bar tracks.
- `col-summary` carries `aria-label="Collection summary"` on its container, but each figure is a bare
  `<div><strong>n</strong><span>label</span></div>` with no programmatic number/label association.
- **Gap:** `cap-blocked` is a `<span class="start-button" aria-disabled="true">`. It is not focusable,
  so a keyboard or screen-reader user moving through the page simply finds the add affordance gone
  rather than finding it disabled and being told why. `aria-disabled` on a non-focusable element
  announces nothing.
- **Gap:** `cap-bar` conveys the warn/full state through fill color plus the `form-error` class on the
  readout text. The numbers are present, so it is not color-alone — but there is no `role="progressbar"`
  and no `aria-valuenow`.
- **Gap:** the four `tab-chip`s are a tab set in behavior and a plain button row in semantics. No
  `role="tablist"`, no `aria-selected`, no `aria-pressed` — `ChipGroup` emits none
  (`COMPONENT_LIBRARY.md` § Gaps item 10).
- **Gap:** `hdr-title` renders a second `<h1>Discs</h1>` beneath the shell's own `<h1>` of the same
  text, so the page has two level-one headings with identical content.
- `UniverseBrowser`'s accordion headers carry no `aria-expanded`/`aria-controls`, and its search input
  has a placeholder but no label.

## 9. Events and telemetry

No metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted by this page. No notification is
produced or consumed. No activity-lifecycle event is written.

Writes made *through* this page do produce append-only rows: the Putters tab's role, wear, and retire
mutations fire the `discs` state-change trigger into `disc_state_events`, and any membership change
made from a screen this one links to fires `bag_discs_record_membership_change`
(`20260715183500_phase_b_disc_timelines_bag_versions.sql:184`) plus a `capture_bag_version` call.

## 10. Tests

### Existing coverage

`src/lib/bags.test.js`, `bagHistory.test.js`, `bagResonance.test.js`, `wishlist.test.js`,
`flightCurve.test.js`, `flightSpectrum.test.js`, `discLocker.test.js`. This matches the
`discs-root` row in `TEST_MAP.md`, with `flightSpectrum` added — `FlightSpectrum` is what this page
actually renders, and `TEST_MAP.md` files that test under `disc-compare` only.

Coverage is entirely at the library layer. **There is no component or page test for `BagPage.jsx`.**
Nothing asserts that the tab switch works, that the capacity tier reaches the right element, or that
`bagViewDiscs` is the count feeding `capacityTier`.

### Acceptance criteria

1. Landing on `/bag` from any entry shows the Collection tab, regardless of which tab was last used.
2. The `Bagged` count equals the number of distinct discs that are a member of at least one bag, not
   the number of memberships.
3. A bag with 30 `in_locker` members and `capacity` 35 renders the `warn` bar and still offers
   `Add from locker`.
4. A bag with 35 `in_locker` members renders `cap-blocked` and no `Add from locker` link.
5. A bag with 35 memberships of which 3 are `lost` renders `32 / 35` and still offers
   `Add from locker` — current behavior, asserted so a future change to it is deliberate.
6. A bag whose `capacity` is 10 renders `n / 10` and blocks at 10.
7. A ghost slot removed on `/bag/manage` no longer plots on the Flight Spectrum (`activeGhostSlots`
   filtering inside `buildFlightSpectrum`).
8. The Universe tab renders one ghost card per uncovered stability class, capped at 3, and none for a
   speed class the player does not carry.
9. With the network unavailable and a populated Dexie cache, the page currently renders a full-screen
   error. **This is a defect, asserted as current behavior only** — see task `T-discs-root-1`.

### E2E critical paths

Tab through all four tabs and back, asserting no fetch storm and no lost state. Switch bags in the
selector and confirm capacity, spectrum, resonance, and member list all re-derive from the new bag. Add
a disc to a full bag by navigating directly to `/bag/locker?addToBag=:id` and confirm what happens —
this is the interlock's real boundary. Go offline and reload. No automated browser E2E suite exists
(`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing coverage.

## 11. Tasks

#### T-discs-root-1 — Render the cached collection when the network is unavailable

- **Capability:** `data-access`
- **Touches:** `src/pages/BagPage.jsx`
- **Done when:** With `fetchBags`/`fetchUserDiscs` rejecting and a populated Dexie disc cache, `/bag`
  renders the Collection tab from cache with a `Saved on Device` indicator instead of a full-screen
  error; the Bags tab explains that bag membership is unavailable offline.
- **Verify:** `npm test` with a new page-level test that rejects both fetches and seeds `db.discs`.
- **Commit:** `fix: keep /bag usable offline from the disc cache`

#### T-discs-root-2 — Add a retry affordance to the page error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagPage.jsx`
- **Done when:** A failed load renders the error plus a `Retry` control that re-runs all three loaders;
  a succeeding retry renders the hub without a page reload.
- **Verify:** `npm test` with a test that rejects `fetchBags` once then resolves.
- **Commit:** `fix: allow retry when the discs hub fails to load`

#### T-discs-root-3 — Confirm before retiring a putter

- **Capability:** `ui-routine`
- **Touches:** `src/components/putterLineup/PutterLineup.jsx`
- **Done when:** `Retire` requires an explicit in-app confirmation before writing `status: 'retired'`,
  and the confirmation is not `window.confirm` (`COMPONENT_LIBRARY.md` § Gaps item 8).
- **Verify:** `npm run lint` plus manual check on the Putters tab; add a test once a shared confirm
  component exists.
- **Commit:** `fix: confirm putter retirement before writing status`

#### T-discs-root-4 — Give the capacity block a real disabled control

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagPage.jsx`
- **Done when:** At capacity the page renders a focusable `<button disabled>` (or a link with
  `aria-disabled` and a focusable target) whose accessible name states the reason; keyboard users reach
  it and hear why adding is unavailable.
- **Verify:** `npm run lint` and manual VoiceOver pass at `/bag` with a full bag.
- **Commit:** `fix: expose bag-full state to assistive tech`

#### T-discs-root-5 — Give `Compare` a valid destination

- **Capability:** `ui-routine`
- **Touches:** `src/pages/BagPage.jsx`
- **Done when:** The Collection tab's `Compare` link either carries an `ids` selection or routes into
  the locker's compare mode, so it never lands on `disc-compare`'s "Choose at least 2 discs" state.
- **Verify:** Manual check from `/bag` → Compare; add a route-level assertion when page tests exist.
- **Commit:** `fix: route Compare through disc selection`

#### T-discs-root-6 — Decide and unify the bag capacity contract

- **Capability:** `schema`
- **Touches:** `src/lib/bags.js`, `src/pages/BagPage.jsx`, `src/pages/BagLockerPage.jsx`,
  `src/pages/BagManagePage.jsx`, a new migration
- **Done when:** One count definition and one cap value are used by every add path, and adding past the
  cap fails with a stated message on every path including `/bag/locker?addToBag=`.
- **Verify:** `npm test` covering the at-capacity case on each path, plus a negative migration test.
- **Commit:** `feat: enforce one bag capacity contract across every add path`
- **Blocked by:** § 12 open question 1.

## 12. Open questions

1. **Bag capacity is enforced in three different places with three different rules, and nowhere in the
   database.** This resolves the question `screens/disc-detail.md` § 12 item 1 left open, and it
   resolves it against `SCREEN_SPECS.md` standing divergence 6 ("both hard, as specified — … 35-disc
   bag capacity, each with app-side disabling AND a DB `CHECK` constraint") and against
   `SCREEN_SPECS.md:174` ("35-disc interlock needs the Layer 1 `bags.capacity` default/CHECK
   migration"). What actually ships:

   | Surface | Count used | Cap used | Effect |
   |---|---|---|---|
   | `/bag` (here) | `in_locker` members only | `bag.capacity ?? 35` | Hides `cta-add`. Advisory |
   | `/bag/manage` | all draft members, any status | hard-coded `35` | Disables unchecked checkboxes (`BagManagePage.jsx:234`) |
   | `/bag/locker?addToBag=` | — | — | **No check at all** (`BagLockerPage.jsx:74-89`) |
   | `disc-detail` bag chips | — | — | **No check at all** (`screens/disc-detail.md` § 6) |
   | `grouped_save_bag` RPC | distinct `p_disc_ids` | hard-coded `35` | Raises `A bag cannot contain more than 35 discs` (`20260716193000_phase_c_grouped_bag_save.sql:92`) |
   | `restore_bag_version` RPC | snapshot members | — | **No cardinality check** |

   There is **no `CHECK` constraint on `bag_discs` cardinality anywhere.** The only `CHECK` naming 35
   is on the stored capacity *number*: `bag_versions.capacity between 0 and 35`
   (`20260715183500_phase_b_disc_timelines_bag_versions.sql:46`). `bags.capacity` itself carries no
   constraint at all (`bags_schema.sql:22` — plain `capacity integer`), so the RPC's
   `p_capacity between 0 and 35` guard is the only thing keeping the column in range, and only on the
   grouped-save path.

   Consequence: a bag can exceed 35 members today by repeatedly using `/bag/locker?addToBag=` or the
   `disc-detail` chips, and the next grouped save of that bag will then fail with a raw
   `A bag cannot contain more than 35 discs` string the user cannot act on from `/bag/manage`.
   Needs one decision: is the cap a data-integrity rule (add the constraint, then make every path
   handle its rejection) or a UI guideline (say so, and drop the RPC exception)? Blocks
   `T-discs-root-6` and `T-disc-detail-3`.

2. **`bag.capacity` is display-only and labelled as such on `/bag/manage` ("Display capacity"), yet
   `/bag` treats it as the interlock threshold.** A bag with `capacity` 10 blocks at 10 here and at 35
   in the editor. Which is authoritative?

3. **The zero-bag branch is unreachable through the UI.** `useOnboardingGate` sends a zero-bag user to
   `/onboarding`, `PutterStep`'s skip path always creates the Practice Stack bag, and both
   `delete_bag_with_replacement` and the `bags_protect_main_delete` trigger refuse to delete the last
   bag. `bag-empty` and `cta-firstbag` are defensive-only. Keep or delete?

4. **`col-compare` always produces an error state.** The link carries no `ids`, so `disc-compare`
   renders `Choose at least 2 discs to compare.` every time. Either the link is wrong or
   `disc-compare` should own a selection UI of its own.

5. **The Collection tab's four counts bypass the offline cache while the body beneath them uses it.**
   `fetchUserDiscs` (raw) and `useDiscList` (Dexie-backed) read the same rows through two different
   paths in one render tree. Should the page adopt `useDiscList` for its own counts?

## 13. Blueprint divergence

Blueprint Screen 5 is *Unified Bag Management & Disc Universe Hub*. This page is its principal carrier
and diverges in six recorded ways.

| Blueprint Screen 5 feature | Shipped on `/bag` |
|---|---|
| 3-way segmented header `[ MY BAGS ] [ 🎯 PUTTERS ] [ UNIVERSE ]` | **4-way**, with a new `Collection` tab first and as the default. `PRODUCT_ROADMAP.md` Phase C item 1 is the reason: "Collection-first DISCS hub" |
| 35-disc capacity interlock, blue → orange → rust, `[ + Add to Bag ]` disables at 35 | Bar and tiers ship as drawn (`capacityTier`). The disable is a hidden link, not a disabled button, and it is not enforced — § 12 item 1 |
| 3-tier vertical accordion Mold → Plastic → **Run**, with a weight-selection drawer | Two tiers ship: Manufacturer → Mold → plastic rows. No run tier, no weight drawer — the plastic row deep-links to `disc-new` with `?mold=&plastic=` and the weight is a field on that form (`DiscFormPage.jsx:41-53`) |
| Ghost Slot wishlist card with a `[ FIND ]` action bridging to Screen 17 | Card ships; **`[ FIND ]` is absent, not disabled.** `UniverseBrowser.jsx:38-47` renders a non-interactive `<div class="ghost-slot-card">` holding two `<span>`s. Screen 17 is parked, so this matches the intent of `SCREEN_SPECS.md:169-172` — but that entry says "hidden/disabled", and what shipped is "never rendered". Note the asymmetry: on `/bag/manage` the same CSS class *is* a button, whose action is `remove` |
| `[ 🔗 BEAM QR ]` P2P bag share | Absent, per standing divergence 8 |
| `[ + NEW BAG ]` in the header | Lives on `/bag/manage` instead |

Blueprint Screen 6 also lands here: the **role swimlanes and the 1–10 wear slider render on this
page**, in the Putters tab, via `PutterLineup` (`BagPage.jsx:132`). `SCREEN_SPECS.md` Screen 6
attributes them to `DiscDetailPage`. The full three-surface analysis is in
`screens/disc-detail.md` § 13 and is already logged as `_corrections/screen-specs-and-agents.md` C-3 —
referenced here, not repeated.

`SCREEN_SPECS.md:160` naming `FlightChart` as reused BagPage content, and `SCREEN_SPECS.md:163` naming
`discLocker.searchMolds`, are both already logged (`_corrections/component-library.md` item 1,
`_corrections/lib-api-index.md` item 1). Standing divergences #1 (React/Vite, not Expo), #3
(append-only schema), #5 (PLAY/DISCS/COURSES/ME), and #8 (QR Beam parked) apply; see
`SCREEN_SPECS.md`.
