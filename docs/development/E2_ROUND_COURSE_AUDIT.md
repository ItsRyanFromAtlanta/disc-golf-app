# E2 audit — shipped J1 course/round surface

Opened 2026-07-28. **Closed 2026-07-30:** eight of nine findings fixed, one deferred by design. See
the disposition table at the end, and "What this audit did not find" below it — which is the part worth
reading if you are deciding what to do next.

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

## 1. Round-hole upsert resolved on the wrong key — FIXED (2026-07-28)

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

Fixed by `20260729213216_phase_e_atomic_course_creation.sql`: one `security invoker` RPC performing
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

## 6. `fetchRound` orders `round_holes` by `hole_id` — FIXED (2026-07-30)

**Severity: low.** `hole_id` is a UUID, so the resulting order is arbitrary rather than hole order.
Harmless today only because `RoundScorecardPage` re-sorts (`sortedHoles`), which means the guarantee
lives in one consumer instead of the data layer. Any second consumer inherits a meaningless order.

Fixed by sorting in the data layer, in `fetchRound`, once the joined holes are resolved. Ordering
through the embedded resource in the query was the first instinct, but PostgREST's support for ordering
a parent by an embedded column is version-dependent, and this guarantee should not rest on that —
`round_holes` can only order by its own columns, and none of them carries hole order.

Ties on `hole_number` (two tees on one hole) break on `tee_type`, nulls first, matching how the
layout-hole queries already order. Rows whose hole cannot be resolved sort **last**, not first, which is
where a nullish `hole_number` would otherwise put them — an unresolvable hole is the anomaly and must
not displace real hole 1.

Coverage: `src/lib/roundLog.fetchRound.test.js`, 4 tests, in its own file because
`roundLog.test.js`'s mock answers every list query with `[]` — right for the write-shape assertions it
makes, useless for reading a round back. The hole ids are chosen so that sorting them as strings
produces the *reverse* of play order; 3 of the 4 tests were confirmed to fail against the old code
before the fix landed.

## 7. `idList` contains a no-op — FIXED (2026-07-30)

**Severity: cosmetic.** `rows.map((row) => row)` does nothing; the dedupe and filter are the work.
Removed, and the parameter renamed `values` — every caller already passes a mapped array of ids, so
`rows` was describing the wrong thing and is what made the identity map look necessary.

## 8. Duplicate hole numbers are possible on a quick course — FIXED (2026-07-30)

**Severity: medium.** Surfaced while fixing finding 3. `holes_layout_hole_tee_uniq` does not prevent
duplicate `hole_number` values when `tee_type` is NULL, because Postgres treats NULLs as distinct in a
unique index. Pre-existing — but the quick-course form never sets `tee_type`, so **every** quick course
lived in the NULL branch and was unprotected.

Fixed by `20260730025443_phase_e_hole_number_nulls_not_distinct.sql`: the index is recreated with
`nulls not distinct`, which makes two NULL tee types compare equal for uniqueness. Applied to
`icqzbvtjisxwycvioiup` on 2026-07-30 and confirmed live (`indnullsnotdistinct = true`).

Preferred over a synthetic default tee (writing `'default'` instead of NULL), which would work but puts
a placeholder in a user-visible column the UI then has to hide, and needs a backfill.

Proved behaviourally, not by reading the index definition: a `DO` block created a course, a layout and a
NULL-tee hole 1, then attempted a second NULL-tee hole 1 and caught the `unique_violation`
(`duplicate_null_tee_blocked=t`). The same block confirmed a genuinely different tee on the same hole
number is **still** accepted (`distinct_tees_still_allowed=t`) — without that contrast the fix could have
been silently breaking multi-tee courses. A closing `RAISE` rolled the whole block back; the catalog was
verified byte-identical afterwards (0 courses, 0 layouts, 0 holes).

The assertion in `courseRepository.test.js` that recorded the old behaviour has been rewritten: it now
explains that 23505 fires on the path most users take, and notes that it poisons via the *code* branch
of `isPermanentError` rather than the status branch added under finding 9.

**Schema drift found while doing this.** `supabase_schema.sql` describes
`holes (course_id, hole_number, tee_type)` with a `course_id` column. Live, `holes` has **no
`course_id`** and the index is on `(layout_id, hole_number, tee_type)`. The checked-in schema file is
stale relative to the database; the probe above failed its first run because of it. Not fixed here —
regenerating that file is its own task, and doing it as a side effect of an index change would bury it.

## 9. `isPermanentError` misclassifies most Postgres errors as transient — FIXED (2026-07-30)

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

**FIXED (2026-07-30).** Every send site that feeds a queue now attaches the response status, via one
shared helper rather than a third copy of the rule:

`attachResponseStatus(error, status)` in `errorClassification.js` — next to the classifier it exists to
serve, so the two cannot drift. Applied at:

- **round outbox** — `roundLog.js`'s `throwIfError` now takes the whole result and attaches
  `result.status`, so `createRound`, `updateRound` and `upsertRoundHole` are all covered by one change.
  Read paths keep passing `{ data, error }`; a missing status is a no-op.
- **activity and history-recovery outboxes** — `supabaseSync.js`'s `syncRows`, which is the single
  executor both queues share.
- **course outbox** — `courseRpcError` was already attaching the status by hand; it now delegates, so
  the deploy-lag exemptions live in one place.

`DEPLOY_LAG_CODES` is the part worth not losing: `PGRST202`, `PGRST205`, `42883` and `42P01` are
explicitly **not** given a status, so they stay transient. PostgREST answers a not-yet-migrated function
or table with a 4xx, and attaching it would poison a write that is about to start working — the deploy
window between a client landing on `main` and its migration arriving is real and routine.

The helper mutates rather than copies, deliberately. supabase-js mints a fresh error per response and
hands it to one caller, so there is nothing to race; copying an `Error` would silently drop `stack` and
`message`, which are own non-enumerable properties that spread and `Object.assign` skip. There is a test
asserting exactly that.

Coverage: 10 tests in `errorClassification.test.js` — an RLS denial (`42501`) going from transient to
permanent, an RPC validation error (`22023`), a 5xx staying transient, all four deploy-lag codes keeping
no status, an already-attached status not being overwritten, and the message/stack preservation above.
One of them asserts the *gap* on the classifier itself — that a statusless `42501`/`22023`/`28000` reads
as transient — so the reason this helper exists stays visible rather than becoming folklore.

---

## Disposition

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Round-hole upsert resolved on surrogate id | High | **Fixed** |
| 2 | Round outbox swallows errors, diverging from § 8 | High | **Fixed** |
| 3 | Course creation is not atomic | High | **Fixed** |
| 4 | Course creation has no offline path | Medium | **Fixed** |
| 5 | Unbounded course directory fetch | Medium | **Deferred by design**, trigger recorded |
| 6 | Round holes ordered by UUID | Low | **Fixed** |
| 8 | Duplicate hole numbers possible when `tee_type` is NULL | Medium | **Fixed** |
| 9 | `isPermanentError` misclassifies most Postgres errors as transient | High | **Fixed** |
| 7 | No-op `idList` map | Cosmetic | **Fixed** |

Eight of nine findings are closed. Finding 5 is the only one left open, and deliberately so: an
unbounded `select('*').order('name')` is correct at a catalog of zero and degrades linearly. Its revisit
trigger — first real multi-user catalog, or measured load past ~300ms — is recorded above rather than
guessed at now.

## Found while building the E2 features, after the audit closed

These are not audit findings — the audit covered the write and sync path and closed on 2026-07-30.
They were turned up by the feature work that followed and are recorded here because this is where a
reader looking at the round/course surface will go next.

### F1. `relativeToPar` over an empty card claims even par — FIXED (2026-07-30, A5)

**Severity: low, but it printed a wrong number.** `relativeToPar([], holes)` returns `0`, and
`formatRelativeToPar(0)` is `'E'`. So any consumer that did not guard first would show a round with
nothing entered as *even par* rather than as unscored. Three screens each guarded separately with
their own `hasScore` flag — the same "the guarantee lives in the consumer, not the data layer" shape
as finding 6, and the fourth consumer would have inherited the defect.

Fixed by `roundScoreSummary()` in `src/lib/roundScoring.js`, which returns `null` for both total and
relative-to-par when nothing was recorded, and now owns the rule for all three screens. Held by
`roundScoring.test.js` and by a browser assertion in `e2e/activity-only-round.spec.js` — an
activity-only round is the case where an ungrounded "E" would have been most visible, since it has no
scores by definition.

### F2. A round's bag snapshot can be recorded from a stale version, indistinguishably — SURFACED (2026-07-30, A7)

**Severity: medium.** Not fixed, because it is not a bug to be fixed — it is a limit to be reported.

`useCreateRound` captures a fresh `bag_version` at round start, and on failure falls back to
`latestBagVersion(await loadBagVersions(bag_id))?.id ?? null`. Offline — the exact condition a round
starts in — that fallback records the newest version the device happens to know about, which may be
weeks old and may not reflect what is in the bag. Nothing on the round distinguishes that from a
snapshot taken at the first tee.

`verifyRoundBag()` in `src/lib/roundBagVerification.js` reports it rather than repairing it: because
`bag_versions` is created on every grouped save, the version list *is* a complete edit timeline, so
"was this snapshot still current when the round started?" is answerable — a save between the
snapshot and the round means it was not. See A7 in the commit log for the full status vocabulary.

Two things worth carrying forward from building it. The round's *end* comes from the activity parent
(`activities.updated_at` on a terminal activity, read under the round's own id) rather than a new
`rounds.finished_at` — a read-only verification feature should not need a migration, and the bridge
already carried the fact. And `roundStartedAt` prefers `rounds.created_at` over `played_at`
deliberately: `created_at` and `bag_versions.created_at` are both server defaults, so comparing them
compares one clock, whereas `played_at` is written on the device at submit and a phone a few minutes
out of step would manufacture edits that never happened.

**Note for whoever builds bag-versus-scoring analysis.** Verification is what tells you whether such
an analysis is worth building at all. `bagSnapshotLedger` reports how much of a history has a
snapshot that holds up; a claim like "you score better with the tournament bag" built over a history
that is mostly `not_snapshotted` is measuring the handful of rounds that happen to be verifiable.

### F3. Round-start snapshots are recorded with `reason = 'grouped_save'` — OPEN

**Severity: cosmetic, but it is a provenance lie.** `captureBagVersion` defaults `reason` to
`'grouped_save'` and `roundRepository` does not override it, so a snapshot taken because a round
started claims to have been taken because the bag was saved. The `bag_versions.reason` CHECK already
allows four values (`initial_snapshot`, `grouped_save`, `restore`, `system_backfill`) but
`capture_bag_version` rejects anything but two, so recording an honest `'round_start'` needs a
migration to widen both. Left open deliberately: A7's verification does not depend on the reason —
it reads the version timeline, not the labels — and changing an RPC's accepted vocabulary as a side
effect of a read-only feature is the kind of thing this project keeps as its own task.

## What this audit did not find

Worth stating plainly, because eight fixed findings can read as a hardened surface. Every defect above
was in the write and sync path. **The read path was reviewed and the UI was not**, and more to the point:

The live database holds 28 users and **0 courses, 0 layouts, 0 rounds, 0 catalog reviews**. Nothing this
audit fixed has ever run against real data, because this surface has never been used. The tests and the
three transactional proofs establish that the code does what it claims — they cannot establish that the
feature is worth using. That question needs a phone, a course, and a round actually played.
