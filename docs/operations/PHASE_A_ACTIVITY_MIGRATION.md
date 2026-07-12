# Phase A activity migration — A5 review packet

Status: **drafted, unapplied** (2026-07-12)

Migration: `supabase/migrations/20260712193922_phase_a_activity_lifecycle.sql`

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

The draft intentionally contains no lifecycle RPCs. A6 must add and review
serialized, idempotent, owner-checked `SECURITY DEFINER` functions before any
client can mutate lifecycle rows.

## A6 preflight and apply gate

1. Re-confirm a fresh dashboard backup or `pg_dump` immediately before applying.
2. Run the preflight counts and collision/ownership checks from the audit notebook;
   all must remain zero except the documented historical row counts.
3. Review the migration in the SQL editor and confirm the migration is still marked
   unapplied locally and remotely.
4. Apply during a short maintenance window. The migration is transactional, but
   A6 should still monitor locks and verify the composite foreign keys before opening
   lifecycle writes.
5. Add the A6 RPCs only after the table grants and RLS policies are verified.

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
must fail until the reviewed A6 RPCs are installed. Service-role verification is
performed separately and must not be exposed to the browser.

## Recovery posture

Before client rollout, recovery is a database restore from the confirmed backup.
If post-apply verification fails, stop lifecycle writes, preserve an export of the
three new tables, and restore the backup rather than hand-editing partial history.
After any client has written lifecycle rows, do not drop the tables or constraints:
quarantine the RPCs, retain the append-only export, and perform a reviewed forward
repair with an `admin_repair` audit event. A6 owns the final rollback/forward-repair
runbook after RPC and concurrency tests exist.
