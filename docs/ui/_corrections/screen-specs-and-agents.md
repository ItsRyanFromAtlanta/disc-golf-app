# Corrections — SCREEN_SPECS.md, AGENTS.md

Contradictions found while writing `docs/ui/`. **Not applied.** Each entry is a proposed edit to a root
document, to be reconciled in one reviewed commit.

Filed by the session that authored `TEMPLATE.md` and `screens/disc-detail.md`.

---

## C-1 — Screen 8 sign-off gate is stale

**Where:** `SCREEN_SPECS.md:233-241`

**Claims:** the split-screen tap vs gesture input decision is "flagged for explicit sign-off, not yet
built pending your read," and "**This is the one build decision in this batch that most changes shipped,
tested UI — confirm before Layer 4 starts.**"

**Reality:** decided and built. `DEVLOG.md:1635` records "Screen 8 input model (decided this session,
built next): split-screen MADE|MISSED tap becomes the primary scoring input; the shipped swipe-cone
`GestureZone` demotes to an opt-in 'gesture mode.'" `DEVLOG.md:1561-1571` logs `TapZone.jsx`,
`PanicZone.jsx`, and `StackTracker.jsx` shipping, wired into both `RegimenRunPage.jsx` and the freeform
path, with a Tap/Gesture/Panic mode `ChipGroup`.

**Proposed edit:** replace the pending-sign-off language with the decision and its date, keeping the
rationale. A future agent reading the current text will believe Layer 4 is blocked.

---

## C-2 — Screens 10 and 11 status contradicts the same file's own reconciliation note

**Where:** `SCREEN_SPECS.md:38-39` (status table) against `SCREEN_SPECS.md:14-18` (2026-07-11 note)

**Claims:** the table marks Screen 10 (Global Analytics & Settings Control Tower) and Screen 11 (Player
Career Hub) as `IN SCOPE`, Layer 5. The note eighteen lines above says they "no longer ship as
overlapping standalone destinations: their analytics/career content is distributed contextually, with ME
as the career-wide summary."

**Reality:** the note is correct. `CareerHubPage.jsx`, `ConfidenceMapPage.jsx`, `SettingsPage.jsx`, and
`ProfilePage.jsx` ship as separate surfaces under ME; no Control Tower exists.
`PRODUCT_ROADMAP.md:124-125` records the ME/Profile/Settings split as complete.

**Decision on file:** the roadmap note is authoritative (owner, 2026-07-29).

**Proposed edit:** change both rows to reflect distribution, referencing the note.

---

## C-3 — SCREEN_SPECS Screen 6 describes a page that was never built as one screen

**Where:** `SCREEN_SPECS.md:176-196`

**Claims:** Screen 6 maps onto `DiscDetailPage.jsx`, whose "details/overrides/bag-membership sections
extend rather than get replaced," gaining role swimlanes, a Bézier `FlightCurve`, a 1–10 wear slider, and
a 300-putt odometer alert that proposes a wear step-down.

**Reality:** the feature set shipped split across three surfaces. `PutterLineup.jsx` (role swimlanes,
wear slider) renders on `/bag` via `BagPage.jsx:132`. `FlightCurveOverlay` is consumed by
`DiscComparePage.jsx:197`. `DiscDetailPage.jsx` has none of them. The 300-putt threshold exists but in
`lib/discOdometer.js:9` as `COSMETIC_TIER_THRESHOLDS` — 300 chain hits unlocks a cosmetic `rare` tier,
not a wear adjustment. Retirement is an ordinary `status` select with no dedicated workflow.

**Proposed edit:** rewrite the Screen 6 entry to record the three-surface split, or mark it superseded by
`docs/ui/screens/disc-detail.md` plus a future `putter-lineup` section note. Full detail in
`docs/ui/screens/disc-detail.md` § 13.

---

## C-4 — `AGENTS.md` open questions are now ADRs

**Where:** `AGENTS.md:306-310`

**Claims:** three items remain undecided — live round mode UX flow, group/league v1 vs v2, and the
native GPS/camera Capacitor timeline.

**Reality:** all three now have `Proposed` ADRs with options and recommendations:
`docs/decisions/0001-live-round-interaction-model.md`, `0002-group-and-league-scope.md`, and
`0003-native-capability-timeline.md`.

**Proposed edit:** replace each bullet with a pointer to its ADR once the ADRs are accepted. Do not
remove the bullets while the ADRs are still `Proposed` — the questions are genuinely open until then.

---

## C-5 — `PHASE_A_ARCHITECTURE.md` § 13 canonical destinations read as contradicting the router

**Where:** `PHASE_A_ARCHITECTURE.md:206-208`

**Claims:** "Canonical destinations are `/play`, `/discs`, `/me`, their nested feature routes, and one
`/play/activity/:activityId` lifecycle/history destination."

**Reality:** the app serves `/practice`, `/bag`, `/profile`. This is **not** a defect — `routeMetadata.js`
carries a `section` field (`play`, `discs`, `courses`, `me`) and `resolveSectionRoot()` maps sections to
their real URLs, so the section vocabulary is canonical while the URLs are legacy. But no document says
so, and the text reads as a straightforward contradiction.

**Proposed edit:** one clarifying sentence in § 13 distinguishing section names from URL paths. Also note
that § 13 omits `courses`, which has been a shipped tab since 2026-07-14.

**Not a correction:** no code change is implied. Renaming the URLs would break saved links for no benefit.
