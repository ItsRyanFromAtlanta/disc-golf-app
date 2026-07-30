-- disc_molds catalog seed — 326 molds across 16 manufacturers (2026-07-30).
--
-- Run in the Supabase SQL editor. Idempotent: ON CONFLICT on the
-- case-insensitive (manufacturer, mold_name) unique index DO NOTHING, so
-- re-running is safe and it never overwrites a mold that already exists —
-- including the 36 seeded in July 2026 and anything entered by hand since.
--
-- ============================================================
-- HOW THIS DATA WAS ACQUIRED, STATED PLAINLY
-- ============================================================
-- This is a CURATED BOOTSTRAP, not a scrape. Direct page fetches to
-- innovadiscs.com, discraft.com and every other manufacturer site were refused
-- by this environment's outbound proxy, so no manufacturer page was read
-- directly. Each mold's numbers were compiled and then cross-checked against
-- web-search result summaries, which frequently quote the manufacturer's own
-- published figures in retailer product titles.
--
-- 270 of 326 molds were checked against at least one search result. That is
-- corroboration, not first-party capture, which is why `scraped_at` is NULL on
-- every row — the same convention `disc_molds_seed.sql` used for its curated
-- bootstrap. `source_name` records the manufacturer; `source_url` is set only
-- where the canonical product URL was actually seen in a result, never
-- constructed to look plausible.
--
-- ============================================================
-- THE RULE APPLIED TO UNCERTAIN DATA
-- ============================================================
-- A wrong flight number is worse than a missing one: it is invisible, it looks
-- authoritative, and it silently poisons every comparison built on top of it.
--
-- So molds researched at LOW confidence keep their identity and get NULL
-- flight numbers. 55 molds were nulled by this rule on top of 24 that had no
-- numbers to begin with. **79 of 326 molds carry identity only; 247 carry
-- flight numbers.** The 79 are real molds worth having in the catalog as
-- targets for manual enrichment — they are not padding, and they are not
-- guesses dressed up as data.
--
-- Whole manufacturers deliberately landed in the identity-only bucket:
--   * Gateway — their site publishes per-plastic rather than per-mold (Wizard
--     SS/SSS/SSSS/Firm/Special Blend), and search returned implausible
--     duplicates (Wizard and Magic both 2/3/0/2). All 13 are identity-only.
--   * Kastaplast — most numbers traced to one aggregated chart that visibly
--     mis-filed Guld, a 13-speed, under midranges. If its categories are wrong
--     its numbers are not trustworthy either.
--   * Prodigy — the letter-number model names (D3, F1, PA5) collide with
--     plastic grades (300, 400, 750) badly enough that search results are not
--     separable.
--
-- ============================================================
-- TWO THINGS THAT WILL LOOK LIKE BUGS AND ARE NOT
-- ============================================================
-- 1. POSITIVE TURN. Turn is normally negative or zero, but several discs are
--    genuinely published with positive turn: Discraft Malta (5/4/+1/3) and
--    Zone OS (4/2/+1/5), Dynamic Discs Enforcer (12/4/+0.5/4), Felon
--    (9/3/+0.5/4) and Justice (5/1/+0.5/4). `disc_molds.turn` is plain numeric
--    with no CHECK, so these store correctly. Do not "fix" them.
-- 2. RETAILERS WILL DISAGREE with some values. MVP/Axiom/Streamline publish
--    different numbers for the same mold in different plastics — Fireball is
--    9/3.5/0/3.5 in Neutron and 9/4/0/3.5 in Fission. The schema is one row per
--    mold, so base/Neutron numbers were used throughout.
--
-- Category for speed 9-10 discs is a judgement call, not a fact; manufacturers
-- and retailers disagree on Anax, Vulture, Avenger SS, Heat, Tsunami and
-- Hatchet. Treat `category` as a coarse bucket, not an authority.
--
-- SEPARATE FILE, PLEASE READ: `disc_molds_corrections_2026_07.sql` proposes
-- UPDATEs to 9 molds already live whose numbers appear to be wrong. This file
-- cannot fix them — ON CONFLICT DO NOTHING leaves existing rows untouched by
-- design.

insert into public.disc_molds
  (manufacturer, mold_name, speed, glide, turn, fade, category, source_name, source_url)
values
  -- Axiom — 16 molds, 11 with flight numbers, 5 identity-only
  ('Axiom', 'Crave', 6.5, 5, -1, 1, 'fairway', 'Axiom', 'https://axiomdiscs.com/discs/crave/'),
  ('Axiom', 'Defy', 11, 5, -1, 3, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/defy/'),
  ('Axiom', 'Envy', 3, 3, 0, 2, 'putter', 'Axiom', 'https://axiomdiscs.com/discs/envy/'),
  ('Axiom', 'Excite', null, null, null, null, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/excite/'),
  ('Axiom', 'Fireball', 9, 3.5, 0, 3.5, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/fireball/'),
  ('Axiom', 'Hex', 5, 5, -1, 1, 'midrange', 'Axiom', 'https://axiomdiscs.com/discs/hex/'),
  ('Axiom', 'Insanity', 9, 5, -2, 1.5, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/insanity/'),
  ('Axiom', 'Inspire', null, null, null, null, 'fairway', 'Axiom', 'https://axiomdiscs.com/discs/inspire/'),
  ('Axiom', 'Panic', null, null, null, null, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/panic/'),
  ('Axiom', 'Paradox', null, null, null, null, 'midrange', 'Axiom', 'https://axiomdiscs.com/discs/paradox/'),
  ('Axiom', 'Proxy', 3, 3, -1, 0.5, 'putter', 'Axiom', 'https://axiomdiscs.com/discs/proxy/'),
  ('Axiom', 'Pyro', null, null, null, null, 'approach', 'Axiom', 'https://axiomdiscs.com/discs/pyro/'),
  ('Axiom', 'Tenacity', 13, 5, -2, 2, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/tenacity/'),
  ('Axiom', 'Vanish', 11, 5, -3, 2, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/vanish/'),
  ('Axiom', 'Virus', 9, 5, -3.5, 1, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/virus/'),
  ('Axiom', 'Wrath', 9, 4.5, -0.5, 2, 'distance', 'Axiom', 'https://axiomdiscs.com/discs/wrath/'),
  -- Clash Discs — 12 molds, 10 with flight numbers, 2 identity-only
  ('Clash Discs', 'Berry', 5, 5, -1, 1, 'midrange', 'Clash Discs', null),
  ('Clash Discs', 'Butter', 2, 3, 0, 1, 'putter', 'Clash Discs', null),
  ('Clash Discs', 'Cookie', 7, 5, 0, 3, 'fairway', 'Clash Discs', null),
  ('Clash Discs', 'Fudge', null, null, null, null, 'putter', 'Clash Discs', null),
  ('Clash Discs', 'Ginger', 9, 4, 0, 2, 'fairway', 'Clash Discs', null),
  ('Clash Discs', 'Mango', 5, 4, 0, 4, 'midrange', 'Clash Discs', null),
  ('Clash Discs', 'Peach', null, null, null, null, 'midrange', 'Clash Discs', null),
  ('Clash Discs', 'Pepper', 11, 5, 0, 4, 'distance', 'Clash Discs', null),
  ('Clash Discs', 'Popcorn', 3, 3, 0, 1, 'putter', 'Clash Discs', null),
  ('Clash Discs', 'Salt', 12, 5, -1, 3, 'distance', 'Clash Discs', null),
  ('Clash Discs', 'Soda', 7, 5, -2, 1, 'fairway', 'Clash Discs', null),
  ('Clash Discs', 'Wild Honey', 12, 5, -2, 2, 'distance', 'Clash Discs', null),
  -- DGA — 21 molds, 20 with flight numbers, 1 identity-only
  ('DGA', 'Aftershock', 5, 4, 0, 2, 'midrange', 'DGA', null),
  ('DGA', 'Avalanche', 9, 3, 0, 4, 'fairway', 'DGA', null),
  ('DGA', 'Blowfly', 2, 2, -1, 2, 'putter', 'DGA', null),
  ('DGA', 'Blowfly II', 2, 3, -1, 1, 'putter', 'DGA', null),
  ('DGA', 'Blunt', null, null, null, null, 'putter', 'DGA', null),
  ('DGA', 'Breaker', 3, 3, 0, 3, 'approach', 'DGA', null),
  ('DGA', 'Hurricane', 12, 5, -1, 3, 'distance', 'DGA', null),
  ('DGA', 'Hypercane', 13, 4, 0, 4, 'distance', 'DGA', null),
  ('DGA', 'Pipeline', 8, 5, 0, 2, 'fairway', 'DGA', null),
  ('DGA', 'Quake', 5, 3, 0, 3, 'midrange', 'DGA', null),
  ('DGA', 'Reef', 2, 3, -1, 1, 'putter', 'DGA', null),
  ('DGA', 'Riptide', 9, 4, 0, 3, 'fairway', 'DGA', null),
  ('DGA', 'Rogue', 11, 4, -1, 1, 'distance', 'DGA', null),
  ('DGA', 'Sail', 11, 5, -5, 1, 'distance', 'DGA', null),
  ('DGA', 'Squall', 6, 4, -1, 1, 'midrange', 'DGA', null),
  ('DGA', 'Steady BL', 2, 3, 0, 2, 'approach', 'DGA', null),
  ('DGA', 'Tempest', 13, 5, -3, 2, 'distance', 'DGA', null),
  ('DGA', 'Torrent', 14, 5, -1, 2, 'distance', 'DGA', null),
  ('DGA', 'Tremor', 6, 5, -4, 1, 'midrange', 'DGA', 'https://discgolf.com/product-category/disc-golf-discs/midrange-discs/tremor/'),
  ('DGA', 'Tsunami', 10, 4, 0, 3, 'fairway', 'DGA', null),
  ('DGA', 'Undertow', 10, 4, -1, 1, 'fairway', 'DGA', null),
  -- Discmania — 25 molds, 17 with flight numbers, 8 identity-only
  ('Discmania', 'Astronaut', null, null, null, null, 'distance', 'Discmania', 'https://www.discmania.net/collections/astronaut'),
  ('Discmania', 'CD1', 9, 5, -1, 2, 'distance', 'Discmania', 'https://www.discmania.net/collections/cd1'),
  ('Discmania', 'CD2', null, null, null, null, 'distance', 'Discmania', 'https://www.discmania.net/collections/cd2'),
  ('Discmania', 'Cloud Breaker', null, null, null, null, 'distance', 'Discmania', 'https://www.discmania.net/collections/cloud-breaker'),
  ('Discmania', 'DD3', 12, 5, -1, 3, 'distance', 'Discmania', 'https://www.discmania.net/collections/dd3'),
  ('Discmania', 'Enigma', 12, 5, -1, 2, 'distance', 'Discmania', 'https://www.discmania.net/collections/enigma'),
  ('Discmania', 'Essence', 8, 6, -2, 1, 'fairway', 'Discmania', 'https://www.discmania.net/collections/essence'),
  ('Discmania', 'FD', 7, 6, 0, 1, 'fairway', 'Discmania', 'https://www.discmania.net/collections/fd'),
  ('Discmania', 'FD3', 9, 4, 0, 3, 'fairway', 'Discmania', 'https://www.discmania.net/collections/fd3'),
  ('Discmania', 'Instinct', 7, 5, 0, 2, 'fairway', 'Discmania', 'https://www.discmania.net/collections/instinct'),
  ('Discmania', 'Link', null, null, null, null, 'putter', 'Discmania', 'https://www.discmania.net/collections/link'),
  ('Discmania', 'Logic', 3, 3, 0, 1, 'putter', 'Discmania', 'https://www.discmania.net/collections/logic'),
  ('Discmania', 'MD1', 5, 6, 0, 0, 'midrange', 'Discmania', 'https://www.discmania.net/collections/md1'),
  ('Discmania', 'MD3', 5, 5, 0, 1, 'midrange', 'Discmania', 'https://www.discmania.net/collections/md3'),
  ('Discmania', 'MD5', 5, 3, 0, 4, 'midrange', 'Discmania', 'https://www.discmania.net/collections/md5'),
  ('Discmania', 'Method', null, null, null, null, 'midrange', 'Discmania', 'https://www.discmania.net/collections/method'),
  ('Discmania', 'Origin', 5, 5, -1, 1, 'midrange', 'Discmania', 'https://www.discmania.net/collections/origin'),
  ('Discmania', 'P2', 2, 3, 0, 1, 'putter', 'Discmania', 'https://www.discmania.net/collections/p2'),
  ('Discmania', 'PD', 10, 4, 0, 3, 'distance', 'Discmania', 'https://www.discmania.net/collections/pd'),
  ('Discmania', 'PD2', null, null, null, null, 'distance', 'Discmania', 'https://www.discmania.net/collections/pd2'),
  ('Discmania', 'Rainmaker', 2, 3, 0, 0.5, 'putter', 'Discmania', 'https://www.discmania.net/collections/rainmaker'),
  ('Discmania', 'Sensei', 3, 3, 0, 1, 'putter', 'Discmania', 'https://www.discmania.net/collections/sensei'),
  ('Discmania', 'Splice', null, null, null, null, 'fairway', 'Discmania', 'https://www.discmania.net/collections/splice'),
  ('Discmania', 'Tactic', 4, 2, 0, 3, 'approach', 'Discmania', 'https://www.discmania.net/collections/tactic'),
  ('Discmania', 'TD', null, null, null, null, 'distance', 'Discmania', 'https://www.discmania.net/collections/td'),
  -- Discraft — 33 molds, 33 with flight numbers, 0 identity-only
  ('Discraft', 'Anax', 10, 6, 0, 3, 'fairway', 'Discraft', 'https://www.team.discraft.com/discs/anax'),
  ('Discraft', 'Athena', 10, 5, -2, 2, 'distance', 'Discraft', null),
  ('Discraft', 'Avenger SS', 10, 5, -3, 1, 'distance', 'Discraft', null),
  ('Discraft', 'Banger-GT', 2, 3, 0, 1, 'putter', 'Discraft', null),
  ('Discraft', 'Buzzz', 5, 4, -1, 1, 'midrange', 'Discraft', null),
  ('Discraft', 'Buzzz OS', 5, 4, 0, 3, 'midrange', 'Discraft', null),
  ('Discraft', 'Buzzz SS', 5, 4, -2, 1, 'midrange', 'Discraft', null),
  ('Discraft', 'Challenger', 3, 3, 0, 2, 'putter', 'Discraft', null),
  ('Discraft', 'Comet', 4, 5, -2, 1, 'midrange', 'Discraft', null),
  ('Discraft', 'Crank', 13, 5, -2, 2, 'distance', 'Discraft', null),
  ('Discraft', 'Drone', 5, 4, 0, 2, 'midrange', 'Discraft', null),
  ('Discraft', 'Force', 12, 5, 0, 3, 'distance', 'Discraft', 'https://www.team.discraft.com/discs/force'),
  ('Discraft', 'Hades', 12, 6, -3, 2, 'distance', 'Discraft', 'https://www.discraft.com/paul-mcbeth-hades-mcbethhades'),
  ('Discraft', 'Heat', 9, 6, -3, 1, 'distance', 'Discraft', null),
  ('Discraft', 'Kratos', 3, 3, 0, 3, 'approach', 'Discraft', null),
  ('Discraft', 'Luna', 3, 4, 0, 2, 'putter', 'Discraft', 'https://www.team.discraft.com/discs/luna'),
  ('Discraft', 'Machete', 12, 4, 0, 3, 'distance', 'Discraft', null),
  ('Discraft', 'Magnet', 3, 3, 0, 1, 'putter', 'Discraft', null),
  ('Discraft', 'Malta', 5, 4, 1, 3, 'midrange', 'Discraft', 'https://www.team.discraft.com/discs/malta'),
  ('Discraft', 'Meteor', 5, 5, -3, 1, 'midrange', 'Discraft', null),
  ('Discraft', 'Nuke', 13, 5, -1, 3, 'distance', 'Discraft', null),
  ('Discraft', 'Nuke SS', 13, 5, -3, 2, 'distance', 'Discraft', null),
  ('Discraft', 'Raptor', 9, 4, 0, 3, 'fairway', 'Discraft', null),
  ('Discraft', 'Roach', 2, 4, 0, 1, 'putter', 'Discraft', null),
  ('Discraft', 'Scorch', 11, 5, -1, 2, 'distance', 'Discraft', null),
  ('Discraft', 'Stalker', 7, 5, -1, 2, 'fairway', 'Discraft', null),
  ('Discraft', 'Sting', 7, 6, -2, 1, 'fairway', 'Discraft', null),
  ('Discraft', 'Thrasher', 12, 5, -3, 2, 'distance', 'Discraft', null),
  ('Discraft', 'Undertaker', 9, 5, -1, 2, 'fairway', 'Discraft', null),
  ('Discraft', 'Vulture', 10, 5, 0, 2, 'distance', 'Discraft', null),
  ('Discraft', 'Zeus', 12, 5, -1, 3, 'distance', 'Discraft', null),
  ('Discraft', 'Zone', 4, 3, 0, 3, 'approach', 'Discraft', 'https://www.team.discraft.com/discs/zone'),
  ('Discraft', 'Zone OS', 4, 2, 1, 5, 'approach', 'Discraft', null),
  -- Dynamic Discs — 26 molds, 25 with flight numbers, 1 identity-only
  ('Dynamic Discs', 'Breakout', 8, 5, -1, 1.5, 'fairway', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Convict', 12, 4, -0.5, 3.5, 'distance', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Culprit', 4, 2, 0, 3.5, 'approach', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Defender', 11, 4, 0, 3.5, 'distance', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Deputy', 3, 4, -1.5, 0, 'putter', 'Dynamic Discs', null),
  ('Dynamic Discs', 'EMAC Judge', 2, 4, -0.5, 1, 'putter', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-emac-judge'),
  ('Dynamic Discs', 'EMAC Truth', 5, 5, 0, 2, 'midrange', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Enforcer', 12, 4, 0.5, 4, 'distance', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-enforcer'),
  ('Dynamic Discs', 'Escape', 9, 5, -1, 2, 'fairway', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-escape'),
  ('Dynamic Discs', 'Evidence', 5, 5, -1, 0.5, 'midrange', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Felon', 9, 3, 0.5, 4, 'fairway', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Freedom', 13, 6, -2, 2, 'distance', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Getaway', 9, 5, -0.5, 3, 'fairway', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-getaway'),
  ('Dynamic Discs', 'Judge', 2, 4, 0, 1, 'putter', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-judge'),
  ('Dynamic Discs', 'Justice', 5, 1, 0.5, 4, 'approach', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-justice'),
  ('Dynamic Discs', 'Marshal', null, null, null, null, 'putter', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Maverick', 7, 4, -1.5, 2, 'fairway', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-maverick'),
  ('Dynamic Discs', 'Sergeant', 4, 5, -2, 1, 'midrange', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Sheriff', 13, 5, -1, 2, 'distance', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Suspect', 4, 3, 0, 3, 'midrange', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-suspect'),
  ('Dynamic Discs', 'Trespass', 12, 5, -0.5, 3, 'distance', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-trespass'),
  ('Dynamic Discs', 'Truth', 5, 5, -1, 1, 'midrange', 'Dynamic Discs', null),
  ('Dynamic Discs', 'Vandal', 9, 5, -1.5, 2, 'fairway', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-vandal'),
  ('Dynamic Discs', 'Verdict', 5, 4, 0, 3.5, 'approach', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-verdict'),
  ('Dynamic Discs', 'Warden', 2, 4, 0, 0.5, 'putter', 'Dynamic Discs', 'https://www.dynamicdiscs.com/collections/dynamic-discs-warden'),
  ('Dynamic Discs', 'Witness', 9, 6, -2, 1, 'fairway', 'Dynamic Discs', null),
  -- Gateway — 13 molds, 0 with flight numbers, 13 identity-only
  ('Gateway', 'Assassin', null, null, null, null, 'distance', 'Gateway', null),
  ('Gateway', 'Blaze', null, null, null, null, 'fairway', 'Gateway', null),
  ('Gateway', 'Chief', null, null, null, null, 'putter', 'Gateway', 'https://gatewaydiscsports.com/collections/chiefs'),
  ('Gateway', 'Devil Hawk', null, null, null, null, 'approach', 'Gateway', 'https://gatewaydiscsports.com/collections/devil-hawk'),
  ('Gateway', 'Element', null, null, null, null, 'midrange', 'Gateway', null),
  ('Gateway', 'Illusion', null, null, null, null, 'distance', 'Gateway', null),
  ('Gateway', 'Magic', null, null, null, null, 'putter', 'Gateway', null),
  ('Gateway', 'Mystic', null, null, null, null, 'midrange', 'Gateway', null),
  ('Gateway', 'Sabre', null, null, null, null, 'fairway', 'Gateway', 'https://gatewaydiscsports.com/collections/sabre'),
  ('Gateway', 'Shaman', null, null, null, null, 'putter', 'Gateway', 'https://gatewaydiscsports.com/collections/shamans'),
  ('Gateway', 'Voodoo', null, null, null, null, 'putter', 'Gateway', null),
  ('Gateway', 'Warlock', null, null, null, null, 'putter', 'Gateway', 'https://gatewaydiscsports.com/collections/warlock'),
  ('Gateway', 'Wizard', null, null, null, null, 'putter', 'Gateway', 'https://gatewaydiscsports.com/collections/wizard'),
  -- Innova — 36 molds, 36 with flight numbers, 0 identity-only
  ('Innova', 'Archon', 11, 5, -2, 2, 'distance', 'Innova', null),
  ('Innova', 'Aviar', 2, 3, 0, 1, 'putter', 'Innova', null),
  ('Innova', 'Aviar3', 3, 3, 0, 2, 'putter', 'Innova', null),
  ('Innova', 'Banshee', 8, 4, 0, 3, 'fairway', 'Innova', null),
  ('Innova', 'Beast', 10, 5, -2, 2, 'distance', 'Innova', null),
  ('Innova', 'Boss', 13, 5, -1, 3, 'distance', 'Innova', null),
  ('Innova', 'Colossus', 14, 5, -3, 3, 'distance', 'Innova', null),
  ('Innova', 'Corvette', 14, 6, -3, 3, 'distance', 'Innova', null),
  ('Innova', 'Dart', 3, 3, 0, 1, 'putter', 'Innova', null),
  ('Innova', 'Destroyer', 12, 5, -1, 3, 'distance', 'Innova', null),
  ('Innova', 'Eagle', 7, 4, -1, 3, 'fairway', 'Innova', null),
  ('Innova', 'Firebird', 9, 3, 0, 4, 'fairway', 'Innova', null),
  ('Innova', 'Gator', 5, 2, 0, 3, 'midrange', 'Innova', null),
  ('Innova', 'Katana', 13, 5, -3, 3, 'distance', 'Innova', null),
  ('Innova', 'Leopard', 6, 5, -2, 1, 'fairway', 'Innova', null),
  ('Innova', 'Leopard3', 6, 5, -2, 1, 'fairway', 'Innova', null),
  ('Innova', 'Mako3', 5, 5, 0, 0, 'midrange', 'Innova', null),
  ('Innova', 'Mamba', 11, 6, -5, 1, 'distance', 'Innova', null),
  ('Innova', 'Nova', 2, 3, 0, 1, 'putter', 'Innova', null),
  ('Innova', 'Pig', 3, 1, 0, 4, 'approach', 'Innova', null),
  ('Innova', 'Polecat', 1, 3, 0, 0, 'putter', 'Innova', null),
  ('Innova', 'Rhyno', 2, 1, 0, 3, 'approach', 'Innova', null),
  ('Innova', 'Roadrunner', 9, 5, -4, 1, 'distance', 'Innova', null),
  ('Innova', 'Roc', 4, 4, 0, 3, 'midrange', 'Innova', null),
  ('Innova', 'Roc3', 5, 4, 0, 3, 'midrange', 'Innova', null),
  ('Innova', 'Shark', 4, 4, 0, 2, 'midrange', 'Innova', null),
  ('Innova', 'Shryke', 13, 6, -2, 2, 'distance', 'Innova', null),
  ('Innova', 'Sidewinder', 9, 5, -3, 1, 'distance', 'Innova', null),
  ('Innova', 'Teebird', 7, 5, 0, 2, 'fairway', 'Innova', null),
  ('Innova', 'Teebird3', 8, 4, 0, 2, 'fairway', 'Innova', null),
  ('Innova', 'Tern', 12, 6, -2, 2, 'distance', 'Innova', null),
  ('Innova', 'Thunderbird', 9, 5, 0, 2, 'fairway', 'Innova', null),
  ('Innova', 'Valkyrie', 9, 4, -2, 2, 'distance', 'Innova', null),
  ('Innova', 'Vulcan', 13, 5, -4, 2, 'distance', 'Innova', null),
  ('Innova', 'Wombat3', 5, 6, -2, 0, 'midrange', 'Innova', null),
  ('Innova', 'Wraith', 11, 5, -1, 3, 'distance', 'Innova', null),
  -- Kastaplast — 17 molds, 5 with flight numbers, 12 identity-only
  ('Kastaplast', 'Berg', 1, 1, 0, 2, 'putter', 'Kastaplast', null),
  ('Kastaplast', 'Berg X', null, null, null, null, 'putter', 'Kastaplast', null),
  ('Kastaplast', 'Falk', null, null, null, null, 'fairway', 'Kastaplast', null),
  ('Kastaplast', 'Grym', null, null, null, null, 'distance', 'Kastaplast', null),
  ('Kastaplast', 'Grym X', 13, 5, -1, 3, 'distance', 'Kastaplast', null),
  ('Kastaplast', 'Guld', null, null, null, null, 'distance', 'Kastaplast', null),
  ('Kastaplast', 'Göte', null, null, null, null, 'midrange', 'Kastaplast', null),
  ('Kastaplast', 'Järn', null, null, null, null, 'approach', 'Kastaplast', null),
  ('Kastaplast', 'Kaxe', 6, 4, 0, 3, 'midrange', 'Kastaplast', null),
  ('Kastaplast', 'Kaxe Z', null, null, null, null, 'midrange', 'Kastaplast', null),
  ('Kastaplast', 'Krut', null, null, null, null, 'distance', 'Kastaplast', null),
  ('Kastaplast', 'Lots', null, null, null, null, 'fairway', 'Kastaplast', null),
  ('Kastaplast', 'Rask', null, null, null, null, 'distance', 'Kastaplast', null),
  ('Kastaplast', 'Reko', 3, 3, 0, 1, 'putter', 'Kastaplast', null),
  ('Kastaplast', 'Reko X', null, null, null, null, 'putter', 'Kastaplast', null),
  ('Kastaplast', 'Stål', null, null, null, null, 'fairway', 'Kastaplast', null),
  ('Kastaplast', 'Svea', 5, 6, -1, 0, 'midrange', 'Kastaplast', null),
  -- Latitude 64 — 23 molds, 23 with flight numbers, 0 identity-only
  ('Latitude 64', 'Ballista', 14, 5, -1, 3, 'distance', 'Latitude 64', 'https://latitude64.com/collections/ballista'),
  ('Latitude 64', 'Ballista Pro', 14, 4, 0, 3, 'distance', 'Latitude 64', null),
  ('Latitude 64', 'Bolt', 13, 6, -2, 3, 'distance', 'Latitude 64', null),
  ('Latitude 64', 'Claymore', 5, 5, -1, 1, 'midrange', 'Latitude 64', 'https://latitude64.com/collections/claymore'),
  ('Latitude 64', 'Compass', 5, 5, 0, 1, 'midrange', 'Latitude 64', 'https://latitude64.com/products/opto-compass'),
  ('Latitude 64', 'Culverin', 9, 5, -0.5, 3, 'fairway', 'Latitude 64', null),
  ('Latitude 64', 'Dagger', 2, 5, 0, 1, 'putter', 'Latitude 64', null),
  ('Latitude 64', 'Diamond', 8, 6, -3, 1, 'fairway', 'Latitude 64', 'https://latitude64.com/collections/diamond'),
  ('Latitude 64', 'Explorer', 7, 5, 0, 2, 'fairway', 'Latitude 64', 'https://latitude64.com/collections/explorer'),
  ('Latitude 64', 'Fuse', 5, 6, -1, 0, 'midrange', 'Latitude 64', 'https://latitude64.com/collections/fuse'),
  ('Latitude 64', 'Grace', 11, 6, -1, 2, 'distance', 'Latitude 64', null),
  ('Latitude 64', 'Havoc', 13, 5, -1, 3, 'distance', 'Latitude 64', null),
  ('Latitude 64', 'Keystone', 2, 5, -1, 1, 'putter', 'Latitude 64', null),
  ('Latitude 64', 'Mercy', 2, 4, 0, 1, 'putter', 'Latitude 64', 'https://latitude64.com/collections/mercy'),
  ('Latitude 64', 'Missilen', 15, 3, -0.5, 4.5, 'distance', 'Latitude 64', null),
  ('Latitude 64', 'Musket', 10, 5, -0.5, 2, 'fairway', 'Latitude 64', 'https://latitude64.com/products/opto-musket'),
  ('Latitude 64', 'Pure', 3, 3, -1, 1, 'putter', 'Latitude 64', 'https://latitude64.com/collections/pure'),
  ('Latitude 64', 'River', 7, 7, -1, 1, 'fairway', 'Latitude 64', null),
  ('Latitude 64', 'Saint', 9, 7, -1, 2, 'fairway', 'Latitude 64', 'https://latitude64.com/collections/saint'),
  ('Latitude 64', 'Saint Pro', 9, 5, -1, 2, 'fairway', 'Latitude 64', null),
  ('Latitude 64', 'Sapphire', 10, 6, -2, 1.5, 'distance', 'Latitude 64', null),
  ('Latitude 64', 'Trident', 6, 4, -0.5, 3, 'midrange', 'Latitude 64', null),
  ('Latitude 64', 'XXX', 7, 3, 0, 4, 'fairway', 'Latitude 64', null),
  -- Mint Discs — 11 molds, 5 with flight numbers, 6 identity-only
  ('Mint Discs', 'Alpha', null, null, null, null, 'fairway', 'Mint Discs', null),
  ('Mint Discs', 'Bobcat', 5, 4, 0, 2.5, 'midrange', 'Mint Discs', null),
  ('Mint Discs', 'Bullet', null, null, null, null, 'putter', 'Mint Discs', null),
  ('Mint Discs', 'Diamondback', 9, 5, -2, 2, 'fairway', 'Mint Discs', null),
  ('Mint Discs', 'Freetail', 10, 5, -4, 1, 'distance', 'Mint Discs', null),
  ('Mint Discs', 'Grackle', null, null, null, null, 'fairway', 'Mint Discs', null),
  ('Mint Discs', 'Jackalope', 8, 5, -2, 1, 'fairway', 'Mint Discs', null),
  ('Mint Discs', 'Longhorn', null, null, null, null, 'distance', 'Mint Discs', null),
  ('Mint Discs', 'Mustang', null, null, null, null, 'midrange', 'Mint Discs', null),
  ('Mint Discs', 'Phoenix', null, null, null, null, 'distance', 'Mint Discs', null),
  ('Mint Discs', 'Profit', 2, 3, 0, 2, 'putter', 'Mint Discs', null),
  -- MVP — 30 molds, 18 with flight numbers, 12 identity-only
  ('MVP', 'Anode', null, null, null, null, 'putter', 'MVP', 'https://mvpdiscsports.com/discs/anode/'),
  ('MVP', 'Atom', null, null, null, null, 'putter', 'MVP', 'https://mvpdiscsports.com/discs/atom/'),
  ('MVP', 'Catalyst', 13, 5.5, -2, 2, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/catalyst/'),
  ('MVP', 'Deflector', 5, 3.5, 0, 4, 'midrange', 'MVP', 'https://mvpdiscsports.com/discs/deflector/'),
  ('MVP', 'Entropy', 4, 3, 0, 3, 'approach', 'MVP', 'https://mvpdiscsports.com/discs/entropy/'),
  ('MVP', 'Glitch', 1, 7, 0, 0, 'putter', 'MVP', 'https://mvpdiscsports.com/discs/glitch/'),
  ('MVP', 'Impulse', 9, 5, -3, 1, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/impulse/'),
  ('MVP', 'Inertia', 9, 5, -2, 2, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/inertia/'),
  ('MVP', 'Ion', 2.5, 3, 0, 1.5, 'putter', 'MVP', 'https://mvpdiscsports.com/discs/ion/'),
  ('MVP', 'Matrix', null, null, null, null, 'midrange', 'MVP', 'https://mvpdiscsports.com/discs/matrix/'),
  ('MVP', 'Motion', null, null, null, null, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/motion/'),
  ('MVP', 'Nitro', null, null, null, null, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/nitro/'),
  ('MVP', 'Nomad', 2, 4, 0, 1, 'putter', 'MVP', 'https://mvpdiscsports.com/discs/nomad/'),
  ('MVP', 'Octane', null, null, null, null, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/octane/'),
  ('MVP', 'Orbital', null, null, null, null, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/orbital/'),
  ('MVP', 'Photon', 11, 5, -1, 2.5, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/photon/'),
  ('MVP', 'Reactor', 5, 5, -0.5, 1.5, 'midrange', 'MVP', 'https://mvpdiscsports.com/discs/reactor/'),
  ('MVP', 'Relay', 6, 5, -2, 1, 'fairway', 'MVP', 'https://mvpdiscsports.com/discs/relay/'),
  ('MVP', 'Resistor', 6.5, 4, 0, 3.5, 'fairway', 'MVP', 'https://mvpdiscsports.com/discs/resistor/'),
  ('MVP', 'Servo', 6.5, 5, -1, 2, 'fairway', 'MVP', 'https://mvpdiscsports.com/discs/servo/'),
  ('MVP', 'Signal', null, null, null, null, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/signal/'),
  ('MVP', 'Spin', null, null, null, null, 'putter', 'MVP', 'https://mvpdiscsports.com/discs/spin/'),
  ('MVP', 'Switch', 6.5, 5, -1.5, 1, 'fairway', 'MVP', 'https://mvpdiscsports.com/discs/switch/'),
  ('MVP', 'Tangent', null, null, null, null, 'midrange', 'MVP', 'https://mvpdiscsports.com/discs/tangent/'),
  ('MVP', 'Terra', null, null, null, null, 'fairway', 'MVP', 'https://mvpdiscsports.com/discs/terra/'),
  ('MVP', 'Tesla', 9, 5, -1, 2, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/tesla/'),
  ('MVP', 'Uplink', 5, 5, -3, 0.5, 'midrange', 'MVP', 'https://mvpdiscsports.com/discs/uplink/'),
  ('MVP', 'Vector', null, null, null, null, 'midrange', 'MVP', 'https://mvpdiscsports.com/discs/vector/'),
  ('MVP', 'Volt', 8, 5, -0.5, 2, 'fairway', 'MVP', 'https://mvpdiscsports.com/discs/volt/'),
  ('MVP', 'Wave', 11, 5, -2, 2, 'distance', 'MVP', 'https://mvpdiscsports.com/discs/wave/'),
  -- Prodigy — 20 molds, 9 with flight numbers, 11 identity-only
  ('Prodigy', 'A1', null, null, null, null, 'approach', 'Prodigy', null),
  ('Prodigy', 'A2', null, null, null, null, 'approach', 'Prodigy', null),
  ('Prodigy', 'A3', null, null, null, null, 'approach', 'Prodigy', null),
  ('Prodigy', 'A5', 4, 3, 0, 2, 'approach', 'Prodigy', 'https://prodigydisc.com/blogs/news/finding-the-best-disc-golf-approach-disc-a-series-by-prodigy-disc'),
  ('Prodigy', 'D1', 12, 5, 0, 4, 'distance', 'Prodigy', 'https://prodigydisc.com/collections/d1-distance-driver'),
  ('Prodigy', 'D2', 12, 5, -1, 3, 'distance', 'Prodigy', null),
  ('Prodigy', 'D3', null, null, null, null, 'distance', 'Prodigy', null),
  ('Prodigy', 'D4', 12, 5, -2, 2, 'distance', 'Prodigy', 'https://prodigydisc.com/collections/d4-distance-driver'),
  ('Prodigy', 'F1', null, null, null, null, 'fairway', 'Prodigy', null),
  ('Prodigy', 'F2', null, null, null, null, 'fairway', 'Prodigy', null),
  ('Prodigy', 'F3', null, null, null, null, 'fairway', 'Prodigy', null),
  ('Prodigy', 'F5', 8, 6, -2, 1, 'fairway', 'Prodigy', 'https://prodigydisc.com/products/prodigy-f5-400-plastic'),
  ('Prodigy', 'F7', 7, 5, -3, 1, 'fairway', 'Prodigy', null),
  ('Prodigy', 'M1', null, null, null, null, 'midrange', 'Prodigy', null),
  ('Prodigy', 'M2', null, null, null, null, 'midrange', 'Prodigy', null),
  ('Prodigy', 'M3', 5, 5, -1, 2, 'midrange', 'Prodigy', null),
  ('Prodigy', 'M4', 5, 5, -1, 1, 'midrange', 'Prodigy', null),
  ('Prodigy', 'PA1', null, null, null, null, 'putter', 'Prodigy', null),
  ('Prodigy', 'PA3', 3, 4, 0, 1, 'putter', 'Prodigy', null),
  ('Prodigy', 'PA5', null, null, null, null, 'putter', 'Prodigy', null),
  -- Streamline — 11 molds, 6 with flight numbers, 5 identity-only
  ('Streamline', 'Ascend', 6, 5, -3, 0.5, 'fairway', 'Streamline', 'https://streamlinediscs.com/discs/ascend/'),
  ('Streamline', 'Drift', 7, 5, -2, 1, 'fairway', 'Streamline', 'https://streamlinediscs.com/discs/drift/'),
  ('Streamline', 'Flare', null, null, null, null, 'distance', 'Streamline', 'https://streamlinediscs.com/discs/flare/'),
  ('Streamline', 'Jet', 11, 5, -3, 2, 'distance', 'Streamline', 'https://streamlinediscs.com/discs/jet/'),
  ('Streamline', 'Lift', null, null, null, null, 'distance', 'Streamline', 'https://streamlinediscs.com/discs/lift/'),
  ('Streamline', 'Pilot', 2, 5, 0, 1, 'putter', 'Streamline', 'https://streamlinediscs.com/discs/pilot/'),
  ('Streamline', 'Range', null, null, null, null, 'approach', 'Streamline', 'https://streamlinediscs.com/discs/range/'),
  ('Streamline', 'Runway', null, null, null, null, 'approach', 'Streamline', 'https://streamlinediscs.com/discs/runway/'),
  ('Streamline', 'Stabilizer', null, null, null, null, 'approach', 'Streamline', 'https://streamlinediscs.com/discs/stabilizer/'),
  ('Streamline', 'Trace', 11, 5, -1, 2, 'distance', 'Streamline', 'https://streamlinediscs.com/discs/trace/'),
  ('Streamline', 'Turbulence', 7, 2, 0, 3.5, 'fairway', 'Streamline', 'https://streamlinediscs.com/discs/turbulence/'),
  -- Thought Space Athletics — 10 molds, 8 with flight numbers, 2 identity-only
  ('Thought Space Athletics', 'Animus', 11, 5, 0, 2, 'distance', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Coalesce', null, null, null, null, 'fairway', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Construct', 10, 6, -1, 2, 'distance', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Mantra', 9, 5, -2, 2, 'fairway', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Muse', null, null, null, null, 'putter', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Omen', 9, 4, 0, 4, 'distance', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Pathfinder', 5, 5, 0, 1, 'midrange', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Praxis', 3, 3, 0, 1, 'putter', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Synapse', 12, 5, 0, 3, 'distance', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  ('Thought Space Athletics', 'Votum', 7, 5, 0, 3, 'fairway', 'Thought Space Athletics', 'https://thoughtspaceathletics.com/pages/molds'),
  -- Westside Discs — 22 molds, 21 with flight numbers, 1 identity-only
  ('Westside Discs', 'Adder', 13, 5, 0, 4, 'distance', 'Westside Discs', null),
  ('Westside Discs', 'Ahti', 9, 3, 0, 4, 'fairway', 'Westside Discs', 'https://westsidediscs.com/collections/ahti'),
  ('Westside Discs', 'Anvil', 4, 2, 0, 4, 'approach', 'Westside Discs', null),
  ('Westside Discs', 'Bard', 5, 4, 0, 3, 'midrange', 'Westside Discs', null),
  ('Westside Discs', 'Boatman', 11, 5, 0, 2, 'distance', 'Westside Discs', null),
  ('Westside Discs', 'Catapult', 14, 4, -0.5, 3, 'distance', 'Westside Discs', null),
  ('Westside Discs', 'Crown', null, null, null, null, 'putter', 'Westside Discs', 'https://westsidediscs.com/collections/crown'),
  ('Westside Discs', 'Destiny', 14, 6, -2, 3, 'distance', 'Westside Discs', null),
  ('Westside Discs', 'Fortress', 10, 4, 0, 3, 'fairway', 'Westside Discs', null),
  ('Westside Discs', 'Gatekeeper', 4, 5, 0, 2, 'midrange', 'Westside Discs', 'https://westsidediscs.com/collections/gatekeeper'),
  ('Westside Discs', 'Harp', 4, 3, 0, 3, 'approach', 'Westside Discs', 'https://westsidediscs.com/collections/harp'),
  ('Westside Discs', 'Hatchet', 9, 6, -2, 1, 'fairway', 'Westside Discs', 'https://westsidediscs.com/collections/hatchet'),
  ('Westside Discs', 'King', 14, 5, -1.5, 3, 'distance', 'Westside Discs', 'https://westsidediscs.com/collections/king'),
  ('Westside Discs', 'Longbowman', 9, 4, 0, 3, 'fairway', 'Westside Discs', 'https://westsidediscs.com/collections/longbowman'),
  ('Westside Discs', 'Maiden', 3, 4, 0, 1, 'putter', 'Westside Discs', null),
  ('Westside Discs', 'Northman', 10, 5, -1, 2, 'fairway', 'Westside Discs', 'https://westsidediscs.com/collections/northman'),
  ('Westside Discs', 'Shield', 3, 3, 0, 1, 'putter', 'Westside Discs', null),
  ('Westside Discs', 'Stag', 8, 6, -1, 2, 'fairway', 'Westside Discs', null),
  ('Westside Discs', 'Sword', 12, 5, -0.5, 2, 'distance', 'Westside Discs', 'https://westsidediscs.com/collections/sword'),
  ('Westside Discs', 'Tursas', 5, 5, -2, 1, 'midrange', 'Westside Discs', null),
  ('Westside Discs', 'Underworld', 7, 6, -3, 1, 'fairway', 'Westside Discs', 'https://westsidediscs.com/collections/underworld'),
  ('Westside Discs', 'Warship', 5, 6, 0, 1, 'midrange', 'Westside Discs', 'https://westsidediscs.com/collections/warship')on conflict (lower(manufacturer), lower(mold_name)) do nothing;
