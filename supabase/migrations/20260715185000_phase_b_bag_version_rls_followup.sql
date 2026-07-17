-- Phase B 2A follow-up: remove self-recursive INSERT-policy lookup and add
-- the composite/restoration FK indexes reported by the database advisor.

begin;

drop policy bag_versions_insert_own on public.bag_versions;
create policy bag_versions_insert_own on public.bag_versions
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.bags b
      where b.id = bag_id and b.user_id = (select auth.uid())
    )
  );

create index bag_versions_restored_from_idx on public.bag_versions (restored_from_version_id)
  where restored_from_version_id is not null;
create index bag_version_discs_version_owner_idx
  on public.bag_version_discs (bag_version_id, user_id);

commit;
