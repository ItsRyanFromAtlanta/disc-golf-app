-- Phase A A10: release-gate indexes.
-- The notification activity-owner foreign key is queried with the activity
-- identity and owner together during durable review; cover both columns so
-- referential checks and activity-scoped reads do not scan the notification
-- table.

begin;

create index notifications_activity_owner_idx
  on public.notifications (activity_id, user_id);

commit;
