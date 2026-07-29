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

## 2. `flushRoundOutbox` swallows every error — FIXED (2026-07-29)

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

Fixed by reusing the activity path wholesale — `isPermanentError`, `nextBackoffDelayMs`, and
`createSyncScheduler` all drive the round flush unchanged, because it now returns the same
`{hasPending, error, permanentFailureIds}` shape the scheduler already consumes.

Rather than add a third copy of the queue, `activityOutbox.js` and `historyRecoveryOutbox.js` — which
were the same forty lines with a different table constant — were collapsed into a shared
`outboxQueue.js`. Their one real difference is dependency-key scope, now a parameter: lifecycle rows
resolve against lifecycle rows (`'own'`), history-recovery rows against every queued row (`'all'`).
Verified equivalent by the 26 existing tests passing untouched, and by inspection: `nextRetryAt == null`
matches the originals' explicit null/undefined check.

Two things that only surfaced during the wiring, both worth keeping in mind:

- Round-hole and round-update entries now carry a `dependencyKey` pointing at the round create.
  Without it, adding poisoning would have been a **regression** — a hole replayed while its create was
  still queued gets a `23503` foreign-key violation, which classifies as permanent, so a child that
  was never broken would have been poisoned.
- That key is namespaced `round-outbox:{id}:create` rather than `round:{id}:create`, because the
  latter is already the activity-lifecycle mutation key for the same round and the history-recovery
  queue resolves dependencies against *every* queued row. Reusing the string would have coupled two
  independent queues.

`flushRoundOutbox` is also serialized now: four surfaces call it, and two concurrent passes would read
the same snapshot and double-send — the same defect fixed in `syncScheduler.js` the day before.

A user whose round has not reached the server now sees it: a banner on the scorecard and summary with
a retry, a count banner and per-row badges on the rounds list, and a live sync state where the toolbar
previously showed a fixed `Autosaves` label. The count banner matters because a round whose *create*
poisoned never appears in the remote list at all, so per-row badges alone could not surface it.

Coverage: `roundRepository.test.js`, 10 tests against an isolated Dexie database — the file had zero.

## 3. `createCourseWithLayout` is not atomic — FIXED (2026-07-29)

**Severity: high.** Writes to shared, community-visible data.

Three sequential upserts — `courses`, then `layouts`, then `holes` — with no transaction and no
compensation. A failure after the first leaves an orphan course with no layout; after the second, a
layout with no holes. Both are immediately visible to every other authenticated user in the COURSES
directory, and neither is repairable from the client.

Fixed by `20260729120000_phase_e_atomic_course_creation.sql`: one `security invoker` RPC performing
all three inserts in a single transaction. Compensating deletes were rejected as the lesser
alternative — they fail for exactly the reason the original write failed.

Two design choices worth carrying forward. The function reads `auth.uid()` itself and takes **no
owner argument**, so a caller can no longer attribute a community course to someone else — `created_by`
stopped being client-supplied. And `p_course_id`/`p_layout_id` are client-generated, so replaying a
call that actually succeeded returns the existing course instead of duplicating it. That is the same
property finding 1 taught the round outbox to need, added deliberately rather than discovered later.

Proved against a throwaway Postgres 16 cluster, not by inspection: 27 assertions, three independent
rollback proofs (a raising trigger, a real unique-constraint violation, and a PK violation mid-INSERT),
each in its own autocommit transaction rather than inside a plpgsql `EXCEPTION` block that would have
rolled back by itself. A contrast case ran the *old* three-statement sequence under the same fault and
produced exactly the orphan course this finding describes — the harness demonstrating it can detect the
defect, not just bless the fix. Invoker semantics were confirmed by dropping the `courses` INSERT
policy and watching the call fail, which a definer function would have sailed through.

## 4. `createCourseWithLayout` has no offline path — FIXED (2026-07-29)

**Severity: medium.** Every other write in the app queues through the outbox; this one called Supabase
directly and threw. Quick-course creation is a field action, taken standing on a course with one bar
of signal — the exact condition the offline architecture exists for.

Fixed by `src/lib/repository/courseRepository.js`, structured after the round outbox and sharing its
machinery: the same `createOutboxQueue`, the same permanent/transient classifier, the same backoff
curve, and a flush whose result shape `createSyncScheduler` already consumes. A fourth hand-rolled
queue is what `outboxQueue.js`'s header exists to prevent.

Finding 3 is what made it tractable, by design rather than by luck: one RPC call is one queueable
unit, and client-generated `p_course_id`/`p_layout_id` mean a reconnect that retries a call which
actually landed gets the existing course back instead of a duplicate. The read-back split noted under
finding 3 was the first move — `buildCourseCreateArgs` and `createCourseWithLayoutRpc` separate the
write from `fetchCourse`, since an outbox replay has nothing to return a read to.

`roundRepository` gained `assertCourseIsSynced`, so starting a round against a course whose creation
is still queued is handled deliberately rather than discovered in the field.

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

## 8. Duplicate hole numbers are possible on a quick course — OPEN

**Severity: medium.** Surfaced while fixing finding 3. `holes_layout_hole_tee_uniq` does not prevent
duplicate `hole_number` values when `tee_type` is NULL, because Postgres treats NULLs as distinct in a
unique index. Pre-existing, inherited from the original `unique (course_id, hole_number, tee_type)` —
but the quick-course form never sets `tee_type`, so **every** quick course lives in the NULL branch and
is unprotected today. There is a passing assertion recording the current behaviour so it stays
documented rather than assumed. Fix: `nulls not distinct` on the index, or a synthetic default tee.

## 9. `isPermanentError` misclassifies most Postgres errors as transient — OPEN

**Severity: high.** Systemic, latent on all three outboxes, and the same failure mode as finding 2 on
a layer we just declared fixed.

Surfaced while wiring the course outbox's classifier. `PERMANENT_POSTGRES_CODES` holds exactly four
codes — `23505`, `23514`, `23503`, `22P02` — and the only other permanent signal is
`error.status >= 400`. But a supabase-js `PostgrestError` carries `code`, `details`, `hint` and
`message` and **no `status`**: the HTTP status lives on the response envelope, not the error object.

So any Postgres error outside those four codes, arriving without an explicitly attached status,
classifies as **transient and retries forever**. That includes every error the two new RPCs raise
themselves — `22023` (invalid parameter), `28000` (no authenticated user), `42501` (insufficient
privilege) — and, more importantly, `42501` from an ordinary **RLS denial** on any queued write.

The course path was fixed at its send site: `createCourseWithLayoutRpc` now attaches the HTTP status
from the `{data, error, status}` envelope. The activity and round paths were **not** audited for this
and are the open half of the finding.

Two subtleties that make this worth care rather than a quick patch:

- **Do not simply widen `PERMANENT_POSTGRES_CODES`.** `28000` is genuinely ambiguous — an expired JWT
  that gets refreshed makes the identical payload succeed on retry, so marking it permanent would
  poison writes that were about to work. Attaching the real HTTP status at each send site is the safer
  shape, and it is what the course path now does.
- `PGRST202`/`42883` ("function not deployed yet") must stay **transient** on purpose. The migration is
  coming, and a queued write should wait for it rather than poison. The course path deliberately leaves
  those statusless for exactly this reason.

Fix: audit every send site that feeds a queue and attach the response status, then add regression tests
covering an RLS denial and a validation error on each queue.

---

## Disposition

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Round-hole upsert resolved on surrogate id | High | **Fixed** |
| 2 | Round outbox swallows errors, diverging from § 8 | High | **Fixed** |
| 3 | Course creation is not atomic | High | **Fixed** |
| 4 | Course creation has no offline path | Medium | **Fixed** |
| 5 | Unbounded course directory fetch | Medium | Deferred, trigger recorded |
| 6 | Round holes ordered by UUID | Low | With 2 or 3 |
| 8 | Duplicate hole numbers possible when `tee_type` is NULL | Medium | Open, found 2026-07-29 |
| 9 | `isPermanentError` misclassifies most Postgres errors as transient | High | **Partly fixed** — course send site done; activity and round paths open |
| 7 | No-op `idList` map | Cosmetic | While touching |

Findings 2 and 3 are the next checkpoint. They are independent of each other and of the E2 feature
work (weather, activity-only rounds, group-scorecard groundwork, bag snapshot verification, course
preparation), which should not start on top of an offline layer that fails silently.
