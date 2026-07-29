# UI Documentation

The screen-level documentation set: what each screen contains, how it behaves, what it depends on, and
what work remains. Written to be executed by an LLM agent that has not read the codebase.

## Authority chain

This directory does not own product decisions. It owns screen-level detail and nothing else.

| Question | Authority |
|---|---|
| What do the tokens/colors/typography say? | `AGENTS.md` § Design system |
| What ships next, and is a feature in or out? | `PRODUCT_ROADMAP.md` |
| What are the lifecycle/shell/offline/a11y contracts? | `PHASE_A_ARCHITECTURE.md` |
| What is the drawn product vision? | `MASTER_PROJECT_BLUEPRINT.md` § 3 |
| Where do I resume work? | `docs/development/CURRENT_WORK.md` |
| What is this screen made of, and what does it depend on? | **here** |

Screen **status** lives in `SCREEN_INVENTORY.md` and nowhere else. Individual screen documents link to
it rather than carrying their own status field, so status can never disagree with itself.

## Documents

### Foundation

- [TEMPLATE.md](TEMPLATE.md) — authoring contract for every screen document. Read before writing one.
- [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) — canonical route → component → document → status table.
- [NAVIGATION_MAP.md](NAVIGATION_MAP.md) — shell, route tree, sheet layer, guards, back behavior.
- [STATE_MATRIX.md](STATE_MATRIX.md) — cross-cutting states, current behavior against contract.

### Reference

- [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) — every component in `src/components/`, props and usage.
- [LIB_API_INDEX.md](LIB_API_INDEX.md) — exported API surface of `src/lib/` and `src/hooks/`.
- [COPY_AND_TERMINOLOGY.md](COPY_AND_TERMINOLOGY.md) — user-facing strings, grouped, conflicts flagged.

### Execution

- [TASK_FORMAT.md](TASK_FORMAT.md) — capability-tagged task convention and the capability→model table.
- [TEST_MAP.md](TEST_MAP.md) — screen-to-test coverage and the E2E backlog.
- [screens/](screens/) — one document per screen.

## Scope

Shipped screens are documented from code. `routeMetadata.js` defines the route set; `SCREEN_INVENTORY.md`
tracks which have documents.

Parked screens (`MASTER_PROJECT_BLUEPRINT.md` Screens 14–21) are **not** documented here. Their
wireframes and rationale stay in the blueprint, and `SCREEN_SPECS.md` records why each is parked. The
one exception is Screen 13, the UDisc CSV ingestion center, which is unbuilt but still planned and
carries a forward-looking design document marked as such.

## Working rules

1. Uniform depth — every screen document has every section; inapplicable ones read `N/A` with a reason.
2. The region outline is normative; the ASCII frame is illustrative. Where they disagree, the frame is
   the bug.
3. Link, never restate. A second copy of a fact is a future contradiction.
4. Code is ground truth for shipped screens.
5. Contradictions found in existing documents are logged under `_corrections/`, never fixed in place
   mid-flight. They are reconciled in a single reviewed commit.

## `_corrections/`

Staging area for contradictions between existing documentation and the code, with `file:line` evidence.
Not a permanent record — entries are resolved into the root documents and cleared. If this directory is
non-empty, there is unreconciled drift outstanding.
