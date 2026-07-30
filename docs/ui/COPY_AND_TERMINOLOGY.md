# Copy and Terminology

User-facing strings, grouped by concept, with conflicts flagged. Verified against `eb9fd2b`.

**This document does not pick winners.** Per the 2026-07-29 scoping decision it is an inventory plus a
decision list; canonicalization is a separate, owner-arbitrated pass. Where two screens name the same
thing differently, both are recorded and the conflict is numbered — see § Decisions needed.

Its job in the meantime is narrower but still useful: an agent writing new copy should search here first
and match an existing pattern rather than inventing a third one.

## Method

Strings extracted mechanically from all `.jsx` under `src/`: button text, `h1`–`h3` headings, input
placeholders, and empty-state paragraphs. Interpolated and dynamically composed strings are excluded,
so this is a floor, not a ceiling. Route header titles come from `src/lib/routeMetadata.js`, which is a
separate copy surface from in-page headings — the two disagree in places, and that is itself a finding.

Counts: 51 button labels, 74 headings, 13 placeholders, 27 empty states.

---

## 1. Terminology conflicts

These are naming disagreements about the same concept, not just style. They are the reason this
document exists.

### T-1 — "Regimen" vs "Routine" ⚠️ highest impact

The same object is called both, and the split runs along a code/UI seam:

| Surface | Term |
|---|---|
| Database table | `putting_regimens` |
| Route ids | `regimen-select`, `regimen-active` |
| Page components | `RegimenSelectPage`, `RegimenRunPage` |
| Route header titles | `Select Routine`, `Create Routine`, `Routine` |
| Builder component/page | `RoutineBuilderPage`, `routineBuilder.js` |
| In-page heading | `Putting Regimens` |
| Empty state | `No custom routines yet.` |

So a user reading the header sees "Routine" while the heading below it says "Regimens". Both terms
appear in `SCREEN_SPECS.md` too — Screen 7 is the "Custom Routine Builder" operating on
`putting_regimens`.

**Recommendation for the canonicalization pass:** "Routine" as the user-facing word, `regimen` retained
in schema and code. Renaming a table is expensive and invisible to users; renaming the UI word is cheap.

### T-2 — "Locker" vs "Collection"

`/bag/locker` has route title `Collection`, is served by `BagLockerPage.jsx`, and its empty state reads
`No discs in your collection yet.` — while another empty state reads `No putters in your locker yet — add
one to build your lineup.` Both describe owned discs. `src/lib/discLocker.js` uses "locker" throughout.

### T-3 — "Session" vs "Run" vs "Activity"

Three words for one capture episode, all currently user-visible:

- `End session` and `End run` are both button labels
- `No completed activity was recorded in this window.`
- Heading `Lifecycle & history`
- The lifecycle contract (`PHASE_A_ARCHITECTURE.md` § 1) calls the envelope an **activity**

"Activity" is the contract term and is the most defensible canonical choice, but it is also the least
natural word for a player. Genuine tension; needs a decision rather than a default.

### T-4 — "Bag" vs "Practice Stack"

`You don't have a bag yet.` and `You don't have any bags yet.` are both live, and `SCREEN_SPECS.md`
Screen 3 specifies a default bag named "Practice Stack" created at onboarding. Whether "Practice Stack"
is a proper noun for one specific bag or a synonym for bags generally is not stated anywhere.

---

## 2. Empty states

27 distinct strings across three incompatible idioms. `COMPONENT_LIBRARY.md` independently found no
shared empty-state component and three competing CSS idioms, which is the structural cause.

**Idiom A — bare statement of absence** (most common)
`No rounds logged yet.` · `No goals yet.` · `No discs match.` · `No molds match.` ·
`No events recorded yet.` · `No experiment markers yet.` · `No custom routines yet.` ·
`No history recorded yet.` · `No Lost & Found cases yet.` · `No XP earned in the last 30 days.`

**Idiom B — absence plus a next action** (best practice, inconsistently applied)
`No practice logged yet — pick a mode above to get started.` ·
`No putters in your locker yet — add one to build your lineup.` ·
`No putts logged yet — the map fills in as you practice.` ·
`No courses yet. Build a quick course for your next round.` ·
`No goals yet. Choose one measurable target to begin.`

Note idiom B splits again on punctuation: em-dash continuation versus a second sentence.

**Idiom C — second person**
`You don't have a bag yet.` · `You don't have any bags yet.` · `Nothing here yet.`

`Nothing here yet.` is the only fully generic string and gives the user nothing.

**Consistent and worth preserving:** `Insufficient data`, used for statistically-underpowered readouts
rather than for absence. This correctly reflects the house Wilson-interval discipline — a value exists
but is not yet trustworthy — and should not be collapsed into the empty-state vocabulary.

---

## 3. Buttons

### Emoji usage is inconsistent

Eight labels carry leading emoji — `↩ Undo`, `🏠 Dashboard`, `📜 Ledger`, `📝 Edit`, `🔄 Replay`,
`📳 Tap to test scoring pulse` — while the other ~43 are plain text, including a second plain `Edit` and
a plain `Undo`. So the same two actions ship in both styles.

`MASTER_PROJECT_BLUEPRINT.md` uses emoji heavily in its wireframes, which is the likely origin. Whether
that was ever intended as shipped copy is undecided.

### Action verbs

| Concept | Strings in use |
|---|---|
| End a capture | `End run`, `End session`, `Finish pressure putt` |
| Retry sync | `Retry sync`, `Retry activity sync` |
| Create | `Create`, `Create goal`, `Add`, `Add tag`, `Add update`, `New distance` |
| Dismiss | `Cancel`, `Close`, `Skip`, `Ignore`, `Got it` |
| Confirm | `Apply`, `Apply as new version`, `Yes, swap`, `Continue` |

`Made` / `Missed` are the scoring-capture pair and are correctly terse — do not touch them; they are
read at speed in sunlight.

`Skip setup — I'll configure later` is the only sentence-length button label in the app.

---

## 4. Headings

74 in-page headings, split between two capitalization styles with no discernible rule:

**Title Case** — `Add Disc`, `Build Routine`, `Manage Bags`, `Quick Play`, `Trophy Room`, `Lost & Found`,
`Putt Hub`, `Freeform Log`, `Putting Regimens`, `Practice Insights`, `Flight Spectrum`, `XP Ledger`,
`Bag Resonance`, `Quick course`

**Sentence case** — `Bag memberships`, `Flight numbers`, `Shot tags`, `Active pursuits`, `Skill radar`,
`Session context`, `Career telemetry`, `Miss tendency`, `Private photos`, `Your data`, `Your goals`,
`Most trusted putter`, `Contextual performance`, `Recently removed`

Some concepts appear in both — `Flight numbers` (sentence) alongside `Effective flight numbers`
(sentence) and `Flight Spectrum` / `Flight overlay` (mixed).

**Route titles are a separate surface.** `routeMetadata.js` titles are consistently Title Case
(`Add Course`, `Start Round`, `Weekly Reports`, `Recently Deleted`, `Manage Bags`). Where a route title
and the page's own `h1` differ, the user sees two names for one screen. `SCREEN_INVENTORY.md` lists every
route title; per-screen documents should record any mismatch in their element catalog.

---

## 5. Placeholders

13 total, the most internally consistent surface in the app.

**Search** — all three use trailing ellipsis: `Search your discs...`, `Search the disc universe...`,
`Search manufacturer or mold name...`

**Example-style** — lowercase, no terminal punctuation: `new, worn, beat-in...`,
`bought new, traded, found...`, `tournament, practice, all-purpose...`, `e.g. MA2`

**Prompt-style** — `How did it feel?`, `Hole 7, left rough`, `Phone, email, or clubhouse`,
`Custom shot tag`, `Add a tag`, `Morning C1 Calibration`

Note `Custom shot tag` and `Add a tag` are two placeholders for the same action on different screens.

---

## 6. Units and formats

Established conventions, confirmed by `AGENTS.md` § Conventions. These are settled — do not re-decide:

- **Distance in feet.** Displayed as `20ft` / `33ft/C1` in the blueprint, `20 feet` in speech output.
- **Scores relative to par**, formatted by `formatRelativeToPar` as `E` / `+3` / `-2`.
- **Weight in grams**, rendered `${weight}g`.
- **Percentages** rounded to whole numbers; `null` renders `Insufficient data`, never `0%`.
- **Missing values** render as an em-dash `—`, not `N/A` or blank.

---

## Decisions — RESOLVED 2026-07-29

All seven are decided. They were resolved by the assistant under the owner's standing "resolve them all"
instruction rather than by individual sign-off; each is a naming rule, reversible by editing its row.

**None is applied to the code yet.** These are the target state. Implementation is tracked in
`EXECUTION_PLAN.md` — a copy change touching 74 headings does not belong inside an unrelated commit.

| # | Decision | Ruling | Rationale |
|---|---|---|---|
| 1 | T-1 Routine vs Regimen | **"Routine" in the UI; `regimen` stays in schema and code** | Renaming a table is expensive and invisible to users; renaming the UI word is cheap. Today `Putting Regimens` and `No custom routines yet.` sit on adjacent surfaces |
| 2 | T-2 Collection vs Locker | **"Collection" in the UI; `discLocker.js` keeps its name** | Same principle. The route title already says `Collection`, so this moves two empty states, not a route |
| 3 | T-3 Session / Run / Activity | **"Session" in the UI; `activity` stays the contract term** | `activity` is right for `PHASE_A_ARCHITECTURE.md` § 1 and wrong on a button. `End run` becomes `End session` |
| 4 | T-4 Practice Stack | **Proper noun — the specific bag onboarding creates** | It comes from `PRACTICE_STACK_BAG_NAME`, one named default bag, not a synonym. Generic copy says "bag" |
| 5 | Emoji in buttons | **Drop from labels; keep in blueprint wireframes** | Blueprint emoji were layout annotation, never shipped copy. Today the same two actions ship both ways — `Edit` and `📝 Edit`. An icon belongs in an icon slot, not inside a label string |
| 6 | Heading capitalization | **Sentence case everywhere, including route titles** | The larger existing group and the accessible default. `routeMetadata.js` titles change with it, so a screen never shows two names for itself |
| 7 | Empty-state idiom | **Idiom B — absence plus a next action** | Already the best strings in the app. `Nothing here yet.` is retired outright |

**Rule 7 needs a component, not 27 rewrites.** `COMPONENT_LIBRARY.md` found three competing CSS idioms
across six files and no shared empty-state component. Applying idiom B by hand would recreate the
divergence it is meant to end — build the component first, then adopt.

**Where these live once applied.** Rules 5–7 are presentation conventions and belong in `AGENTS.md`
§ Design system, which owns presentation; this document will link rather than keep a second copy.
Rules 1–4 are naming and stay here, since this is the terminology authority.

**Explicitly not in scope.** `Made` / `Missed` on the capture surface are read at speed in sunlight.
They are correct as they are and no rule above applies to them.
