# E2 audit — shipped J1 course/round surface

Date: 2026-07-28

`DEVELOPMENT_PLAN.md` § E2 opens with "audit and harden the existing course/layout and offline round
routes rather than rebuilding them." This is that audit. Findings are ordered by severity, each with
a disposition. Hardening lands as separately committed green checkpoints, not one sweep.

Surface reviewed: `src/lib/roundLog.js` (241 lines), `src/lib/repository/roundRepository.js` (355),
`src/lib/rounds.js` (44), and the seven Course/Round pages (849 lines total).

**Coverage context, which frames everything below.** The repository carries 505 unit tests across 75
files, but before this pass `roundLog.js` and `roundRepository.js` — the entire course/round data and
offline layer, ~600 lines — had **zero**. `rounds.test.js` covered only the 44-line scoring helper.
The defects below are not subtle; they are what an untested layer accumulates.

---

## 1. Round-hole upsert resolved on the wrong key — FIXED (this checkpoint)

**Severity: high.** Silent, permanent, and offline-only, which is the worst combination.

`round_holes` carries `unique (round_id, hole_id)` (`supabase_schema.sql:133`), but `upsertRoundHole`
resolved conflicts on `id`, a client-generated surrogate. Any replay whose local id had changed —
second device, cleared cache, a queued write re-created from a fresh optimistic row — took the INSERT
branch and violated the natural-key constraint. The resulting `23505` was swallowed by
`flushRoundOutbox`'s bare `catch {}` and the entry stayed queued, so the round retried the same
doomed write on every reconnect and every app load, forever, with nothing surfaced to the user.

Fixed by resolving on `round_id,hole_id` and deliberately **not** sending `id` — PostgREST's
merge-duplicates updates every column supplied, so including it would rewrite the primary key the
local Dexie mirror is indexed by. `cacheRoundHole` gained a `replacesId` option so the optimistic row
is removed when the server turns out to own a different id for the same hole.

Regression coverage: `src/lib/roundLog.test.js`, 8 tests, including the two-local-ids convergence case
that used to poison the outbox.

## 2. `flushRoundOutbox` swallows every error — OPEN

**Severity: high.** This is what made finding 1 invisible, and it will do the same for the next one.

```js
} catch {
  // Leave the entry queued for the next reconnect or app load.
}
```

No attempt count, no last error class, no next-retry backoff, no poison state. `PHASE_A_ARCHITECTURE.md`
§ 8 requires all five, and the *activity* outbox implements them — the round outbox diverges from the
contract its sibling honours. A permanently failing round write is indistinguishable from a
succeeding one from the user's side: the scorecard shows their scores from the local mirror, and they
have no way to learn the round never reached the server.

Fix: reuse the activity outbox's retry/poison record rather than inventing a second scheme, and
surface poisoned round entries the same way `useHistoryRecovery` surfaces activity ones.

## 3. `createCourseWithLayout` is not atomic — OPEN

**Severity: high.** Writes to shared, community-visible data.

Three sequential upserts — `courses`, then `layouts`, then `holes` — with no transaction and no
compensation. A failure after the first leaves an orphan course with no layout; after the second, a
layout with no holes. Both are immediately visible to every other authenticated user in the COURSES
directory, and neither is repairable from the client.

Fix: one `security invoker` RPC performing all three inserts in a single transaction. Compensating
deletes are the lesser alternative — they fail for exactly the reason the original write failed.

## 4. `createCourseWithLayout` has no offline path — OPEN

**Severity: medium.** Every other write in the app queues through the outbox; this one calls Supabase
directly and throws. Quick-course creation is a field action, taken standing on a course with one bar
of signal — the exact condition the offline architecture exists for. Pairs naturally with finding 3:
the RPC is what an outbox entry would replay.

## 5. `fetchCourses()` is unbounded — OPEN

**Severity: medium, deferred by design.** `select('*').order('name')` across a community-wide table
with no limit, pagination, or search, on the COURSES tab root. Correct at current volume and
degrading linearly with the catalog. The lightweight-directory comment on line 159 says detail loads
layouts/holes separately, which is right — it just does not bound the directory itself. Revisit
trigger: first real multi-user catalog, or measured load time past ~300ms.

## 6. `fetchRound` orders `round_holes` by `hole_id` — OPEN

**Severity: low.** `hole_id` is a UUID, so the resulting order is arbitrary rather than hole order.
Harmless today only because `RoundScorecardPage` re-sorts (`sortedHoles`), which means the guarantee
lives in one consumer instead of the data layer. Any second consumer inherits a meaningless order.
Fix: order through the joined hole's `hole_number`, or document that callers must sort.

## 7. `idList` contains a no-op — OPEN

**Severity: cosmetic.** `rows.map((row) => row)` does nothing; the dedupe and filter are the work.
Fix while touching the file.

---

## Disposition

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Round-hole upsert resolved on surrogate id | High | **Fixed** |
| 2 | Round outbox swallows errors, diverging from § 8 | High | Next checkpoint |
| 3 | Course creation is not atomic | High | Next checkpoint |
| 4 | Course creation has no offline path | Medium | After 3 (shares the RPC) |
| 5 | Unbounded course directory fetch | Medium | Deferred, trigger recorded |
| 6 | Round holes ordered by UUID | Low | With 2 or 3 |
| 7 | No-op `idList` map | Cosmetic | While touching |

Findings 2 and 3 are the next checkpoint. They are independent of each other and of the E2 feature
work (weather, activity-only rounds, group-scorecard groundwork, bag snapshot verification, course
preparation), which should not start on top of an offline layer that fails silently.
