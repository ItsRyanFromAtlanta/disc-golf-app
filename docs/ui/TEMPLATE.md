# Screen Document Template

The authoring contract for every file in `docs/ui/screens/`. Copy the skeleton at the bottom, fill
every section, delete nothing.

## Why this template exists

Screen documents are written to be executed by an LLM agent that has not read the codebase. That
constraint drives every rule below: structure is uniform so a missing section is always meaningful,
facts are sourced from code rather than from older documents, and nothing is restated that another
document already owns.

## The five rules

1. **Uniform depth.** Every screen document contains every section. A section that does not apply
   reads `**N/A** — <reason>`. Never delete a heading; an absent heading is indistinguishable from an
   oversight, and agents cannot tell the difference.

2. **The region outline is normative; the ASCII frame is illustrative.** Where the two disagree, the
   outline wins and the frame is the bug. This precedence is what makes it safe to ship both.

3. **Link, never restate.** Design tokens live in `AGENTS.md` § Design system. Architecture contracts
   live in `PHASE_A_ARCHITECTURE.md`. Sequencing lives in `PRODUCT_ROADMAP.md`. Screen status lives in
   `SCREEN_INVENTORY.md`. Copying any of them into a screen document creates a second copy that will
   drift — `CLAUDE.md` forked from `AGENTS.md`, drifted a full phase, and had to be gutted to a pointer
   in `8d540a5`. Do not repeat that.

4. **Code is ground truth.** For shipped screens, read the page component and its imports. Where an
   existing document disagrees with the code, the code is right and the document is a correction to be
   logged — never silently followed.

5. **Corrections are quarantined.** Do not edit root documents to fix a contradiction. Record it under
   `docs/ui/_corrections/` with `file:line` evidence and keep writing.

## Sections

### 1. Identity block

A table, first thing in the file. Every field is mechanical — pull it from `src/lib/routeMetadata.js`
and `src/App.jsx`, do not infer it.

| Field | Source |
|---|---|
| Route id | `routeMetadata.js` `id` |
| URL pattern | `routeMetadata.js` `match`, written human-readably (`/rounds/:roundId`) |
| Section | `routeMetadata.js` `section` — one of `play`, `discs`, `courses`, `me` |
| Shell | `routeMetadata.js` `shell` — `none`, `standard`, or `active` |
| Header title | `routeMetadata.js` `title` |
| Activity pill | `routeMetadata.js` `showActivityPill` |
| Scroll key | `routeMetadata.js` `scrollKey` |
| Preserves nested state | `routeMetadata.js` `preserveNestedState` |
| Page component | `src/pages/<Name>.jsx` |
| Blueprint screen | `MASTER_PROJECT_BLUEPRINT.md` § 3 screen number, or `none — post-blueprint` |
| Verified against | short commit SHA the document was written from |

Note the section/URL split: sections are named `play`/`discs`/`me` while the URLs are `/practice`,
`/bag`, `/profile`. That is deliberate — `resolveSectionRoot()` maps between them. It is not a
contradiction and should not be filed as one.

### 2. Purpose

Two to three sentences. What the screen is for and what job the user came to do. No feature list.

### 3. Entry and exit

Every way in and every way out, as a table: trigger, source screen, mechanism (tab, link, redirect,
sheet, deep link, post-action navigation), and any guard that can intercept. Include back behavior and
what happens on tab re-tap. Guards to check for: `ProtectedRoute`, the onboarding gate in `AppShell`,
and any activity-lifecycle interception in `useActivityNavigationLifecycle`.

### 4. Layout

Two subsections, in this order.

**4a. Frame (illustrative).** ASCII device frame with `<-` annotation callouts, matching the house
style in `MASTER_PROJECT_BLUEPRINT.md` § 3. Draw it from the shipped component, not from the blueprint
— the blueprint drew pre-implementation intent for ~13 screens and shipped reality has moved.

**4b. Region outline (normative).** Nested list. Containment expresses layout; each leaf is an
element with a stable id used by section 5.

```
Header (shell-owned)
  h-back .......... back chevron
  h-title ......... "Course"
Body (scroll owner)
  Summary card
    sum-name ...... course name
    sum-holes ..... hole count + par
  Layout list
    lay-row ....... one row per layout
Footer (sticky)
  cta-start ....... START ROUND
```

### 5. Element catalog

One row per leaf id in the outline. Columns: id, type, label/copy, states, action, target, and the
enable/disable rule. States must be explicit and complete — `default / pressed / disabled / loading`
is a start, not a finish. Interlocks (the 35-disc bag cap, the 100-putt routine ceiling) belong in the
enable/disable column with their enforcing constraint named.

### 6. Data contract

**Reads** — table of: what data, which function, which module, which table(s), and whether it is
Supabase-backed, Dexie-backed, or pure computation. Link function names to `LIB_API_INDEX.md` rather
than describing their implementation.

**Writes** — table of: what mutation, which repository call, idempotency key if any, and the local
transaction boundary. `PHASE_A_ARCHITECTURE.md` § 14 owns the transaction contract — cite the section,
do not restate the ordering rules.

**Offline** — what this screen does with no network, and which of the four calm states from
`PHASE_A_ARCHITECTURE.md` § 12 it can display (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`).

### 7. Flow paths

Named paths, each a numbered sequence with its terminal state. Required paths, or `N/A` with reason:

- **Happy path** — the primary job, start to finish
- **First run / empty** — no data yet
- **Error** — request or mutation failure, and what the user can still do
- **Offline** — capture continues, per § 12: a network failure never replaces active capture with a
  full-screen error
- **Auth / guard** — anonymous, guest, or un-onboarded user arrives
- **Interlock** — a cap or constraint is hit
- **Destructive** — delete, retire, clear, or discard, including the confirmation pattern

Reference `STATE_MATRIX.md` rows by id instead of re-describing shared state behavior.

### 8. Dependencies

Five buckets, each a list with links:

- **Schema** — tables and columns, with the migration that introduced anything non-obvious
- **Library** — functions, linked to `LIB_API_INDEX.md`
- **Components** — linked to `COMPONENT_LIBRARY.md`
- **Screens** — screens this one requires or is required by
- **Contracts and decisions** — `PHASE_A_ARCHITECTURE.md` sections, and any ADR this screen depends
  on. A `Proposed` ADR is a legitimate dependency: cite it and mark the dependent section provisional.

### 9. Accessibility

Deltas only. `PHASE_A_ARCHITECTURE.md` § 12 is the baseline contract for scroll ownership, 80pt
primary and 44×44pt secondary targets, sheet focus behavior, 320px width, 200% text scaling, reduced
motion, and chart text alternatives. Record only what this screen does beyond or differently from it —
and if it currently falls short, say so plainly and link the gap into section 11.

### 10. Events and telemetry

Metrics emitted, referencing the registry in `PHASE_A_ARCHITECTURE.md` § 5. Notifications produced or
consumed, referencing § 7. Lifecycle events written, referencing § 2. `N/A` is common and fine here.

### 11. Tests

- **Existing coverage** — the `*.test.js` files exercising this screen's logic, by path
- **Acceptance criteria** — numbered, observable, each one verifiable by a human or a test
- **E2E critical paths** — the flows an automated suite would need to cover. Automated browser E2E is
  required by `PHASE_A_ARCHITECTURE.md` § 9 and was never built; this section is where that backlog
  accumulates per screen. Do not describe it as shipped.

### 12. Tasks

Capability-tagged work items per `TASK_FORMAT.md`. Each carries a capability tag, a verification
command, and a commit boundary. Do not name vendor models here — the capability-to-model mapping lives
in one table in `TASK_FORMAT.md` so it can be updated in a single place.

### 13. Open questions

Unresolved items, each either linked to an ADR or stated as a question with the decision it blocks.
Anything filed under `docs/ui/_corrections/` that touches this screen gets referenced here.

### 14. Blueprint divergence

For screens with a `MASTER_PROJECT_BLUEPRINT.md` § 3 counterpart: where the shipped screen differs
from the drawn intent, and why. `SCREEN_SPECS.md` § "Standing divergences" already covers eight
project-wide ones — cite by number, do not restate. Post-blueprint screens record `**N/A** — screen
has no blueprint counterpart`.

---

## Skeleton

```markdown
# <Screen name>

| Field | Value |
|---|---|
| Route id | |
| URL pattern | |
| Section | |
| Shell | |
| Header title | |
| Activity pill | |
| Scroll key | |
| Preserves nested state | |
| Page component | |
| Blueprint screen | |
| Verified against | |

## 1. Purpose

## 2. Entry and exit

## 3. Layout
### 3a. Frame (illustrative)
### 3b. Region outline (normative)

## 4. Element catalog

## 5. Data contract
### Reads
### Writes
### Offline

## 6. Flow paths

## 7. Dependencies
### Schema
### Library
### Components
### Screens
### Contracts and decisions

## 8. Accessibility

## 9. Events and telemetry

## 10. Tests
### Existing coverage
### Acceptance criteria
### E2E critical paths

## 11. Tasks

## 12. Open questions

## 13. Blueprint divergence
```

The skeleton renumbers because the identity block is a table rather than a numbered section; the
prose above walks the same sequence. Follow the skeleton's numbering in authored documents.
