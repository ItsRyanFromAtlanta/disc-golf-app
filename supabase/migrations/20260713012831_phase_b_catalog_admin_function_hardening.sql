--
-- Migration-history reconciliation only.
--
-- The Supabase migration apply service recorded the already-applied B1.8 RPC
-- hardening deployment under this server-generated version. The canonical
-- local SQL is retained in 20260713015000_phase_b_catalog_admin_function_hardening.sql.
-- This file is intentionally a no-op so fresh environments do not replay it.

begin;
commit;
