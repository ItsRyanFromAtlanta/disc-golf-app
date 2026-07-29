# 0001 — Live round scoring interaction model
Status: proposed
Date: 2026-07-29

## Context

`AGENTS.md` § Not yet decided lists "exact UI/UX flow for live round mode (chat interface vs structured
prompts)" as open. It has been open since before J1 shipped.

Meanwhile J1 shipped a working answer without the decision being recorded: `RoundScorecardPage.jsx` at
`/rounds/:roundId`, with `RoundStartPage` and `RoundSummaryPage` on either side, backed by
`src/lib/roundLog.js` and `src/lib/rounds.js` (`DEVELOPMENT_PLAN.md` § J1, shipped 2026-07-14). The
shipped model is a structured per-hole scorecard.

E2 — the next work item — is "audit and harden the existing course/layout and offline round routes
rather than rebuilding them" (`DEVELOPMENT_PLAN.md` § E2). Hardening a screen whose interaction model is
formally undecided is how a rebuild gets proposed halfway through. The screen documents for
`round-scorecard`, `round-start`, and `round-summary` cannot state a stable interaction contract until
this closes.

Two project constraints bear directly on it. Field ergonomics: primary field actions are at least 80pt,
every required gesture has a visible alternative, and a network failure never replaces active capture
with a full-screen error (`PHASE_A_ARCHITECTURE.md` § 12). And the zero-typing principle that runs
through onboarding, the routine builder, and PDGA entry — the app avoids keyboards on purpose.

## Decision

**Recommended, not yet accepted.** Option C below: keep the structured scorecard as the sole primary
capture surface, and admit conversational assistance only as a secondary bottom sheet, after E2.

## Consequences

If accepted as recommended:

- E2 hardens what exists; no rebuild of the round routes is in scope.
- The three round screen documents can be written against a stable model now.
- Any future caddie or narrative feature is additive and sheet-scoped, and cannot regress capture.
- `AGENTS.md` § Not yet decided loses one entry.

If deferred: the round screen documents carry a provisional interaction section, and E2 proceeds with a
known-unstable foundation under it.

## Alternatives considered

**A. Structured scorecard only, permanently.** Simplest and matches what shipped. Rejected as the stated
decision only because it forecloses the caddie concept the product name implies; the recommendation
keeps that door open without opening it now.

**B. Conversational/chat capture as primary.** A text-driven round log. Rejected: it requires a keyboard
in direct sunlight, one-handed, mid-round — contradicting the zero-typing principle and the 80pt
touch-target contract. It also has no offline story that matches the existing outbox model.

**C. Structured primary, conversational secondary (recommended).** The scorecard stays the capture
surface. A later caddie assistant lives in a bottom sheet alongside putter, weather, and notes, per the
one-sheet-at-a-time rule in `PHASE_A_ARCHITECTURE.md` § 12. Costs nothing now and preserves the option.

## Supersedes / superseded by

None. Closes the first entry under `AGENTS.md` § Not yet decided when accepted.
