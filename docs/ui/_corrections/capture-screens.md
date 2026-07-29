# Corrections — capture screens

Found while authoring `screens/regimen-active.md` and `screens/freeform-active.md`. **Not applied.**

---

## C-6 — The active shell's non-scrolling rule has an unacknowledged exception

**Where:** `PHASE_A_ARCHITECTURE.md:186-187` against `src/pages/FreeformLogPage.jsx:480-660`

**Claims:** "`ActiveActivityShell` is non-scrolling for primary field controls. Putter, weather,
fatigue, notes, filters, finalization, and other secondary tasks open in bottom sheets."

**Reality:** `FreeformLogPage` renders `shell: ACTIVE` but composes a page header (`Freeform Log` plus a
`Practice menu` link) above the canvas and an unbounded `Today's session` log list below it, in the same
view as the capture surface. With enough distances logged, the capture zone can be pushed off-screen —
exactly what the rule exists to prevent. `RegimenRunPage` has no equivalent tail.

**Proposed resolution:** this is a design ruling, not a doc edit. Either § 12 gains an explicit
exception, or `FreeformLogPage` moves its log list into a toolbar sheet. Recorded as open question 1 in
`screens/freeform-active.md` with task `T-freeform-active-2` staged behind it.

---

## C-7 — `SCREEN_SPECS.md` has no entry for the freeform capture screen

**Where:** `SCREEN_SPECS.md` (whole document)

**Claims:** Screen 8 is "Rapid-Fire Scoring Canvas & Mid-Round Swaps," mapped to the regimen run path.

**Reality:** two shipped routes use the ACTIVE shell and the same capture stack —
`/practice/regimens/:regimenId/run` and `/practice/freeform`. The freeform path predates the blueprint
integration and was folded into the shared canvas during Track 2.2c. It appears nowhere in
`SCREEN_SPECS.md`, so a reader working from that document would not know a second capture screen exists.

**Proposed edit:** add a short note under Screen 8 recording that the canvas serves two entry points.
Detail lives in `docs/ui/screens/freeform-active.md`; the note only needs to point there.

---

## C-8 — Two cross-section query-parameter contracts are undocumented

**Where:** `src/pages/FreeformLogPage.jsx:62,66` and `src/pages/DiscDetailPage.jsx:124`

**Claims:** nothing — that is the problem.

**Reality:** two deep-link contracts exist and neither is written down outside the code:

- `/practice/freeform?distance=<ft>` — read as `pursuitDistance`, seeds the starting distance. This is
  the Trophy Room `LAUNCH PURSUIT DRILL` contract described in `SCREEN_SPECS.md` Screen 12 as
  "pre-configures Screen 8 params," without naming the mechanism.
- `/bag/lost-found?disc=<discId>` — links a disc to its Lost & Found case.

Both are string-matched with no shared constant between producer and consumer, so a rename breaks them
silently and no test would catch it.

**Proposed edit:** none to root documents. `docs/ui/NAVIGATION_MAP.md` § Deep links already records
both; task `T-freeform-active-3` proposes extracting a shared constant for the pursuit parameter.

---

## Verified accurate (recorded so nobody re-checks)

- `SCREEN_SPECS.md:255` — "one `SessionReport` component, two entry points." Confirmed: both capture
  screens and `HistoryDetailPage` render the same component.
- `DEVLOG.md:1529` — "putter breakdown only reflects gesture-captured putts." Confirmed: batch-ribbon
  fills never create `putt_events` rows, so the breakdown is structurally incomplete by design.
- `DEVLOG.md:1561-1571` — `TapZone` deliberately omits the streak-driven zone growth that `GestureZone`
  has. Confirmed in both call sites.

---

## C-9 — The 35-disc interlock is a trigger, not a `CHECK` constraint

**Where:** `SCREEN_SPECS.md:174` and standing divergence #6 (`:74-75`)

**Claims:** the interlock is enforced "with app-side disabling AND a DB `CHECK` constraint," and the
dependency line reads "35-disc interlock needs the Layer 1 `bags.capacity` default/CHECK migration."

**Reality:** `layer1_foundation_schema.sql:230-253` implements it as a `before insert` trigger,
`enforce_bag_capacity()` on `bag_discs`. It cannot be a `CHECK` constraint — a `CHECK` cannot count
sibling rows. The trigger takes a row lock so concurrent adds at 34 discs cannot both pass, and raises
with `errcode = 'check_violation'`, which is presumably where the "CHECK" description came from.

Separately, `bags.capacity` is **not** the interlock. The schema comment is explicit: it is "a separate,
user-set soft target," while the hard 35 ceiling lives in the trigger. Two different concepts sharing
one word.

**Proposed edit:** correct both lines to say trigger rather than `CHECK`, and note the soft-target vs
hard-ceiling distinction. An agent told to "add the CHECK constraint" would find it missing and add a
second, weaker enforcement.

**Consequence already recorded:** `screens/disc-detail.md` § 12 item 1, including the count discrepancy
— the trigger counts every `bag_discs` row while the `discs-root` readout counts `in_locker` members
only, so a bag can display `30 / 35` and still reject an insert.
