# 0002 — Group and league feature scope
Status: proposed
Date: 2026-07-29

## Context

`AGENTS.md` § Not yet decided asks whether group/league features are a v1 or v2 concern. Three parts of
the repo answer it differently:

- `DEVELOPMENT_PLAN.md` § E2 includes "group-scorecard groundwork" in the next work item.
- `SCREEN_SPECS.md` parks Screen 14 (Course Practice Hubs & Leaderboards) and Screen 15 (Putting League
  Bracket Manager) with the Social module, and parks bag tags, QR Beam, and peer challenge wherever they
  appear inside an in-scope screen (standing divergence #8).
- `PRODUCT_ROADMAP.md` lists Social behind a documented revisit trigger.

"Groundwork" is doing a lot of work in that first bullet and is not defined anywhere. The `rounds` and
`round_holes` tables are owner-scoped to `auth.uid()` (J1's RLS migration), which is a single-scorer
model. Whether E2 should widen that is the actual question, and it is a schema question — expensive to
get wrong, since schema files are append-only.

## Decision

**Recommended, not yet accepted.** Option B: schema-shaped groundwork in v1, no group UI, no RLS
widening until a real multi-scorer flow is designed.

## Consequences

If accepted as recommended:

- E2's "group-scorecard groundwork" is scoped to exactly one thing: ensuring nothing in the round schema
  or repository layer assumes a single scorer permanently — no widened RLS, no shared-round UI.
- Screens 14 and 15 stay parked, and no partially-built social surface ships.
- A future multi-scorer feature arrives as additive columns/tables, consistent with the append-only rule.
- The round screen documents state single-scorer as a current constraint rather than a permanent one.

If rejected toward full v1 scope, E2 grows substantially and the Social revisit trigger in
`PRODUCT_ROADMAP.md` needs rewriting first.

## Alternatives considered

**A. Group/league entirely v2 — no groundwork at all.** Cleanest scope. Rejected because owner-scoped
round records with no forward accommodation are the kind of decision that becomes expensive precisely
because the schema is append-only.

**B. Groundwork only: schema admits multiple scorers later, no UI (recommended).** Matches E2's actual
wording, costs little, forecloses nothing. Requires writing down what "groundwork" means so it does not
expand mid-phase.

**C. Full group scorecard in v1.** Rejected: it unparks the Social module ahead of its documented
trigger, and group scoring needs conflict resolution across devices — a `sync` capability problem the
project has explicitly deferred until real conflicts are observed (`SCREEN_SPECS.md` Screen 18 parking
reason).

## Supersedes / superseded by

None. Closes the second entry under `AGENTS.md` § Not yet decided when accepted.
