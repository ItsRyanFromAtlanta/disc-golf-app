# Corrections — DISCS screen batch

Contradictions between existing documents and the code, found while writing the six DISCS screen
documents (`discs-root`, `disc-collection`, `bag-manage`, `disc-compare`, `lost-found`, `disc-new`).
**Logged, not fixed in place** (`docs/ui/README.md` § Working rules 5).

Verified against `7351964` on branch `claude/ui-documents-status-3fphcw`, 2026-07-29.

Already-logged items that touch these screens are **not** repeated here. See:

- `_corrections/component-library.md` item 1 — `SCREEN_SPECS.md:160` names `FlightChart` as reused
  `BagPage` content; `BagPage` renders `FlightSpectrum` and `FlightChart` has zero importers.
- `_corrections/lib-api-index.md` item 1 — `SCREEN_SPECS.md:120,163` cite `discLocker.searchMolds`,
  removed in `6c88410`; mold search is `catalogRepository.filterCatalogMolds` + `useCatalog()`.
- `_corrections/screen-specs-and-agents.md` C-3 — `SCREEN_SPECS.md` Screen 6 describes a page that
  shipped split across three surfaces. Full analysis in `screens/disc-detail.md` § 13.

---

## D-1 — `SCREEN_SPECS.md` claims a 35-disc DB `CHECK` constraint that does not exist

**Where:** `SCREEN_SPECS.md:73-74` (standing divergence 6) and `SCREEN_SPECS.md:174` (Screen 5
dependency).

**Claims:**

> 6. **Interlocks:** both hard, as specified — 100-putt routine ceiling and 35-disc bag capacity, each
>    with app-side disabling AND a DB `CHECK` constraint.

> - **Dependency:** 35-disc interlock needs the Layer 1 `bags.capacity` default/CHECK migration.

**Reality:** there is **no `CHECK` constraint on bag capacity anywhere in the schema**, and no
constraint of any kind limiting `bag_discs` cardinality.

- `bags.capacity` is declared `capacity integer` with no `CHECK` and no default
  (`bags_schema.sql:22`). No later migration adds one — `grep -rn "capacity" supabase/` returns only
  `bag_versions`, the `grouped_save_bag` RPC, and column reads.
- `bag_discs` has a primary key, two FKs, and `unique (bag_id, disc_id)`
  (`bags_schema.sql:37-43`). Nothing counts rows per bag.
- The only `CHECK` naming 35 constrains the stored capacity *number* on a different table:
  `capacity integer check (capacity is null or capacity between 0 and 35)` on `bag_versions`
  (`20260715183500_phase_b_disc_timelines_bag_versions.sql:46`).
- The only server-side membership limit is procedural, not declarative, and fires on one path only:
  `if cardinality(normalized_ids) > 35 then raise exception 'A bag cannot contain more than 35 discs'`
  inside `grouped_save_bag` (`20260716193000_phase_c_grouped_bag_save.sql:92`). `restore_bag_version`
  has no equivalent guard (`:192-199`).

App-side enforcement is also not "hard", and is inconsistent across the four surfaces that can change
membership:

| Surface | Count used | Cap used | Effect |
|---|---|---|---|
| `/bag` (`BagPage.jsx:160-213`) | `in_locker` members only (`bagViewDiscs`) | `bag.capacity ?? 35` | Replaces the `Add from locker` link with a non-focusable `<span aria-disabled>`. Advisory only |
| `/bag/manage` (`BagManagePage.jsx:227,234`) | all draft members, any status | hard-coded `35` | Disables unchecked checkboxes. The only app-side block that works |
| `/bag/locker?addToBag=` (`BagLockerPage.jsx:74-89`) | — | — | No check at all |
| `/bag/discs/:id` bag chips (`screens/disc-detail.md` § 6) | — | — | No check at all |

**Consequence:** a bag can exceed 35 members today through either unchecked path, and the next grouped
save of that bag then fails with a raw Postgres exception string the user cannot act on. The same bag
also reports three different fullness figures across `/bag`, `/bag/manage`, and `/bag/compare`'s bag
context panel (which passes unfiltered membership to `buildBagComparison`,
`DiscComparePage.jsx:118`).

**Severity:** high. This is the standing divergence an agent is told never to re-litigate, so it will
be trusted without verification, and `screens/disc-detail.md` § 12 item 1 already deferred a task on
the belief that the constraint might exist.

**Suggested resolution (not applied):** one decision, then one edit. Either (a) the cap is a
data-integrity rule — add the missing constraint or trigger, add the `bags.capacity` default, and make
every add path handle the rejection; or (b) it is a UI guideline — say so in divergence 6, drop the
`grouped_save_bag` exception or downgrade it to a warning, and unify the count definition. Until then,
divergence 6 and line 174 should be rewritten to describe what ships. Full analysis and the blocked
tasks are in `screens/discs-root.md` § 12 item 1, `screens/bag-manage.md` § 6, and
`screens/disc-collection.md` § 6.

---

## D-2 — `COPY_AND_TERMINOLOGY.md` attributes an empty-state string to the wrong screen

**Where:** `COPY_AND_TERMINOLOGY.md:51-52` (terminology conflict T-2), repeated in the decision table
at `COPY_AND_TERMINOLOGY.md:191`.

**Claim:**

> `/bag/locker` has route title `Collection`, is served by `BagLockerPage.jsx`, and its empty state
> reads `No discs in your collection yet.`

**Reality:** `BagLockerPage.jsx` never renders that string. `grep -rn "No discs in your collection yet"
src/` matches exactly one file:

- `src/pages/BagManagePage.jsx:228` — `{discs.length === 0 ? <p className="loading">No discs in your
  collection yet.</p> : (…)}`, inside the **bag editor's membership checklist**, not a locker empty
  state. It is also styled `className="loading"`, a loading idiom used for an empty state.
- `/bag/locker`'s only empty state is `No discs match.` (`src/pages/BagLockerPage.jsx:249`), which is a
  *filter-result* message shown for both a filtered-to-nothing result and an entirely empty collection.

**Severity:** low for the T-2 argument itself — "Collection" and "Locker" really do both appear, and
the route title/`h1` mismatch T-2 identifies is real (`routeMetadata.js:227` `Collection` versus
`BagLockerPage.jsx:134` `Locker`). Medium for anyone acting on it: an agent asked to fix the locker's
empty state would edit the wrong file, and the genuinely missing locker empty state
(`screens/disc-collection.md` § 12, task `T-disc-collection-1`) would stay missing.

**Suggested resolution (not applied):** in T-2, cite `BagManagePage.jsx:228` for
`No discs in your collection yet.` and add `BagLockerPage.jsx:249`'s `No discs match.` as a separate
observation — a locker with zero discs currently reports a filter miss.

---

## D-3 — `docs/ui/README.md` and `TEMPLATE.md` reference a `STATE_MATRIX.md` that does not exist

**Where:** `docs/ui/README.md:29` and `docs/ui/TEMPLATE.md:130`.

**Claims:**

> - [STATE_MATRIX.md](STATE_MATRIX.md) — cross-cutting states, current behavior against contract.

> Reference `STATE_MATRIX.md` rows by id instead of re-describing shared state behavior.

**Reality:** no such file exists. `ls docs/ui/` returns `COMPONENT_LIBRARY.md`,
`COPY_AND_TERMINOLOGY.md`, `LIB_API_INDEX.md`, `NAVIGATION_MAP.md`, `README.md`,
`SCREEN_INVENTORY.md`, `TASK_FORMAT.md`, `TEMPLATE.md`, `TEST_MAP.md`, `_corrections/`, and
`screens/`. A repo-wide `find . -name "STATE_MATRIX*"` outside `node_modules` returns nothing. The
README's link is dead, and `TEMPLATE.md` § 7 instructs every screen author to cite row ids from a file
with no rows.

`screens/disc-detail.md`, the worked reference example, silently declines to cite it — which is the
correct behavior and is why the gap has gone unnoticed.

**Severity:** medium. `TEMPLATE.md` is the authoring contract; an instruction in it that cannot be
followed either produces invented row ids or produces the duplicated shared-state prose the rule exists
to prevent. The six documents in this batch describe their own states inline for that reason.

**Suggested resolution (not applied):** either write `STATE_MATRIX.md` (loading, empty, error, offline,
guard, and interlock states with stable ids, which the six documents in this batch now have enough
material to populate) or remove both references. Do not leave the instruction pointing at nothing.

---

## D-4 — `TEST_MAP.md` attributes `flightSpectrum` to the wrong screen

**Where:** `docs/ui/TEST_MAP.md:52`.

**Claim:**

> | `disc-compare` | `discCompare`, `discCompareCohorts`, `flightSpectrum`, `flightCurve` | |

**Reality:** `DiscComparePage.jsx` imports nothing from `src/lib/flightSpectrum.js`. Its chart is
`FlightCurveOverlay` (`DiscComparePage.jsx:17,197`), covered by `flightCurve.test.js`.
`src/lib/flightSpectrum.js` is consumed by `src/components/FlightSpectrum.jsx:3`, which is rendered by
`src/pages/BagPage.jsx:6,216` — the `discs-root` screen. `TEST_MAP.md:49`'s `discs-root` row lists
`bags`, `bagHistory`, `bagResonance`, `wishlist`, and `flightCurve`, and omits `flightSpectrum`.

`src/lib/flightSpectrum.test.js` exists and passes; only its attribution is wrong.

**Severity:** low. `TEST_MAP.md` states plainly that its mapping is inferred from imports and module
names and asks each screen document to confirm its row — this is that confirmation. But the table is
what an agent reads to answer "what might I break," and a change to `flightSpectrum` would currently
point at the wrong screen.

**Suggested resolution (not applied):** move `flightSpectrum` from the `disc-compare` row to the
`discs-root` row.

---

## D-5 — `SCREEN_SPECS.md:16` cites "Expansion Screens 22–25", which are defined nowhere in the repo

**Where:** `SCREEN_SPECS.md:16-18`.

**Claim:**

> Expansion Screens 22–25 are adapted into DISCS Collection/Rich Profile/Lost & Found and the shared
> notification sheet rather than creating a parallel application tree.

**Reality:** `MASTER_PROJECT_BLUEPRINT.md` is titled and structured as a **21**-screen architecture
(`MASTER_PROJECT_BLUEPRINT.md:113`, "THE COMPLETE 21-SCREEN MASTER ARCHITECTURE"), and its § 3 defines
Screens 1–21 and no more. `grep -rn "Screen 2[2-5]" *.md` across the repository root matches this one
line and nothing else. There is no wireframe, no feature list, and no source document for Screens
22–25 anywhere in the repository.

**Severity:** medium, and rising. `lost-found` and the `disc-collection`/`disc-detail` split are
shipped screens whose stated design provenance cannot be read. A screen document is required by
`TEMPLATE.md` § 14 to record divergence from drawn intent; for these screens there is no drawn intent
to diverge from, and `screens/lost-found.md` § 13 has to say so rather than compare anything.

**Suggested resolution (not applied):** either import the Screens 22–25 material into the repository
(or into `MASTER_PROJECT_BLUEPRINT.md` as an appendix), or rewrite line 16 to attribute those screens
to `PRODUCT_ROADMAP.md` Phase B item 4 and Phase C item 1, which *are* in the repository and do
describe them.

---

## Checked and found accurate (no correction needed)

Recorded so a later reader does not re-verify these:

- `SCREEN_SPECS.md:170-173` — Screen 5's ghost-slot `[ FIND ]` divergence ("This cycle, `[ FIND ]` is
  hidden/disabled; the wishlist card still renders"). Confirmed: `UniverseBrowser.jsx:38-47` renders a
  non-interactive `<div className="ghost-slot-card">` containing two `<span>`s and no action control,
  and the card content is pure gap detection over owned discs (`wishlist.js:35`) with no retail
  dependency. The wording is loose — what ships is "never rendered" rather than "hidden/disabled", and
  the same CSS class *is* a button on `/bag/manage` whose action is `remove` — but the substance is
  right and Screen 17 is genuinely parked (`SCREEN_SPECS.md:45`). Noted in
  `screens/discs-root.md` § 13 rather than logged.
- `SCREEN_SPECS.md:168` — Screen 5's capacity bar colors, "blue→orange→rust bar". Confirmed:
  `capacityTier` (`src/lib/bags.js:74-79`) returns `ok`/`warn`/`full` with `warn` covering the last
  five slots, and `BagPage.jsx:195` maps them to `capacity-bar-fill-{tier}`. Only the *enforcement*
  half of that bullet is wrong — see D-1.
- `PRODUCT_ROADMAP.md:26` — "DISCS owns Collection, Bags, Universe, and Lost & Found." Confirmed
  against the four `TABS` entries at `BagPage.jsx:14-19` plus the `/bag/lost-found` route
  (`routeMetadata.js:193`). Note the tab is labelled `Bags`, not `MY BAGS` as the blueprint draws.
- `NAVIGATION_MAP.md:171-173` — "One query-parameter contract exists in the shipped app:
  `/bag/lost-found?disc=:discId`." **Three** exist in the DISCS section: that one
  (`LostFoundPage.jsx:54`), `/bag/locker?addToBag=:bagId` (`BagLockerPage.jsx:19`),
  `/bag/compare?ids=…` (`DiscComparePage.jsx:70-78`), and `/bag/discs/new?mold=&plastic=`
  (`DiscFormPage.jsx:44,51`) — four, in fact. **Not logged as a correction:** read in context, that
  paragraph is introducing the deep-link rule and the `?disc=` example, and the following sentence
  ("A screen that accepts query parameters must document them in its Entry and exit table") is the
  actual instruction, which all four screens now follow. The sentence would nonetheless read better as
  "one example" than "one contract"; noted here rather than filed.
- `docs/ui/COMPONENT_LIBRARY.md` § Gaps item 8 — three pages call `window.confirm`, and
  `PutterLineup`'s Retire has none. Confirmed for this batch: `BagManagePage.jsx:103` is the only
  `window.confirm` among the six screens, and `PutterLineup.jsx:133` (rendered by `BagPage`) retires
  with no confirmation at all. Recorded in `screens/bag-manage.md` § 6 and
  `screens/discs-root.md` § 6 as instructed.
