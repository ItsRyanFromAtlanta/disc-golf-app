--
-- Migration-history reconciliation only.
--
-- The Supabase migration apply service recorded the already-applied B1.8 guard
-- deployment under this server-generated version. The canonical local SQL is
-- retained in 20260713014500_phase_b_catalog_promotion_guards.sql. This file
-- is intentionally a no-op so fresh environments do not replay the trigger.

begin;
commit;
