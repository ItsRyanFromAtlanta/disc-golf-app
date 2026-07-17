# Phase A activity migration — A5 review packet

Status: **applied and verified** (2026-07-12)

Migrations:

- `supabase/migrations/20260712193922_phase_a_activity_lifecycle.sql` (A5 envelope/backfill)
- `supabase/migrations/20260712195448_phase_a_activity_lifecycle_rpc.sql` (A6 RPCs)
- `supabase/migrations/20260712201203_phase_a_activity_lifecycle_fk_indexes.sql` (A6 advisor remediation)
- `supabase/migrations/20260712205102_phase_a_history_recovery_rpc.sql` (A8 visibility/correction RPCs)

This packet records the live audit, the A5 migration boundary, and the recovery
steps A6 must review before applying SQL. The connected Supabase project is
`disc-golf-app` (`icqzbvtjisxwycvioiup`, us-east-1). A fresh manual Supabase
backup was confirmed before drafting. No remote schema or data was changed.

## Live audit snapshot

- Postgres: 17.6.1.141; 24 public tables; all existing public tables have RLS enabled.
- `activities`, `activity_state_events`, and `audit_events` do not yet exist.
- Existing practice ownership and putt-event exclusive-parent checks passed with zero violations.
- Historical data: 9 freeform sessions, 15 regimen runs, and 0 rounds.
- Expected A5 backfill: 8 completed + 1 draft freeform activity; 7 completed + 1 incomplete +
  7 draft regimen activities; no round activities.
- The actively exercised account is `35b59d46-c58d-4193-9de2-f09238c0d009`; backfill uses every
  domain row's owner, not only users with a profile row.
- No UUID collisions were found across `putt_sessions`, `putting_regimen_runs`, and `rounds`.
- Existing unindexed-FK and auth-RLS-initplan advisor findings remain baseline technical debt;
  A5 does not opportunistically rewrite unrelated tables.

## Migration boundary

The draft creates the canonical activity envelope, append-only lifecycle events,
append-only audit events, owner-consistent composite FKs, history/current indexes,
RLS, and explicit least-privilege grants. Specialized tables remain authoritative
for sporting facts. The domain row UUID is also the activity UUID, matching A4's
local repository identity convention.

Historical rows are classified without fabricating pause/resume events:

- freeform with distance logs or real-time events → `completed`;
- empty freeform → `draft`;
- completed regimen → `completed`;
- uncompleted regimen with set/event facts → `incomplete`;
- empty regimen → `draft`;
- completed round → `completed`; an unfinished round with scored holes → `incomplete`;
  an empty unfinished round → `draft`.

The A5 draft intentionally contains no lifecycle RPCs. The A6 draft adds
serialized, idempotent, owner-checked operations through public `SECURITY
INVOKER` wrappers around non-exposed, hardened `SECURITY DEFINER` implementations:

- `activity_create_draft` creates a version-zero draft and is idempotent by the
  create key.
- `activity_transition` implements start, pause, resume, finalize, and mark
  incomplete; it validates expected state/version, appends exactly one event,
  and returns the A4 result envelope.
- Per-user transaction advisory locks serialize starts and replacement closes.
  Practice replacement auto-closes the prior practice; round replacement requires
  explicit confirmation.
- `admin_repair` is not accepted by the authenticated client RPCs. A later
  maintenance path must own that provenance.

## A6 preflight and apply gate

1. Run the preflight counts and collision/ownership checks from the audit notebook;
   all must remain zero except the documented historical row counts.
2. Review the migration in the SQL editor and confirm the migration is still marked
   unapplied locally and remotely.
3. Apply during a short maintenance window. The migration is transactional, but
   A6 should still monitor locks and verify the composite foreign keys before opening
   lifecycle writes.
4. Add the A6 RPCs only after the table grants and RLS policies are verified.

These gates were completed on 2026-07-12 after fresh backup confirmation. The
remote migration history now contains `phase_a_activity_lifecycle`,
`phase_a_activity_lifecycle_rpc`, and `phase_a_activity_lifecycle_fk_indexes`.

## A6 negative and concurrency test gate

Run these with a disposable authenticated test session after the migrations are
applied and before practice screens call the RPCs:

- direct authenticated insert/update/delete on all three lifecycle tables fails;
- anonymous RPC calls fail, while the public wrappers succeed only for the caller's
  own activity;
- cross-user activity IDs, forged user IDs, invalid source/type/command, stale
  expected state/version, and reused idempotency keys are rejected;
- retrying a create or transition with the same key returns the original result
  without a second row/event;
- two concurrent starts leave at most one active/paused row and preserve the
  documented replacement/round-confirmation behavior;
- a supplied state-event UUID is preserved, and a conflicting UUID is rejected;
- advisor output has no new public `SECURITY DEFINER` warning for the wrappers.

## Post-apply verification

```sql
select count(*) from public.activities;
select state, type, count(*)
from public.activities
group by state, type
order by type, state;

select user_id, count(*)
from public.activities
where state in ('active', 'paused')
group by user_id
having count(*) > 1;

select e.activity_id
from public.activity_state_events e
left join public.activities a on a.id = e.activity_id and a.user_id = e.user_id
where a.id is null;

select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('activities', 'activity_state_events', 'audit_events')
order by table_name, grantee, privilege_type;
```

The active/paused query and orphan-event query must return no rows. Authenticated
clients should be able to select only their own rows; direct insert/update/delete
must fail because lifecycle writes are routed through the reviewed A6 RPCs.
Service-role verification is performed separately and must not be exposed to the browser.

## Applied A6 results

- Backfill: 8 completed + 1 draft freeform; 7 completed + 1 incomplete + 7 draft regimen;
  0 rounds; 0 lifecycle events and 0 audit events fabricated.
- Integrity: 0 orphan lifecycle events, 0 duplicate current users, and 0 unlinked specialized rows.
- RLS/grants: all three tables have RLS; authenticated has SELECT only; anonymous access and direct
  authenticated DML were denied; cross-user reads returned zero rows.
- RPC behavior: create/start/retry returned `applied/applied/idempotent`; stale state, cross-user ID,
  idempotency reuse, and `admin_repair` rejected; round replacement required confirmation; confirmed
  replacement produced an incomplete old round and one active replacement.
- Concurrency: two simultaneous starts produced one applied transition and one `state_conflict`; the
  partial unique index remains the database safeguard.
- Advisors: no new public `SECURITY DEFINER` warnings and no remaining unindexed FK warnings for the
  A5 owner links. Existing unrelated security/performance baseline findings remain documented debt.

## A7 client integration

The practice screens now mirror the existing freeform-session or regimen-run UUID into the local
`activities` repository before notifying the InstantLaunch sync scheduler. Lifecycle outbox operations
are replayed in dependency order through the authenticated `activity_create_draft` and
`activity_transition` RPCs; typed parent, summary, and real gesture-event queues remain separate and
are held until the activity row is remotely acknowledged. Completion and regimen abandon enqueue the
corresponding terminal transition locally, so airplane-mode capture remains usable and reconnect is
idempotent. Navigation away records a real pause/resume boundary, while the shell pill and PLAY card
read the Dexie active mirror. No per-putt events are synthesized from batch totals.

## A8 server and metric-contract checkpoint

After fresh backup confirmation, the additive `phase_a_history_recovery_rpc` migration was applied
remotely as version `20260712205838`. It adds authenticated public invoker wrappers over private,
owner-validating security-definer implementations for hide/restore and practice notes/tags correction.
Both operations require optimistic activity versions and idempotency keys; envelope/domain updates and
append-only audit rows commit atomically. Existing broad typed-table grants remain temporarily for the
staged InstantLaunch writer; the app routes finalized user edits through the audited RPC, and A10 owns
final grant tightening after write-path equivalence.

Live rollback tests passed for hide/restore, freeform and regimen correction, same-key retry, stale
versions, draft-state rejection, invalid correction source, cross-user denial, idempotency reuse, and
supplied audit-ID collision. Postchecks found zero hidden rows, zero audit rows, zero changed activity
versions, and unchanged test metadata. Anonymous execution is denied; authenticated direct writes to
`activities` and `audit_events` remain denied. Advisors show no new public security-definer or schema
findings; historical unrelated advisor debt is unchanged.

The version-one JavaScript metric registry now declares subjects, sources, windows, sample floors,
confidence behavior, exclusions, required inputs, formatting, and whether summaries are adequate.
Meaningful completed and incomplete activities are eligible; hidden, draft, active, paused, and empty
activities are excluded. Ordered-event-only metrics explicitly reject batch summaries.

## Recovery posture

If post-apply verification fails, stop lifecycle writes and preserve an export of the
three new tables rather than hand-editing partial history.
After any client has written lifecycle rows, do not drop the tables or constraints:
quarantine the RPCs, retain the append-only export, and perform a reviewed forward
repair with an `admin_repair` audit event. A6 owns the final rollback/forward-repair
runbook after RPC and concurrency tests exist.
