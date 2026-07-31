import { db } from '../db/dexieDb'
import { createOutboxQueue } from './outboxQueue'
import { ROUND_HOLE_TABLE, ROUND_PLAYER_TABLE, ROUND_TABLE } from './roundOutboxKeys'
import { roundIdForOutboxEntry } from './roundRepository'

// The three columns `roundWeatherFields()` (`src/lib/roundWeather.js`) ever
// writes. It sends all three in one PATCH regardless of which one the player
// actually edited — see that module's header — so a queued `rounds` update
// whose fields are a non-empty subset of exactly these three is a weather
// edit and nothing else. It can never be a score (those queue on
// `round_holes`, not `rounds`) or another round field riding along, because
// no other caller of `useUpdateRound` sends a weather column mixed with a
// non-weather one.
const WEATHER_ROUND_FIELDS = new Set(['weather_condition', 'wind_mph', 'weather_summary'])

function isWeatherOnlyRoundUpdate(entry) {
  if (entry?.table !== ROUND_TABLE || entry?.op !== 'update') return false
  const keys = Object.keys(entry.payload?.fields ?? {})
  return keys.length > 0 && keys.every((key) => WEATHER_ROUND_FIELDS.has(key))
}

/**
 * Whether every queued outbox entry for a round is a weather-only patch, as
 * opposed to a score, a roster seat, or another round field also waiting to
 * reach the server.
 *
 * This is the distinction the round-weather deploy-lag window collapses if a
 * caller only looks at `useRoundSync`'s global `syncStatus`: that status is
 * computed across every queued entry for every round the scheduler owns, so
 * a lone weather patch retrying behind a not-yet-landed migration flips it to
 * PENDING/ERROR_RETRYING exactly the same as an unsynced score would. The
 * round's actual scoring data — the thing a player would lose if the device
 * died — already reached the server in that case; only a three-column
 * weather patch (including the pre-existing free-text `weather_summary`,
 * which rides along even though it predates the migration) is still queued.
 *
 * Returns false when `entries` is empty. "Nothing is queued" and "only
 * weather is queued" are different facts, and callers already know which one
 * applies from whether the round has any pending entries at all.
 */
export function isRoundOutboxWeatherOnly(entries = []) {
  return entries.length > 0 && entries.every(isWeatherOnlyRoundUpdate)
}

const ROUND_OUTBOX_TABLES = [ROUND_TABLE, ROUND_HOLE_TABLE, ROUND_PLAYER_TABLE]

/** Queued outbox rows for one round, across all three round-outbox tables. */
export async function roundOutboxEntries(roundId, database = db) {
  const rows = await createOutboxQueue({ database, tables: ROUND_OUTBOX_TABLES }).rows()
  return rows.filter((row) => roundIdForOutboxEntry(row) === roundId)
}
