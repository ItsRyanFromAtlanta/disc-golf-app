# Settings

| Field | Value |
|---|---|
| Route id | `settings` |
| URL pattern | `/profile/settings` |
| Section | `me` |
| Shell | `standard` |
| Header title | `Settings` |
| Activity pill | shown |
| Scroll key | `me-settings` |
| Preserves nested state | yes |
| Page component | `src/pages/SettingsPage.jsx` (58 lines) + `DataExportPanel.jsx` (44) + `DeleteAccountPanel.jsx` (101) |
| Blueprint screen | Screen 10 — distributed, not standalone; see § 13 |
| Verified against | `7351964` |

> **This screen carries a shipped-but-broken surface.** In-app account deletion exists in the UI and
> its migration is written but **not applied**, so the button fails with an undefined-function error.
> See § 6 (Destructive), § 12 open question 1, and `docs/development/CURRENT_WORK.md` § Open
> follow-ups. It is an App Review blocker under Guideline 5.1.1(v)
> (`docs/mobile/IOS_READINESS.md:19`).

## 1. Purpose

Everything the player controls about how the app behaves and what happens to their data: two device
and account preferences, a reporting timezone that defines weekly report boundaries, seven optional
notification categories, a full data export, and irreversible account deletion. It is the privacy and
control surface, not an analytics surface.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | `Settings` link on the ME root | `Link` from `/profile` | `CareerHubPage.jsx:32`. The only in-app entry point |
| In | Direct URL / restored session | Route match | Guarded by `ProtectedRoute`; `useOnboardingGate` runs first |
| Out | Shell back control | `GlobalHeader` → `handleBack()` | Goes to `/profile`, the ME section root |
| Out | Tab re-tap on ME | `TabBar` → `resolveSectionRoot('me')` | Returns to `/profile` |
| Out | **Account deleted** | `window.location.replace('/')` | `DeleteAccountPanel.jsx:43`. A full document replacement, not a route change — every provider, cache, and open Dexie handle in memory still belongs to the deleted user |
| Out | Any other tab | `TabBar` | Standard |

The export leaves no navigation trace: `downloadDataExport` creates an object URL, clicks a synthetic
`<a download>`, and revokes the URL (`src/lib/dataExport.js:112-119`). The user stays on the page.

`preserveNestedState` is `true`; the shell restores the `me-settings` scroll offset within a mount.
`DataExportPanel` and `DeleteAccountPanel` hold their own local state (`status`, `message`,
`confirming`, `phrase`), which does not survive unmount.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  <-  Settings                          [activity pill]| <- Shell-owned header
+-------------------------------------------------------+
|  App preferences                                      | <- h2#app-settings-title
|  Game-flair disc cards                          [ x ] | <- device-local, localStorage
|    Show rarity borders, stat blocks, and mount        |
|    motion on this device.                             |
|  Round-turn check-in                            [ x ] | <- profiles.round_turn_prompt_enabled
|    Show a brief pace and focus reminder after the     |
|    front nine.                                        |
|  Reporting timezone       [ America/New_York........ ] | <- saves on BLUR, validated by Intl
|    Defines Monday-Sunday weekly report boundaries.    |
+-------------------------------------------------------+
|  Optional notifications                               | <- h2#notification-settings-title
|  Critical sync and data-safety alerts always remain   | <- .settings-note; 'sync' is NOT listed
|  on.                                                  |
|  Activity review                                [ x ] |
|  Lost disc                                      [ x ] |
|  Weekly report                                  [ x ] | <- 7 categories from
|  Equipment                                      [ x ] |    NOTIFICATION_PREFERENCE_CATEGORIES
|  Community review                               [ x ] |
|  Achievements                                   [ x ] |
|  Coaching                                       [ x ] |
+-------------------------------------------------------+
|  Your data                                            | <- DataExportPanel
|  Download your synced account history as              |
|  deterministic CSV files in one ZIP archive. Private  |
|  photo metadata is included; photo files and unsynced |
|  device-only data are not.                            |
|  [ Export my data ]                                   |
|  Export ready. Keep the downloaded archive private... | <- role=status | role=alert
+-------------------------------------------------------+
|  Delete account                                       | <- DeleteAccountPanel
|  Permanently deletes your account, practice and round |
|  history, discs, bags, photos, goals, and reports.    |
|  Courses you added stay available to other players    |
|  without your name attached. This cannot be undone -  |
|  export your data first if you want a copy.           |
|  [ Delete my account ]                                | <- .btn-danger, collapsed state
|                                                       |
|  ...expanded:                                         |
|  Type DELETE to confirm                               |
|  [ .................................................] |
|  [ Permanently delete ]  Cancel                       | <- disabled until phrase === 'DELETE'
|  Account not deleted: <message>                       | <- role=alert. CURRENTLY ALWAYS FIRES
+-------------------------------------------------------+
|  [TAB BAR: PLAY DISCS COURSES ME]                     |
+-------------------------------------------------------+
```

### 3b. Region outline (normative)

```
Shell header (AppShell-owned)
  back, title "Settings", activity pill
App preferences (section.profile-section, aria-labelledby="app-settings-title")
  pref-heading ......... h2#app-settings-title "App preferences"
  pref-flair ........... checkbox #disc-card-flair, device-local
  pref-roundturn ....... checkbox #round-turn-prompt, account-level
  pref-timezone ........ text input #profile-timezone, saves on blur
Optional notifications (section.profile-section, aria-labelledby="notification-settings-title")
  notif-heading ........ h2#notification-settings-title "Optional notifications"
  notif-note ........... "Critical sync and data-safety alerts always remain on."
  notif-toggle ......... one checkbox per NOTIFICATION_PREFERENCE_CATEGORIES entry (7)
Your data (DataExportPanel, aria-labelledby="data-export-title")
  export-heading ....... h2#data-export-title "Your data"
  export-note .......... scope and exclusions copy
  export-button ........ "Export my data" / "Preparing export…"
  export-status ........ progress, success, or error message; role switches
Delete account (DeleteAccountPanel, aria-labelledby="delete-account-title")
  del-heading .......... h2#delete-account-title "Delete account"
  del-note ............. consequences copy
  del-open ............. "Delete my account" (.btn-danger), collapsed state
  del-phrase-label ..... "Type DELETE to confirm"
  del-phrase ........... text input #delete-account-phrase, autoComplete="off"
  del-confirm .......... "Permanently delete" / "Deleting…" (.btn-danger)
  del-cancel ........... "Cancel"
  del-error ............ "Account not deleted: <message>", role="alert"
Page-replacing states (mutually exclusive with everything above)
  state-error .......... p.form-error "Settings unavailable: <message>"
  state-loading ........ p.loading "Loading settings…"
```

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `pref-flair` | checkbox | `Game-flair disc cards` / `Show rarity borders, stat blocks, and mount motion on this device.` | on / off | `setFlairMode(checked)` **and** local state | `localStorage['disc-locker-flair-mode']` | always. **Device-local, not synced** — it does not appear in the export and does not survive a device change |
| `pref-roundturn` | checkbox | `Round-turn check-in` / `Show a brief pace and focus reminder after the front nine.` | on / off / error | `saveProfile({ round_turn_prompt_enabled })` | `profiles.round_turn_prompt_enabled` | always; defaults to `true` when the column is null. A rejected save replaces the entire page — see § 6 |
| `pref-timezone` | text input | `Reporting timezone` / `Defines Monday–Sunday weekly report boundaries.` | editing / saved / invalid | `onChange` updates local state; **`onBlur` validates and saves** | `profiles.timezone` | always. Empty or whitespace normalizes to `UTC`; anything `Intl.DateTimeFormat` rejects throws `Use a valid IANA timezone, such as America/New_York.` |
| `notif-note` | text | `Critical sync and data-safety alerts always remain on.` | — | — | — | always. Backed by omission: the `sync` category exists in the DB CHECK but is deliberately absent from `NOTIFICATION_PREFERENCE_CATEGORIES` |
| `notif-toggle` | checkbox ×7 | `Activity review`, `Lost disc`, `Weekly report`, `Equipment`, `Community review`, `Achievements`, `Coaching`, each with a one-line description | on / off / error | `settingsRepository.setNotificationPreference(userId, category, enabled)` | `notification_preferences` (`user_id`, `category`) | always. **Defaults to on** when no row exists (`enabledByCategory.get(id) ?? true`) |
| `export-button` | button | `Export my data` / `Preparing export…` | idle / working / complete / error | `exportData()` | download | `disabled` while `status === 'working'`. **Refuses outright when `navigator.onLine` is false** |
| `export-status` | text | progress, success, or error copy | absent / status / alert | — | — | `role="status"` for progress and success, `role="alert"` for errors |
| `del-open` | button (`.btn-danger`) | `Delete my account` | default / pressed | expands the confirmation block | local | always |
| `del-phrase` | text input | `Type DELETE to confirm` | — | sets `phrase` | local | `autoComplete="off"`, `aria-describedby="delete-account-title"` |
| `del-confirm` | button (`.btn-danger`) | `Permanently delete` / `Deleting…` | idle / working / error | `deleteAccount()` → `purgeDeviceData()` → `signOut()` → `location.replace('/')` | `delete_own_account()` RPC | **`disabled` until `phrase === 'DELETE'` exactly** (case-sensitive, module constant `CONFIRM_PHRASE`) and while working |
| `del-cancel` | link-button | `Cancel` | idle / disabled | collapses, clears phrase, error, and status | local | `disabled` while working |
| `del-error` | text | `Account not deleted: <message>` | present / absent | — | — | `role="alert"`. **Currently the only reachable outcome** — see § 12 |
| `state-error` | page | `Settings unavailable: <message>` | — | — | — | replaces the **entire page**, including the export and delete panels. Triggered by the initial load *and* by any toggle or timezone failure. See § 6 |
| `state-loading` | page | `Loading settings…` | — | — | — | replaces the entire page until both initial reads settle |

Neither `DataExportPanel` nor `DeleteAccountPanel` takes props; both read the user from `AuthContext`.
Both are documented in `COMPONENT_LIBRARY.md`.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Profile row (for `timezone`, `round_turn_prompt_enabled`) | `fetchProfile(user.id)` | `lib/profile` | Supabase `profiles` | async |
| Notification preference rows | `settingsRepository.listNotificationPreferences(user.id)` | `lib/repository/settingsRepository` | Supabase, **Dexie mirror on success, Dexie fallback on failure** | async |
| Category → enabled lookup | `preferenceMap(rows)` | `lib/notificationPreferences` | — | **pure** |
| Device flair preference | `getFlairMode()` | `lib/viewPreference` | `localStorage`, try/catch-wrapped | sync |
| Timezone validity | `isValidIanaTimezone(value)` | `lib/notificationPreferences` | `Intl` round-trip | **pure** |
| Full account export dataset (54 tables) | `dataExportRepository.collectUserExport(user.id)` | `lib/repository/dataExportRepository` | Supabase, paginated | async, on demand |

Both initial reads run in one `Promise.all` (`SettingsPage.jsx:17-21`), re-run on `user.id` change
only. `fetchProfile` uses `maybeSingle()`; a missing row is substituted with `{ id: user.id }`.
Signatures in `LIB_API_INDEX.md`.

### Writes

| Mutation | Call | Idempotency / boundary |
|---|---|---|
| Round-turn toggle | `upsertProfileFields(user.id, { round_turn_prompt_enabled })` | None. Single Supabase upsert on `id`, last-write-wins |
| Timezone | `upsertProfileFields(user.id, { timezone })` on blur | None. Validated client-side first; the DB CHECK is length 1–100 only, so an invalid-but-short zone would pass the DB |
| Notification preference | `settingsRepository.setNotificationPreference(...)` | Supabase `upsert` on conflict `(user_id, category)` — the composite primary key is the idempotency guarantee. Mirrors into Dexie **after** the remote write returns |
| Flair toggle | `setFlairMode(enabled)` | `localStorage` only. Never leaves the device, never syncs, never exports |
| **Account deletion** | `supabase.rpc('delete_own_account')` via `AuthContext.deleteAccount` (`AuthContext.jsx:39`), then `purgeDeviceData({ storage, database })`, then `signOut()`, then `location.replace('/')` | Server-first ordering is deliberate: the device is cleared **only after** the server confirms, so no stale outbox row can replay against a deleted user |

The local state update in `toggleCategory` is a filter-then-append (`SettingsPage.jsx:30`), so the
preference list is reordered on every toggle. Rendering iterates
`NOTIFICATION_PREFERENCE_CATEGORIES`, not the row array, so the visible order is stable regardless.

`PHASE_A_ARCHITECTURE.md` § 14 owns the transaction contract. **None of this screen's writes follow
it** — no expected version, no occurred time, no source, no installation id, no idempotency key, no
Dexie transaction. § 14 scopes its requirements to activity lifecycle transitions, so these writes are
outside it rather than in violation, but nothing states that exemption.

### Offline

Mixed, and worth stating precisely:

- **Notification preference reads survive.** `settingsRepository.listNotificationPreferences` falls
  back to the Dexie mirror and only throws when the cache is also empty
  (`settingsRepository.js:11-13`).
- **The profile read does not.** `lib/profile` is Supabase-only with no mirror, so an offline load
  rejects and the page renders `state-error` regardless of what the preference cache holds — the
  `Promise.all` fails as a unit.
- **All writes fail.** Preference writes, the round-turn toggle, and the timezone save all hit Supabase
  directly with no outbox. Each rejection sets `error`, which blanks the page.
- **Export refuses deliberately.** `DataExportPanel.jsx:12-16` checks `navigator.onLine` before doing
  anything and returns `Connect to the internet before exporting. A partial device cache is never
  exported.` This is a correct, principled refusal — an export that silently omitted unsynced local
  facts would be worse than no export.
- **The flair toggle works offline** — it is `localStorage` only.

None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`,
`Synced`, `Needs Attention`) is displayed anywhere on this screen, and no sync ledger exists. The
blueprint's Screen 10 sync control row is unbuilt — see § 13.

## 6. Flow paths

**Happy path.** Arrive from ME → both reads resolve → three preference sections plus the two panels
render → toggle a notification category → the upsert resolves → local state updates → the checkbox
stays where the user put it.

**First run / empty.** A fresh account has no `notification_preferences` rows at all. Every one of the
seven toggles renders **checked**, because `enabledByCategory.get(category.id) ?? true` treats absence
as opted-in. Nothing distinguishes "never touched" from "explicitly enabled" in the UI; the first
toggle-off writes the first row. `timezone` renders `UTC` (the column default). The export and delete
panels render identically regardless of account age.

**Error.** This is the screen's weakest behavior and it is not confined to load failure.
`SettingsPage.jsx:39` is `if (error) return <p className="form-error">Settings unavailable:
{error}</p>` — an unconditional early return. Every failure path sets that same `error`:

- the initial `Promise.all` (`SettingsPage.jsx:20`)
- the round-turn toggle's catch (`:47`)
- the timezone blur's catch (`:48`)
- each notification toggle's catch (`:53`)

So a **typo in the timezone field blanks the entire settings screen**, taking the export panel and the
delete panel with it, and leaving no retry control. Recovery requires navigating away and back. See
§ 11 T-settings-1.

**Offline.** As § 5. Reads fail as a unit; writes fail and blank the page; export refuses with a clear
message and no page loss (its status is panel-local, not the page `error`).

**Auth / guard.** `ProtectedRoute` gates the shell. `user.id` is dereferenced unconditionally
(`SettingsPage.jsx:18`), so there is no anonymous rendering path. A Supabase anonymous session renders
and can export — and can attempt deletion, which is the correct behavior for a guest who wants to
leave.

**Interlock.** **N/A** — no cap or capacity constraint applies. The `DELETE` phrase gate is a
confirmation, not an interlock.

**Destructive.** Two, of very different weight.

*Export* is non-destructive but privacy-sensitive: `collectUserExport` walks **35 owner-scoped tables**
(`OWNER_SOURCES`, `dataExportRepository.js:5-41`) plus **6 reached through parent RLS**
(`RLS_DERIVED_SOURCES`, `:43-50`) plus **13 referenced shared catalog tables** resolved by id — 54 CSVs
in total — with 500-row pagination throughout, then
`createExportFiles` renders each to a deterministic, formula-safe, BOM-prefixed CSV under `data/`, adds
`manifest.json` (format version 1, generated-at, source cutoff, account id, per-file row counts,
columns, scope, and three explicit exclusions) and a `README.txt`, and zips it at level 6. Scopes are
labeled `owner`, `owner-via-parent-rls`, `referenced-shared`, and `owner-or-referenced-shared`.
Exclusions are stated in the manifest itself: unsynced device-only data, private photo **binaries**
(metadata and storage paths are included), and server-only catalog/admin/secret data.

*Deletion* is the codebase's only typed-confirmation pattern and its only irreversible action.
Collapsed → `Delete my account` → type `DELETE` exactly → `Permanently delete`. On success the RPC
releases community attribution to `null` on `courses`, `course_aliases`, and `disc_molds`, deletes
`catalog_submission_reviews` rows the user authored, deletes private Storage objects under the user's
prefix, then deletes `auth.users`, which cascades every owner-scoped table
(`20260727120000_phase_e_account_deletion.sql:48-65`). Only then does the client purge Dexie and
`localStorage`, sign out best-effort, and hard-reload.

**In the shipped app this path always fails.** The migration is written and **not applied**
(`docs/development/CURRENT_WORK.md:104-108`), so `supabase.rpc('delete_own_account')` returns an
undefined-function error, `handleDelete` throws before `purgeDeviceData` runs, and the user sees
`Account not deleted: <postgres message>`. The failure is at least safe — server-first ordering means
no local data is destroyed when the server call fails — but the feature does not work. § 12 open
question 1.

## 7. Dependencies

### Schema

- `profiles.timezone` — added by `20260716220000_phase_d3_goal_report_contracts.sql:9-11`, `not null
  default 'UTC'`, CHECK length 1–100.
- `profiles.round_turn_prompt_enabled` — added by
  `20260716213000_phase_d_session_context_fatigue.sql:19-20`, `not null default true`.
- `notification_preferences` — `20260716220000_...:13-22`. Composite PK `(user_id, category)`; the
  category CHECK admits eight values including `sync`, which the UI deliberately does not offer. RLS
  select/insert/update own only; `grant select, insert, update` to `authenticated`
  (`:132-135`).
- Every table in `dataExportRepository`'s `OWNER_SOURCES` (35 entries) and `RLS_DERIVED_SOURCES` (6),
  plus the referenced shared catalog tables resolved by id.
- `public.delete_own_account()` — `20260727120000_phase_e_account_deletion.sql:34-77`. Security
  definer, `set search_path = ''`, no parameters (so no caller can target another user), `revoke all`
  from `public` and `anon`, `grant execute` to `authenticated`. **Written, not applied.**
- **Grant hazard:** `layer5_gamification_hardening.sql:170-176` revoked the table-wide UPDATE on
  `profiles` from `authenticated` and re-granted an explicit 20-column list. That list predates both
  `timezone` and `round_turn_prompt_enabled` and neither Phase D migration re-grants them. See § 12
  open question 2.

### Library

`lib/profile` (`fetchProfile`, `upsertProfileFields`), `lib/repository/settingsRepository`,
`lib/notificationPreferences` (`NOTIFICATION_PREFERENCE_CATEGORIES`, `preferenceMap`,
`isValidIanaTimezone`), `lib/viewPreference` (`getFlairMode`, `setFlairMode`), `lib/dataExport`
(`buildDataExportArchive`, `dataExportFilename`, `downloadDataExport`, `csvCell`, `rowsToCsv`,
`orderedColumns`, `createExportFiles`, `DATA_EXPORT_FORMAT_VERSION`),
`lib/repository/dataExportRepository` (`collectUserExport`, `EXPORT_PAGE_SIZE`), `lib/localPurge`
(`purgeDeviceData`), `lib/db/dexieDb` (`db`). Signatures in `LIB_API_INDEX.md`.

`fflate` (`strToU8`, `zip`) is the one third-party dependency reached from this screen.

### Components

`DataExportPanel`, `DeleteAccountPanel`. Both prop-less, both `AuthContext` consumers. Details in
`COMPONENT_LIBRARY.md`.

### Screens

- `me-root` links in.
- `weekly-reports` depends on `profiles.timezone` set here: `weeklyReportRepository.generate` resolves
  the timezone before computing the Monday–Sunday window
  (`weeklyReportRepository.js:30-34,62-64`). Changing the timezone here changes which activities fall
  into a generated report.
- `notifications` and the shell's `NotificationSheet` consume `notification_preferences`.
- `disc-collection` / `discs-root` consume the flair preference via `getFlairMode`.
- Deletion terminates every screen — it replaces the document.

### Contracts and decisions

`PHASE_A_ARCHITECTURE.md` § 7 (notification contract — the eight categories, of which this screen
exposes seven), § 8 (offline transition), § 12 (presentation/accessibility), § 13 (shell boundaries).
`docs/mobile/IOS_READINESS.md` (Guideline 5.1.1(v)). No blocking ADR.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- Both preference sections are `aria-labelledby` their own `<h2>` ids, as are both panels. Four
  labeled regions, correctly associated.
- Every checkbox is wrapped in a `<label>` that **also** carries `htmlFor` pointing at the input's
  `id` — belt and braces, and correct. The timezone input follows the same pattern.
- `export-status` switches `role` between `status` (progress, success) and `alert` (error), so an
  export failure is announced and a success is announced politely. This is the best status-region
  handling in the ME section.
- `del-error` carries `role="alert"`.
- `del-confirm` stays `disabled` until the phrase matches exactly, so the destructive control cannot be
  reached by mistake — and `del-phrase` has a real `<label>` plus `aria-describedby` pointing at the
  section heading.
- **Gap — the page-blanking error state has no `role="alert"` and no focus move.** When
  `state-error` replaces the page, a screen-reader user is given no announcement that the entire
  screen just changed; focus remains on a control that no longer exists.
- **Gap — `del-error`'s `aria-describedby` points at the heading, not at the consequences paragraph.**
  The consequences copy (`del-note`) is the text a user most needs read before typing `DELETE`, and it
  is not programmatically associated with the input.
- **Gap — no confirmation of scope before export.** The export begins on a single tap with no
  interstitial. That is a usability choice rather than an a11y defect, but the archive contains the
  full account history including `injury_notes`, and the warning only appears *after* the download.
- **Gap — the destructive control sits in the normal scroll flow** directly below the export panel.
  § 12 requires that "destructive actions do not sit beside scoring actions" — satisfied literally
  (there are no scoring actions here) but the two-tap distance from `Export my data` to
  `Delete my account` is short.
- Heading tree is well-formed: `h1` from `GlobalHeader.jsx:13`, then four `<h2>`s. No duplicate `h1`
  on this screen, unlike `me-root`, `trophy-room`, and `weekly-reports`.

## 9. Events and telemetry

**Metrics:** none emitted (`PHASE_A_ARCHITECTURE.md` § 5).

**Notifications:** this screen does not produce notifications; it configures them. The seven
categories map onto § 7's initial category list — `activity`, `lost_disc`, `weekly_report`,
`equipment`, `community_review`, `achievement`, `coaching`. § 7's eighth category, `sync`, is
present in the DB CHECK and deliberately withheld from the UI, backed by the `notif-note` copy
`Critical sync and data-safety alerts always remain on.` That is a coherent product decision, correctly
implemented, and worth preserving.

**Lifecycle events:** none written (§ 2).

**Audit:** account deletion writes no `audit_events` row — by design, since the RPC's final act
cascades the user's own audit rows away. Preference and timezone changes write no audit trail either,
which is less obviously intended: `PRODUCT_ROADMAP.md` § Cross-cutting rules asks corrections to
preserve previous/new values, and a timezone change silently redefines every subsequently generated
weekly report's boundaries.

## 10. Tests

### Existing coverage

| Test file | What it covers |
|---|---|
| `src/lib/dataExport.test.js` | CSV cell escaping, formula-prefix neutralization, deterministic column ordering, row sorting, manifest shape |
| `src/lib/repository/dataExportRepository.test.js` | Pagination, owner scoping, referenced-shared resolution, merge behavior |
| `src/lib/notificationPreferences.test.js` | Default-on behavior for missing categories, explicit opt-out, IANA timezone validation |
| `src/lib/localPurge.test.js` | Key selection, localStorage purge resilience, Dexie close-then-delete, blocked-delete reporting, combined `purgeDeviceData` |
| `src/lib/storagePersistence.test.js` | Storage persistence request (adjacent; not called by this page) |

Confirmed by reading the imports of `SettingsPage.jsx`, `DataExportPanel.jsx`, and
`DeleteAccountPanel.jsx`. `TEST_MAP.md` § ME's row for `settings` is accurate.

**Not covered:**

- No page or component test for any of the three components — consistent with `TEST_MAP.md`
  § The headline.
- No test for `settingsRepository` at all. Its Dexie-fallback branch — the one behavior that makes
  preferences readable offline — is unverified.
- **No migration contract test for `20260727120000_phase_e_account_deletion.sql`**, although the
  repo has exactly this pattern for two earlier migrations (`src/lib/phaseD2Migration.test.js`,
  `src/lib/phaseD3ContractsMigration.test.js`). A test asserting the security-definer boundary, the
  empty `search_path`, the `anon` revoke, and the community-attribution nulling would have been cheap
  and is the single highest-value missing test on this screen.
- `lib/profile` has no test file at all.

### Acceptance criteria

1. A fresh account with zero `notification_preferences` rows renders all seven toggles checked.
2. Toggling one category off writes exactly one row and leaves the other six absent.
3. The `sync` category never appears in the UI, and the always-on note is visible above the list.
4. Blurring the timezone field with `America/New_York` saves it; with `Not/AZone` it does not, and
   surfaces the stated message.
5. Blurring the timezone field emptied saves `UTC`.
6. The flair toggle survives a reload on the same device and does **not** appear in the export.
7. `Export my data` while offline shows the refusal message and performs no fetch.
8. A completed export contains `manifest.json` with `format_version: 1`, one `files` entry per dataset
   with a matching `row_count`, and the three exclusion strings.
9. `Permanently delete` stays disabled for `delete`, `Delete `, and `DELET`; it enables only for
   `DELETE`.
10. *Currently failing.* Confirming deletion removes the account and lands on `/`. Today it renders
    `Account not deleted: <undefined function>` — see § 12 open question 1.
11. *Currently failing / needs live verification.* Toggling the round-turn check-in and saving a
    timezone both persist. If the column grant hazard in § 12 open question 2 is real, both are
    rejected with `permission denied for table profiles`, which then blanks the page.

### E2E critical paths

- Toggle every notification category off, reload, confirm all seven persist as off.
- Timezone change → generate a weekly report on `/profile/reports` → confirm the window boundaries
  shifted.
- Export end to end: tap → ZIP downloads → unzip → manifest row counts match the account's real data.
- Offline export refusal → reconnect → export succeeds.
- Deletion, in a disposable account, in this order: a second user's rows survive; community
  `created_by` is nulled rather than the rows deleted; private Storage objects under the user's prefix
  are gone; `anon` cannot execute the function. This is exactly the smoke test
  `docs/development/CURRENT_WORK.md:106-108` prescribes.
- Error containment: cause one toggle to fail and confirm the rest of the page survives (currently it
  does not).

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9); these are backlog entries. See
`TEST_MAP.md` § E2E backlog.

## 11. Tasks

#### T-settings-1 — Stop a single failed toggle from blanking the page

- **Capability:** `ui-routine`
- **Touches:** `src/pages/SettingsPage.jsx`
- **Done when:** A failed notification toggle, round-turn toggle, or timezone save renders an inline,
  dismissible error next to the failing control and leaves every other section — including the export
  and delete panels — rendered and usable. The page-replacing error is reserved for initial load
  failure and gains a `Retry` control.
- **Verify:** `npm test` with a page-level test that rejects one toggle and asserts the delete panel
  still renders.
- **Commit:** `fix: contain settings errors to the failing control`

#### T-settings-2 — Apply the account-deletion migration

- **Capability:** `schema`
- **Touches:** `supabase/migrations/20260727120000_phase_e_account_deletion.sql` (apply only — no edit)
- **Done when:** `public.delete_own_account()` exists in the deployed database, `authenticated` can
  execute it, `anon` cannot, and the Settings delete button completes end to end on a disposable
  account.
- **Verify:** the four-part smoke test in `docs/development/CURRENT_WORK.md:106-108`, run in a
  rollback-only transaction where possible.
- **Commit:** `chore: apply the phase E account deletion migration`
- **Blocked by:** nothing. This is the App Review blocker; it should land before anything else on this
  screen.

#### T-settings-3 — Add a migration contract test for account deletion

- **Capability:** `security`
- **Touches:** `src/lib/phaseEDeletionMigration.test.js` (new)
- **Done when:** A test in the style of `phaseD3ContractsMigration.test.js` asserts, from the SQL text:
  security definer with `set search_path = ''`, zero parameters, `revoke all` from `public` and `anon`,
  `grant execute` to `authenticated`, the three community-attribution `update ... set created_by =
  null` statements, the `catalog_submission_reviews` delete, the Storage-prefix delete, and the final
  `delete from auth.users`.
- **Verify:** `npm test`
- **Commit:** `test: pin the account deletion migration contract`

#### T-settings-4 — Verify and repair the `profiles` column UPDATE grants

- **Capability:** `security`
- **Touches:** a new migration under `supabase/migrations/`
- **Done when:** `has_column_privilege('authenticated', 'profiles', 'timezone', 'UPDATE')` and the same
  for `round_turn_prompt_enabled` both return `true`, and neither returns `true` for `xp` or `level`.
- **Verify:** the two `has_column_privilege` queries against the deployed database, plus a manual
  timezone save at `/profile/settings`.
- **Commit:** `fix: grant update on profile columns added after the layer 5 hardening`
- **Blocked by:** § 12 open question 2 — confirm the hazard is real before writing the migration.

#### T-settings-5 — Cover `settingsRepository`'s offline fallback

- **Capability:** `data-access`
- **Touches:** `src/lib/repository/settingsRepository.test.js` (new)
- **Done when:** Tests assert that a remote failure with a populated Dexie mirror returns cached
  preferences, that an empty mirror rethrows, and that a successful read repopulates the mirror.
- **Verify:** `npm test`
- **Commit:** `test: cover the settings repository offline fallback`

#### T-settings-6 — Announce the page-level error state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/SettingsPage.jsx`
- **Done when:** Whatever error state survives T-settings-1 carries `role="alert"` and moves focus, so
  a screen-reader user is told the screen changed.
- **Verify:** `npm run lint` plus a VoiceOver pass on a forced load failure.
- **Commit:** `fix: announce settings load failures`

## 12. Open questions

1. **In-app account deletion does not work.** `20260727120000_phase_e_account_deletion.sql` is written
   and **not applied** (`docs/development/CURRENT_WORK.md:104-108`), so
   `supabase.rpc('delete_own_account')` (`AuthContext.jsx:39`) returns an undefined-function error and
   `del-error` renders `Account not deleted: <message>`. Two consequences:
   - **App Review blocker.** Guideline 5.1.1(v) requires working in-app deletion for any app that
     creates accounts. `docs/mobile/IOS_READINESS.md:19` lists "no in-app account deletion" under
     **Fixed 2026-07-27**, which is true of the UI and false of the flow. Logged as C-3 in
     `docs/ui/_corrections/me-screens.md`.
   - The failure is at least fail-safe: server-first ordering (`DeleteAccountPanel.jsx:26-43`) means
     `purgeDeviceData` never runs, so no local data is destroyed by the failed attempt.
2. **`profiles.timezone` and `profiles.round_turn_prompt_enabled` may not be updatable by
   `authenticated`.** `layer5_gamification_hardening.sql:170-176` runs `revoke update on profiles from
   authenticated` and then re-grants UPDATE on an explicit 20-column list — a list that contains
   neither column, because both were added later:
   `round_turn_prompt_enabled` by `20260716213000_...:19-20` and `timezone` by
   `20260716220000_...:9-11` (both 2026-07-16; the hardening file was committed 2026-07-11 in
   `7b81e89`). Neither Phase D migration issues a compensating grant — verified by grepping both files
   for `grant`. If the hardening's correction block was applied as its comment says
   (`layer5_gamification_hardening.sql:162-169` states it was), then `pref-timezone` and
   `pref-roundturn` both fail with `permission denied for table profiles`, which by § 6 blanks the
   entire settings page. **This cannot be settled from the repository** — it depends on deployed grant
   state. Resolve with:
   ```sql
   select has_column_privilege('authenticated', 'public.profiles', 'timezone', 'UPDATE'),
          has_column_privilege('authenticated', 'public.profiles', 'round_turn_prompt_enabled', 'UPDATE');
   ```
   Logged as C-4 in `docs/ui/_corrections/me-screens.md`.
3. **A blur-to-save timezone field has no visible confirmation.** `pref-timezone` saves on blur with no
   success indicator, no dirty state, and no revert. A user who types a valid-but-wrong zone gets
   silence and then differently-bounded weekly reports. Should it confirm, or should it be a picker
   rather than free text? A picker would also remove the invalid-input path entirely.
4. **The flair preference is device-local and invisible in the export.** `getFlairMode`/`setFlairMode`
   use `localStorage` (`viewPreference.js:22-36`), so the toggle silently means something different
   from its two neighbours, which are account-level. The description says "on this device," which is
   honest, but nothing groups device settings apart from account settings, and the export's "unsynced
   device-only data" exclusion covers it without naming it.
5. **`del-phrase` is case-sensitive against a hardcoded English word.** `CONFIRM_PHRASE = 'DELETE'`
   (`DeleteAccountPanel.jsx:6`). Any future localization breaks the gate or forces an untranslated
   English word on every user. Not urgent; worth deciding before localization.
6. **The export has no progress granularity and no cancel.** `collectUserExport` fetches 54 tables in
   two `Promise.all` waves with 500-row pages; a large account produces a long opaque
   `Reading your authoritative account data…`. There is no per-table progress, no row estimate, and no
   way to abort.

## 13. Blueprint divergence

Blueprint Screen 10 is *Global Analytics & Settings Control Tower*
(`MASTER_PROJECT_BLUEPRINT.md:574`). It does **not** exist as a standalone destination: its analytics
half lives on `practice-stats` and `me-root`, and its settings/portability half lives here.
`SCREEN_SPECS.md:38` still marks Screen 10 `IN SCOPE` as a standalone screen, contradicting the same
file's own 2026-07-11 note; the owner ruled on 2026-07-29 that the roadmap's distributed model is
authoritative. Logged as C-2 in `docs/ui/_corrections/screen-specs-and-agents.md` — referenced here,
not re-logged.

| Blueprint Screen 10 feature | Shipped reality |
|---|---|
| Time-series C1 accuracy chart with 7/30/90-day chips | **Not here.** Trend analytics live on `practice-stats` (`ConfidenceMapPage`) |
| Equipment-milestone ★ injections on the trend chart | **Not built anywhere.** `layer5_disc_role_history_schema.sql` exists as the data source; no chart consumes it |
| Local Dexie storage + Supabase sync control row, `🔄 SYNC NOW`, auto-sync-on-cellular toggle | **Not built.** No sync ledger, no pending-write count, no manual sync trigger, and no calm-state indicator anywhere on this screen |
| Behavioral toggles: units, default stack size, haptics, voice registration | **Split and partly unbuilt.** `units` lives on `/profile/details`; stack size, haptics, and voice have no settings surface. The two toggles that *are* here (flair, round-turn) have no blueprint counterpart |
| `⌚ WEARABLES HUB` shortcut to Screen 16 | Not built — Screen 16 is PARKED (Hardware) |
| `📥 EXPORT LOCAL LOGS TO CSV` — compress **local Dexie tables**, invoke the native share sheet | **Ships, inverted.** The E1 export (2026-07-17) is **remote-authoritative**: paginated Supabase reads under the caller's RLS session, deterministic CSVs, a versioned manifest, and a browser download rather than a share sheet. Unsynced local facts and private photo binaries are explicit exclusions. `SCREEN_SPECS.md` Screen 10 records this divergence directly. The inversion is deliberate — exporting a partial device cache and calling it "your data" would be dishonest |
| `🔴 CLEAR CACHE & LOCAL STORAGE` behind a 2-step non-overlapping-tap modal | **Not built as a user control.** `purgeDeviceData` exists and is called, but only as a step inside account deletion. There is no standalone cache-clear affordance and no 2-step modal |
| — | **Account deletion has no blueprint counterpart at all.** Screen 19 (*Privacy & Data Sovereignty Hub*, PARKED) holds the legal/purge half; deletion was pulled forward into Phase E as an App Store requirement, not a blueprint deliverable |

Standing divergences #1 (React/Vite, not Expo) and #2 (staged Dexie adoption — which is why there is
no local sync ledger to report on) apply; see `SCREEN_SPECS.md` § Standing divergences.
