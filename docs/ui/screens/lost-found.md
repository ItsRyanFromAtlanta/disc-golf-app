# Lost & Found

| Field | Value |
|---|---|
| Route id | `lost-found` |
| URL pattern | `/bag/lost-found?disc=:discId` |
| Section | `discs` |
| Shell | `standard` |
| Header title | `Lost & Found` |
| Activity pill | shown |
| Scroll key | `discs-lost-found` |
| Preserves nested state | **yes** |
| Page component | `src/pages/LostFoundPage.jsx` (229 lines) |
| Blueprint screen | none — post-blueprint |
| Verified against | `7351964` |

## 1. Purpose

A private, offline-first record of a lost disc: where it went missing, who to contact, every sighting
since, and how it ended. Opening a case flips the disc's status to `lost` and marking it recovered
flips it back, so this screen is the disc lifecycle's `lost` branch as well as its evidence log. A
player comes here standing in the rough with no signal.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Lost & Found` link on `/bag`'s Collection tab | `Link` to `/bag/lost-found` | No parameter |
| In | `Lost & Found` link on `/bag`'s Bags tab | `Link` to `/bag/lost-found` | No parameter |
| In | Lost & Found link on the disc detail page | `Link` to `/bag/lost-found?disc=:discId` | **The only parameterized entry**; label flips on `disc.status === 'lost'` (`screens/disc-detail.md` § 2) |
| In | Direct URL / restored session | Route match | `ProtectedRoute`; `useOnboardingGate` may intercept first |
| Out | `Locker` link in the page header | `Link` to `/bag/locker` | |
| Out | Disc name heading in the selected case | `Link` to `/bag/discs/:discId` | Opens the disc behind the case |
| Out | Shell back control | `GlobalHeader` → `resolveSectionRoot('discs')` | Returns to `/bag`, not to the disc you came from |
| Out | Tab re-tap on DISCS | `TabBar` → `resolveSectionRoot('discs')` | Returns to `/bag` |

**Query parameter contract — `?disc=:discId`.** Read once, at initial state construction:
`useState(searchParams.get('disc') ?? '')` (`LostFoundPage.jsx:54`). Its entire effect is to seed the
`Disc` select in the "Report a lost disc" form. Consequences, all of which follow from it being an
initializer rather than an effect:

- It is read **once per mount.** Changing the parameter without remounting does not change the
  selection.
- It is **not validated.** An id the user does not own, a malformed id, or an id whose disc is
  `retired`/`sold`/already-cased is set as the `<select>`'s value; because no `<option>` matches, the
  browser renders the select as blank and `discId` remains truthy. `Open case` is enabled
  (`disabled={saving || !discId}`), and submitting sends the id to the RPC, which raises
  `Disc not found`, `Disc status cannot open a Lost & Found case`, or
  `Disc already has an open Lost & Found case`. See § 12.
- When it is **absent**, `load()` supplies a default instead: the first disc in the fetched list whose
  status is not `retired`/`sold` (`LostFoundPage.jsx:72`). That fallback is guarded by
  `current || …`, so it never overwrites a parameter-supplied value — but it does **not** filter out
  discs with an open case, unlike the `reportableDiscs` list the select actually renders from. The
  default can therefore also be an id with no matching option.
- It does **not** select the corresponding case in the history list. A player arriving from a `lost`
  disc's detail page to view its case lands on whichever case `lost.cases[0]` happens to be — the
  newest by `latest_update_at`, open cases first. See § 12.

`preserveNestedState` is `true`, so scroll position is retained within a shell mount. Form field
values, the selected case, and the chosen update type are component state and are lost on unmount.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Lost & Found                      [activity pill]| <- Shell header
+-------------------------------------------------------+
|  Disc recovery                                        | <- eyebrow
|  Lost & Found                              [ Locker ] |
|  Keep a private, offline-ready history of where a     |
|  disc was lost, sightings, contacts, and recovery.    |
+-------------------------------------------------------+
|  REPORT A LOST DISC                                   |
|  Disc          [ Choose a disc            v ]         | <- seeded by ?disc=
|  Course (opt)  [ No course selected       v ]         |
|  Hole or area  [ Hole 7, left rough          ]        |
|  Latitude [        ]   Longitude [        ]           |
|  [ Use current location ]                             | <- navigator.geolocation
|  Notes         [                             ]        |
|  Contact name  [                             ]        |
|  Contact details [ Phone, email, or clubhouse ]       |
|  [ Open case ]                                        |
+-------------------------------------------------------+
|  CASE HISTORY                                         |
|  Thunderbird                              [ open ]    | <- open cases first, then newest
|  Buzzz                              [ recovered ]     |
|  Roc                          [ open · pending ]      | <- pending = queued offline
|  ---------------------------------------------------  |
|  THUNDERBIRD                                          | <- link to the disc
|   • Sighting          7/28/2026, 4:12 PM              | <- newest first
|     Sunset Park · Hole 7, left rough                  |
|     33.74821, -84.39012                               |
|   • Reported lost     7/27/2026, 6:40 PM              |
|     [Waiting to sync]                                 |
|                                                       |
|  Update type   [ Note added              v ]          |
|  ...same field block as above...                      |
|  [ Add update ]                                       |
|  [ Mark recovered ]   [ Close unresolved ]            |
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Lost & Found", activity pill
Page header
  hdr-eyebrow .......... "Disc recovery"
  hdr-title ............ h1 "Lost & Found"
  hdr-locker ........... link to /bag/locker
  hdr-blurb ............ "Keep a private, offline-ready history of where a disc was lost, sightings,
                          contacts, and recovery."
Banners
  err-inline ........... form-error
  notice-inline ........ success-message; "Saved on this device…" or the completed-action text
Report panel (form)
  rep-heading .......... h2 "Report a lost disc"
  rep-disc ............. select, required; reportableDiscs only
  rep-fields ........... shared field block, prefix "lost-report"
  rep-submit ........... "Open case" / "Saving…"
  rep-none ............. "Every eligible disc already has an open case, or there are no active discs."
Shared field block (rendered twice, prefix-keyed ids)
  fld-course ........... select, "No course selected" + one per course
  fld-area ............. text, maxLength 500, placeholder "Hole 7, left rough"
  fld-lat / fld-lng .... number inputs, step 0.000001, inside their own <label>s
  fld-geolocate ........ "Use current location"
  fld-notes ............ textarea, maxLength 4000, rows 3
  fld-contactname ...... text, maxLength 200
  fld-contactvalue ..... text, maxLength 500, placeholder "Phone, email, or clubhouse"
Case history panel
  hist-heading ......... h2 "Case history"
  hist-empty ........... "No Lost & Found cases yet."
  hist-case ............ button per case: disc name + status badge (+ " · pending")
  Case detail (selected case only)
    det-disc ........... h3, link to /bag/discs/:discId
    det-timeline ....... ordered list, newest first, one entry per update
      tl-label ......... LOST_FOUND_EVENT_LABELS[event_type]
      tl-time .......... localized occurred_at
      tl-course ........ course name, when course_id is set
      tl-area .......... area_text
      tl-coords ........ "lat, lng" to 5 decimals
      tl-notes ......... notes
      tl-contact ....... "Contact: {name} — {value}"
      tl-pending ....... "Waiting to sync" zone-badge
    Update form (open cases only)
      upd-type ......... select over LOST_FOUND_UPDATE_TYPES (4 of the 7 labels)
      upd-fields ....... shared field block, prefix "case-update"
      upd-submit ....... "Add update"
      upd-recovered .... "Mark recovered" — terminal, flips the disc back to in_locker
      upd-closed ....... "Close unresolved" — terminal, leaves the disc lost
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `hdr-locker` | link | `Locker` | default / pressed | navigate | `/bag/locker` | always |
| `err-inline` | banner | error text | present / absent | — | — | load failure, geolocation failure, or a rejected write. Not cleared by a later success |
| `notice-inline` | banner | `Lost disc case opened.` / `Case timeline updated.` / `Saved on this device. It will sync when connectivity returns.` | present / absent | — | — | set from `result.queued`; **never cleared** — see § 12 |
| `rep-disc` | select | `Choose a disc` + one per reportable disc | — | `setDiscId` | local state | `required`; options are `reportableDiscs` = not `retired`/`sold` **and** not already holding an open case |
| `fld-course` | select | `Course (optional)`, `No course selected` + every course | — | `setField('courseId')` | local state | courses come from `fetchCourses()` — **all** courses, not just the user's |
| `fld-area` | text | label `Hole or area` | — | `setField` | local state | `maxLength={500}`, matching the DB `check` |
| `fld-lat` / `fld-lng` | number | `Latitude` / `Longitude` | — | `setField` | local state | `step="0.000001"`; validated as a **pair** by `normalizeLostFoundFields` — one without the other throws `Latitude and longitude must be provided together` |
| `fld-geolocate` | button | `Use current location` | default / pressed | `navigator.geolocation.getCurrentPosition` | local fields | always; `enableHighAccuracy`, 10s timeout. No browser support → `Location is not available in this browser` |
| `fld-notes` | textarea | label `Notes` | — | `setField` | local state | `maxLength={4000}` |
| `fld-contactvalue` | text | label `Contact details`, placeholder `Phone, email, or clubhouse` | — | `setField` | local state | `maxLength={500}` |
| `rep-submit` | button | `Open case` / `Saving…` | idle / saving / disabled | `openLostFoundCase` | `lost_found_cases` + `lost_found_updates` + `discs.status` | `disabled={saving \|\| !discId}` |
| `rep-none` | text | `Every eligible disc already has an open case, or there are no active discs.` | — | — | — | `reportableDiscs.length === 0`; the whole form including its fields is replaced |
| `hist-empty` | text | `No Lost & Found cases yet.` | — | — | — | `cases.length === 0` |
| `hist-case` | button | disc name + status badge | selected (`lost-found-case-active`) / unselected | `setSelectedCaseId` | local state | one per case; badge class is `abandoned-badge` when `open`, `zone-badge` otherwise — **inverted from intuition**, see § 8 |
| `det-disc` | link | disc display name | default / pressed | navigate | `/bag/discs/:discId` | always |
| `tl-pending` | badge | `Waiting to sync` | present / absent | — | — | `update.pending` — the optimistic local row before its RPC succeeds |
| `upd-type` | select | `Location updated`, `Sighting`, `Contact updated`, `Note added` | — | `setEventType` | local state | `LOST_FOUND_UPDATE_TYPES` — the 4 user-appendable types. `Reported lost`, `Recovered`, and `Closed unresolved` are label-only and set by the terminal buttons |
| `upd-submit` | button | `Add update` | idle / disabled | `appendLostFoundUpdate(eventType)` | `lost_found_updates` | `disabled={saving}`; open cases only |
| `upd-recovered` | button | `Mark recovered` | idle / disabled | `appendLostFoundUpdate('recovered')` | case status + **`discs.status = 'in_locker'`** | `disabled={saving}`; **no confirmation** |
| `upd-closed` | button | `Close unresolved` | idle / disabled | `appendLostFoundUpdate('closed')` | case status only | `disabled={saving}`; **no confirmation**; the disc stays `lost` |

Both terminal buttons submit the *currently entered field values* along with the terminal event, so a
note typed before tapping `Mark recovered` is recorded on the recovery entry.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Owned discs | `fetchUserDiscs` | `lib/discLocker` | Supabase | async |
| Courses | `fetchCourses` | `lib/roundLog` | Supabase | async |
| Cases + updates, with queued rows merged in | `loadLostFoundCases` | `lib/repository/lostFoundRepository` | **Supabase + Dexie** | async |
| Outbox drain, before every load | `flushLostFoundOutbox` | `lib/repository/lostFoundRepository` | Supabase + Dexie | async |
| Display name | `discDisplayName` | `lib/lostFound` | — | **pure** |
| Event labels | `LOST_FOUND_EVENT_LABELS` | `lib/lostFound` | — | pure const |
| Case ordering | `sortLostFoundCases` | `lib/lostFound` | — | **pure**, inside the repository |

Signatures in `LIB_API_INDEX.md`. `load()` (`LostFoundPage.jsx:61`) awaits `flushLostFoundOutbox`
first, then issues the three reads as one `Promise.all`, and is re-run after every successful write.
Flushing before reading is what makes a queued case appear as a real one the moment connectivity
returns.

**The `Promise.all` is the offline weak point.** `fetchUserDiscs` and `fetchCourses` are raw Supabase
calls with no cache fallback, so either one rejecting rejects the whole `load()` — including
`loadLostFoundCases`, which *does* have a Dexie fallback and would have succeeded on its own.

### Writes

| Mutation | Call | Idempotency | Transaction boundary |
|---|---|---|---|
| Open a case | `openLostFoundCase({ userId, discId, ...fields })` | `lost-found:{uuid}`, checked against `lost_found_cases.idempotency_key` before any work | One Dexie `rw` transaction across `lostFoundOutbox`, `lostFoundCases`, `lostFoundUpdates`, **then** the `open_lost_found_case` RPC |
| Append an update | `appendLostFoundUpdate({ userId, caseId, eventType, ...fields })` | same scheme, checked against `lost_found_updates.idempotency_key` | Same shape, against `append_lost_found_update` |
| Drain the queue | `flushLostFoundOutbox(userId)` | replays the stored keys | Per-row; a failing row stays queued with `status: 'retry'` and `lastError` |

This is **the section's only true local-first write path**, and the one that follows
`PHASE_A_ARCHITECTURE.md` § 14's local capture order literally: validate (`normalizeLostFoundFields`
throws before anything is written), begin one Dexie transaction, write the optimistic case/update rows,
queue the outbox entry, commit, then sync in the background. A failed sync returns `{ queued: true }`
rather than throwing, and the UI reports `Saved on this device.` Cite § 14; do not restate it.

Server-side, both RPCs are `security definer` with `search_path = ''` and enforce their own invariants:
authentication, identifier presence, ownership, `disc_status not in ('retired','sold')`, no second open
case per disc (also backed by the partial unique index `lost_found_cases` on `disc_id where status =
'open'`), a valid event type, and `case_row.status = 'open'`. Two disc-status side effects are part of
the same transaction: opening sets `discs.status = 'lost'`
(`20260715235500_phase_b_lost_found.sql:149-151`) and a `recovered` update sets it back to `in_locker`
(`:214-216`). `closed` does not.

### Offline

The write path is fully offline-capable; the read path is not.

- **Writes:** an offline `Open case` or `Add update` commits to Dexie, queues in
  `lostFoundOutbox`, and returns `{ queued: true }`. The optimistic rows carry `pending: true`, which
  renders as the `pending` suffix on the case badge and the `Waiting to sync` badge on the timeline
  entry. `flushLostFoundOutbox` drains on the next successful load. Terminal events apply their status
  change to the local case row immediately, so a recovery marked offline reads as recovered.
- **Reads:** blocked. `load()`'s `Promise.all` rejects on `fetchUserDiscs` or `fetchCourses`, so an
  offline arrival renders the full page chrome with `err-inline`, an empty `discs` array (hence
  `rep-none`), and an empty case list (hence `hist-empty`). **The queued cases are in Dexie and are not
  shown** — the one thing an offline player most needs to see.

Calm states from `PHASE_A_ARCHITECTURE.md` § 12: this screen is the only one in the DISCS section that
renders any of them. `Saved on this device. It will sync when connectivity returns.` is the
`Saved on Device` state in prose, and `Waiting to sync` is a per-row equivalent. Neither uses the
contract's exact vocabulary, and there is no `Syncing`, `Synced`, or `Needs Attention` — a stalled
outbox row that keeps failing shows nothing at all. Tracked in § 11.

## 6. Flow paths

**Happy path.** Arrive from a disc's detail page with `?disc=` → the disc is preselected → add the hole,
tap `Use current location`, add a note and a contact → `Open case` → the case appears at the top of the
history, the disc's status becomes `lost` → later, select the case, choose `Sighting`, add detail →
`Add update` → finally `Mark recovered`, which appends the recovery entry, closes the case, and returns
the disc to `in_locker`.

**First run / empty.** A user with discs but no cases sees the full report form and
`No Lost & Found cases yet.` A user whose every disc is retired, sold, or already cased sees `rep-none`
instead of the form. A user with no discs at all sees the same message, which is accurate but reads
oddly on an empty account.

**Error.** Every failure funnels into one `err-inline` at the top of the page: load failures,
geolocation failures, validation throws from `normalizeLostFoundFields`, and raw RPC exception strings
(`Disc already has an open Lost & Found case`, `Lost & Found case is already resolved`). There is no
retry control and no per-field validation display; a coordinate-pair error appears far above the
coordinate inputs. The page chrome always renders, so an error is never a full-screen replacement —
better than every other DISCS screen.

**Offline.** As § 5. Capture continues and is honestly labelled; the history does not render. This is a
partial satisfaction of § 12's "a network failure never replaces active capture with a full-screen
error" — the form does survive — with a real gap in the read path.

**Auth / guard.** `ProtectedRoute` gates the shell. Both RPCs re-check `auth.uid()` server-side and
raise `Authentication required`. `user.id` is dereferenced unconditionally in `load()`.

**Interlock.** One, and it is enforced in three places consistently — the shape the 35-disc bag cap
does not have:

1. **UI:** `reportableDiscs` excludes `retired`/`sold` discs and discs with an open case, so the
   `<select>` cannot offer an ineligible disc.
2. **RPC:** `open_lost_found_case` re-checks both conditions and raises.
3. **Schema:** the partial unique index `lost_found_cases_one_open_disc_idx` on
   `lost_found_cases (disc_id) where status = 'open'`
   (`20260715235500_phase_b_lost_found.sql:27-28`) makes a second open case impossible regardless of
   path.

The `?disc=` parameter is the one way to defeat step 1, and steps 2 and 3 catch it — with a raw error
string rather than a handled message. See § 12.

**Destructive.** No deletion exists here; the entire model is append-only, and even case resolution is
a new timeline entry rather than a mutation of history. Two actions are nonetheless irreversible from
the UI:

- `upd-recovered` and `upd-closed` both resolve the case permanently. `append_lost_found_update` raises
  `Lost & Found case is already resolved` on any subsequent update, and no reopen path exists in the
  app. Both are ordinary buttons with **no confirmation**, and `upd-recovered` additionally rewrites
  the disc's status.
- The two terminal buttons sit directly beneath `Add update` in the same action row, which is exactly
  the adjacency `PHASE_A_ARCHITECTURE.md` § 12 warns against ("destructive actions do not sit beside"
  routine ones).

This page calls no `window.confirm` and is not among the three named in `COMPONENT_LIBRARY.md` § Gaps
item 8.

## 7. Dependencies

### Schema

`lost_found_cases` (`disc_id`, `status` in `open`/`recovered`/`closed`, `opened_at`, `resolved_at`,
`latest_update_at`, `idempotency_key`; a `check` pairing `status` with `resolved_at`; the partial unique
index on open cases) and `lost_found_updates` (event type, `occurred_at`, optional `course_id`,
`area_text`, `latitude`/`longitude`, `notes`, `contact_name`/`contact_value`, `idempotency_key`) — both
from `20260715235500_phase_b_lost_found.sql`, `PRODUCT_ROADMAP.md` Phase B item 4. `discs.status`, which
both RPCs write. `courses`, read for the optional course reference. Dexie v10 mirrors:
`lostFoundCases`, `lostFoundUpdates`, `lostFoundOutbox`.

RPCs: `open_lost_found_case` and `append_lost_found_update`, both `security definer` wrappers over
`private.` implementations.

### Library

`lib/lostFound`, `lib/repository/lostFoundRepository`, `lib/discLocker`, `lib/roundLog`. Signatures in
`LIB_API_INDEX.md`.

### Components

**None.** Every control is hand-rolled markup on the `.lost-found-*` class family, plus the shared
`.form-error` / `.success-message` / `.zone-badge` / `.abandoned-badge` / `.history-row` conventions.
The shared field block is a local `renderFieldControls(prefix)` function rather than a component, which
is why the id prefixes exist.

### Screens

Linked from `disc-detail` with `?disc=`, and from `discs-root` without. Links out to `disc-detail` (the
case's disc) and `disc-collection`. It is the only writer of `discs.status = 'lost'` and one of two
writers of `status = 'in_locker'` (the other being the Details select on `disc-detail`), so the locker's
`lost` status filter and `/bag`'s `Lost` count both depend on this screen's writes.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` §§ 12 and 14 — § 14 in particular, since this is the section's closest
implementation of the local capture order. `PRODUCT_ROADMAP.md` Phase B item 4 ("Lost & Found
case/update timeline with optional GPS/course/notes/contact; offline replay and no timed auto-archive")
and the cross-cutting rule that private locations, names, and contacts never enter community
aggregates. No blocking ADR.

## 8. Accessibility

Beyond the § 12 baseline:

- Every field in both instances of the shared block has an explicit `htmlFor`/`id` pair, prefixed
  (`lost-report-course`, `case-update-notes`) so the two rendered copies never collide. This is the
  `disc-detail` pattern applied correctly, and the prefix approach is worth copying wherever a field
  block repeats.
- The coordinate inputs are wrapped in `<label>` elements rather than paired by id — also valid,
  though it means they alone break the prefix convention and have no ids at all.
- `maxLength` on the four free-text fields mirrors the database `check` constraints, so the limit is
  enforced at the input rather than surfaced as a server error.
- `tl-pending` and the case badge's ` · pending` suffix are text, not color — sync state is never
  conveyed by styling alone.
- **Gap:** the status badge classes are semantically inverted. An `open` case — the active, unresolved
  one — gets `abandoned-badge`, while `recovered` and `closed` get `zone-badge`, the positive
  treatment. The text is correct and carries the meaning, so this is a visual-language defect rather
  than an accessibility failure, but it will read as an error to anyone matching the badge vocabulary
  used elsewhere in the app.
- **Gap:** `err-inline` and `notice-inline` are plain `<p>` elements with no `role="alert"` /
  `role="status"`. Nothing is announced on a failed submit or a queued save, and both sit at the top of
  a long page far from the controls that produced them.
- **Gap:** `notice-inline` is never cleared. Once set, the success message persists through subsequent
  actions, navigation within the page, and errors — so `err-inline` and a stale `Lost disc case
  opened.` can render simultaneously.
- **Gap:** `hist-case` conveys selection through the `lost-found-case-active` class only, with no
  `aria-pressed` or `aria-current`.
- **Gap:** the case timeline is an `<ol>` whose entries are bare `<span>`s — event label, time, course,
  area, coordinates, notes, and contact all render as sibling spans with no programmatic labels, so a
  screen reader hears an unstructured run of values.
- **Gap:** `fld-geolocate` gives no feedback while the 10-second geolocation request is in flight, and
  no indication of success beyond the coordinate fields changing.

## 9. Events and telemetry

No metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted, and no notification is produced
or consumed — a `lost` disc raises no alert anywhere in the app. No activity-lifecycle event is written;
a Lost & Found case is not an activity.

The screen is nonetheless entirely event-shaped. Every user action appends one immutable
`lost_found_updates` row carrying its event type, `occurred_at`, `recorded_at`, evidence fields, and a
globally unique idempotency key — the § 4 facts/audit/provenance contract implemented in a domain
table. Case status and `latest_update_at` are derived from those rows by the RPC rather than set
independently. The disc-status side effects (`lost` on open, `in_locker` on recovery) additionally fire
the `discs` state-change trigger into `disc_state_events`, so a case is visible from the disc's own
timeline via `buildDiscHistory` on `disc-detail`.

## 10. Tests

### Existing coverage

`src/lib/lostFound.test.js` — `normalizeLostFoundFields` (trimming, null-empties, latitude/longitude
range and pairing), `discDisplayName`, `sortLostFoundCases`, and the label/type constants. This matches
the `lost-found` row in `TEST_MAP.md`.

`LIB_API_INDEX.md` marks every `lostFoundRepository` export as untested, so **the offline queue — the
most valuable behavior on this screen — has no test at all.** Nothing exercises the Dexie transaction,
the `queued: true` return, the optimistic-row shape, the outbox drain, the retry marking, or the
pending-row merge in `loadLostFoundCases`. **There is no component or page test for
`LostFoundPage.jsx`** either.

This is the section's largest coverage gap relative to risk: `PHASE_A_ARCHITECTURE.md` § 9's E2E
priority 1 is explicitly "flows where a silent break loses user data", and this is one.

### Acceptance criteria

1. `?disc=:ownedInLockerDiscId` preselects that disc in the report form.
2. `?disc=:retiredDiscId` renders a blank select with `Open case` enabled, and submitting surfaces the
   RPC's rejection — current behavior, asserted so a change to it is deliberate (§ 12 item 1).
3. With no parameter, the select defaults to the first non-`retired`/`sold` disc.
4. Opening a case sets the disc's status to `lost` and the disc disappears from `reportableDiscs`.
5. A disc with an open case cannot be reported again from the select, and cannot be reported via
   `?disc=` either — the RPC and the partial unique index both refuse.
6. Entering a latitude with no longitude fails validation before any write occurs.
7. `Mark recovered` closes the case and returns the disc to `in_locker`; `Close unresolved` closes the
   case and leaves it `lost`.
8. A resolved case renders its timeline with no update form.
9. Submitting with the network unavailable renders `Saved on this device. It will sync when
   connectivity returns.`, shows `Waiting to sync` on the entry, and persists across a reload.
10. Reconnecting and reloading drains the outbox exactly once — no duplicate case, no duplicate update,
    verified by the idempotency keys.
11. With the network unavailable and queued cases in Dexie, the history list currently renders empty —
    current behavior, asserted only; see task `T-lost-found-1`.

### E2E critical paths

Report offline → reconnect → confirm exactly one case and one update, with the disc's status correct.
Report from a disc detail page with `?disc=` and confirm the round trip back to that disc. Full case
lifecycle: open → sighting → recovered, asserting the disc status at each step. Attempt a second open
case for the same disc from both the select and a crafted `?disc=` URL. No automated browser E2E suite
exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries, not existing coverage.

## 11. Tasks

#### T-lost-found-1 — Render the cached case history when the network is unavailable

- **Capability:** `sync`
- **Touches:** `src/pages/LostFoundPage.jsx`
- **Done when:** `loadLostFoundCases` is awaited independently of `fetchUserDiscs`/`fetchCourses`, so an
  offline arrival still renders every cached and queued case; the disc and course selects degrade
  individually with their own inline explanations.
- **Verify:** `npm test` with a page-level test rejecting the two raw fetches while the Dexie tables are
  populated.
- **Commit:** `fix: show cached Lost & Found cases when offline`

#### T-lost-found-2 — Test the offline queue

- **Capability:** `sync`
- **Touches:** `src/lib/repository/lostFoundRepository.test.js` (new)
- **Done when:** Tests cover the Dexie transaction, `queued: true` on RPC failure, optimistic row
  shape, terminal-event local status application, `flushLostFoundOutbox` draining and retry-marking,
  and the pending-row merge in `loadLostFoundCases`.
- **Verify:** `npm test`.
- **Commit:** `test: cover the Lost & Found offline queue`

#### T-lost-found-3 — Validate `?disc=` before enabling submission

- **Capability:** `ui-routine`
- **Touches:** `src/pages/LostFoundPage.jsx`
- **Done when:** A `disc` parameter that does not match a reportable disc is either ignored (falling
  back to the default) or surfaces a specific message naming why that disc cannot be reported, instead
  of producing a blank select with an enabled submit.
- **Verify:** `npm test` with cases for owned/retired/already-cased/foreign ids.
- **Commit:** `fix: handle an unreportable disc parameter`

#### T-lost-found-4 — Select the case matching `?disc=`

- **Capability:** `ui-routine`
- **Touches:** `src/pages/LostFoundPage.jsx`
- **Done when:** Arriving with `?disc=:id` for a disc that has a case selects that case in the history
  list, so the `View Lost & Found case` link on `disc-detail` lands on the right case.
- **Verify:** `npm test` with two cases where the parameterized disc is not the newest.
- **Commit:** `fix: open the case for the requested disc`

#### T-lost-found-5 — Confirm before resolving a case

- **Capability:** `ui-routine`
- **Touches:** `src/pages/LostFoundPage.jsx`
- **Done when:** `Mark recovered` and `Close unresolved` require an in-app confirmation stating the
  consequence (including the disc status change), and are visually separated from `Add update` per
  `PHASE_A_ARCHITECTURE.md` § 12. Not `window.confirm`.
- **Verify:** `npm run lint` plus manual check; add a test once a shared confirm component exists.
- **Commit:** `fix: confirm Lost & Found case resolution`

#### T-lost-found-6 — Announce and clear the banners

- **Capability:** `ui-routine`
- **Touches:** `src/pages/LostFoundPage.jsx`
- **Done when:** `err-inline` is `role="alert"`, `notice-inline` is `role="status"`, and setting either
  clears the other; the notice clears on the next interaction.
- **Verify:** `npm run lint` and a manual VoiceOver pass through a failed then successful submit.
- **Commit:** `fix: announce and clear Lost & Found banners`

#### T-lost-found-7 — Use the contract's calm-state vocabulary

- **Capability:** `sync`
- **Touches:** `src/pages/LostFoundPage.jsx`
- **Done when:** Sync state is expressed with `Saved on Device`, `Syncing`, `Synced`, and
  `Needs Attention` per `PHASE_A_ARCHITECTURE.md` § 12, reserving stable layout space; an outbox row
  marked `retry` surfaces `Needs Attention` rather than nothing.
- **Verify:** `npm test` asserting the state derives from the outbox row's `status`, plus manual
  offline check.
- **Commit:** `feat: surface calm sync states in Lost & Found`

## 12. Open questions

1. **`?disc=` is unvalidated and can produce a submittable form that the server must reject.** The
   parameter is read straight into state without checking ownership, status, or existing-case
   membership, and `rep-submit`'s enable rule only tests truthiness. The three server-side guards catch
   it, so nothing corrupt is written — but the user sees a blank select and a raw Postgres exception.
   Blocks `T-lost-found-3`.
2. **`?disc=` seeds the report form but not the case selection.** `disc-detail` flips its link label to
   `View Lost & Found case` when the disc is `lost`, implying this page will show *that* case; it
   selects `cases[0]` instead. For a player with several cases, the link goes to the wrong one. Blocks
   `T-lost-found-4`.
3. **The default-disc fallback and the rendered options use different filters.**
   `LostFoundPage.jsx:72` picks the first disc that is not `retired`/`sold`; `reportableDiscs`
   additionally excludes discs with an open case. When the first eligible-by-status disc already has a
   case, the select initializes to an id with no matching option and renders blank.
4. **Queued cases are invisible offline.** They are written to Dexie and merged by
   `loadLostFoundCases`, but `load()`'s `Promise.all` never reaches it. The offline-first write path is
   undermined by a read path that is not. Blocks `T-lost-found-1`.
5. **A permanently failing outbox row has no surface.** `flushLostFoundOutbox` marks it
   `status: 'retry'` with a `lastError` and moves on. Nothing renders that state, nothing counts
   pending rows, and the § 12 `Needs Attention` state does not exist here. How long does a row retry,
   and what tells the user it never landed?
6. **There is no reopen path.** `append_lost_found_update` raises on a resolved case and the UI hides
   the form, so a disc mistakenly marked recovered can only be re-reported as a *new* case — which
   requires its status to be back to something reportable, which the recovery already did. The timeline
   is therefore split across two cases with no link between them. Intentional, given the append-only
   model, but undocumented.
7. **`fetchCourses()` returns every course, not the user's.** The course select on a private evidence
   record is populated from the shared course directory. Correct for a public directory; worth
   confirming that no private course data can be inferred from the selection.

## 13. Blueprint divergence

**N/A** — screen has no blueprint counterpart. `MASTER_PROJECT_BLUEPRINT.md` § 3 contains no lost-disc
workflow among its 21 screens; `disc.status = 'lost'` exists in the shipped schema as one of four
lifecycle values and the blueprint's Screen 6 treats loss only in passing, as a reason to retire an
asset ("Moves broken or lost putters to an archived database state").

Its origin is `SCREEN_SPECS.md:16-18` — "Expansion Screens 22–25 are adapted into DISCS
Collection/Rich Profile/Lost & Found and the shared notification sheet rather than creating a parallel
application tree" — and `PRODUCT_ROADMAP.md` Phase B item 4, shipped 2026-07-15. Those expansion
screens are **not in this repository**: nothing under `MASTER_PROJECT_BLUEPRINT.md` or any other root
document defines Screens 22–25, and `SCREEN_SPECS.md:16` is their only mention anywhere. There is
therefore no drawn intent to diverge from, and no wireframe to compare against. Logged in
`_corrections/discs-screens.md` D-2.

Standing divergences #1 (React/Vite, not Expo) and #3 (append-only schema — followed unusually
literally here) apply; see `SCREEN_SPECS.md`.
