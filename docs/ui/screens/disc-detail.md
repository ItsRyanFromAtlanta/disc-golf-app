# Disc Detail

> **Reference document.** This is the worked example for `docs/ui/TEMPLATE.md`. Authors of other screen
> documents should read this one first to calibrate depth and tone.

| Field | Value |
|---|---|
| Route id | `disc-detail` |
| URL pattern | `/bag/discs/:discId` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Disc` |
| Activity pill | shown |
| Scroll key | `discs-detail` |
| Preserves nested state | no |
| Page component | `src/pages/DiscDetailPage.jsx` (387 lines) |
| Blueprint screen | Screen 6 — partial; see § 13 |
| Verified against | `eb9fd2b` |

## 1. Purpose

The full record of one owned disc: its identity, photos, throw odometer, effective flight numbers,
contextual performance, editable details and overrides, bag memberships, and shot tags. It is where a
player answers "what is this disc, and how has it actually performed for me."

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Disc card tap in the locker | `Link` from `/bag/locker` | Primary path |
| In | Disc row in bag contents | `Link` from `/bag` | |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; un-onboarded users are redirected by the `AppShell` onboarding gate before this route renders |
| Out | `Locker` link in page header | `Link` to `/bag/locker` | In-page, not the shell back control |
| Out | Lost & Found link | `Link` to `/bag/lost-found?disc=:discId` | Label switches on `disc.status === 'lost'` |
| Out | Shell back control | Header, shell-owned | Standard shell behavior |
| Out | Tab re-tap on DISCS | `TabBar` → `resolveSectionRoot('discs')` | Returns to `/bag` |

`preserveNestedState` is `false`, so scroll position is not restored on return.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Disc                              [activity pill]| <- Shell-owned header
+-------------------------------------------------------+
|  THUNDERBIRD                              [ Locker ]  | <- Page header, h1 = nickname||mold
|  Innova Thunderbird  ·  [in_locker]                   | <- Status badge, class varies
|  Report lost or view recovery history                 | <- Label flips when status = lost
+-------------------------------------------------------+
|  PHOTOS                                               |
|  [ front ]  [ back ]  [ flight plate ]                | <- DiscPhotoManager, slot-based
+-------------------------------------------------------+
|  ODOMETER                                             |
|  throws / chain hits / airballs    [ + ] [ reason ]   | <- DiscOdometerManager
|  Next milestone: 300 chain hits -> rare               |
+-------------------------------------------------------+
|  FLIGHT NUMBERS                                       |
|  +-----------+-------+-------+-------+-------+        |
|  |           | speed | glide | turn  | fade  |        |
|  | Effective |   9   |   5   |  -1   |   2   |        | <- override ?? stock ?? em-dash
|  | Stock     |   9   |   5   |  -1   |   2   |        |
|  +-----------+-------+-------+-------+-------+        |
+-------------------------------------------------------+
|  CONTEXTUAL PERFORMANCE                               | <- DiscProfileContext
|  Putting / rounds; "Insufficient data" when null      |
+-------------------------------------------------------+
|  DETAILS                                  [ Edit ]    | <- EditableSection, view/edit toggle
|  FLIGHT OVERRIDES                         [ Edit ]    | <- EditableSection
+-------------------------------------------------------+
|  BAG MEMBERSHIPS                                      |
|  Practice Stack (default)          [ Equipped ]       | <- chip toggle per bag
+-------------------------------------------------------+
|  SHOT TAGS                                            |
|  Assigned: utility, headwind                          |
|  [ utility ] [ headwind ] [ roller ]                  | <- chip toggle per tag
|  [ Custom shot tag..............] [ Add tag ]         | <- free-text, creates + assigns
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Disc", activity pill
Page header
  hdr-title ............ h1, disc.nickname || mold.mold_name || disc.mold
  hdr-locker ........... link to /bag/locker
Identity line
  id-mold .............. "<manufacturer> <mold_name>", falling back to disc fields
  id-status ............ status badge, class = zone-badge when in_locker else abandoned-badge
  id-lostfound ......... link to /bag/lost-found?disc=:discId
Error banner
  err-inline ........... rendered when error && disc loaded
Photos (DiscPhotoManager)
  photo-slot ........... one per DISC_PHOTO_SLOTS entry
Odometer (DiscOdometerManager)
  odo-metric ........... metric selector: throws | chain_hits | airballs
  odo-delta ............ numeric increment
  odo-reason ........... optional reason text
  odo-submit ........... records event
  odo-milestone ........ next cosmetic tier readout
Flight numbers
  flight-effective ..... row: override ?? stock ?? "—"
  flight-stock ......... row: mold values
Contextual performance (DiscProfileContext)
  ctx-putting .......... putting aggregates
  ctx-rounds ........... round aggregates
Details (EditableSection)
  det-view / det-edit .. nickname, plastic, weight_grams, color, condition, status,
                         acquired_on, provenance, notes
Flight overrides (EditableSection)
  ovr-axis ............. one numeric input per axis, step 0.5, placeholder = mold stock
Bag memberships
  bag-row .............. one per bag; chip toggles equip state
  bag-empty ............ "You don't have any bags yet."
Shot tags
  tag-assigned ......... comma-joined assigned labels, or "none"
  tag-chip ............. one per tag, toggles assignment
  tag-create ........... text input + submit; creates then immediately assigns
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-title` | h1 | nickname ‖ mold name ‖ raw mold | — | — | — | always |
| `hdr-locker` | link | `Locker` | default / pressed | navigate | `/bag/locker` | always |
| `id-status` | badge | `disc.status` value verbatim | `in_locker` styled `zone-badge`; all others `abandoned-badge` | — | — | always |
| `id-lostfound` | link | `View Lost & Found case` when status is `lost`, else `Report lost or view recovery history` | default / pressed | navigate | `/bag/lost-found?disc=:discId` | always |
| `err-inline` | banner | error message text | present / absent | — | — | shown when an error occurs after the disc has loaded |
| `photo-slot` | control | slot name, title-cased | empty / uploading / uploaded / recoverable | queue upload, delete, restore | `discPhotoRepository` | per slot |
| `odo-metric` | select | `throws`, `chain hits`, `airballs` | selected / unselected | set metric | local state | always |
| `odo-delta` | number | increment, default `1` | valid / invalid | set delta | local state | always |
| `odo-submit` | button | records the event | idle / saving | `recordDiscOdometerEvent` | `disc_odometer_events` | disabled while saving |
| `odo-milestone` | text | next cosmetic tier | present / at max | — | — | thresholds: rare 300, epic 1000, legendary 5000 |
| `flight-effective` | table row | per-axis value or `—` | — | — | — | `override ?? stock ?? null` |
| `det-edit` | form | 9 labelled fields, all with `htmlFor`/`id` pairs | view / editing / saving / error | `upsertDisc` | `discs` | edit opens on `Edit` |
| `det-status` | select | the four `STATUS_OPTIONS` | — | included in details save | `discs.status` | always |
| `ovr-axis` | number | one per speed/glide/turn/fade | empty means "mold stock" | `upsertDisc` | `discs.override_*` | step `0.5`, placeholder is the mold value |
| `bag-row` | chip | `Equipped` when a member, else `Equip` | member / non-member | `addDiscToBag` / `removeDiscFromBag` | `bag_discs` | always; see § 12 on capacity |
| `bag-empty` | text | `You don't have any bags yet.` | — | — | — | shown when the bag list is empty |
| `tag-chip` | chip | tag label | active / inactive | `assignShotTag` / `removeShotTagAssignment` | shot tag assignments | always |
| `tag-create` | form | placeholder `Custom shot tag` | idle / submitting | `createShotTag` then `assignShotTag` | shot tags | input is `required` |

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Disc record + `moldInfo` | `fetchDisc` | `lib/discLocker` | Supabase | async |
| User's bags | `fetchBags` | `lib/discLocker` | Supabase | async |
| Bag membership ids | `fetchDiscBagIds` | `lib/discLocker` | Supabase | async |
| Shot tags + assignments | `loadDiscShotTags` | `lib/repository/discTaxonomyRepository` | repository | async |
| Effective flight numbers | `effectiveFlightNumbers` | `lib/discs` | — | **pure** |
| Assigned/active tag derivation | `assignedShotTags`, `activeShotTagAssignments` | `lib/discTaxonomy` | — | **pure** |
| Photos | `loadDiscPhotos`, `signedDiscPhotoUrl` | `lib/repository/discPhotoRepository` | Supabase Storage | async |
| Odometer events | `loadDiscOdometer` | `lib/repository/discOdometerRepository` | repository | async |
| Contextual performance | `loadDiscProfileContext` | `lib/repository/discProfileRepository` | repository | async |

The four primary reads are issued as one `Promise.all` in `loadAll()`, re-run when `discId` or `user.id`
changes. See `LIB_API_INDEX.md` for signatures.

### Writes

| Mutation | Call | Notes |
|---|---|---|
| Save details / overrides | `upsertDisc(user.id, discId, fields)` | Returns the updated row; empty strings are normalized to `null` before save |
| Equip / unequip bag | `addDiscToBag` / `removeDiscFromBag` | Optimistic — local `Set` updates after the await resolves |
| Assign / remove shot tag | `assignShotTag` / `removeShotTagAssignment` | Followed by a full `loadDiscShotTags` refetch |
| Create shot tag | `createShotTag` then `assignShotTag` | Two sequential awaits; see § 12 |
| Record odometer event | `recordDiscOdometerEvent` | Has an outbox — `flushDiscOdometerOutbox` |
| Photo upload / delete / restore | `queueDiscPhotoUpload`, `deleteDiscPhoto`, `restoreDiscPhoto` | Queued; `flushDiscPhotoUploads` drains |

The repository/transaction contract is `PHASE_A_ARCHITECTURE.md` § 14.

### Offline

Photos and odometer events queue through their repositories and survive offline. The four primary reads
do **not** — `loadAll()` awaits Supabase directly, so with no network and no cache the page renders its
loading state indefinitely (see § 6, Error path). No calm-state indicator from
`PHASE_A_ARCHITECTURE.md` § 12 is currently rendered on this screen. Tracked as a gap in § 10.

## 6. Flow paths

**Happy path.** Arrive from locker → `loadAll()` resolves → full record renders → edit a field via
`EditableSection` → save → `upsertDisc` returns the updated row → view mode re-renders from it.

**First run / empty.** A disc with no photos, no odometer events, no tags, and no bags renders every
section with its own empty affordance: `bag-empty` copy, `Assigned: none`, and `Insufficient data`
readouts in the contextual panel. The page itself is never empty — a disc always has identity fields.

**Error.** `loadAll()` rejection before the disc resolves renders `<p class="form-error">` **as the
entire page** — no header, no retry control, no navigation. Any error after load renders inline and
non-blocking. The pre-load case is a divergence from § 12's "a network failure never replaces active
capture with a full-screen error"; this is not active capture, so the contract does not strictly bind,
but the absence of a retry control is a real gap. See § 10.

**Offline.** As § 5. Queued writes survive; primary reads do not.

**Auth / guard.** `ProtectedRoute` gates the whole shell. `user.id` is dereferenced unconditionally in
`loadAll()`, so this screen assumes an authenticated session and has no anonymous rendering path.

**Interlock.** No capacity interlock is enforced here. Equipping via `bag-row` writes directly. The
35-disc bag capacity described in `SCREEN_SPECS.md` Screen 5 is not checked on this screen — see § 12.

**Destructive.** Photo delete is soft, with `restoreDiscPhoto` recovering it. Retirement is not a
distinct workflow: it is the `status` field in the Details section, set to `retired` through an ordinary
select with no confirmation step. Blueprint divergence, § 13.

## 7. Dependencies

### Schema
`discs` (identity, `override_speed|glide|turn|fade`, `status`, `photo_url` legacy), `disc_molds` via
`discs.mold_id` — never drop this FK (`docs/development/CURRENT_WORK.md` § Standing decisions), `bags`,
bag membership rows, shot tags and assignments, disc photos, disc odometer events and cosmetic unlocks.

### Library
`lib/discLocker`, `lib/discs`, `lib/discTaxonomy`, `lib/discOdometer`, `lib/discPhotos`,
`lib/repository/discTaxonomyRepository`, `discPhotoRepository`, `discOdometerRepository`,
`discProfileRepository`. Signatures in `LIB_API_INDEX.md`.

### Components
`EditableSection` (×2), `DiscPhotoManager`, `DiscOdometerManager`, `DiscProfileContext`. Details in
`COMPONENT_LIBRARY.md`.

### Screens
`disc-collection` and `discs-root` link in. `lost-found` is linked out to with a `?disc=` parameter and
must handle that parameter. `disc-compare` shares `FlightCurveOverlay` but not this page.

### Contracts and decisions
`PHASE_A_ARCHITECTURE.md` §§ 12–14. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- Every input in both `EditableSection` blocks has an explicit `htmlFor`/`id` pair — good, and the
  pattern to copy on other screens.
- `tag-create` uses `required` on the input, so submission is browser-validated rather than
  custom-validated. Screen-reader announcement of that failure is browser-default.
- The status badge conveys state through class name and text. Text is present, so it does not rely on
  color alone — consistent with the ghost-record rule in § 12.
- **Gap:** the flight numbers table has an empty first `<th>` and no caption or scope attributes.
- **Gap:** chip toggles (`bag-row`, `tag-chip`) communicate state via `chip-active` class and label text
  swap, with no `aria-pressed`.

## 9. Events and telemetry

Odometer events write to the disc odometer ledger with a metric, delta, source (`manual_entry`), and
optional reason, validated by `validateOdometerInput`. Cosmetic tier unlocks fire at 300 / 1000 / 5000
chain hits via `highestUnlockedTier` and `nextCosmeticMilestone`. No notifications are produced or
consumed. No activity-lifecycle events are written.

## 10. Tests

### Existing coverage

`src/lib/discs.test.js`, `discLocker.test.js`, `discTaxonomy.test.js`, `discOdometer.test.js`,
`discPhotos.test.js`, `discProfile.test.js`, `src/lib/repository/discOdometerRepository.test.js`.

Coverage is entirely at the library layer. **There is no component or page test for
`DiscDetailPage.jsx`** — no test asserts that the page composes these libraries correctly.

### Acceptance criteria

1. A disc with an override on one axis shows the override in `Effective` and the mold value in `Stock`.
2. A disc with no overrides shows identical values in both rows.
3. A mold-less disc renders `—` rather than crashing.
4. Saving Details with an empty optional field writes `null`, not `""`.
5. Equipping a bag flips the chip to `Equipped` and persists across reload.
6. Creating a custom shot tag both creates and assigns it in one submit.
7. `status = lost` changes the Lost & Found link label.
8. A failed initial load shows an error; **currently there is no way to retry without a reload.**

### E2E critical paths

Load → edit Details → save → verify persistence after reload. Equip/unequip round trip. Photo upload
while offline, then flush on reconnect. No automated browser E2E suite exists
(`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing coverage.

## 11. Tasks

#### T-disc-detail-1 — Add a retry affordance to the pre-load error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscDetailPage.jsx`
- **Done when:** A failed initial load renders the error plus a `Retry` control that re-runs `loadAll()`;
  a succeeding retry renders the disc without a page reload.
- **Verify:** `npm test` with a new page-level test that rejects `fetchDisc` once then resolves.
- **Commit:** `fix: allow retry when disc detail fails to load`

#### T-disc-detail-2 — Add `aria-pressed` to bag and shot tag chips

- **Capability:** `ui-routine`
- **Touches:** `src/pages/DiscDetailPage.jsx`
- **Done when:** Both chip groups expose pressed state to assistive tech; visual behavior is unchanged.
- **Verify:** `npm run lint` and manual VoiceOver pass on `/bag/discs/:id`.
- **Commit:** `fix: expose chip toggle state to assistive tech`

#### T-disc-detail-3 — Decide and document bag capacity enforcement

- **Capability:** `pure-logic`
- **Touches:** `src/lib/discLocker.js`, `src/pages/DiscDetailPage.jsx`
- **Done when:** Equipping a disc into a bag already at capacity either fails with a stated message or is
  documented as intentionally unenforced on this screen, consistently with `/bag`.
- **Verify:** `npm test` covering the at-capacity case.
- **Commit:** `feat: enforce bag capacity on disc detail equip`
- **Blocked by:** § 12 open question 1.

## 12. Open questions

1. ~~**Bag capacity is not enforced here.**~~ **RESOLVED 2026-07-29.** The database does enforce it, and
   this screen has no app-side guard, so the raw exception reaches the user.

   `layer1_foundation_schema.sql:230-253` defines `enforce_bag_capacity()` on a `before insert` trigger
   over `bag_discs`. It takes a row lock (`perform 1 from bags where id = new.bag_id for update`) so
   two parallel adds at 34 discs cannot both pass, then raises
   `'Bag % is at the 35-disc capacity limit'` with `errcode = 'check_violation'`.

   `bag-row` calls `addDiscToBag` with no capacity check, and the handler surfaces `err.message`
   verbatim — so equipping a 36th disc from this screen shows the user a raw Postgres exception string.
   `discs-root` suppresses its `Add from locker` action at capacity; this screen does not.

   **A discrepancy worth knowing:** the trigger counts **every** `bag_discs` row, while the capacity
   readout on `discs-root` counts `in_locker` members only (via `bagViewDiscs`). A bag holding 35
   members of which 5 are `lost` therefore displays `30 / 35` and still rejects the next insert.

   `T-disc-detail-3` is unblocked by this and should now catch the error and render a written message
   rather than adding a client-side count that would inherit the same divergence.
2. **`handleCreateShotTag` is not atomic.** `createShotTag` then `assignShotTag` are sequential awaits
   with no rollback. A failure between them leaves an orphaned unassigned tag.
3. **Equip state is optimistic without rollback on refetch.** The local `Set` updates after a successful
   await, but nothing reconciles it against the server if a concurrent change occurred on another device.

## 13. Blueprint divergence

Blueprint Screen 6 is *Putter Lineup Manager & Live Flight Curve Editor*. `SCREEN_SPECS.md` Screen 6
maps it onto this page — "details/overrides/bag-membership sections extend rather than get replaced" —
but **the shipped implementation split Screen 6 across three surfaces**, and no document says so:

| Blueprint Screen 6 feature | Where it actually shipped |
|---|---|
| Role swimlanes (PRIMARY / BACKUP / SITUATIONAL) | `PutterLineup.jsx`, rendered on `/bag` — **not here** |
| Bézier flight curve, factory vs custom | `FlightCurve.jsx`; `FlightCurveOverlay` used by `disc-compare` — **not here** |
| 1–10 wear slider | `PutterLineup.jsx` |
| 300-putt odometer alert proposing a wear step-down | **Not built as specified.** `DiscOdometerManager` ships instead, and 300 chain hits unlocks a *cosmetic tier*, not a wear adjustment |
| Equipment retirement workflow | Ordinary `status` select in Details, no dedicated workflow, no confirmation |
| Manual flight overrides | Here, as numeric inputs — not the zero-typing steppers the divergence note promised |

Standing divergences #1 (React/Vite, not Expo) and #3 (append-only schema) apply; see `SCREEN_SPECS.md`.

The `SCREEN_SPECS.md` Screen 6 entry describes an intended page that does not match any single shipped
screen. Logged in `docs/ui/_corrections/`.
