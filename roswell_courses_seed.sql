-- Roswell / Alpharetta GA course seed — East Roswell Park and Wills Park.
--
-- Real courses, real course-level facts. Run in the Supabase SQL editor.
-- Idempotent: every insert resolves against an existing unique index and DOES
-- NOTHING on conflict, so re-running never duplicates and never overwrites
-- anything a person has since enriched by hand.
--
-- ============================================================
-- WHAT IS TRUE HERE, AND WHAT IS DELIBERATELY NULL
-- ============================================================
-- Course identity, location, hole count, tee sets, total par and total length
-- are recorded because they are published and consistent across sources.
--
-- **Per-hole par and per-hole distance are NULL for all 36 holes.** They are not
-- published anywhere reachable. This is deliberate and is the instruction the
-- seed was written under: record what is factual, null what is not, and let
-- manual enrichment fill the rest later.
--
-- The temptation to avoid: East Roswell Park plays to par 56 over 18 holes, so
-- 16 holes are par 3 and 2 are par 4 — but *which* two is not published. Writing
-- par 3 everywhere would sum to 54 and be quietly wrong; guessing the two par 4s
-- would be fabrication. Both totals are recorded in these comments instead, and
-- `holes.par` stays NULL until someone walks the course. The app already handles
-- this: `relativeToPar` returns null rather than a number when a layout has no
-- real pars, and the course-prep sheet reports its own coverage ("Distance
-- recorded on N of M holes") rather than implying completeness.
--
-- ============================================================
-- SOURCES (accessed 2026-07-30, via search result summaries)
-- ============================================================
-- Direct page fetches to pdga.com, dgcoursereview.com, udisc.com,
-- discgolfscene.com and discgolfcourses.com were all refused by this
-- environment's outbound proxy, so nothing here was scraped. Every fact below
-- came from search-result summaries of those same directories and from the
-- municipal pages, and each is corroborated by at least two of them.
--
--   PDGA course directory   https://www.pdga.com/course-directory/course/east-roswell-park
--                           https://www.pdga.com/course-directory/course/wills-park
--   Disc Golf Course Review https://www.dgcoursereview.com/courses/east-roswell-park.213
--                           https://www.dgcoursereview.com/courses/wills-park.4309
--   UDisc                   https://udisc.com/courses/east-roswell-park-w9Ib
--                           https://udisc.com/courses/wills-park-OVna
--   City of Roswell         https://www.roswellgov.com/facilities/east-roswell-park/
--
-- EAST ROSWELL PARK — 9000 Fouts Road, Roswell, GA 30076
--   18 holes, established 2004, designed by Roswell Recreation and Parks
--   grounds supervisor Mark Holder with local players. Wooded, tight fairways,
--   significant elevation. Concrete tees. The three original tee pads per hole
--   were consolidated to two — white and black — when concrete pads were poured
--   in 2019, which is why two layouts are seeded and not three.
--   Black (long): par 56, 5,848 ft.   White (short): 4,397 ft.
--   Hole length distribution (long tees): 6 under 300 ft, 10 from 300-400 ft,
--   2 over 400 ft.
--
-- WILLS PARK — 11925 Wills Road, Alpharetta, GA 30004
--   NOTE THE CITY. This course is commonly associated with Roswell and appears
--   under Roswell-area guides, but it sits in **Alpharetta**, not Roswell. The
--   address and the municipal owner are both Alpharetta. Recorded as Alpharetta
--   deliberately; if the intent was a different Wills Park, this row is the one
--   to check first.
--   18 holes, designed by Keith Johnson, September 2010. Par 55, 4,605 ft with
--   an alternate length of 5,000 ft. Concrete tees, DISCatcher Pro targets.
--   Hole length distribution: 11 under 300 ft, 7 from 300-400 ft, none over 400.
--   Only ONE layout is seeded. Two tee lengths clearly exist, but their names
--   are not published anywhere reachable, and inventing "Long"/"Short" would put
--   a fabricated label on a real course. The second layout is left for manual
--   enrichment.
--
-- `created_by` is NULL on both courses: these are community rows contributed by
-- the catalog, not by a user account. That matches `delete_own_account()`, which
-- releases course attribution to NULL rather than deleting shared rows.

begin;

do $$
declare
  v_course_id uuid;
  v_layout_id uuid;
begin
  -- ============================================================
  -- EAST ROSWELL PARK — Roswell, GA
  -- ============================================================
  insert into public.courses (name, location, layout_name, external_source, external_ref)
  values (
    'East Roswell Park',
    '9000 Fouts Road, Roswell, GA 30076',
    'Black (Long)',
    'curated_seed',
    'east-roswell-park-roswell-ga'
  )
  on conflict (external_source, external_ref) where external_source is not null do nothing;

  select id into strict v_course_id
    from public.courses
   where external_source = 'curated_seed'
     and external_ref = 'east-roswell-park-roswell-ga';

  -- Black (long) is the default: it is the layout the PDGA directory lists as
  -- the course's par-56 configuration.
  insert into public.layouts (course_id, name, is_default)
  values (v_course_id, 'Black (Long)', true)
  on conflict (course_id, lower(name)) do nothing;

  select id into strict v_layout_id
    from public.layouts
   where course_id = v_course_id and lower(name) = 'black (long)';

  insert into public.holes (layout_id, hole_number, par, distance_feet)
  select v_layout_id, hole_number, null::int, null::int
    from generate_series(1, 18) as hole_number
  on conflict (layout_id, hole_number, tee_type) do nothing;

  insert into public.layouts (course_id, name, is_default)
  values (v_course_id, 'White (Short)', false)
  on conflict (course_id, lower(name)) do nothing;

  select id into strict v_layout_id
    from public.layouts
   where course_id = v_course_id and lower(name) = 'white (short)';

  insert into public.holes (layout_id, hole_number, par, distance_feet)
  select v_layout_id, hole_number, null::int, null::int
    from generate_series(1, 18) as hole_number
  on conflict (layout_id, hole_number, tee_type) do nothing;

  -- ============================================================
  -- WILLS PARK — Alpharetta, GA (see the city note in the header)
  -- ============================================================
  insert into public.courses (name, location, layout_name, external_source, external_ref)
  values (
    'Wills Park',
    '11925 Wills Road, Alpharetta, GA 30004',
    'Main',
    'curated_seed',
    'wills-park-alpharetta-ga'
  )
  on conflict (external_source, external_ref) where external_source is not null do nothing;

  select id into strict v_course_id
    from public.courses
   where external_source = 'curated_seed'
     and external_ref = 'wills-park-alpharetta-ga';

  insert into public.layouts (course_id, name, is_default)
  values (v_course_id, 'Main', true)
  on conflict (course_id, lower(name)) do nothing;

  select id into strict v_layout_id
    from public.layouts
   where course_id = v_course_id and lower(name) = 'main';

  insert into public.holes (layout_id, hole_number, par, distance_feet)
  select v_layout_id, hole_number, null::int, null::int
    from generate_series(1, 18) as hole_number
  on conflict (layout_id, hole_number, tee_type) do nothing;
end
$$;

commit;

-- ============================================================
-- POST-APPLY VERIFICATION — expect 2 courses, 3 layouts, 54 holes
-- ============================================================
-- select c.name, c.location, l.name as layout, l.is_default, count(h.id) as holes
--   from public.courses c
--   join public.layouts l on l.course_id = c.id
--   left join public.holes h on h.layout_id = l.id
--  where c.external_source = 'curated_seed'
--  group by c.name, c.location, l.name, l.is_default
--  order by c.name, l.is_default desc, l.name;
--
-- Every hole should report par and distance_feet as NULL. If any hole has a
-- number, it was enriched by hand after seeding — do not re-run this file
-- expecting to overwrite it, because it will not.
