# Corrections — Screen 13 (UDisc ingestion)

---

## C-10 — Screen 13's dependency verification is complete, and the entry understates what shipped

**Where:** `SCREEN_SPECS.md:345-347`

**Claims:** "**verify Track 1.5 landed** — `external_source`/`external_ref` on `rounds`/`courses` and the
`course_aliases` table were planned to ride with the 1B migration; confirm at Layer 1 start, fold in if
missing."

**Reality:** verified 2026-07-29. Everything landed, and four pieces of scaffolding the note does not
mention also exist:

| Piece | Evidence |
|---|---|
| `rounds.external_source` / `external_ref` | `disc_locker_and_layouts_schema.sql:105-106` |
| `courses.external_source` / `external_ref` | `:109-110` |
| Partial unique index making re-import idempotent, `rounds` | `:117-118` |
| Same, `courses` | `:120-121` |
| `course_aliases` + unique case-insensitive alias index | `:128-138` |
| `ACTIVITY_SOURCES.UDISC_IMPORT` | `activityLifecycle/types.js:32` |
| Import source registered as metric-eligible | `metrics/registry.js:15` |
| `XP_PER_IMPORTED_PUTT = 10` | `gamification/constants.js:12` |
| `IMPORT_XP_CAP = 10000`, comment naming Screen 13 | `gamification/constants.js:14-17` |
| `UDisc import` XP ledger label | `trophyRoom/XpLedgerModal.jsx:11` |

Only the parser and the UI are missing.

**Proposed edit:** replace the "verify / fold in if missing" instruction with the verified result. As
written it sends an agent to re-do an audit that is complete, and understates how close the feature is —
a reader would not learn that the XP economy and activity source already ship.

**Side effect worth noting:** `IMPORT_XP_CAP` and `XP_PER_IMPORTED_PUTT` are currently **dead constants**.
Their only stated consumer is this unbuilt screen. They should not be removed as unused.

**Full design document:** `docs/ui/screens/_planned/udisc-ingestion.md`.
