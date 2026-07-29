# Corrections Ledger

Disposition of every entry that passed through `docs/ui/_corrections/`.

The 33-screen documentation pass deliberately did not fix the contradictions it found in existing root
documents. It quarantined them under `_corrections/`, with `file:line` evidence, so root documents would
not churn while parallel sessions worked. **That reconciliation ran on 2026-07-29 and the quarantine is
cleared.** This file replaces it.

**Why this file exists rather than nothing.** Roughly 240 citations across the screen documents refer to
corrections by their id (`_corrections/play-screens.md` P-7, `courses-screens.md` CS-4, and so on). Those
ids are the handle; this table is where they resolve. It also honors the house rule that superseded
reasoning is marked, never deleted — three entries here were **rejected on verification**, and a reader
who finds one cited in a screen document needs to know that before acting on it.

The applied edits themselves carry their own inline provenance in the target documents (each is dated
2026-07-29 and names the correction it came from), so the reasoning survives where it is used, not only
here.

## How to read this

| Disposition | Meaning |
|---|---|
| **Applied** | The proposed edit was made to the named document. |
| **Rejected** | Verified false or superseded. Do not act on it. Reason given. |
| **Resolved** | The condition it reported no longer holds; nothing to apply. |
| **Registered** | Real, but a code defect rather than a document edit. Lives in `DEFECT_REGISTER.md`. |
| **Carried** | Still outstanding. Reason given. |

## `screen-specs-and-agents.md`

| id | Subject | Disposition |
|---|---|---|
| C-1 | Screen 8 sign-off gate is stale; the tap-input decision was made and built 2026-07-08 | **Applied** — `SCREEN_SPECS.md` Screen 8 divergence bullet and § Suggested build order |
| C-2 | Screens 10/11 marked `IN SCOPE` against the file's own 2026-07-11 distribution note | **Applied** — `SCREEN_SPECS.md` status legend (new `DISTRIBUTED` status), status table rows 10–11, and both screen sections. Owner ruled 2026-07-29 that the roadmap's distributed model is authoritative |
| C-3 | Screen 6 describes one page; the feature set shipped across three surfaces | **Applied** — `SCREEN_SPECS.md` Screen 6, marked superseded as a single-screen plan with a where-it-actually-shipped table. The `discs.role` schema reasoning is retained as still-authoritative |
| C-4 | `AGENTS.md` open questions are now ADRs | **Applied** — `AGENTS.md` § Not yet decided. The entry said "do not remove the bullets while the ADRs are still `Proposed`"; all three are now **accepted**, so the condition is met |
| C-5 | § 13 canonical destinations read as contradicting the router | **Applied** — `PHASE_A_ARCHITECTURE.md` § 13, distinguishing section names from URL paths, plus the omitted `courses` section |

## `component-library.md`

| id | Subject | Disposition |
|---|---|---|
| 1 | `SCREEN_SPECS.md:160` names `FlightChart`; `BagPage` renders `FlightSpectrum` | **Applied** — `SCREEN_SPECS.md` Screen 5 REUSE (also covers `flightChartPoints` → `buildFlightSpectrum`) |
| 2 | `AGENTS.md:106` claims a reusable `ModeCard`; the component is dead and the page inlines its markup | **Applied** — `AGENTS.md` § Practice menu design, restated as a CSS convention with the ambiguity named |
| 3 | `DEVELOPMENT_PLAN.md` J1 claims `DiscCard` reuse | **Applied** — `DEVELOPMENT_PLAN.md` § J1 Reuse bullet, merged with `courses-screens.md` CS-4 into one edit |

## `lib-api-index.md`

| id | Subject | Disposition |
|---|---|---|
| 1 | `SCREEN_SPECS.md:120,163` cite `discLocker.searchMolds`, removed in `6c88410` | **Applied** — `SCREEN_SPECS.md` Screens 3 and 5, replaced with `catalogRepository.filterCatalogMolds` + `useCatalog` |
| 2 | `AGENTS.md:260` heading marks gamification "planned"; it ships | **Applied** — `AGENTS.md` § Gamification retitled and put in present tense |

## `capture-screens.md`

| id | Subject | Disposition |
|---|---|---|
| C-6 | `FreeformLogPage` declares `shell: ACTIVE` but composes an unbounded log list below the canvas | **Applied as a recorded non-conformance** — `PHASE_A_ARCHITECTURE.md` § 12. The entry itself says this is a design ruling, not a doc edit: either § 12 gains an exception or the log list moves into a sheet. The rule must not read as satisfied meanwhile. Ruling still open (`T-freeform-active-2`) |
| C-7 | `SCREEN_SPECS.md` has no entry for the freeform capture screen | **Applied** — `SCREEN_SPECS.md` Screen 8, recording that the canvas serves two entry points |
| C-8 | Two cross-section query-parameter contracts undocumented | **Resolved** — the entry proposed no root-document edit, and `NAVIGATION_MAP.md` § Deep links now enumerates all eight parameters across seven routes. Superseded in scope by `me-screens.md` C-6 |
| C-9 | The 35-disc interlock is a trigger, not a `CHECK` constraint | **Applied** — `SCREEN_SPECS.md` standing divergence #6 and Screen 5 dependency; `AGENTS.md` § Data rules for putt capture |
| C-9 ADJUDICATION | Resolves the conflict between C-9 and `discs-screens.md` D-1 | **Applied, and it governs.** Verified independently during this pass: `layer1_foundation_schema.sql:230-253` defines `enforce_bag_capacity()` and attaches it as `bag_discs_capacity_check`, a `before insert` trigger on `bag_discs`; the only `drop` is its own idempotent `drop trigger if exists` at `:250`. The cap **is** enforced on every insert |

## `discs-screens.md`

| id | Subject | Disposition |
|---|---|---|
| D-1 | "No constraint of any kind limits `bag_discs` cardinality"; "a bag can exceed 35" | **REJECTED — superseded by C-9 ADJUDICATION.** D-1 is right that there is no `CHECK` *constraint* and could not be one. Its conclusion does not follow: the trigger fires on every insert regardless of which app path issued it, so the unguarded paths (`/bag/locker?addToBag=`, disc-detail chips) fail **loudly** rather than silently overfilling. That inverts the user-facing consequence — a raw Postgres string, not silent corruption. **Do not cite D-1's headline claims.** Its survey of the other enforcement points stands and was used: `bag_versions.capacity between 0 and 35`, the `cardinality(normalized_ids) > 35` guard in `grouped_save_bag`, the absence of an equivalent in `restore_bag_version`, and the four app surfaces counting three different ways |
| D-2 | `COPY_AND_TERMINOLOGY.md` T-2 attributes `No discs in your collection yet.` to the wrong screen | **Carried** — the target file is owned by another writer and was out of scope for this pass. The finding is verified and still needs applying: the string is at `BagManagePage.jsx:228` (inside the bag editor's membership checklist, styled `className="loading"`), not in `BagLockerPage`. `/bag/locker`'s only empty state is `No discs match.` (`BagLockerPage.jsx:249`), a filter-result message shown even for an entirely empty collection. The route-title/`h1` mismatch T-2 identifies is real and unaffected (`routeMetadata.js:227` `Collection` vs `BagLockerPage.jsx:134` `Locker`) |
| D-3 | `README.md` and `TEMPLATE.md` reference a `STATE_MATRIX.md` that does not exist | **Resolved** — the file was written on this branch by a concurrent session and now exists with stable row ids. Both references are correct as written |
| D-4 | `TEST_MAP.md` attributes `flightSpectrum` to `disc-compare` | **Applied** — moved to the `discs-root` row with the evidence |
| D-5 | `SCREEN_SPECS.md:16` cites "Expansion Screens 22–25", defined nowhere | **Applied** — `SCREEN_SPECS.md` header note, re-attributing those screens to `PRODUCT_ROADMAP.md` Phase B item 4 and Phase C item 1, which are in the repository and do describe them |

## `courses-screens.md`

| id | Subject | Disposition |
|---|---|---|
| CS-1 | `preserveNestedState` is declared and tested but never read | **Applied** — `NAVIGATION_MAP.md` § Tab behavior, marked a declared-but-unimplemented contract field, with the `scrollKey`-collision consequence. `screens/disc-detail.md` § 2 and `SCREEN_INVENTORY.md` § Route metadata caveat already carried it |
| CS-2 | `NAVIGATION_MAP.md` says one query-parameter contract; there are two | **Superseded by `me-screens.md` C-6** and already applied. CS-2's own proposed edit ("change one to two") would have left the line wrong by six — the real count is eight parameters across seven routes |
| CS-3 | `STATE_MATRIX.md` was missing when the COURSES documents were written | **Resolved** — the file exists. No edit to `TEMPLATE.md`, `README.md`, or `TASK_FORMAT.md` was needed; their instructions are correct. The follow-up (converting the seven COURSES documents' inline state prose to row-id citations) is a `docs` task, not a contradiction |
| CS-4 | `DEVELOPMENT_PLAN.md` § J1's stated reuse does not match what shipped | **Applied** — `DEVELOPMENT_PLAN.md` § J1, merged with `component-library.md` item 3 into one edit |
| CS-5 | `TEST_MAP.md` COURSES rows are right but incomplete | **Applied** — `round-start` row gains `discLocker`; a note names the three untested modules (`roundRepository`, `discRepository`, `profile`) |
| CS-6 | The PLAY dashboard hero mislinks an in-progress round to `/practice/freeform` | **Registered** — code defect, `DEFECT_REGISTER.md`. `heroCardState()` returns `active-activity` for any activity including `disc_golf_round`, and `PracticeMenuPage.jsx:164` has no `disc_golf_round` branch. The round id *is* the activity id, so `/rounds/${hero.activityId}` needs no schema change |
| CS-7 | The header activity pill can never advertise a round | **Registered** — code defect. `AppShell.jsx:42-47` computes `activeHref` only for `putting_regimen` and `putting_freeform`; all seven COURSES routes set `showActivityPill: true`, so the flag is inert for the case it most needs to cover. The `aria-label` is also hardcoded `"Resume active practice"` |
| CS-8 | `.round-turn-prompt` has no stylesheet rule | **REJECTED — false positive.** The grep was scoped to `src/App.css`. The rule is at **`src/index.css:182`** (shared with `.fatigue-checkin` and `.session-context-summary`), and `src/index.css` is imported at `src/main.jsx:5`, so it is live. The at-the-turn prompt renders styled. Re-verified during this pass. `DEFECT_REGISTER.md` already records the rejection; **`screens/round-scorecard.md`'s `T-round-scorecard-4` should be withdrawn** |
| CS-9 | ADR 0001 names three blocked screens; `SCREEN_INVENTORY.md` marks two | **Partially applied** — a note in `SCREEN_INVENTORY.md` § COURSES records that this file governs status, why the narrower reading is right on the merits, and that the ADR's Context sentence should be narrowed. The ADR side was **not** edited: `docs/decisions/0001` was owned by another writer during this pass. The two documents no longer read as an unexplained disagreement, but the ADR text is still broader than the inventory |

## `preshell-screens.md`

Local numbering; does not continue `screen-specs-and-agents.md`.

| id | Subject | Disposition |
|---|---|---|
| C-1 | Screen 3 implies the onboarding goal selection is stored; it is discarded | **Applied** — `SCREEN_SPECS.md` Screen 3, as an explicit divergence: capture shipped, persistence did not |
| C-2 | Screen 2 lists a sync-status pill that was never built | **Applied** — `SCREEN_SPECS.md` Screen 2, struck from the NET-NEW list with the reasoning kept |
| C-3 | Guest→account conversion ships but has no in-app entry point | **Applied** — `SCREEN_SPECS.md` Screen 2, qualifying the shipped-capability claim. The mechanism is correct; the entry point is missing (`T-login-6`, blocked on placement) |
| C-4 | Screen 1 cites a topo-background CSS treatment that does not exist | **Applied** — `SCREEN_SPECS.md` Screen 1 REUSE |
| C-5 | `STATE_MATRIX.md`'s pre-shell `onboarding` row leaves two cells `?` | **Applied** — `STATE_MATRIX.md` § 4 pre-shell table: `S-ERR-INLINE` → ✅, `S-OFFLINE-READ` → split annotation. Same resolution as `state-citations.md` SC-2 and SC-3 |

## `me-screens.md`

| id | Subject | Disposition |
|---|---|---|
| C-1 | `PRODUCT_ROADMAP.md` says ME links to History and contextual analytics; it does not | **Applied** — `PRODUCT_ROADMAP.md` bullet rewritten to the shipped five links. Whether to add the two missing links is explicitly left to the owner (`T-me-root-4`); the edit records that, rather than pre-empting it |
| C-2 | `profiles.current_rating` does not exist; the shipped column is `pdga_rating` | **Applied** — `SCREEN_SPECS.md` Screen 11 dependency, including the live consequence: `CareerHubPage.jsx:24,25,41` reads a column that is always `undefined`, so the `Current` value, the progress bar, and its `aria-label` are all permanently inert, and **no UI writes `pdga_rating` at all**. Code fix registered as `T-me-root-1` |
| C-3 | `IOS_READINESS.md` lists in-app account deletion as fixed; the RPC is unapplied | **Applied** — `docs/mobile/IOS_READINESS.md`: the lead sentence no longer says "All are fixed", and the bullet is marked ⚠️ STILL OPEN with the migration dependency. Two documents in the repo previously made opposite claims about a store-submission blocker |
| C-4 | `profiles.timezone` and `round_turn_prompt_enabled` may have no UPDATE grant | **Carried — cannot be settled from the repository.** It depends on deployed grant state, and Supabase MCP calls were not reachable in this session. `layer5_gamification_hardening.sql:170-176` replaces the table-wide UPDATE grant with an explicit column list; both columns were added afterwards (`ae00e62`, `a822683`) and neither Phase D migration issues a compensating grant. If the re-grant is live, both Settings controls fail with `permission denied for table profiles` — and because `SettingsPage.jsx:39` returns a page-replacing error for *any* error, that would blank the whole Settings screen, taking the export and delete panels with it. Resolve with `select has_column_privilege('authenticated', 'public.profiles', 'timezone', 'UPDATE'), has_column_privilege('authenticated', 'public.profiles', 'round_turn_prompt_enabled', 'UPDATE');` Registered as `T-settings-4`, with `T-trophy-room-6` to pin the grant list in a migration contract test |
| C-5 | The weekly-report notification is unproduced and its default destination is wrong | **Registered** — three code gaps in one feature: no producer, no scheduler, and `notifications.js:28` defaulting `weekly_report` to `/profile` rather than `/profile/reports`, so the reports screen is unreachable from its own notification. The destination is a one-line fix that is correct under either scope outcome (`T-weekly-reports-1`, `T-weekly-reports-2`) |
| C-6 | `NAVIGATION_MAP.md` says one query-parameter contract; there are eight | **Applied** — `NAVIGATION_MAP.md` § Deep links now carries the full eight-parameter table. This entry consolidated three partial findings (CS-2, C-8, and the `discs-screens.md` note); applying any one of those alone would have left the line wrong |

## `play-screens.md`

| id | Subject | Disposition |
|---|---|---|
| P-1 | `putting_regimens.total_putts` does not exist; the 100-putt ceiling is a row trigger | **Applied** — `SCREEN_SPECS.md` standing divergence #6 and Screen 7 dependency (also correcting `created_by` → `user_id`); `AGENTS.md` § Data rules for putt capture. The trigger's **system-regimen exemption** (`user_id is null` returns early) was undocumented anywhere and is now recorded |
| P-2 | The app-side 100-putt interlock gates `Add next stage` but not `Save` | **Registered** — code gap, `T-routine-builder-1`. `saveDisabled` does not consider `putts`, so both Save buttons stay enabled at 200 putts |
| P-3 | The putt-cap trigger's behavior on a multi-row insert is unverified | **Registered** — `T-routine-builder-2`. `createCustomRegimen` inserts every set row in one statement; whether rows already processed by that statement are visible to a `BEFORE … FOR EACH ROW` trigger's `SELECT` determines whether the ceiling holds on the builder's exact write path. No test either way |
| P-4 | `/notifications` has no in-app entry point | **Applied** — `PHASE_A_ARCHITECTURE.md` § 13 (the route is contractually required and reachable only by URL). `SCREEN_INVENTORY.md` and `NAVIGATION_MAP.md` already carried it. Wiring an entry point is `T-notifications-1` |
| P-5 | `SCREEN_SPECS.md` says `RegimenSelectPage` folds into the launchpad; both shipped | **Applied** — `SCREEN_SPECS.md` Screen 7 REUSE, recording that both shipped, that they group by different rules, and that the launchpad is canonical for launching |
| P-6 | `RegimenSelectPage` does not filter archived routines | **Registered** — `T-regimen-select-1`. Compounding case: a failed set insert archives the just-created parent as cleanup, and that orphan is invisible on `play-root` but visible and launchable on `regimen-select`, where `validateDrillConfig` rejects it |
| P-7 | Every PLAY page renders a second `<h1>` beneath the shell's | **Applied as a recorded non-conformance** — `PHASE_A_ARCHITECTURE.md` § 13, against "Pages must not manually duplicate shell decisions". Twenty-two components, with different heading text in most. One systemic fix, `T-play-root-2` |
| P-8 | ~~`HistoryPage` never renders the `Synced` or `Syncing` calm states~~ | **Withdrawn by its author** — superseded by `state-matrix.md` C-2, which documents the same behavior inside the wider six-vocabulary finding. `STATE_MATRIX.md` row `S-SYNC` is canonical. Id retained, not reused |
| P-9 | Two different metric-eligibility rules; the registry's is dead code | **Applied** — `PHASE_A_ARCHITECTURE.md` § 5 now records that the registry is descriptive-only today, with the disagreement table. Closing the gap is `T-practice-stats-2` |
| P-10 | ~~`docs/ui/STATE_MATRIX.md` does not exist~~ | **Resolved** — written concurrently on this branch. `T-play-root-3` withdrawn. Id retained, not reused |
| P-11 | `COPY_AND_TERMINOLOGY.md:179` states one `Insufficient data` rule that half the app does not follow | **Carried** — target file owned by another writer, out of scope for this pass. The finding is verified: `Insufficient data` appears only in `DiscProfileContext.jsx` and `SkillRadar.jsx`, while every PLAY statistics readout uses an em-dash. The proposed narrowing — "a *computed but underpowered* percentage renders `Insufficient data`; a percentage with no samples at all renders `—`" — is sound, and the line's `AGENTS.md` attribution is unsupported (`grep -n "Insufficient" AGENTS.md` returns nothing) |

## `state-matrix.md`

Two of these touch a **contract** document. A contract the code does not satisfy may be a code bug
rather than a doc bug, and both were filed proposing the code reading.

| id | Subject | Disposition |
|---|---|---|
| C-1 | `ToastHost` is shell-owned but permanently inert, so two § 11 behaviors cannot fire | **Applied** — `PHASE_A_ARCHITECTURE.md` § 16 item 3. The entry's preferred resolution is a code fix; its fallback was to record it in § 16 so the shell stops reading as complete. The code fix is registered, and § 16 now records it |
| C-2 | § 11 specifies a fifth offline label that § 12's four-label list does not contain | **Applied** — `PHASE_A_ARCHITECTURE.md` § 11, amended to cite § 12's `Saved on Device` rather than introduce a sixth string. The shipped count is now six vocabularies (`state-citations-2.md` S-2) |
| C-3 | The round-replacement confirmation is fully built and never reachable from the UI | **Applied** — `PHASE_A_ARCHITECTURE.md` § 16 item 4, including the distinct `round-start` mechanism from `state-citations-2.md` S-5. Code fix registered |
| — | Methodology note on the "5 pages reference offline/onLine" figure | **Resolved** — not a contradiction. It confirms § 8: offline handling is centralized in the repository layer, and a page not referencing `onLine` is not a gap |

## `state-citations.md`

`?` cells in `STATE_MATRIX.md` § 4 that a screen document's reading resolved. Not contradictions — § 4's
method statement says `?` means "unverified, not absent" and invites exactly this.

| id | Subject | Disposition |
|---|---|---|
| SC-1 | `regimen-active` / `S-EMPTY`: `?` → ➖ | **Applied** — `RegimenRunPage` has no collection whose emptiness it could report, and its sub-components render `S-INSUFFICIENT`, not `S-EMPTY` |
| SC-2 | `onboarding` / `S-ERR-INLINE`: `?` → ✅ | **Applied** — same resolution as `preshell-screens.md` C-5 |
| SC-3 | `onboarding` / `S-OFFLINE-READ`: trailing `CalibrationStep ?` → ➖ | **Applied** — the step performs no read; `usePuttHaptics` is a capability check, not a fetch |

## `state-citations-2.md`

| id | Subject | Disposition |
|---|---|---|
| S-1 | `lost-found` / `S-LOAD` is ❌, not merely unverified | **Applied** — `STATE_MATRIX.md` § 4 DISCS grid and the `S-LOAD` row. The empty state doubles as the loading state, so during the initial read a user *with* cases is told there are none — the second instance of a pattern the matrix already recorded for `NotificationsPage` |
| S-2 | `round-summary` / `S-SYNC` is ⚠️, and it is a **sixth** vocabulary | **Applied** — cell, `S-SYNC` row, and the § 4 Counts figure (5 → 6) |
| S-3 | `S-SAVING` misreports `ProfilePage`; the guard exists, in `EditableSection` | **Applied** — `ProfilePage` and its `:28` citation dropped from that sentence. It is an instance of the row's *correct* branch. The `SettingsPage` half was confirmed and stands, `data-risk` rating included |
| S-4 | `S-INTERLOCK-CAP` surveys three caps; six more exist | **Applied** — scope sentence added to the row. Three of the six are worse than anything it described: `goals` (server-only), `courses-new` (silently corrects the user's input), `round-scorecard` (`min`/`max` advertised in markup, enforced nowhere) |
| S-5 | `S-INTERLOCK-ACTIVE`'s gap-1 screen list omits `round-start` | **Applied** — added, with the clause distinguishing the deliberately-skipped call from the discarded outcome. The repair differs by screen, which is why the distinction is load-bearing |

## `screen-13.md`

| id | Subject | Disposition |
|---|---|---|
| C-10 | Screen 13's dependency verification is complete, and the entry understates what shipped | **Applied** — `SCREEN_SPECS.md` Screen 13 dependency replaced with the verified result and its evidence table. Only the parser and the UI remain. Side effect preserved: `IMPORT_XP_CAP` and `XP_PER_IMPORTED_PUTT` are dead constants whose only stated consumer is this unbuilt screen and **must not be removed as unused** |

## Still outstanding after this pass

Three items, none of them blocking:

1. **`COPY_AND_TERMINOLOGY.md` D-2 and P-11** — verified findings whose target file was owned by another
   writer during this pass. Apply them to that file when it is free.
2. **ADR 0001's Context sentence (CS-9)** — should be narrowed from three screens to two.
   `SCREEN_INVENTORY.md` now explains which document governs, so nothing is ambiguous meanwhile.
3. **`me-screens.md` C-4** — needs a live-database privilege query, not a repository edit.

Anything else here is either applied, rejected with a reason, or registered as code work in
`DEFECT_REGISTER.md` and sequenced in `EXECUTION_PLAN.md`.
