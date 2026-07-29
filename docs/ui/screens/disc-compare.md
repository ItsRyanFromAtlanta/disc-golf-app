# Disc Compare

| Field | Value |
|---|---|
| Route id | `disc-compare` |
| URL pattern | `/bag/compare?ids=:discId,:discId[,…]` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Compare Discs` |
| Activity pill | shown |
| Scroll key | `discs-compare` |
| Preserves nested state | no |
| Page component | `src/pages/DiscComparePage.jsx` (321 lines) |
| Blueprint screen | none — post-blueprint |
| Verified against | `7351964` |

## 1. Purpose

Side-by-side analysis of two to four of the player's own discs: overlaid flight curves, a per-axis
table with low/high highlighting and explicit override marks, redundancy warnings for near-identical
pairs, and a coverage summary for a chosen bag. It answers "are these two discs actually different, and
does my bag need both."

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Compare (n)` in the locker's compare toolbar | `navigate('/bag/compare?ids=a,b,c')` from `BagLockerPage.jsx:110-114` | **The only entry that produces a valid comparison** |
| In | `Compare` link on `/bag`'s Collection tab | `Link` to `/bag/compare` | Carries **no** `ids`, so it always lands on the invalid state — `screens/discs-root.md` § 12 item 4 |
| In | Direct URL / bookmark / shared link | Route match | `ProtectedRoute`; `useOnboardingGate` may intercept first |
| Out | `Locker` link in the page header | `Link` to `/bag/locker` | Present in both the valid and invalid states |
| Out | `Choose discs` | `Link` to `/bag/locker` | Invalid state only; the recovery action |
| Out | `Open disc` in a per-disc meta card | `Link` to `/bag/discs/:discId` | One per compared disc |
| Out | Shell back control | `GlobalHeader` → `resolveSectionRoot('discs')` | Returns to `/bag`, not to the locker you came from |
| Out | Tab re-tap on DISCS | `TabBar` → `resolveSectionRoot('discs')` | Returns to `/bag` |

**Query parameter contract — `?ids=`.** Parsed at `DiscComparePage.jsx:70-78`. The parser is
deliberately permissive:

- `searchParams.getAll('ids')` accepts the parameter **repeated** (`?ids=a&ids=b`) as well as once.
- Each value is split on `,`, so `?ids=a,b,c` and `?ids=a&ids=b,c` are equivalent.
- Values are trimmed, empties dropped, and the result deduplicated through a `Set`.
- The deduplicated list is then sliced to `COMPARE_MAX` (4). Extras are not an error — they are
  reported as `Comparison is capped at 4 discs; n extra selection(s) were ignored.`
- Ids are matched with `String(disc.id) === id`, so the comparison is string-identity against the
  user's own locker. An id the user does not own simply does not match.

Three outcomes follow, in this order: fewer than `COMPARE_MIN` (2) ids in the URL →
`Choose at least 2 discs to compare.`; two or more ids but fewer than 2 resolving to owned discs →
`One or more selected discs could not be found in your locker.`; otherwise the comparison renders, and
any ids that failed to resolve are reported inline as `Skipped n disc(s) that are no longer in your
locker.`

`preserveNestedState` is `false`. The comparison itself is fully addressable — the URL is the state —
but the source toggle and the selected bag are component state and reset on every mount.

## 3. Layout

### 3a. Frame (illustrative)

Three discs selected.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Compare Discs                     [activity pill]| <- Shell header
+-------------------------------------------------------+
|  DISCS                                                | <- eyebrow
|  Compare discs                             [ Locker ] |
|  Effective flight numbers are shown below. Per-disc    |
|  overrides are marked explicitly.                     |
+-------------------------------------------------------+
|  COMPARISON SOURCE          Every result is attributed|
|  [Personal reality][Official catalog][Community ...]  | <- aria-pressed group
|  Personal reality: your selected physical discs and   |
|  their effective flight numbers.                      |
+-------------------------------------------------------+
|  ! No meaningful gaps                                 | <- only when a near-identical pair exists
|    Thunderbird and Firebird are within ±1 on every    |
|    effective flight axis.                             |
+-------------------------------------------------------+
|  FLIGHT OVERLAY                       Current reality |
|      \    |    /                                      | <- FlightCurveOverlay, one path per disc
|       \   |   /                                       |
|  ● Thunderbird  ● Buzzz  ● Firebird                   | <- legend; the SVG carries color only
+-------------------------------------------------------+
|  BAG CONTEXT           Transparent coverage summary   |
|  Bag [ Main Tourney Bag  v ]                          |
|  19/35 discs · putter, midrange, fairway, distance    |
|  11 occupied flight cells · 2 missing flight profiles |
|  1 near-duplicate pairs                               |
+-------------------------------------------------------+
|  EFFECTIVE FLIGHT NUMBERS   Low/high highlights per axis|
|  +-------+------------+-------+----------+            |
|  | Axis  | Thunderbird| Buzzz | Firebird |            |
|  |       | stable     | stable| overstab.|            | <- stability chip per column
|  | speed |     9      |   5   |    9     |            |
|  | glide |     5 high |   4   |    4 low |            |
|  | turn  |    -1 (ovr)|  -1   |    0 high|            | <- "override" mark when set
|  | fade  |     2      |   1 lo|    4 high|            |
|  | Wear  |     3      |   —   |    7     |            |
|  +-------+------------+-------+----------+            |
+-------------------------------------------------------+
|  ● Thunderbird     Innova · in_locker                 |
|    Overrides: turn                [ Open disc ]       |
|  ● Buzzz ...                                          |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Compare Discs", activity pill
Invalid state (replaces everything below)
  inv-title ............ h1 "Compare discs"
  inv-locker ........... link to /bag/locker
  inv-message .......... form-error: too few ids, or too few resolvable discs
  inv-cta .............. "Choose discs" → /bag/locker
Page header
  hdr-eyebrow .......... "DISCS"
  hdr-title ............ h1 "Compare discs"
  hdr-locker ........... link to /bag/locker
  hdr-intro ............ "Effective flight numbers are shown below. Per-disc overrides are marked
                          explicitly."
Comparison source panel
  src-heading .......... h2 "Comparison source" + "Every result is attributed"
  src-button ........... one per COMPARISON_SOURCES entry: personal | official | community
  src-notice ........... role=status, when community is selected but unavailable
  src-explain .......... log-time description of the ACTIVE source
Notices
  note-truncated ....... "Comparison is capped at 4 discs; n extra selection(s) were ignored."
  note-missing ......... "Skipped n disc(s) that are no longer in your locker."
Redundancy alert (aria-live=polite)
  alert-heading ........ h2 "No meaningful gaps"
  alert-pair ........... one line per near-identical pair
Flight overlay panel
  ovl-heading .......... h2 "Flight overlay" + "Current reality"
  ovl-curve ............ <FlightCurveOverlay entries />
  ovl-legend ........... one swatch + name per disc
Bag context panel
  bag-heading .......... h2 "Bag context" + "Transparent coverage summary"
  bag-select ........... <select> over the user's bags
  bag-summary .......... discCount/capacity, speed classes, occupied cells, missing profiles,
                         near-duplicate pairs
  bag-loading .......... "Loading bag context..."
  bag-unavailable ...... "Bag context is unavailable; the disc comparison above remains usable."
Flight numbers table
  tbl-heading .......... h2 "Effective flight numbers" + "Low/high highlights are per axis"
  tbl-scroll ........... .disc-compare-table-scroll — horizontal scroll container
  tbl-colhead .......... one th[scope=col] per disc: name + stability chip
  tbl-axisrow .......... one tr per FLIGHT_AXES entry, th[scope=row] = axis name
  tbl-cell ............. value or "—", low/high/range-match class + label, override mark
  tbl-wearrow .......... th[scope=row] "Wear score", one cell per disc
Meta cards
  meta-card ............ one per disc: swatch, h2 name, manufacturer · status, overrides list
  meta-open ............ "Open disc" → /bag/discs/:discId
Page-level states
  page-error ........... form-error as the entire page, when the query errored with no cache
  page-loading ......... "Loading..." until the disc query first resolves
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `inv-message` | banner | `Choose at least 2 discs to compare.` or `One or more selected discs could not be found in your locker.` | — | — | — | first when `queryIds.length < 2`, second when `selected.length < 2` |
| `inv-cta` | link | `Choose discs` | default / pressed | navigate | `/bag/locker` | invalid state only |
| `hdr-locker` | link | `Locker` | default / pressed | navigate | `/bag/locker` | always |
| `src-button` | button ×3 | `Personal reality`, `Official catalog`, `Community benchmark` | `aria-pressed` true/false | `setSource(id)` | local state | always enabled — **including Community, which never becomes the active source**, § 12 |
| `src-notice` | status | `Community benchmark unavailable: Needs at least 10 attributed rounds or throws; no eligible cohort is available. Showing official catalog numbers instead.` | present / absent | — | — | `source === 'community' && community.status !== 'ready'` |
| `src-explain` | text | personal: `your selected physical discs and their effective flight numbers.` · official/community: `manufacturer catalog flight numbers; personal overrides are intentionally excluded.` | — | — | — | describes `activeSource`, which may differ from the pressed button |
| `note-truncated` | notice | `Comparison is capped at 4 discs; n extra selection(s) were ignored.` | present / absent | — | — | `queryIds.length > COMPARE_MAX` |
| `note-missing` | notice | `Skipped n disc(s) that are no longer in your locker.` | present / absent | — | — | requested ids that did not resolve, while ≥2 did |
| `alert-pair` | list item | `{a} and {b} are within ±1 on every effective flight axis.` | present / absent | — | — | one per `nearIdenticalPairs`; container is `aria-live="polite"`. Threshold is `NEAR_IDENTICAL_AXIS_DELTA` = 1; any missing axis disqualifies a pair |
| `ovl-curve` | chart | — | one path per disc, omitted when unplottable | — | — | `FlightCurveOverlay`; identity is stroke color plus `data-disc-id` only |
| `ovl-legend` | list | swatch + disc name | — | — | — | the required text equivalent for the SVG; colors cycle through four CSS vars |
| `bag-select` | select | one option per bag | — | `setSelectedBagId` | local state | defaults to the first bag returned by `fetchBags` (creation order), **not** the default bag — § 12 |
| `bag-summary` | figures | `{n}/{capacity ?? —} discs`, speed classes or `No speed classes yet`, `{n} occupied flight cells`, `{n} missing flight profiles`, `{n} near-duplicate pairs` | — | — | — | `discCount` counts **every** member of the bag, any status |
| `bag-loading` | text | `Loading bag context...` | — | — | — | `bagContexts === null` |
| `bag-unavailable` | text | `Bag context is unavailable; the disc comparison above remains usable.` | — | — | — | the bag fetch rejected, or the user has no bags |
| `tbl-colhead` | th | disc name + stability chip (`understable` / `stable` / `overstable` / `unknown`) | — | — | — | chip border color from `stabilityColor`; text always present |
| `tbl-cell` | td | value or `—`, plus `low` / `high` / `range match` and an `override` mark | `disc-compare-cell-low` / `-high` / `-match` / none | — | — | `aria-label` restates disc, axis, value, and status; extremes come from `buildDiscComparison` |
| `tbl-wearrow` | row | `Wear score`, `disc.wear_score ?? '—'` | — | — | — | raw column value; not part of `FLIGHT_AXES` and not source-dependent |
| `meta-card` | article | swatch, name, `{manufacturer} · {status}`, `Overrides: turn, fade` or `none` | — | — | — | one per compared disc; `status ?? 'status unknown'` |
| `meta-open` | link | `Open disc` | default / pressed | navigate | `/bag/discs/:discId` | always |
| `page-error` | page | error text | — | — | — | `discsQuery.error && !discsQuery.data`; **no retry control** |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Owned discs (with `moldInfo`) | `useDiscList(user.id)` | `lib/repository/discRepository` | **Supabase + Dexie** | React hook |
| User's bags | `fetchBags` | `lib/discLocker` | Supabase | async |
| Each bag's members | `fetchBagDiscs` ×N | `lib/discLocker` | Supabase | async |
| Per-disc rows, extremes, redundancy | `buildDiscComparison` | `lib/discCompare` | — | **pure** |
| Bag coverage rollup | `buildBagComparison` | `lib/discCompare` | — | **pure** |
| Community cohort resolution | `resolveCommunityCohort` | `lib/discCompare` | — | **pure** |
| Stability banding for column chips | `stabilityClass`, `stabilityColor` | `lib/discFilters` | — | **pure** |
| Curve geometry | `flightPath`, `wearAdjustedFlightNumbers`, `effectiveFlightNumbers` | `lib/flightCurve`, `lib/discs` | — | **pure**, inside `FlightCurveOverlay` |

Signatures in `LIB_API_INDEX.md`. Every derivation on this page is a pure function over data already
fetched; the page itself issues exactly two network reads (the disc list and the bag contexts), and
recomputes the entire comparison on each render without memoization — `buildDiscComparison` runs in the
render body at `DiscComparePage.jsx:116`, not inside a `useMemo`. Only `queryIds`, `requestedIds`,
`discs`, and `selected` are memoized.

`resolveCommunityCohort([])` is called with a **literal empty array** (`DiscComparePage.jsx:114`). No
cohort data source is wired to this page, so `community.status` is permanently `'unavailable'` and
`activeSource` silently falls back to `'official'` whenever `Community benchmark` is pressed.

### Writes

**N/A** — this screen is read-only. It performs no mutation, queues nothing, and holds no draft. The
only state it changes is local (`source`, `selectedBagId`) and the URL it navigates to on `Open disc`.

### Offline

Partly capable, and the degradation is the best-shaped in the section.

- The disc list reads through `readThroughCache`, so with a populated Dexie cache the **entire
  comparison renders offline**: curves, table, redundancy alerts, and meta cards are all pure functions
  over cached rows.
- The bag context fetch is a raw Supabase call, and its rejection is caught explicitly
  (`DiscComparePage.jsx:99-102`) into `setBagContexts([])`, which renders
  `Bag context is unavailable; the disc comparison above remains usable.` — an honest partial-failure
  message rather than a page-level error. **This is the pattern the rest of the DISCS section should
  copy.**
- With no cache at all, `page-error` replaces the page with no retry control.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 is rendered; a cache-served comparison is visually
identical to a live one.

## 6. Flow paths

**Happy path.** From the locker: `Compare` → select 2–4 discs → `Compare (n)` → this page resolves the
ids, renders the source panel, overlay, bag context, table, and meta cards → tap `Open disc` to drill
into one.

**First run / empty.** A user with fewer than two discs can never reach a valid comparison: the
locker's `cmp-submit` stays disabled below `COMPARE_MIN`, and arriving directly renders
`inv-message` + `Choose discs`. The invalid state is a complete, navigable screen with a header, a
message, and a recovery action — the best-behaved failure state in the section.

**Error.** Three distinct shapes, correctly separated: a disc-query failure with no cache is a
page-level error; unresolvable ids are an inline `note-missing` above a comparison that still works
with whatever resolved; a bag-context failure is a scoped `bag-unavailable` message inside its own
panel.

**Offline.** As § 5. Comparison works from cache; bag context degrades in place.

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced unconditionally in
`useDiscList(user.id)` and the bag-context effect.

**Interlock.** `COMPARE_MAX` = 4 is enforced twice, and enforced by *truncation* rather than by
refusal: the locker's chip is `disabled` at 4 (`BagLockerPage.jsx:264`), and this page slices
`requestedIds` to 4 (`:78`) and tells the user what it dropped. `COMPARE_MIN` = 2 is the gate into the
valid state. Both bounds live in `lib/discCompare` and are shared by both screens — the
single-definition pattern the 35-disc cap does not follow (see `screens/discs-root.md` § 12 item 1).

**Destructive.** **N/A** — this screen performs no destructive action, calls no `window.confirm`, and
writes nothing. It is not among the three pages named in `COMPONENT_LIBRARY.md` § Gaps item 8.

## 7. Dependencies

### Schema

`discs` (`override_speed|glide|turn|fade`, `wear_score`, `status`, `manufacturer`, `mold`, `nickname`)
joined to `disc_molds` via `discs.mold_id` — never drop this FK
(`docs/development/CURRENT_WORK.md` § Standing decisions); `bags` (`name`, `capacity`) and `bag_discs`
for the bag context panel. No table is written. The Dexie mirror is the `discs` table in `db/dexieDb`.

No column on this page is new: the comparison is a pure read of columns Phase B already shipped.

### Library

`lib/discCompare`, `lib/repository/discRepository`, `lib/discLocker`, `lib/discFilters`,
`lib/bagResonance` (transitively, through `buildBagComparison`'s `resonanceComponents`),
`lib/flightCurve` and `lib/discs` (transitively, through `FlightCurveOverlay`). Signatures in
`LIB_API_INDEX.md`.

### Components

`FlightCurveOverlay` — the **named** export of `src/components/putterLineup/FlightCurve.jsx`, of which
this page is the only consumer. The default `FlightCurve` export goes to `PutterLineup` instead.
Details in `COMPONENT_LIBRARY.md`. This page shares no component with `disc-collection` — notably it
does not use `DiscCard` for its meta cards.

### Screens

Requires `disc-collection`, which is the only surface that produces a valid `?ids=` URL. Links out to
`disc-detail` (one link per compared disc) and back to `disc-collection`. `discs-root`'s `Compare` link
targets this route without parameters and is a defect on that side.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 12 (chart text alternatives in particular). `PRODUCT_ROADMAP.md` Phase C
item 5 — "Disc/bag comparisons using personal, official, and eligibility-gated community cohorts with
graceful fallback and explicit attribution" — is the shipped-work record, and it also names this as
jump-ahead J2, built out of phase order by owner decision on 2026-07-14. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline, this is **the strongest screen in the DISCS section** and the reference for
the rest:

- The source toggle is a `role="group"` with `aria-label="Comparison source"` whose buttons carry real
  `aria-pressed` — not a `ChipGroup`, precisely because `ChipGroup` emits no selection semantics
  (`COMPONENT_LIBRARY.md` § Gaps item 10).
- The table is properly structured: `th[scope="col"]` per disc, `th[scope="row"]` per axis, and every
  data cell carries an `aria-label` restating disc, axis, value, and low/high status —
  `Thunderbird glide: 5, high`. The low/high highlight is never color-alone: each cell also renders the
  status word in a `<small>`.
- The redundancy alert is `aria-live="polite"`, so a near-identical pair is announced rather than only
  drawn.
- Each panel is associated with its heading through `aria-labelledby` (`comparison-source-title`,
  `bag-summary-title`).
- The wide table is wrapped in `.disc-compare-table-scroll`, so the horizontal overflow is scoped to
  the table rather than the page — the § 12 320px-width rule handled correctly.
- Missing values render `—` per the `COPY_AND_TERMINOLOGY.md` § 6 convention, and a disc with no
  computable stability renders the word `unknown` rather than an empty chip.

Two gaps remain:

- **Gap:** `FlightCurveOverlay` distinguishes its paths by stroke color and a `data-disc-id` attribute
  only. `ovl-legend` supplies the names, but the legend is a sibling list, not a programmatic
  association — a screen-reader user gets "Flight overlay" and then three names with no way to tell
  which curve is which. Unlike `FlightSpectrum`, the overlay has no per-point text equivalent.
- **Gap:** `bag-select` is wrapped in a `<label>` whose text is the single word `Bag`, and the summary
  figures beneath it are bare `<span>`s with no label/value association.

## 9. Events and telemetry

**N/A** — no metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted, no notification is
produced or consumed, no activity-lifecycle event is written, and no append-only row is appended. This
screen is read-only end to end.

The `Every result is attributed` line and `src-explain` implement the § 4 provenance intent in copy
rather than in telemetry: the user is told which numbers they are looking at and, when the community
source falls back, why.

## 10. Tests

### Existing coverage

`src/lib/discCompare.test.js` (`buildDiscComparison`, `buildBagComparison`,
`findNearIdenticalDiscPairs`, the bounds constants), `src/lib/discCompareCohorts.test.js`
(`resolveCommunityCohort`), `src/lib/flightCurve.test.js` (`flightPath`,
`wearAdjustedFlightNumbers`), `src/lib/discFilters.test.js` (stability banding). Matches the
`disc-compare` row in `TEST_MAP.md`; that row also lists `flightSpectrum`, which this page does not
use — `flightSpectrum` belongs to `discs-root`.

Coverage is entirely at the library layer, and it is genuinely good: the comparison math, the
redundancy detection, and the cohort gate all have tests. **There is no component or page test for
`DiscComparePage.jsx`**, so the `?ids=` parser — the most intricate piece of URL handling in the app —
is untested. Nothing asserts that repeated parameters, comma lists, duplicates, whitespace, foreign
ids, or a fifth id behave as documented in § 2.

### Acceptance criteria

1. `?ids=a,b` and `?ids=a&ids=b` render the same two-disc comparison.
2. `?ids=a,a,b` renders two discs, not three.
3. `?ids=a,b,c,d,e` renders four discs and `Comparison is capped at 4 discs; 1 extra selection(s) were
   ignored.`
4. `?ids=a,unknown` where only `a` is owned renders `One or more selected discs could not be found in
   your locker.`, because fewer than two resolved.
5. `?ids=a,b,unknown` renders the two-disc comparison plus `Skipped 1 disc(s) that are no longer in
   your locker.`
6. `/bag/compare` with no parameter renders `Choose at least 2 discs to compare.` and a `Choose discs`
   link.
7. Pressing `Official catalog` recomputes the table from mold numbers and drops every `override` mark.
8. Pressing `Community benchmark` shows the unavailability notice and renders official numbers —
   current behavior, asserted because no cohort source exists (§ 12 item 1).
9. A disc with an override on one axis shows the `override` mark in `Personal reality` and not in
   `Official catalog`.
10. Two discs within ±1 on every axis produce a `No meaningful gaps` entry; a pair with any missing
    axis does not.
11. With the network unavailable and a populated Dexie cache, the comparison renders and only the bag
    context degrades.

### E2E critical paths

Locker → select three → compare → open one disc → back. Bookmark a comparison URL, reload, and confirm
it still resolves. Compare a disc that is subsequently retired, then reload the same URL — it should
skip, not crash. Offline reload of a bookmarked comparison. No automated browser E2E suite exists
(`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing coverage.

## 11. Tasks

#### T-disc-compare-1 — Test the `?ids=` parser

- **Capability:** `pure-logic`
- **Touches:** `src/lib/discCompare.js`, `src/pages/DiscComparePage.jsx`
- **Done when:** The parse-and-resolve logic is extracted into a tested pure function
  (`parseCompareIds(searchParams)` or equivalent) covering repetition, comma lists, duplicates,
  whitespace, truncation, and unresolvable ids; the page consumes it.
- **Verify:** `npm test` with the six § 10 parser cases.
- **Commit:** `refactor: extract and test the comparison id parser`

#### T-disc-compare-2 — Give the flight overlay a text equivalent

- **Capability:** `ui-routine`
- **Touches:** `src/components/putterLineup/FlightCurve.jsx`, `src/pages/DiscComparePage.jsx`
- **Done when:** Each overlaid curve is programmatically identifiable — a per-path `<title>` naming the
  disc, or a legend associated by id — so the SVG is non-essential the way `FlightSpectrum`'s is.
- **Verify:** `npm run lint` and a manual VoiceOver pass on a three-disc comparison.
- **Commit:** `fix: make overlaid flight curves identifiable to assistive tech`

#### T-disc-compare-3 — Either wire or hide the community source

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscComparePage.jsx`
- **Done when:** `Community benchmark` either receives real cohort candidates or is not offered as a
  pressable option that always falls back; the decision is recorded in this document.
- **Verify:** `npm test` (existing `discCompareCohorts` cases still pass) plus manual check.
- **Commit:** `fix: stop offering an unreachable comparison source`
- **Blocked by:** § 12 open question 1.

#### T-disc-compare-4 — Default the bag context to the main bag

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscComparePage.jsx`
- **Done when:** `bag-select` initializes to the bag with `is_default`, falling back to the first, so
  the panel opens on the bag the player actually carries.
- **Verify:** `npm test` once a page test exists; manual check with three bags meanwhile.
- **Commit:** `fix: open bag context on the main bag`

#### T-disc-compare-5 — Memoize the comparison derivation

- **Capability:** `pure-logic`
- **Touches:** `src/pages/DiscComparePage.jsx`
- **Done when:** `buildDiscComparison` and `buildBagComparison` run inside `useMemo` keyed on their
  inputs, so pressing a source button does not recompute the bag rollup and vice versa.
- **Verify:** `npm run lint`; behavior is unchanged, so no new test is required.
- **Commit:** `perf: memoize the comparison derivations`

## 12. Open questions

1. **The `Community benchmark` source can never become active.** `resolveCommunityCohort([])` is called
   with a hard-coded empty array (`DiscComparePage.jsx:114`), so the button is always pressable, always
   shows the unavailability notice, and always renders official numbers. `PRODUCT_ROADMAP.md` Phase C
   item 5 describes this as "eligibility-gated community cohorts with graceful fallback" and the
   fallback is exactly as designed — but no cohort source was ever wired, and community data is opt-in
   per the roadmap's cross-cutting rules, so there may be nothing to wire yet. Offer it, or hide it
   until there is? Blocks `T-disc-compare-3`.
2. **`bag-summary`'s disc count includes non-`in_locker` members.** `buildBagComparison(activeBag.discs,
   …)` receives the raw `fetchBagDiscs` result with no `bagViewDiscs` filter, so `19/35 discs` here can
   disagree with `/bag`'s reading of the same bag. This is the third distinct definition of "how full is
   this bag" in the section — see `screens/discs-root.md` § 12 item 1.
3. **`bag-select` defaults to creation order, not to the main bag.** `fetchBags` orders by `created_at`
   and the effect takes `contexts[0]`, ignoring `is_default`.
4. **The wear score row is source-independent.** Switching to `Official catalog` correctly drops
   overrides from the flight axes, but `tbl-wearrow` continues to show the personal `wear_score`, which
   is by definition not a catalog value. Is wear part of the comparison source or outside it?
5. **`ovl-curve` always renders "Current reality"** regardless of the selected source: the overlay
   passes `selected` straight to `FlightCurveOverlay`, which computes wear-adjusted effective numbers
   internally. Pressing `Official catalog` changes the table and not the curves, and the panel's own
   subtitle says `Current reality` — honest, but the two panels now describe different numbers under
   one page-level source selector.

Entries in `_corrections/` touching this screen: `discs-screens.md` D-1 (the bag-capacity claim, which
this screen's `bag-summary` inherits through its third distinct disc count) and `discs-screens.md` D-4
(`flightSpectrum` is listed under this screen's row in `TEST_MAP.md` and belongs to `discs-root`).

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 draws no comparison
screen among its 21; the closest drawn artifact is Screen 6's single-disc Bézier canvas
(factory-vs-current for one disc), which shipped as `FlightCurve`'s default export on `/bag`'s Putters
tab. This page reuses that file's *other* export to do something the blueprint never specified.

Its origin is `PRODUCT_ROADMAP.md` Phase C item 5, built ahead of sequence as jump-ahead J2 by owner
decision on 2026-07-14 and shipped 2026-07-15. The blueprint-side idea it most resembles is Screen 17's
"Stability Gap Matchmaker" (`MASTER_PROJECT_BLUEPRINT.md:972`), which bridges gap detection to retail —
but Screen 17 is parked and this page has no retail dependency at all, comparing only discs the player
already owns.

Standing divergences #1 (React/Vite, not Expo) and #3 (append-only schema) apply; see
`SCREEN_SPECS.md`. No `SCREEN_SPECS.md` entry describes this screen, which is expected for a
post-blueprint surface and is not a contradiction to log.
