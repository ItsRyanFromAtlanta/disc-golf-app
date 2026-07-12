// Generates layer5_gamification_seed.sql from src/lib/gamification/badgeCatalog.js
// — the badge catalog's single source of truth. Code review on Screen 12 found
// the SQL seed was hand-transcribed from the JS catalog with nothing checking
// the two stayed in sync (gamification.test.js only asserts against the
// in-memory array, never the SQL); a badgeCatalog.js edit could silently leave
// the live `badges` table (what the evaluator actually reads) on stale
// criteria. This script makes the SQL a mechanical projection instead.
//
// Usage:  node scripts/generate-badge-seed.mjs
// Then re-run the generated file's contents as a migration against Supabase to
// sync the DB (still a manual step — this eliminates transcription drift, not
// the need to re-apply).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BADGE_CATALOG } from '../src/lib/gamification/badgeCatalog.js'

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlCriteria(criteria) {
  return sqlString(JSON.stringify(criteria))
}

const rows = BADGE_CATALOG.map(
  (b) =>
    `  (${sqlString(b.code)}, ${sqlString(b.name)}, ${sqlString(b.description)}, ${sqlString(b.tier)}, ${sqlCriteria(b.criteria)})`,
).join(',\n')

const sql = `-- Layer 5 — Trophy Room badge definitions seed (Screen 12).
-- Append-only per project convention: new file.
--
-- GENERATED — do not hand-edit. Run \`node scripts/generate-badge-seed.mjs\`
-- after any change to src/lib/gamification/badgeCatalog.js and re-apply this
-- file's contents as a migration. This mechanical generation is what closes
-- the drift a code review found: the SQL used to be a hand-transcribed copy
-- of the JS catalog with nothing keeping them in sync.
--
-- IDEAL FORMAT: seeds the \`badges\` REFERENCE table (created in
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
${rows}
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  tier = excluded.tier,
  criteria = excluded.criteria;
`

const outPath = fileURLToPath(new URL('../layer5_gamification_seed.sql', import.meta.url))
writeFileSync(outPath, sql)
console.log(`Wrote ${BADGE_CATALOG.length} badge definitions to ${outPath}`)
