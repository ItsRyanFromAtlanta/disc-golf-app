-- disc_molds CORRECTIONS — molds already live whose flight numbers look wrong.
--
-- READ BEFORE RUNNING. This is the only file in the catalog set that MODIFIES
-- existing rows. Every other seed is ON CONFLICT DO NOTHING and cannot change
-- anything. That is why these corrections are quarantined here instead of being
-- folded into the seed: overwriting live catalog data should be a decision, not
-- a side effect of re-running a seed.
--
-- ============================================================
-- WHERE THIS CAME FROM
-- ============================================================
-- While compiling the 2026-07-30 catalog seed, the existing 36 molds were
-- cross-checked against current published numbers. Nine to thirteen of the 19
-- molds seeded from `disc_molds_seed.sql` disagree with what manufacturers and
-- retailers publish today. The Streamline set looks like a systematic mix-up
-- rather than three independent typos: the DB's Trace numbers (7/5/-2/1) are
-- the Drift's numbers, and the Drift and Pilot are both wrong as well.
--
-- No page could be fetched directly (the outbound proxy refuses these hosts),
-- so every claim below rests on web-search result summaries — but the ones in
-- Tier 1 were each confirmed against multiple independent retailer listings
-- that quote the manufacturer's own figures in their product titles.
--
-- ============================================================
-- SAFETY PROPERTY OF EVERY STATEMENT HERE
-- ============================================================
-- Each UPDATE matches on the CURRENT (suspected-wrong) values as well as the
-- mold identity. So:
--   * running this twice changes nothing the second time,
--   * if someone already corrected a mold by hand, that row is skipped rather
--     than being reverted to a value this file happens to prefer,
--   * if a row does not match, it silently updates 0 rows — check the row
--     counts psql reports rather than assuming every statement applied.
--
-- Run the verification query at the bottom afterwards.

begin;

-- ============================================================
-- TIER 1 — independently re-verified 2026-07-30. Highest confidence.
-- Each was confirmed in a separate targeted search against multiple retailers.
-- ============================================================

-- Streamline Trace: DB says 7/5/-2/1 fairway. It is an 11-speed DISTANCE driver.
-- Sources: discgolfdojo (Streamline distance drivers), 1010discs "Stable
-- Distance Driver", gottagogottathrow "Neutron Trace Distance Driver".
-- The DB's values are the Drift's numbers, which is what makes this look like a
-- row-shift rather than a typo.
update public.disc_molds
   set speed = 11, glide = 5, turn = -1, fade = 2, category = 'distance'
 where lower(manufacturer) = 'streamline' and lower(mold_name) = 'trace'
   and speed = 7 and glide = 5 and turn = -2 and fade = 1;

-- MVP Wave: DB says 13/5/-1/2. Published as 11/5/-2/2 — wrong on speed AND turn.
-- Sources: mvpdiscsports.com product page, titandiscgolf "Proton Wave 11/5/-2/2",
-- armorydiscgolf, discgolfshopping.
update public.disc_molds
   set speed = 11, glide = 5, turn = -2, fade = 2
 where lower(manufacturer) = 'mvp' and lower(mold_name) = 'wave'
   and speed = 13 and glide = 5 and turn = -1 and fade = 2;

-- Streamline Pilot: DB says 3/3/-0.5/1. Published as 2/5/0/1.
-- Sources: titandiscgolf (two listings quoting 2/5/0/1), skylinediscs,
-- flightfactorydiscs, marshallstreetdiscgolf. One listing shows 2/5/-1/1, so the
-- turn has some retailer disagreement; 0 is the majority and the MVP-published
-- figure.
update public.disc_molds
   set speed = 2, glide = 5, turn = 0, fade = 1
 where lower(manufacturer) = 'streamline' and lower(mold_name) = 'pilot'
   and speed = 3 and glide = 3 and turn = -0.5 and fade = 1;

-- Axiom Insanity: DB says 8/5/-2/1 fairway. Published as 9/5/-2/1.5, and Axiom
-- and most retailers class it as a distance driver (20 mm rim).
-- Sources: axiomdiscs.com, titandiscgolf "Proton Insanity 9/5/-2/1.5",
-- gottagogottathrow "Distance Driver", armorydiscgolf "Straight 9 Speed".
-- NOTE: 1010discs calls it an "Understable Fairway Driver" — the category is
-- genuinely contested even though the numbers are not. If you prefer to leave
-- category alone, drop it from the SET list; the numbers are the point.
update public.disc_molds
   set speed = 9, glide = 5, turn = -2, fade = 1.5, category = 'distance'
 where lower(manufacturer) = 'axiom' and lower(mold_name) = 'insanity'
   and speed = 8 and glide = 5 and turn = -2 and fade = 1;

-- ============================================================
-- TIER 2 — corroborated across multiple retailer listings during research,
-- but NOT re-verified independently afterwards. Good, not proven.
-- ============================================================

-- Streamline Drift: DB says 7/6/-3/1. Published as 7/5/-2/1.
update public.disc_molds
   set glide = 5, turn = -2
 where lower(manufacturer) = 'streamline' and lower(mold_name) = 'drift'
   and speed = 7 and glide = 6 and turn = -3 and fade = 1;

-- MVP Servo: DB says 7/5/-1/1.5. Published as 6.5/5/-1/2.
update public.disc_molds
   set speed = 6.5, fade = 2
 where lower(manufacturer) = 'mvp' and lower(mold_name) = 'servo'
   and speed = 7 and glide = 5 and turn = -1 and fade = 1.5;

-- Axiom Wrath: DB says 9.5/5/-1.5/2. Published as 9/4.5/-0.5/2, described as a
-- worn-in Tesla profile, which fits the lower turn.
update public.disc_molds
   set speed = 9, glide = 4.5, turn = -0.5
 where lower(manufacturer) = 'axiom' and lower(mold_name) = 'wrath'
   and speed = 9.5 and glide = 5 and turn = -1.5 and fade = 2;

-- Axiom Fireball: DB says 8/4/0/3. Published as 9/3.5/0/3.5 in Neutron.
-- (Fission Fireball is listed separately as 9/4/0/3.5 — MVP-family plastics
-- genuinely publish different numbers per plastic, and this schema is one row
-- per mold, so the Neutron/base figure is the right one to store.)
update public.disc_molds
   set speed = 9, glide = 3.5, fade = 3.5
 where lower(manufacturer) = 'axiom' and lower(mold_name) = 'fireball'
   and speed = 8 and glide = 4 and turn = 0 and fade = 3;

-- Axiom Proxy: DB says speed 4. Published as speed 3.
update public.disc_molds
   set speed = 3
 where lower(manufacturer) = 'axiom' and lower(mold_name) = 'proxy'
   and speed = 4 and glide = 3 and turn = -1 and fade = 0.5;

commit;

-- ============================================================
-- TIER 3 — NOT APPLIED. Left commented deliberately.
-- ============================================================
-- These are unresolved: research returned a value that disagrees with the DB,
-- but without enough corroboration to justify overwriting live data. Applying a
-- second wrong number over a first wrong number is not progress. Check each
-- against the manufacturer's own flight chart before uncommenting.
--
-- MVP Vector — DB 5/4/-0.5/2.5, one source says 5/4/0/2. Genuinely unresolved.
-- update public.disc_molds set turn = 0, fade = 2
--  where lower(manufacturer)='mvp' and lower(mold_name)='vector'
--    and speed=5 and glide=4 and turn=-0.5 and fade=2.5;
--
-- MVP Reactor — DB turn -1, one source says -0.5.
-- update public.disc_molds set turn = -0.5
--  where lower(manufacturer)='mvp' and lower(mold_name)='reactor'
--    and speed=5 and glide=5 and turn=-1 and fade=1.5;
--
-- Axiom Hex — DB fade 0.5, one source says 1. Small and low-stakes either way.
-- update public.disc_molds set fade = 1
--  where lower(manufacturer)='axiom' and lower(mold_name)='hex'
--    and speed=5 and glide=5 and turn=-1 and fade=0.5;
--
-- MVP Tesla — the numbers (9/5/-1/2) look right; only the CATEGORY is disputed.
-- The DB says 'fairway'; MVP lists it as a distance driver. Category for speed
-- 9-10 discs is a judgement call, so this is not clearly an error.
-- update public.disc_molds set category = 'distance'
--  where lower(manufacturer)='mvp' and lower(mold_name)='tesla' and category='fairway';
--
-- ALSO UNRESOLVED, in the opposite direction: MVP Atom and Anode. Research
-- returned 3/3/-0.5/0 and 2.5/3/0/0, disagreeing with the DB's fade of 1 on
-- both. The source was a single putter chart. The DB may well be right. No
-- statement is offered — this is recorded so the disagreement is not lost.

-- ============================================================
-- POST-APPLY VERIFICATION
-- ============================================================
-- Expect: Trace 11/5/-1/2 distance, Wave 11/5/-2/2, Pilot 2/5/0/1,
-- Insanity 9/5/-2/1.5 distance, Drift 7/5/-2/1, Servo 6.5/5/-1/2,
-- Wrath 9/4.5/-0.5/2, Fireball 9/3.5/0/3.5, Proxy 3/3/-1/0.5.
--
-- select manufacturer, mold_name, speed, glide, turn, fade, category
--   from public.disc_molds
--  where (lower(manufacturer), lower(mold_name)) in (
--    ('streamline','trace'), ('streamline','drift'), ('streamline','pilot'),
--    ('mvp','wave'), ('mvp','servo'),
--    ('axiom','insanity'), ('axiom','wrath'), ('axiom','fireball'), ('axiom','proxy'))
--  order by manufacturer, mold_name;
