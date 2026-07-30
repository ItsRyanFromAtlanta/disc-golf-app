// Group-scorecard groundwork — the roster half.
//
// A round can now record who else was on the card. That is deliberately all it
// records: the ownership model is the groundwork, and it is the one thing a
// later group feature cannot be retrofitted with.
//
// **A companion is a marker owned by the round's creator**, not a row owned by
// the companion. `20260730234500_phase_e_round_players.sql` argues that at
// length; the short form is that the alternative breaks four things at once —
// the single-active invariant (`activities_one_current_per_user_idx` is unique
// per user, and the person beside you is usually keeping their own card), the
// `auth.uid() = user_id` RLS shape (writing their row means someone who is not
// them can write their data), soft deletion (hiding my round would leave their
// half behind), and the ordinary case where they do not have an account at all.
//
// So a companion row is my private record of who I played with and what I saw
// them shoot — the same kind of fact as `rounds.weather_summary`. It is never
// their round, and it never becomes their round: connecting it to a real
// account is a *claim*, the claimant owns it, and it needs the consent design
// that `PRODUCT_ROADMAP.md` parks behind the Social revisit trigger.
//
// The consequence this module has to honour on every line: **this is a third
// party's name, recorded by someone else.** The roadmap's rule is that private
// names never enter community aggregates. Nothing here is shared, joined to a
// community table, or aggregated across accounts, and there is no identifier
// beside the name — a free-text label cannot assert who somebody is.

// Seats on the card, excluding the owner — the owner is the round. Seven
// companions is a card of eight, past any real disc golf group.
//
// Capped here AND in the database (`check (position between 1 and 7)`), per the
// AGENTS.md interlock rule that a cap enforced in one layer only is not
// enforced. The app-side cap is what keeps a rejected write out of the outbox,
// where a 23514 classifies as permanent and would poison the round.
export const ROUND_PLAYER_LIMIT = 7

export const MAX_PLAYER_NAME_LENGTH = 60

/**
 * A display name, or null.
 *
 * Whitespace is collapsed as well as trimmed so that "Dave  " and "Dave" are
 * one seat rather than two visually identical ones, and the length cap matches
 * the CHECK exactly — the client must be what rejects a too-long name, because
 * the database rejecting it means a permanent outbox failure on a field the
 * player can see and fix.
 */
export function normalizePlayerName(value) {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim()
  if (!name) return null
  return name.slice(0, MAX_PLAYER_NAME_LENGTH)
}

/**
 * A stated total, or null.
 *
 * Always *stated*: there is no companion scorecard to derive one from, and
 * there deliberately is not going to be one until per-hole companion scoring
 * lands with its own provenance discriminator. Everything that prints this
 * number labels it, for the same reason `roundScoreSummary` labels a round's.
 */
export function normalizeStatedTotal(value) {
  if (value === '' || value == null || typeof value === 'boolean') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return Math.round(number)
}

export function isValidPosition(value) {
  return Number.isInteger(value) && value >= 1 && value <= ROUND_PLAYER_LIMIT
}

/**
 * The exact columns to persist for one companion, or `null` when there is
 * nothing worth writing.
 *
 * Returns `null` rather than a partial row for a blank name or an out-of-range
 * seat: both are values the database would reject, and a rejected write on this
 * surface goes to the outbox where `23514` classifies as permanent. Refusing
 * here costs a keystroke; refusing there costs the round.
 */
export function roundPlayerFields(input = {}) {
  const displayName = normalizePlayerName(input.displayName ?? input.display_name)
  const position = Number(input.position)
  const roundId = input.roundId ?? input.round_id ?? null
  const userId = input.userId ?? input.user_id ?? null
  if (!displayName || !roundId || !userId || !isValidPosition(position)) return null

  return {
    id: input.id ?? crypto.randomUUID(),
    round_id: roundId,
    user_id: userId,
    position,
    display_name: displayName,
    total_score: normalizeStatedTotal(input.totalScore ?? input.total_score),
  }
}

/**
 * Reads a persisted row into the shape the UI edits.
 */
export function readRoundPlayer(row = {}) {
  return {
    id: row.id ?? null,
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : null,
    displayName: normalizePlayerName(row.display_name) ?? '',
    totalScore: normalizeStatedTotal(row.total_score),
  }
}

/**
 * A roster in seat order, with the seat as the identity.
 *
 * Seat, not row id, is the natural key — `unique (round_id, position)` in the
 * schema, and what a write upserts on. E2 audit finding 1 is the reason: a
 * replay whose locally-generated id had changed took the INSERT branch and
 * poisoned the outbox forever. Resolving on the seat converges instead, so when
 * two rows claim the same seat (a remote row and an optimistic local one) the
 * newer `updated_at` wins here rather than both being rendered.
 *
 * Rows with an unusable seat are dropped rather than sorted to one end. A
 * companion with no seat is not a companion the schema can hold, and rendering
 * it would show something no reload will reproduce.
 */
export function normalizeRoster(rows = []) {
  if (!Array.isArray(rows)) return []
  const bySeat = new Map()
  for (const row of rows) {
    const position = Number(row?.position)
    if (!isValidPosition(position)) continue
    if (!normalizePlayerName(row?.display_name)) continue
    const existing = bySeat.get(position)
    if (!existing || recordedAt(row) >= recordedAt(existing)) bySeat.set(position, row)
  }
  return [...bySeat.values()].sort((left, right) => Number(left.position) - Number(right.position))
}

function recordedAt(row) {
  const value = row?.updated_at ?? row?.created_at ?? null
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/**
 * The lowest free seat, or `null` when the card is full.
 *
 * Lowest free rather than "one past the highest": removing the third of three
 * companions and adding another should reuse seat 3, not leave a hole and climb
 * towards the cap. A card of seven is then genuinely seven, not seven writes.
 */
export function nextAvailablePosition(rows = []) {
  const taken = new Set(normalizeRoster(rows).map((row) => Number(row.position)))
  for (let position = 1; position <= ROUND_PLAYER_LIMIT; position += 1) {
    if (!taken.has(position)) return position
  }
  return null
}

export function isRosterFull(rows = []) {
  return nextAvailablePosition(rows) == null
}

/**
 * One line for who else was on the card, or `null` when nobody was recorded.
 *
 * `null`, not "Played alone": an empty roster means nothing was recorded, which
 * is not the same claim as having played alone, and this app does not infer the
 * second from the first. Every solo round ever logged has an empty roster.
 */
export function describeRoster(rows = []) {
  const roster = normalizeRoster(rows)
  if (roster.length === 0) return null
  const names = roster.map((row) => normalizePlayerName(row.display_name)).filter(Boolean)
  if (names.length === 1) return `Played with ${names[0]}`
  return `Played with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
