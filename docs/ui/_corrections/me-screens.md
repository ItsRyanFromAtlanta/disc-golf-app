# Corrections — ME screen documents

Contradictions found between existing documents and the code while authoring the six ME screen
documents (`me-root`, `profile-details`, `settings`, `goals`, `weekly-reports`, `trophy-room`).

**Recorded, not fixed** (`docs/ui/README.md` § Working rules 5). No file outside `docs/ui/` was
edited. Verified against `7351964` on branch `claude/ui-documents-status-3fphcw`, 2026-07-29.

Each entry: the claim, the code evidence, the correct fact, and a suggested resolution.

Already logged elsewhere and **deliberately not repeated here**:

- Screens 10 and 11 marked `IN SCOPE` as standalone destinations —
  `_corrections/screen-specs-and-agents.md` C-2 (owner ruled 2026-07-29 that the roadmap's distributed
  model is authoritative).
- `AGENTS.md:260` heading "(planned, Layer 5)" for shipped gamification —
  `_corrections/lib-api-index.md` item 2.
- `BadgeInspectDrawer` / `XpLedgerModal` hand-rolled modal semantics — `COMPONENT_LIBRARY.md` § Gaps
  item 4, referenced from `screens/trophy-room.md` § 8.

---

## C-1 — `PRODUCT_ROADMAP.md` says ME links to History and contextual analytics; it does not

**Where:** `PRODUCT_ROADMAP.md:28-29`

**Claims:**

> - ME opens on a takeaway-first analytics summary and links to Profile, Settings, Weekly Reports,
>   History, Trophy Room, and detailed contextual analytics.

**Evidence:** `src/pages/CareerHubPage.jsx:29-35` renders exactly five links, and no others:

| Line | Label | Destination |
|---|---|---|
| `:30` | `Trophies` | `/profile/trophies` |
| `:31` | `Edit profile` | `/profile/details` |
| `:32` | `Settings` | `/profile/settings` |
| `:33` | `Goals` | `/profile/goals` |
| `:34` | `Reports` | `/profile/reports` |

`grep -rn "'/practice/history'\|'/practice/stats'" src/pages/CareerHubPage.jsx` returns nothing. The
first clause of the roadmap sentence is correct — ME does open on a takeaway-first analytics summary,
and `SCREEN_INVENTORY.md:80-82` cites this same line for it. The link list is where it diverges: two
of the six named destinations are absent, and one destination that *is* present (`Goals`) is not named
in the roadmap.

**Severity:** medium. An agent implementing "ME links to History" would believe the link exists and
look for a bug; an agent auditing the roadmap would believe the screen is complete.

**Suggested resolution (not applied):** either add the two links to `CareerHubPage.jsx` (tracked as
`T-me-root-4` in `screens/me-root.md`) or amend `PRODUCT_ROADMAP.md:28-29` to the shipped five. The
decision belongs to the owner; the doc and the code must not both stand.

---

## C-2 — `profiles.current_rating` does not exist; the shipped column is `pdga_rating`

**Where:** `SCREEN_SPECS.md:304` (Screen 11 dependency list) **and** `src/pages/CareerHubPage.jsx`

**Claims:**

> - **Dependency:** Layer 1 — `profiles.pdga_number/division/current_rating/target_rating`; …

**Evidence:**

- The column shipped as `pdga_rating`, not `current_rating`:
  `layer1_foundation_schema.sql:48-52` —
  ```sql
  alter table profiles
    add column if not exists pdga_rating integer,
  ```
  and it is named `pdga_rating` again in the column-level UPDATE grant list at
  `layer5_gamification_hardening.sql:175`, and in `DEVLOG.md:1844`.
- `grep -rn "current_rating" --include=*.sql .` matches **nothing**. The identifier exists nowhere in
  any schema or migration file.
- The page nevertheless reads it three times:
  - `src/pages/CareerHubPage.jsx:24` — `profile.current_rating && profile.target_rating`
  - `src/pages/CareerHubPage.jsx:25` — `Math.round(profile.current_rating / profile.target_rating * 100)`
  - `src/pages/CareerHubPage.jsx:41` — `Current {profile.current_rating ?? '—'}`

**Correct fact:** `profile.current_rating` is always `undefined`. Three user-visible consequences,
all live in production:

1. The identity card's `Current` value always renders `—`.
2. `ratingProgress` is always `null`, so the progress bar always has `width: 0%`.
3. Its `aria-label` always reads `Rating progress unavailable`.

Compounding it: **no UI anywhere writes `pdga_rating`.** `grep -rn "pdga_rating" src/` returns nothing.
`ProfilePage.jsx:296-303` edits `target_rating` only. So even after the read is corrected, the field
has no entry point, and the target-rating progress bar — the headline element of blueprint Screen 11 —
cannot function.

**Severity:** high. This is a shipped defect, not only a documentation error, and it went undetected
because there is no page test for `CareerHubPage.jsx` (`TEST_MAP.md` § The headline).

**Suggested resolution (not applied):** three separate changes, in order —

1. Correct `SCREEN_SPECS.md:304` to name `pdga_rating`.
2. Change `CareerHubPage.jsx` to read `profile.pdga_rating` (`T-me-root-1` in `screens/me-root.md`).
3. Decide where `pdga_rating` gets written — a field on `/profile/details` is the obvious home — or
   accept that the current-rating bar is permanently inert and remove it.

---

## C-3 — `IOS_READINESS.md` lists in-app account deletion as fixed; the flow does not work

**Where:** `docs/mobile/IOS_READINESS.md:19`, under the heading **`## Fixed 2026-07-27 (web/PWA, ahead
of any native work)`** whose lead sentence reads "All are fixed; none required Capacitor."

**Claims:**

> - There was no in-app account deletion — a hard App Review rejection under Guideline 5.1.1(v).

**Evidence:**

- The UI ships: `src/pages/SettingsPage.jsx:56` renders `<DeleteAccountPanel />`, which implements the
  typed-`DELETE` confirmation and the server-first purge ordering
  (`src/components/DeleteAccountPanel.jsx:22-48`).
- The RPC it calls does not exist in the deployed database.
  `src/context/AuthContext.jsx:39` — `deleteAccount: () => supabase.rpc('delete_own_account')`.
  `supabase/migrations/20260727120000_phase_e_account_deletion.sql:34` creates
  `public.delete_own_account()`, and `docs/development/CURRENT_WORK.md:104-108` states:

  > - **`20260727120000_phase_e_account_deletion.sql` is written but NOT applied.** It creates the
  >   `public.delete_own_account()` security-definer RPC. Until it is applied, the Settings delete
  >   button fails with an undefined-function error.

**Correct fact:** the *user interface* for account deletion was added on 2026-07-27; the *capability*
was not. Tapping `Permanently delete` renders
`Account not deleted: <undefined function>` via `DeleteAccountPanel.jsx:98`. The App Review blocker
under Guideline 5.1.1(v) is therefore **still open**, which is the opposite of what a reader of
`IOS_READINESS.md` § Fixed would conclude — and that document is the one a release manager would
consult before submitting.

The failure is at least fail-safe: server-first ordering means `purgeDeviceData` never runs when the
RPC fails, so no local data is destroyed by the failed attempt.

**Severity:** high. Two documents in the same repository make opposite claims about a store-submission
blocker.

**Suggested resolution (not applied):** apply the migration (`T-settings-2` in `screens/settings.md`)
and then the `IOS_READINESS.md` line becomes true. Until it is applied, qualify the bullet — e.g.
"in-app account deletion UI ships; its migration is pending, see `CURRENT_WORK.md`" — so the two
documents stop disagreeing. Also add the missing migration contract test (`T-settings-3`); the repo
already has this pattern for two earlier migrations and has none for this one.

---

## C-4 — `profiles.timezone` and `round_turn_prompt_enabled` may have no UPDATE grant

**Where:** `layer5_gamification_hardening.sql:170-176` against
`supabase/migrations/20260716213000_phase_d_session_context_fatigue.sql:19-20` and
`supabase/migrations/20260716220000_phase_d3_goal_report_contracts.sql:9-11`

**Claims:** nothing textually — this is a contradiction between two schema files rather than between a
document and the code, recorded here because it determines whether a shipped screen works.

**Evidence:**

- `layer5_gamification_hardening.sql:162-176` replaces the table-wide UPDATE grant with an explicit
  column list, and its own comment explains why a column-level revoke alone was insufficient:
  ```sql
  revoke update on profiles from authenticated;
  grant update (
    id, username, pdga_number, division, home_course_id, created_at, handedness,
    bh_confidence, fh_confidence, bh_max_distance_ft, bh_max_distance_source,
    fh_max_distance_ft, fh_max_distance_source, c1_comfort_ft, c1_comfort_source,
    specialty_shots, target_rating, units, injury_notes, pdga_rating
  ) on profiles to authenticated;
  ```
  The comment at `:162-169` states this correction was "applied as a follow-up migration" and verified
  with `has_column_privilege`.
- Neither `timezone` nor `round_turn_prompt_enabled` appears in that list, because both were added
  **after** it. Commit dates: `layer5_gamification_hardening.sql` in `7b81e89` (2026-07-11);
  `round_turn_prompt_enabled` in `ae00e62` (2026-07-16); `timezone` in `a822683` (2026-07-16).
- Neither Phase D migration issues a compensating grant. `grep -n "grant\|revoke"` over both files
  returns grants for `practice_fatigue_checkins`, `notification_preferences`, `goals`, `goal_events`,
  and `weekly_report_snapshots` only — nothing touching `profiles`.
- Both columns are written from `/profile/settings`:
  `src/pages/SettingsPage.jsx:47` (`round_turn_prompt_enabled`) and `:48` → `:33-37`
  (`timezone`), both through `upsertProfileFields` (`src/lib/profile.js:13-21`), whose `upsert` becomes
  an UPDATE for an existing row.

**Correct fact — pending live verification.** If the hardening's re-grant is applied as its comment
says, `authenticated` holds no UPDATE privilege on either column, and both Settings controls fail with
`permission denied for table profiles`. Because `SettingsPage.jsx:39` returns a page-replacing error
for *any* error, that failure blanks the whole Settings screen — taking the export and delete panels
with it.

**This cannot be settled from the repository.** It depends on deployed grant state. Resolve with:

```sql
select has_column_privilege('authenticated', 'public.profiles', 'timezone', 'UPDATE'),
       has_column_privilege('authenticated', 'public.profiles', 'round_turn_prompt_enabled', 'UPDATE');
```

**Severity:** high if real (two shipped controls broken, plus a page-blanking failure mode), zero if
the re-grant was never applied to the live database. Either way the repository is internally
inconsistent: a column list that must be maintained in lockstep with every future `profiles` column,
with nothing enforcing it.

**Suggested resolution (not applied):** run the verification query. If privileges are missing, add a
migration granting UPDATE on both columns (`T-settings-4` in `screens/settings.md`). Independently,
add a migration contract test for `layer5_gamification_hardening.sql` (`T-trophy-room-6`) that pins
the grant list, so the next `profiles` column addition fails loudly rather than silently.

---

## C-5 — The weekly-report notification is unproduced, and its default destination is the wrong screen

**Where:** `src/lib/notifications.js:28`, `src/lib/notificationPreferences.js:4`, and
`src/lib/notificationProducers.js`

**Claims:** `PHASE_A_ARCHITECTURE.md:99-104` (§ 7 Notification contract) lists `weekly report` among
the initial notification categories, and `PRODUCT_ROADMAP.md:124-125` records Phase D3's "weekly
deterministic report snapshots/version history" as COMPLETE.

**Evidence — three independent gaps in one feature:**

1. **No producer.** `src/lib/notificationProducers.js` emits exactly two action types:
   `activity_review` (`:12`) and `sync_review` (`:28`). `grep -rn "weekly_report" src/` finds the
   category constant, the destination branch, and the export table list — **no insert path**. No
   `weekly_report` notification is ever created.
2. **No scheduler.** `weeklyReportRepository.generate` writes `generation_reason` as `manual` or
   `correction_regeneration` only (`src/lib/repository/weeklyReportRepository.js:79`), never
   `scheduled` — which is nonetheless the column's DB default
   (`20260716220000_...:100-101`). `supabase/functions/` does not exist and no client scheduler was
   found. A user who never taps `Generate last week` never has a weekly report.
3. **Wrong default destination.** `src/lib/notifications.js:28` —
   ```js
   if (type === 'weekly_report') return payload.href ?? '/profile'
   ```
   With no explicit `href`, a weekly-report notification navigates to `me-root`
   (`CareerHubPage`), not to `/profile/reports` (`WeeklyReportsPage`). The reports screen is
   unreachable from its own notification.

Meanwhile `/profile/settings` offers a `Weekly report` toggle labelled "Your deterministic
Monday–Sunday recap" (`notificationPreferences.js:4`) that controls a notification which cannot occur.

**Severity:** medium. Nothing is broken in a way a user can see failing, but the app offers a
preference for a capability it does not have, and the one line that would route the notification
points at the wrong screen.

**Suggested resolution (not applied):** decide whether scheduled/notified weekly reports are in scope
(`T-weekly-reports-2` in `screens/weekly-reports.md`). Regardless of that decision, correct the
destination to `/profile/reports` (`T-weekly-reports-1`) — it is a one-line fix and the current value
is wrong under either outcome.

---

## C-6 — `NAVIGATION_MAP.md` says one query-parameter contract exists; there are eight

**Where:** `docs/ui/NAVIGATION_MAP.md:169-172` (§ Deep links)

**Claims:**

> One query-parameter contract exists in the shipped app:
> `/bag/lost-found?disc=:discId`, linked from `disc-detail`.

**Evidence:** `grep -rn "useSearchParams" src/pages/` returns seven pages, consuming eight distinct
parameters:

| Route | Parameter(s) | Reader |
|---|---|---|
| `/practice/freeform` | `distance` | `src/pages/FreeformLogPage.jsx:66` |
| `/practice/regimens/new` | `clone` | `src/pages/RoutineBuilderPage.jsx:46` |
| `/bag/locker` | `addToBag` | `src/pages/BagLockerPage.jsx:19` |
| `/bag/compare` | `ids` (repeatable and/or comma-joined) | `src/pages/DiscComparePage.jsx:71-76` |
| `/bag/lost-found` | `disc` | `src/pages/LostFoundPage.jsx:54` |
| `/bag/discs/new` | `mold`, `plastic` | `src/pages/DiscFormPage.jsx:44,51` |
| `/rounds/new` | `courseId`, `layoutId` | `src/pages/RoundStartPage.jsx:13-14` |

The one relevant to this batch is `/practice/freeform?distance=<ft>`, written by
`src/pages/TrophyRoomPage.jsx:52-55` (`launchPursuit`) from both `ActivePursuits` and
`BadgeInspectDrawer`, and read by `FreeformLogPage.jsx:66` to seed the launcher's pending distance. It
is a genuine cross-section contract: a ME screen deep-linking into a PLAY active-shell route.

**Correct fact:** the deep-link surface is eight parameters across seven routes, not one. The
following sentence in the same paragraph — "A screen that accepts query parameters must document them
in its Entry and exit table" — remains correct and is followed by `screens/trophy-room.md` § 2.

**Not a new finding — consolidating three partial ones.** Concurrent sessions logged the same
undercount from their own screens, each seeing part of the surface:

| Existing entry | Scope it saw |
|---|---|
| `_corrections/courses-screens.md` CS-2 | "there are two" — adds `/rounds/new?courseId=&layoutId=` |
| `_corrections/capture-screens.md` C-8 | `/practice/freeform?distance=` and `/bag/lost-found?disc=` |
| `_corrections/discs-screens.md:211` | the same `NAVIGATION_MAP.md` line, from the DISCS side |

This entry is retained not to re-log the contradiction but because the table above is the **complete**
enumeration — no single screen batch could see it, and CS-2's proposed edit ("change 'one' to 'two'")
would leave the line wrong by six.

**Severity:** medium. `NAVIGATION_MAP.md` is the file screen authors are told to link to rather than
restate; an author trusting this line would omit a parameter contract from their Entry and exit table.

**Suggested resolution (not applied):** replace the sentence with the table above — resolving CS-2,
C-8, and the `discs-screens.md` note in one edit rather than three incremental ones. This is a
`docs/ui/` file, so it is fixable in place; it is recorded rather than edited because four sessions are
writing into that directory concurrently and the fix should land once, reviewed.

---

## Checked and found accurate (no correction needed)

Recorded so a later reader does not re-verify these:

- `SCREEN_INVENTORY.md:80-82` — "`me-root` renders `CareerHubPage`, not `ProfilePage`." Confirmed at
  `src/App.jsx:80-82`.
- `SCREEN_INVENTORY.md` ME table — all six route ids, paths, components, shells, and pill values match
  `src/lib/routeMetadata.js:252-311` exactly, including the `preserveNestedState` split (true for
  `profile-details`, `settings`, `goals`; false for `me-root`, `weekly-reports`, `trophy-room`).
- `TEST_MAP.md:78-83` — every ME row's related-test list matches the imports of its page component.
  The `settings` note "Account deletion is untested and its migration is unapplied" is correct on both
  counts.
- `SCREEN_SPECS.md:78` and `:322-324` — Screen 12 ships without the Virtual Bag Tag, peer challenge,
  and QR Beam. Confirmed: no `bag tag`, `challenge`, or `lz-string` reference exists in
  `src/pages/TrophyRoomPage.jsx` or `src/components/trophyRoom/`, and the page's own comment records
  the same decision at `TrophyRoomPage.jsx:18-20`.
- `SCREEN_SPECS.md:280-285` — the E1 export divergence (remote-authoritative paginated CSVs, versioned
  manifest, unsynced local facts and photo binaries excluded). Confirmed against
  `src/lib/repository/dataExportRepository.js:66-77` (pagination), `src/lib/dataExport.js:71-84`
  (manifest with `format_version` and three exclusions), and
  `src/components/DataExportPanel.jsx:12-16` (the offline refusal).
- `COMPONENT_LIBRARY.md` entries for `EditableSection`, `SkillRadar`, `DataExportPanel`,
  `DeleteAccountPanel`, and all five `trophyRoom/` components — props, variants, consumers, and
  accessibility notes all match the current source.
- `notification_preferences`' category CHECK admits `sync`
  (`20260716220000_...:15-18`) while `NOTIFICATION_PREFERENCE_CATEGORIES` omits it. **Not a
  contradiction** — it is deliberate, and `SettingsPage.jsx:52` states the reason to the user:
  "Critical sync and data-safety alerts always remain on."
