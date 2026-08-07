# Design Review Brief — Claude Design screens

Last updated: 2026-08-07

Handoff brief for reviewing the **Claude Design** screen set against this project's intended features,
styling guide, and UX expectations. Written because the Claude Design project cannot be read from a
`claude.ai/code` web session (see § Access), so the review runs in the session that Claude Design's
"Send to Claude Code Web" opens — a fresh session with no accumulated context.

**Read this file first.** § Do not report these contains eight decisions that look like defects and are
not. Reviewing without them produces a report that is mostly false positives.

## Access

`DesignSync` reads claude.ai/design projects through the claude.ai login's **design-system scope**. A
web session's OAuth grant does not include that scope, and the only way to add it — `/design-login` —
requires an interactive terminal, which web sessions do not have. Verified dead ends: the session token
is a host-managed file descriptor that cannot be re-scoped, `/root/.claude/` holds no credential store
with design scopes, the egress proxy is healthy (so this is authorization and not network), and two
`list_projects` calls returned the identical authorization error with no pending permission prompt.

Two paths that do work:

1. **Send to Claude Code Web** from Claude Design — seeds the project files into a *new* session's
   workspace. That session must also attach this repo (`ItsRyanFromAtlanta/disc-golf-app`, branch
   `claude/design-screens-ux-review-cfn0c0`) to cross-check against the specs.
2. **Run `/design-login` once** in the CLI or desktop app to grant design scope to the login.

## Review scope

Confirm with the owner before starting: **every screen in the design project, or only the subset
"included in the latest tests."** This repo cannot answer that — its ~40 vitest files are all
logic-level, there is no screenshot or browser baseline, and building one is still-open work
(`CURRENT_WORK.md` staged action 6). The tested subset is only knowable from the design side.

## Sources of truth

| Question | Authority |
|---|---|
| What a screen is supposed to do | `SCREEN_SPECS.md` (per-screen), `MASTER_PROJECT_BLUEPRINT.md` (full wireframes) |
| How it is supposed to look | `AGENTS.md` § Design system |
| What shipped | `src/pages/` (32 pages), `src/components/`, `src/lib/routeMetadata.js` |
| Why something diverges | `SCREEN_SPECS.md` § Standing divergences, mirrored below |
| Current phase and open items | `docs/development/CURRENT_WORK.md`, `PRODUCT_ROADMAP.md` |

Where `SCREEN_SPECS.md` and `MASTER_PROJECT_BLUEPRINT.md` disagree, **`SCREEN_SPECS.md` wins** — it is
the integration layer that records decisions made after the blueprint was absorbed.

## Styling guide — "Sun-Drenched Topo" (Oswald edition)

From `AGENTS.md`. High-luminance warm earth palette, built to stay legible in direct sunlight. These
tokens are exact; treat any other value as a divergence to report.

| Role | Token | Value |
|---|---|---|
| Background primary | warm sand | `#F4F1EA` |
| Background surface | desert clay | `#E2DED4` |
| Background surface_alt | deep sand | `#D6CEBF` |
| Text primary | deep slate | `#1A1D1A` |
| Text secondary | muted slate | `#4A524A` |
| Text inverse | — | `#F4F1EA` |
| Positive / Make | burnt terracotta | `#CC4E3C` |
| Secondary accent | canyon blue | `#2B5F6C` |
| Negative / Miss | deep rust | `#8C2D19` |
| Highlight | sunburst orange | `#E87A30` |
| Border default | — | `#C8C0B0` |
| Border focus | — | `#1A1D1A` |

Hard rules, each independently checkable:

- **No pure black (`#000`) or pure white (`#FFF`) anywhere.**
- **No default platform grays or blues** — every neutral comes from the token set above.
- **Borders 2px minimum.**
- **Oswald** (condensed, high-impact), self-hosted and preloaded — not a webfont CDN, not a fallback stack.

## Field-use rules — the sharpest UX tests in the guide

These are the ones most likely to be violated by a design that looks good on a desktop canvas. Grade
every screen against them explicitly.

- **Minimum 80pt tap targets on primary actions.** Note that the blueprint's own primitive is named
  `TouchTarget48`; where a design uses 48 for a *primary* action, that is a real conflict worth
  surfacing, not a rounding difference.
- **One-thumb operability on active-practice screens** — Scoring Canvas (8) and Regimen Run above all.
  Reachability matters, not just target size: primary actions belong in the bottom thumb arc, not the
  top corners.
- **TTFP (time-to-first-putt) < 5s from cold start, with no network gating before the start button.**
  Any splash, auth check, sync spinner, or data fetch that blocks the start button is a defect.

## Screen inventory

In scope, by execution layer:

| # | Screen | Layer |
|---|---|---|
| 1 | Welcome Landing | 2 |
| 2 | Account Authentication & Recovery | 2 |
| 3 | Zero-Typing Onboarding Wizard | 2 |
| 4 | Main Dashboard Hub | 3 |
| 5 | Unified Bag Management & Disc Universe | 3 |
| 6 | Putter Lineup Manager & Flight Curve Editor | 3 |
| 7 | Custom Routine Builder | 4 |
| 8 | Rapid-Fire Scoring Canvas & Mid-Round Swaps | 4 |
| 9 | Session Summary & Progress Report | 4 |
| 10 | Global Analytics & Settings Control Tower | 5 |
| 11 | Player Career Hub | 5 |
| 12 | Trophy Room & Social Gamification Hub (**minus bag-tag/QR**) | 5 |
| 13 | Frictionless UDisc Ingestion Center | 5 |

**Parked — absence is deliberate, do not report as a gap:** 14 Course Practice Hubs & Leaderboards,
15 Putting League Bracket Manager, 16 Smartwatch Companion, 17 Pro-Shop & Gear Discovery,
18 Offline Sync & Conflict Resolution Center, 19 Privacy & Data Sovereignty Hub, 20 Firmware & Sensor
Diagnostics, 21 Emergency Panic Recovery Overlay. Reasons are in `SCREEN_SPECS.md` § Parked screens.
If a design screen covers parked territory, that is a **scope question for the owner**, not a defect.

## Do not report these

Eight standing divergences from the blueprint, decided once and applying everywhere. A design matching
the blueprint instead of this list is the *design* being stale, not the app being wrong.

1. **Stack is React + Vite (JSX)** — not Expo / React Native / NativeWind. Blueprint UI primitives
   (`OswaldText`, `TouchTarget48`, `SegmentedGridChip`, `OtpInputGrid`, `HapticTestPad`) are plain React
   components on the CSS-variable theme system. No Tailwind.
2. **Offline is staged Dexie + TanStack Query**, not a big-bang local-first rewrite.
   `src/lib/instantLaunch/` folds in last.
3. **Schema is append-only additive** on the existing Supabase schema — not the blueprint's from-scratch
   8-table design. Disc molds stay a shared FK catalog (`disc_molds`); the blueprint's freetext
   `brand`/`mold` columns are a regression and are not adopted.
4. **OTP is email, 6-digit** — the UI renders **6 blocks, not the blueprint's 4**. Guest mode is
   Supabase anonymous sign-in that survives device loss and converts via `linkIdentity`.
5. **Navigation is PLAY / DISCS / COURSES / ME** — four tabs. The standalone **Stats tab is obsolete**:
   player-wide summaries live in ME; disc/bag/routine/session/course stats live with their subject.
6. **Both interlocks are hard** — 100-putt routine ceiling and 35-disc bag capacity, each enforced
   app-side *and* with a DB `CHECK`. A design that lets either be exceeded is a real defect.
7. **PDGA number is manual entry** via zero-typing numeric keypad. The scraper Edge Function is
   deferred (no official public API; scraping is ToS-gray).
8. **Bag tags / QR Beam / P2P are parked** with the Social module wherever they appear inside an
   in-scope screen. Screen 12 ships without them.

Also not defects: **catalog ingestion is scrapped** (2026-07-13, do not propose rebuilding a scraper —
`disc_molds` is populated manually by the owner), and the B1.5 catalog foundation tables are retained
and distinct from that pipeline.

## What the review should produce

Three passes, kept separate so the owner can act on them independently.

**Pass 1 — feature accuracy.** Per screen: does it carry the elements `SCREEN_SPECS.md` requires? Flag
missing elements, elements with no spec basis, and anything contradicting a § Do not report decision.

**Pass 2 — styling accuracy.** Per screen: off-token colors (with the actual value found and the token
it should be), pure `#000`/`#FFF`, platform grays/blues, sub-2px borders, non-Oswald or non-self-hosted
type. Cite specific values, not impressions.

**Pass 3 — user experience.** The substance of the request, and where judgment matters most:

- **Natural usage flow** — does the primary path (cold start → practice → summary) hold together, and
  does each screen make its next action obvious?
- **Friction points** — taps required per common task, typing where zero-typing is promised, dead ends,
  modal traps, anything gating the start button.
- **Ease of use in the field** — one-thumb reach, 80pt primary targets, glove/sunlight legibility,
  one-handed operability while holding discs.
- **Information hierarchy** — is the one thing that matters per screen visually dominant?
- **Error, empty, and offline states** — first-run empty states, capacity-limit messaging at the 100-putt
  and 35-disc interlocks, offline behavior and sync feedback.
- **Consistency across screens** — repeated patterns behaving the same way everywhere.

For each finding give: screen, what is wrong, why it matters to a player mid-round, and a concrete fix.
Rank by user impact. Separate **defects** (violates a stated rule) from **judgment calls** (defensible
either way) so the owner can tell which findings are arguable.
