# Corrections log — state citations

Conformance cells in `docs/ui/STATE_MATRIX.md` § 4 that were left `?` (unverified) and that a screen
document's reading of the page component now resolves. Verified against `7351964` on branch
`claude/ui-documents-status-3fphcw` (2026-07-29).

Per `docs/ui/README.md` § `_corrections/` and `TEMPLATE.md` rule 5, these are **recorded, not applied** —
`STATE_MATRIX.md` was not edited. Each entry names the cell, the resolution, and the code evidence, so
the matrix can be updated in one pass by whoever owns it.

These are not contradictions. `STATE_MATRIX.md` § 4's method statement is explicit that `?` means
"unverified, not absent", and invites exactly this kind of follow-up. Nothing below disputes a cell the
matrix marked ✅, ⚠️, ❌, or ➖.

---

## SC-1 — `regimen-active` / `S-EMPTY`: `?` resolves to ➖

**Cell:** `STATE_MATRIX.md` § 4, PLAY table, `regimen-active` row — currently `? sub-components`.

**Resolution:** **➖ — not applicable.** `RegimenRunPage` has no collection whose emptiness it could
report, and neither do the sub-components that render inside it.

**Evidence:**

- `src/pages/RegimenRunPage.jsx` contains **no** `length === 0` branch, no `.empty-state`, and no
  empty-copy string anywhere in the file. Its only early return of that family is
  `S-LOAD` at `:319`, followed by `S-ERR-BLOCK` at `:320`.
- The sub-components the `?` was hedging against render `S-INSUFFICIENT`, not `S-EMPTY`:
  - `src/components/puttingCanvas/GhostPaceCard.jsx:13` returns `null` outright when there is no ghost
    profile — no empty state — and otherwise renders
    `{n} more real-time attempt(s) to compare.`, which is the below-minimum-sample treatment
    `S-INSUFFICIENT` already catalogues.
  - `src/components/sessionReport/SessionReport.jsx:132` renders `no baseline yet`, likewise already
    listed under `S-INSUFFICIENT`.
  - `src/components/sessionReport/CelebrationOverlay.jsx:6` returns `null` for an empty event list.
- The report's `Breakdown` heading renders unconditionally over a possibly-empty list
  (`SessionReport.jsx:141-154`), which is a missing empty state rather than a present one; it is recorded
  as a rough edge in `screens/practice-history-detail.md` § 6 and is not an `S-EMPTY` implementation.

**Recorded in:** `screens/regimen-active.md` § 6, Error path.

**Consequence if applied:** the PLAY table's `S-EMPTY` column would read ➖ for `regimen-active`, and the
"18 of 32 components" count in § 4 Counts is unaffected — ➖ is not a denominator member the way ❌ is.

---

## SC-2 — `onboarding` / `S-ERR-INLINE`: `?` resolves to ✅

**Cell:** `STATE_MATRIX.md` § 4, Pre-shell table, `onboarding` row — currently `? per step component`.

**Resolution:** **✅ — implemented on every step that makes a call.**

**Evidence:** `src/components/onboarding/PutterStep.jsx:118` (catalog load failure), `:139` (provisioning
failure), and `src/components/onboarding/CalibrationStep.jsx:56` each render `.form-error` beside content
that remains usable. `GoalStep` makes no call and therefore has no error path. No step early-returns an
error as its whole body, so `onboarding` contributes no `S-ERR-BLOCK` instance.

**Recorded in:** `screens/onboarding.md` § 6, Error path — which states the resolution in those terms.
Logged here so the resolution is discoverable from `_corrections/` rather than only from the screen
document.

---

## SC-3 — `onboarding` / `S-OFFLINE-READ`: the trailing `CalibrationStep ?` resolves to ➖

**Cell:** `STATE_MATRIX.md` § 4, Pre-shell table, `onboarding` row — currently
`⚠️ PutterStep uses cached catalogRepository; CalibrationStep ?`.

**Resolution:** the `PutterStep` half is correct as written. The `CalibrationStep` half is **➖ — not
applicable**, not unimplemented: the step performs no read at all. `usePuttHaptics` is a capability check
against `navigator.vibrate`, not a data fetch, and `GoalStep` reads only module constants.

**Recorded in:** `screens/onboarding.md` § 6, Offline path.

---

## Cells deliberately left alone

For completeness, so a later reader does not assume these were missed:

- `lost-found` / `S-LOAD`, `round-summary` / `S-SYNC` — outside the PLAY and pre-shell screen set this
  pass covered; not read, so still `?`.
- `regimen-active` / `S-INTERLOCK` is ➖ in the matrix and stays ➖. `S-INTERLOCK-ACTIVE` genuinely bears
  on the screen — gap § 5.1 names it — but it bears on it by being **absent from the UI entirely**, which
  the matrix already records in the row rather than in the grid.

---

## Citations declined

Places where a PLAY or pre-shell screen document could have cited a row and does not, because the screen
does not actually exhibit the state. Recorded so the omissions read as decisions rather than oversights.

| Screen | Row not cited | Why |
|---|---|---|
| `play-root` | `S-GUEST` | Cited only to say it is *not* observed. Per the row, `AuthPage` is its single consumer; `PracticeMenuPage` renders nothing differently for `is_anonymous`. |
| `play-root`, `regimen-select` | `S-CONFIRM` | `Sign out` is destructive and has no confirmation at all. There is no instance of the row to cite — the documents say so explicitly instead. |
| `freeform-active`, `regimen-select`, `routine-builder` | `S-ERR-BLOCK` | None of the three early-returns an error as its whole body; each is `S-ERR-INLINE` only. The matrix's `✅ none` cells were re-checked against `FreeformLogPage.jsx:491`, `RegimenSelectPage.jsx:55`, and `RoutineBuilderPage.jsx:111`. |
| `practice-stats` | `S-STALE`, `S-SYNC` | Nothing on the screen is cache-served and nothing is a local write awaiting sync, so neither row has an instance to diverge from. |
| `notifications` | `S-SYNC` | The screen is the *destination* for `S-SYNC-ATTENTION` notifications; it renders no sync badge of its own. |
| `routine-builder` | `S-OFFLINE-WRITE` | Cited only as absent. `createCustomRegimen` is a raw Supabase write with no outbox, so there is no queued-write state to describe. |
