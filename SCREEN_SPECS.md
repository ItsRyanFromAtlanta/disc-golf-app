# SCREEN_SPECS.md — Screens 3–10

Companion to `updates for disc golf app.md` (which fully specs Screens 1–2). Same format per screen:
prose intro → Visual & Typography Style Guide → ASCII Structural Wireframe → Pro Additions → **Build
Notes** (REUSE vs NET-NEW mapping against the current codebase, dependencies, honesty notes).

Authored 2026-07-05 as Phase 1 of the front-door plan. These are **ideation specs**: each designs the
ideal interaction flow using the source doc's one-liners and the shipped codebase as starting context.
Where a spec proposes changing something already built, the delta is marked **ADOPT / ADAPT / REJECT**
for review. ASCII wireframes only (HTML renders on request per screen).

**Theme is fixed:** Sun-Drenched Topo (Oswald edition), exact tokens per `CLAUDE.md` § Design system.
No new color tokens anywhere in these specs. Field rules apply throughout: 80pt primary tap targets,
one-thumb operability, no pure black/white, 2px minimum borders, TTFP < 5s.

---

## Screen 3: 3-Step Zero-Typing Onboarding

**Role:** Goal calibration, instant putter provisioning, and haptic testing — the bridge between a fresh
account (or guest) and a personalized first practice session, completed without typing a single character.

A new player should reach their first putt in under 60 seconds. Every input is a tap: preset chips, a
popular-putter grid, and one big "feel it" button. Every step is skippable — onboarding primes defaults,
it never gates the app.

### Visual & Typography Style Guide

- **Progress header:** three step-dots (filled = `#CC4E3C` terracotta, upcoming = `#C8C0B0` border-only)
  under a compact Oswald-medium brand mark; persistent `Skip for now →` link (Oswald 500, `#4A524A`) top-right.
- **Question display:** one question per screen, Oswald condensed bold 28–32px in `#1A1D1A`, subtext in
  system sans `#4A524A`. Generous whitespace — this is a conversation, not a form.
- **Answer chips:** large pill buttons (min 80pt height on the primary row), `#E2DED4` surface with 2px
  `#C8C0B0` borders; selected state flips to `#CC4E3C` fill + `#F4F1EA` text + 2px `#1A1D1A` border.
- **Putter grid:** 2-column cards on `#E2DED4`, mold name in Oswald 600, manufacturer in caps-tracked
  Oswald 500 `#4A524A`, flight numbers as a small stat row.
- **Continue CTA:** bottom-40% thumb zone, full-width terracotta button, Oswald 600 all-caps, hard
  `#1A1D1A` shadow (matches Screen 1's `btn-primary`).

### Structural Wireframe / Layout Blueprint

```
STEP 1 — GOAL CALIBRATION
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  ( 🥏 )  ● ○ ○                       Skip for now →   | <- Step dots + always-visible skip
+-------------------------------------------------------+
|                                                       |
|  WHAT'S YOUR MONEY DISTANCE?                          | <- Oswald bold 30px
|  The putt you'd bet a stroke on.                      | <- system sans, #4A524A
|                                                       |
|   +---------+  +---------+  +---------+               |
|   |  15 ft  |  |  20 ft  |  |  25 ft  |               | <- 80pt chips; single tap selects
|   +---------+  +---------+  +---------+               |
|   +---------+  +---------+                            |
|   |  30 ft  |  |  35 ft+ |                            |
|   +---------+  +---------+                            |
|                                                       |
|  AND YOUR MAIN GOAL?                                  |
|   [ 🔒 Lock down C1 ]  [ 📏 Extend my range ]        | <- one tap each; both questions,
|   [ 🎯 Tournament prep ] [ 🧘 Just putt more ]        |    zero keyboards
|                                                       |
|=================== BOTTOM 40% ZONE ===================|
|  +-------------------------------------------------+  |
|  |               CONTINUE  [➔]                     |  | <- enabled after any selection
|  +-------------------------------------------------+  |
|  [HOME INDICATOR BAR]                                 |
+-------------------------------------------------------+

STEP 2 — INSTANT PUTTER PROVISIONING
+-------------------------------------------------------+
|  ( 🥏 )  ● ● ○                       Skip for now →   |
+-------------------------------------------------------+
|  WHAT'S IN YOUR HAND?                                 |
|  Pick your gamer putter — we'll set up your bag.      |
|                                                       |
|  +---------------------+ +---------------------+      |
|  | LUNA                | | ENVY                |      | <- popular-putter grid, seeded
|  | DISCMANIA... no—    | | AXIOM               |      |    from disc_molds catalog
|  | 3 | 3 | 0 | 3       | | 3 | 3 | 0 | 2       |      | <- stock flight numbers
|  +---------------------+ +---------------------+      |
|  +---------------------+ +---------------------+      |
|  | JUDGE               | | ZONE                |      |
|  | DYNAMIC DISCS       | | DISCRAFT            |      |
|  +---------------------+ +---------------------+      |
|                                                       |
|      [ 🔍 It's something else — browse catalog ]      | <- falls into mold search (typing
|      [ I'll set up my bag later ]                     |    allowed but never required)
|=================== BOTTOM 40% ZONE ===================|
|  +-------------------------------------------------+  |
|  |          THAT'S MY PUTTER  [➔]                  |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+

STEP 3 — HAPTIC TEST
+-------------------------------------------------------+
|  ( 🥏 )  ● ● ●                       Skip for now →   |
+-------------------------------------------------------+
|  FEEL YOUR MAKES                                      |
|  During practice, the app buzzes so you never         |
|  look down at the screen.                             |
|                                                       |
|            +---------------------------+              |
|            |                           |              |
|            |     TAP TO FEEL A MAKE    |              | <- fires vibrateMake(); tap again
|            |          ( 🎯 )           |              |    cycles make → miss → undo
|            |                           |              |
|            +---------------------------+              |
|                                                       |
|   Felt it?   [ ✓ KEEP HAPTICS ON ]  [ ✗ NO THANKS ]  |
|                                                       |
|   ( On iPhone: "Your phone doesn't support web        | <- graceful iOS degrade: honest
|     vibration — sound cues will cover you." )         |    message, auto-advances
|=================== BOTTOM 40% ZONE ===================|
|  +-------------------------------------------------+  |
|  |          START PUTTING  [➔]                     |  | <- lands on Hub w/ suggestion primed
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

### Interaction Flow

1. Gate: after auth, if `isThrowingProfileEmpty(profile)` → route to `/onboarding`; otherwise never shown
   (re-runnable later from Profile).
2. Step 1 writes profile fields on Continue (single upsert, not per-tap). Money distance maps to C1
   comfort + calibration fields (value + `source='self_reported'` pattern); goal maps to `target_rating` /
   goals section.
3. Step 2: tapping a putter card creates the disc (`upsertDisc` with `mold_id`), ensures a default bag
   exists, equips the disc to it (`addDiscToBag`), and stores it as `favoritePutterDiscId` in the
   InstantLaunch profile defaults — so Screen 8's putter picker is pre-answered forever.
4. Step 3: test button fires real haptics via the shipped hook; unsupported devices get the honest
   fallback line and the choice is stored as a sound-cue preference instead.
5. Finish (or Skip at any point) → `/practice` Hub. Skipped steps leave defaults untouched; the Hub's
   first-login nudge (existing 1A convention) remains the recovery path.

### Pro Additions

1. **"Money Distance" framing (calibration disguised as identity).**
   *Why games & top apps use it:* onboarding completion collapses when questions feel like forms; it soars
   when they feel like self-expression (Duolingo's "Why are you learning?"). Asking "what putt would you
   bet a stroke on" is a disc golfer identity question that happens to emit calibration data.
   *How we integrate it:* the chip answer seeds C1 comfort AND becomes the first suggested practice
   distance, so the very first Hub visit already feels personalized.
2. **One-tap bag genesis.**
   *Why games & top apps use it:* games never make you fill your inventory before playing — they hand you
   a starter loadout. A player who picks "Luna" should instantly own a Luna, in a default bag, set as
   their gamer.
   *How we integrate it:* one tap performs disc-create + bag-create + equip + favorite in a single
   transaction-like flow; the locker/bag screens later reveal what was provisioned.
3. **Haptic trust demo.**
   *Why games & top apps use it:* features users have *felt* get kept; features described in a settings
   toggle get ignored. Letting the player feel make/miss/undo builds trust in eyes-free logging before
   they've logged a single putt.
   *How we integrate it:* the demo button cycles the three real vibration patterns from the shipped hook —
   the exact sensations they'll feel mid-session.
4. **Skip-forever guarantee.**
   *Why games & top apps use it:* forced onboarding is the #1 first-session abandon point in mobile.
   *How we integrate it:* `Skip for now` on every step, whole flow re-launchable from Profile, and the app
   is fully functional with zero onboarding answers (defaults cover everything).

### Build Notes

- **REUSE:** `src/lib/profile.js` (`fetchProfile`, `upsertProfileFields`, `isThrowingProfileEmpty` — the
  gate condition already exists), `src/lib/discLocker.js` (`searchMolds`, `upsertDisc`, `fetchBags`,
  `createBag`, `addDiscToBag`), `src/hooks/usePuttHaptics.js` (`supported`, `vibrateMake`, `vibrateMiss`,
  `vibrateUndo`), InstantLaunch profile defaults (`updateProfileDefaults` via
  `src/hooks/useInstantLaunchSession.js` / `src/lib/instantLaunch/storage.js`), seeded `disc_molds`
  catalog (4 manufacturers already imported), theme tokens + `btn-primary` pattern from Screens 1–2.
- **NET-NEW:** `src/pages/OnboardingPage.jsx` + three step components; popular-putter shortlist (a small
  curated array of mold IDs from the seeded catalog — no schema); routing gate in `App.jsx`
  (`/onboarding`, entered when throwing profile empty).
- **Dependencies:** none beyond shipped 1A profile schema. Guest-mode entry depends on Phase 2 auth work
  (anonymous sign-in) but the flow itself is auth-method-agnostic.
- **Honesty notes:** Vibration API no-ops on iOS Safari — Step 3 must detect `supported === false` and
  show the fallback copy (never a dead button). "Zero-typing" holds except the optional catalog-browse
  escape hatch, which is explicitly labeled as optional.

---

## Screen 4: Main Dashboard (Play / Putt Hub)

**Role:** Dynamic launchpad, active gear summary, and streak tracking — the screen the app opens to, whose
only job is getting a player from cold start to putting in one tap.

The shipped `PracticeMenuPage` is a clean card menu; the ideal Hub is a *launchpad*: the top of the screen
answers "what should I do right now?" with a single smart CTA, while streak, volume, and gear context make
the app feel alive between sessions.

### Visual & Typography Style Guide

- **Header strip:** "PUTTING" wordmark (Oswald 700) left; streak flame chip (`🔥 6` — Oswald 600 on
  `#E2DED4`, `#E87A30` used only as the flame glyph accent on a surface fill, never as text color) and
  stats shortcut icon right.
- **Hero card ("UP NEXT"):** full-width `#E2DED4` card, 2px `#1A1D1A` border, hard shadow; suggestion line
  in Oswald 500, giant one-tap START button (80pt+, terracotta `#CC4E3C`).
- **Volume ledger row:** three stat tiles (week / month / lifetime putts), Oswald 700 numerals 24px,
  caps-tracked labels in `#4A524A`.
- **Gear chip:** compact row — bag icon + default bag name + gamer putter nickname, canyon blue `#2B5F6C`
  accents, tappable → Bag tab.
- **Mode cards:** existing `ModeCard` treatment (icon, title, one-liner, chevron) unchanged.
- **Recent activity:** existing strip, demoted below mode cards.

### Structural Wireframe / Layout Blueprint

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  PUTTING                        [🔥 6]  [📊]          | <- streak chip + stats shortcut
+-------------------------------------------------------+
|                                                       |
|  +-------------------------------------------------+  |
|  | UP NEXT                                         |  | <- hero: suggestNextSession()
|  | 25 FT FOCUS — your coin-flip zone               |  |    names the distance + why
|  | Current form: 71% (↑ trending)                  |  | <- decayWeightedForm vs lifetime
|  |                                                 |  |
|  |  +-------------------------------------------+  |  |
|  |  |            ▶  START PUTTING               |  |  | <- one tap → Screen 8 canvas,
|  |  +-------------------------------------------+  |  |    config pre-filled
|  +-------------------------------------------------+  |
|                                                       |
|  THIS WEEK        THIS MONTH        LIFETIME          |
|    342              1,208            9,451            | <- volumeLedger()
|                                                       |
|  ⛳ Tournament Bag  ·  🥏 Luna (gamer)        [›]     | <- active gear chip → /bag
|                                                       |
|  +-------------------------------------------------+  |
|  | 🎯  FREEFORM LOG          Log putts by distance ›| | <- existing ModeCards
|  +-------------------------------------------------+  |
|  | 🏋️  REGIMENS         Scored practice, 5 levels ›| |
|  +-------------------------------------------------+  |
|  | 🕘  HISTORY            Sessions, PBs, insights ›| |
|  +-------------------------------------------------+  |
|                                                       |
|  RECENT ACTIVITY                                      |
|   · Regimen: Level 3 — 1,240 pts — yesterday          |
|   · Freeform: 20–30ft, 41/60 — Jul 3                  |
+-------------------------------------------------------+
|  [ Practice ]      [ Bag ]      [ Profile ]           | <- existing TabBar
+-------------------------------------------------------+
```

### Interaction Flow

1. Hero card computes from cached history on mount (no network gating — render from last-known data,
   refresh silently). START deep-links into the suggested mode with distance pre-filled via
   InstantLaunchPayload — same one-tap path the crash-recovery flow already uses.
2. If a crash-recovery buffer exists, the hero card *becomes* "RESUME SESSION — Set 3 of 5, 25ft" (the
   existing auto-resume redirect stays; this is its visible, non-yanking sibling for users who land here).
3. Streak chip tap → History (streak details live there already). Gear chip tap → Bag tab.
4. Empty states: no history → hero reads "FIRST SESSION — start at 10 ft" (existing
   `DEFAULT_STARTING_DISTANCE_FT`); throwing profile empty → hero offers the onboarding nudge (existing
   1A convention, relocated here).

### Pro Additions

1. **Single smart CTA above the fold.**
   *Why games & top apps use it:* every successful fitness/game app (Strava, Peloton, chess.com) leads
   with "do the thing," not a menu. Decision fatigue kills practice frequency; a pre-made decision starts
   sessions.
   *How we integrate it:* `suggestNextSession()` already computes last regimen + warmup distance + current
   form — the hero card is a rendering of an existing pure function, plus a one-tap start.
2. **Streak with tomorrow-stakes.**
   *Why games & top apps use it:* Duolingo's streak is the most-copied retention mechanic in mobile.
   Streaks work when they're visible at open and cheap to maintain.
   *How we integrate it:* `practiceStreak()` already exists; the chip shows it at open, and sub-copy
   ("putt today to keep it") appears only when today has no session yet — informational, never guilt-toned.
3. **Gear as identity strip.**
   *Why games & top apps use it:* loadout games surface your equipped gear everywhere because gear is
   identity; it also silently confirms *which* data your session will be tagged with.
   *How we integrate it:* default bag + favorite putter (both already stored) rendered as one tappable
   chip; sets up the Screen 9 putter-analytics story.

### Build Notes

- **REUSE:** `src/pages/PracticeMenuPage.jsx` (this screen is its evolution, same route `/practice`),
  `src/components/ModeCard.jsx` unchanged, `src/lib/insights/` — `suggestNextSession` /
  `suggestWarmupDistance` / `DEFAULT_STARTING_DISTANCE_FT` (`nextSessionSuggestion.js`),
  `practiceStreak` + `volumeLedger` (`activity.js`), `decayWeightedForm` (`form.js`);
  `src/lib/history.js` (`fetchHistory`, `allPuttSamples`, `distanceSamples`) for inputs; InstantLaunch
  payload for pre-filled start + crash-recovery detection; `src/components/TabBar.jsx`.
- **NET-NEW:** hero "UP NEXT" card component; volume-ledger tile row (function exists, UI doesn't);
  gear chip (join of default bag + `favoritePutterDiscId`); streak chip in header.
- **Dependencies:** none — all data sources shipped. Purely compositional.
- **Honesty notes:** the hero renders from a full-history fetch today (`fetchHistory` has no limit); at
  current volume that's fine, but the spec notes the existing documented upgrade path (Postgres view) if
  cold-start cost ever grows. The recent-activity strip currently limits to 3 — keep.

---

## Screen 5: Unified Bag Management & Disc Universe

**Role:** 3-tab inventory hub, capacity tracking, and catalog drill-down — one place where the
locker (inventory), bags (loadouts), and the shared mold catalog (universe) stop being sibling pages and
become one coherent space.

Everything here exists as separate routes today (`/bag`, `/bag/locker`, `/bag/manage`); the delta is
*unification*: a segmented control that keeps the player oriented in one mental model — **you own discs,
you equip subsets, you discover from the universe.**

### Visual & Typography Style Guide

- **Hub header:** "BAG" wordmark left; context action right (changes per tab: `+ Add disc` on Locker,
  `Manage` on Bags, search field focus on Catalog).
- **Tab control:** 3-segment high-contrast toggle (BAG | LOCKER | CATALOG), Oswald condensed 600 all-caps;
  active segment `#1A1D1A` fill with `#F4F1EA` text (same pattern as Screen 2's SIGN IN/CREATE toggle).
- **Capacity ring:** small circular gauge next to the bag switcher — stroke in `#2B5F6C`, overflow state
  flips stroke to `#8C2D19`; numerals Oswald 700.
- **Disc rows/cards:** existing locker card treatment (stability accent edge, flight numbers, status
  badge); grid ⇄ list toggle persists (existing preference).
- **Catalog cards:** distinguished from owned discs by a dashed 2px `#C8C0B0` border and an `+ ADD COPY`
  chip — visual grammar: dashed = not yours yet.

### Structural Wireframe / Layout Blueprint

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  BAG                                    [ + / ⚙ / 🔍 ]| <- context action per tab
+-------------------------------------------------------+
|  +-------------------------------------------------+  |
|  | [  BAG  ] (Active) | [ LOCKER ] | [ CATALOG ]   |  | <- 3-segment Oswald toggle
|  +-------------------------------------------------+  |
|                                                       |
|  BAG TAB                                              |
|  ⛳ Tournament Bag ▾        ( 14/18 ◔ )   [Manage]    | <- switcher + capacity ring
|  +-------------------------------------------------+  |
|  |            FLIGHT CHART (scatter)               |  | <- existing FlightChart SVG
|  |     · speed × (turn+fade), effective numbers    |  |
|  +-------------------------------------------------+  |
|  |  🥏 Luna (gamer)         3|3|0|3     putter     |  |
|  |  🥏 Hex                  5|5|-1|1    midrange   |  | <- tap → Screen 6 disc profile
|  |  🥏 Trail                10|5|-1|2   fairway    |  |
|  |  ...                                            |  |
|  |  [ + ADD FROM LOCKER ]                          |  |
|  +-------------------------------------------------+  |
|                                                       |
|  LOCKER TAB (structure)                               |
|   [🔍 search] [Manufacturer ▾][Speed ▾][Status ▾]     | <- existing filters/sort
|   [grid ⇄ list]  → owned disc cards → Screen 6        |
|                                                       |
|  CATALOG TAB (structure)                              |
|   [🔍 search the disc universe]                       | <- disc_molds shared catalog
|   +- - - - - - - - - - - - - - +                      |
|   |  ENVY · AXIOM   3|3|0|2    |   [+ ADD COPY]       | <- dashed border = not owned
|   +- - - - - - - - - - - - - - +                      |
|   ( mold detail: specs, plastics, your copies )       |
+-------------------------------------------------------+
|  [ Practice ]      [ Bag ]*     [ Profile ]           |
+-------------------------------------------------------+
```

### Interaction Flow

1. `/bag` renders the 3-tab hub; tab state syncs to the URL (`/bag`, `/bag/locker`, `/bag/catalog`) so
   existing deep links keep working unchanged. `/bag/manage`, `/bag/discs/:id`, `/bag/discs/new` stay as
   pushed detail routes (not tabs).
2. **Bag tab** = existing `BagPage` content + capacity ring upgrade (linear bar → ring w/ overflow color).
3. **Locker tab** = existing `BagLockerPage` content unchanged (filters/sort/grid-list all shipped).
4. **Catalog tab** = net-new browse/search over `disc_molds` (search already exists as `searchMolds` in
   the add-disc flow — this promotes it to a destination). Mold detail shows specs + provenance + "your
   copies" (owned discs of that mold) + ADD COPY → prefilled `DiscFormPage`.
5. Add-from-locker keeps its existing query-param flow (`/bag/locker?addToBag=…`), now landing on the
   Locker tab with an "adding to {bag}" banner.

### Pro Additions

1. **Dashed-border "not yours yet" grammar.**
   *Why games & top apps use it:* inventory games visually separate owned from ownable at a glance —
   it makes browsing feel like shopping and owning feel like progress.
   *How we integrate it:* one CSS treatment (dashed border + ADD COPY chip) distinguishes catalog molds
   from locker discs everywhere, including "your copies" lists on mold detail.
2. **Capacity ring with overflow honesty.**
   *Why games & top apps use it:* limited loadout slots create meaningful choices (deck builders cap
   decks); a ring communicates fullness pre-attentively in sunlight.
   *How we integrate it:* existing `capacity` column + count; ring stroke flips to deep rust `#8C2D19`
   when over — informative, never blocking (capacity is a target, not a lock).
3. **Universe as retention surface.**
   *Why games & top apps use it:* collection browsers (Pokédex pattern) drive return visits even when
   there's nothing to log.
   *How we integrate it:* the Catalog tab is the community `disc_molds` table (insert-open, so every
   user-added mold enriches everyone's universe) — browsing it costs zero new backend.

### Build Notes

- **REUSE:** `src/pages/BagPage.jsx` (bag tab content: switcher, capacity data, FlightChart, disc list),
  `src/pages/BagLockerPage.jsx` (locker tab content wholesale), `src/pages/BagManagePage.jsx` (unchanged,
  reached via Manage), `src/pages/DiscFormPage.jsx` (ADD COPY target, mold pre-selected),
  `src/lib/discFilters.js` (`filterDiscs`/`sortDiscs`), `src/lib/discLocker.js` (`searchMolds`,
  `fetchBagDiscs`, `fetchUserDiscs`), `src/components/FlightChart.jsx`, `src/lib/bags.js`
  (`bagViewDiscs`, `flightChartPoints`).
- **NET-NEW:** the 3-segment hub shell (tab control + URL sync); Catalog tab page (mold browse/search +
  mold detail view — first read-only destination for `disc_molds` outside the picker); capacity ring
  component (upgrade of existing bar).
- **Dependencies:** none — schema fully shipped (1B/1C).
- **Honesty notes:** "3-tab" in the source one-liner is interpreted as Bag/Locker/Catalog (loadout /
  inventory / universe), with Manage demoted to a detail action — matching the 1E game-inventory mental
  model already committed in `DEVELOPMENT_PLAN.md`. `/bag/catalog` is a new URL; all existing URLs keep
  their meaning.

---

## Screen 6: Putter Lineup Management & Disc Profile

**Role:** Primary/backup putter assignment, wear slider, and live Bézier flight curves — the disc detail
page grows from a spec sheet into a *relationship page* with each disc, and putters get a dedicated
depth-chart concept.

Putters deserve special treatment in a putting app: which disc is THE gamer, which is the backup, and how
worn is each? Meanwhile every disc's numbers become a drawn flight — numbers are for engineers, curves are
for players.

### Visual & Typography Style Guide

- **Depth chart card (putter lineup):** ranked slots — PRIMARY (terracotta `#CC4E3C` left-edge accent,
  "GAMER" tag in Oswald 600 caps) and BACKUP (canyon blue `#2B5F6C` accent); empty slot renders dashed
  with `+ assign`.
- **Flight curve panel:** landscape SVG on `#E2DED4`, curve stroked 3px in `#2B5F6C` (effective numbers)
  over a ghost curve in `#C8C0B0` (stock numbers) — the gap between them *is* the story of your overrides.
- **Wear slider:** chunky 10-step slider, 2px track, thumb 32px with hard shadow; labels "NEW" ↔ "BEAT IN"
  in caps-tracked Oswald 500; current value renders as a phrase ("Season-worn · 6/10"), never a bare number.
- **Everything else:** existing DiscDetailPage sections (details, overrides, memberships) keep their
  shipped EditableSection treatment.

### Structural Wireframe / Layout Blueprint

```
DISC PROFILE (evolved /bag/discs/:id)
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  ← LOCKER            LUNA  "MONEYMAKER"               | <- nickname in Oswald 700
+-------------------------------------------------------+
|  DISCMANIA · PUTTER · [IN LOCKER]     [★ GAMER]       | <- putter-role badge if assigned
|                                                       |
|  +-------------------------------------------------+  |
|  |               FLIGHT CURVE                      |  |
|  |      ___,--------.__                            |  | <- Bézier from effective numbers
|  |   ,-'               `-.                          |  |    (canyon blue, 3px)
|  |  /            . . . . .`-._                      |  | <- ghost curve = stock numbers
|  | |          . '           `.:                     |  |    (#C8C0B0) when overrides exist
|  |  [EFFECTIVE 3|3|0|3]   [STOCK 3|3|0|3]           |  | <- existing numbers table below
|  +-------------------------------------------------+  |
|                                                       |
|  WEAR                                                 |
|  NEW  ○──○──○──○──○──●──○──○──○──○  BEAT IN          | <- 10-step slider
|        "Season-worn · 6/10 — flies straighter          |
|         than stock"                                   | <- wear phrase, auto-generated
|                                                       |
|  DETAILS            [edit]                            | <- existing EditableSection
|  FLIGHT OVERRIDES   [edit]                            | <- existing EditableSection
|  BAGS: [Tournament ✓] [Practice +]                    | <- existing equip chips
+-------------------------------------------------------+

PUTTER LINEUP (section on Bag tab, putters only)
+-------------------------------------------------------+
|  PUTTER LINEUP                                        |
|  +-------------------------------------------------+  |
|  | ★ PRIMARY   Luna "Moneymaker"   wear 6/10   [›] |  | <- terracotta accent edge
|  +-------------------------------------------------+  |
|  | ② BACKUP    Envy               wear 2/10    [›] |  | <- canyon blue accent edge
|  +-------------------------------------------------+  |
|  | + - - - -  assign a third putter  - - - - - -  |  | <- dashed empty slot
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

### Interaction Flow

1. **Putter lineup** renders on the Bag tab (Screen 5) filtered to speed-class "putter"; assigning
   PRIMARY sets the same `favoritePutterDiscId` the canvas already reads — one source of truth. BACKUP is
   a new adjacent slot. Tapping a slot opens a putter-only picker (existing `PutterPicker` component).
2. **Flight curve** is a pure function `flightPath(speed, glide, turn, fade) → SVG path` (top-down
   RHBH flight: turn bends right mid-flight, fade hooks left at the end, speed/glide scale length).
   Deterministic, unit-testable, no physics engine pretensions — a *sketch*, honestly labeled.
3. **Wear slider** writes a numeric wear value; the freetext `condition` field remains for prose. Wear
   phrase is generated from the value (pure function, testable).
4. Changing PRIMARY putter takes effect on the next session start (InstantLaunchPayload default), never
   mid-session.

### Pro Additions

1. **Depth chart, not favorites.**
   *Why games & top apps use it:* sports games use depth charts because "starter vs bench" is how
   athletes actually think; a lone "favorite" flag can't express "my backup is the same mold, one wear
   step fresher."
   *How we integrate it:* PRIMARY/BACKUP slots on the bag view; PRIMARY doubles as the canvas default,
   BACKUP powers Screen 8's swap drawer and Screen 9's putter comparisons.
2. **Ghost-curve overrides.**
   *Why games & top apps use it:* showing tuned-vs-stock as two curves (racing games' tuning screens)
   communicates "what my overrides did" without reading a single number.
   *How we integrate it:* stock curve renders in border-gray beneath the effective curve only when
   overrides exist — zero visual noise for stock discs.
3. **Wear as flight context.**
   *Why games & top apps use it:* durability bars create maintenance narratives; here wear genuinely
   changes flight (beat-in discs turn more), so the slider isn't cosmetic.
   *How we integrate it:* wear phrase hints at flight implication ("flies straighter than stock");
   future: wear value annotates the flight curve and Screen 9's putter matrix.

### Build Notes

- **REUSE:** `src/pages/DiscDetailPage.jsx` (all existing sections keep working — curve panel and wear
  slider are additive), `src/lib/discs.js` (`effectiveFlightNumbers` feeds the curve),
  `src/components/FlightChart.jsx` (unchanged; the Bézier curve is a NEW sibling component, not a
  FlightChart change), `src/components/puttingCanvas/PutterPicker.jsx` (slot assignment picker),
  InstantLaunch `favoritePutterDiscId` (PRIMARY writes it), `src/lib/discFilters.js` speed-class
  helper (putter filtering).
- **NET-NEW:** `FlightCurve` SVG component + `flightPath()` pure function (unit-tested, `lib/`), putter
  lineup section component, wear slider + wear-phrase pure function, putter-role storage.
- **Dependencies / schema implications (NOT built this phase, append-only files later):**
  - **Putter roles — proposal: profile columns** `primary_putter_disc_id` / `backup_putter_disc_id`
    (nullable FKs → discs). Rejected alternatives: per-bag roles (roles are player-level, not per-loadout)
    and a disc flag (can't express ordering, invites multi-primary bugs). Localstorage-only rejected
    because Screen 9 analytics needs roles server-side.
  - **Wear** — new numeric column on `discs` (0–10); `condition` freetext retained.
- **Honesty notes:** the flight curve is a stylized sketch derived from 4 flight numbers, not a physics
  simulation — the spec labels it in-UI as "flight sketch." Wear does not yet feed the curve math in v1
  (listed as the natural v2). Until the schema lands, PRIMARY can ship on the existing
  `favoritePutterDiscId` alone (BACKUP is what actually needs the new columns).

---

## Screen 7: Custom Regimen Builder

**Role:** Modular stage stacking, 5-putt steppers, and milestone bonus toggles — players compose their own
scored regimens from the same primitives the five fixed regimens use.

**STATUS: SPEC-ONLY THIS CYCLE.** Building this depends on the Track 2.3 schema generalization
(`rules_config` jsonb + `drill_type` on `putting_regimens`), which is not yet designed. This spec's job is
to be the *demand signal* for that design: everything the builder needs to express is enumerated here so
the 2.3 schema pass (Opus 4.8, per convention) can design once against real requirements.

### Visual & Typography Style Guide

- **Builder canvas:** vertical stack of stage cards on `#F4F1EA`; each card `#E2DED4`, 2px border,
  drag-handle affordance (≡) left, stage summary center, delete (✕) right.
- **Steppers:** oversized − / + buttons (56px+) flanking Oswald 700 numerals — reps step by 5, distance
  by 5 ft. No free-number keyboards anywhere.
- **Bonus toggles:** switch rows with the same chip language as diagnostic-mode toggle; enabled state
  fills `#2B5F6C`.
- **Live score preview:** pinned footer strip above the save CTA — "MAX SCORE: 1,840" in Oswald 700,
  recomputed on every edit (terracotta pulse on change).
- **Difficulty:** auto-computed star row (read-only) — players don't self-declare difficulty, the
  structure implies it.

### Structural Wireframe / Layout Blueprint

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  ← REGIMENS          BUILD YOUR OWN                   |
+-------------------------------------------------------+
|  NAME: [ THURSDAY GRIND        ] (chip-suggest names) | <- optional typing; suggested
|                                                       |    names offered as chips
|  STAGES                                               |
|  +-------------------------------------------------+  |
|  | ≡  STAGE 1        15 ft      [−] 10 [+] putts ✕ |  | <- reps stepper, steps of 5
|  |    distance [−] 15 [+] ft    pressure putt: ⭘   |  | <- last-putt multiplier toggle
|  +-------------------------------------------------+  |
|  | ≡  STAGE 2        20 ft      [−] 15 [+] putts ✕ |  |
|  |    distance [−] 20 [+] ft    pressure putt: ⬤ 2x|  |
|  +-------------------------------------------------+  |
|  |            [ + ADD STAGE ]                      |  | <- clones last stage +5 ft
|  +-------------------------------------------------+  |
|                                                       |
|  MILESTONE BONUSES                                    |
|  [⬤] Clean-set bonus            +25% of set value    | <- maps to no_miss_bonus_pct
|  [⬤] Streak multiplier          +10% per consecutive | <- maps to streak_step
|  [⭘] Completion bonus           +200 pts             | <- maps to completion_bonus
|                                                       |
|  DIFFICULTY (auto):  ★ ★ ★ ☆ ☆                        | <- derived from volume × distance
|=================== BOTTOM 40% ZONE ===================|
|  MAX SCORE: 1,840          YOUR BEST: —               | <- live preview via regimenScoring
|  +-------------------------------------------------+  |
|  |            SAVE & PUTT IT  [➔]                  |  | <- saves, then straight into a run
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

### Interaction Flow

1. Entry: "+ BUILD YOUR OWN" card at the bottom of `RegimenSelectPage`'s list; custom regimens then
   appear in that list under a "YOURS" group, same card treatment plus an edit affordance.
2. Stage cards reorder by drag; ADD STAGE clones the previous stage at +5 ft (ladder-building in one tap).
3. Every edit recomputes max score using the *same* `computeSetScore`/`computeCompletionBonus` functions
   that score real runs — preview and reality cannot drift.
4. SAVE & PUTT IT persists the regimen and launches `RegimenRunPage` immediately (the run page already
   works off regimen + sets rows, so custom regimens run through the shipped engine unmodified).
5. Editing a regimen that has runs recorded versions rather than mutates (see Build Notes) so history
   stays truthful.

### Pro Additions

1. **Live max-score preview.**
   *Why games & top apps use it:* deck builders show deck power as you build — instant feedback turns
   configuration into play.
   *How we integrate it:* pinned footer recomputes from the shipped scoring functions on every stepper
   tap; "YOUR BEST" appears beside it once the regimen has runs.
2. **Clone-and-ladder stage adding.**
   *Why games & top apps use it:* good editors predict the next block (Notion, level editors); putting
   ladders (10@15, 10@20, 10@25…) are the dominant real-world pattern.
   *How we integrate it:* ADD STAGE copies the last stage and bumps distance +5 ft — a full ladder in
   four taps.
3. **Auto-computed difficulty.**
   *Why games & top apps use it:* self-declared difficulty is noise; computed difficulty keeps the
   5-level mental model of the fixed regimens intact for customs.
   *How we integrate it:* pure function over total volume, mean distance, and pressure-multiplier usage →
   1–5 stars; unit-tested; displayed read-only.

### Build Notes

- **REUSE:** `src/lib/regimenScoring.js` (`computeSetScore`, `computeCompletionBonus` — the preview IS
  these functions), `src/pages/RegimenRunPage.jsx` + entire canvas stack (custom regimens run unmodified),
  `src/pages/RegimenSelectPage.jsx` (list gains a YOURS group), stepper/toggle visual language from the
  shipped canvas components.
- **NET-NEW:** builder page + stage-card/stepper/bonus-toggle components; difficulty-estimator pure
  function (`lib/`, unit-tested); "YOURS" grouping on the select page.
- **Dependencies — BLOCKED on Track 2.3 schema (Opus 4.8 design pass). What this spec demands of it:**
  - `putting_regimens`: `created_by` (nullable — null = system regimen; RLS: customs visible to owner
    only), `drill_type` (`'fixed_sets'` for both system and custom-built regimens; JYLY/ATW arrive as
    other types), `rules_config` jsonb.
  - **`rules_config` shape this builder needs:** `{ version: 1, stages: [{ distance_ft, reps,
    pressure_multiplier }], bonuses: { streak_step, no_miss_bonus_pct, completion_bonus } }` — note this
    overlaps the existing typed columns; the 2.3 design pass must decide column-vs-jsonb authority
    (recommendation: typed columns stay authoritative for `fixed_sets`, `rules_config` reserved for
    drill types whose rules don't fit the columns — JYLY laddering, ATW rotation).
  - **Versioning rule:** editing a custom regimen with recorded runs creates a new regimen row and
    retires the old (runs keep pointing at the version they were scored against).
- **Honesty notes:** spec-only this cycle — no builder UI, no schema file. Distance is per-stage single
  value here (the fixed regimens use min/max ranges; the builder writes `min = max` for simplicity, range
  support deferred).

---

## Screen 8: Rapid-Fire Scoring Canvas

**Role:** Split-screen touch zones, visual stack tracker, and mid-round swap drawers — per the source
one-liner. **The canvas shipped in Track 2.2c**; this spec records the as-built baseline, then evaluates
each source-doc idea against it as an ADOPT / ADAPT / REJECT delta.

### As-built baseline (shipped, 2026-07-05)

Zoned canvas: `CanvasContextBar` (stage, tally, distance, sync pill, silence + diagnostic toggles) /
`GestureZone` (swipe up = make, down = miss, left = undo; ±45° cones; 120px/350ms gates; 400ms debounce;
long-press rapid-fire at 200ms ticks; make territory grows +5% per consecutive make to a 60% cap;
shockwave/reject-flash feedback) / `BatchRibbon` (grid ≤10, scroll-snap carousel 15–20, complementary
auto-fill, 3s confirm-advance). Offline outbox with idempotent sync; crash-recovery auto-resume; audio
pitch ladder + speech announcements; Android haptics; diagnostic 9-zone miss picker; data-split rule
(gestures → `putt_events` + summaries; batch → summaries only). All thresholds are named constants in
`GESTURE_CONFIG`, DPR-independent.

### Delta evaluations (each: verdict + reasoning)

1. **Split-screen touch zones (tap left = miss, right = make) — ADAPT, as an opt-in "Tap Mode."**
   *Against as-built:* static tap halves are faster than swipes but error-prone — no travel/velocity gate
   means pocket touches, rain drops, and grip adjustments all register. The gesture design was chosen
   precisely for deliberateness. *Adaptation:* a per-session input-mode toggle (next to diagnostic mode)
   switching the GestureZone to two giant tap targets with the existing 400ms debounce and undo swipe
   retained. Serves cold hands and accessibility; classification stays in the same engine (a tap-mode
   branch in the same event → outcome pipeline, same `putt_events` writes).
2. **Visual stack tracker (see remaining putts as a physical stack) — ADOPT.**
   *Against as-built:* the context bar shows `makes/attempts` and volume as numerals only; a glanceable
   "3 discs left in your hand" is exactly the eyes-mostly-off-screen information the canvas wants.
   *Integration:* a row of disc pips in the context bar — filled terracotta = made, rust-outline = missed,
   empty = remaining (capped visual at ~20 with a `×N` overflow). Pure render off existing tally state;
   zero data changes.
3. **Mid-round swap drawers (change putter mid-session) — ADAPT, one drawer, putters only.**
   *Against as-built:* putter is chosen at session start and assumed constant; but real practice includes
   "switch to the backup for the next set." A full gear drawer mid-session is friction; a putter-only
   swap is signal. *Integration:* edge-swipe (right edge, outside the gesture cones) opens a drawer
   listing the putter lineup (Screen 6's PRIMARY/BACKUP + other putters); swapping logs the change so
   subsequent events attribute to the new putter. **Depends on the `putt_events.putter_disc_id` schema
   implication (see Screen 9)** — without it, the swap is UI-only and the data story is session-level.

### Visual & Typography Style Guide (delta items only)

- **Stack tracker pips:** 12px discs in the context bar; made = `#CC4E3C` fill, missed = `#8C2D19`
  2px outline, remaining = `#C8C0B0` outline.
- **Tap Mode zones:** upper zone MAKE (`#CC4E3C` tint at rest, not only on touch), lower zone MISS
  (`#8C2D19` tint); giant Oswald 700 labels; same shockwave feedback vocabulary as swipes.
- **Swap drawer:** slides from right over a `#1A1D1A` scrim; putter rows reuse lineup-card treatment;
  active putter marked ★.

### Structural Wireframe / Layout Blueprint (as-built + adopted deltas)

```
+-------------------------------------------------------+
|  SET 2/5 · 20 FT     ●●●●○○◌◌◌◌     [🔊][◉][sync ✓]   | <- context bar + NEW stack pips
|                      made/miss/left                    |    (delta 2)
+-------------------------------------------------------+
|                                                       |
|                                                       |
|              FLUID GESTURE ZONE                    ▐  | <- ▐ = right-edge swap drawer
|                                                    ▐  |    handle (delta 3)
|          swipe ↑ MAKE   (territory grows)          ▐  |
|          swipe ↓ MISS                                 |
|          swipe ← UNDO                                 |
|          hold   RAPID-FIRE MAKES                      |
|                                                       |
|                                                       |
+-------------------------------------------------------+
|  BATCH RIBBON                                         |
|  [0][1][2][3][4][5][6][7][8][9][10]                   | <- shipped grid/carousel unchanged
+-------------------------------------------------------+

TAP MODE variant (delta 1, per-session toggle):
+-------------------------------------------------------+
|  context bar (unchanged)              [swipe|TAP]     |
+-------------------------------------------------------+
|                    MAKE                               | <- top zone, terracotta tint,
|                   ( 🎯 )                              |    whole-zone tap target
+-------------------------------------------------------+
|                    MISS                               | <- bottom zone, rust tint
|                   ( ✕ )                               |
+-------------------------------------------------------+
|  ← swipe left anywhere still = UNDO                   |
+-------------------------------------------------------+
```

### Pro Additions

1. **Stack pips as subitizable state.**
   *Why games & top apps use it:* humans count ≤5 objects pre-attentively (subitizing); rhythm games show
   remaining notes as objects, not numerals, for exactly this reason.
   *How we integrate it:* pips replace nothing — numerals stay for precision, pips add the glance layer.
2. **Input modes, one engine.**
   *Why games & top apps use it:* fighting games offer "simple controls" without forking game logic —
   input mapping changes, rules don't.
   *How we integrate it:* Tap Mode is an input-mapping branch feeding the identical
   classification-to-event pipeline; debounce, undo, haptics, audio, and data rules are untouched.

### Build Notes

- **REUSE (i.e., nearly everything):** `src/components/puttingCanvas/` (all 11 components),
  `src/lib/gestureEngine/` (`GESTURE_CONFIG`, `classifyGesture`), `src/lib/instantLaunch/` (FSM, storage,
  reducer, sync), `src/hooks/useGesturePointer.js`, `src/hooks/useInstantLaunchSession.js`.
- **NET-NEW (the three deltas, if accepted):** stack-pip row in `CanvasContextBar` (render-only);
  Tap Mode toggle + tap-zone variant of `GestureZone`; putter swap drawer + edge-swipe handle.
- **Dependencies:** swap drawer's *data* value requires `putt_events.putter_disc_id` (Screen 9's schema
  implication) and putter lineup (Screen 6). Stack pips and Tap Mode have zero dependencies.
- **Honesty notes:** deltas 1 and 3 are proposals awaiting accept/reject — the shipped canvas is complete
  and validated without them. Edge-swipe for the drawer must be angle-gated so it never collides with the
  ←UNDO cone (undo is a *leftward* swipe from anywhere; the drawer opens from a *right-edge start point*
  — start-position gating, not angle gating, is the disambiguator).

---

## Screen 9: Session Summary & Progress Report

**Role:** Putter breakdown matrix, distance drop-off curves, and 1-tap replay — the moment after the last
putt, turned from a score screen into a debrief that sells the next session.

Today a finished run shows a per-set summary inline and history detail lives on `HistoryDetailPage`. The
ideal: one unified **post-session report** — score with context, what changed since last time, where makes
decayed with distance, and a single tap to run it back.

### Visual & Typography Style Guide

- **Score hero:** total score in Oswald 700 48px+; delta vs regimen PB beneath ("▲ 120 vs best" in
  `#2B5F6C`; new PB = existing gold `pb-badge` treatment + one confetti burst).
- **Matrix table:** putters as rows, distance bands as columns; cells show make % with Wilson-band
  shading (existing confidence-map zone colors); sparse cells render "—", never fake precision.
- **Drop-off curve:** simple SVG line — make % (y) by distance band (x), points sized by attempts, CI
  whiskers when n < 30 (existing Wilson discipline).
- **Replay CTA:** full-width terracotta button in the bottom thumb zone; secondary actions (notes/tags,
  share, done) as quiet links above it.

### Structural Wireframe / Layout Blueprint

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  SESSION COMPLETE                       [ DONE ]      |
+-------------------------------------------------------+
|                                                       |
|                    1,840                              | <- Oswald 700, huge
|              LEVEL 3 REGIMEN                          |
|          ▲ 120 vs your best   [🏆 NEW PB]             | <- PB logic already shipped
|                                                       |
|  BY SET                                               |
|  S1 15ft ██████████ 10/10  clean ✓   320 pts          | <- existing per-set summary rows
|  S2 20ft ████████░░  8/10            410 pts          |
|  S3 25ft ██████░░░░  6/10  pressure ✓ 380 pts         |
|                                                       |
|  DROP-OFF                                             |
|  100%|·__                                             |
|      |   ``--.__                                      | <- make% by distance, CI whiskers
|   50%|          ``--·                                 |    when n < 30
|      +----+----+----+----                             |
|      15   20   25   30 ft                             |
|                                                       |
|  BY PUTTER                    15ft   20ft   25ft      |
|  ★ Luna "Moneymaker"          95%    80%    60%       | <- putter matrix (needs schema
|  ② Envy (swapped in, set 3)    —      —     70%       |    implication below)
|                                                       |
|  [ + add notes/tags ]                                 | <- existing NotesTagsEditor
|=================== BOTTOM 40% ZONE ===================|
|  +-------------------------------------------------+  |
|  |            ↻  RUN IT BACK                       |  | <- 1-tap replay, same config
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

### Interaction Flow

1. Rendered automatically at `endSession` (replacing the run page's inline summary phase) AND reachable
   later as the enriched `HistoryDetailPage` — one report component, two entry points, so past sessions
   get the same debrief.
2. RUN IT BACK re-launches via the InstantLaunch payload with the identical config (regimen id or
   freeform distances, putter, diagnostic mode) — the crash-recovery machinery already proves configs are
   re-launchable; replay is that path minus the crash.
3. Drop-off curve computes from this session's `putt_events` when they exist (gesture-mode sessions) and
   falls back to summary rows by distance; mixed sessions render both honestly (events for gestured
   stages, summary elsewhere).
4. Notes/tags inline via the existing editor; DONE returns to the Hub, which now reflects the fresh
   streak/volume.

### Pro Additions

1. **Debrief sells the next session.**
   *Why games & top apps use it:* post-match screens (Fortnite, chess.com) exist to convert emotion into
   the next queue; the single most valuable pixel is the requeue button.
   *How we integrate it:* RUN IT BACK is the primary CTA on every summary; Hub's UP NEXT card also
   updates from this session immediately.
2. **Matrix cells that admit ignorance.**
   *Why games & top apps use it:* trust in stats comes from visible honesty; showing 100% off 2 putts
   destroys it.
   *How we integrate it:* Wilson bands and n-thresholds are already house discipline (`wilson.js`,
   CLAUDE.md insight rules) — the matrix inherits them (shaded confidence, "—" under minimum n).
3. **One report, two doors.**
   *Why games & top apps use it:* players re-read reports (Strava activities get revisited); a summary
   that differs from history detail creates two half-truths.
   *How we integrate it:* the report is one component consuming a session/run id, mounted post-session
   and from history.

### Build Notes

- **REUSE:** `src/pages/HistoryDetailPage.jsx` (per-set/per-distance rows, `NotesTagsEditor` — evolves
  into/hosts the report), `RegimenRunPage`'s summary phase (replaced by the report), `src/lib/insights/`
  (`wilsonInterval`, `pbs.js` PB rules, zone colors from confidence map), `src/lib/history.js` fetchers,
  InstantLaunch payload (replay), `putt_events` capture (drop-off + matrix data source).
- **NET-NEW:** unified `SessionReport` component; putter-matrix component; drop-off SVG; replay wiring;
  first read-path over `putt_events` (per-session query — new but trivial: by parent id).
- **Dependencies / schema implication (NOT built this phase):** the putter matrix needs per-event putter
  attribution — **proposal: nullable `putter_disc_id` FK on `putt_events`** (append-only schema file +
  manual DB backup, per convention). Until then the matrix has exactly one row (session-level putter from
  the launch payload) — shippable but thin; multi-row value arrives with the column + Screen 8's swap
  drawer.
- **Honesty notes:** batch-ribbon-only sessions have no `putt_events`, so the drop-off curve degrades to
  summary-table granularity (per-distance-log, no within-set sequence) — the data-split rule is a feature;
  the report must never synthesize events (house rule). PB confetti fires only on the rules already
  shipped in `pbs.js` (≥10-attempt distance PBs, best-total regimen PBs).

---

## Screen 10: Global Analytics & Offline Settings

**Role:** Time-series accuracy charts, local database sync controls, and data portability — the app's
long-memory view and its trust surface: *your form over months, and proof your data is yours.*

The `ConfidenceMapPage` at `/practice/stats` is the seed. It grows into a scrollable analytics home
(trend first, map second, fingerprints third), while settings — sync, storage, export — live on the
Profile tab, keeping the stats screen purely about putting.

### Visual & Typography Style Guide

- **Trend chart:** full-width SVG line of decay-weighted form over time on `#E2DED4`; line 3px
  `#2B5F6C`; lifetime baseline as a dashed `#C8C0B0` rule; time-range chips (30D / 90D / ALL) in the
  segmented-control language.
- **Panel stack:** each analytics block is a bordered card with an Oswald 600 caps title and a one-line
  plain-language takeaway ("You make 9% more in the morning") above the visualization.
- **Settings rows:** standard list rows, 2px dividers; destructive actions (clear local data) in
  `#8C2D19` with a hold-to-confirm interaction, never a bare tap.
- **Sync ledger:** monospace-adjacent numeric alignment for counts; status pill reuses the canvas
  sync-pill vocabulary (✓ synced / ⟳ pending / ⚠ error).

### Structural Wireframe / Layout Blueprint

```
ANALYTICS (evolved /practice/stats)
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
|  ← PRACTICE            YOUR NUMBERS                   |
+-------------------------------------------------------+
|  FORM OVER TIME              [30D] [90D] [ALL]        |
|  +-------------------------------------------------+  |
|  | 80%|      _   __/\_/¯¯\__/\                     |  | <- decay-weighted form,
|  |    |  _/\/ \_/            \_/¯                  |  |    windowed over time
|  | 60%|_/_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ lifetime    |  | <- dashed lifetime baseline
|  |    +---------------------------------           |  |
|  |     Apr        May        Jun        Jul        |  |
|  +-------------------------------------------------+  |
|  "Trending up 4% this month."                         | <- plain-language takeaway
|                                                       |
|  CONFIDENCE MAP                                       |
|  ( existing band list: lock-in / coin-flip /          | <- ConfidenceMapPage content,
|    developing, Wilson interval bars )                 |    embedded as a panel
|                                                       |
|  FINGERPRINTS                                         |
|  ☀ Time of day    | 🗓 Rest days   | 😮‍💨 Fatigue      | <- cadence/fatigue/pressure
|  ( existing insight rows, promoted from History )     |    insights as tappable panels
+-------------------------------------------------------+

SETTINGS (new section on /profile)
+-------------------------------------------------------+
|  DATA & SYNC                                          |
|  Sync status                    [ ✓ all synced ]      | <- instantLaunch outbox state
|  Pending writes                 0                     |
|  Last successful sync           2 min ago             |
|  [ Retry sync now ]                                   | <- existing retrySync()
|                                                       |
|  YOUR DATA                                            |
|  [ ⬇ EXPORT ALL DATA (CSV) ]                          | <- sessions, runs, sets, logs,
|     "Everything you've logged. Yours."                |    putt_events — zipped CSVs
|                                                       |
|  LOCAL STORAGE                                        |
|  On-device session buffer       2.1 KB                |
|  [ Clear local data ]  (hold to confirm)              | <- blocked while writes pending
+-------------------------------------------------------+
```

### Interaction Flow

1. Analytics: `/practice/stats` becomes a panel stack — trend (new), confidence map (existing content,
   now a panel), fingerprints (existing insight computations, promoted from History's panel into
   tappable cards). History keeps its compact insights strip; this is the expanded home.
2. Trend series = `decayWeightedForm` evaluated at weekly checkpoints over the selected range (pure
   function over `allPuttSamples` — new windowing wrapper in `lib/insights/`, unit-tested like its
   siblings).
3. Export: client-side CSV generation from the user's own rows (one file per table; zipped), filename
   `discgolf-export-YYYY-MM-DD.zip`. Doubles as the UDisc-importer rehearsal committed in
   DEVELOPMENT_PLAN's future cycle.
4. Clear-local-data wipes the InstantLaunch buffer only (never server data), refuses while the outbox
   has pending writes, and states exactly that.

### Pro Additions

1. **Takeaway-first analytics.**
   *Why games & top apps use it:* Whoop/Strava lead every chart with a sentence because most users read
   the sentence and trust the chart exists.
   *How we integrate it:* every panel's takeaway is a pure function output (testable, honest, and
   respecting the ≥-pattern intervention threshold from house rules — no single-event narratives).
2. **Data portability as loyalty.**
   *Why games & top apps use it:* export builds the trust that ends up *retaining* users (own-your-data
   is a stated project value) — and it forces our own data model to be externally legible.
   *How we integrate it:* full CSV export now; its column layouts become the reference when the UDisc
   importer lands (rehearsal effect, already noted in DEVELOPMENT_PLAN).
3. **Sync you can see.**
   *Why games & top apps use it:* offline-first apps live or die on trust in the buffer; a visible ledger
   ("0 pending, synced 2 min ago") converts anxiety into confidence.
   *How we integrate it:* the settings panel reads the same outbox state the canvas sync pill uses —
   one source of truth, two renderings.

### Build Notes

- **REUSE:** `src/pages/ConfidenceMapPage.jsx` (embedded panel), `src/lib/insights/` —
  `decayWeightedForm` (trend), `confidenceMap`, `cadenceFingerprint`, `fatigueCurve`,
  `pressureDifferential`, `wilsonInterval`; `src/lib/history.js` (`allPuttSamples`,
  `distanceSamples`); InstantLaunch outbox state + `retrySync` (sync ledger); `src/pages/ProfilePage.jsx`
  (hosts the settings section); sync-pill vocabulary from `CanvasContextBar`.
- **NET-NEW:** trend-series windowing function in `lib/insights/` (unit-tested); trend SVG + range chips;
  panel-stack layout; settings section (sync ledger, export, local-storage controls); CSV export module
  (client-side; no server changes).
- **Dependencies:** none hard. Export includes `putt_events` as captured (sparse by design). No schema
  changes.
- **Honesty notes:** "local database sync controls" (source one-liner) maps to the InstantLaunch
  localStorage buffer — there is no local *database* (that was explicitly scoped out of 1D's PWA
  baseline; app-shell caching only). The spec says what's true: buffer, outbox, sync — not "offline
  database." Takeaway sentences must go silent (render nothing) below the same n-thresholds the
  confidence map uses — a takeaway with n=4 is a lie with good typography.

---

## Cross-screen schema implications (consolidated)

None of these are built in Phase 1. Each is an append-only schema file + manual DB backup when its
build session arrives (per CLAUDE.md conventions):

| Implication | Proposed home | Demanded by |
|---|---|---|
| `primary_putter_disc_id` / `backup_putter_disc_id` (nullable FKs) | `profiles` | Screen 6 lineup; Screen 8 swap drawer; Screen 9 matrix |
| `wear` numeric 0–10 (freetext `condition` retained) | `discs` | Screen 6 wear slider |
| `putter_disc_id` (nullable FK) | `putt_events` | Screen 9 putter matrix; Screen 8 swap drawer data story |
| `created_by`, `drill_type`, `rules_config` jsonb (+ versioning rule) | `putting_regimens` (Track 2.3 design pass, Opus 4.8) | Screen 7 builder |

## Suggested build order (post-approval; Phase 2 front-door slice remains first)

1. **Screen 3** (with Phase 2's splash/auth — the committed front-door slice)
2. **Screen 4** (pure composition of shipped functions — one-session win)
3. **Screen 8 deltas** (stack pips + Tap Mode are cheap; swap drawer waits for putter schema)
4. **Screen 9** (report component; matrix thin until `putter_disc_id` lands)
5. **Screen 5** (hub shell + catalog tab)
6. **Screen 6** (lineup + curve + wear; carries the profile/discs schema file)
7. **Screen 10** (analytics + settings + export)
8. **Screen 7** (after the Track 2.3 schema design pass)

