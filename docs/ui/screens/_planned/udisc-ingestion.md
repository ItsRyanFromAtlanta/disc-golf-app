# UDisc Ingestion Center — DESIGN DOCUMENT (unbuilt)

> **This screen does not exist.** No route, no page component, no entry in `routeMetadata.js`, and no row
> in `SCREEN_INVENTORY.md`. Every other document under `docs/ui/screens/` describes shipped code; this one
> describes intent. Sections that would normally be verified against source are marked **PLANNED**.
>
> Status confirmed by the owner on 2026-07-29: still planned, not dead. Distinct from the scrapped
> catalog scraper — this is user-supplied CSV import, which has no ToS or crawler problem.

| Field | Value |
|---|---|
| Route id | **PLANNED** — none allocated |
| URL pattern | **PLANNED** — `/courses/import` or `/profile/import`; see § 2 |
| Section | **PLANNED** — `courses` or `me` |
| Shell | `standard` |
| Page component | **PLANNED** — none |
| Blueprint screen | Screen 13 — `UDiscDataIngestionView` |
| Governing spec | `MASTER_PROJECT_BLUEPRINT.md` § 4.2, `INGESTION_PARSER_SPEC.md` (inline, never extracted) |
| Verified against | `eb9fd2b` — for the dependency audit below, which IS verified |

## 1. Purpose

Import a UDisc CSV export so a player's existing round history lands in the app without re-entry, mapped
onto the same `rounds`/`round_holes`/`courses` tables native rounds use.

## 2. Dependency audit — VERIFIED, and better than expected

`SCREEN_SPECS.md:345-347` lists this screen's dependency as "**verify Track 1.5 landed** — confirm at
Layer 1 start, fold in if missing." **It landed, in full**, and more scaffolding exists than that note
implies. Verified this session:

| Dependency | Status | Evidence |
|---|---|---|
| `rounds.external_source` / `external_ref` | ✅ shipped | `disc_locker_and_layouts_schema.sql:105-106` |
| `courses.external_source` / `external_ref` | ✅ shipped | `:109-110` |
| Idempotent re-import index on `rounds` | ✅ shipped | `:117-118`, partial unique on `(external_source, external_ref)` where source is not null |
| Same on `courses` | ✅ shipped | `:120-121` |
| `course_aliases` table | ✅ shipped | `:128-138`, with a globally unique case-insensitive alias index |
| `udisc_import` activity source | ✅ shipped | `activityLifecycle/types.js:32` |
| Import source in the metric registry | ✅ shipped | `metrics/registry.js:15` |
| `XP_PER_IMPORTED_PUTT` = 10 | ✅ shipped | `gamification/constants.js:12` |
| `IMPORT_XP_CAP` = 10000 | ✅ shipped | `gamification/constants.js:17`, comment names Screen 13 explicitly |
| `UDisc import` XP ledger label | ✅ shipped | `trophyRoom/XpLedgerModal.jsx:11` |
| CSV parser | ❌ absent | no `udisc` module in `src/` |
| Drop zone / file picker UI | ❌ absent | |
| Route | ❌ absent | |

**What remains is the parser and the UI.** Schema, provenance, idempotency, activity source, XP economy,
and the ledger label are all in place and were built for this. The XP cap constant is dead code today —
its only stated consumer is this unbuilt screen.

**Route placement is undecided.** The blueprint puts ingestion in its own destination. Two candidates:
`/courses/import` puts it beside the rounds it produces; `/profile/import` puts it beside the E1 data
export, making import/export symmetric. The export lives at `/profile/settings` today, which slightly
favors the ME section. This needs a decision before build, not before design.

## 3. Layout — PLANNED

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  <-  Import from UDisc                                |
+-------------------------------------------------------+
|  +-------------------------------------------------+  |
|  |                                                 |  |
|  |          Drop your UDisc CSV here               |  | <- 1-tap drop zone; also opens
|  |             or tap to choose a file             |  |    the native picker / share sheet
|  |                                                 |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
|  PARSING                          [████████░░] 62%     | <- Web Worker; page stays responsive
|  318 of 512 rows                                       |
+-------------------------------------------------------+
|  PREVIEW BEFORE IMPORT                                 |
|  Rounds found ............................ 47          |
|  Already imported (skipped) .............. 12          | <- dedupe by (source, ref)
|  New courses to create ................... 3           |
|  Matched to existing courses ............. 8           | <- via course_aliases
|  Unmatched course names .................. 1  [ FIX ]  | <- needs user resolution
|  Retroactive XP .................. +8,450 (capped)     |
|                                                        |
|  [ IMPORT 35 ROUNDS ]                                  |
+-------------------------------------------------------+
|  IMPORTED HISTORY                                      |
|  47 rounds from UDisc, last import 2026-07-29          |
|  [ 🗑️ CLEAR IMPORTED HISTORY ]                         | <- scoped to external_source='udisc'
+-------------------------------------------------------+
```

### 3b. Region outline (normative once built)

```
Header ....................... shell-owned
Drop zone
  drop-target ................ drag-drop + tap-to-pick; accepts .csv
  drop-hint .................. accepted format and where to export it from UDisc
Parse progress
  parse-bar .................. rows processed / total
  parse-cancel ............... abandons without writing
Preview
  prev-rounds ................ count parsed
  prev-skipped ............... already present by (external_source, external_ref)
  prev-new-courses ........... courses that would be created
  prev-matched ............... resolved through course_aliases
  prev-unmatched ............. requires user action before import can proceed
  prev-xp .................... retroactive XP, showing the cap when it binds
  btn-import ................. commits; disabled while unmatched > 0
Imported history
  hist-summary ............... count and last import time
  btn-clear .................. destructive, scoped to external_source='udisc'
```

## 4. Element catalog — PLANNED

Deferred to build. Two rules are firm now:

- `btn-import` stays disabled while any course name is unmatched. Silent guessing at course identity is
  what `course_aliases` exists to prevent.
- `btn-clear` must state its scope in its confirmation copy — it deletes imported rounds only, never
  natively logged ones. This is the highest-consequence destructive action proposed anywhere in the app.

## 5. Data contract — PLANNED

### Column mapping

Per the blueprint's inline `INGESTION_PARSER_SPEC.md`:

| UDisc column | Target |
|---|---|
| `CourseName` | `courses.name`, resolved through `course_aliases` |
| `Date` + `Time` | ISO round timestamp |
| `Total` / `+-` | round score |
| `Putts C1` / `Putts C2` | disc odometer increments |

### Writes

Existing shared schema only — `rounds`, `round_holes`, `courses` — never a bespoke import table. This is
the whole reason Track 1.5 was built ahead of time (`SCREEN_SPECS.md:343-344`).

Every imported row carries `external_source = 'udisc'` and a stable `external_ref`. The partial unique
indexes make re-import idempotent by construction: a repeat import updates rather than duplicates, with
no application-level dedupe pass required.

**Divergence from the blueprint, already decided** (`SCREEN_SPECS.md:339-342`): dedupe keys on
`(external_source, external_ref)` rather than the blueprint's raw date-plus-course check, because it
survives course-name variance through `course_aliases`.

### XP

`min(totalParsedPutts × XP_PER_IMPORTED_PUTT, IMPORT_XP_CAP)` — 10 per putt, capped at 10,000. Both
constants ship. The cap exists so a large backlog cannot vault a user to the level ceiling in one import.

## 6. Flow paths — PLANNED

**Happy path.** Drop CSV → Web Worker parses off the main thread → preview with counts → import → rounds
appear in `/rounds` indistinguishable from native ones except by provenance.

**Re-import.** The same file imported twice is a no-op on rounds already present, by index rather than by
application logic.

**Unmatched course.** Import blocks. The user maps the name to an existing course (writing a
`course_aliases` row) or accepts creating a new one.

**Offline.** Parsing is local and works offline. Writing must queue through the repository layer like
every other mutation — see `PHASE_A_ARCHITECTURE.md` § 14. A partial import must not leave orphaned
courses; this needs a transaction boundary decision at build time.

**Clear imported history.** Two-step confirmation, scoped to `external_source = 'udisc'`.

## 7. Dependencies

All schema dependencies are shipped — see § 2. Remaining: a Web Worker parser module, the page, and a
route allocation. No ADR blocks this screen.

## 8-10. Accessibility, telemetry, tests — PLANNED

Baseline is `PHASE_A_ARCHITECTURE.md` § 12. Two specifics worth fixing now: the drop zone must be
operable by keyboard and not drag-only, and parse progress must be announced rather than purely visual.

The parser is the most testable thing in this feature and should be built test-first — it is pure input
to output over fixture CSVs, including malformed rows, unknown columns, and duplicate refs.

## 11. Tasks

Not sequenced here. When this screen is scheduled, it decomposes roughly as: route allocation decision →
parser module test-first (`pure-logic`) → Web Worker wrapper (`ui-routine`) → preview UI (`ui-routine`)
→ import write path (`data-access`) → clear-history guardrail (`data-access`) → XP wiring (`pure-logic`,
constants already exist).

## 12. Open questions

1. **Route placement** — `/courses/import` or `/profile/import`. See § 2.
2. **Transaction boundary on partial import.** If 40 of 47 rounds write and the connection drops, what
   is the resume story? The idempotent index makes a naive retry safe, but orphaned courses from a
   half-finished import are not covered by it.
3. **Does importing count toward streaks and goals?** A backlog import would retroactively create
   practice days. `IMPORT_XP_CAP` shows the project already decided imports should not distort
   progression — the same reasoning likely applies to `practiceStreak`, but nothing states it.
4. **UDisc export format stability.** The mapping assumes specific column headers. There is no version
   detection proposed, and no fixture of a real export is committed.

## 13. Blueprint divergence

Recorded above where decided: shared schema rather than a bespoke table, and `(external_source,
external_ref)` dedupe rather than date-plus-course. Both predate this document
(`SCREEN_SPECS.md:328-347`).

One correction to `SCREEN_SPECS.md`'s Screen 13 entry: its dependency line asks a future agent to
"verify Track 1.5 landed" and "fold in if missing." That verification is now done — everything landed,
plus four pieces of scaffolding the note does not mention. See `_corrections/screen-13.md`.
