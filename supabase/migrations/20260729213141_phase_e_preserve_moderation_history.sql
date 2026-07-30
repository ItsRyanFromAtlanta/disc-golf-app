-- Phase E: preserve catalog moderation history through an account deletion.
--
-- ORDERING: this migration must be applied AFTER `20260729213112_phase_e_account_deletion.sql`,
-- which creates `public.delete_own_account()`. Both were applied in that sequence on 2026-07-29.
-- Applying this file against a database that has never seen 20260729213112 still works (the
-- function is created rather than replaced), but the pair is designed and reviewed as an ordered
-- sequence, and re-running only the earlier one restores the deleting form of the function.
--
-- Why: `20260729213112` traded away audit history to satisfy a NOT NULL constraint. It carefully
-- preserves community attribution — `courses.created_by`, `course_aliases.created_by` and
-- `disc_molds.created_by` are released to null so shared rows outlive the contributor — but
-- `public.catalog_submission_reviews.reviewer_id` was NOT NULL with no cascade, so its step 2 had
-- only one option that would not block the `auth.users` delete: hard-delete the review rows. That
-- erases a departing moderator's decisions (`decision`, `reason`, `canonical_entity_id`,
-- `created_at`) from the catalog audit trail, and it erases them from the *submitter's* view too —
-- `catalog_submission_reviews_select_submitter` is the policy that lets a submitter see why their
-- submission was rejected or sent back for changes. A submitter losing the reason for a decision
-- because an unrelated moderator closed their account is a data-loss defect, not a privacy feature.
--
-- Which is correct is not a judgement call here; the repo already decided. PRODUCT_ROADMAP states
-- "Raw events and version history are authoritative" and "User corrections preserve previous/new
-- values, effective time, recorded time, source, and reason". The three nulled `created_by` columns
-- are the established pattern for exactly this shape of problem: the *identity* is what a privacy
-- purge must remove, not the shared record the identity acted on. Moderation history is shared
-- record. So `reviewer_id` becomes nullable and joins the nulling set.
--
-- Privacy note: this does NOT weaken the purge. `reviewer_id` is the only column on
-- `catalog_submission_reviews` that identifies the departing user; `decision`, `reason`,
-- `canonical_entity_id` and `submission_id` describe the reviewed submission, which belongs to
-- someone else. After the update the surviving row points at no identity, exactly as a
-- `created_by`-nulled course does. `reason` is moderator-authored free text and could in principle
-- carry a self-reference, but that is equally true of every retained community row this function
-- already preserves, and it is not a reason to keep deleting the audit trail.
--
-- Changes:
--   1. `public.catalog_submission_reviews.reviewer_id` drops NOT NULL. The FK to auth.users(id)
--      and the `catalog_submission_reviews_reviewer_id_idx` index are unchanged — a nullable FK is
--      still enforced for non-null values, and btree simply stops indexing the nulled rows.
--   2. `public.delete_own_account()` is redefined so step 2 nulls `reviewer_id` instead of deleting
--      the rows. Every other behaviour is byte-for-byte the original: same security definer, same
--      `set search_path = ''`, same `auth.uid()` derivation and `28000` raise, same community
--      attribution releases, same `disc-private-photos` storage cleanup, same final `auth.users`
--      delete, same revoke/grant least-privilege block.
--
-- Idempotent and re-runnable: `alter column ... drop not null` is a no-op on an already-nullable
-- column, `create or replace function` replaces in place, and the revoke/grant statements are
-- absolute (not additive). Running this file twice leaves the same state as running it once.
--
-- Rollback: restoring NOT NULL is only possible once no null `reviewer_id` rows exist, because the
-- constraint is validated against existing data. If no account has been deleted since this applied,
-- re-run the body of `20260729213112` (which restores the deleting form of the function) and then
--   `alter table public.catalog_submission_reviews alter column reviewer_id set not null;`
-- If accounts HAVE been deleted, the nulled rows are the preserved history and there is no
-- non-destructive rollback: setting NOT NULL again would require deleting exactly the audit rows
-- this migration exists to keep. In that case roll back the function only and leave the column
-- nullable. No data is destroyed by applying this migration.

begin;

-- 1. Let a review outlive its reviewer's account.
alter table public.catalog_submission_reviews
  alter column reviewer_id drop not null;

comment on column public.catalog_submission_reviews.reviewer_id is
  'Moderator who recorded this decision. Nullable: released to null by '
  'public.delete_own_account() when the moderator deletes their account, so the decision, '
  'reason and timestamp survive as audit history. Null means "reviewer account deleted", '
  'never "unreviewed" — a row only exists because a review happened.';

-- 2. Redefine the purge so moderation history is released, not destroyed.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required to delete an account'
      using errcode = '28000';
  end if;

  -- 1. Release community attribution. These are shared rows other users read;
  --    they outlive the contributor, but stop pointing at a deleted identity.
  update public.courses set created_by = null where created_by = v_user_id;
  update public.course_aliases set created_by = null where created_by = v_user_id;
  update public.disc_molds set created_by = null where created_by = v_user_id;

  -- 2. Release moderation attribution. Same rule as step 1: the decision, its
  --    reason and its timestamp are audit history that the submitter and the
  --    catalog still depend on, so the identity is removed and the record kept.
  update public.catalog_submission_reviews
     set reviewer_id = null
   where reviewer_id = v_user_id;

  -- 3. Private photo objects, which no foreign key reaches.
  delete from storage.objects
   where bucket_id = 'disc-private-photos'
     and (storage.foldername(name))[1] = v_user_id::text;

  -- 4. The identity itself. Cascades through every owner-scoped table and
  --    through auth.identities/auth.sessions/auth.refresh_tokens.
  delete from auth.users where id = v_user_id;
end;
$$;

comment on function public.delete_own_account() is
  'Permanently deletes the calling user''s account and all owner-scoped data. '
  'Releases community attribution and catalog moderation attribution to null, and removes '
  'private storage objects. '
  'Acts only on auth.uid(); accepts no arguments so no caller can target another user.';

-- Least privilege: the function takes no parameters and derives its subject
-- from the JWT, but it must still be unreachable from anon/public. Restated
-- here because `create or replace function` preserves existing grants but this
-- file must also stand on its own if replayed against a rebuilt database.
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

commit;
