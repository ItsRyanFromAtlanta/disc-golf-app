-- ============================================================================
-- MIGRATION: disc locker + layouts (Track 1B + 1.5)
-- Prerequisite: run disc_locker_and_layouts_schema.sql FIRST (adds the new
-- tables/columns this migration populates).
--
-- HOW TO RUN — three sections, in order, each in the Supabase SQL editor:
--   SECTION 1  DRY RUN ............ read-only. Run it, review the output.
--   SECTION 2  BACKFILL ........... safe + reversible (old columns retained).
--                                    Run after approving the dry run.
--   SECTION 3  DESTRUCTIVE CLEANUP  irreversible. Drops old columns, tightens
--                                    constraints. Run ONLY after (a) a verified
--                                    database backup and (b) the verification
--                                    queries between 2 and 3 pass.
--
-- SAFETY / SEMANTICS:
--   * Effective flight numbers are preserved. A mold's stock numbers are taken
--     from a representative existing copy; a copy gets an override on an axis
--     only when it has an explicit value that DIFFERS from stock. A copy with a
--     null value on an axis inherits the mold's stock (intended: flight numbers
--     are a mold property; a copy with no recorded number shows the mold's).
--   * Backfill steps are idempotent (guarded by `... is null` / NOT EXISTS), so
--     a partial/repeated run is safe.
--   * is_active=false maps to status 'retired' (neutral "not in rotation"); the
--     user can reclassify to 'lost'/'sold' in the UI later.
-- ============================================================================


-- ############################################################################
-- SECTION 1 — DRY RUN (read-only; makes no changes)
-- ############################################################################

-- 1a. Molds that would be created from distinct (manufacturer, mold) pairs.
select 'molds_to_create' as report, count(*) as n
from (
  select distinct lower(coalesce(manufacturer,'Unknown')) mfr, lower(mold) mld
  from discs
  where mold_id is null
) g;

-- 1b. The actual mold rows that would be created (manufacturer, mold, stock #s
--     taken from the most-complete representative copy).
select 'mold_preview' as report,
       coalesce(manufacturer,'Unknown') as manufacturer,
       mold as mold_name,
       speed, glide, turn, fade
from (
  select distinct on (lower(coalesce(manufacturer,'Unknown')), lower(mold))
    manufacturer, mold, speed, glide, turn, fade
  from discs
  where mold_id is null
  order by lower(coalesce(manufacturer,'Unknown')), lower(mold),
           (( (speed is not null)::int + (glide is not null)::int
            + (turn is not null)::int + (fade is not null)::int )) desc,
           created_at asc
) reps
order by manufacturer, mold_name;

-- 1c. Discs that would be linked to a mold, and how many would get each override.
select 'discs_total' as report, count(*) n from discs
union all select 'discs_already_linked', count(*) from discs where mold_id is not null
union all select 'discs_to_link', count(*) from discs where mold_id is null
union all select 'is_active_false_to_retired', count(*) from discs where is_active is false;

-- 1d. Layouts that would be created (course defaults + distinct round layouts).
select 'course_default_layouts_to_create' as report, count(*) n
from courses c
where not exists (select 1 from layouts l where l.course_id = c.id and l.is_default)
union all
select 'round_named_layouts_to_create', count(*)
from (
  select distinct r.course_id, lower(coalesce(nullif(trim(r.layout_name),''),'Main')) nm
  from rounds r
) rl
where not exists (
  select 1 from layouts l
  where l.course_id = rl.course_id and lower(l.name) = rl.nm
);

-- 1e. Holes / rounds that would be re-pointed to a layout.
select 'holes_to_repoint' as report, count(*) n from holes where layout_id is null
union all select 'rounds_to_repoint', count(*) from rounds where layout_id is null;

-- END SECTION 1. Review the above before running SECTION 2.


-- ############################################################################
-- SECTION 2 — BACKFILL (safe, reversible: old columns are retained)
-- Wrapped in a transaction; COMMIT at the end. Idempotent.
-- ############################################################################
begin;

-- 2a. Create one mold per distinct (manufacturer, mold). Stock numbers come
--     from the most-complete representative copy (fewest null flight fields,
--     earliest as tiebreak).
insert into disc_molds (manufacturer, mold_name, speed, glide, turn, fade)
select coalesce(manufacturer,'Unknown'), mold, speed, glide, turn, fade
from (
  select distinct on (lower(coalesce(manufacturer,'Unknown')), lower(mold))
    manufacturer, mold, speed, glide, turn, fade
  from discs
  where mold_id is null
  order by lower(coalesce(manufacturer,'Unknown')), lower(mold),
           (( (speed is not null)::int + (glide is not null)::int
            + (turn is not null)::int + (fade is not null)::int )) desc,
           created_at asc
) reps
on conflict (lower(manufacturer), lower(mold_name)) do nothing;

-- 2b. Link each disc copy to its mold.
update discs d
set mold_id = m.id
from disc_molds m
where d.mold_id is null
  and lower(coalesce(d.manufacturer,'Unknown')) = lower(m.manufacturer)
  and lower(d.mold) = lower(m.mold_name);

-- 2c. Move manual flight numbers to overrides ONLY where a copy has an explicit
--     value that differs from its mold's stock. Null copy values inherit stock.
update discs d
set override_speed = case when d.speed is not null and d.speed is distinct from m.speed then d.speed end,
    override_glide = case when d.glide is not null and d.glide is distinct from m.glide then d.glide end,
    override_turn  = case when d.turn  is not null and d.turn  is distinct from m.turn  then d.turn  end,
    override_fade  = case when d.fade  is not null and d.fade  is distinct from m.fade  then d.fade  end
from disc_molds m
where d.mold_id = m.id;

-- 2d. Map is_active -> status. Schema already defaulted new rows to 'in_locker';
--     only the inactive ones need reclassifying.
update discs set status = 'retired' where is_active is false and status = 'in_locker';

-- 2e. Create a default layout per course from its layout_name (default 'Main').
insert into layouts (course_id, name, is_default)
select c.id, coalesce(nullif(trim(c.layout_name),''),'Main'), true
from courses c
where not exists (select 1 from layouts l where l.course_id = c.id and l.is_default);

-- 2f. Create non-default layouts for distinct round layout_names not already
--     represented, so each round keeps the layout it was actually played on.
insert into layouts (course_id, name, is_default)
select distinct r.course_id, coalesce(nullif(trim(r.layout_name),''),'Main'), false
from rounds r
where not exists (
  select 1 from layouts l
  where l.course_id = r.course_id
    and lower(l.name) = lower(coalesce(nullif(trim(r.layout_name),''),'Main'))
);

-- 2g. Re-point holes to their course's default layout.
update holes h
set layout_id = l.id
from layouts l
where h.layout_id is null
  and l.course_id = h.course_id
  and l.is_default;

-- 2h. Re-point rounds: match layout by name under the course, else the default.
update rounds r
set layout_id = coalesce(
  (select l.id from layouts l
    where l.course_id = r.course_id
      and lower(l.name) = lower(coalesce(nullif(trim(r.layout_name),''),'Main'))
    limit 1),
  (select l.id from layouts l where l.course_id = r.course_id and l.is_default limit 1)
)
where r.layout_id is null;

commit;

-- END SECTION 2. Now run the VERIFICATION queries (verify_disc_locker_and_layouts.sql).
-- They MUST all pass before you run SECTION 3.


-- ############################################################################
-- SECTION 3 — DESTRUCTIVE CLEANUP (irreversible)
-- PRECONDITIONS: (1) database backup taken and verified; (2) verification
-- queries all green. This drops the now-redundant old columns and tightens
-- constraints to the new model. Transactional: if any statement fails the
-- whole thing rolls back.
-- ############################################################################
begin;

-- 3a. discs: drop is_active (replaced by status) and the stock flight numbers
--     (now on the mold + overrides). Keep manufacturer/mold text as human
--     labels, plastic, condition, notes.
alter table discs
  drop column if exists is_active,
  drop column if exists speed,
  drop column if exists glide,
  drop column if exists turn,
  drop column if exists fade;

-- Every disc has a non-null mold text, so every disc linked -> mold_id is safe
-- to make NOT NULL. (Verification 'discs_without_mold' must be 0 first.)
alter table discs alter column mold_id set not null;

-- 3b. holes: switch the identity/uniqueness onto layout_id and drop course_id.
--     Dropping course_id also drops the old unique(course_id, hole_number,
--     tee_type) and the course FK; replace the unique on layout_id.
alter table holes alter column layout_id set not null;
alter table holes drop column if exists course_id;
create unique index if not exists holes_layout_hole_tee_uniq
  on holes (layout_id, hole_number, tee_type);

-- 3c. rounds: drop the now-redundant layout_name text (replaced by layout_id).
--     layout_id is left NULLABLE on purpose (future score-only imports may not
--     resolve a layout). course_id is retained.
alter table rounds drop column if exists layout_name;

commit;

-- END SECTION 3. Migration complete.
