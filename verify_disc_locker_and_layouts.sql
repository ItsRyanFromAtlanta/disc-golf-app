-- ============================================================================
-- VERIFICATION — run AFTER migration SECTION 2 (backfill) and BEFORE SECTION 3
-- (destructive cleanup), while the old columns still exist for comparison.
-- Every row's fail_count MUST be 0 before you proceed to SECTION 3.
-- ============================================================================

-- Every disc copy is linked to a mold.
select 'discs_without_mold' as check_name, count(*) as fail_count
from discs where mold_id is null

union all
-- No disc's effective flight numbers changed. Effective = coalesce(override,
-- mold stock). Only checked where the copy had an explicit (non-null) value;
-- null copies intentionally inherit the mold's stock.
select 'discs_with_changed_flight_numbers', count(*)
from discs d
join disc_molds m on d.mold_id = m.id
where (d.speed is not null and coalesce(d.override_speed, m.speed) is distinct from d.speed)
   or (d.glide is not null and coalesce(d.override_glide, m.glide) is distinct from d.glide)
   or (d.turn  is not null and coalesce(d.override_turn,  m.turn)  is distinct from d.turn)
   or (d.fade  is not null and coalesce(d.override_fade,  m.fade)  is distinct from d.fade)

union all
-- Every hole re-pointed to a layout.
select 'holes_without_layout', count(*) from holes where layout_id is null

union all
-- Each hole's new layout belongs to the same course the hole was under.
select 'holes_layout_course_mismatch', count(*)
from holes h join layouts l on h.layout_id = l.id
where h.course_id is not null and l.course_id <> h.course_id

union all
-- Every round re-pointed to a layout.
select 'rounds_without_layout', count(*) from rounds where layout_id is null

union all
-- Each round's new layout belongs to the round's course.
select 'rounds_layout_course_mismatch', count(*)
from rounds r join layouts l on r.layout_id = l.id
where l.course_id <> r.course_id

union all
-- At most one default layout per course.
select 'courses_with_multiple_default_layouts', count(*)
from (
  select course_id from layouts where is_default group by course_id having count(*) > 1
) x

order by check_name;
