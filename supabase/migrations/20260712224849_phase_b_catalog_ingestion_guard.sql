-- Phase B B1.9 authenticated ingestion guard.
--
-- This is a service-only preflight used by the catalog-ingestion Edge
-- Function. It keeps unauthorized callers from starting a remote fetch; the
-- staging transaction repeats the same allowlist check at its write boundary.

begin;

create or replace function public.catalog_assert_ingestion_admin(
  p_user_id uuid,
  p_principal text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null
     or p_principal is distinct from ('admin:' || p_user_id::text)
     or not exists (
       select 1
         from private.catalog_ingestion_admins a
        where a.user_id = p_user_id
          and a.revoked_at is null
     )
  then
    raise exception using errcode = 'P0001', message = 'catalog_admin_required';
  end if;
  return true;
end;
$$;

revoke all on function public.catalog_assert_ingestion_admin(uuid, text)
  from public, anon, authenticated;
grant execute on function public.catalog_assert_ingestion_admin(uuid, text)
  to service_role;

commit;
