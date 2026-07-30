-- E2 audit finding 8: duplicate hole numbers are possible on a quick course.
--
-- `holes_layout_hole_tee_uniq` covers (layout_id, hole_number, tee_type), which
-- reads as "one row per tee per hole per layout". It does not enforce that when
-- `tee_type` is NULL, because Postgres treats NULLs as distinct in a unique
-- index by default -- so (layout, 1, NULL) and (layout, 1, NULL) are two
-- different keys and both are accepted.
--
-- That is not a theoretical gap. The quick-course form never sets `tee_type`, so
-- *every* hole it writes lands in the NULL branch and none of them is protected.
-- A double-submit, or a queued course replayed with regenerated hole ids, silently
-- produces a layout with two hole 1s -- which then reaches the scorecard, the par
-- total, and every score derived from them.
--
-- Fixed with `nulls not distinct` (Postgres 15+; this project runs 17.6), which
-- makes two NULL tee types compare equal for uniqueness purposes. The single-tee
-- case is the common one and it is now covered by the same index as the rest.
--
-- Chosen over the alternative of a synthetic default tee -- writing something
-- like 'default' instead of NULL. That would work, but it puts a placeholder in
-- a user-visible column that the UI would then have to know to hide, and it
-- needs a backfill. This constrains the data without changing what it says.
--
-- Not `concurrently`: that cannot run inside a transaction, and the migration
-- runner wraps each file in one. The table is small (0 rows at the time of
-- writing, and a course catalog is measured in thousands), so the brief
-- ACCESS EXCLUSIVE lock is not a concern. Revisit if the catalog ever grows
-- enough that a rebuild is slow -- at that point split it into a concurrent
-- create plus a rename, outside a transaction.

-- Drop and recreate rather than alter: there is no
-- `alter index ... set (nulls not distinct)`. The NULL-distinctness of a unique
-- index is fixed at creation.
drop index if exists public.holes_layout_hole_tee_uniq;

create unique index holes_layout_hole_tee_uniq
  on public.holes (layout_id, hole_number, tee_type)
  nulls not distinct;

comment on index public.holes_layout_hole_tee_uniq is
  'One row per (layout, hole_number, tee_type). NULLS NOT DISTINCT so a layout '
  'with no explicit tee types -- which is every quick course -- still cannot '
  'hold two rows for the same hole number. See E2 audit finding 8.';
