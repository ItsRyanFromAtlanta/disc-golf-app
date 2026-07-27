-- Phase E: in-app account deletion (privacy purge).
--
-- Why: App Store Guideline 5.1.1(v) requires any app that creates accounts to
-- offer in-app account deletion, and PRODUCT_ROADMAP's privacy rule says a
-- purge must truly remove scoped data rather than soft-hide it. The app had
-- export (E1) but no deletion path at all.
--
-- Ideal format: no new tables. One security-definer entry point that acts only
-- on auth.uid(), because deleting from auth.users requires privileges an
-- ordinary authenticated role must never hold. Every owner-scoped table already
-- declares `user_id ... references auth.users(id) on delete cascade`, so the
-- single auth.users delete is what removes practice, disc, bag, round, goal,
-- report, notification, photo-metadata, and audit rows.
--
-- Three things are NOT covered by that cascade and are handled explicitly:
--   1. Community attribution — public.courses.created_by,
--      public.course_aliases.created_by and public.disc_molds.created_by are
--      nullable references with no cascade, so they would BLOCK the delete.
--      Shared course and catalog rows must survive a member leaving, so
--      attribution is released to null rather than deleting community data.
--   2. public.catalog_submission_reviews.reviewer_id is NOT NULL with no
--      cascade, so those review rows are deleted outright.
--   3. Storage objects. disc_photos metadata cascades, but the private
--      objects in the `disc-private-photos` bucket are keyed by a
--      `{user_id}/{disc_id}/{slot}/{uuid}` path and would be orphaned.
--
-- Rollback: `drop function public.delete_own_account();`. No data is created,
-- no table or column is altered, and prior grants are untouched, so dropping
-- the function fully reverses this migration. Deletions performed while it
-- existed are irreversible by design — that is the point of a privacy purge.

begin;

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

  -- 2. Review artifacts authored by this user cannot be orphaned (NOT NULL).
  delete from public.catalog_submission_reviews where reviewer_id = v_user_id;

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
  'Releases community attribution to null and removes private storage objects. '
  'Acts only on auth.uid(); accepts no arguments so no caller can target another user.';

-- Least privilege: the function takes no parameters and derives its subject
-- from the JWT, but it must still be unreachable from anon/public.
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

commit;
