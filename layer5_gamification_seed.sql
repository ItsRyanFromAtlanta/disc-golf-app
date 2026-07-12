-- Layer 5 — Trophy Room badge definitions seed (Screen 12).
-- Append-only per project convention: new file.
--
-- GENERATED — do not hand-edit. Run `node scripts/generate-badge-seed.mjs`
-- after any change to src/lib/gamification/badgeCatalog.js and re-apply this
-- file's contents as a migration. This mechanical generation is what closes
-- the drift a code review found: the SQL used to be a hand-transcribed copy
-- of the JS catalog with nothing keeping them in sync.
--
-- IDEAL FORMAT: seeds the `badges` REFERENCE table (created in
-- layer1_foundation_schema.sql: code unique, name, description, tier, criteria
-- jsonb). criteria.metric keys into the pure metric registry in
-- src/lib/gamification/metrics.js.
--
-- Icons are intentionally NOT stored here — they are presentation, not
-- criteria; the UI maps code -> emoji via BADGE_ICONS in badgeCatalog.js.
--
-- TEST DATA NOTE: per-user badge_progress / xp_events for the exercised test
-- account are deliberately NOT hand-written here — they're produced by running
-- the real evaluator (evaluateAndPersistBadges) against that account's actual
-- history, so the seeded progress is exactly what production would compute.
--
-- IDEMPOTENT: ON CONFLICT (code) DO UPDATE, so re-running re-syncs definitions
-- to the catalog without duplicating rows or disturbing existing badge_progress
-- FKs.

insert into badges (code, name, description, tier, criteria) values
  ('first_makes', 'First Steps', 'Sink your first 10 putts.', 'bronze', '{"metric":"total_makes","threshold":10}'),
  ('makes_500', 'Getting Warm', 'Make 500 putts all-time.', 'silver', '{"metric":"total_makes","threshold":500}'),
  ('makes_5k', 'Chain Music', 'Make 5,000 putts all-time.', 'gold', '{"metric":"total_makes","threshold":5000}'),
  ('streak_3d', 'Habit Formed', 'Practice 3 days in a row.', 'bronze', '{"metric":"practice_day_streak","threshold":3}'),
  ('streak_7d', 'Locked In', 'Practice 7 days in a row.', 'silver', '{"metric":"practice_day_streak","threshold":7}'),
  ('streak_30d', 'Relentless', 'Practice 30 days in a row.', 'gold', '{"metric":"practice_day_streak","threshold":30}'),
  ('sessions_50', 'Field General', 'Log 50 practice sessions.', 'silver', '{"metric":"total_sessions","threshold":50}'),
  ('c1_100', 'C1 Automatic', 'Make 100 putts inside Circle 1 (≤33 ft).', 'bronze', '{"metric":"makes_in_zone","threshold":100,"params":{"zone":"C1"}}'),
  ('c2_100', 'Circle''s Edge', 'Make 100 putts in Circle 2 (34–66 ft).', 'silver', '{"metric":"makes_in_zone","threshold":100,"params":{"zone":"C2"}}'),
  ('sniper', 'Sniper Rifle', 'Make a putt from 66 ft or beyond.', 'gold', '{"metric":"longest_made_distance","threshold":66}'),
  ('bomber_40', 'Long Bomber', 'Make 25 putts from 40 ft or beyond.', 'silver', '{"metric":"makes_beyond_ft","threshold":25,"params":{"min_ft":40}}'),
  ('streak_10', 'On Fire', 'Hit a 10-putt streak in a set.', 'bronze', '{"metric":"longest_putt_streak","threshold":10}'),
  ('streak_25', 'Untouchable', 'Hit a 25-putt streak in a set.', 'silver', '{"metric":"longest_putt_streak","threshold":25}'),
  ('clean_10', 'Clean Sweep', 'Finish 10 clean stages (no misses).', 'bronze', '{"metric":"clean_stages","threshold":10}'),
  ('flawless', 'Flawless', 'Complete a regimen with zero misses.', 'gold', '{"metric":"no_miss_regimen_runs","threshold":1}'),
  ('pressure_10', 'Ice Water', 'Make 10 pressure putts.', 'bronze', '{"metric":"pressure_putts_made","threshold":10}'),
  ('pressure_50', 'Clutch Gene', 'Make 50 pressure putts.', 'gold', '{"metric":"pressure_putts_made","threshold":50}'),
  ('gale_force', 'Gale Force', 'Make 50 putts in winds of 15 mph or more.', 'gold', '{"metric":"high_wind_makes","threshold":50,"params":{"min_wind_mph":15}}'),
  ('rain_10', 'Rain or Shine', 'Log 10 sessions in the rain.', 'silver', '{"metric":"rain_sessions","threshold":10}'),
  ('any_wind_100', 'Storm Chaser', 'Make 100 putts in any wind.', 'silver', '{"metric":"wind_makes","threshold":100,"params":{"min_wind_mph":0}}'),
  ('regimens_5', 'Graduate', 'Complete 5 regimen runs.', 'bronze', '{"metric":"regimen_runs_completed","threshold":5}'),
  ('perfect_10', 'Perfectionist', 'Complete 10 flawless regimen runs.', 'gold', '{"metric":"no_miss_regimen_runs","threshold":10}'),
  ('pb_5', 'Record Breaker', 'Set 5 regimen personal bests.', 'silver', '{"metric":"regimen_pbs_set","threshold":5}'),
  ('collector_10', 'Collector', 'Own 10 discs.', 'bronze', '{"metric":"discs_owned","threshold":10}'),
  ('iron_arm', 'Iron Arm', 'Rack up 1,000 chain hits on a single putter.', 'silver', '{"metric":"putter_chain_hits_max","threshold":1000}')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  criteria = excluded.criteria;
