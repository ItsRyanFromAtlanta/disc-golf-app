--
-- Phase B B1.8 follow-on guard.
--
-- Canonical writes and batch closure must share the staged raw-artifact
-- contract. The trigger makes the requirement database-enforced even if a
-- trusted service_role caller bypasses the Edge Function.

begin;

create or replace function private.catalog_import_batch_close_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'reviewed' and new.status in ('accepted', 'rejected') then
    if not exists (
      select 1
      from public.catalog_import_artifacts a
      where a.import_batch_id = new.id
        and a.source_checksum = new.source_checksum
        and a.artifact_kind = 'raw_response'
    ) then
      raise exception using errcode = 'P0001', message = 'catalog_artifact_missing';
    end if;
    if new.completed_at is null then
      raise exception using errcode = 'P0001', message = 'catalog_batch_close_incomplete';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_import_batches_close_guard_trg
  on public.catalog_import_batches;
create trigger catalog_import_batches_close_guard_trg
  before update of status on public.catalog_import_batches
  for each row execute function private.catalog_import_batch_close_guard();

revoke all on function private.catalog_import_batch_close_guard()
  from public, anon, authenticated;
grant execute on function private.catalog_import_batch_close_guard() to service_role;

commit;
