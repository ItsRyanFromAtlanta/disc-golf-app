# Corrections log — component library

Claims in existing repo docs that contradict the code as of **2026-07-29** on branch
`claude/ui-documents-status-3fphcw`.

Per the authoring brief for `docs/ui/COMPONENT_LIBRARY.md`, these are **recorded, not fixed** — no
file outside `docs/ui/` was edited. Each entry cites the doc line and the code evidence.

---

## 1. `SCREEN_SPECS.md:160` — BagPage does not contain a `FlightChart`

**Doc claim** (`SCREEN_SPECS.md:160`, Screen 5 REUSE list):

> - **REUSE:** `src/pages/BagPage.jsx` (MY BAGS tab content: switcher, disc list, `FlightChart`), …

The same bullet block also names `flightChartPoints` as a reusable helper
(`SCREEN_SPECS.md:164`).

**Code evidence:**

- `src/pages/BagPage.jsx:6` imports `FlightSpectrum`, not `FlightChart`, and renders it at
  `src/pages/BagPage.jsx:216`. There is no `FlightChart` import or usage anywhere in `src/pages/`.
- `src/components/FlightChart.jsx` has **zero importers** repo-wide — a search for the identifier
  `FlightChart` matches only its own definition file.
- Its data feeder `flightChartPoints()` (`src/lib/bags.js:64`) has no non-test caller; the only
  references are in `src/lib/bags.test.js:7,65,85`.

**Severity:** medium. An agent following this REUSE line would extend a dead component and a dead
helper instead of `FlightSpectrum` (`src/components/FlightSpectrum.jsx`), which is the shipped
bag-level chart and additionally handles clustering, ghost slots, and the Official/Current toggle.

**Suggested resolution (not applied):** either update the REUSE line to name `FlightSpectrum` /
`buildFlightSpectrum`, or delete `src/components/FlightChart.jsx` and `flightChartPoints` if the
older chart is genuinely retired.

---

## 2. `AGENTS.md:106` — the practice menu does not use `ModeCard`

**Doc claim** (`AGENTS.md:106`, § Practice menu design):

> - Card-list menu: each mode is a card with an icon (Tabler outline icons), title, one-line
>   description, and chevron. Cards are a reusable `ModeCard`-style component so adding a mode is a
>   one-line addition.

**Code evidence:**

- `src/components/ModeCard.jsx` exists and produces exactly that markup, but has **zero importers**
  repo-wide.
- `src/pages/PracticeMenuPage.jsx:239-244` hand-writes the same class names inline
  (`.mode-card`, `.mode-card-body`, `.mode-card-title`, `.mode-card-description`,
  `.mode-card-chevron`), drops the Tabler icon entirely, and substitutes a literal `›` character for
  the `IconChevronRight` the component renders.
- `src/pages/PracticeMenuPage.jsx` is the only page using the `.mode-card` class family at all.

**Severity:** low-to-medium. The rule the doc states (adding a mode is a one-line addition) is not
true of the current page, and the doc's hedged phrasing ("`ModeCard`-style") makes it ambiguous
whether the component or the CSS convention is the authority.

**Suggested resolution (not applied):** either migrate `PracticeMenuPage`'s inline card to
`ModeCard`, or restate the rule as a CSS convention and delete the unused component.

---

## 3. `DEVELOPMENT_PLAN.md:281` — the rounds flow does not reuse `DiscCard`

**Doc claim** (`DEVELOPMENT_PLAN.md:281`, item J1, whose Verify block at
`DEVELOPMENT_PLAN.md:284` is marked **Completed**):

> - **Reuse:** `fetchBags` for bag pick; `useDiscList`/`DiscCard` for per-hole disc; …

**Code evidence:**

- `useDiscList` was reused as planned — `src/pages/RoundScorecardPage.jsx:4,52`.
- `DiscCard` was not. `src/pages/RoundScorecardPage.jsx` contains no `DiscCard` import and no
  `disc-card` class usage. `src/components/DiscCard.jsx` is imported by exactly one file,
  `src/pages/BagLockerPage.jsx:10`.

**Severity:** low. The item is a shipped-work record rather than a forward instruction, but it
overstates `DiscCard`'s reach — an agent reading it would expect two consumers and find one.

---

## Checked and found accurate (no correction needed)

Recorded so a later reader does not re-verify these:

- `PHASE_A_ARCHITECTURE.md:86` — "`AppShell` owns `GlobalHeader`, `ScreenScrollRegion`, `SheetHost`,
  `ToastHost`, and `TabBar`." Confirmed at `src/components/AppShell.jsx:4-8`, all five rendered.
  (Caveat, not an error: `ToastHost` is rendered with a hardcoded `toast={null}` at
  `AppShell.jsx:123`, so it is owned but inert.)
- `FEATURE_BACKLOG.md:153` — "one SessionReport component, 3 entry points (History detail, regimen
  summary, new freeform summary)." Confirmed: imported by `src/pages/HistoryDetailPage.jsx:8`,
  `src/pages/RegimenRunPage.jsx:36`, `src/pages/FreeformLogPage.jsx:31`.
- `AGENTS.md:100-103` — app-level nav is PLAY / DISCS / COURSES / ME. Confirmed against the `TABS`
  constant at `src/components/TabBar.jsx:6-11`. (`DEVELOPMENT_PLAN.md:71` still reads
  "PLAY/DISCS/ME TabBar", but that is a dated A2 completion record and the COURSES addition is
  documented separately at `DEVELOPMENT_PLAN.md:279` — a chronology, not a contradiction.)
- `SCREEN_SPECS.md:251` — Screen 12 REUSE naming `NotesTagsEditor` via `HistoryDetailPage`.
  Confirmed transitively: `HistoryDetailPage` → `SessionReport` (`SessionReport.jsx:1`) →
  `NotesTagsEditor`.
