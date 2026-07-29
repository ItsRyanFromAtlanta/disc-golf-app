# Corrections — state citations, DISCS / ME / COURSES

Found while adding `STATE_MATRIX.md` row citations to the twenty DISCS, ME, and COURSES screen
documents (`TEMPLATE.md` § 7). **Not applied.** `STATE_MATRIX.md` is not edited by this pass.

Scope: `discs-root`, `disc-collection`, `bag-manage`, `disc-compare`, `lost-found`, `disc-new`,
`disc-detail`, `me-root`, `profile-details`, `settings`, `goals`, `weekly-reports`, `trophy-room`,
`courses-root`, `courses-new`, `course-detail`, `rounds-root`, `round-start`, `round-scorecard`,
`round-summary`.

Companion to `_corrections/state-matrix.md` (C-1 … C-3), which this document does not duplicate.

---

## S-1 — `?` resolved: `lost-found` / `S-LOAD` is ❌, not merely unverified

**Where:** `STATE_MATRIX.md` § 4 DISCS grid, `lost-found` row, `S-LOAD` cell (`?`)

**Resolution:** ❌ — **the screen has no loading state at all.**

**Evidence:** `src/pages/LostFoundPage.jsx` declares no `loading` flag and takes no early return.
`discs`, `courses`, `cases`, and `updates` all initialize to `[]` (`:48-51`); the component renders its
full body on first paint. A repo grep for `loading` / `Loading` in the file returns nothing.

**Consequence, which is the reason this is worth filing rather than just ticking a cell:** the empty
state doubles as the loading state. During the initial read a user *with* cases sees
`No Lost & Found cases yet.` (`:194`). This is the same defect the matrix already records for
`NotificationsPage` under `S-EMPTY` ("indistinguishable from loading and from error"), so the pattern
has two instances, not one. `lost-found`'s is milder — `lostFoundRepository` is cache-backed, so the
window is short on a warm cache — but on a cold start it is the same false statement.

**Proposed edit:** set the cell to ❌ and add a parenthetical matching the `NotificationsPage`
treatment. The `S-EMPTY` row's instance list may also want `LostFoundPage.jsx:194` marked as
double-duty.

Recorded in `screens/lost-found.md` § 6, First run / empty.

---

## S-2 — `?` resolved: `round-summary` / `S-SYNC` is ⚠️, and it is a **sixth** vocabulary

**Where:** `STATE_MATRIX.md` § 4 COURSES grid, `round-summary` row, `S-SYNC` cell (`?`); and the
`S-SYNC` row itself, which enumerates five vocabularies; and § 4 Counts, "Distinct offline/sync copy
vocabularies | **5**"

**Resolution:** ⚠️ — and the count of five is an undercount.

**Evidence:** `src/pages/RoundSummaryPage.jsx:76` sets
`Round completed on this device; it will sync when you reconnect.`, rendered as
`<p className="form-info">{notice}</p>` at `:100`.

That string is not any of the five the row lists. It is closest to vocabulary (5),
`RoundScorecardPage.jsx:137` — `Saved on this device; it will retry when you reconnect.` — and differs
from it in three words, on the same screen family, through the same repository. It uses none of § 12's
four labels and its container reserves no layout space.

**Proposed edit:** set the cell to ⚠️ with `:76`; add the string to the `S-SYNC` row as vocabulary (6);
change the Counts figure from 5 to 6. The row's `contract-violation` verdict is unaffected — this
strengthens it.

Recorded in `screens/round-summary.md` § 6, Offline.

---

## S-3 — `S-SAVING` misreports `ProfilePage`: the guard exists, in `EditableSection`

**Where:** `STATE_MATRIX.md` § 2, `S-SAVING` row, current-behavior column: "**`ProfilePage` and
`SettingsPage` save without any in-flight guard** (`ProfilePage.jsx:28`, `SettingsPage.jsx:23,28,33` —
no `saving` state, no `disabled`)."

**Half right.** The `SettingsPage` half is correct and confirmed. The `ProfilePage` half is not.

**Evidence:** `ProfilePage.jsx:28` — `async function saveFields(fields)` — is indeed bare. But it is
never invoked directly. It is passed as the `onSave` prop to **all four** `EditableSection` instances on
the screen (`:62`, `:132`, `:201`, `:276`; the latter two wrap it in an arrow that reshapes the draft).
`EditableSection` owns the in-flight state: `save()` sets `saving` true, awaits `onSave(draft)`, and
clears it in a `finally` (`EditableSection.jsx:25-35`), while the rendered controls read
`{saving ? 'Saving...' : 'Save'}` with `disabled={saving}` on **both** Save and Cancel (`:53-56`).

So `profile-details` is an instance of the row's *correct* branch — "where a shared component owns the
form, this is correct" — not of its exception. The row's own sentence contains the answer; the
`ProfilePage.jsx:28` citation just points at the wrong layer.

**Why it matters:** the row escalates severity on this sentence (`cosmetic`, "rising to `data-risk` for
`SettingsPage` unguarded repeat submits"). An agent reading the sentence as written would open
`ProfilePage` to add a guard that is already there, and would likely add a second, competing one.

**Proposed edit:** drop `ProfilePage` and its `:28` citation from that sentence, leaving
`SettingsPage.jsx:23,28,33`. Optionally add `ProfilePage` to the row's list of correct
`EditableSection` consumers.

**Confirmed accurate for `SettingsPage`, recorded so nobody re-checks:** `saveProfile` (`:23`),
`toggleCategory` (`:28`), and `saveTimezone` (`:33`) are each invoked inline from an `onChange`/`onBlur`
handler (`:47`, `:48`, `:53`) with only `.catch((err) => setError(err.message))`. No `saving` state, no
`disabled`, no idempotency key. The `data-risk` rating stands.

Recorded in `screens/profile-details.md` § 6, Error; and `screens/settings.md` § 6, Offline.

---

## S-4 — `S-INTERLOCK-CAP` surveys three caps; this pass found six more

**Where:** `STATE_MATRIX.md` § 2, `S-INTERLOCK-CAP` row ("Three caps, three qualities of enforcement")

**Not an error** — the row does not claim to be exhaustive. Filed because six screen documents in this
pass each needed to cite the row for a ceiling it does not contain, and two of those ceilings fall
outside the row's `cosmetic` severity in a way a reader would not predict from it.

| Ceiling | Screen | Enforcement quality |
|---|---|---|
| `COMPARE_MAX` = 4 / `COMPARE_MIN` = 2 | `disc-compare`, `disc-collection` | Pre-empted **and** enforced **and** explained when it clamps. The best in the app. |
| One open Lost & Found case per disc | `lost-found` | Pre-empted (UI filters the `<select>`), enforced twice more (RPC + partial unique index). |
| Disc-creation quantity 1–10 | `disc-new` | Pre-empted (`<select>` offers 1–10) and enforced in a pure tested guard. |
| `MAX_LEVEL` = 50 | `trophy-room` | Reached passively; no control to disable, and the readout relabels correctly. |
| One active goal per type | `goals` | **Enforced server-side only, with zero app-side pre-emption.** Worse than any of the row's three. |
| Hole count 1–36, par 2–6 | `courses-new` | **Silently corrected, never enforced.** No disable, no message, no constraint. A fourth enforcement quality the row does not describe. |
| `fld-score` `min=1 max=20` | `round-scorecard` | **Advertised in the markup and enforced nowhere** — no `<form>`, no clamp, no `CHECK`. Out-of-range scores flow into `total_score`. |

The last three are the point. A reader who takes the row's `cosmetic` / "enforced, inconsistently
pre-empted" verdict as characterizing interlocks generally will be wrong about `courses-new` (which
mutates the user's input without telling them) and about `round-scorecard` (where the bound is a lie the
markup tells and nothing catches).

**Proposed edit:** either widen the row to a short table, or add one sentence stating that it surveys
the three caps named in `SCREEN_SPECS.md` standing divergence #6 and is not an inventory. The second is
cheaper and sufficient.

Recorded in the Interlock path of `screens/disc-compare.md`, `screens/lost-found.md`,
`screens/disc-new.md`, `screens/trophy-room.md`, `screens/goals.md`, `screens/courses-new.md`, and
`screens/round-scorecard.md`.

---

## S-5 — `S-INTERLOCK-ACTIVE`'s screen list omits `round-start`, where the confirmation is owed

**Where:** `STATE_MATRIX.md` § 5 gap 1, "**Screens affected:** `play-root`, `freeform-active`,
`regimen-active`, `round-scorecard`, `practice-history`."

**Reality:** `round-start` is where a round is started, and it is on the affected list by any reading of
§ 11 ("Starting while a round is active/paused requires confirmation…"). It is absent.

**And the mechanism differs from the row's finding, which matters for the fix.** The row's diagnosis is
that the confirmation flow is fully built in the repository and never reaches a screen — the UI layer
drops it. On this path the repository never reaches for it:
`roundRepository.ensureRoundActivity` (`src/lib/repository/roundRepository.js:145-158`) calls
`activityRepository.getActive(userId)` **first**, and invokes `activityRepository.start` only when
nothing is active. When an activity *is* live, the `start` call is skipped entirely — so
`planActivityStart`'s `round_confirmation_required` and the `confirmRoundReplacement` flag are never
evaluated, and the round's lifecycle parent is deliberately left as a `draft`. The code says so
explicitly at `:141-144`: "J1 keeps that decision out of the round form."

The user-visible outcome matches the row (no dialog, and a round whose parent never starts), but the
repair is different: `play-root` and the capture screens need the UI to *consume* an outcome the
repository already returns, whereas `round-start` needs the repository call to be made at all.

**Proposed edit:** add `round-start` to gap 1's screen list, with a clause distinguishing the
deliberately-skipped-call case from the discarded-outcome case.

Recorded in `screens/round-start.md` § 6, Interlock.

---

## Verified accurate (recorded so nobody re-checks)

Confirmed against the code while citing them; no correction needed:

- `S-ERR-BLOCK`'s guarded/unguarded split, and the row's naming of the six guarded pages. All six fall
  inside this pass and all six check out: `disc-collection` (`:128`), `bag-manage` (`:180`),
  `disc-compare` (`:105`), `disc-detail` (`:99`), `courses-root` (`:24`), `rounds-root` (`:45`).
  The guard is absent on `discs-root` (`BagPage.jsx:84`), `me-root` (`:20`),
  `profile-details` (`:33`), `settings` (`:39`), `trophy-room` (`:57`), `course-detail` (`:27`),
  `round-scorecard` (`:144`), `round-summary` (`:86`). The row's counts hold.
- `S-EMPTY`'s "four use the shared `.empty-state` block." All four are in this pass's COURSES set —
  `CoursesPage.jsx:46,78`, `CourseDetailPage.jsx:49`, `RoundsPage.jsx:61`, `RoundStartPage.jsx:131`.
  No DISCS or ME screen uses it.
- `S-STALE`'s "exactly one screen tells the user they are looking at cache." Confirmed:
  `RoundsPage.jsx:58`. No other screen in the twenty has any cached-data notice.
- `S-CONFIRM-PHRASE`'s single instance. Confirmed at `settings` via `DeleteAccountPanel`; no other
  screen in the twenty uses a typed-phrase gate.
- C-9 ADJUDICATION (`_corrections/capture-screens.md`) is the position cited for `S-INTERLOCK-CAP`
  throughout the DISCS documents: `enforce_bag_capacity()` is a `before insert` trigger on `bag_discs`
  and does enforce the 35 ceiling on every insert. `discs-screens.md` D-1's "no constraint of any kind"
  and "a bag can exceed 35" claims are **not** cited anywhere in this pass. `discs-root.md` § 6 and
  `bag-manage.md` § 6 carry inline amendments to that effect; neither deletes the original text.

---

## Declined to cite

Places where a row was considered and left uncited, because the screen does not exhibit the state and
`TEMPLATE.md` § 7's requirement is to cite, not to decorate:

- **`S-GHOST` on `bag-manage`.** The screen has ghost *slots*, which is `S-GHOST-SLOT` — a different
  concept the matrix explicitly warns not to conflate. `bag-manage`'s removed slots are `removed_at`
  tombstones with no `.history-row-ghost` treatment and no restore UI, so neither row describes them.
  The existing prose stands unchanged.
- **`S-INCOMPLETE` on `round-scorecard`.** The row names `round-summary` among its affected screens and
  not the scorecard, and nothing in `RoundScorecardPage` reads `round.status` or `needs_review` — which
  is itself already recorded in that document as a separate finding. Citing the row there would imply a
  rendering path that does not exist.
- **`S-TOAST` anywhere in the twenty.** No screen in this set attempts a toast, so there is nothing to
  measure against the inert `ToastHost`. The row is shell-level and the finding is already C-1.
- **`S-RECOVERY`, `S-PAUSE`, `S-UPDATE`, `S-GUEST` as a per-screen state.** All shell- or capture-scoped.
  `S-GUEST` is cited in four documents only as the *absence* of a guest branch, which is what the row
  itself concludes.
